const express = require('express');
const router = express.Router();
const wishlistController = require('../../controllers/customer/wishlist.controller');

router.post('/toggle', wishlistController.toggleWishlist);

router.get('/',wishlistController.getWishlist);
router.post('/add',wishlistController.addToWishlist);
router.post('/remove',wishlistController.removeFromWishlist);
router.post('/addToCart',wishlistController.moveToCart)


module.exports = router;
