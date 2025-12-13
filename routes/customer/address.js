const express = require('express');
const router = express.Router();
const addressController = require('../../controllers/customer/address.controller');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.get('/', isCustomerAccessible,addressController.getAddresses);
router.post('/add', isCustomerAccessible,addressController.postAddAddress);
router.post('/set-default/:id',isCustomerAccessible, addressController.setDefaultAddress);
router.delete('/delete/:id', isCustomerAccessible,addressController.deleteAddress);
router.get('/edit/:id',isCustomerAccessible, addressController.getEditAddress);
router.patch('/edit/:id', isCustomerAccessible,addressController.postEditAddress);

module.exports = router;