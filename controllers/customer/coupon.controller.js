const Coupon = require("../../models/couponModel");
const Cart = require("../../models/cartModel");
const Offer = require("../../models/offerModel");
const { calculateBestOffer } = require("../../utils/offerCalculator");


const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { couponCode } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      return res.json({ success: false, message: "Coupon expired or not yet valid" });
    }

    if (coupon.usedBy && coupon.usedBy.length > 0) {
      const usedData = coupon.usedBy.find(u => u.userId && u.userId.toString() === userId.toString());
      if (usedData && usedData.count >= coupon.usageLimitPerUser) {
        return res.json({ success: false, message: "You have already used this coupon maximum times" });
      }
    }

    const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: "product_variation_id",
        populate: { path: "product_id" }
      });

    if (!cartItems || cartItems.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    }).populate('category', 'category').lean();

    let cartTotal = 0;
    cartItems.forEach((item, index) => {
      const product = item.product_variation_id?.product_id;
      if (product && product.is_active) {
        const offerResult = calculateBestOffer(product, activeOffers);
        const price = offerResult.finalPrice;

        const itemTotal = price * item.quantity;
        cartTotal += itemTotal;
      }
    });

    if (cartTotal < (coupon.minimumPurchase || 0)) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required`,
      });
    }


    let discount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discount = Math.round((cartTotal * coupon.discountValue) / 100);

      if (coupon.maxDiscount && coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // Additional business logic validation for fixed amount coupons
      const minPurchase = coupon.minimumPurchase || 0;
      if (minPurchase <= coupon.discountValue) {
        return res.json({
          success: false,
          message: `This coupon violates business rules: minimum purchase (₹${minPurchase}) must be greater than discount (₹${coupon.discountValue}). Please contact support.`,
        });
      }
      
      // For fixed amount coupons, apply discount but ensure it doesn't exceed cart total
      discount = Math.min(coupon.discountValue, cartTotal);
    }

  
    const shipping = cartTotal > 1000 ? 0 : 50;
    const grandTotal = Math.round(cartTotal + shipping - discount);

    req.session.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      discount,
    };

    return res.json({
      success: true,
      discount: Math.round(discount),
      grandTotal,
      message: "Coupon applied successfully!",
    });

  } catch (error) {
    console.error("Coupon Apply Error:", error);
    res.json({ 
      success: false, 
      message: "Unable to apply coupon at the moment. Please try again later." 
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }


    delete req.session.appliedCoupon;

    return res.json({
      success: true,
      message: "Coupon removed successfully",
    });

  } catch (error) {
    console.error("Remove Coupon Error:", error);
    res.json({ 
      success: false, 
      message: "Unable to remove coupon at the moment. Please try again later." 
    });
  }
};

module.exports = {
    applyCoupon,
    removeCoupon
}