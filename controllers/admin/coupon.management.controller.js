const Coupon = require("../../models/couponModel");

const getCoupons = async(req,res) => {
    try{
        const coupons = await Coupon.find().lean();
         res.render("admin/couponList", { coupons });
    }catch(err){
        console.log(err);
      res.status(500).send("Server Error");
    }
}

const getAddCoupon = async (req, res) => {
    try {
      // Empty coupon → for create mode
      res.render("admin/couponForm", { coupon: null });
    } catch (error) {
      console.log("Error loading coupon form:", error);
      res.status(500).send("Server error");
    }
  }

  const postAddCoupon = async (req, res) => {
    try {
      const {
        code,
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      } = req.body;

      await Coupon.create({
        code,
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      });

      res.redirect("/admin/coupons");
    } catch (err) {
      console.log(err);
      res.status(500).send("Server Error");
    }
  }

  const getEditCoupon = async (req, res) => {
    try {
      const coupon = await Coupon.findById(req.params.id).lean();
      if (!coupon) return res.status(404).send("Coupon not found");

      res.render("admin/couponForm", { coupon }); 
    } catch (err) {
      console.log(err);
      res.status(500).send("Server error");
    }
  }

  const deleteCoupon = async (req, res) => {
    try {
      await Coupon.findByIdAndDelete(req.params.id);
      res.redirect("/admin/coupons");
    } catch (err) {
      console.log(err);
      res.status(500).send("Server Error");
    }
  }

const postEditCoupon = async (req, res) => {
    try {
      const id = req.params.id;

      const {
        code,
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      } = req.body;

      await Coupon.findByIdAndUpdate(id, {
        code,
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      });

      res.redirect("/admin/coupons");
    } catch (err) {
      console.log(err);
      res.status(500).send("Server Error");
    }
  }

module.exports = {
    getCoupons,
    getAddCoupon,
    postAddCoupon,
    getEditCoupon,
    postEditCoupon,
     deleteCoupon 
}