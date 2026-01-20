const Order = require('../../models/orderModel');
const User = require('../../models/userModel');
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const getSalesReportPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    res.render("admin/salesReport", {
      name: user ? user.firstName : "Admin",
      pageTitle: "Sales Report"
    });

  } catch (error) {
    console.error("Error loading sales report page:", error);
    res.status(500).render('admin/500', { 
      message: 'We\'re having trouble loading the sales report page. Please try refreshing or contact technical support if the problem continues.',
      name: 'Admin'
    });
  }
};

const getSalesReportDataInternal = async (query, forDownload = false) => {
  const { filterType, startDate, endDate, page = 1 } = query;
  
  // Match orders that have at least one delivered product
  let matchQuery = {
    products: { $elemMatch: { status: "DELIVERED" } }
  };

  let from, to;
  const now = new Date();

  switch (filterType) {
    case "daily":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case "yearly":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case "custom":
      from = new Date(startDate);
      from.setHours(0, 0, 0, 0);
      to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      break;

    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  matchQuery.ordered_at = { $gte: from, $lte: to };

  // Get total count for summary and pagination
  const deliveredOrderCount = await Order.countDocuments(matchQuery);

  // For downloads, get all orders; for display, get paginated orders
  let orders;
  let pagination = {};

  if (forDownload) {
    orders = await Order.find(matchQuery)
      .populate("user_id", "firstName email")
      .sort({ ordered_at: -1 })
      .lean();
  } else {
    const limit = 10; 
    const skip = (parseInt(page) - 1) * limit;
    const totalPages = Math.ceil(deliveredOrderCount / limit);

    orders = await Order.find(matchQuery)
      .populate("user_id", "firstName email")
      .sort({ ordered_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    pagination = {
      currentPage: parseInt(page),
      totalPages,
      deliveredOrderCount,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      nextPage: parseInt(page) + 1,
      prevPage: parseInt(page) - 1
    };
  }

  // Use the same orders for summary calculation to avoid duplicate query
  const allOrdersForSummary = forDownload ? orders : await Order.find(matchQuery).lean();
  
  let totalSalesCount = 0; // Count of delivered products
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalCouponDeduction = 0;

  allOrdersForSummary.forEach(order => {
    // Only count delivered products
    const deliveredProducts = order.products.filter(p => p.status === 'DELIVERED');
    totalSalesCount += deliveredProducts.length;
    
    // Calculate amounts only for delivered products
    let orderSubtotal = 0;
    let orderDiscount = 0;
    let orderCouponDiscount = 0;
    
    deliveredProducts.forEach(product => {
      orderSubtotal += product.price * product.quantity;
      
      // Product-level offer discount
      if (product.original_price && product.price) {
        orderDiscount += (product.original_price - product.price) * product.quantity;
      }
      
      // ⭐ Use allocated coupon discount (no more proportional calculation!)
      orderCouponDiscount += product.coupon_discount_allocated || 0;
    });
    
    // Calculate proportional shipping for delivered products (shipping still needs proportional split)
    const totalProducts = order.products.length;
    const deliveredProductsCount = deliveredProducts.length;
    const deliveredRatio = deliveredProductsCount / totalProducts;
    const proportionalShipping = (order.shipping_charge || 0) * deliveredRatio;
    
    totalAmount += orderSubtotal + proportionalShipping - orderCouponDiscount;
    totalDiscount += orderDiscount;
    totalCouponDeduction += orderCouponDiscount;
  });

  // Process orders to show only delivered products data
  const processedOrders = orders.map(order => {
    const deliveredProducts = order.products.filter(p => p.status === 'DELIVERED');
    
    let orderSubtotal = 0;
    let orderOriginalTotal = 0;
    let orderDiscount = 0;
    let orderCouponDiscount = 0;
    
    deliveredProducts.forEach(product => {
      const originalPrice = product.original_price || product.price;
      const currentPrice = product.price;
      
      orderOriginalTotal += originalPrice * product.quantity;
      orderSubtotal += currentPrice * product.quantity;
      
      // Product-level offer discount
      if (originalPrice > currentPrice) {
        orderDiscount += (originalPrice - currentPrice) * product.quantity;
      }
      
      // ⭐ Use allocated coupon discount (accurate per-product amount)
      orderCouponDiscount += product.coupon_discount_allocated || 0;
    });
    
    // Calculate proportional shipping for delivered products (shipping still needs proportional split)
    const totalProducts = order.products.length;
    const deliveredProductsCount = deliveredProducts.length;
    const deliveredRatio = deliveredProductsCount / totalProducts;
    const proportionalShipping = (order.shipping_charge || 0) * deliveredRatio;
    const proportionalTotal = orderSubtotal + proportionalShipping - orderCouponDiscount;
    
    // Calculate discount percentages
    const offerDiscountPercentage = orderOriginalTotal > 0 ? Math.round((orderDiscount / orderOriginalTotal) * 100) : 0;
    const couponDiscountPercentage = orderSubtotal > 0 ? Math.round((orderCouponDiscount / orderSubtotal) * 100) : 0;
    const totalSavings = orderDiscount + orderCouponDiscount;
    const totalSavingsPercentage = orderOriginalTotal > 0 ? Math.round((totalSavings / orderOriginalTotal) * 100) : 0;
    
    return {
      ...order,
      deliveredProductsCount,
      original_total: orderOriginalTotal,
      subtotal: orderSubtotal,
      total: proportionalTotal,
      coupon_discount: orderCouponDiscount,
      shipping_charge: proportionalShipping,
      product_discount: orderDiscount,
      offer_discount_percentage: offerDiscountPercentage,
      coupon_discount_percentage: couponDiscountPercentage,
      total_savings: totalSavings,
      total_savings_percentage: totalSavingsPercentage
    };
  });

  return {
    orders: processedOrders,
    summary: {
      totalSalesCount, // Now counts delivered products, not orders
      totalAmount,
      totalDiscount,
      totalCouponDeduction
    },
    pagination
  };
};

const getSalesReportData = async (req, res) => {
  try {
    const data = await getSalesReportDataInternal(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Sales report error:", err);
    res.json({ 
      success: false, 
      message: "We couldn't generate the sales report due to a technical issue. Please try again or contact support if the problem continues." 
    });
  }
};

const downloadPDF = async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;
    const response = await getSalesReportDataInternal({ filterType, startDate, endDate }, true);
    const { orders, summary } = response;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${filterType}-${Date.now()}.pdf`);

    doc.pipe(res);

    // Title
    doc.fontSize(22).font('Helvetica-Bold').text("Sales Report", { align: "center" });
    doc.fontSize(12).font('Helvetica').text(`Filter: ${filterType}`, { align: "center" });
    doc.moveDown(1.5);

    // Summary Box - Single Line
    const summaryBoxTop = doc.y;
    const summaryBoxLeft = 40;
    const summaryBoxWidth = doc.page.width - 80;
    
    doc.rect(summaryBoxLeft, summaryBoxTop, summaryBoxWidth, 35).stroke();
    
    const totalDiscount = summary.totalDiscount + summary.totalCouponDeduction;
    const summaryText = `Delivered Products: ${summary.totalSalesCount}  |  Total Revenue: Rs${summary.totalAmount.toLocaleString()}  |  Total Discount: Rs${totalDiscount.toLocaleString()}`;
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(summaryText, summaryBoxLeft + 15, summaryBoxTop + 12, { 
      width: summaryBoxWidth - 30,
      align: 'left'
    });

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y + 10;
    const colWidths = {
      orderNo: 70,
      customer: 60,
      date: 80,
      items: 35,
      original: 55,
      offer: 55,
      subtotal: 55,
      coupon: 55,
      shipping: 45,
      total: 55,
      savings: 55
    };

    const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
    const tableLeft = 40;
    let xPos = tableLeft;
    
    // Draw header background
    doc.rect(tableLeft, tableTop - 5, tableWidth, 22).fill('#e8e8e8');
    
    // Draw vertical lines in header
    let vLineX = tableLeft;
    Object.values(colWidths).forEach((width, idx) => {
      vLineX += width;
      if (idx < Object.values(colWidths).length - 1) { // Don't draw after last column
        doc.moveTo(vLineX, tableTop - 5).lineTo(vLineX, tableTop + 17).stroke();
      }
    });
    
    // Header text
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
    doc.text("Order No", xPos + 2, tableTop, { width: colWidths.orderNo - 4, align: 'left' });
    xPos += colWidths.orderNo;
    doc.text("Customer", xPos + 2, tableTop, { width: colWidths.customer - 4, align: 'left' });
    xPos += colWidths.customer;
    doc.text("Date", xPos + 2, tableTop, { width: colWidths.date - 4, align: 'left' });
    xPos += colWidths.date;
    doc.text("Items", xPos + 2, tableTop, { width: colWidths.items - 4, align: 'center' });
    xPos += colWidths.items;
    doc.text("Original", xPos + 2, tableTop, { width: colWidths.original - 4, align: 'center' });
    xPos += colWidths.original;
    doc.text("Offer Disc", xPos + 2, tableTop, { width: colWidths.offer - 4, align: 'center' });
    xPos += colWidths.offer;
    doc.text("Subtotal", xPos + 2, tableTop, { width: colWidths.subtotal - 4, align: 'center' });
    xPos += colWidths.subtotal;
    doc.text("Coupon", xPos + 2, tableTop, { width: colWidths.coupon - 4, align: 'center' });
    xPos += colWidths.coupon;
    doc.text("Ship", xPos + 2, tableTop, { width: colWidths.shipping - 4, align: 'center' });
    xPos += colWidths.shipping;
    doc.text("Total", xPos + 2, tableTop, { width: colWidths.total - 4, align: 'center' });
    xPos += colWidths.total;
    doc.text("Savings", xPos + 2, tableTop, { width: colWidths.savings - 4, align: 'center' });

    doc.fillColor('#000000');
    let yPos = tableTop + 22;

    // Table rows
    doc.fontSize(7).font('Helvetica');
    orders.forEach((order, index) => {
      // Check if we need a new page
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      const customerName = order.user_id ? order.user_id.firstName : 'Guest';
      
      // Use the detailed price breakdown
      const originalTotal = order.original_total || 0;
      const offerDiscount = order.product_discount || 0;
      const subtotal = order.subtotal || 0;
      const couponDiscount = order.coupon_discount || 0;
      const shipping = order.shipping_charge || 0;
      const finalTotal = order.total || 0;
      const totalSavings = order.total_savings || 0;
      const deliveredItems = order.deliveredProductsCount || 0;
      
      const orderDate = new Date(order.ordered_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: '2-digit'
      });

      // Draw row border
      doc.rect(tableLeft, yPos - 3, tableWidth, 18).stroke();

      // Draw vertical lines for columns
      let vLineX = tableLeft;
      Object.values(colWidths).forEach((width, idx) => {
        if (idx > 0) { // Skip first line (left border)
          doc.moveTo(vLineX, yPos - 3).lineTo(vLineX, yPos + 15).stroke();
        }
        vLineX += width;
      });

      xPos = tableLeft;
      doc.text(order.order_number, xPos + 2, yPos, { width: colWidths.orderNo - 4, align: 'left' });
      xPos += colWidths.orderNo;
      doc.text(customerName, xPos + 2, yPos, { width: colWidths.customer - 4, align: 'left' });
      xPos += colWidths.customer;
      doc.text(orderDate, xPos + 2, yPos, { width: colWidths.date - 4, align: 'left' });
      xPos += colWidths.date;
      doc.text(deliveredItems.toString(), xPos + 2, yPos, { width: colWidths.items - 4, align: 'center' });
      xPos += colWidths.items;
      doc.text(`₹${originalTotal.toLocaleString()}`, xPos + 2, yPos, { width: colWidths.original - 4, align: 'right' });
      xPos += colWidths.original;
      doc.text(offerDiscount > 0 ? `-₹${offerDiscount.toLocaleString()}` : '-', xPos + 2, yPos, { width: colWidths.offer - 4, align: 'right' });
      xPos += colWidths.offer;
      doc.text(`₹${subtotal.toLocaleString()}`, xPos + 2, yPos, { width: colWidths.subtotal - 4, align: 'right' });
      xPos += colWidths.subtotal;
      doc.text(couponDiscount > 0 ? `-₹${couponDiscount.toLocaleString()}` : '-', xPos + 2, yPos, { width: colWidths.coupon - 4, align: 'right' });
      xPos += colWidths.coupon;
      doc.text(shipping > 0 ? `₹${shipping.toLocaleString()}` : 'FREE', xPos + 2, yPos, { width: colWidths.shipping - 4, align: 'right' });
      xPos += colWidths.shipping;
      doc.text(`₹${finalTotal.toLocaleString()}`, xPos + 2, yPos, { width: colWidths.total - 4, align: 'right' });
      xPos += colWidths.total;
      doc.text(totalSavings > 0 ? `₹${totalSavings.toLocaleString()}` : '-', xPos + 2, yPos, { width: colWidths.savings - 4, align: 'right' });

      yPos += 18;
    });

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text(
      `Generated on ${new Date().toLocaleString()}`,
      40,
      doc.page.height - 40,
      { align: 'center', width: tableWidth }
    );

    doc.end();

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).render('admin/500', { 
      message: 'We couldn\'t generate the PDF report due to a technical issue. Please try again or contact support if the problem continues.',
      name: 'Admin'
    });
  }
};

const downloadExcel = async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;
    const response = await getSalesReportDataInternal({ filterType, startDate, endDate }, true);
    const { orders, summary } = response;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    // Title
    sheet.mergeCells('A1:G1');
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = 'Sales Report';
    titleRow.getCell(1).font = { size: 18, bold: true };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Filter
    sheet.mergeCells('A2:G2');
    const filterRow = sheet.getRow(2);
    filterRow.getCell(1).value = `Filter: ${filterType}`;
    filterRow.getCell(1).font = { size: 12 };
    filterRow.getCell(1).alignment = { horizontal: 'center' };
    filterRow.height = 20;

    // Summary
    const totalDiscount = summary.totalDiscount + summary.totalCouponDeduction;
    sheet.mergeCells('A4:G4');
    const summaryRow = sheet.getRow(4);
    summaryRow.getCell(1).value = `Delivered Products: ${summary.totalSalesCount}  |  Total Revenue: Rs${summary.totalAmount.toLocaleString()}  |  Total Discount: Rs${totalDiscount.toLocaleString()}`;
    summaryRow.getCell(1).font = { size: 11, bold: true };
    summaryRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    summaryRow.height = 25;
    summaryRow.getCell(1).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Table headers
    const headerRow = sheet.getRow(6);
    headerRow.values = ['Order No', 'Customer', 'Date', 'Items', 'Original Price', 'Offer Discount', 'Subtotal', 'Coupon Discount', 'Shipping', 'Final Total', 'Total Savings'];
    headerRow.font = { bold: true, size: 10 };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' }
    };

    // Set column widths
    sheet.columns = [
      { key: 'orderNo', width: 18 },
      { key: 'customer', width: 15 },
      { key: 'date', width: 22 },
      { key: 'items', width: 8 },
      { key: 'original', width: 15 },
      { key: 'offer', width: 15 },
      { key: 'subtotal', width: 15 },
      { key: 'coupon', width: 15 },
      { key: 'shipping', width: 12 },
      { key: 'total', width: 15 },
      { key: 'savings', width: 15 }
    ];

    // Add data rows
    let rowNum = 7;
    orders.forEach((order) => {
      const customerName = order.user_id ? order.user_id.firstName : 'Guest';
      
      // Use the detailed price breakdown
      const originalTotal = order.original_total || 0;
      const offerDiscount = order.product_discount || 0;
      const subtotal = order.subtotal || 0;
      const couponDiscount = order.coupon_discount || 0;
      const shipping = order.shipping_charge || 0;
      const finalTotal = order.total || 0;
      const totalSavings = order.total_savings || 0;
      const deliveredItems = order.deliveredProductsCount || 0;
      
      const orderDate = new Date(order.ordered_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });

      const row = sheet.getRow(rowNum);
      row.values = [
        order.order_number,
        customerName,
        orderDate,
        deliveredItems,
        `₹${originalTotal.toLocaleString()}`,
        offerDiscount > 0 ? `-₹${offerDiscount.toLocaleString()}` : '-',
        `₹${subtotal.toLocaleString()}`,
        couponDiscount > 0 ? `-₹${couponDiscount.toLocaleString()}` : '-',
        shipping > 0 ? `₹${shipping.toLocaleString()}` : 'FREE',
        `₹${finalTotal.toLocaleString()}`,
        totalSavings > 0 ? `₹${totalSavings.toLocaleString()}` : '-'
      ];
      
      row.alignment = { vertical: 'middle' };
      row.height = 18;
      
      // Apply borders to all cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      rowNum++;
    });

    // Apply borders to header row
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${filterType}-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Excel generation error:", err);
    res.status(500).render('admin/500', { 
      message: 'We couldn\'t generate the Excel report due to a technical issue. Please try again or contact support if the problem continues.',
      name: 'Admin'
    });
  }
};

module.exports = {
    getSalesReportPage,
    getSalesReportData,
    downloadPDF,
    downloadExcel
}
