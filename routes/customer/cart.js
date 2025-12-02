const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/customer/cart.controller');

router.get('/', cartController.getCartPage)
router.post('/updateQuantity', cartController.updateCartQuantity);
router.post('/remove', cartController.removeFromCart);
router.post('/add', cartController.addToCart);


module.exports = router;