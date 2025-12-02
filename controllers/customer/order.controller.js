const userModel = require("../../models/userModel");
const ProductVariation = require("../../models/productVariationModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Order = require("../../models/orderModel");
const WalletTransaction = require("../../models/walletModel");
const {generateOrderNumber} = require('../../utils/orderNumberGenerator')
const razorpayInstance = require('../../config/razorpay')
const crypto = require('crypto');


const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod = 'COD' } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: addressId or paymentMethod' 
      });
    }

    const userId = req.session.userId;
  
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

     const cartItems = await Cart.find({ user_id: userId })
      .populate({
        path: 'product_variation_id',
        populate: { 
          path: 'product_id',
          select: 'name price discount_percentage is_active'
        }
      });

    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    const address = await Address.findById(addressId);
    if (!address) {
      throw new Error('Shipping address not found');
    }

    let subtotal = 0;
    const orderProducts = [];
    const stockUpdates = [];

    for (const item of cartItems) {
      const variation = item.product_variation_id;
      const product = variation.product_id;

      if (!product.is_active || variation.stock_quantity < item.quantity) {
        continue;
      }

       const original_price = product.price;
      const discount_percentage = product.discount_percentage || 0;
      const price = original_price * (1 - discount_percentage / 100);
      
      subtotal += price * item.quantity;

      orderProducts.push({
        variation: variation._id,
        name: product.name,
        quantity: item.quantity,
        price,
        original_price,
        discount_percentage,
        color: variation.product_color,
        size: variation.product_size,
        images: variation.images && variation.images.length > 0 ? variation.images : [],
        status: 'ORDERED'
      });

      stockUpdates.push({
        updateOne: {
          filter: { _id: variation._id },
          update: { $inc: { stock_quantity: -item.quantity } }
        }
      });
    }

    if (orderProducts.length === 0) {
      throw new Error('No available products to order');
    }

    const shipping_charge = subtotal > 1000 ? 0 : 50;
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + shipping_charge + tax;

    const orderNumber = await generateOrderNumber();
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

    const shippingAddress = {
      name: address.name,
      label: address.label,
      type: address.type || 'HOME',
      house_number: address.house_number,
      street: address.street || '',
      locality: address.locality,
      city: address.city,
      state: address.state,
      pincode: address.pincode.toString(),
      phone_number: address.phone_number
    };

    const order = new Order({
      order_number: orderNumber,
      user_id: userId,
      products: orderProducts,
      total,
      subtotal,
      tax,
      shipping_charge,
      shipping_address: shippingAddress,
      payment_method: paymentMethod,
      estimated_delivery_date: estimatedDelivery,
      status: paymentMethod === 'COD' ? 'ORDERED' : 'PENDING',
      payment_status: 'PENDING'
    });

    const savedOrder = await order.save();

    
    if (paymentMethod === 'COD') {
      await ProductVariation.bulkWrite(stockUpdates);
      await Cart.deleteMany({ user_id: userId });

      return res.status(200).json({
        success: true,
        orderId: savedOrder._id,
        orderNumber: savedOrder.order_number,
        message: 'Order placed successfully (COD)'
      });
    }

if (paymentMethod === 'WALLET') {
  const user = await userModel.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const userWallet = user.wallet || 0;
  if (userWallet < total) return res.status(400).json({ success: false, message: "Not enough wallet balance" });

  // Update order before saving
  await Order.findByIdAndUpdate(savedOrder._id, {
    payment_status: "PAID",
    status: "ORDERED"
  });
  
  // Deduct wallet balance
  user.wallet = userWallet - total;
  await user.save();

  // Log wallet transaction
  await WalletTransaction.create({
    user_id: userId,
    amount: total,
    type: "debit",
    description: `Order payment for Order #${orderNumber}`
  });

  await ProductVariation.bulkWrite(stockUpdates);
  await Cart.deleteMany({ user_id: userId });

  return res.status(200).json({
    success: true,
    orderId: savedOrder._id,
    orderNumber: savedOrder.order_number,
    message: "Order placed successfully using Wallet"
  });
}

    if (paymentMethod === 'RAZORPAY' || paymentMethod === 'RAZOR_PAY' || paymentMethod === 'ONLINE') {
      try {
        if (!razorpayInstance) {
          throw new Error('Razorpay is not initialized. Check your API keys.');
        }

        const razorpayOrder = await createRazorpayOrder(total, savedOrder._id);
        
        await Order.findByIdAndUpdate(savedOrder._id, {
          'razorpay.order_id': razorpayOrder.id,
          'razorpay.amount': razorpayOrder.amount,
          'razorpay.currency': razorpayOrder.currency
        });

        return res.status(200).json({
          success: true,
          orderId: savedOrder._id,
          orderNumber: savedOrder.order_number,
          key: process.env.RAZORPAY_KEY_ID,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          razorpayOrderId: razorpayOrder.id,
          message: 'Proceed to payment'
        });
      } catch (error) {
        const errorMessage = error.message || 'Failed to initialize payment';
        
        
        try {
          await Order.findByIdAndDelete(savedOrder._id);
        } catch (deleteError) {
          
        }
        
        return res.status(500).json({
          success: false,
          message: errorMessage
        });
      }
    }

  } catch (error) {
    console.error('❌ Order placement error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createRazorpayOrder = async (amount, orderId) => {
  if (!razorpayInstance) {
    throw new Error('Razorpay is not properly initialized');
  }

  try {
    const orderOptions = {
      amount: Math.round(amount * 100), 
      currency: 'INR',
      receipt: orderId.toString()
    };
    const order = await razorpayInstance.orders.create(orderOptions);
    return order;
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw error;
  }
};


const getOrderSuccess = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.userId;

    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    }).populate({
      path: 'products.variation',
      populate: {
        path: 'product_id',
        select: 'name images'
      }
    });

    if (!order) {
      return res.redirect('/');
    }

    const user = await userModel.findById(userId);
    const displayName = user ? user.firstName + " " + user.lastName : "";

    const orderData = {
      _id: order._id,
      orderNumber: order.order_number,
      items: order.products.map(item => ({
        product: {
          name: item.name,
          images: item.images
        },
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price
      })),
      subtotal: order.subtotal,
      shipping: order.shipping_charge,
      tax: order.tax,
      total: order.total,
      shippingAddress: order.shipping_address,
      paymentDetails: {
        method: order.payment_method,
        status: order.payment_status,
      },
      estimatedDelivery: order.estimated_delivery_date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    };


    res.render('user/orderSuccess', { 
      order: orderData,
      name: displayName
    });
  } catch (error) {
    console.error('Error in getOrderSuccess:', error);
    res.redirect('/');
  }
};

