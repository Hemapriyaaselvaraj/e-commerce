
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wishlistSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product_id: {
    type: Schema.Types.ObjectId,
    ref: 'product',
    required: true
  },
  variation_id: {
    type: Schema.Types.ObjectId,
    ref: 'product_variation',
    required: true
  },
  selected_size: {
    type: String,
    required: true
  },
  selected_color: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('wishlist', wishlistSchema);
