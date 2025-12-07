const Coupon = require("../../models/couponModel");
const Cart = require("../../models/cartModel");

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

    // Validate active
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      return res.json({ success: false, message: "Coupon expired or not yet valid" });
    }

    // Usage limit check (if usedBy field exists)
    if (coupon.usedBy && coupon.usedBy.length > 0) {
      const usedData = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
      if (usedData && usedData.count >= coupon.usageLimitPerUser) {
        return res.json({ success: false, message: "You have already used this coupon maximum times" });
      }
    }

    // Get cart items
    const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: "product_variation_id",
        populate: { path: "product_id" }
      });

    if (!cartItems || cartItems.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    // Calculate cart total (with offers already applied)
    const Offer = require("../../models/offerModel");
    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    }).populate('category', 'category').lean();

    let cartTotal = 0;
    cartItems.forEach(item => {
      const product = item.product_variation_id?.product_id;
      if (product && product.is_active) {
        let price = product.price;
        
        // Apply offer discount
        let maxOfferDiscount = 0;
        const productOffers = activeOffers.filter(offer => 
          offer.product.some(prodId => prodId.toString() === product._id.toString())
        );
        productOffers.forEach(offer => {
          if (offer.discountPercentage > maxOfferDiscount) {
            maxOfferDiscount = offer.discountPercentage;
          }
        });

        const categoryOffers = activeOffers.filter(offer => 
          offer.category && offer.category.length > 0 &&
          offer.category.some(cat => cat && cat.category === product.product_category)
        );
        categoryOffers.forEach(offer => {
          if (offer.discountPercentage > maxOfferDiscount) {
            maxOfferDiscount = offer.discountPercentage;
          }
        });

        const generalOffers = activeOffers.filter(offer => 
          offer.product.length === 0 && offer.category.length === 0
        );
        generalOffers.forEach(offer => {
          if (offer.discountPercentage > maxOfferDiscount) {
            maxOfferDiscount = offer.discountPercentage;
          }
        });

        if (maxOfferDiscount > 0) {
          price = price * (1 - maxOfferDiscount / 100);
        }

        cartTotal += price * item.quantity;
      }
    });

    // Min purchase check
    if (cartTotal < (coupon.minimumPurchase || 0)) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required`,
      });
    }

    // Calculate discount
    let discount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discount = Math.round((cartTotal * coupon.discountValue) / 100);

      if (coupon.maxDiscount && coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    // Calculate shipping
    const shipping = cartTotal > 1000 ? 0 : 50;
    const grandTotal = Math.round(cartTotal + shipping - discount);

    // Save coupon in session
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
    res.json({ success: false, message: "Server error. Please try again." });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    // Remove coupon from session
    delete req.session.appliedCoupon;

    return res.json({
      success: true,
      message: "Coupon removed successfully",
    });

  } catch (error) {
    console.error("Remove Coupon Error:", error);
    res.json({ success: false, message: "Server error" });
  }
};

module.exports = {
    applyCoupon,
    removeCoupon
}