const getOrderFailure = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('🔹 getOrderFailure called with orderId:', orderId);
    const userId = req.session.userId;

    
    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    }).populate({
      path: 'products.variation',
      populate: {
        path: 'product_id',
        select: 'name images'
      }
    });

    
    if (!order) {
      return res.render('user/orderFailure', {
        order: {
          _id: null,
          orderNumber: 'N/A',
          total: 0,
          paymentDetails: {
            method: 'N/A',
            status: 'FAILED'
          },
          failureReason: 'Order not found or invalid.'
        },
        name: ''
      });
    }


    const user = await userModel.findById(userId);
    const displayName = user ? `${user.firstName} ${user.lastName}` : "";

    
    let failureReason = "Payment failed. Please try again.";
    if (order.payment_status === "FAILED") {
      failureReason = "Payment verification failed.";
    } else if (order.payment_status === "PENDING") {
      failureReason = "Payment was not completed or was cancelled.";
    }

    
    const orderData = {
      _id: order._id,
      orderNumber: order.order_number,
      total: order.total,
      paymentDetails: {
        method: order.payment_method,
        status: order.payment_status,
      },
      failureReason
    };

    res.render('user/orderFailure', {
      order: orderData,
      name: displayName
    });

  } catch (error) {
    console.error('Error in getOrderFailure:', error);
    
    res.render('user/orderFailure', {
      order: {
        _id: null,
        orderNumber: 'N/A',
        total: 0,
        paymentDetails: {
          method: 'N/A',
          status: 'FAILED'
        },
        failureReason: 'Something went wrong. Please try again.'
      },
      name: ''
    });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details'
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      await Order.findByIdAndUpdate(orderId, {
        payment_status: 'FAILED',
        status: 'CANCELLED'
      });
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed'
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        payment_status: 'COMPLETED',
        status: 'ORDERED',
        'razorpay.payment_id': razorpay_payment_id
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userId = order.user_id;
    await Cart.deleteMany({ user_id: userId });

    const stockUpdates = order.products.map(product => ({
      updateOne: {
        filter: { _id: product.variation },
        update: { $inc: { stock_quantity: -product.quantity } }
      }
    }));

    if (stockUpdates.length > 0) {
      await ProductVariation.bulkWrite(stockUpdates);
    }

    console.log('✅ Payment verified successfully');
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      orderId: order._id
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment: ' + error.message
    });
  }
};

const getUserOrders = async(req,res) => {
  try{
  const userId = req.session.userId;
  const user = await userModel.findById(userId);

  const orders = await Order.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'products.variation',
                populate: {
                    path: 'product_id',
                    select: 'name price'
                }
            })
            .lean();

 const formattedOrders = orders.map(order => ({
            _id: order._id,
            orderNumber: order.order_number,
            status: order.status,
            createdAt: order.createdAt,
            totalAmount: Math.round(order.total),
            items: order.products.map(item => ({
                name: item.name,
                image: item.images[0],
                price: Math.round(item.price),
                quantity: item.quantity,
                size: item.size,
                color: item.color
            }))
        }));   
        
      res.render('user/orders', {
            orders: formattedOrders,
            user: user
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }   
};

const getOrderDetails = async(req,res) => {
  try{
   const userId = req.session.userId;
   const orderId = req.params.orderId;

   const user = await userModel.findById(userId);
    
   const order = await Order.findOne({
    _id: orderId,
    user_id: userId
   }).lean();

   if(!order){
    return res.status(404).json({error: 'Order not found' });
   }
 
   const formattedOrder = {
    _id: order._id,
    orderNumber: order.order_number,
      status: order.status,
      createdAt: order.createdAt,
      estimatedDelivery: order.estimated_delivery_date,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      shippingAddress: order.shipping_address,
      items: order.products.map(item => ({
        _id: item._id,
        name: item.name,
        image: item.images[0],
        price: Math.round(item.price),
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        status: item.status || order.status, 
        return_details: item.return_details
      })),
      subtotal: Math.round(order.subtotal),
      shipping_charge: order.shipping_charge,
      tax: Math.round(order.tax),
      total: Math.round(order.total)
   }

   res.render('user/orderDetails', {
      order: formattedOrder,
      user: user
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
}


module.exports = {
    placeOrder,
    getOrderSuccess,
    getOrderFailure,
    verifyPayment,
    getUserOrders,
    getOrderDetails
}