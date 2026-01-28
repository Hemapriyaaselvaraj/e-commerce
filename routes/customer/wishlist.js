const express = require('express');
const router = express.Router();
const wishlistController = require('../../controllers/customer/wishlist.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');

// Routes that require authentication
router.post('/toggle', isCustomerAccessible, wishlistController.toggleWishlist);
router.get('/', isCustomerAccessible, wishlistController.getWishlist);
router.post('/add', isCustomerAccessible, wishlistController.addToWishlist);
router.delete('/remove', isCustomerAccessible, wishlistController.removeFromWishlist);
router.patch('/addToCart', isCustomerAccessible, wishlistController.moveToCart);

// Routes that don't require authentication (for displaying counts to unauthenticated users)
router.get('/count', wishlistController.getWishlistCount);

module.exports = router;
