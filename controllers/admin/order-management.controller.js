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
  const { productId, reason } = req.body;
  const order = await Order.findById(req.params.id).populate('products.variation');

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
    }
  }

  order.cancellationReason = reason || '';
  await order.save();
  res.redirect('/admin/orders/' + req.params.id);
};

const returnProduct = async (req, res) => {
  const { productId, reason } = req.body;
  if (!reason) return res.redirect('/admin/orders/' + req.params.id);

  const order = await Order.findById(req.params.id);
  const productItem = order.products.find(p => p.variation.toString() === productId);

  if (productItem) {
    order.returns.push({
      product: productId,
      reason,
      status: 'Requested',
      refundAmount: productItem.price * productItem.quantity
    });
    await order.save();
  }

  res.redirect('/admin/orders/' + req.params.id);
};


const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    
    await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: status,
          'products.$[].status': status 
        }
      },
      { new: true } 
    );

    res.redirect('/admin/orders/' + orderId);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
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

      // Add refund amount to user's wallet
      const refundAmount = product.return_details.refundAmount;
      order.user_id.wallet = (order.user_id.wallet || 0) + refundAmount;
      await order.user_id.save();

      // Log wallet transaction
      await WalletTransaction.create({
        user_id: order.user_id._id,
        amount: refundAmount,
        type: 'credit',
        description: `Refund for returned product: ${product.name} (Order #${order.order_number})`
      });

      // Restore product stock
      await ProductVariation.findByIdAndUpdate(
        product.variation._id,
        { $inc: { stock_quantity: product.quantity } }
      );

      // Check if all products are returned
      const allProductsReturned = order.products.every(p => p.status === 'RETURNED');
      if (allProductsReturned) {
        order.status = 'RETURNED';
      }
    } else if (action === 'reject') {
      
      product.status = 'DELIVERED';
      product.return_details.status = 'REJECTED';
    }

    await order.save();

    req.flash('success', `Return request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
    res.redirect('/admin/orders/' + orderId);
  } catch (error) {
    console.error('Error processing return request:', error);
    req.flash('error', error.message || 'Failed to process return request');
    res.redirect('/admin/orders/' + req.params.id);
  }
};

module.exports =
{
    getOrderList,
    getOrderDetail,
    cancelOrder,
    returnProduct,
    updateOrderStatus,
    verifyReturn
}