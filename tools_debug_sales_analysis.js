require('dotenv').config();
const mongoose = require('mongoose');

async function debugSalesReport() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const Order = require('./models/orderModel');
    
    // Sample order numbers to analyze - you can modify these
    const orderNumbers = ['ORD-1733140179380-8765', 'ORD-1733140179380-1234'];
    
    for (const orderNumber of orderNumbers) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 ANALYZING ORDER: ${orderNumber}`);
      console.log(`${'='.repeat(60)}`);
      
      const order = await Order.findOne({ order_number: orderNumber })
        .populate('user_id', 'firstName lastName email')
        .lean();
      
      if (!order) {
        console.log(`❌ Order ${orderNumber} not found`);
        continue;
      }
      
      console.log(`📋 Basic Info:`);
      console.log(`   Customer: ${order.user_id?.firstName || 'Unknown'}`);
      console.log(`   Date: ${order.createdAt}`);
      console.log(`   Payment Method: ${order.payment_method}`);
      console.log(`   Payment Status: ${order.payment_status}`);
      console.log(`   Order Status: ${order.status}`);
      
      console.log(`\n💰 Order Totals:`);
      console.log(`   Subtotal: Rs${order.subtotal}`);
      console.log(`   Tax: Rs${order.tax}`);
      console.log(`   Shipping: Rs${order.shipping_charge}`);
      console.log(`   Coupon Discount: Rs${order.coupon_discount}`);
      console.log(`   Applied Coupon: ${order.applied_coupon_code || 'None'}`);
      console.log(`   Final Total: Rs${order.total}`);
      
      console.log(`\n📦 Products (${order.products.length}):`);
      
      let calculatedSubtotal = 0;
      let totalCouponAllocated = 0;
      let deliveredCount = 0;
      let deliveredProductsSubtotal = 0;
      let deliveredCouponAllocated = 0;
      
      order.products.forEach((product, index) => {
        const productTotal = product.price * product.quantity;
        const productDiscount = ((product.original_price || product.price) - product.price) * product.quantity;
        const couponAllocated = product.coupon_discount_allocated || 0;
        
        calculatedSubtotal += productTotal;
        totalCouponAllocated += couponAllocated;
        
        console.log(`   Product ${index + 1}:`);
        console.log(`     Name: ${product.name}`);
        console.log(`     Status: ${product.status}`);
        console.log(`     Quantity: ${product.quantity}`);
        console.log(`     Original Price: Rs${product.original_price || product.price}`);
        console.log(`     Final Price: Rs${product.price}`);
        console.log(`     Product Total: Rs${productTotal}`);
        console.log(`     Product Discount: Rs${productDiscount}`);
        console.log(`     Coupon Allocated: Rs${couponAllocated}`);
        
        if (product.status === 'DELIVERED') {
          deliveredCount++;
          deliveredProductsSubtotal += productTotal;
          deliveredCouponAllocated += couponAllocated;
        }
      });
      
      console.log(`\n🧮 Calculations:`);
      console.log(`   Calculated Subtotal: Rs${calculatedSubtotal}`);
      console.log(`   Stored Subtotal: Rs${order.subtotal}`);
      console.log(`   Match: ${calculatedSubtotal === order.subtotal ? '✅' : '❌'}`);
      
      console.log(`   Total Coupon Allocated: Rs${totalCouponAllocated}`);
      console.log(`   Stored Coupon Discount: Rs${order.coupon_discount}`);
      console.log(`   Match: ${totalCouponAllocated === order.coupon_discount ? '✅' : '❌'}`);
      
      console.log(`\n🚚 Delivered Products Analysis:`);
      console.log(`   Delivered Products Count: ${deliveredCount}/${order.products.length}`);
      console.log(`   Delivered Products Subtotal: Rs${deliveredProductsSubtotal}`);
      console.log(`   Delivered Coupon Allocated: Rs${deliveredCouponAllocated}`);
      
      // Calculate what the sales report should show
      const reportSubtotal = deliveredProductsSubtotal;
      const reportDiscount = deliveredCouponAllocated;
      const proportionalShipping = deliveredCount > 0 ? 
        (order.shipping_charge * deliveredProductsSubtotal) / calculatedSubtotal : 0;
      const reportTotal = reportSubtotal + proportionalShipping - reportDiscount;
      
      console.log(`\n📊 Sales Report Should Show:`);
      console.log(`   Subtotal: Rs${reportSubtotal}`);
      console.log(`   Discount: Rs${reportDiscount}`);
      console.log(`   Proportional Shipping: Rs${proportionalShipping.toFixed(2)}`);
      console.log(`   Total: Rs${reportTotal.toFixed(2)}`);
      
      // Check if there's a mismatch
      if (reportSubtotal === reportTotal && reportDiscount > 0) {
        console.log(`\n⚠️  ISSUE FOUND: Total equals Subtotal despite having discount!`);
        console.log(`   This suggests the coupon discount is not being subtracted from total.`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ANALYSIS COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the debug function
debugSalesReport();