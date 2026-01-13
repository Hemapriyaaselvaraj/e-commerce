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
  const { firstName, lastName, email, phoneNumber, password, referralCode } = req.body;

  let user = await userModel.findOne({ email });

  if (user && user.isVerified) {
    return res.render("user/signup", {
      error: "This email address is already registered. Please sign in to your existing account or use a different email address.",
      oldInput: req.body,
    });
  }

  const hashedPassword = await bcrypt.hash(password, saltround);

  if (user) {

    user.firstName = firstName;
    user.lastName = lastName;
    user.phoneNumber = phoneNumber;
    user.password = hashedPassword;

    
    if (!user.referralCode) {
      user.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    if (!user.referredBy && referralCode) {
      const referrer = await userModel.findOne({ referralCode });

      if (referrer) {
        user.referredBy = referrer._id;

        user.wallet += 50;

        await WalletTransaction.create({
          user_id: user._id,
          type: "credit",
          amount: 50,
          description: "Referral signup bonus"
        });
      }
    }

    await user.save();

  } else {

    user = new userModel({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      isVerified: false,
      signupMethod: "email",
      referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      wallet: 0,
      referredBy: null
    });

    if (referralCode) {
      const referrer = await userModel.findOne({ referralCode });

      if (referrer) {
        user.referredBy = referrer._id;
        
        user.wallet = 50;

        await WalletTransaction.create({
          user_id: user._id,
          type: "credit",
          amount: 50,
          description: "Referral signup bonus"
        });
      }
    }

    await user.save();
  }

  await sendOtpToVerifyEmail(email);

  return res.render("user/verifyOtp", { error: null, email, flow: "sign-up" });
};

const viewSignup = (req, res) => {
  return res.render("user/signup", {
    error: null,
    oldInput: {},
  });
};



const viewLogin = (req, res) => {
    const loginError = req.session.loginError || null;
  
  if (req.session.loginError) {
    delete req.session.loginError;
  }

  return res.render("user/login", { error: loginError });
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

  return res.render('user/verifyOtp', { error: null, email, flow: 'forgot-password'});

}

const verifyOtp = async(req, res) => {
  const { email, otp, flow } = req.body;

  const otpVerification = await otpVerificationModel.findOne({email});

  if (!otpVerification) {
  return res.render('user/verifyOtp', { error: "The verification code you entered is incorrect. Please check and try again.", email, flow });
}

if (otpVerification.otp !== otp || otpVerification.expiry < new Date()) {
    if (otpVerification.expiry < new Date()) {
    await otpVerification.deleteOne();
  }
  return res.render('user/verifyOtp', { error: "Your verification code has expired. Please request a new code and try again.", email, flow });
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

  if (!user) return res.render("user/login", { error: "We couldn't find an account with that email address. Please check your email or create a new account." });

  if (user.isBlocked) {
    return res.render("user/login", { error: "Your account has been temporarily suspended. Please contact our support team for assistance." });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) return res.render("user/login", { error: "The password you entered is incorrect. Please check your password and try again." });


  if (!user.isVerified) {

    await sendOtpToVerifyEmail(email);

    return res.render('user/verifyOtp', { error: "Please verify your account using the verification code we've sent to your email address.", email, flow: 'login'});
  }

  req.session.user = true;
  req.session.role = user.role;
  req.session.userId = user._id;

  if (user.role == "user") {
    return res.redirect("/");
  } else {
    return res.redirect("/admin/dashboard");
  }
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

async function sendOtpToVerifyEmail(email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await transporter.sendMail({
    from: `"Tough Toes" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your otp to verify your account',
    html: `<h3>Your OTP is: <b>${otp}</b></h3>`
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
    viewLogin,
    forgotPassword,
    sendOtp,
    verifyOtp,
    changePassword,
    login,
    logout
}









