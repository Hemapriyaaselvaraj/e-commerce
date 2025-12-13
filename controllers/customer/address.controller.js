const Address = require('../../models/addressModel');
const userModel = require('../../models/userModel');

const getAddresses = async (req, res) => {
  if (!req.session || !req.session.userId) 
    return res.redirect('/login');
  
  const addresses = await Address.find({ user_id: req.session.userId }).lean();
  const user = await userModel.findById(req.session.userId).lean();
  
  res.render('user/addresses', { addresses, user });
};

const postAddAddress = async (req, res) => {
  try {
    
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
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

    
    if (!name || !house_number || !locality || !city || !state || !pincode || !phone_number) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const newAddress = {
      user_id: req.session.userId,
      name,
      label: label || 'Home',
      type: type || 'HOME',
      house_number,
      locality,
      city,
      state,
      pincode,
      phone_number,
      isDefault: isDefault === "on" || isDefault === true ? true : false
    };

    await Address.create(newAddress);

    return res.json({ success: true, message: 'Address added successfully' });

  } catch (error) {
    console.error("❌ Error adding address:", error);
    console.error("❌ Error stack:", error.stack);
    return res.status(500).json({ success: false, message: error.message || "Server error while adding address" });
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
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
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const address = await Address.findOne({ _id: req.params.id, user_id: req.session.userId });
    
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await Address.findOneAndUpdate(
      { _id: req.params.id, user_id: req.session.userId }, 
      {
        name,
        label: label || 'Home',
        type: type || 'HOME',
        house_number,
        locality,
        city,
        state,
        pincode,
        phone_number
      }
    );

    return res.json({ success: true, message: 'Address updated successfully' });

  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({ success: false, message: 'Failed to update address. Please try again.' });
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