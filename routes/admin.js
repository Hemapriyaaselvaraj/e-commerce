const express = require('express');
const router = express.Router();
const {isAdminAccessible, validateObjectId} = require('../middlewares/auth')
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
router.get('/dashboard-details', dashboardController.getDashboardDetails)
router.get('/products/configuration' , productController.getProductConfiguration)

router.post('/products/category', productController.createCategory)
router.put('/products/category/:id', validateObjectId, productController.updateCategory)
router.delete('/products/category/:id', validateObjectId, productController.deleteCategory)
router.patch('/products/category/:id/toggle', validateObjectId, productController.toggleCategoryStatus)

router.post('/products/type', productController.createType);
router.put('/products/type/:id', validateObjectId, productController.updateType);
router.delete('/products/type/:id', validateObjectId, productController.deleteType);
router.patch('/products/type/:id/toggle', validateObjectId, productController.toggleTypeStatus);

router.post('/products/size', productController.createSize);
router.put('/products/size/:id', validateObjectId, productController.updateSize);
router.delete('/products/size/:id', validateObjectId, productController.deleteSize);
router.patch('/products/size/:id/toggle', validateObjectId, productController.toggleSizeStatus);

router.post('/products/color', productController.createColor);
router.put('/products/color/:id', validateObjectId, productController.updateColor);
router.delete('/products/color/:id', validateObjectId, productController.deleteColor);
router.patch('/products/color/:id/toggle', validateObjectId, productController.toggleColorStatus);

router.get('/products', productController.getProducts);
router.get('/products/addProduct', productController.getAddProduct)
router.post('/products/add', upload.any(), productController.createProduct);

router.get('/products/edit/:id', validateObjectId, productController.getEditProduct);
router.patch('/products/edit/:id', validateObjectId, upload.any(),productController.postEditProduct);
router.post('/products/edit/:id', validateObjectId, upload.any(),productController.postEditProduct);
router.patch('/products/:id/toggle-active', validateObjectId, productController.toggleActive);

router.get('/orders', orderController.getOrderList)
router.get('/orders/:id', validateObjectId, orderController.getOrderDetail)
router.patch('/orders/:id/cancel', validateObjectId, orderController.cancelOrder)
router.patch('/orders/:id/return', validateObjectId, orderController.returnProduct)
router.patch('/orders/:id/status', validateObjectId, orderController.updateOrderStatus)
router.patch('/orders/:id/product-status', validateObjectId, orderController.updateProductStatus)
router.patch('/orders/:id/return/verify', validateObjectId, orderController.verifyReturn)

router.get('/customers', customerController.getCustomers)
router.patch('/customers/:id/block-unblock', validateObjectId, customerController.blockUnblockCustomer)

router.get("/offers", offerController.getOffersList)
router.get("/add-offer", offerController.getAddOffer)
router.post("/add-offer", offerController.postAddOffer)

router.get('/edit-offer/:id', validateObjectId, offerController.getEditOffer)
router.patch('/edit-offer/:id', validateObjectId, offerController.postEditOffer)
router.post('/edit-offer/:id', validateObjectId, offerController.postEditOffer)
router.patch('/toggle-offer/:id', validateObjectId, offerController.toggleOfferStatus)
router.get('/delete-offer/:id', validateObjectId, offerController.deleteOffer)
router.delete('/delete-offer/:id', validateObjectId, offerController.deleteOffer)

router.get('/coupons', couponController.getCoupons)
router.get('/add-coupon', couponController.getAddCoupon)
router.post('/add-coupon', couponController.postAddCoupon)
router.get('/edit-coupon/:id', validateObjectId, couponController.getEditCoupon)
router.post('/edit-coupon/:id', validateObjectId, couponController.postEditCoupon)
router.patch('/edit-coupon/:id', validateObjectId, couponController.postEditCoupon)
router.delete('/delete-coupon/:id', validateObjectId, couponController.deleteCoupon)

router.get('/sales-report', reportController.getSalesReportPage)
router.get('/sales-report/data',reportController.getSalesReportData);

router.get('/sales-report/download/pdf', reportController.downloadPDF);
router.get('/sales-report/download/excel', reportController.downloadExcel);



router.get('/logout', productController.logout);

// 404 handler for admin routes - must be last
router.use((req, res) => {
  res.status(404).render('admin/404');
});

module.exports = router;