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
    const { timeFilter = 'monthly', viewType = 'orders' } = req.query;
    
    // Validate parameters
    const validFilters = ['daily', 'weekly', 'monthly', 'yearly'];
    const validViewTypes = ['orders', 'deliveries'];
    
    if (!validFilters.includes(timeFilter)) {
      return res.status(400).json({ 
        error: 'Invalid time filter selection',
        message: 'Please select a valid time period: daily, weekly, monthly, or yearly.'
      });
    }
    
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({ 
        error: 'Invalid view type selection',
        message: 'Please select a valid view type: orders or deliveries.'
      });
    }
    
    // Calculate date range based on filter
    const now = new Date();
    let startDate, endDate, groupBy, dateFormat;
    
    switch (timeFilter) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13); // Last 14 days including today
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: viewType === 'orders' ? "$createdAt" : "$updatedAt" } };
        dateFormat = 'daily';
        break;
        
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 55); // 8 weeks
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        groupBy = { 
          $dateToString: { 
            format: "Week %U, %Y", 
            date: viewType === 'orders' ? "$createdAt" : "$updatedAt"
          } 
        };
        dateFormat = 'weekly';
        break;
        
      case 'yearly':
        startDate = new Date(now.getFullYear() - 4, 0, 1); // Last 5 years
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        groupBy = { $dateToString: { format: "%Y", date: viewType === 'orders' ? "$createdAt" : "$updatedAt" } };
        dateFormat = 'yearly';
        break;
        
      default: // monthly
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); // 12 months ago
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // End of current month
        groupBy = { $dateToString: { format: "%Y-%m", date: viewType === 'orders' ? "$createdAt" : "$updatedAt" } };
        dateFormat = 'monthly';
    }

    // Get basic stats
    const [totalSalesResult, totalCustomers, totalOrders] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED'] },
            payment_status: 'COMPLETED', // Only count completed payments as revenue
            ...(viewType === 'orders' 
              ? { createdAt: { $gte: startDate, $lt: endDate } }
              : { 
                  updatedAt: { $gte: startDate, $lt: endDate },
                  status: 'DELIVERED' // Only count delivered orders for delivery view
                }
            )
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
        ...(viewType === 'orders' 
          ? { createdAt: { $gte: startDate, $lt: endDate } }
          : { 
              updatedAt: { $gte: startDate, $lt: endDate },
              status: 'DELIVERED'
            }
        )
      })
    ]);

    const totalSales = totalSalesResult[0]?.total || 0;

    // Get time series data for chart
    let timeSeriesMatchConditions = {
      status: { $nin: ['CANCELLED'] },
      payment_status: 'COMPLETED'
    };

    if (viewType === 'orders') {
      // Orders view: track by creation date
      timeSeriesMatchConditions.createdAt = { $gte: startDate, $lt: endDate };
    } else {
      // Deliveries view: track by delivery date (updatedAt when status became DELIVERED)
      timeSeriesMatchConditions.updatedAt = { $gte: startDate, $lt: endDate };
      timeSeriesMatchConditions.status = 'DELIVERED';
    }

    const timeSeriesData = await Order.aggregate([
      {
        $match: timeSeriesMatchConditions
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
    
    console.log(`Dashboard Debug - ${timeFilter} ${viewType}:`, {
      dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      rawDataPoints: timeSeriesData.length,
      rawData: timeSeriesData
    });
    
    if (dateFormat === 'monthly') {
      // Generate last 12 months from current month
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Create a map of existing data for quick lookup
      const dataMap = {};
      timeSeriesData.forEach(item => {
        dataMap[item._id] = item.sales;
      });
      
      console.log('Available months in data:', Object.keys(dataMap));
      
      // Generate last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = `${monthNames[month]} ${year}`;
        const value = dataMap[monthKey] || 0;
        
        timeSeriesLabels.push(label);
        timeSeriesValues.push(value);
        
        if (value > 0) {
          console.log(`Month with data: ${label} (${monthKey}) = Rs${value}`);
        }
      }
      
      console.log('Generated monthly chart:', { 
        labels: timeSeriesLabels, 
        values: timeSeriesValues,
        nonZeroCount: timeSeriesValues.filter(v => v > 0).length 
      });
    } else if (dateFormat === 'daily') {
      // Generate all days in the range
      const dayMap = {};
      timeSeriesData.forEach(item => {
        dayMap[item._id] = item.sales;
      });
      
      console.log('Available days in data:', Object.keys(dayMap));
      console.log('Date range for chart:', startDate.toISOString(), 'to', endDate.toISOString());
      
      // Instead of generating all days, use actual days with data plus recent days
      const allDayKeys = Object.keys(dayMap).sort();
      
      if (allDayKeys.length > 0) {
        // Get all dates from data
        const dayData = [];
        
        // Add all days from data
        allDayKeys.forEach(dayKey => {
          const date = new Date(dayKey);
          dayData.push({
            key: dayKey,
            date: date,
            value: dayMap[dayKey],
            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          });
        });
        
        // Sort by date
        dayData.sort((a, b) => a.date - b.date);
        
        // Also add recent days (last 7 days) even if they have no data for context
        const recentDays = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateKey = date.toISOString().split('T')[0];
          
          // Only add if not already in dayData
          if (!dayMap[dateKey]) {
            recentDays.push({
              key: dateKey,
              date: date,
              value: 0,
              label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
          }
        }
        
        // Combine data days and recent days, remove duplicates, sort
        const allDays = [...dayData, ...recentDays];
        const uniqueDays = allDays.filter((day, index, self) => 
          index === self.findIndex(d => d.key === day.key)
        );
        uniqueDays.sort((a, b) => a.date - b.date);
        
        // Take the most recent 14 days
        const recentDaysData = uniqueDays.slice(-14);
        
        recentDaysData.forEach(day => {
          timeSeriesLabels.push(day.label);
          timeSeriesValues.push(day.value);
          
          if (day.value > 0) {
            console.log(`Day with data: ${day.label} (${day.key}) = Rs${day.value}`);
          }
        });
        
        console.log('Generated daily chart:', { 
          labels: timeSeriesLabels, 
          values: timeSeriesValues,
          nonZeroCount: timeSeriesValues.filter(v => v > 0).length 
        });
      } else {
        // Fallback: generate last 14 days if no data
        const currentDate = new Date(startDate);
        while (currentDate < endDate) {
          const label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          timeSeriesLabels.push(label);
          timeSeriesValues.push(0);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        console.log('No daily data found, generated empty chart');
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
      // For weekly, show only last 8 weeks to make data more visible
      if (dateFormat === 'weekly') {
        const weekMap = {};
        timeSeriesData.forEach(item => {
          weekMap[item._id] = item.sales;
        });
        
        console.log('Available weeks in data:', Object.keys(weekMap));
        
        // Instead of generating weeks, use the actual weeks from data and fill gaps
        const allWeekKeys = Object.keys(weekMap).sort();
        
        // If we have data, show all weeks with data plus some recent weeks
        if (allWeekKeys.length > 0) {
          // Get all unique weeks from the data
          const weekData = [];
          
          // Add all weeks from data
          allWeekKeys.forEach(weekKey => {
            const weekMatch = weekKey.match(/Week (\d+), (\d+)/);
            if (weekMatch) {
              const weekNum = parseInt(weekMatch[1]);
              const year = parseInt(weekMatch[2]);
              weekData.push({
                key: weekKey,
                weekNum: weekNum,
                year: year,
                value: weekMap[weekKey]
              });
            }
          });
          
          // Sort by year and week
          weekData.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.weekNum - b.weekNum;
          });
          
          // Take the most recent weeks (limit to 8)
          const recentWeeks = weekData.slice(-8);
          
          recentWeeks.forEach(week => {
            timeSeriesLabels.push(`Week ${week.weekNum}`);
            timeSeriesValues.push(week.value);
          });
          
          console.log('Generated weekly chart:', { labels: timeSeriesLabels, values: timeSeriesValues });
        } else {
          // Fallback: generate last 8 weeks if no data
          const currentDate = new Date();
          for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - (i * 7));
            
            const weekNumber = getWeekNumber(weekStart);
            timeSeriesLabels.push(`Week ${weekNumber}`);
            timeSeriesValues.push(0);
          }
        }
      } else {
        // Fallback for other formats
        timeSeriesLabels = timeSeriesData.map(item => item._id);
        timeSeriesValues = timeSeriesData.map(item => item.sales);
      }
    }
    
    console.log(`Chart Data Generated:`, {
      labels: timeSeriesLabels,
      values: timeSeriesValues,
      nonZeroCount: timeSeriesValues.filter(v => v > 0).length,
      maxValue: Math.max(...timeSeriesValues, 0)
    });
    
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
          ...(viewType === 'orders' 
            ? { createdAt: { $gte: startDate, $lt: endDate } }
            : { 
                updatedAt: { $gte: startDate, $lt: endDate },
                status: 'DELIVERED'
              }
          )
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
          ...(viewType === 'orders' 
            ? { createdAt: { $gte: startDate, $lt: endDate } }
            : { 
                updatedAt: { $gte: startDate, $lt: endDate },
                status: 'DELIVERED'
              }
          )
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
          ...(viewType === 'orders' 
            ? { createdAt: { $gte: startDate, $lt: endDate } }
            : { 
                updatedAt: { $gte: startDate, $lt: endDate },
                status: 'DELIVERED'
              }
          )
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
      viewType,
      chartTitle: viewType === 'orders' ? 'Revenue by Order Date' : 'Revenue by Delivery Date',
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