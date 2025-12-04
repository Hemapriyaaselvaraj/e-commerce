const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true },
  discountType: { type: String, enum: ["PERCENT", "FLAT"], required: true },
  discountValue: { type: Number, required: true },
  minPurchase: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  usageLimit: { type: Number, default: 1 },  // how many times a single user can use

  usedBy: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId },
      count: { type: Number, default: 0 }
    }
  ]
});

module.exports = mongoose.model("Coupon", couponSchema);
