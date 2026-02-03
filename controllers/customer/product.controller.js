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

  const [categories, types, sizesRaw, colors] = await Promise.all([
    productCategoryModel.find({ isActive: true }).lean(),
    productTypeModel.find({ isActive: true }).lean(),
    productSizeModel.find({ isActive: true }).lean(),
    productColorModel.find({ isActive: true }).lean()
  ]);
  
  // Sort sizes numerically
  const sizes = sizesRaw.sort((a, b) => Number(a.size) - Number(b.size));
  
  // Validate that selected filters are active
  const activeCategories = categories.map(c => c.category);
  const activeTypes = types.map(t => t.type);
  const activeSizes = sizes.map(s => s.size);
  const activeColors = colors.map(c => c.color);
  
  // Filter out inactive selections
  const validSelectedType = selectedType.filter(type => activeTypes.includes(type));
  const validSelectedSize = selectedSize.filter(size => activeSizes.includes(size));
  const validSelectedColor = selectedColor.filter(color => activeColors.includes(color));
  const validSelectedCategory = selectedCategory && activeCategories.includes(selectedCategory) ? selectedCategory : null;

  //Build base Mongoose filter object
  const filter = { is_active: true };
  
  // Filter to only show products with active categories and types
  filter.product_category = { $in: activeCategories };
  filter.product_type = { $in: activeTypes };
  
  // Apply user selections (which are already validated)
  if (validSelectedCategory) filter.product_category = validSelectedCategory;
  if (validSelectedType.length) filter.product_type = { $in: validSelectedType };
  if (searchText) filter.name = { $regex: searchText, $options: "i" };

  //Filter by variations (size/color)
  let variationProductIds = null;
  
  // Always get products that have at least one variation with active colors and sizes
  const activeVariationFilter = {
    product_color: { $in: activeColors },
    product_size: { $in: activeSizes }
  };
  
  if (validSelectedSize.length || validSelectedColor.length) {
    // User has selected specific sizes/colors
    const variationFilter = { ...activeVariationFilter };
    if (validSelectedSize.length) variationFilter.product_size = { $in: validSelectedSize };
    if (validSelectedColor.length) variationFilter.product_color = { $in: validSelectedColor };

    const variations = await ProductVariation.find(variationFilter, "product_id").lean();
    variationProductIds = [...new Set(variations.map(v => v.product_id.toString()))];
    if (!variationProductIds.length) {
      // Still need to fetch filter data even when no products match
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
        selectedCategory: validSelectedCategory,
        selectedType: validSelectedType,
        selectedSize: validSelectedSize,
        selectedColor: validSelectedColor,
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
  } else {
    // No specific size/color selected, get all products with active variations
    const variations = await ProductVariation.find(activeVariationFilter, "product_id").lean();
    variationProductIds = [...new Set(variations.map(v => v.product_id.toString()))];
  }
  
  if (variationProductIds) {
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
    
    if (priceConditions.length === 1) {
      filter.price = priceConditions[0];
    } else if (priceConditions.length > 1) {
      // For multiple price ranges, we need to use $and to combine with existing filters
      const existingFilters = { ...filter };
      filter.$and = [
        existingFilters,
        { $or: priceConditions.map(p => ({ price: p })) }
      ];
      
      // Remove the individual filter properties since they're now in $and
      Object.keys(existingFilters).forEach(key => {
        if (key !== '$and') {
          delete filter[key];
        }
      });
    }
  }

  // 6. Get, sort, and paginate products
  let products = await Product.find(filter).lean();
  
  console.log('Product filtering results:', {
    totalProductsFound: products.length,
    filter: JSON.stringify(filter),
    activeCategories: activeCategories.length,
    activeTypes: activeTypes.length
  });
  
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
        ...(validSelectedColor.length && { product_color: { $in: validSelectedColor } })
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



  const priceRanges = [
    { label: "0 - 500", min: 0, max: 500 },
    { label: "500 - 1000", min: 500, max: 1000 },
    { label: "1000 - 2000", min: 1000, max: 2000 },
    { label: "2000 - 5000", min: 2000, max: 5000 },
    { label: "5000 - 10000", min: 5000, max: 10000 }
  ];

  return res.render("user/productList", {
    products: products.map(p => {
      console.log('Product ID being rendered:', p._id, 'Type:', typeof p._id);
      return p;
    }),
    categories,
    types,
    sizes,
    colors,
    priceRanges,
    selectedCategory: validSelectedCategory,
    selectedType: validSelectedType,
    selectedSize: validSelectedSize,
    selectedColor: validSelectedColor,
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
    console.log('Is valid ObjectId:', mongoose.Types.ObjectId.isValid(productId));
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.log('Invalid ObjectId, returning 404');
      return res.status(404).render('user/404');
    }
    
    const product = await Product.findById(productId).lean();
    console.log('Product found:', !!product);

    if (!product || !product.is_active) {
      console.log('Product not found or inactive, returning 404');
      return res.status(404).render('user/404');
    }

    // Check if product's category and type are active
    const [category, type] = await Promise.all([
      productCategoryModel.findOne({ category: product.product_category, isActive: true }).lean(),
      productTypeModel.findOne({ type: product.product_type, isActive: true }).lean()
    ]);

    console.log('Product details:', {
      productId,
      productCategory: product.product_category,
      productType: product.product_type,
      categoryFound: !!category,
      typeFound: !!type
    });

    if (!category || !type) {
      console.log('Product blocked - inactive category or type:', {
        category: category ? 'active' : 'inactive',
        type: type ? 'active' : 'inactive'
      });
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

    // Filter variations to only include those with active colors and sizes
    const [activeSizes, activeColors] = await Promise.all([
      productSizeModel.find({ isActive: true }).lean(),
      productColorModel.find({ isActive: true }).lean()
    ]);

    const activeSizeValues = activeSizes.map(s => s.size);
    const activeColorValues = activeColors.map(c => c.color);

    const validVariations = variations.filter(v => 
      activeSizeValues.includes(Number(v.product_size)) && 
      activeColorValues.includes(v.product_color)
    );

    if (!validVariations.length) {
      console.log('Product blocked - no valid variations:', {
        productId,
        totalVariations: variations.length,
        validVariations: validVariations.length,
        activeSizeValues,
        activeColorValues
      });
      return res.status(404).render('user/404');
    }

  
    let initialImages = [];
    let selectedSize = null;
    let selectedColor = null;
    let selectedVariationId = null;
    let selectedStock = 0; 

    if (validVariations && validVariations.length) {
      const defaultVariation = validVariations.find(v => v.stock_quantity > 0) || validVariations[0];

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
    validVariations.forEach(v => {
      if (!sizes.includes(v.product_size)) sizes.push(v.product_size);
      if (!colors.includes(v.product_color)) colors.push(v.product_color);
    });

  
    const sizeColorMap = {};
    validVariations.forEach(v => {
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
      variations: validVariations,
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
