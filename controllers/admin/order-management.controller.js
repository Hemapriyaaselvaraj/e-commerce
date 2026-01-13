const User = require('../../models/userModel'); 
const Order = require('../../models/orderModel');
const PDFDocument = require('pdfkit');
const ProductVariation = require('../../models/productVariationModel');
const WalletTransaction = require('../../models/walletModel');

const ITEMS_PER_PAGE = 10;

const getOrderList = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).render('admin/500', { 
        message: 'Your session has expired. Please log in again to continue managing orders.' 
      });
    }

    const { page = 1, search = '', status = '', sort = 'desc' } = req.query;
    const filter = {};

    if (search) {
      filter.order_number = { $regex: search, $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    const totalOrders = await Order.countDocuments(filter);

    let orders = await Order.find(filter)
      .populate('user_id')
      .sort({ ordered_at: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    orders = orders.map(order => {
      order.total = Math.round(order.total);
      order.subtotal = Math.round(order.subtotal);
      return order;
    });

    res.render('admin/orders', {
      orders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / ITEMS_PER_PAGE),
      totalResults: totalOrders,
      search,
      status,
      sort,
      name: user.firstName,
    });

  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).render('admin/500', { 
      message: 'Unable to load order information at the moment. Please refresh the page or try again later.' 
    });
  }
};


const getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).render('admin/500', { 
        message: 'Order ID is required to view order details.' 
      });
    }

    const order = await Order.findById(id)
      .populate('products.variation')
      .populate('user_id')
      .lean();

    if (!order) {
      return res.status(404).render('admin/500', { 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    res.render('admin/orderDetails', { order });
  } catch (error) {
    console.error('Error loading order details:', error);
    res.status(500).render('admin/500', { 
      message: 'Unable to load order details at the moment. Please try again later.' 
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    
    if (!productId || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product selection and cancellation reason are required to proceed.' 
      });
    }

    const order = await Order.findById(req.params.id).populate('products.variation');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false, 
        message: 'This order has already been cancelled.' 
      });
    }

    if (order.status === 'DELIVERED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel an order that has already been delivered. Please process a return instead.' 
      });
    }

    if (productId === 'full') {
      order.status = 'CANCELLED';
      for (let item of order.products) {
        const variation = await ProductVariation.findById(item.variation._id);
        if (variation) {
          variation.stock_quantity += item.quantity;
          await variation.save();
        }
        item.status = 'CANCELLED';
      }
    } else {
      const item = order.products.find(p => p._id.toString() === productId);
      if (!item) {
        return res.status(404).json({ 
          success: false, 
          message: 'Selected product not found in this order.' 
        });
      }
      
      if (item.status === 'CANCELLED') {
        return res.status(400).json({ 
          success: false, 
          message: 'This product has already been cancelled.' 
        });
      }
      
      const variation = await ProductVariation.findById(item.variation);
      if (variation) {
        variation.stock_quantity += item.quantity;
        await variation.save();
      }
      item.status = 'CANCELLED';
    }

    order.cancellationReason = reason || '';
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Order has been cancelled successfully. Stock quantities have been updated.' 
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to cancel the order at the moment. Please try again later.' 
    });
  }
};

const returnProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Return reason is required to process the return request.' 
      });
    }

    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product selection is required to process the return.' 
      });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    const productItem = order.products.find(p => p.variation.toString() === productId);

    if (!productItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Selected product not found in this order.' 
      });
    }

    if (productItem.status !== 'DELIVERED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only delivered products can be returned.' 
      });
    }

    // Check if return already exists for this product
    const existingReturn = order.returns.find(r => r.product.toString() === productId);
    if (existingReturn) {
      return res.status(400).json({ 
        success: false, 
        message: 'A return request already exists for this product.' 
      });
    }

    order.returns.push({
      product: productId,
      reason: reason.trim(),
      status: 'Requested',
      refundAmount: productItem.price * productItem.quantity
    });
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Return request has been submitted successfully and is pending review.' 
    });
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to process the return request at the moment. Please try again later.' 
    });
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    if (!status || status.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order status is required to update the order.' 
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required to update the status.' 
      });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid order status. Please select a valid status.' 
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: status,
          'products.$[].status': status 
        }
      },
      { new: true } 
    );

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    // Update payment status if order is delivered and payment method is online
    if (status === 'DELIVERED' && ['RAZORPAY', 'WALLET', 'UPI', 'ONLINE'].includes(order.payment_method)) {
      order.payment_status = 'COMPLETED';
      order.delivered_at = new Date();
      await order.save();
    }

    if (req.headers['content-type'] === 'application/json') {
      res.json({ 
        success: true, 
        message: `Order status has been updated to ${status} successfully.` 
      });
    } else {
      res.redirect('/admin/orders/' + orderId);
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update order status at the moment. Please try again later.' 
    });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const { status, productId } = req.body;
    const orderId = req.params.id;

    if (!status || status.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Product status is required to update the product.' 
      });
    }

    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product selection is required to update the status.' 
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required to update the product status.' 
      });
    }

    const validStatuses = ['ORDERED', 'CONFIRMED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product status. Please select a valid status.' 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    const product = order.products.id(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Selected product not found in this order.' 
      });
    }

    if (product.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot change status of a cancelled product. Please create a new order if needed.' 
      });
    }

    if (product.status === 'DELIVERED' && status !== 'RETURNED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Delivered products can only be marked as returned.' 
      });
    }

    product.status = status;

    if (status === 'DELIVERED') {
      product.delivered_at = new Date();
      
      // Update payment status for delivered products based on payment method
      if (order.payment_method === 'COD') {
        // COD orders: Keep payment as PENDING until payment is collected
        // You might want to add a separate field to track if COD payment was collected
      } else if (['RAZORPAY', 'WALLET', 'UPI', 'ONLINE'].includes(order.payment_method)) {
        // Online payments: Should already be COMPLETED, but ensure it's set
        order.payment_status = 'COMPLETED';
      }
    }

    // Update overall order status based on product statuses
    const productStatuses = order.products.map(p => p.status);
    const uniqueStatuses = [...new Set(productStatuses)];
    
    if (productStatuses.every(s => s === 'ORDERED')) {
      order.status = 'PENDING';
    }
    else if (productStatuses.every(s => s === 'DELIVERED')) {
      order.status = 'DELIVERED';
      order.delivered_at = new Date();
      
      // Update payment status when entire order is delivered
      if (['RAZORPAY', 'WALLET', 'UPI', 'ONLINE'].includes(order.payment_method)) {
        order.payment_status = 'COMPLETED';
      }
      // COD orders keep payment_status as PENDING until payment is collected
    }
    else if (productStatuses.every(s => s === 'CANCELLED')) {
      order.status = 'CANCELLED';
    }
    else if (productStatuses.every(s => s === 'RETURNED')) {
      order.status = 'RETURNED';
    }
    else if (productStatuses.some(s => s === 'DELIVERED') && !productStatuses.every(s => s === 'DELIVERED')) {
      order.status = 'PARTIALLY_DELIVERED';
    }
    else if (productStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY')) {
      order.status = 'IN_PROGRESS';
    }
    else if (uniqueStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY') && 
             uniqueStatuses.includes('CANCELLED')) {
      order.status = 'PARTIALLY_SHIPPED';
    }
    else {
      order.status = 'IN_PROGRESS';
    }

    await order.save();

    res.json({ 
      success: true, 
      message: `Product status has been updated to ${status} successfully.` 
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update product status at the moment. Please try again later.' 
    });
  }
};

const verifyReturn = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const orderId = req.params.id;

    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product selection is required to process the return verification.' 
      });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid action (approve or reject) is required to process the return.' 
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required to process the return verification.' 
      });
    }

    const order = await Order.findById(orderId)
      .populate('user_id')
      .populate('products.variation');

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found. It may have been deleted or the ID is incorrect.' 
      });
    }

    const product = order.products.id(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Selected product not found in this order.' 
      });
    }

    if (!product.return_details) {
      return res.status(400).json({ 
        success: false, 
        message: 'No return request found for this product.' 
      });
    }

    if (product.return_details.status !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: 'This return request has already been processed.' 
      });
    }

    if (action === 'approve') {
      product.status = 'RETURNED';
      product.return_details.status = 'APPROVED';

      const refundAmount = product.return_details.refundAmount;
      
      if (!order.user_id) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer information not found for this order.' 
        });
      }

      order.user_id.wallet = (order.user_id.wallet || 0) + refundAmount;
      await order.user_id.save();

      await WalletTransaction.create({
        user_id: order.user_id._id,
        amount: refundAmount,
        type: 'credit',
        description: `Refund for returned product: ${product.name} (Order #${order.order_number})`
      });

      if (product.variation && product.variation._id) {
        await ProductVariation.findByIdAndUpdate(
          product.variation._id,
          { $inc: { stock_quantity: product.quantity } }
        );
      }

      const allProductsReturned = order.products.every(p => p.status === 'RETURNED');
      if (allProductsReturned) {
        order.status = 'RETURNED';
      }
    } else if (action === 'reject') {
      product.status = 'DELIVERED';
      product.return_details.status = 'REJECTED';
    }

    await order.save();

    const actionText = action === 'approve' ? 'approved' : 'rejected';
    const message = action === 'approve' 
      ? `Return request approved successfully. Refund has been processed to customer's wallet.`
      : `Return request rejected successfully. Product status restored to delivered.`;

    res.json({ 
      success: true, 
      message: message
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to process the return verification at the moment. Please try again later.' 
    });
  }
};

module.exports =
{
    getOrderList,
    getOrderDetail,
    cancelOrder,
    returnProduct,
    updateOrderStatus,
    updateProductStatus,
    verifyReturn
}