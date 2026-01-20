const userModel = require("../../models/userModel");
const ProductVariation = require("../../models/productVariationModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Order = require("../../models/orderModel");
const WalletTransaction = require("../../models/walletModel");
const Offer = require("../../models/offerModel");
const Coupon = require('../../models/couponModel');
const {generateOrderNumber} = require('../../utils/orderNumberGenerator')
const razorpayInstance = require('../../config/razorpay')
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { calculateBestOffer } = require("../../utils/offerCalculator");
const { calculateCartTotals } = require("../../utils/cartCalculator");


const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod = 'COD', appliedCoupon } = req.body;

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

    // Use centralized cart calculation
    const cartCalculation = await calculateCartTotals(userId, req.session);
    
    if (!cartCalculation.success) {
      return res.status(400).json({
        success: false,
        message: cartCalculation.message || 'Unable to calculate cart totals'
      });
    }

    if (cartCalculation.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No available products to order'
      });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    const subtotal = cartCalculation.subtotal;
    const shipping_charge = cartCalculation.shipping;
    const couponDiscount = cartCalculation.couponDiscount;
    const appliedCouponCode = cartCalculation.appliedCouponCode;
    const total = cartCalculation.total;

    // Convert cart items to order products format
    const orderProducts = cartCalculation.items.map(item => {
      // Calculate coupon allocation based on original price contribution (fair distribution)
      const originalItemTotal = item.originalPrice * item.quantity;
      const originalSubtotal = cartCalculation.items.reduce((sum, i) => sum + (i.originalPrice * i.quantity), 0);
      const couponAllocation = couponDiscount > 0 ? 
        Math.round((couponDiscount * originalItemTotal) / originalSubtotal * 100) / 100 : 0;

      return {
        variation: item.variation,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        original_price: item.originalPrice,
        discount_percentage: Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100),
        appliedOfferType: 'Calculated Offer',
        color: item.color,
        size: item.size,
        images: item.images,
        status: 'ORDERED',
        coupon_discount_allocated: couponAllocation
      };
    });

    // Prepare stock updates
    const stockUpdates = cartCalculation.items.map(item => ({
      updateOne: {
        filter: { _id: item.variation },
        update: { $inc: { stock_quantity: -item.quantity } }
      }
    }));

    // Validate COD restriction for orders above Rs 1000
    if (paymentMethod === 'COD' && total > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cash on Delivery is not available for orders above Rs 1000. Please choose another payment method.'
      });
    }

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
      tax: 0, 
      shipping_charge,
      coupon_discount: couponDiscount,
      applied_coupon_code: appliedCouponCode,
      shipping_address: shippingAddress,
      payment_method: paymentMethod,
      estimated_delivery_date: estimatedDelivery,
      status: paymentMethod === 'COD' ? 'ORDERED' : 'PENDING',
      payment_status: 'PENDING'
    });

    const savedOrder = await order.save();

    
    if (paymentMethod === 'COD') {
      await Order.findByIdAndUpdate(savedOrder._id, {
        payment_status: "PENDING"
      });
      
      await ProductVariation.bulkWrite(stockUpdates);
      await Cart.deleteMany({ user_id: userId });
      
      if (appliedCouponCode) {
        const coupon = await Coupon.findOne({ code: appliedCouponCode });
        
        if (coupon) {
          const userUsageIndex = coupon.usedBy.findIndex(u => u.userId && u.userId.toString() === userId.toString());
          
          if (userUsageIndex >= 0) {
            coupon.usedBy[userUsageIndex].count += 1;
          } else {
            coupon.usedBy.push({ userId, count: 1 });
          }
          
          await coupon.save();
        }
      }
      
      delete req.session.appliedCoupon;

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

  await Order.findByIdAndUpdate(savedOrder._id, {
    payment_status: "COMPLETED",
    status: "ORDERED"
  });
  
  user.wallet = userWallet - total;
  await user.save();

  await WalletTransaction.create({
    user_id: userId,
    amount: total,
    type: "debit",
    description: `Order payment for Order #${orderNumber}`
  });

  await ProductVariation.bulkWrite(stockUpdates);
  await Cart.deleteMany({ user_id: userId });
  
  if (appliedCouponCode) {
    const coupon = await Coupon.findOne({ code: appliedCouponCode });
    
    if (coupon) {
      const userUsageIndex = coupon.usedBy.findIndex(u => u.userId && u.userId.toString() === userId.toString());
      
      if (userUsageIndex >= 0) {
        coupon.usedBy[userUsageIndex].count += 1;
      } else {
        coupon.usedBy.push({ userId, count: 1 });
      }
      
      await coupon.save();
    }
  }
  
  delete req.session.appliedCoupon;

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
    const finalAmount = Math.round(amount);
    const amountInPaise = finalAmount * 100;
    
    const orderOptions = {
      amount: amountInPaise, 
      currency: 'INR',
      receipt: orderId.toString()
    };
    const order = await razorpayInstance.orders.create(orderOptions);
    
    return order;
  } catch (error) {
    console.error('❌ Razorpay order creation failed:', error);
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
        price: item.price,
        original_price: item.original_price,
        discount_percentage: item.discount_percentage
      })),
      subtotal: order.subtotal,
      shipping: order.shipping_charge,
      tax: order.tax,
      couponDiscount: order.coupon_discount || 0,
      appliedCouponCode: order.applied_coupon_code || null,
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
    if (order.applied_coupon_code) {
      const coupon = await Coupon.findOne({ code: order.applied_coupon_code });
      
      if (coupon) {
        const userUsageIndex = coupon.usedBy.findIndex(u => u.userId && u.userId.toString() === userId.toString());
        
        if (userUsageIndex >= 0) {
          coupon.usedBy[userUsageIndex].count += 1;
        } else {

          coupon.usedBy.push({ userId, count: 1 });
        }
        
        await coupon.save();
      }
    }
    
    if (req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }

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

    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit;

    const { search, status, dateFilter } = req.query;
    let filter = { user_id: userId };

    if (search) {
      filter.order_number = { $regex: search, $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    if (dateFilter) {
      const days = parseInt(dateFilter);
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      filter.createdAt = { $gte: dateThreshold };
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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
      user: user,
      name: user.firstName,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      search: search || '',
      status: status || '',
      dateFilter: dateFilter || ''
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
        original_price: Math.round(item.original_price || item.price),
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        status: item.status || order.status, 
        return_details: item.return_details,
        coupon_discount_allocated: item.coupon_discount_allocated || 0,
        offer_discount: Math.round((item.original_price || item.price) - item.price) * item.quantity
      })),
      subtotal: Math.round(order.subtotal),
      shipping_charge: order.shipping_charge,
      tax: Math.round(order.tax),
      coupon_discount: order.coupon_discount || 0,
      applied_coupon_code: order.applied_coupon_code,
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

const requestReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason, comments } = req.body;
    const userId = req.session.userId;

    if (!orderId || !itemId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const order = await Order.findOne({ _id: orderId, user_id: userId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }


    const productItem = order.products.find(p => p._id.toString() === itemId);
    
    if (!productItem) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in order'
      });
    }

    if (productItem.status !== 'DELIVERED' && order.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered products can be returned'
      });
    }

    if (productItem.status === 'RETURN_REQUESTED' || productItem.status === 'RETURNED') {
      return res.status(400).json({
        success: false,
        message: 'Return already requested for this product'
      });
    }

    const refundAmount = (productItem.price * productItem.quantity) - (productItem.coupon_discount_allocated || 0);

    productItem.status = 'RETURN_REQUESTED';
    productItem.return_details = {
      reason,
      comments: comments || '',
      requested_at: new Date(),
      status: 'PENDING',
      refundAmount
    };

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return request submitted successfully'
    });

  } catch (error) {
    console.error('Error requesting return:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while requesting the return'
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.userId;

    const order = await Order.findOne({ _id: orderId, user_id: userId })
      .populate('user_id')
      .lean();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.order_number || orderId}.pdf`
    );

    doc.pipe(res);

    // ========== COMPACT HEADER ==========
    doc.fontSize(20).font('Helvetica-Bold').text('ToughToes', { align: 'center' });
    doc.fontSize(12).text('Premium Footwear Collection', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    doc.moveDown(0.8);

    // ========== COMPACT ORDER & CUSTOMER INFO ==========
    let currentY = doc.y;
    
    // Left column - Order info
    doc.fontSize(10).font('Helvetica');
    doc.text('Order Number: ' + (order.order_number || '-'), 40, currentY);
    doc.text('Order Date: ' + new Date(order.createdAt).toLocaleDateString(), 40, currentY + 14);
    doc.text('Payment: ' + (order.payment_method || '-'), 40, currentY + 28);
    
    // Right column - Customer info
    const user = order.user_id || {};
    const customerName = (user.firstName || '') + ' ' + (user.lastName || '');
    doc.text('Customer: ' + customerName, 300, currentY);
    doc.text('Email: ' + (user.email || '-'), 300, currentY + 14);
    
    // Shipping address - compact
    const addr = order.shipping_address || {};
    const addressLine1 = (addr.house_number || '') + ', ' + (addr.locality || '');
    const addressLine2 = (addr.city || '') + ', ' + (addr.state || '') + ' - ' + (addr.pincode || '');
    doc.text('Ship to: ' + (addr.name || ''), 300, currentY + 28);
    doc.text(addressLine1, 300, currentY + 42);
    doc.text(addressLine2, 300, currentY + 56);

    doc.y = currentY + 75;

    // ========== COMPACT ORDER ITEMS TABLE ==========
    doc.fontSize(14).font('Helvetica-Bold').text('Order Items', 40, doc.y);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    
    // Compact table headers
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Product', 40, tableTop);
    doc.text('Qty', 280, tableTop);
    doc.text('Original', 320, tableTop);
    doc.text('Discount', 380, tableTop);
    doc.text('Total', 450, tableTop);
    
    // Header line
    doc.moveTo(40, tableTop + 15).lineTo(500, tableTop + 15).stroke();

    let y = tableTop + 25;
    let totalOriginalAmount = 0;
    let totalOfferDiscount = 0;

    // Process each item
    order.products.forEach((item) => {
      const originalPrice = item.original_price || item.price;
      const finalPrice = item.price;
      const quantity = item.quantity || 0;
      const offerDiscount = (originalPrice - finalPrice) * quantity;
      const itemTotal = finalPrice * quantity;

      totalOriginalAmount += originalPrice * quantity;
      totalOfferDiscount += offerDiscount;

      doc.fontSize(10).font('Helvetica');
      
      // Product name (truncated if too long)
      const productName = (item.name || '-').substring(0, 35);
      doc.text(productName, 40, y, { width: 230 });
      
      // Numbers without template literals
      doc.text(quantity + '', 280, y);
      doc.text('Rs.' + Math.round(originalPrice), 320, y);
      
      if (offerDiscount > 0) {
        doc.text('-Rs.' + Math.round(offerDiscount), 380, y);
      } else {
        doc.text('-', 380, y);
      }
      
      doc.text('Rs.' + Math.round(itemTotal), 450, y);

      y += 18;
    });

    // Table bottom line
    doc.moveTo(40, y).lineTo(500, y).stroke();
    y += 25;

    // ========== COMPACT PRICE BREAKDOWN ==========
    doc.fontSize(14).font('Helvetica-Bold').text('Price Summary', 40, y);
    y += 25;

    doc.fontSize(11).font('Helvetica');
    
    // Two column layout for breakdown
    const leftCol = 40;
    const rightCol = 400;
    
    // Original amount
    doc.text('Original Amount:', leftCol, y);
    doc.text('Rs.' + Math.round(totalOriginalAmount), rightCol, y);
    y += 16;

    // Product offers
    if (totalOfferDiscount > 0) {
      doc.text('Product Offers:', leftCol, y);
      doc.text('-Rs.' + Math.round(totalOfferDiscount), rightCol, y);
      y += 16;
    }

    // Subtotal
    const subtotalAfterOffers = totalOriginalAmount - totalOfferDiscount;
    doc.text('Subtotal:', leftCol, y);
    doc.text('Rs.' + Math.round(subtotalAfterOffers), rightCol, y);
    y += 16;

    // Coupon discount
    if (order.coupon_discount && order.coupon_discount > 0) {
      const couponText = order.applied_coupon_code ? 
        'Coupon (' + order.applied_coupon_code + '):' : 'Coupon Discount:';
      doc.text(couponText, leftCol, y);
      doc.text('-Rs.' + Math.round(order.coupon_discount), rightCol, y);
      y += 16;
    }

    // Shipping
    doc.text('Shipping:', leftCol, y);
    if (order.shipping_charge > 0) {
      doc.text('Rs.' + Math.round(order.shipping_charge), rightCol, y);
    } else {
      doc.text('FREE', rightCol, y);
    }
    y += 16;

    // Tax
    if (order.tax && order.tax > 0) {
      doc.text('Tax:', leftCol, y);
      doc.text('Rs.' + Math.round(order.tax), rightCol, y);
      y += 16;
    }

    // Separator
    y += 8;
    doc.moveTo(leftCol, y).lineTo(450, y).stroke();
    y += 15;

    // Final total
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Final Total:', leftCol, y);
    doc.text('Rs.' + Math.round(order.total || 0), rightCol, y);
    y += 25;

    // Savings
    const totalSavings = totalOfferDiscount + (order.coupon_discount || 0);
    if (totalSavings > 0) {
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('You saved Rs.' + Math.round(totalSavings) + ' on this order!', 
               leftCol, y, { width: 400, align: 'center' });
    }

    // Footer
    doc.fontSize(10).font('Helvetica').text(
      'Thank you for shopping with ToughToes!',
      40,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 80 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const orderId = req.params.orderId;
    const userId = req.session.userId;

    const order = await Order.findOne({
      _id: orderId,
      user_id: userId
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled now." });
    }

    let refundAmount = 0;
    let itemsToRefund = [];

    if (productId === "full") {
      order.status = "CANCELLED";

      order.products.forEach(item => {
        if (item.status !== "CANCELLED") {
          item.status = "CANCELLED";

          itemsToRefund.push({
            variation: item.variation,
            quantity: item.quantity
          });

          // ⭐ Calculate refund amount: product price - allocated coupon discount
          refundAmount += (item.price * item.quantity) - (item.coupon_discount_allocated || 0);
        }
      });

    } 
  
    else {
      const item = order.products.find(p => p._id.toString() === productId);

      if (!item) {
        return res.status(404).json({ success: false, message: "Product not found in order" });
      }

      if (item.status === "CANCELLED" || item.status === "RETURNED") {
        return res.status(400).json({ success: false, message: "This product cannot be cancelled" });
      }

      item.status = "CANCELLED";

      itemsToRefund.push({
        variation: item.variation,
        quantity: item.quantity
      });

      // ⭐ Calculate refund amount: product price - allocated coupon discount
      refundAmount = (item.price * item.quantity) - (item.coupon_discount_allocated || 0);

      const allCancelled = order.products.every(p => p.status === "CANCELLED");
      if (allCancelled) order.status = "CANCELLED";
    }

    const stockUpdates = itemsToRefund.map(item => ({
      updateOne: {
        filter: { _id: item.variation },
        update: { $inc: { stock_quantity: item.quantity } }
      }
    }));

    if (stockUpdates.length > 0) {
      await ProductVariation.bulkWrite(stockUpdates);
    }

    if (refundAmount > 0 && ['RAZORPAY', 'RAZOR_PAY', 'ONLINE', 'WALLET'].includes(order.payment_method)) {
      const user = await userModel.findById(userId);

      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      await WalletTransaction.create({
        user_id: userId,
        amount: refundAmount,
        type: "credit",
        description: `Refund for cancelled item(s) in order ${order.order_number}`
      });

      order.refund_amount = (order.refund_amount || 0) + refundAmount;
      order.refund_status = "PARTIAL_REFUND";
      if (order.status === "CANCELLED") {
        order.refund_status = "FULL_REFUND";
      }
    }

    // Recalculate order totals after cancellation
    const activeitems = order.products.filter(p => p.status !== "CANCELLED");
    
    if (activeitems.length > 0) {
      // Recalculate subtotal from active (non-cancelled) items
      const newSubtotal = activeitems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // ⭐ Recalculate coupon discount from active items (use allocated amounts)
      const newCouponDiscount = activeitems.reduce((sum, item) => sum + (item.coupon_discount_allocated || 0), 0);
      
      // Recalculate shipping (free shipping if subtotal > 1000, otherwise 50)
      const newShipping = newSubtotal > 1000 ? 0 : 50;
      
      // Recalculate total (subtotal + shipping + tax - coupon discount)
      const newTotal = newSubtotal + newShipping + (order.tax || 0) - newCouponDiscount;
      
      // Update order totals
      order.subtotal = newSubtotal;
      order.shipping_charge = newShipping;
      order.coupon_discount = newCouponDiscount; // Update to reflect only active items
      order.total = newTotal;
    } else {
      // If all items are cancelled, set totals to 0
      order.subtotal = 0;
      order.shipping_charge = 0;
      order.coupon_discount = 0;
      order.total = 0;
    }

    order.cancellationReason = reason || "";
    await order.save();

    return res.json({
      success: true,
      message: productId === "full"
        ? "Order cancelled successfully"
        : "Product cancelled successfully",
      refund: refundAmount
    });

  } catch (err) {
    console.error("Cancel error:", err);
    return res.status(500).json({ success: false, message: "Error cancelling order" });
  }
};



module.exports = {
    placeOrder,
    getOrderSuccess,
    getOrderFailure,
    verifyPayment,
    getUserOrders,
    getOrderDetails,
    requestReturn,
    downloadInvoice,
    cancelOrder
}