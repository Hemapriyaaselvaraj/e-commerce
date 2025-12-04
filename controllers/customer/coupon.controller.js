const Coupon = require("../../models/couponModel");
const Cart = require("../../models/cartModel");

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { couponCode } = req.body;

    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }

    if (new Date() > coupon.expiresAt) {
      return res.json({ success: false, message: "Coupon expired" });
    }

    // Check usage count
    const usage = coupon.usedBy.find(u => u.userId.toString() === userId);

    if (usage && usage.count >= coupon.usageLimit) {
      return res.json({ success: false, message: "You already used this coupon" });
    }

    // Get cart total
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart empty" });
    }

    let total = 0;
    cart.items.forEach(item => {
      total += item.price * item.quantity;
    });

    if (total < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase ₹${coupon.minPurchase} required`
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "PERCENT") {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    const grandTotal = total - discount;

    // Apply coupon → update DB, not session
    if (usage) {
      usage.count += 1;
    } else {
      coupon.usedBy.push({
        userId,
        count: 1
      });
    }

    await coupon.save();

    return res.json({
      success: true,
      discount,
      grandTotal,
      message: "Coupon applied successfully"
    });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { couponCode } = req.body;

    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }

    const usage = coupon.usedBy.find(u => u.userId.toString() === userId);

    if (usage && usage.count > 0) {
      usage.count -= 1;
      await coupon.save();
    }

    return res.json({ success: true, message: "Coupon removed" });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


module.exports = {
    applyCoupon,
    removeCoupon
}