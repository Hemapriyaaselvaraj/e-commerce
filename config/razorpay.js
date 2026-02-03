const Razorpay = require('razorpay');

let razorpayInstance;

try {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,      // test key ID
    key_secret: process.env.RAZORPAY_KEY_SECRET // test key secret
  });
} catch (error) {
  console.error('❌ Failed to create Razorpay instance:', error);
  razorpayInstance = null;
}

module.exports = razorpayInstance;
