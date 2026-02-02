const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/customer/profile.controller');
const uploadProfile = require('../../utils/profileUploader');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.use(isCustomerAccessible);

router.get('/',profileController.getProfile);
router.patch('/', profileController.updateProfile);
router.get('/edit', profileController.getEditProfile);
router.patch('/edit', profileController.postEditProfile);
router.post('/change-password', profileController.changePassword);
router.get('/referAndEarn', profileController.getReferAndEarn);


// UPDATE PROFILE IMAGE
router.patch(
  '/update-image',
  uploadProfile.single('profileImage'),
  profileController.updateProfileImage
);

module.exports = router;
