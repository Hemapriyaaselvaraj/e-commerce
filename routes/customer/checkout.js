const express = require('express');
const router = express.Router();
const checkoutController = require('../../controllers/customer/checkout.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');

router.get('/available-coupons', checkoutController.getAvailableCoupons); // No auth for testing

router.use(isCustomerAccessible);

router.get('/', checkoutController.checkout);
router.post('/address/add', checkoutController.addAddress);
router.post('/address/edit', checkoutController.editAddress);

module.exports = router;