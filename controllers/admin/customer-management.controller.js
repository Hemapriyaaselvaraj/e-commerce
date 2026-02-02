const userModel = require("../../models/userModel");
const Order = require("../../models/orderModel");
const { formatDate, formatDateTime, formatDateForInput } = require("../../utils/dateFormatter");

const getCustomers = async (req, res) => {
  try {
    const { status, search, sort, page } = req.query;
    let filter = { role: 'user' };
    
    if (status === 'active') filter.isBlocked = false;
    if (status === 'blocked') filter.isBlocked = true;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    let sortOption = { createdAt: -1 };
    if (sort === 'nameAsc') {
      sortOption = { firstName: 1, lastName: 1, createdAt: -1 };
    } else if (sort === 'nameDesc') {
      sortOption = { firstName: -1, lastName: -1, createdAt: -1 };
    }
    
    if (!status || status === 'all') {
      delete filter.isBlocked;
    }

    const pageSize = 5;
    const currentPage = parseInt(page) > 0 ? parseInt(page) : 1;
    const totalResults = await userModel.countDocuments(filter);
    const users = await userModel.find(filter)
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

    const userIds = users.map(u => u._id);
    const orderCounts = await Order.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: '$user_id', count: { $sum: 1 } } }
    ]);
    
    const orderCountMap = {};
    orderCounts.forEach(oc => {
      orderCountMap[oc._id.toString()] = oc.count;
    });

    const customers = users.map((user) => ({
      name: user.firstName + ' ' + user.lastName,
      email: user.email,
      id: user._id.toString().slice(-6).toUpperCase(),
      totalOrders: orderCountMap[user._id.toString()] || 0,
      walletBalance: user.wallet || 0,
      status: user.isBlocked ? 'blocked' : 'active',
      isBlocked: user.isBlocked,
      _id: user._id
    }));
    
    const user = await userModel.findOne({ _id: req.session.userId });
    if (!user) {
      return res.status(401).render('admin/500', { 
        message: 'Your session has expired. Please log in again to continue managing customers.' 
      });
    }
    
    res.render("admin/customers", {
      name: user.firstName,
      customers,
      totalResults,
      currentStatus: status || 'all',
      currentSort: sort || 'nameAsc',
      currentPage,
      totalPages: Math.ceil(totalResults / pageSize),
      formatDate,
      formatDateTime,
      formatDateForInput
    });
  } catch (error) {
    console.error('Error loading customers:', error);
    res.status(500).render('admin/500', { 
      message: 'Unable to load customer information at the moment. Please refresh the page or try again later.' 
    });
  }
};


const blockUnblockCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID is required to perform this action.' 
      });
    }
    
    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found. They may have been deleted or the ID is incorrect.' 
      });
    }
    
    if (user.role !== 'user') {
      return res.status(400).json({ 
        success: false, 
        message: 'This action can only be performed on customer accounts.' 
      });
    }
    
    const previousStatus = user.isBlocked;
    user.isBlocked = !user.isBlocked;
    await user.save();
    
    const action = user.isBlocked ? 'blocked' : 'unblocked';
    res.json({ 
      success: true, 
      isBlocked: user.isBlocked,
      message: `Customer has been ${action} successfully.`
    });
  } catch (error) {
    console.error('Error updating customer status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update customer status at the moment. Please try again later.' 
    });
  }
};

module.exports = {
  getCustomers,
  blockUnblockCustomer,
};
