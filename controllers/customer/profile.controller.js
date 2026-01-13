const userModel = require('../../models/userModel');
const Address = require('../../models/addressModel');

const getProfile = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    const user = await userModel.findById(req.session.userId).lean();
    if (!user) return res.redirect('/login');
    
    const defaultAddress = await Address.findOne({ 
      user_id: req.session.userId,
      isDefault: true 
    }).lean();

    res.render('user/profile', {
      name: user.firstName,
      user,
      defaultAddress
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).render('user/500', { 
      message: 'We\'re having trouble loading your profile right now. Please try refreshing the page or contact support if the problem continues.' 
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    const { firstName, lastName, phoneNumber } = req.body;
    await userModel.findByIdAndUpdate(req.session.userId, {
      firstName,
      lastName,
      phoneNumber
    });
    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    req.flash('error', 'We couldn\'t save your profile changes. Please try again or contact support if the problem continues.');
    res.redirect('/profile/edit');
  }
};

const updateProfileImage = async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please sign in to update your profile picture.' 
      });
    }

    const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url || req.file?.location || null;

    if (!imageUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please select an image file to upload.' 
      });
    }

    await userModel.findByIdAndUpdate(userId, { profileImage: imageUrl });

    return res.json({ 
      success: true, 
      message: 'Your profile picture has been updated successfully!', 
      imageUrl 
    });

  } catch (error) {
    console.error("Error updating profile image:", error);
    return res.status(500).json({
      success: false,
      message: "We're having trouble updating your profile picture. Please try again or contact support if the problem continues."
    });
  }
};

const getEditProfile = async(req,res) => {
  try{
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    
    const user = await userModel.findById(req.session.userId).lean();
    if(!user) return res.redirect('/login');
    
    // Get cart and wishlist counts for navbar
    const Cart = require('../../models/cartModel');
    const Wishlist = require('../../models/wishlistModel');
    
    const cart = await Cart.findOne({ user: req.session.userId });
    const cartCount = cart ? cart.items.length : 0;
    
    const wishlist = await Wishlist.findOne({ user: req.session.userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    
    res.render('user/editProfile', {
      user,
      name: user.firstName,
      cartCount,
      wishlistCount
    });
  } catch (err) {
    console.error('Error loading edit profile:', err);
    res.status(500).render('user/500', { 
      message: 'We\'re having trouble loading the edit profile page. Please try refreshing or contact support if the problem continues.' 
    });
  }
}

const postEditProfile = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      return res.redirect('/login');
    }
    
    const { firstName, lastName, phoneNumber } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !phoneNumber) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
      return res.status(400).send('All fields are required');
    }
    
    // Validate phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
      }
      return res.status(400).send('Please enter a valid 10-digit phone number');
    }
    
    await userModel.findByIdAndUpdate(req.session.userId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim()
    });
    
    if (req.headers['content-type'] === 'application/json') {
      return res.json({ success: true, message: 'Profile updated successfully' });
    }
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ 
        success: false, 
        message: 'Unable to update your profile at the moment. Please check your information and try again.' 
      });
    }
    res.status(500).render('user/500', { 
      message: 'Unable to update your profile at the moment. Please try again later.' 
    });
  }
};

const getReferAndEarn = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await userModel.findById(userId).lean();
    if (!user) return res.redirect("/user/login");

    const totalReferrals = await userModel.countDocuments({ referredBy: userId });

    const totalReferralEarnings = totalReferrals * 100;

    let appliedReferralCode = null;

    if (user.referredBy) {
      const referrer = await userModel.findById(user.referredBy).lean();
      if (referrer) {
        appliedReferralCode = referrer.referralCode;
      }
    }

    res.render("user/referAndEarn", {
      user,
      totalReferrals,
      totalReferralEarnings,
      appliedReferralCode     
    });

  } catch (error) {
    console.error("Refer & Earn page error:", error);
    res.status(500).render('user/500', { 
      message: 'Unable to load the refer & earn page at the moment. Please try again later.' 
    });
  }
};


module.exports = {
    getProfile,
    updateProfile,
    updateProfileImage,
    getEditProfile,
    postEditProfile,
    getReferAndEarn
}