const userModel = require("../../models/userModel");
const productCategoryModel = require("../../models/productCategoryModel");
const productColorModel = require("../../models/productColorModel");
const productSizeModel = require("../../models/productSizeModel");
const productTypeModel = require("../../models/productTypeModel");
const Product = require("../../models/productModel");
const ProductVariation = require("../../models/productVariationModel");
const Wishlist = require("../../models/wishlistModel");
const Offer = require("../../models/offerModel");
const { calculateBestOffer } = require("../../utils/offerCalculator");


const productList = async (req, res) => {

  const {
    category: selectedCategory = null,
    type,
    size,
    color,
    price,
    search,
    sort = "newest",
    page = 1
  } = req.query;
  
  const selectedType = [].concat(type || []);
  const selectedSize = [].concat(size || []);
  const selectedColor = [].concat(color || []);
  const selectedPrice = [].concat(price || []);
  const searchText = search?.trim() || "";
  const currentPage = parseInt(page) || 1;
  const pageSize = 10;

  //Build base Mongoose filter object
  const filter = { is_active: true };
  if (selectedCategory) filter.product_category = selectedCategory;
  if (selectedType.length) filter.product_type = { $in: selectedType };
  if (searchText) filter.name = { $regex: searchText, $options: "i" };

  //Filter by variations (size/color)
  let variationProductIds = null;
  if (selectedSize.length || selectedColor.length) {
    const variationFilter = {};
    if (selectedSize.length) variationFilter.product_size = { $in: selectedSize };
    if (selectedColor.length) variationFilter.product_color = { $in: selectedColor };

    const variations = await ProductVariation.find(variationFilter, "product_id").lean();
    variationProductIds = [...new Set(variations.map(v => v.product_id.toString()))];
    if (!variationProductIds.length) {
      // Still need to fetch filter data even when no products match
      const [categories, types, sizesRaw, colors] = await Promise.all([
        productCategoryModel.find({ isActive: true }).lean(),
        productTypeModel.find({ isActive: true }).lean(),
        productSizeModel.find({ isActive: true }).lean(),
        productColorModel.find({ isActive: true }).lean()
      ]);
      
      // Sort sizes numerically
      const sizes = sizesRaw.sort((a, b) => Number(a.size) - Number(b.size));
      const priceRanges = [
        { label: "0 - 500", min: 0, max: 500 },
        { label: "500 - 1000", min: 500, max: 1000 },
        { label: "1000 - 2000", min: 1000, max: 2000 },
        { label: "2000 - 5000", min: 2000, max: 5000 },
        { label: "5000 - 10000", min: 5000, max: 10000 }
      ];
      
      return res.render("user/productList", {
        products: [],
        categories,
        types,
        sizes,
        colors,
        priceRanges,
        selectedCategory,
        selectedType,
        selectedSize,
        selectedColor,
        selectedPrice,
        currentPage: 1,
        totalPages: 0,
        totalResults: 0,
        pageSize,
        sort,
        query: req.query,
        wishlistMap: {}
      });
    }
    filter._id = { $in: variationProductIds };
  }

  // 5. Price filter
  if (selectedPrice.length) {
    const priceConditions = selectedPrice.map(range => {
      const [min, max] = range.split("-");
      const cond = {};
      if (min) cond.$gte = parseFloat(min);
      if (max && max !== "null") cond.$lte = parseFloat(max);
      return cond;
    });
    filter.price = priceConditions.length === 1
      ? priceConditions[0]
      : undefined;
    if (priceConditions.length > 1) {
      filter.$or = priceConditions.map(p => ({ price: p }));
    }
  }

  // 6. Get, sort, and paginate products
  let products = await Product.find(filter).lean();
  
  // Get all active offers with populated category
  const now = new Date();
  const activeOffers = await Offer.find({
    isActive: true,
    validFrom: { $lte: now },
    validTo: { $gte: now }
  })
  .populate('category', 'category')
  .lean();

  // ⭐ Calculate max offer for each product using centralized function
  products.forEach(p => {
    const offerResult = calculateBestOffer(p, activeOffers);
    p.offerDiscount = offerResult.discountPercentage; 
    p.afterDiscountPrice = offerResult.finalPrice;
  });

  products = sortProducts(products, sort);

  const totalResults = products.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  products = products.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 7. Get main product image per product
  const productIds = products.map(p => p._id);
  const images = await ProductVariation.aggregate([
    {
      $match: {
        product_id: { $in: productIds },
        ...(selectedColor.length && { product_color: { $in: selectedColor } })
      }
    },
    {
      $group: {
        _id: "$product_id",
        image: { $first: { $arrayElemAt: ["$images", 0] } }
      }
    }
  ]);
  const imageMap = Object.fromEntries(images.map(i => [i._id.toString(), i.image]));
  products.forEach(p => {
    p.image = imageMap[p._id.toString()] || null;
  });

  // 8. Wishlist map (logged-in user)
  let wishlistMap = {};
  if (req.session?.userId && productIds.length) {
    try {
      const wishlistEntries = await Wishlist.find({
        user_id: req.session.userId,
        product_id: { $in: productIds }
      }).lean();
      wishlistMap = Object.fromEntries(
        wishlistEntries.map(w => [w.product_id.toString(), true])
      );
    } catch (err) {
      console.error("Error fetching wishlist for product list", err);
    }
  }

  const [categories, types, sizesRaw, colors] = await Promise.all([
    productCategoryModel.find({ isActive: true }).lean(),
    productTypeModel.find({ isActive: true }).lean(),
    productSizeModel.find({ isActive: true }).lean(),
    productColorModel.find({ isActive: true }).lean()
  ]);
  
  // Sort sizes numerically
  const sizes = sizesRaw.sort((a, b) => Number(a.size) - Number(b.size));
  const priceRanges = [
    { label: "0 - 500", min: 0, max: 500 },
    { label: "500 - 1000", min: 500, max: 1000 },
    { label: "1000 - 2000", min: 1000, max: 2000 },
    { label: "2000 - 5000", min: 2000, max: 5000 },
    { label: "5000 - 10000", min: 5000, max: 10000 }
  ];

  return res.render("user/productList", {
    products,
    categories,
    types,
    sizes,
    colors,
    priceRanges,
    selectedCategory,
    selectedType,
    selectedSize,
    selectedColor,
    selectedPrice,
    currentPage,
    totalPages,
    totalResults,
    pageSize,
    sort,
    query: req.query,
    wishlistMap
  });

  function sortProducts(products, order) {
    switch (order) {
      case "asc":
        return products.sort((a, b) => a.afterDiscountPrice - b.afterDiscountPrice);
      case "desc":
        return products.sort((a, b) => b.afterDiscountPrice - a.afterDiscountPrice);
      case "nameAsc":
        return products.sort((a, b) => a.name.localeCompare(b.name));
      case "nameDesc":
        return products.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }
};

const productDetail = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Validate if productId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).render('user/404');
    }
    
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).render('user/404');
    }

    const now = new Date();
    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    })
    .populate('category', 'category')
    .lean();

    // ⭐ Use centralized offer calculation for consistency
    const offerResult = calculateBestOffer(product, activeOffers);
    product.offerDiscount = offerResult.discountPercentage;

    const variations = await ProductVariation.find({ product_id: productId }).lean();

  
    let initialImages = [];
    let selectedSize = null;
    let selectedColor = null;
    let selectedVariationId = null;
    let selectedStock = 0; 

    if (variations && variations.length) {
      const defaultVariation = variations.find(v => v.stock_quantity > 0) || variations[0];

      if (defaultVariation) {
        initialImages = Array.isArray(defaultVariation.images) ? defaultVariation.images.slice() : [];
        selectedSize = defaultVariation.product_size;
        selectedColor = defaultVariation.product_color;
        selectedVariationId = defaultVariation._id;
        selectedStock = defaultVariation.stock_quantity || 0; 
      }
    }

    const sizes = [];
    const colors = [];
    variations.forEach(v => {
      if (!sizes.includes(v.product_size)) sizes.push(v.product_size);
      if (!colors.includes(v.product_color)) colors.push(v.product_color);
    });

  
    const sizeColorMap = {};
    variations.forEach(v => {
      if (!sizeColorMap[v.product_size]) sizeColorMap[v.product_size] = [];
      sizeColorMap[v.product_size].push({
        color: v.product_color,
        images: v.images
      });
    });

    // Related products
    const relatedProducts = await Product.find({
      product_category: product.product_category,
      _id: { $ne: product._id },
      is_active: true
    }).limit(4).lean();

    const relatedIds = relatedProducts.map(p => p._id);

    const relatedVariations = await ProductVariation.aggregate([
      { $match: { product_id: { $in: relatedIds } } },
      { $group: { 
          _id: "$product_id",
          image: { $first: { $arrayElemAt: ["$images", 0] } }
      }}
    ]);

    const relatedImageMap = {};
    relatedVariations.forEach(v => {
      relatedImageMap[v._id.toString()] = v.image;
    });

    relatedProducts.forEach(p => {
      p.image = relatedImageMap[p._id.toString()] || null;
    });

    // Check if product is in user's wishlist
    let isInWishlist = false;
    if (req.session.userId) {
      const wishlistItem = await Wishlist.findOne({
        user_id: req.session.userId,
        product_id: productId
      });
      isInWishlist = !!wishlistItem;
    }

    
    return res.render("user/productDetail", {
      product,
      images: initialImages,
      sizes,
      colors,
      relatedProducts,
      sizeColorMap,
      variations,
      selectedSize,
      selectedColor,
      selectedVariationId,
      selectedStock,
      isInWishlist
    });

  } catch (err) {
    console.error("Product detail error:", err);
    
    // If it's a MongoDB CastError (invalid ObjectId), show 404
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(404).render('user/404');
    }
    
    // For other errors, show 500 error
    return res.status(500).render('user/500', { 
      message: 'We\'re having trouble loading this product. Please try refreshing the page or browse other products.' 
    });
  }
};

module.exports = {
  productList,
  productDetail,
};
