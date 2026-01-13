const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/customer/cart.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.get('/',isCustomerAccessible, cartController.getCartPage)
router.get('/total', isCustomerAccessible, cartController.getCartTotal)
router.patch('/updateQuantity',isCustomerAccessible, cartController.updateCartQuantity);
router.delete('/remove', isCustomerAccessible,cartController.removeFromCart);
router.post('/add', isCustomerAccessible,cartController.addToCart);
router.get('/count', cartController.getCartCount);


module.exports = router;