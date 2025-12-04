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

  // PRODUCTS IN THE ORDER
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

      // Product-wise status
      status: {
        type: String,
        enum: [
          'ORDERED',
          'SHIPPED',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'CANCELLED',
          'RETURN_REQUESTED',
          'RETURNED'
        ],
        default: 'ORDERED'
      },

      // Product-wise return information
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

  // OVERALL ORDER STATUS
  status: {
    type: String,
    enum: [
      'PENDING',
      'ORDERED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURNED'
    ],
    default: 'ORDERED'
  },

  // ORDER AMOUNTS
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  shipping_charge: { type: Number, required: true },
  total: { type: Number, required: true },

  // DATES
  ordered_at: {
    type: Date,
    default: Date.now
  },
  delivered_at: Date,
  estimated_delivery_date: Date,

  // SHIPPING ADDRESS
  shipping_address: new Schema(
    {
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
    },
    { _id: false }
  ),

  // PAYMENT DETAILS
  payment_method: {
    type: String,
    enum: ['UPI', 'COD', 'WALLET', 'RAZORPAY', 'ONLINE'],
    required: true
  },

  payment_status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },

  transaction_id: String,

  // RAZORPAY DETAILS
  razorpay: {
    order_id: String,
    payment_id: String,
    signature: String,
    amount: Number,
    currency: String
  },

  // OTHER OPTIONAL FIELDS
  shipping_tracking_number: String,
  notes: String
},
{
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);