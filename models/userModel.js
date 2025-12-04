const mongoose = require("mongoose");

const UserRoles = Object.freeze({
  ADMIN: "admin",
  USER: "user",
});

const userSchema = new mongoose.Schema(
  {
    
    googleId: {
      type: String,
      
    },
    email: {
      type: String,
      required: true,
      unique: true, 
    },
    password: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRoles),
      default: UserRoles.USER,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: "/images/default-profile.png",
    },
    signupMethod: {
      type: String,
      enum: ["email", "google"],
      required: true,
      default: "email",
    },
    wallet: {
      type: Number,
      default: 0,
    },
    referralCode: { 
      type: String, 
      unique: true 
    },
    referredBy: { 
      type: String, 
      default: null 
    },
    referralEarnings: {
       type: Number, 
       default: 0 
      },
    isReferralRewarded: {
       type: Boolean, 
       default: false
       }, // avoid double reward

  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("user", userSchema);
