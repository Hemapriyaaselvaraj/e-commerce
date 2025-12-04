const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/admin/dashboard.controller')
const productController = require('../controllers/admin/product.controller')
const orderController = require('../controllers/admin/order-management.controller')
const customerController = require('../controllers/admin/customer-management.controller')
const upload = require('../utils/imageUploader');


router.get('/dashboard', dashboardController.getDashboard)
router.get('/products/configuration' , productController.getProductConfiguration)

router.post('/products/category', productController.createCategory)
router.put('/products/category/:id', productController.updateCategory)
router.delete('/products/category/:id', productController.deleteCategory)

router.post('/products/type', productController.createType);
router.put('/products/type/:id', productController.updateType);
router.delete('/products/type/:id', productController.deleteType);

router.post('/products/size', productController.createSize);
router.put('/products/size/:id', productController.updateSize);
router.delete('/products/size/:id', productController.deleteSize);

router.post('/products/color', productController.createColor);
router.put('/products/color/:id', productController.updateColor);
router.delete('/products/color/:id', productController.deleteColor);

router.get('/products', productController.getProducts);
router.get('/products/addProduct', productController.getAddProduct)
router.post('/products/add', upload.any(), productController.createProduct);

router.get('/products/edit/:id', productController.getEditProduct);
router.post('/products/edit/:id', upload.any(),productController.postEditProduct)
router.post('/products/:id/toggle-active', productController.toggleActive);

router.get('/orders', orderController.getOrderList)
router.get('/orders/:id', orderController.getOrderDetail)
router.post('/orders/:id/cancel', orderController.cancelOrder)
router.post('/orders/:id/return',orderController.returnProduct)
router.post('/orders/:id/status',orderController.updateOrderStatus)
router.post('/orders/:id/return/verify', orderController.verifyReturn)

router.get('/customers', customerController.getCustomers)
router.post('/customers/:id/block-unblock', customerController.blockUnblockCustomer)

router.get('/logout', productController.logout);

module.exports = router;