const userModel = require("../../models/userModel");
const otpVerificationModel = require("../../models/otpVerificationModel");
const WalletTransaction = require('../../models/walletModel')
require('dotenv').config();

const bcrypt = require("bcrypt");
const saltround = 10;
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password, confirmPassword, referralCode } = req.body;

    // Comprehensive input validation
    const errors = [];

    // Name validation
    if (!firstName || !firstName.trim()) {
      errors.push('First name is required');
    } else if (firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    } else if (firstName.trim().length > 50) {
      errors.push('First name must be less than 50 characters');
    } else if (!/^[a-zA-Z\s'-]+$/.test(firstName.trim())) {
      errors.push('First name can only contain letters, spaces, hyphens, and apostrophes');
    }

    if (!lastName || !lastName.trim()) {
      errors.push('Last name is required');
    } else if (lastName.trim().length > 50) {
      errors.push('Last name must be less than 50 characters');
    } else if (!/^[a-zA-Z\s'-]+$/.test(lastName.trim())) {
      errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes');
    }

    // Email validation
    if (!email || !email.trim()) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Please enter a valid email address');
      } else if (email.length > 100) {
        errors.push('Email must be less than 100 characters');
      }
    }

    // Phone validation
    if (!phoneNumber || !phoneNumber.trim()) {
      errors.push('Phone number is required');
    } else {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        errors.push('Please enter a valid 10-digit Indian mobile number');
      }
    }

    // Password validation
    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }
      if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    // Confirm password validation
    if (!confirmPassword) {
      errors.push('Please confirm your password');
    } else if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    // Referral code validation (if provided)
    if (referralCode && referralCode.trim()) {
      if (referralCode.trim().length < 6 || referralCode.trim().length > 10) {
        errors.push('Referral code must be between 6-10 characters');
      }
      if (!/^[A-Z0-9]+$/.test(referralCode.trim().toUpperCase())) {
        errors.push('Referral code can only contain letters and numbers');
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      // Check if it's a fetch request expecting JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: errors.join('. ')
        });
      }
      return res.render("user/signup", {
        error: errors.join('. '),
        oldInput: req.body,
      });
    }

    // Check if user already exists
    let user = await userModel.findOne({ email: email.trim().toLowerCase() });

    if (user && user.isVerified) {
      // Check if it's a fetch request expecting JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: "This email address is already registered. Please sign in to your existing account or use a different email address."
        });
      }
      return res.render("user/signup", {
        error: "This email address is already registered. Please sign in to your existing account or use a different email address.",
        oldInput: req.body,
      });
    }

    // Check if phone number already exists
    const existingPhone = await userModel.findOne({ phoneNumber: phoneNumber.trim() });
    if (existingPhone && existingPhone.isVerified) {
      // Check if it's a fetch request expecting JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: "This phone number is already registered. Please use a different phone number."
        });
      }
      return res.render("user/signup", {
        error: "This phone number is already registered. Please use a different phone number.",
        oldInput: req.body,
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltround);

    if (user) {
      // Update existing unverified user
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.phoneNumber = phoneNumber.trim();
      user.password = hashedPassword;

      if (!user.referralCode) {
        user.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      }

      if (!user.referredBy && referralCode && referralCode.trim()) {
        const referrer = await userModel.findOne({ referralCode: referralCode.trim().toUpperCase() });

        if (referrer) {
          user.referredBy = referrer._id;
          user.wallet += 50;

          await WalletTransaction.create({
            user_id: user._id,
            type: "credit",
            amount: 50,
            description: "Referral signup bonus"
          });
        } else {
          // Check if it's a fetch request expecting JSON
          if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(400).json({
              success: false,
              message: "Invalid referral code. Please check and try again."
            });
          }
          return res.render("user/signup", {
            error: "Invalid referral code. Please check and try again.",
            oldInput: req.body,
          });
        }
      }

      await user.save();

    } else {
      // Create new user
      user = new userModel({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        password: hashedPassword,
        isVerified: false,
        signupMethod: "email",
        referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
        wallet: 0,
        referredBy: null
      });

      if (referralCode && referralCode.trim()) {
        const referrer = await userModel.findOne({ referralCode: referralCode.trim().toUpperCase() });

        if (referrer) {
          user.referredBy = referrer._id;
          user.wallet = 50;

          await WalletTransaction.create({
            user_id: user._id,
            type: "credit",
            amount: 50,
            description: "Referral signup bonus"
          });
        } else {
          // Check if it's a fetch request expecting JSON
          if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(400).json({
              success: false,
              message: "Invalid referral code. Please check and try again."
            });
          }
          return res.render("user/signup", {
            error: "Invalid referral code. Please check and try again.",
            oldInput: req.body,
          });
        }
      }

      await user.save();
    }

    await sendOtpToVerifyEmail(email.trim().toLowerCase());

    // Get the OTP expiry time to pass to frontend
    const otpVerification = await otpVerificationModel.findOne({ email: email.trim().toLowerCase() });
    const otpExpiry = otpVerification ? otpVerification.expiry.getTime() : null;

    // Check if it's a fetch request expecting JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        message: "Account created successfully! Please check your email for the verification code.",
        email: email.trim().toLowerCase(),
        flow: "sign-up",
        otpExpiry: otpExpiry
      });
    }

    return res.render("user/verifyOtp", { 
      error: null, 
      email: email.trim().toLowerCase(), 
      flow: "sign-up",
      otpExpiry: otpExpiry
    });

  } catch (error) {
    console.error('Signup error:', error);
    // Check if it's a fetch request expecting JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: "An error occurred during signup. Please try again."
      });
    }
    return res.render("user/signup", {
      error: "An error occurred during signup. Please try again.",
      oldInput: req.body,
    });
  }
};

