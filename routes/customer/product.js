const express = require('express');
const router = express.Router();
const productController = require('../../controllers/customer/product.controller')


router.get('/', productController.productList)
router.get('/:id',productController.productDetail)

module.exports = router;