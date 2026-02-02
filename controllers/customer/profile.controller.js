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

    // Get success message from session
    const success = req.session.success || null;
    delete req.session.success;

    res.render('user/profile', {
      name: user.firstName,
      user,
      defaultAddress,
      success
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

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please select an image file to upload.' 
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file type. Please upload JPG, JPEG, PNG, or WebP images only.' 
      });
    }

    // Validate file size (5MB limit)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        message: 'File size too large. Please upload an image smaller than 5MB.' 
      });
    }

    const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url || req.file?.location || null;

    if (!imageUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Failed to upload image. Please try again.' 
      });
    }

    // Update user profile image
    await userModel.findByIdAndUpdate(userId, { profileImage: imageUrl });

    return res.json({ 
      success: true, 
      message: 'Your profile picture has been updated successfully!', 
      imageUrl 
    });

  } catch (error) {
    console.error("Error updating profile image:", error);
    
    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "File size too large. Please upload an image smaller than 5MB."
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: "Too many files. Please upload only one image at a time."
      });
    }
    
    if (error.message && error.message.includes('Only image files are allowed')) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Please upload JPG, JPEG, PNG, or WebP images only."
      });
    }

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
    
    // Comprehensive validation
    const errors = [];
    
    // First Name validation
    if (!firstName || !firstName.trim()) {
      errors.push('First name is required');
    } else if (firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    } else if (firstName.trim().length > 50) {
      errors.push('First name cannot exceed 50 characters');
    } else if (!/^[a-zA-Z\s]+$/.test(firstName.trim())) {
      errors.push('First name can only contain letters and spaces');
    }
    
    // Last Name validation
    if (!lastName || !lastName.trim()) {
      errors.push('Last name is required');
    } else if (lastName.trim().length < 1) {
      errors.push('Last name is required');
    } else if (lastName.trim().length > 50) {
      errors.push('Last name cannot exceed 50 characters');
    } else if (!/^[a-zA-Z\s]+$/.test(lastName.trim())) {
      errors.push('Last name can only contain letters and spaces');
    }
    
    // Phone Number validation
    if (!phoneNumber || !phoneNumber.trim()) {
      errors.push('Phone number is required');
    } else {
      const cleanPhone = phoneNumber.trim().replace(/\D/g, ''); // Remove non-digits
      if (cleanPhone.length !== 10) {
        errors.push('Phone number must be exactly 10 digits');
      } else if (!/^[6-9]/.test(cleanPhone)) {
        errors.push('Phone number must start with 6, 7, 8, or 9');
      } else if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
        errors.push('Please enter a valid Indian mobile number');
      }
    }
    
    // Check for duplicate phone number
    if (errors.length === 0) {
      const existingUser = await userModel.findOne({ 
        phoneNumber: phoneNumber.trim(),
        _id: { $ne: req.session.userId }
      });
      
      if (existingUser) {
        errors.push('This phone number is already registered with another account');
      }
    }
    
    // Return validation errors
    if (errors.length > 0) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ 
          success: false, 
          message: errors[0], // Return first error for simplicity
          errors: errors 
        });
      }
      return res.status(400).send(errors[0]);
    }
    
    // Update user profile
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

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please sign in to change your password.'
      });
    }

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match.'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password.'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter.'
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter.'
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one number.'
      });
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one special character.'
      });
    }

    // Get user and verify current password
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Check current password
    const bcrypt = require('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await userModel.findByIdAndUpdate(userId, { password: hashedNewPassword });

    return res.json({
      success: true,
      message: 'Password changed successfully!'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while changing password. Please try again.'
    });
  }
};

module.exports = {
    getProfile,
    updateProfile,
    updateProfileImage,
    getEditProfile,
    postEditProfile,
    getReferAndEarn,
    changePassword
}