const viewSignup = (req, res) => {
  return res.render("user/signup", {
    error: null,
    oldInput: {},
  });
};

const viewVerifyOtp = (req, res) => {
  const { email, flow } = req.query;
  
  if (!email || !flow) {
    return res.redirect('/user/signup');
  }
  
  return res.render("user/verifyOtp", {
    error: null,
    email: email,
    flow: flow,
    otpExpiry: null
  });
};



const viewLogin = (req, res) => {
    const loginError = req.session.loginError || null;
    const message = req.query.message || null;
    const redirect = req.query.redirect || null;
  
  if (req.session.loginError) {
    delete req.session.loginError;
  }

  // Store redirect URL in session for after login
  if (redirect) {
    req.session.redirectAfterLogin = redirect;
  }

  return res.render("user/login", { 
    error: loginError,
    message: message,
    redirect: redirect
  });
};

const forgotPassword = (req, res) => {
  return res.render("user/forgotPassword", { error : null});
};

const sendOtp = async(req, res) => {
  const { email } = req.body;


  const user = await userModel.findOne({email});

  if(!user) {
    return res.render('user/forgotPassword', { error: "We couldn't find an account with that email address. Please check your email and try again, or create a new account."})
  }

  if (user.isBlocked) {
    return res.render('user/forgotPassword', { error: "Your account has been temporarily suspended. Please contact our support team for assistance." })
  }


  await sendOtpToVerifyEmail(email);

  // Get the OTP expiry time to pass to frontend
  const otpVerification = await otpVerificationModel.findOne({ email });
  const otpExpiry = otpVerification ? otpVerification.expiry.getTime() : null;

  return res.render('user/verifyOtp', { error: null, email, flow: 'forgot-password', otpExpiry: otpExpiry });

}

const verifyOtp = async(req, res) => {
  const { email, otp, flow } = req.body;

  const otpVerification = await otpVerificationModel.findOne({email});

  if (!otpVerification) {
    // OTP not found - this means it might have been deleted or never existed
    // Don't pass expiry time since there's no valid OTP
    return res.status(400).render('user/verifyOtp', { 
      error: "The verification code you entered is incorrect. Please check and try again.", 
      email, 
      flow,
      otpExpiry: null
    });
  }

  // Check if OTP is expired first
  if (otpVerification.expiry < new Date()) {
    await otpVerification.deleteOne();
    return res.status(400).render('user/verifyOtp', { 
      error: "Your verification code has expired. Please request a new code and try again.", 
      email, 
      flow,
      otpExpiry: null
    });
  }

  // Check if OTP is wrong
  if (otpVerification.otp !== otp) {
    // For wrong OTP, pass the current expiry time so timer continues
    const otpExpiry = otpVerification.expiry.getTime();
    
    return res.status(400).render('user/verifyOtp', { 
      error: "The verification code you entered is incorrect. Please check and try again.", 
      email, 
      flow,
      otpExpiry: otpExpiry
    });
  }
  
  await otpVerification.deleteOne();

  if (flow == 'sign-up') {
    const user = await userModel.findOne({ email });

    user.isVerified = true;

    await user.save();

    if (user.referredBy && !user.isReferralRewarded) {
      const referrer = await userModel.findById(user.referredBy);

      if (referrer) {
        referrer.wallet += 100;

        await WalletTransaction.create({
          user_id: referrer._id,
          type: "credit",
          amount: 100,
          description: "Referral reward - new user verified"
        });

        await referrer.save();

        user.isReferralRewarded = true;
        await user.save();
      }
    }
    return res.redirect('/user/login');

  } else if (flow == 'login') {

    const user = await userModel.findOne({ email });

    user.isVerified = true;

    await user.save();

    req.session.user = true;
    req.session.role = user.role;
    req.session.userId = user._id;

    return res.redirect('/');

      
  } else {
    return res.render('user/changePassword', {email, error: null});
  }
}

