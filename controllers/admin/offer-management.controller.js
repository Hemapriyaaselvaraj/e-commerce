const Offer = require('../../models/offerModel');
const Product = require('../../models/productModel');
const Category = require('../../models/productCategoryModel');
const User = require('../../models/userModel');

const getOffersList = async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("product")
      .populate("category")
      .lean();

    const user = await User.findById(req.session.userId);
    const name = user ? user.firstName : 'Admin';

    res.render("admin/offersList", { offers, name });

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

    const flashError = req.flash("error");
    const error = flashError.length > 0 ? flashError[0] : null;

    res.render("admin/offerForm", {
      name,
      products,
      categories,
      offer: null,
      error
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

     const existing = await Offer.findOne({ offerName });
    if (existing) {
      req.session.error = `Offer name "${offerName}" already exists.`;
      return res.redirect("/admin/add-offer");
    }

    const productArray = product
      ? Array.isArray(product) ? product : [product]
      : [];

    const categoryArray = category
      ? Array.isArray(category) ? category : [category]
      : [];

    await Offer.create({
      offerName,
      discountPercentage,
      product: productArray,
      category: categoryArray,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo)
    });

    res.redirect("/admin/offers");

  } catch (error) {
    console.error("Error creating offer:", error);

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

    res.render("admin/offerForm", {
      name,
      products,
      categories,
      offer,
      error: null
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

    product = product ? (Array.isArray(product) ? product : [product]) : [];
    category = category ? (Array.isArray(category) ? category : [category]) : [];

    await Offer.findByIdAndUpdate(offerId, {
      offerName,
      discountPercentage,
      product,
      category,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo)
    });

    res.redirect("/admin/offers");

  } catch (error) {
    console.error("Edit offer error:", error);
    res.status(500).send("Server Error");
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
    
    // Check if request expects JSON response (for DELETE requests)
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
