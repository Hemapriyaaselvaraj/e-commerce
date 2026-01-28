const express = require('express');
const router = express.Router();
const productController = require('../../controllers/customer/product.controller')

// Remove authentication middleware - product browsing should be accessible to everyone
router.get('/', productController.productList)
router.get('/:id',productController.productDetail)

module.exports = router;