const changePassword = async(req, res) => {
  const { email, password, confirmPassword } = req.body;

  if(password != confirmPassword){
    
    return res.render('user/changePassword' , {email ,error : "The passwords you entered don't match. Please make sure both password fields are identical." });

  }

  const user = await userModel.findOne({ email });

  if (!user) {

    return res.render("user/changePassword", { error: "We couldn't find your account. Please try the password reset process again.", email });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if(isMatch) {
         return res.render('user/changePassword' , {email ,error : "Your new password must be different from your current password. Please choose a new password." });

  }

    const hashedPassword = await bcrypt.hash(password, saltround);

    user.password = hashedPassword;

    await user.save();

    return res.render('user/login', {error :null})

  }


const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });

  if (!user) {
    const errorMsg = "We couldn't find an account with that email address. Please check your email or create a new account.";
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, message: errorMsg });
    }
    return res.render("user/login", { error: errorMsg });
  }

  if (user.isBlocked) {
    const errorMsg = "Your account has been temporarily suspended. Please contact our support team for assistance.";
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, message: errorMsg });
    }
    return res.render("user/login", { error: errorMsg });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const errorMsg = "The password you entered is incorrect. Please check your password and try again.";
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({ success: false, message: errorMsg });
    }
    return res.render("user/login", { error: errorMsg });
  }

  if (!user.isVerified) {
    await sendOtpToVerifyEmail(email);

    // Get the OTP expiry time to pass to frontend
    const otpVerification = await otpVerificationModel.findOne({ email });
    const otpExpiry = otpVerification ? otpVerification.expiry.getTime() : null;

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: false,
        requiresVerification: true,
        message: "Please verify your account using the verification code we've sent to your email address.",
        redirectUrl: '/user/verifyOtp',
        email: email,
        flow: 'login',
        otpExpiry: otpExpiry
      });
    }

    return res.render('user/verifyOtp', { 
      error: "Please verify your account using the verification code we've sent to your email address.", 
      email, 
      flow: 'login',
      otpExpiry: otpExpiry
    });
  }

  req.session.user = true;
  req.session.role = user.role;
  req.session.userId = user._id;

  // Determine redirect URL
  let redirectUrl = req.session.redirectAfterLogin || '/';
  if (redirectUrl === '/' && user.role !== 'user') {
    redirectUrl = '/admin/dashboard';
  }

  if (req.session.redirectAfterLogin) {
    delete req.session.redirectAfterLogin; // Clean up
  }

  // Return success response for fetch
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      success: true,
      message: `Welcome back, ${user.firstName}!`,
      redirectUrl: redirectUrl,
      userRole: user.role
    });
  }

  // Fallback for non-AJAX requests
  return res.redirect(redirectUrl);
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Unable to log out at the moment. Please close your browser or try again.' 
      });
    }
    res.clearCookie('connect.sid');
    return res.redirect("/user/login");
  });
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Send new OTP
    await sendOtpToVerifyEmail(email);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

async function sendOtpToVerifyEmail(email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 1 * 60 * 1000); // 1 minute expiry

  await transporter.sendMail({
    from: `"Tough Toes" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your otp to verify your account',
    html: `<h3>Your OTP is: <b>${otp}</b></h3><p>This code will expire in 1 minute.</p>`
  });

  let otpVerification = await otpVerificationModel.findOne({ email });
  if (otpVerification) {
    otpVerification.otp = otp;
    otpVerification.expiry = expiry;
    await otpVerification.save();
  } else {
    otpVerification = new otpVerificationModel({
      email,
      otp,
      expiry
    });
    await otpVerification.save();
  }
}



module.exports = {
    signup,
    viewSignup,
    viewVerifyOtp,
    viewLogin,
    forgotPassword,
    sendOtp,
    verifyOtp,
    changePassword,
    login,
    logout,
    resendOtp
}









