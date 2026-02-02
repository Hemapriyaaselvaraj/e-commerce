const Offer = require('../../models/offerModel');
const Product = require('../../models/productModel');
const Category = require('../../models/productCategoryModel');
const User = require('../../models/userModel');
const { formatDate, formatDateTime, formatDateForInput } = require("../../utils/dateFormatter");

const getOffersList = async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("product")
      .populate("category")
      .lean();

    const user = await User.findById(req.session.userId);
    const name = user ? user.firstName : 'Admin';

    // Get success messages for the list page
    const success = req.session.success || null;
    
    // Clear success messages after getting them
    delete req.session.success;

    res.render("admin/offersList", { 
      offers, 
      name, 
      success,
      formatDate,
      formatDateTime,
      formatDateForInput
    });

  } catch (error) {
    console.error("Offers list error:", error);
    res.status(500).send("Server Error");
  }
};


const getAddOffer = async (req, res) => {
  try {
    const products = await Product.find().lean();
    const categories = await Category.find().lean();

    const user = await User.findById(req.session.userId);
    const name = user ? user.firstName : 'Admin';

    // Only get error messages for the form (not success messages)
    const error = req.session.error || null;
    
    // Clear only error messages
    delete req.session.error;
    // Don't clear success messages here - they should be shown on the list page

    res.render("admin/offerForm", {
      name,
      products,
      categories,
      offer: null,
      error,
      success: null, // Never pass success messages to the form
      formatDate,
      formatDateTime,
      formatDateForInput
    });

  } catch (error) {
    console.error("Add offer form error:", error);
    res.status(500).send("Server Error");
  }
};

const postAddOffer = async (req, res) => {
  try {
    const {
      offerName,
      discountPercentage,
      product,
      category,
      validFrom,
      validTo
    } = req.body;

    // Validate required fields
    if (!offerName || !offerName.trim()) {
      req.session.error = "Please enter a valid offer name. The name cannot be empty or contain only spaces.";
      return res.redirect("/admin/add-offer");
    }

    if (!discountPercentage || parseFloat(discountPercentage) <= 0 || parseFloat(discountPercentage) > 90) {
      req.session.error = "Please enter a discount percentage between 1% and 90%.";
      return res.redirect("/admin/add-offer");
    }

    if (!validFrom || !validTo) {
      req.session.error = "Please select both start and end dates for the offer validity period.";
      return res.redirect("/admin/add-offer");
    }

    // Date validation
    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if dates are valid
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      req.session.error = "Please enter valid dates in the correct format.";
      return res.redirect("/admin/add-offer");
    }

    // Check if end date is after start date
    if (toDate <= fromDate) {
      req.session.error = "The end date must be after the start date. Please check your date selection.";
      return res.redirect("/admin/add-offer");
    }

    // New validation: To date must be in the future (after today)
    if (toDate <= today) {
      req.session.error = "The end date must be in the future. Please select a date after today.";
      return res.redirect("/admin/add-offer");
    }

    // From date can be in past or present (no restriction)
    // This allows creating offers that started in the past but are still active

    // Note: Removed past date validation to allow creating offers for any date range
    // This is useful for testing, historical data, or backdated promotions

    // Check minimum validity period (at least 1 day)
    const daysDifference = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDifference < 1) {
      req.session.error = "The offer must be valid for at least 1 day. Please extend the validity period.";
      return res.redirect("/admin/add-offer");
    }

    // Check maximum validity period (not more than 1 year)
    if (daysDifference > 365) {
      req.session.error = "The offer validity period cannot exceed 1 year (365 days). Please reduce the validity period.";
      return res.redirect("/admin/add-offer");
    }

    // Check for duplicate offer name
    const existing = await Offer.findOne({ 
      offerName: { $regex: new RegExp(`^${offerName.trim()}$`, 'i') }
    });
    if (existing) {
      req.session.error = `An offer with the name "${offerName.trim()}" already exists. Please choose a different name.`;
      return res.redirect("/admin/add-offer");
    }

    const productArray = product
      ? Array.isArray(product) ? product : [product]
      : [];

    const categoryArray = category
      ? Array.isArray(category) ? category : [category]
      : [];

    await Offer.create({
      offerName: offerName.trim(),
      discountPercentage: parseFloat(discountPercentage),
      product: productArray,
      category: categoryArray,
      validFrom: fromDate,
      validTo: toDate
    });

    req.session.success = `Offer "${offerName.trim()}" created successfully! It is now available for customers.`;
    res.redirect("/admin/offers");

  } catch (error) {
    console.error("Error creating offer:", error);
    req.session.error = "We couldn't create the offer due to a technical issue. Please try again or contact support if the problem continues.";
    res.redirect("/admin/add-offer");
  }
};


const getEditOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId).lean();
    if (!offer) return res.status(404).send("Offer not found");

    const products = await Product.find().lean();
    const categories = await Category.find().lean();

    const user = await User.findById(req.session.userId);
    const name = user ? user.firstName : 'Admin';

    // Get only error messages for edit form (not success messages)
    const error = req.session.error || null;
    
    // Clear only error messages (keep success messages for offers list)
    delete req.session.error;

    res.render("admin/offerForm", {
      name,
      products,
      categories,
      offer,
      error,
      success: null, // Never show success messages on edit form load
      formatDate,
      formatDateTime,
      formatDateForInput
    });

  } catch (error) {
    console.error("Edit offer form error:", error);
    res.status(500).send("Server Error");
  }
};

const postEditOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    let {
      offerName,
      discountPercentage,
      product,
      category,
      validFrom,
      validTo
    } = req.body;

    // Validate required fields
    if (!offerName || !offerName.trim()) {
      req.session.error = "Offer name is required and cannot be empty";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    if (!discountPercentage || parseFloat(discountPercentage) <= 0 || parseFloat(discountPercentage) > 90) {
      req.session.error = "Discount percentage must be between 1 and 90";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    if (!validFrom || !validTo) {
      req.session.error = "Valid from and valid to dates are required";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // Date validation
    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);

    // Check if dates are valid
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      req.session.error = "Invalid date format provided";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // Check if end date is after start date
    if (toDate <= fromDate) {
      req.session.error = "Valid to date must be after valid from date";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // New validation: To date must be in the future (after today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (toDate <= today) {
      req.session.error = "The end date must be in the future. Please select a date after today.";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // From date can be in past or present (no restriction for editing)

    // Check minimum validity period (at least 1 day)
    const daysDifference = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDifference < 1) {
      req.session.error = "Offer must be valid for at least 1 day";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // For editing offers, we're more flexible with past dates
    // Only check if the offer hasn't expired yet
    if (toDate < new Date().setHours(0, 0, 0, 0)) {
      req.session.error = "Cannot edit an offer that has already expired";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // Check maximum validity period (not more than 1 year)
    if (daysDifference > 365) {
      req.session.error = "Offer validity period cannot exceed 1 year (365 days)";
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    // Check for duplicate offer name (excluding current offer)
    const existing = await Offer.findOne({ 
      offerName: { $regex: new RegExp(`^${offerName.trim()}$`, 'i') },
      _id: { $ne: offerId }
    });
    if (existing) {
      req.session.error = `Offer name "${offerName.trim()}" already exists`;
      return res.redirect(`/admin/edit-offer/${offerId}`);
    }

    product = product ? (Array.isArray(product) ? product : [product]) : [];
    category = category ? (Array.isArray(category) ? category : [category]) : [];

    const updatedOffer = await Offer.findByIdAndUpdate(offerId, {
      offerName: offerName.trim(),
      discountPercentage: parseFloat(discountPercentage),
      product,
      category,
      validFrom: fromDate,
      validTo: toDate
    }, { new: true });

    req.session.success = `Offer "${offerName.trim()}" updated successfully!`;
    res.redirect("/admin/offers");

  } catch (error) {
    console.error("Edit offer error:", error);
    req.session.error = "Error updating offer. Please try again.";
    res.redirect(`/admin/edit-offer/${req.params.id}`);
  }
};


const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    offer.isActive = !offer.isActive;
    await offer.save();

    res.json({ success: true, isActive: offer.isActive });

  } catch (error) {
    console.error("Toggle offer status error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    
    if (req.method === 'DELETE') {
      return res.json({ success: true, message: 'Offer deleted successfully' });
    }
    
    res.redirect("/admin/offers");

  } catch (error) {
    console.error('Error deleting offer:', error);
    if (req.method === 'DELETE') {
      return res.status(500).json({ success: false, message: 'Failed to delete offer' });
    }
    res.status(500).send("Server Error");
  }
};



module.exports = {
  getOffersList,
  getAddOffer,
  postAddOffer,
  getEditOffer,
  postEditOffer,
  toggleOfferStatus,
  deleteOffer
};
