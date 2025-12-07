const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/customer/wallet.controller')
const {isCustomerAccessible} = require('../../middlewares/auth');

router.use(isCustomerAccessible);


router.get('/', walletController.getWalletPage);
router.post('/create-order', walletController.createOrder);
router.post('/verify', walletController.verifyPayment)

module.exports = router;