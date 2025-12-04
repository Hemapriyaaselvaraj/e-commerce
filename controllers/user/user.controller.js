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
      error: "Email already registered, please login",
      oldInput: req.body,
    });
  }

  const hashedPassword = await bcrypt.hash(password, saltround);

  // A) UNVERIFIED USER EXISTS
  if (user) {

    user.firstName = firstName;
    user.lastName = lastName;
    user.phoneNumber = phoneNumber;
    user.password = hashedPassword;

    // Generate referral code if missing
    if (!user.referralCode) {
      user.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Referral handling only once
    if (!user.referredBy && referralCode) {
      const referrer = await userModel.findOne({ referralCode });

      if (referrer) {
        user.referredBy = referrer._id;

        // Give ₹50 to new user immediately
        user.wallet += 50;

        await WalletTransaction.create({
          user_id: user._id,
          type: "CREDIT",
          amount: 50,
          description: "Referral signup bonus"
        });
      }
    }

    await user.save();

  } else {

    // B) CREATE NEW USER
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

    // Referral code entered
    if (referralCode) {
      const referrer = await userModel.findOne({ referralCode });

      if (referrer) {
        user.referredBy = referrer._id;

        // Give ₹50 to new user
        user.wallet = 50;

        await WalletTransaction.create({
          user_id: user._id,
          type: "CREDIT",
          amount: 50,
          description: "Referral signup bonus"
        });
      }
    }

    await user.save();
  }

  // Send OTP
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
    return res.render('user/forgotPassword', { error: "Invalid email"})
  }

  if (user.isBlocked) {
    return res.render('user/forgotPassword', { error: "Your account is blocked. Please contact support." })
  }


  await sendOtpToVerifyEmail(email);

  return res.render('user/verifyOtp', { error: null, email, flow: 'forgot-password'});

}

const verifyOtp = async(req, res) => {
  const { email, otp, flow } = req.body;

  const otpVerification = await otpVerificationModel.findOne({email});

  if (!otpVerification) {
  return res.render('user/verifyOtp', { error: "Invalid otp", email, flow });
}

if (otpVerification.otp !== otp || otpVerification.expiry < new Date()) {
    if (otpVerification.expiry < new Date()) {
    await otpVerification.deleteOne();
  }
  return res.render('user/verifyOtp', { error: "Invalid otp", email, flow });
}
 await otpVerification.deleteOne();

 if (flow == 'sign-up') {
      const user = await userModel.findOne({ email });

      user.isVerified = true;

      await user.save();

      if (user.referredBy && !user.isReferralRewarded) {
    const referrer = await userModel.findById(user.referredBy);

    if (referrer) {
      // Give ₹100 to the person who referred
      referrer.wallet += 100;

      await WalletTransaction.create({
        user_id: referrer._id,
        type: "credit",
        amount: 100,
        description: "Referral reward - new user verified"
      });

      await referrer.save();

      // Mark reward as given so it never happens twice
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
    
    return res.render('user/changePassword' , {email ,error : "Passwords does not match" });

  }

  const user = await userModel.findOne({ email });

  if (!user) {

    return res.render("user/changePassword", { error: "User does not exist", email });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if(isMatch) {
         return res.render('user/changePassword' , {email ,error : "New password should not be same as previous one" });

  }

    const hashedPassword = await bcrypt.hash(password, saltround);

    user.password = hashedPassword;

    await user.save();

    return res.render('user/login', {error :null})

  }


  const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });

  if (!user) return res.render("user/login", { error: "User does not exist" });

  if (user.isBlocked) {
    return res.render("user/login", { error: "Your account is blocked. Please contact support." });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) return res.render("user/login", { error: "Incorrrect password" });


  if (!user.isVerified) {

    await sendOtpToVerifyEmail(email);

    return res.render('user/verifyOtp', { error: "Please verify your account with OTP sent to your email", email, flow: 'login'});
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
      return res.status(500).json({ success: false, message: 'Logout failed' });
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









