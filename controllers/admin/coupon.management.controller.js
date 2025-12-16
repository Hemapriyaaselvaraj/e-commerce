const Coupon = require("../../models/couponModel");

const getCoupons = async(req,res) => {
    try{
        const coupons = await Coupon.find().lean();
         res.render("admin/couponList", { coupons });
    }catch(err){
        console.error("Coupon list error:", err);
      res.status(500).send("Server Error");
    }
}

const getAddCoupon = async (req, res) => {
    try {
      res.render("admin/couponForm", { coupon: null });
    } catch (error) {
      console.error("Error loading coupon form:", error);
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

      if (!code || !code.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code is required' 
        });
      }

      if (!discountValue || discountValue <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Discount value must be greater than 0' 
        });
      }

      if (discountType === 'PERCENTAGE' && discountValue > 100) {
        return res.status(400).json({ 
          success: false, 
          message: 'Percentage discount cannot exceed 100%' 
        });
      }

      if (code.trim().length < 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code must be at least 3 characters long' 
        });
      }

      if (!validFrom || !validTo) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid from and valid to dates are required' 
        });
      }

      if (new Date(validTo) <= new Date(validFrom)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid to date must be after valid from date' 
        });
      }

      const existingCoupon = await Coupon.findOne({ 
        code: code.trim().toUpperCase() 
      });

      if (existingCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code already exists. Please choose a different code.' 
        });
      }

      await Coupon.create({
        code: code.trim().toUpperCase(),
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      });

      res.json({ 
        success: true, 
        message: 'Coupon created successfully' 
      });
    } catch (err) {
      console.error('Error creating coupon:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Please try again.' 
      });
    }
  }

  const getEditCoupon = async (req, res) => {
    try {
      const coupon = await Coupon.findById(req.params.id).lean();
      if (!coupon) return res.status(404).send("Coupon not found");

      res.render("admin/couponForm", { coupon }); 
    } catch (err) {
      console.error("Edit coupon error:", err);
      res.status(500).send("Server error");
    }
  }

  const deleteCoupon = async (req, res) => {
    try {
      await Coupon.findByIdAndDelete(req.params.id);
      
      if (req.method === 'DELETE') {
        return res.json({ success: true, message: 'Coupon deleted successfully' });
      }
      
      res.redirect("/admin/coupons");
    } catch (err) {
      console.error('Error deleting coupon:', err);
      if (req.method === 'DELETE') {
        return res.status(500).json({ success: false, message: 'Failed to delete coupon' });
      }
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

      
      if (!code || !code.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code is required' 
        });
      }

      if (!discountValue || discountValue <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Discount value must be greater than 0' 
        });
      }

      if (discountType === 'PERCENTAGE' && discountValue > 100) {
        return res.status(400).json({ 
          success: false, 
          message: 'Percentage discount cannot exceed 100%' 
        });
      }

      if (code.trim().length < 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code must be at least 3 characters long' 
        });
      }

      if (!validFrom || !validTo) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid from and valid to dates are required' 
        });
      }

      if (new Date(validTo) <= new Date(validFrom)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid to date must be after valid from date' 
        });
      }

      const existingCoupon = await Coupon.findOne({ 
        code: code.trim().toUpperCase(),
        _id: { $ne: id }
      });

      if (existingCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code already exists. Please choose a different code.' 
        });
      }

      const updatedCoupon = await Coupon.findByIdAndUpdate(id, {
        code: code.trim().toUpperCase(),
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxDiscount,
        validFrom,
        validTo,
        usageLimitPerUser
      }, { new: true });

      if (!updatedCoupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Coupon not found' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Coupon updated successfully', 
        coupon: updatedCoupon 
      });
    } catch (err) {
      console.error("Error updating coupon:", err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Please try again.' 
      });
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