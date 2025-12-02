const Order = require('../models/orderModel');

async function generateOrderNumber() {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);  
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const date = today.getDate().toString().padStart(2, '0');
    
    
    const basePrefix = `TOES${year}${month}${date}`;
    
    
    const lastOrder = await Order.findOne({
        order_number: new RegExp(`^${basePrefix}`)
    }, { order_number: 1 })
    .sort({ order_number: -1 });

    let sequentialNumber = 1;
    if (lastOrder) {
        
        const lastNumber = parseInt(lastOrder.order_number.slice(-4));
        sequentialNumber = lastNumber + 1;
    }

    return `${basePrefix}${sequentialNumber.toString().padStart(2, '0')}`;
}

module.exports = { generateOrderNumber };
