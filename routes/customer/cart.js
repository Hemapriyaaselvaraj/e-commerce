const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/customer/cart.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.get('/',isCustomerAccessible, cartController.getCartPage)
router.post('/updateQuantity',isCustomerAccessible, cartController.updateCartQuantity);
router.post('/remove', isCustomerAccessible,cartController.removeFromCart);
router.post('/add', isCustomerAccessible,cartController.addToCart);


module.exports = router;