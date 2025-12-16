const userModel = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Offer = require("../../models/offerModel");
const Coupon = require('../../models/couponModel');
const { calculateBestOffer } = require("../../utils/offerCalculator");


const checkout = async (req, res) => {
  const userId = req.session.userId;
  const user = await userModel.findById(userId);

  const addresses = await Address.find({ user_id: userId }).lean();

  const cartItems = await Cart.find({ user_id: userId }).populate({
    path: "product_variation_id",
    populate: { path: "product_id", model: "product" },
  });

  const now = new Date();
  const activeOffers = await Offer.find({
    isActive: true,
    validFrom: { $lte: now },
    validTo: { $gte: now }
  })
  .populate('category', 'category')
  .lean();

  const products = cartItems.map((item) => {
    const product = item.product_variation_id.product_id;
    let priceBefore = product.price;

    // ⭐ Use centralized offer calculation for consistency
    const offerResult = calculateBestOffer(product, activeOffers);
    const maxOfferDiscount = offerResult.discountPercentage;
    const priceAfter = offerResult.finalPrice;

    return {
      name: product.name,
      image: item.product_variation_id.images,
      price: product.price,
      quantity: item.quantity,
      priceBefore,
      priceAfter,
      discount: maxOfferDiscount,
      isActive: product.is_active,
      stock: item.product_variation_id.stock_quantity
    };
  });

  const filteredItems = products.filter(
    (item) => item.isActive && item.stock > 0
  );

  const originalSubtotal = filteredItems.reduce(
    (sum, p) => sum + p.priceBefore * p.quantity,
    0
  );

  const offerDiscount = filteredItems.reduce(
    (sum, p) => sum + (p.priceBefore - p.priceAfter) * p.quantity,
    0
  );

  const subtotal = filteredItems.reduce(
    (sum, p) => sum + p.priceAfter * p.quantity,
    0
  );

  const shipping = subtotal > 1000 ? 0 : 50;
  const total = subtotal + shipping;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID; 


  res.render("user/checkout", {
    userEmail: user.email || "",
    userPhone: user.phoneNumber || "",
    addresses,
    products: filteredItems,
    originalSubtotal: Math.round(originalSubtotal),
    offerDiscount: Math.round(offerDiscount),
    subtotal: Math.round(subtotal),
    shipping,
    total,
    razorpayKeyId
  });
};

// const addAddress = async (req, res) => {
//   try {
//     const userId = req.session.userId;
//     if (!userId) {
//       return res.status(401).json({ success: false, message: "Please sign in to save an address." });
//     }

//     // Data coming from AJAX body
//     const {
//       name,
//       label,
//       type,
//       house_number,
//       locality,
//       street,
//       city,
//       state,
//       pincode,
//       phone_number
//     } = req.body;

//     // Validate required fields
//     if (!name || !phone_number || !city || !state || !pincode) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Name, phone, city, state and pincode are required." 
//       });
//     }

//     // Normalize type field
//     const normalizeType = (value = '') => {
//       const normalized = value.toString().trim().toUpperCase();
//       const allowed = ['HOME', 'WORK', 'OTHER'];
//       if (allowed.includes(normalized)) return normalized;
//       return normalized ? 'OTHER' : 'HOME';
//     };

//     // Check if this is the first address (should be default)
//     const addressCount = await Address.countDocuments({ user_id: userId });
//     const isDefault = addressCount === 0;

//     // Create and save the new address
//     await Address.create({
//       user_id: userId,
//       name: name.trim(),
//       label: label?.trim(),
//       type: normalizeType(type || label),
//       house_number: house_number?.trim(),
//       locality: locality?.trim(),
//       street: street?.trim(),
//       city: city.trim(),
//       state: state.trim(),
//       pincode: Number(pincode),
//       phone_number: phone_number.trim(),
//       isDefault: isDefault
//     });

//     return res.json({ success: true });

//   } catch (error) {
//     console.error("Add address error:", error);
//     return res.status(500).json({ success: false, message: "Error saving address" });
//   }
// };


const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.userId;
    const now = new Date();
    
    const coupons = await Coupon.find({
      validFrom: { $lte: now },
      validTo: { $gte: now }
    }).select('code description discountType discountValue minimumPurchase maxDiscount usageLimitPerUser usedBy').lean();
    
    const couponsWithUsage = coupons.map(coupon => {
      const userUsage = coupon.usedBy?.find(u => u.userId && u.userId.toString() === userId?.toString());
      const timesUsed = userUsage ? userUsage.count : 0;
      const isUsed = timesUsed >= coupon.usageLimitPerUser;
      
      return {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumPurchase: coupon.minimumPurchase,
        maxDiscount: coupon.maxDiscount,
        isUsed,
        timesUsed,
        usageLimit: coupon.usageLimitPerUser
      };
    });
    
    res.json({ success: true, coupons: couponsWithUsage });
  } catch (error) {
    console.error('Error fetching available coupons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

module.exports = {
  checkout,
  getAvailableCoupons
//   addAddress
};
