const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile_pictures",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 400, height: 400, crop: "fill", quality: "auto" }
    ]
  },
});

// File filter for additional validation
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    // Check file size (5MB limit)
    if (file.size && file.size > 5 * 1024 * 1024) {
      return cb(new Error('File size too large. Maximum size is 5MB.'), false);
    }
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPG, JPEG, PNG, WebP)'), false);
  }
};

const uploadProfile = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  }
});

module.exports = uploadProfile;
