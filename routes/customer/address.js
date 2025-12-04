const express = require('express');
const router = express.Router();
const addressController = require('../../controllers/customer/address.controller');

router.get('/', addressController.getAddresses);
router.post('/add', addressController.postAddAddress);
router.post('/set-default/:id', addressController.setDefaultAddress);
router.post('/delete/:id', addressController.deleteAddress);
router.get('/edit/:id', addressController.getEditAddress);
router.post('/edit/:id', addressController.postEditAddress);

module.exports = router;