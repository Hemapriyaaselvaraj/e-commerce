const Coupon = require("../../models/couponModel");
const { formatDate, formatDateTime, formatDateForInput } = require("../../utils/dateFormatter");

const getCoupons = async(req,res) => {
    try{
        const coupons = await Coupon.find().lean();
         res.render("admin/couponList", { 
           coupons,
           formatDate,
           formatDateTime,
           formatDateForInput
         });
    }catch(err){
        console.error("Coupon list error:", err);
      res.status(500).send("Server Error");
    }
}

const getAddCoupon = async (req, res) => {
    try {
      res.render("admin/couponForm", { 
        coupon: null,
        formatDate,
        formatDateTime,
        formatDateForInput
      });
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
          message: 'Please enter a valid coupon code. The code cannot be empty or contain only spaces.' 
        });
      }

      if (!discountValue || discountValue <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please enter a discount value greater than 0.' 
        });
      }

      if (discountType === 'PERCENTAGE' && discountValue > 100) {
        return res.status(400).json({ 
          success: false, 
          message: 'Percentage discount cannot exceed 100%. Please enter a value between 1 and 100.' 
        });
      }

      // Business logic validation: For fixed amount coupons, minimum purchase must be higher than discount
      if (discountType === 'FLAT') {
        const minPurchase = parseFloat(minimumPurchase) || 0;
        if (minPurchase <= discountValue) {
          return res.status(400).json({ 
            success: false, 
            message: 'For fixed amount coupons, minimum purchase amount must be greater than the discount amount to prevent losses. Please set minimum purchase higher than ₹' + discountValue + '.' 
          });
        }
      }

      if (code.trim().length < 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code must be at least 3 characters long.' 
        });
      }

      if (!validFrom || !validTo) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid from and valid to dates are required' 
        });
      }

      // Date validation with flexible rules (same as offers)
      const fromDate = new Date(validFrom);
      const toDate = new Date(validTo);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if dates are valid
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format provided' 
        });
      }

      // Check if end date is after start date
      if (toDate <= fromDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid to date must be after valid from date' 
        });
      }

      // New validation: To date must be in the future (after today)
      if (toDate <= today) {
        return res.status(400).json({ 
          success: false, 
          message: 'The end date must be in the future. Please select a date after today.' 
        });
      }

      // From date can be in past or present (no restriction)
      // This allows creating coupons that started in the past but are still active

      // Check minimum validity period (at least 1 day)
      const daysDifference = (toDate - fromDate) / (1000 * 60 * 60 * 24);
      if (daysDifference < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon must be valid for at least 1 day' 
        });
      }

      // Check maximum validity period (not more than 1 year)
      if (daysDifference > 365) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon validity period cannot exceed 1 year (365 days)' 
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
        discountValue: parseFloat(discountValue),
        minimumPurchase: parseFloat(minimumPurchase) || 0,
        maxDiscount: parseFloat(maxDiscount) || null,
        validFrom: fromDate,
        validTo: toDate,
        usageLimitPerUser: parseInt(usageLimitPerUser) || 1
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

      res.render("admin/couponForm", { 
        coupon,
        formatDate,
        formatDateTime,
        formatDateForInput
      }); 
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

      // Business logic validation: For fixed amount coupons, minimum purchase must be higher than discount
      if (discountType === 'FLAT') {
        const minPurchase = parseFloat(minimumPurchase) || 0;
        if (minPurchase <= discountValue) {
          return res.status(400).json({ 
            success: false, 
            message: 'For fixed amount coupons, minimum purchase amount must be greater than the discount amount to prevent losses. Please set minimum purchase higher than ₹' + discountValue + '.' 
          });
        }
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

      // Date validation with flexible rules (same as offers)
      const fromDate = new Date(validFrom);
      const toDate = new Date(validTo);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if dates are valid
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format provided' 
        });
      }

      // Check if end date is after start date
      if (toDate <= fromDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid to date must be after valid from date' 
        });
      }

      // New validation: To date must be in the future (after today)
      if (toDate <= today) {
        return res.status(400).json({ 
          success: false, 
          message: 'The end date must be in the future. Please select a date after today.' 
        });
      }

      // From date can be in past or present (no restriction for editing)
      // This allows editing coupons that started in the past but are still active

      // Check minimum validity period (at least 1 day)
      const daysDifference = (toDate - fromDate) / (1000 * 60 * 60 * 24);
      if (daysDifference < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon must be valid for at least 1 day' 
        });
      }

      // Check maximum validity period (not more than 1 year)
      if (daysDifference > 365) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon validity period cannot exceed 1 year (365 days)' 
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