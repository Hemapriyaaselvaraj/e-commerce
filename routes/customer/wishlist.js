const express = require('express');
const router = express.Router();
const wishlistController = require('../../controllers/customer/wishlist.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.use(isCustomerAccessible);

router.post('/toggle', wishlistController.toggleWishlist);

router.get('/',wishlistController.getWishlist);
router.post('/add',wishlistController.addToWishlist);
router.delete('/remove',wishlistController.removeFromWishlist);
router.patch('/addToCart',wishlistController.moveToCart);
router.get('/count', wishlistController.getWishlistCount);


module.exports = router;
