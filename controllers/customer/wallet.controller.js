const User = require('../../models/userModel');
const WalletTransaction = require('../../models/walletModel');
const crypto = require('crypto');
const Razorpay = require('razorpay');


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const getWalletPage = async(req, res) => {
try{
  if (!req.session.userId) {
  return res.redirect('/user/login');
}
const {page=1} = req.query;
const ITEMS_PER_PAGE = 10;
const userId = req.session.userId;
const user = await User.findById(userId);

const filter = {user_id: userId};
const totalTransactions = await WalletTransaction.countDocuments(filter);

const transactions = await WalletTransaction.find(filter)
.sort({date: -1})
.skip((page - 1) * ITEMS_PER_PAGE)
.limit(ITEMS_PER_PAGE)
.lean();

res.render("user/wallet", {
      user,
      transactions,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTransactions / ITEMS_PER_PAGE),
      totalResults: totalTransactions,
    });

  } catch (error) {
    console.error(error);
    res.status(500).render('user/500', { 
      message: 'We\'re having trouble loading your wallet. Please try refreshing the page or contact support if the problem continues.' 
    });
  }

}

const createOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum amount is ₹10' });
    }

    const options = {
      amount: amount * 100, 
      currency: 'INR',
      receipt: 'wallet_topup_' + Date.now(),
      notes: { purpose: 'wallet_topup' } 
    };

    const order = await razorpay.orders.create(options);

  
    return res.json({ success: true, order });
  } catch (err) {
    console.error('createOrder error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'We couldn\'t process your wallet payment right now. Please try again or use a different payment method.' 
    });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment data' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.warn('Razorpay signature mismatch', { expected, got: razorpay_signature });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const paidAmount = (payment.amount || 0) / 100;

    if (payment.order_id !== razorpay_order_id) {
      console.warn('Payment order id mismatch', { paymentOrder: payment.order_id, razorpay_order_id });
      return res.status(400).json({ success: false, message: 'Order/payment mismatch' });
    }
    
    const userId = req.session.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.wallet = (user.wallet || 0) + paidAmount;
    await user.save();

    await WalletTransaction.create({
      user_id: userId,
      amount: paidAmount,
      type: 'credit',
      description: 'Wallet top-up via Razorpay',
    });

    req.flash('success', `₹${paidAmount.toFixed(2)} added to your wallet`);
    return res.json({ success: true });
  } catch (err) {
    console.error('verifyPayment error:', err);
    req.flash('error', 'We couldn\'t verify your payment. Please contact support with your transaction details.');
    return res.status(500).json({ 
      success: false, 
      message: 'Payment verification failed. Please contact support.' 
    });
  }
};


module.exports = {
    getWalletPage,
    createOrder,
    verifyPayment
}
