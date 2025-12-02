const express = require('express');
const router = express.Router();
const checkoutController = require('../../controllers/customer/checkout.controller');

router.get('/', checkoutController.checkout);
// router.post('/address/add' , checkoutController.addAddress )
// router.post('/address/edit', checkoutController.editAddress)

module.exports = router;