const express = require('express');
const router = express.Router();
const productController = require('../../controllers/customer/product.controller')
const {isCustomerAccessible} = require('../../middlewares/auth');

router.use(isCustomerAccessible);

router.get('/', productController.productList)
router.get('/:id',productController.productDetail)

module.exports = router;