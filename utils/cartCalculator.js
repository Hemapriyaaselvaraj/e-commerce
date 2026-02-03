const Cart = require('../models/cartModel');
const Offer = require('../models/offerModel');
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

    cartItems.forEach((item) => {
      const variation = item.product_variation_id;
      const product = variation?.product_id;
      
      // Skip items that are inactive or out of stock
      if (!product || !product.is_active || variation.stock_quantity < item.quantity) {
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
    
    // Get coupon discount from session
    let couponDiscount = 0;
    let appliedCouponCode = null;
    if (session.appliedCoupon) {
      couponDiscount = session.appliedCoupon.discount || 0;
      appliedCouponCode = session.appliedCoupon.code;
    }

    // Ensure coupon discount doesn't exceed subtotal + shipping to prevent negative totals
    const maxDiscount = subtotal + shipping;
    if (couponDiscount > maxDiscount) {
      couponDiscount = maxDiscount;
    }

    const total = subtotal + shipping - couponDiscount;

    return {
      success: true,
      subtotal: Math.round(subtotal),
      shipping,
      couponDiscount: Math.round(couponDiscount),
      appliedCouponCode,
      total: Math.round(total),
      items: validItems
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