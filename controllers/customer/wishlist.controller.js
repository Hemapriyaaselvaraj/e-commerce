const Wishlist = require('../../models/wishlistModel');
const ProductVariation = require('../../models/productVariationModel');
const User = require('../../models/userModel');
const Cart = require('../../models/cartModel');


const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session && req.session.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to manage your wishlist.' 
      });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product selection is required to update your wishlist.' 
      });
    }

    const variation = await ProductVariation.findOne({ product_id: productId }).lean();
    if (!variation) {
      return res.status(400).json({ 
        success: false, 
        message: 'This product is currently unavailable for wishlist.' 
      });
    }

    const existing = await Wishlist.findOne({
      user_id: userId,
      product_id: productId,
      variation_id: variation._id,
    });

    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });
      return res.json({ success: true, action: 'removed' });
    }

    const newEntry = new Wishlist({
      user_id: userId,
      product_id: productId,
      variation_id: variation._id,
      selected_size: variation.product_size || '',
      selected_color: variation.product_color || '',
    });
    await newEntry.save();
    return res.json({ success: true, action: 'added' });
  } catch (error) {
    console.error('Wishlist toggle error', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Unable to update your wishlist at the moment. Please try again later.' 
    });
  }
};


const getWishlist = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const wishlistEntries = await Wishlist.find({ user_id: req.session.userId })
      .populate('product_id')
      .populate('variation_id');

    const items = wishlistEntries.map(entry => ({
      category: entry.product_id.product_category,
      price: entry.product_id.price,
      image: (entry.variation_id?.images?.length > 0) 
        ? entry.variation_id.images[0] 
        : '/images/default-shoe.png',
      _id: entry._id,
      size: entry.selected_size,
      color: entry.selected_color,
      variationId: entry.variation_id._id
    }));

    res.render('user/wishlist', {
      items: items,
      itemCount: items.length,
    });

  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).render('user/500', { 
      message: 'Unable to load your wishlist at the moment. Please refresh the page or try again later.' 
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to manage your wishlist.' 
      });
    }
    
    const { wishlistId } = req.body;
    if (!wishlistId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item selection is required to remove from wishlist.' 
      });
    }
    
    const result = await Wishlist.deleteOne({ 
      user_id: req.session.userId, 
      _id: wishlistId,
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found in your wishlist.' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Item removed from wishlist successfully.' 
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to remove item from wishlist. Please try again later.' 
    });
  }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to add items to your wishlist.' 
      });
    }
    
    const { productId, variationId, size, color } = req.body;
    
    if (!productId || !variationId || !size || !color) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product details including size and color are required to add to wishlist.' 
      });
    }

    const exists = await Wishlist.findOne({ 
      user_id: req.session.userId, 
      product_id: productId,
      variation_id: variationId 
    });

    if (exists) {
      return res.status(200).json({ 
        success: true, 
        message: 'This item is already in your wishlist.' 
      });
    }

    const variation = await ProductVariation.findById(variationId);
    if (!variation || variation.product_size !== size || variation.product_color !== color) {
      return res.status(400).json({ 
        success: false, 
        message: 'Selected product variation is not available.' 
      });
    }
    
    await Wishlist.create({ 
      user_id: req.session.userId, 
      product_id: productId,
      variation_id: variationId,
      selected_size: size,
      selected_color: color
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Item added to your wishlist successfully.' 
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to add item to wishlist. Please try again later.' 
    });
  }
};

const moveToCart = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    const { wishlistId } = req.body;
    if (!wishlistId) {
      return res.status(400).json({ success: false, message: 'Missing wishlistId' });
    }

    const entry = await Wishlist.findOne({
      _id: wishlistId,
      user_id: req.session.userId
    }).populate('variation_id');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Wishlist item not found' });
    }

    const variation = entry.variation_id;
    if (!variation) {
      return res.status(404).json({ success: false, message: 'Product variation not found' });
    }

    let cartItem = await Cart.findOne({
      user_id: req.session.userId,
      product_variation_id: variation._id
    });

    const MAX_QTY = 5;

    if (cartItem) {
      // Check if adding 1 more would exceed the maximum quantity limit
      if (cartItem.quantity + 1 > MAX_QTY) {
        return res.status(400).json({ 
          success: false, 
          message: 'You cannot add more than 5 of this product to your cart.' 
        });
      }
      
      // Check if adding 1 more would exceed available stock
      if (cartItem.quantity + 1 > variation.stock_quantity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quantity exceeds available stock' 
        });
      }
      
      cartItem.quantity += 1;
      cartItem.updated_at = Date.now();
      await cartItem.save();
    } else {
      // For new cart items, quantity will be 1, so just check stock
      if (variation.stock_quantity < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Out of stock' 
        });
      }
      
      await Cart.create({
        user_id: req.session.userId,
        product_variation_id: variation._id,
        quantity: 1
      });
    }

    await Wishlist.deleteOne({
      _id: wishlistId,
      user_id: req.session.userId
    });

    res.status(200).json({ success: true, message: 'Moved to cart' });

  } catch (err) {
    console.error('Move to cart error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};




const getWishlistCount = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.json({ success: true, count: 0 });

    const count = await Wishlist.countDocuments({ user_id: userId });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get wishlist count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to get wishlist count. Please refresh the page.' 
    });
  }
};

module.exports = {
  toggleWishlist ,
  getWishlist,
  removeFromWishlist,
  addToWishlist,
  moveToCart,
  getWishlistCount
 };
