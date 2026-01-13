const Cart = require('../../models/cartModel');
const ProductVariation = require('../../models/productVariationModel');
const User = require('../../models/userModel');
const Offer = require('../../models/offerModel');
const { calculateBestOffer } = require('../../utils/offerCalculator');

const getCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) return res.redirect('/user/login');

    const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: "product_variation_id",
        populate: { path: "product_id" }  
      });

    
    const now = new Date();
    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    })
    .populate('category', 'category')
    .lean();

    const items = cartItems.map(cart => {

      const variation = cart.product_variation_id;   
      const product = variation?.product_id;         

      const originalPrice = product?.price || 0;

      const offerResult = calculateBestOffer(product, activeOffers);
      const maxOfferDiscount = offerResult.discountPercentage;
      const finalPrice = offerResult.finalPrice;

      return {
        _id: cart._id,
        name: product?.name || "Product",
        size: variation.product_size,
        color: variation.product_color,
        image: variation.images?.[0] || "/images/shoe_main.png",
        quantity: cart.quantity,
        priceBefore: Math.round(originalPrice),
        priceAfter: Math.round(finalPrice),
        discount: maxOfferDiscount, 
        total: Math.round(finalPrice * cart.quantity),
        stock: variation.stock_quantity,
        isActive: product?.is_active
      };
    });

    const validItems = items.filter(i => i.isActive && i.stock > 0);

    const subtotal = validItems.reduce((sum, i) => sum + i.total, 0);
    const shipping = subtotal > 1000 ? 0 : 50;
    const total = subtotal + shipping;

    res.render("user/cart", {
      items,
      subtotal,
      shipping,
      total,
      
    });

  } catch (error) {
    console.error("Cart page error:", error);
    res.status(500).render('user/500', { 
      message: 'Unable to load your cart at the moment. Please refresh the page or try again later.' 
    });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { cartItemId, action } = req.body;

    const userId = req.session.userId;
    if (!userId) 
        return res.status(401).json({ success: false, message: 'Not logged in' });
    
    const cartItem = await Cart.findOne({ _id: cartItemId, user_id: userId });
    if (!cartItem) 
        return res.status(404).json({ success: false, message: 'Cart item not found' });
    
    const variation = await ProductVariation.findById(cartItem.product_variation_id).populate('product_id');
    if (!variation) 
        return res.status(404).json({ success: false, message: 'Variation not found' });
    
    const product = variation.product_id;
    if (!product) 
        return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.is_active === false) {
      return res.status(403).json({ success: false, message: 'Product is blocked or unlisted.' });
    }
   
    if (action === 'increment') {
      if (cartItem.quantity + 1 > variation.stock_quantity) {
        return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
      }
      cartItem.quantity += 1;
    } else if (action === 'decrement') {
      if (cartItem.quantity <= 1) {
        return res.status(400).json({ success: false, message: 'Minimum quantity is 1' });
      }
      cartItem.quantity -= 1;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    
    cartItem.updated_at = Date.now();
    
    await cartItem.save();
    res.json({ success: true, quantity: cartItem.quantity });
  } catch (error) {
    console.error('Update cart quantity error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update cart quantity. Please refresh the page and try again.' 
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { cartItemId } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to manage your cart.' 
      });
    }
    
    if (!cartItemId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item selection is required to remove from cart.' 
      });
    }
    
    const cartItem = await Cart.findOne({ _id: cartItemId, user_id: userId });
    if (!cartItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found in your cart.' 
      });
    }
    
    await Cart.deleteOne({ _id: cartItemId, user_id: userId });
    res.json({ 
      success: true,
      message: 'Item removed from cart successfully.' 
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to remove item from cart. Please refresh the page and try again.' 
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { product_variation_id, quantity } = req.body;
    
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Not logged in' });
   
    if (!product_variation_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    
    const variation = await ProductVariation.findById(product_variation_id).populate('product_id');
    if (!variation) return res.status(404).json({ success: false, message: 'Variation not found' });
    
    const product = variation.product_id;
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    if (product.is_active === false) {
      return res.status(403).json({ success: false, message: 'Product is not available' });
    }
    if (quantity > variation.stock_quantity) {
      return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
    }

    let cartItem = await Cart.findOne({ user_id: userId, product_variation_id });
    const MAX_QTY = 5;
    let newQty = quantity;
    if (cartItem) {
      newQty = cartItem.quantity + quantity;
      if (newQty > MAX_QTY) {
        return res.status(400).json({ success: false, message: 'You cannot add more than 5 of this product to your cart.' });
      }
      if (newQty > variation.stock_quantity) {
        return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
      }
      cartItem.quantity = newQty;
      cartItem.updated_at = Date.now();
      await cartItem.save();
    } else {
      if (quantity > MAX_QTY) {
        return res.status(400).json({ success: false, message: 'You cannot add more than 5 of this product to your cart.' });
      }
      await Cart.create({ user_id: userId, product_variation_id, quantity });
    }
    res.json({ success: true, message: 'Added to cart' });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};



const getCartCount = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: true, count: 0 });

    const cartItems = await Cart.find({ user_id: userId });
    const count = cartItems.reduce((total, item) => total + item.quantity, 0);
    
    res.json({ success: true, count });
  } catch (err) {
    console.error('Get cart count error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
    getCartPage,
    updateCartQuantity,
    removeFromCart,
    addToCart,
    getCartCount
}