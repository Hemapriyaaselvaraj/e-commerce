const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/customer/wallet.controller')

router.get('/', walletController.getWalletPage);
router.post('/create-order', walletController.createOrder);
router.post('/verify', walletController.verifyPayment)

module.exports = router;