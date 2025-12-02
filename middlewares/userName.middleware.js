const userModel = require('../models/userModel');

const attachUserName = async (req, res, next) => {
  try {
    if (req.session?.userId) {
      const user = await userModel.findById(req.session.userId);
      if (user) {
        res.locals.name = user.firstName + " " + user.lastName;
      }
    }
    next(); 
  } catch (err) {
    console.error("Middleware error:", err);
    next();
  }
};

module.exports = attachUserName;