const mongoose = require('mongoose');
require('dotenv').config();

async function debugSalesReport() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const Order = require('./models/orderModel');
    const User = require('./models/userModel');
    
    // Get the specific orders from your screenshot
    const orderNumbers = ['TOES2601131318', 'TOES2601131315', 'TOES2601131313', 'TOES2601131312', 'TOES2601131311'];
    
    for (const orderNumber of orderNumbers) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 ANALYZING ORDER: ${orderNumber}`);
      console.log(`${'='.repeat(60)}`);
      
      const order = await Order.findOne({ order_number: orderNumber })
        .populate('user_id', 'firstName lastName')
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
      let deliveredProductsSubtotal = 0;
      let deliveredCouponAllocated = 0;
      let deliveredCount = 0;
      
      order.products.forEach((product, index) => {
        const productTotal = product.price * product.quantity;
        const originalTotal = (product.original_price || product.price) * product.quantity;
        const productDiscount = originalTotal - productTotal;
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
          deliveredProductsSubtotal += productTotal;
          deliveredCouponAllocated += couponAllocated;
          deliveredCount++;
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
      const totalProducts = order.products.length;
      const deliveredRatio = deliveredCount / totalProducts;
      const proportionalShipping = (order.shipping_charge || 0) * deliveredRatio;
      const reportSubtotal = deliveredProductsSubtotal;
      const reportDiscount = deliveredCouponAllocated;
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
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.disconnect();
  }
}

debugSalesReport();