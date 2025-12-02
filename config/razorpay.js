const Razorpay = require('razorpay');

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,      // test key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET // test key secret
});

module.exports = razorpayInstance;
