const userModel = require("../../models/userModel");


const getDashboard = async (req, res) => {
  try {
    const user = await userModel.findOne({ _id: req.session.userId });

    if (!user) {
      return res.redirect('/user/login'); 
    }
   
    return res.render("admin/dashboard", { name: user.firstName });

  } catch (error) {
    console.error("Dashboard error:", error);
    return res.redirect('/user/login'); 
  }
};

module.exports = {getDashboard}