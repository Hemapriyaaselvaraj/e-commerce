const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/customer/order.controller');
const couponController = require('../../controllers/customer/coupon.controller')
const {isCustomerAccessible} = require('../../middlewares/auth');

router.use(isCustomerAccessible);

router.post('/place-order', orderController.placeOrder );
router.post('/verifyPayment', orderController.verifyPayment);
router.post('/return-request', orderController.requestReturn);
router.post('/cancel/:orderId/product', orderController.cancelOrder);

router.post('/cancel/:orderId', orderController.cancelOrder)
router.get('/orderSuccess/:orderId', orderController.getOrderSuccess);
router.get('/orderFailure/:orderId', orderController.getOrderFailure);
router.get('/my-orders', orderController.getUserOrders);
router.get('/details/:orderId', orderController.getOrderDetails);
router.get('/download-invoice/:orderId', orderController.downloadInvoice)

router.post('/apply-coupon', couponController.applyCoupon)
router.post('/remove-coupon', couponController.removeCoupon)

module.exports = router;