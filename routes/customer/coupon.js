const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/customer/coupon.controller')
const {isCustomerAccessible} = require('../../middlewares/auth');

router.use(isCustomerAccessible);

router.post('/apply-coupon', couponController.applyCoupon);
router.post('/remove-coupon', couponController.removeCoupon)


module.exports = {
    router
}
