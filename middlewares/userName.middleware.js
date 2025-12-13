const userModel = require('../models/userModel');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');

const attachUserName = async (req, res, next) => {
  try {
    if (req.session?.userId) {
      const user = await userModel.findById(req.session.userId);
      if (user) {
        res.locals.name = user.firstName + " " + user.lastName;
        
        // Get cart count (sum of quantities)
        const cartItems = await Cart.find({ user_id: req.session.userId });
        res.locals.cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
        
        // Get wishlist count
        const wishlistCount = await Wishlist.countDocuments({ user_id: req.session.userId });
        res.locals.wishlistCount = wishlistCount;
      }
    } else {
      // For non-logged in users
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
    }
    next(); 
  } catch (err) {
    console.error("Middleware error:", err);
    // Set default values on error
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    next();
  }
};

module.exports = attachUserName;