const express = require('express');
const router = express.Router();
const {isAdminAccessible} = require('../middlewares/auth')
const dashboardController = require('../controllers/admin/dashboard.controller')
const productController = require('../controllers/admin/product.controller')
const orderController = require('../controllers/admin/order-management.controller')
const customerController = require('../controllers/admin/customer-management.controller')
const offerController = require('../controllers/admin/offer-management.controller')
const couponController = require('../controllers/admin/coupon.management.controller')
const reportController = require('../controllers/admin/report.controller')
const upload = require('../utils/imageUploader');

router.use(isAdminAccessible);

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
router.patch('/products/edit/:id', upload.any(),productController.postEditProduct)
router.patch('/products/:id/toggle-active', productController.toggleActive);

router.get('/orders', orderController.getOrderList)
router.get('/orders/:id', orderController.getOrderDetail)
router.patch('/orders/:id/cancel', orderController.cancelOrder)
router.patch('/orders/:id/return',orderController.returnProduct)
router.patch('/orders/:id/status',orderController.updateOrderStatus)
router.patch('/orders/:id/product-status', orderController.updateProductStatus)
router.patch('/orders/:id/return/verify', orderController.verifyReturn)

router.get('/customers', customerController.getCustomers)
router.patch('/customers/:id/block-unblock', customerController.blockUnblockCustomer)

router.get("/offers", offerController.getOffersList)
router.get("/add-offer", offerController.getAddOffer)
router.post("/add-offer", offerController.postAddOffer)

router.get('/edit-offer/:id', offerController.getEditOffer)
router.patch('/edit-offer/:id', offerController.postEditOffer)
router.patch('/toggle-offer/:id', offerController.toggleOfferStatus)
router.get('/delete-offer/:id', offerController.deleteOffer)
router.delete('/delete-offer/:id', offerController.deleteOffer)

router.get('/coupons', couponController.getCoupons)
router.get('/add-coupon', couponController.getAddCoupon)
router.post('/add-coupon', couponController.postAddCoupon)
router.get('/edit-coupon/:id', couponController.getEditCoupon)
router.post('/edit-coupon/:id', couponController.postEditCoupon)
router.patch('/edit-coupon/:id', couponController.postEditCoupon)
router.delete('/delete-coupon/:id', couponController.deleteCoupon)

router.get('/sales-report', reportController.getSalesReportPage)
router.get('/sales-report/data',reportController.getSalesReportData);

router.get('/sales-report/download/pdf', reportController.downloadPDF);
router.get('/sales-report/download/excel', reportController.downloadExcel);


router.get('/logout', productController.logout);

module.exports = router;