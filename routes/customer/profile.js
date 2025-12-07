const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/customer/profile.controller');
const uploadProfile = require('../../utils/profileUploader');
const {isCustomerAccessible} = require('../../middlewares/auth');


router.use(isCustomerAccessible);

router.get('/',profileController.getProfile);
router.post('/', profileController.updateProfile);
router.get('/edit', profileController.getEditProfile);
router.post('/edit', profileController.postEditProfile);
router.get('/referAndEarn', profileController.getReferAndEarn);


// UPDATE PROFILE IMAGE
router.post(
  '/update-image',
  uploadProfile.single('profileImage'),
  profileController.updateProfileImage
);

module.exports = router;
