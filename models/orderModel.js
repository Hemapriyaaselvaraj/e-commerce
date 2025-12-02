const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  order_number: {
    type: String,
    unique: true,
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  products: [
    {
      variation: {
        type: Schema.Types.ObjectId,
        ref: 'product_variation',
        required: true
      },
      name: String,
      quantity: Number,
      price: Number,
      original_price: Number,
      discount_percentage: Number,
      color: String,
      size: String,
      images: [String],
      status: {
        type: String,
        enum: ['ORDERED', 'SHIPPED', 'OUT_FOR_DELIVERY' , 'DELIVERED', 'RETURNED', 'CANCELLED', 'RETURN_REQUESTED'],
        default: 'ORDERED'
      },
      return_details: {
        reason: String,
        comments: String,
        requested_at: Date,
        status: {
          type: String,
          enum: ['PENDING', 'APPROVED', 'REJECTED'],
          default: 'PENDING'
        },
        refundAmount: Number
      }
    }
  ],
  status: {
    type: String,
    enum: ['ORDERED', 'SHIPPED', 'OUT_FOR_DELIVERY' , 'DELIVERED', 'RETURNED', 'CANCELLED','PENDING'],
    default: 'ORDERED'
  },
  returns: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: 'product_variation'
      },
      reason: String,
      status: {
        type: String,
        enum: ['REQUESTED', 'APPROVED', 'REJECTED'],
        default: 'Requested'
      },
      refundAmount: Number
    }
  ],
  total: {
    type: Number,
    required: true
  },
  shipping_charge: {
    type: Number,
    required: true
  },
  ordered_at: {
    type: Date,
    default: Date.now
  },
  delivered_at: Date,
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true
  },
  shipping_address: new Schema({
    name: { type: String, required: true },
    label: { type: String },
    type: { type: String, enum: ['HOME', 'WORK', 'OTHER'] },
    house_number: { type: String },
    street: { type: String },
    locality: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone_number: { type: String, required: true }
  }, { _id: false }),
  payment_method: {
    type: String,
    enum: ['UPI', 'DEBIT', 'CREDIT', 'COD', 'WALLET', 'RAZOR_PAY','RAZORPAY', 'ONLINE'],
    required: true
  },
  payment_status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  transaction_id: String,
  estimated_delivery_date: Date,
  shipping_tracking_number: String,
  notes: String,
  razorpay: {
  order_id: String,   // Razorpay generated order id
  payment_id: String, // Razorpay payment id (after user pays)
  signature: String,  // Razorpay signature for verification
  amount: Number,
  currency: String
}
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
