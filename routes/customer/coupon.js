const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/customer/coupon.controller')
const {isCustomerAccessible} = require('../../middlewares/auth');

router.use(isCustomerAccessible);

router.patch('/apply-coupon', couponController.applyCoupon);
router.delete('/remove-coupon', couponController.removeCoupon)


module.exports = {
    router
}
