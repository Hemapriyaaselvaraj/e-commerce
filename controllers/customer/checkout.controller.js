const userModel = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");

const checkout = async (req, res) => {
  const userId = req.session.userId;
  const user = await userModel.findById(userId);

  const addresses = await Address.find({ user_id: userId }).lean();

  const cartItems = await Cart.find({ user_id: userId }).populate({
    path: "product_variation_id",
    populate: { path: "product_id", model: "product" },
  });

  const products = cartItems.map((item) => {
    let priceBefore = item.product_variation_id.product_id.price;
    let priceAfter = priceBefore;
    let discount =
      item.product_variation_id.product_id.discount_percentage || 0;
    if (discount > 0) {
      priceAfter = priceBefore * (1 - discount / 100);
    }

    return {
      name: item.product_variation_id.product_id.name,
      image: item.product_variation_id.images,
      price: item.product_variation_id.product_id.price,
      quantity: item.quantity,
      priceBefore,
      priceAfter,
      discount,
      isActive: item.product_variation_id.product_id.is_active,
      stock: item.product_variation_id.stock_quantity
    };
  });

  const filteredItems = products.filter(
    (item) => item.isActive && item.stock > 0
  );

  const subtotal = filteredItems.reduce(
    (sum, p) => sum + p.priceAfter * p.quantity,
    0
  );
  const tax = Math.round((subtotal * 8) / 100); 
  const shipping = subtotal > 1000 ? 0 : 50;
  const total = subtotal + tax + shipping;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID; 


  res.render("user/checkout", {
    userEmail: user.email || "",
    userPhone: user.phoneNumber || "",
    addresses,
    products: filteredItems,
    subtotal,
    tax,
    shipping,
    total,
    razorpayKeyId
  });
};

// const addAddress = async (req, res) => {
//   try {
//     console.log("➡️ addAddress() CALLED");
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


module.exports = {
  checkout,
//   addAddress
};
