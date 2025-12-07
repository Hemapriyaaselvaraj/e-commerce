const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },

  description: {
    type: String,
    default: ""
  },

  discountType: {
    type: String,
    enum: ["PERCENTAGE", "FLAT"],
    required: true
  },

  discountValue: {
    type: Number,
    required: true
  },

  minimumPurchase: {
    type: Number,
    default: 0
  },

  maxDiscount: {
    type: Number,
    default: 0 // applicable only when percentage
  },

  validFrom: {
    type: Date,
    required: true
  },

  validTo: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  usageLimitPerUser: {
    type: Number,
    default: 1
  },

  usedBy: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      count: { type: Number, default: 0 }
    }
  ]
});

module.exports = mongoose.model("Coupon", couponSchema);
