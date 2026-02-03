const Address = require('../../models/addressModel');
const userModel = require('../../models/userModel');

const getAddresses = async (req, res) => {
  if (!req.session || !req.session.userId) 
    return res.redirect('/login');
  
  const addresses = await Address.find({ user_id: req.session.userId }).lean();
  const user = await userModel.findById(req.session.userId).lean();
  
  // Get cart and wishlist counts for navbar
  const Cart = require('../../models/cartModel');
  const Wishlist = require('../../models/wishlistModel');
  
  const cart = await Cart.findOne({ user: req.session.userId });
  const cartCount = cart ? cart.items.length : 0;
  
  const wishlist = await Wishlist.findOne({ user: req.session.userId });
  const wishlistCount = wishlist ? wishlist.products.length : 0;
  
  res.render('user/addresses', { 
    addresses, 
    user,
    name: user.firstName,
    cartCount,
    wishlistCount
  });
};

const postAddAddress = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Please sign in to save an address.' });
    }

    const { 
      name,
      label,
      type,
      house_number,
      locality,
      city,
      state,
      pincode,
      phone_number,
      isDefault 
    } = req.body;

    // Validate required fields
    if (!name || !house_number || !locality || !city || !state || !pincode || !phone_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, house number, locality, city, state, pincode and phone number are required.' 
      });
    }

    // Validate name (2-50 characters, letters and spaces only)
    const nameRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name must be 2-50 characters long and contain only letters and spaces.' 
      });
    }

    // Validate phone number (10 digits, Indian format)
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(phone_number.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit Indian phone number starting with 6-9.' 
      });
    }

    // Validate pincode (6 digits)
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode.toString().trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 6-digit pincode.' 
      });
    }

    // Validate city and state (letters, spaces, and common punctuation)
    const locationRegex = /^[a-zA-Z\s\-\.]{2,50}$/;
    if (!locationRegex.test(city.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'City name must be 2-50 characters and contain only letters, spaces, hyphens, and dots.' 
      });
    }

    if (!locationRegex.test(state.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'State name must be 2-50 characters and contain only letters, spaces, hyphens, and dots.' 
      });
    }

    // Validate house number and locality (alphanumeric with common punctuation)
    const addressRegex = /^[a-zA-Z0-9\s\-\.\,\/\#]{1,100}$/;
    if (!addressRegex.test(house_number.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'House number contains invalid characters. Use only letters, numbers, spaces, and common punctuation.' 
      });
    }

    if (!addressRegex.test(locality.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Locality contains invalid characters. Use only letters, numbers, spaces, and common punctuation.' 
      });
    }

    // Normalize type field
    const normalizeType = (value = '') => {
      const normalized = value.toString().trim().toUpperCase();
      const allowed = ['HOME', 'WORK', 'OTHER'];
      if (allowed.includes(normalized)) return normalized;
      return 'HOME';
    };

    // Check if this is the first address (should be default)
    const addressCount = await Address.countDocuments({ user_id: req.session.userId });
    const shouldBeDefault = addressCount === 0 || isDefault === "on" || isDefault === true;

    const newAddress = {
      user_id: req.session.userId,
      name: name.trim(),
      label: label?.trim() || 'Home',
      type: normalizeType(type || label),
      house_number: house_number.trim(),
      locality: locality.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: Number(pincode),
      phone_number: phone_number.trim(),
      isDefault: shouldBeDefault
    };

    await Address.create(newAddress);

    return res.json({ success: true, message: 'Address added successfully!' });

  } catch (error) {
    console.error("❌ Error adding address:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Unable to save address at the moment. Please check your information and try again." 
    });
  }
};


const getEditAddress = async (req, res) => {
  if (!req.session || !req.session.userId) 
    return res.redirect('/login');
  
  const address = await Address.findOne({ _id: req.params.id, user_id: req.session.userId }).lean();
  
  if (!address) 
    return res.redirect('/addresses');
  
  res.render('user/addressForm', { address, action: 'Edit' });
};

const postEditAddress = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Please sign in to edit address.' });
    }

    const { 
      name,
      label,
      type,
      house_number,
      locality,
      city,
      state,
      pincode,
      phone_number 
    } = req.body;

    // Validate required fields
    if (!name || !house_number || !locality || !city || !state || !pincode || !phone_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, house number, locality, city, state, pincode and phone number are required.' 
      });
    }

    // Validate name (2-50 characters, letters and spaces only)
    const nameRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name must be 2-50 characters long and contain only letters and spaces.' 
      });
    }

    // Validate phone number (10 digits, Indian format)
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(phone_number.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit Indian phone number starting with 6-9.' 
      });
    }

    // Validate pincode (6 digits)
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode.toString().trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 6-digit pincode.' 
      });
    }

    // Validate city and state (letters, spaces, and common punctuation)
    const locationRegex = /^[a-zA-Z\s\-\.]{2,50}$/;
    if (!locationRegex.test(city.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'City name must be 2-50 characters and contain only letters, spaces, hyphens, and dots.' 
      });
    }

    if (!locationRegex.test(state.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'State name must be 2-50 characters and contain only letters, spaces, hyphens, and dots.' 
      });
    }

    // Validate house number and locality (alphanumeric with common punctuation)
    const addressRegex = /^[a-zA-Z0-9\s\-\.\,\/\#]{1,100}$/;
    if (!addressRegex.test(house_number.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'House number contains invalid characters. Use only letters, numbers, spaces, and common punctuation.' 
      });
    }

    if (!addressRegex.test(locality.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Locality contains invalid characters. Use only letters, numbers, spaces, and common punctuation.' 
      });
    }

    // Normalize type field
    const normalizeType = (value = '') => {
      const normalized = value.toString().trim().toUpperCase();
      const allowed = ['HOME', 'WORK', 'OTHER'];
      if (allowed.includes(normalized)) return normalized;
      return 'HOME';
    };

    const address = await Address.findOne({ _id: req.params.id, user_id: req.session.userId });
    
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }

    await Address.findOneAndUpdate(
      { _id: req.params.id, user_id: req.session.userId }, 
      {
        name: name.trim(),
        label: label?.trim() || 'Home',
        type: normalizeType(type || label),
        house_number: house_number.trim(),
        locality: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: Number(pincode),
        phone_number: phone_number.trim()
      }
    );

    return res.json({ success: true, message: 'Address updated successfully!' });

  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Unable to update address at the moment. Please check your information and try again.' 
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const address = await Address.findOne({ _id: req.params.id, user_id: req.session.userId });
    
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    const isDefault = address.isDefault;
    
    await Address.deleteOne({ _id: req.params.id, user_id: req.session.userId });
    
    // If deleted address was default, set another address as default
    if (isDefault) {
      const anotherAddress = await Address.findOne({ user_id: req.session.userId });
      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      }
    }
    
    return res.json({ success: true, message: 'Address deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete address. Please try again.' });
  }
};

const setDefaultAddress = async (req, res) => {
  if (!req.session || !req.session.userId) 
    return res.redirect('/login');
  
  try {
    
    await Address.updateMany(
      { user_id: req.session.userId },
      { $set: { isDefault: false } }
    );
    
  
    await Address.findOneAndUpdate(
      { _id: req.params.id, user_id: req.session.userId },
      { $set: { isDefault: true } }
    );
    
    req.flash('success', 'Default address updated successfully');
    res.redirect('/addresses');
  } catch (error) {
    req.flash('error', 'Could not set default address');
    res.redirect('/addresses');
  }
};

module.exports = {
   getAddresses,
   postAddAddress,
   getEditAddress,
   postEditAddress,
   deleteAddress,
   setDefaultAddress 
}