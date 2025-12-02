const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  product_sku: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  product_type: { type: String, required: true },
  product_category: { type: String, required: true },
  price: { type: Number, min : 0, required: true },
  discount_percentage: { type: Number, default: 0 , min: 0, max: 100},
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('product', productSchema);
