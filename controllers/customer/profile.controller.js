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

const getReferAndEarn = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await userModel.findById(userId).lean();
    if (!user) return res.redirect("/user/login");

    // Count referrals
    const totalReferrals = await userModel.countDocuments({ referredBy: userId });

    // Total earnings
    const totalReferralEarnings = totalReferrals * 100;

    // Get the referral code that THIS user entered during signup
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
      appliedReferralCode     // <-- IMPORTANT
    });

  } catch (err) {
    console.log("Refer & Earn page error:", err);
    res.status(500).send("Server error");
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