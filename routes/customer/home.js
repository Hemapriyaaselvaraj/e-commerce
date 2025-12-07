const express = require('express');
const router = express.Router();
const homeController = require('../../controllers/customer/home.controller')
const { isCustomerAccessible } = require('../../middlewares/auth');

router.use(isCustomerAccessible);

router.get('/', homeController.home )

module.exports = router;