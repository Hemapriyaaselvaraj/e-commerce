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
    res.status(500).send('Error loading profile');
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
    res.status(500).send('Error updating profile');
  }
};

const updateProfileImage = async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url || req.file?.location || null;

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'No image received' });
    }

    await userModel.findByIdAndUpdate(userId, { profileImage: imageUrl });

    return res.json({ success: true, message: 'Profile image updated', imageUrl });

  } catch (error) {
    console.error("Error updating profile image:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
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
    res.render('user/editProfile', {user});
}catch (err) {
    res.status(500).send('Error loading edit profile');
  }

}

const postEditProfile = async (req, res) => {
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
    res.status(500).send('Error updating profile');
  }
};


module.exports = {
    getProfile,
    updateProfile,
    updateProfileImage,
    getEditProfile,
    postEditProfile
}