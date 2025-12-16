const User = require('../../models/userModel'); 
const Order = require('../../models/orderModel');
const PDFDocument = require('pdfkit');
const ProductVariation = require('../../models/productVariationModel');
const WalletTransaction = require('../../models/walletModel');

const ITEMS_PER_PAGE = 10;

const getOrderList = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).send('Unauthorized');

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

  } catch (err) {
    console.error('Error loading orders:', err);
    res.status(500).send('Server error: ' + err.message);
  }
};


const getOrderDetail = async (req, res) => {

  const order = await Order.findById(req.params.id)
    .populate('products.variation')
    .populate('user_id')
    .lean();

  res.render('admin/orderDetails', { order });
};

const cancelOrder = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    
    if (!productId || !reason) {
      return res.status(400).json({ success: false, message: 'Product ID and reason are required' });
    }

    const order = await Order.findById(req.params.id).populate('products.variation');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (productId === 'full') {
      order.status = 'CANCELLED';
      for (let item of order.products) {
        const variation = await ProductVariation.findById(item.variation._id);
        variation.stock_quantity += item.quantity;
        await variation.save();
        item.status = 'CANCELLED';
      }
    } else {
      const item = order.products.find(p => p._id.toString() === productId);
      if (item) {
        const variation = await ProductVariation.findById(item.variation);
        variation.stock_quantity += item.quantity;
        await variation.save();
        item.status = 'CANCELLED';
      } else {
        return res.status(404).json({ success: false, message: 'Product not found in order' });
      }
    }

    order.cancellationReason = reason || '';
    await order.save();
    
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
};

const returnProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const productItem = order.products.find(p => p.variation.toString() === productId);

    if (productItem) {
      order.returns.push({
        product: productId,
        reason,
        status: 'Requested',
        refundAmount: productItem.price * productItem.quantity
      });
      await order.save();
      
      res.json({ success: true, message: 'Return request processed successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Product not found in order' });
    }
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ success: false, message: 'Failed to process return' });
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
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
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if request expects JSON response (AJAX) or redirect (form submission)
    if (req.headers['content-type'] === 'application/json') {
      res.json({ success: true, message: 'Order status updated successfully' });
    } else {
      res.redirect('/admin/orders/' + orderId);
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const { status, productId } = req.body;
    const orderId = req.params.id;

    if (!status || !productId) {
      return res.status(400).json({ success: false, message: 'Status and productId are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Find and update the specific product
    const product = order.products.id(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    // Check if product is cancelled by user (should not be changeable)
    if (product.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot change status of cancelled product' });
    }

    // Update product status (set default if empty)
    product.status = status || 'ORDERED';

    // If product is delivered, set delivered_at timestamp
    if (status === 'DELIVERED') {
      product.delivered_at = new Date();
    }

    // Update overall order status based on product statuses using the rules
    const productStatuses = order.products.map(p => p.status);
    const uniqueStatuses = [...new Set(productStatuses)];
    
    // Rule 1: If all items are ORDERED (Pending)
    if (productStatuses.every(s => s === 'ORDERED')) {
      order.status = 'PENDING';
    }
    // Rule 2: If all items are DELIVERED
    else if (productStatuses.every(s => s === 'DELIVERED')) {
      order.status = 'DELIVERED';
      order.delivered_at = new Date();
    }
    // Rule 3: If all items are CANCELLED
    else if (productStatuses.every(s => s === 'CANCELLED')) {
      order.status = 'CANCELLED';
    }
    // Rule 4: If all items are RETURNED
    else if (productStatuses.every(s => s === 'RETURNED')) {
      order.status = 'RETURNED';
    }
    // Rule 5: If some items are DELIVERED but not all (partial delivery)
    else if (productStatuses.some(s => s === 'DELIVERED') && !productStatuses.every(s => s === 'DELIVERED')) {
      order.status = 'PARTIALLY_DELIVERED';
    }
    // Rule 6: If any item is SHIPPED or OUT_FOR_DELIVERY
    else if (productStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY')) {
      order.status = 'IN_PROGRESS';
    }
    // Rule 7: If mix of SHIPPED + CANCELLED
    else if (uniqueStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY') && 
             uniqueStatuses.includes('CANCELLED')) {
      order.status = 'PARTIALLY_SHIPPED';
    }
    // Default: Mixed statuses - In Progress
    else {
      order.status = 'IN_PROGRESS';
    }

    await order.save();

    // ✅ Return JSON response instead of redirect for AJAX calls
    res.json({ success: true, message: 'Product status updated successfully' });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ success: false, message: 'Failed to update product status' });
  }
};

const verifyReturn = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate('user_id')
      .populate('products.variation');

    if (!order) {
      throw new Error('Order not found');
    }

    
    const product = order.products.id(productId);
    if (!product) {
      throw new Error('Product not found in order');
    }

    if (action === 'approve') {
      
      product.status = 'RETURNED';
      product.return_details.status = 'APPROVED';

      const refundAmount = product.return_details.refundAmount;
      order.user_id.wallet = (order.user_id.wallet || 0) + refundAmount;
      await order.user_id.save();

      await WalletTransaction.create({
        user_id: order.user_id._id,
        amount: refundAmount,
        type: 'credit',
        description: `Refund for returned product: ${product.name} (Order #${order.order_number})`
      });

      await ProductVariation.findByIdAndUpdate(
        product.variation._id,
        { $inc: { stock_quantity: product.quantity } }
      );

      const allProductsReturned = order.products.every(p => p.status === 'RETURNED');
      if (allProductsReturned) {
        order.status = 'RETURNED';
      }
    } else if (action === 'reject') {
      
      product.status = 'DELIVERED';
      product.return_details.status = 'REJECTED';
    }

    await order.save();

    res.json({ 
      success: true, 
      message: `Return request ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process return request' 
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