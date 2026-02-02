const express = require('express')
const router = express.Router();
const passport = require('../config/passport')
const userController = require('../controllers/user/user.controller');
const { isNotLogin, isCustomerAccessible } = require('../middlewares/auth');


router.get('/signup', isNotLogin, userController.viewSignup)
router.post('/signup',isNotLogin, userController.signup)
router.get('/login',isNotLogin, userController.viewLogin)
router.post('/login',isNotLogin, userController.login)
router.get('/forgotPassword',isNotLogin, userController.forgotPassword)
router.get('/verifyOtp', isNotLogin, userController.viewVerifyOtp)
router.post('/sendOtp', isNotLogin,userController.sendOtp)
router.post('/verifyOtp',isNotLogin, userController.verifyOtp)
router.post('/resendOtp', isNotLogin, userController.resendOtp)
router.post('/changePassword', isNotLogin,userController.changePassword)


router.get('/auth/google', passport.authenticate('google', { scope: ['openid','profile', 'email'],prompt: 'consent' }));
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', function(err, user, info) {
    if (err) {
      req.session.loginError = err.message || 'We\'re having trouble with Google sign-in right now. Please try again or use email login.';
      return res.redirect('/user/login');
    }
    
    if (!user) {
      req.session.loginError = info.message || 'Google sign-in was cancelled or failed. Please try again.';
      return res.redirect('/user/login');
    }

    req.logIn(user, function(err) {
      if (err) {
        req.session.loginError = 'We couldn\'t complete your sign-in. Please try again.';
        return res.redirect('/user/login');
      }
      
      req.session.user = true;
      req.session.role = user.role;
      req.session.userId = user._id;
      return res.redirect('/');
    });
  })(req, res, next);
});
router.post('/logout',  isCustomerAccessible, userController.logout);


module.exports = router;



