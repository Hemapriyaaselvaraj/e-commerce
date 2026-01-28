const express = require('express');
const router = express.Router();
const homeController = require('../../controllers/customer/home.controller')

// Remove authentication middleware - home page should be accessible to everyone
router.get('/', homeController.home )

module.exports = router;