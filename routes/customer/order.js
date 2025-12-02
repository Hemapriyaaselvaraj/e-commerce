const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/customer/order.controller');

router.post('/place-order', orderController.placeOrder );
router.post('/verifyPayment', orderController.verifyPayment);

router.get('/orderSuccess/:orderId', orderController.getOrderSuccess);
router.get('/orderFailure/:orderId', orderController.getOrderFailure);
router.get('/my-orders', orderController.getUserOrders);
router.get('/details/:orderId', orderController.getOrderDetails)

module.exports = router;