const userModel = require("../../models/userModel");
const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");

const getDashboard = async (req, res) => {
  try {
    const user = await userModel.findOne({ _id: req.session.userId });

    if (!user) {
      return res.redirect('/user/login'); 
    }
   
    return res.render("admin/dashboard", { name: user.firstName });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).render('admin/500', { 
      message: 'We\'re having trouble loading the admin dashboard. Please try refreshing the page or contact technical support if the problem continues.',
      name: 'Admin'
    });
  }
};

const getDashboardDetails = async (req, res) => {
  try {
    const { timeFilter = 'monthly' } = req.query;
    
    // Validate timeFilter parameter
    const validFilters = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validFilters.includes(timeFilter)) {
      return res.status(400).json({ 
        error: 'Invalid time filter selection',
        message: 'Please select a valid time period: daily, weekly, monthly, or yearly.'
      });
    }
    
    // Calculate date range based on filter
    const now = new Date();
    let startDate, endDate, groupBy, dateFormat;
    
    switch (timeFilter) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        dateFormat = 'daily';
        break;
        
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84); // 12 weeks
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = { 
          $dateToString: { 
            format: "Week %U, %Y", 
            date: "$createdAt" 
          } 
        };
        dateFormat = 'weekly';
        break;
        
      case 'yearly':
        startDate = new Date(now.getFullYear() - 5, 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        groupBy = { $dateToString: { format: "%Y", date: "$createdAt" } };
        dateFormat = 'yearly';
        break;
        
      default: // monthly
        startDate = new Date(now.getFullYear(), 0, 1); // Start from January of current year
        endDate = new Date(now.getFullYear() + 1, 0, 1); // End at January of next year
        groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        dateFormat = 'monthly';
    }

    // Get basic stats
    const [totalSalesResult, totalCustomers, totalOrders] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED'] },
            payment_status: 'COMPLETED', // Only count completed payments as revenue
            createdAt: { $gte: startDate, $lt: endDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total" }
          }
        }
      ]),
      userModel.countDocuments({ role: 'user' }),
      Order.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      })
    ]);

    const totalSales = totalSalesResult[0]?.total || 0;

    // Get time series data for chart (only completed payments - actual revenue)
    const timeSeriesData = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED'] },
          payment_status: 'COMPLETED', // Only include orders with completed payments
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          sales: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Format time series data with complete time periods
    let timeSeriesLabels = [];
    let timeSeriesValues = [];
    
    if (dateFormat === 'monthly') {
      // Generate all 12 months for the current year
      const currentYear = now.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Create a map of existing data for quick lookup
      const dataMap = {};
      timeSeriesData.forEach(item => {
        dataMap[item._id] = item.sales;
      });
      
      // Generate all 12 months
      for (let month = 0; month < 12; month++) {
        const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        timeSeriesLabels.push(`${monthNames[month]} ${currentYear}`);
        timeSeriesValues.push(dataMap[monthKey] || 0);
      }
    } else if (dateFormat === 'daily') {
      // Generate all days in the range
      const dayMap = {};
      timeSeriesData.forEach(item => {
        dayMap[item._id] = item.sales;
      });
      
      const currentDate = new Date(startDate);
      while (currentDate < endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        timeSeriesLabels.push(currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        timeSeriesValues.push(dayMap[dateKey] || 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (dateFormat === 'yearly') {
      // Generate all years in the range
      const yearMap = {};
      timeSeriesData.forEach(item => {
        yearMap[item._id] = item.sales;
      });
      
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      for (let year = startYear; year < endYear; year++) {
        timeSeriesLabels.push(year.toString());
        timeSeriesValues.push(yearMap[year.toString()] || 0);
      }
    } else {
      // For weekly, generate last 12 weeks
      if (dateFormat === 'weekly') {
        const weekMap = {};
        timeSeriesData.forEach(item => {
          weekMap[item._id] = item.sales;
        });
        
        // Generate last 12 weeks
        const currentDate = new Date();
        for (let i = 11; i >= 0; i--) {
          const weekStart = new Date(currentDate);
          weekStart.setDate(currentDate.getDate() - (i * 7));
          
          const weekNumber = getWeekNumber(weekStart);
          const year = weekStart.getFullYear();
          const weekKey = `Week ${weekNumber}, ${year}`;
          
          timeSeriesLabels.push(`Week ${weekNumber}`);
          timeSeriesValues.push(weekMap[weekKey] || 0);
        }
      } else {
        // Fallback for other formats
        timeSeriesLabels = timeSeriesData.map(item => item._id);
        timeSeriesValues = timeSeriesData.map(item => item.sales);
      }
    }
    
    // Helper function to get week number
    function getWeekNumber(date) {
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
      return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    
    const recentOrders = await Order.find()
      .populate('user_id', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('order_number user_id createdAt total products.status status')
      .lean();

    const formattedRecentOrders = recentOrders.map(order => {
      const productStatuses = order.products.map(p => p.status || 'ORDERED');
      const uniqueStatuses = [...new Set(productStatuses)];
      
      let calculatedStatus = order.status;
      
    
      if (productStatuses.every(s => s === 'ORDERED')) {
        calculatedStatus = 'PENDING';
      } else if (productStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY')) {
        calculatedStatus = 'IN_PROGRESS';
      } else if (productStatuses.every(s => s === 'DELIVERED')) {
        calculatedStatus = 'DELIVERED';
      } else if (productStatuses.every(s => s === 'CANCELLED')) {
        calculatedStatus = 'CANCELLED';
      } else if (uniqueStatuses.length === 2 && 
                 uniqueStatuses.includes('DELIVERED') && 
                 uniqueStatuses.includes('CANCELLED')) {
        calculatedStatus = 'PARTIALLY_DELIVERED';
      } else if (uniqueStatuses.some(s => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY') && 
                 uniqueStatuses.includes('CANCELLED')) {
        calculatedStatus = 'PARTIALLY_SHIPPED';
      } else if (productStatuses.every(s => s === 'RETURNED')) {
        calculatedStatus = 'RETURNED';
      } else {
        calculatedStatus = 'IN_PROGRESS';
      }
      
      return {
        orderNumber: order.order_number,
        user: {
          name: order.user_id ? `${order.user_id.firstName} ${order.user_id.lastName}` : 'Unknown'
        },
        createdAt: order.createdAt,
        totalAmount: order.total,
        status: calculatedStatus,
        items: order.products.map(product => ({
          status: product.status || order.status
        }))
      };
    });

    
    const topProducts = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED'] },
          payment_status: 'COMPLETED',
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      { $unwind: "$products" },
      {
        $match: {
          "products.status": { $in: ['DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
        }
      },
      {
        $group: {
          _id: "$products.name",
          totalQty: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $project: {
          title: "$_id",
          totalQty: 1,
          totalRevenue: 1
        }
      }
    ]);

    const topCategories = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED'] },
          payment_status: 'COMPLETED',
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      { $unwind: "$products" },
      {
        $match: {
          "products.status": { $in: ['DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
        }
      },
      {
        $lookup: {
          from: "product_variations",
          localField: "products.variation",
          foreignField: "_id",
          as: "variation"
        }
      },
      { $unwind: "$variation" },
      {
        $lookup: {
          from: "products",
          localField: "variation.product_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.product_category",
          totalQty: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: "$_id",
          totalQty: 1,
          totalRevenue: 1
        }
      }
    ]);

  
    const topBrands = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED'] },
          payment_status: 'COMPLETED',
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      { $unwind: "$products" },
      {
        $match: {
          "products.status": { $in: ['DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
        }
      },
      {
        $lookup: {
          from: "product_variations",
          localField: "products.variation",
          foreignField: "_id",
          as: "variation"
        }
      },
      { $unwind: "$variation" },
      {
        $lookup: {
          from: "products",
          localField: "variation.product_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.product_type",
          totalQty: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: "$_id",
          totalQty: 1,
          totalRevenue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalSales: totalSales || 0,
        customers: totalCustomers || 0,
        totalOrders: totalOrders || 0,
        timeSeriesLabels: timeSeriesLabels || [],
        timeSeriesData: timeSeriesValues || [],
        recentOrders: formattedRecentOrders || [],
        topProducts: topProducts || [],
        topCategories: topCategories || [],
        topBrands: topBrands || []
      },
      timeFilter,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard details error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      message: error.message 
    });
  }
};

module.exports = {
  getDashboard,
  getDashboardDetails
}