const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    offerName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },

    // If offer applies to specific products
    product: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
      },
    ],

    // If offer applies to specific categories
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product-category',
      },
    ],

    // Admin can enable/disable an offer
    isActive: {
      type: Boolean,
      default: true,
    },

    validFrom: {
      type: Date,
      required: true,
    },

    validTo: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Method to check if offer is valid and active
offerSchema.methods.isValid = function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.validFrom &&
    now <= this.validTo
  );
};

module.exports = mongoose.model('offer', offerSchema);
