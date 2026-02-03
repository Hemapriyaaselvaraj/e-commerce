const Cart = require('../models/cartModel');
const Offer = require('../models/offerModel');
const Coupon = require('../models/couponModel');
const { calculateBestOffer } = require('./offerCalculator');

/**
 * Calculate cart totals consistently across the application
 * @param {string} userId - User ID
 * @param {Object} session - Express session object
 * @returns {Object} - Cart calculation results
 */
const calculateCartTotals = async (userId, session = {}) => {
  try {
    const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: "product_variation_id",
        populate: { path: "product_id" }
      });

    if (!cartItems || cartItems.length === 0) {
      return {
        success: false,
        message: "Cart is empty",
        subtotal: 0,
        shipping: 0,
        couponDiscount: 0,
        total: 0,
        items: []
      };
    }

    const now = new Date();
    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    }).populate('category', 'category').lean();

    let subtotal = 0;
    const validItems = [];
    const stockIssues = [];

    cartItems.forEach((item) => {
      const variation = item.product_variation_id;
      const product = variation?.product_id;
      
      // Check if product is inactive
      if (!product || !product.is_active) {
        stockIssues.push({
          name: product?.name || 'Unknown Product',
          issue: 'Product is no longer available'
        });
        return;
      }
      
      // Check stock availability
      if (variation.stock_quantity <= 0) {
        stockIssues.push({
          name: product.name,
          issue: 'Out of stock'
        });
        return;
      }
      
      // Check if requested quantity exceeds available stock
      if (variation.stock_quantity < item.quantity) {
        stockIssues.push({
          name: product.name,
          issue: `Only ${variation.stock_quantity} items available, but ${item.quantity} requested`
        });
        return;
      }
      
      const offerResult = calculateBestOffer(product, activeOffers);
      const price = offerResult.finalPrice;
      const itemTotal = price * item.quantity;
      
      subtotal += itemTotal;
      
      validItems.push({
        _id: item._id,
        name: product.name,
        price: price,
        originalPrice: product.price,
        quantity: item.quantity,
        total: itemTotal,
        variation: variation._id,
        color: variation.product_color,
        size: variation.product_size,
        images: variation.images || []
      });
    });

    const shipping = subtotal > 1000 ? 0 : 50;
    
    // Revalidate applied coupon if exists
    let couponDiscount = 0;
    let appliedCouponCode = null;
    let couponValidationMessage = null;
    
    if (session.appliedCoupon) {
      try {
        const coupon = await Coupon.findById(session.appliedCoupon.couponId);
        
        if (!coupon) {
          // Coupon no longer exists
          delete session.appliedCoupon;
          couponValidationMessage = "Applied coupon no longer exists and has been removed.";
        } else {
          const now = new Date();
          
          // Check if coupon is still valid (dates)
          if (now < coupon.validFrom || now > coupon.validTo) {
            delete session.appliedCoupon;
            couponValidationMessage = "Applied coupon has expired and has been removed.";
          }
          // Check minimum purchase requirement
          else if (subtotal < (coupon.minimumPurchase || 0)) {
            delete session.appliedCoupon;
            couponValidationMessage = `Applied coupon requires minimum purchase of ₹${coupon.minimumPurchase} but cart total is ₹${subtotal}. Coupon has been removed.`;
          }
          // Check business logic for fixed amount coupons
          else if (coupon.discountType === 'FLAT' && (coupon.minimumPurchase || 0) <= coupon.discountValue) {
            delete session.appliedCoupon;
            couponValidationMessage = "Applied coupon has invalid configuration and has been removed.";
          }
          // Coupon is still valid, recalculate discount
          else {
            appliedCouponCode = coupon.code;
            
            if (coupon.discountType === "PERCENTAGE") {
              couponDiscount = Math.round((subtotal * coupon.discountValue) / 100);
              if (coupon.maxDiscount && coupon.maxDiscount > 0 && couponDiscount > coupon.maxDiscount) {
                couponDiscount = coupon.maxDiscount;
              }
            } else {
              couponDiscount = Math.min(coupon.discountValue, subtotal);
            }
            
            // Update session with recalculated discount
            session.appliedCoupon.discount = couponDiscount;
          }
        }
      } catch (error) {
        // Error validating coupon, remove it
        delete session.appliedCoupon;
        couponValidationMessage = "Error validating applied coupon. Coupon has been removed.";
      }
    }

    // Ensure coupon discount doesn't exceed subtotal + shipping to prevent negative totals
    const maxDiscount = subtotal + shipping;
    if (couponDiscount > maxDiscount) {
      couponDiscount = maxDiscount;
    }

    const total = subtotal + shipping - couponDiscount;

    // Check if there are stock issues
    if (stockIssues.length > 0) {
      const stockMessage = stockIssues.length === 1 
        ? `${stockIssues[0].name}: ${stockIssues[0].issue}`
        : `${stockIssues.length} items have stock issues. Please check your cart.`;
      
      return {
        success: false,
        message: stockMessage,
        stockIssues,
        subtotal: Math.round(subtotal),
        shipping,
        couponDiscount: Math.round(couponDiscount),
        appliedCouponCode,
        total: Math.round(total),
        items: validItems,
        couponValidationMessage
      };
    }

    return {
      success: true,
      subtotal: Math.round(subtotal),
      shipping,
      couponDiscount: Math.round(couponDiscount),
      appliedCouponCode,
      total: Math.round(total),
      items: validItems,
      couponValidationMessage // Include validation message if coupon was removed
    };

  } catch (error) {
    return {
      success: false,
      message: "Error calculating cart totals",
      subtotal: 0,
      shipping: 0,
      couponDiscount: 0,
      total: 0,
      items: []
    };
  }
};

module.exports = {
  calculateCartTotals
};