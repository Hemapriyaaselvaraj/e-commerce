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

    const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4', 
      layout: 'landscape',
      bufferPages: true 
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${filterType}-${Date.now()}.pdf`);

    doc.pipe(res);

    // Title and Summary
    doc.fontSize(16).font('Helvetica-Bold').text("Sales Report", { align: "center" });
    doc.fontSize(10).font('Helvetica').text(`Filter: ${filterType}`, { align: "center" });
    doc.moveDown(0.5);

    const totalDiscount = Math.round(summary.totalDiscount + summary.totalCouponDeduction);
    doc.fontSize(9).font('Helvetica-Bold')
       .text('Delivered Products: ' + summary.totalSalesCount + ' | Total Revenue: Rs.' + Math.round(summary.totalAmount) + ' | Total Discount: Rs.' + totalDiscount, 
             { align: 'center' });
    doc.moveDown(1);

    // Table setup with exact measurements
    const margin = 30;
    const pageWidth = doc.page.width - (2 * margin); // 782px for landscape A4
    const startX = margin;
    let currentY = doc.y;

    // Fixed column widths that add up to exactly pageWidth
    const columnWidths = [
      90,  // Order No
      70,  // Customer  
      60,  // Date
      40,  // Items
      70,  // Original
      70,  // Offer
      70,  // Subtotal
      70,  // Coupon
      50,  // Ship
      70,  // Total
      62   // Savings
    ];

    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);

    const headers = ["Order No", "Customer", "Date", "Items", "Original", "Offer", "Subtotal", "Coupon", "Ship", "Total", "Savings"];
    const rowHeight = 20;

    // Function to draw table row
    const drawTableRow = (y, data, isHeader = false) => {
      let x = startX;
      
      // Draw row background
      if (isHeader) {
        doc.rect(startX, y, totalWidth, rowHeight).fill('#f0f0f0');
      }
      
      // Draw cell borders and text
      data.forEach((cellData, i) => {
        // Draw cell border
        doc.rect(x, y, columnWidths[i], rowHeight).stroke();
        
        // Set font
        if (isHeader) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        } else {
          doc.fontSize(7).font(i === 9 ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000000');
        }
        
        // Determine alignment
        let align = 'left';
        if (i === 2 || i === 3) align = 'center'; // Date, Items
        if (i >= 4) align = 'right'; // All price columns
        
        // Draw text with proper padding
        const padding = 3;
        doc.text(cellData, x + padding, y + 6, {
          width: columnWidths[i] - (2 * padding),
          align: align,
          lineBreak: false
        });
        
        x += columnWidths[i];
      });
    };

    // Draw header
    drawTableRow(currentY, headers, true);
    currentY += rowHeight;

    // Draw data rows
    orders.forEach((order, index) => {
      // Check for page break
      if (currentY > doc.page.height - 100) {
        doc.addPage({ layout: 'landscape' });
        currentY = 50;
        // Redraw header on new page
        drawTableRow(currentY, headers, true);
        currentY += rowHeight;
      }

      const customerName = order.user_id ? order.user_id.firstName : 'Guest';
      
      // Clean numeric values - ensure no extra characters
      const originalTotal = Math.round(parseFloat(order.original_total) || 0);
      const offerDiscount = Math.round(parseFloat(order.product_discount) || 0);
      const subtotal = Math.round(parseFloat(order.subtotal) || 0);
      const couponDiscount = Math.round(parseFloat(order.coupon_discount) || 0);
      const shipping = Math.round(parseFloat(order.shipping_charge) || 0);
      const finalTotal = Math.round(parseFloat(order.total) || 0);
      const totalSavings = Math.round(parseFloat(order.total_savings) || 0);
      const deliveredItems = parseInt(order.deliveredProductsCount) || 0;
      
      const orderDate = new Date(order.ordered_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });

      const rowData = [
        order.order_number,
        customerName.length > 9 ? customerName.substring(0, 9) : customerName,
        orderDate,
        deliveredItems.toString(),
        originalTotal > 0 ? 'Rs.' + originalTotal : 'Rs.0',
        offerDiscount > 0 ? '-Rs.' + offerDiscount : '-',
        subtotal > 0 ? 'Rs.' + subtotal : 'Rs.0',
        couponDiscount > 0 ? '-Rs.' + couponDiscount : '-',
        shipping > 0 ? 'Rs.' + shipping : 'FREE',
        finalTotal > 0 ? 'Rs.' + finalTotal : 'Rs.0',
        totalSavings > 0 ? 'Rs.' + totalSavings : '-'
      ];

      drawTableRow(currentY, rowData, false);
      currentY += rowHeight;
    });

    // Footer
    doc.fontSize(7).font('Helvetica').fillColor('#666666');
    doc.text(`Generated on ${new Date().toLocaleString()}`, startX, doc.page.height - 40, {
      width: totalWidth,
      align: 'center'
    });

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
