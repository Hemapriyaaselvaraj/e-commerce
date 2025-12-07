const userModel = require("../../models/userModel");
const productCategoryModel = require("../../models/productCategoryModel");
const productColorModel = require("../../models/productColorModel");
const productSizeModel = require("../../models/productSizeModel");
const productTypeModel = require("../../models/productTypeModel");
const Product = require("../../models/productModel");
const ProductVariation = require("../../models/productVariationModel");
const Wishlist = require("../../models/wishlistModel");
const Offer = require("../../models/offerModel");


const productList = async (req, res) => {

// Parse filters & query parameters
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
  const pageSize = 20;

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
      return renderEmpty();
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

  // Calculate max offer for each product
  products.forEach(p => {
    let maxOfferDiscount = 0;

    // Check product-specific offers
    const productOffers = activeOffers.filter(offer => 
      offer.product.some(prodId => prodId.toString() === p._id.toString())
    );
    productOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    // Check category-specific offers (match by category name)
    const categoryOffers = activeOffers.filter(offer => 
      offer.category && offer.category.length > 0 &&
      offer.category.some(cat => cat && cat.category === p.product_category)
    );
    categoryOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    // Check offers that apply to all products (no product or category specified)
    const generalOffers = activeOffers.filter(offer => 
      offer.product.length === 0 && offer.category.length === 0
    );
    generalOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    // Store offer discount - only show badge if there's an actual offer
    p.offerDiscount = maxOfferDiscount; // This will be 0 if no offers apply
    p.afterDiscountPrice = p.price * (1 - maxOfferDiscount / 100);
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

  // 9. Get filter dropdown options
  const [categories, types, sizes, colors] = await Promise.all([
    productCategoryModel.find({}).lean(),
    productTypeModel.find({}).lean(),
    productSizeModel.find({}).lean(),
    productColorModel.find({}).lean()
  ]);
  const priceRanges = [
    { label: "0 - 500", min: 0, max: 500 },
    { label: "500 - 1000", min: 500, max: 1000 },
    { label: "1000 - 2000", min: 1000, max: 2000 },
    { label: "2000 - 5000", min: 2000, max: 5000 },
    { label: "5000 - 10000", min: 5000, max: 10000 }
  ];

  // 10. Render main page
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

  // Helper: render empty list if no matching variations
  function renderEmpty() {
    return res.render("user/productList", {
      products: [],
      categories: [],
      types: [],
      sizes: [],
      colors: [],
      priceRanges: [],
      selectedCategory,
      selectedType,
      selectedSize,
      selectedColor,
      selectedPrice,
      currentPage,
      totalPages: 0,
      totalResults: 0,
      pageSize,
      sort,
      query: req.query,
      wishlistMap: {}
    });
  }

  // Helper: sort products by UI control
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
        // "newest"
        return products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }
};

const productDetail = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Calculate offer for this product
    const now = new Date();
    const activeOffers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    })
    .populate('category', 'category')
    .lean();

    let maxOfferDiscount = 0;

    // Check product-specific offers
    const productOffers = activeOffers.filter(offer => 
      offer.product.some(prodId => prodId.toString() === product._id.toString())
    );
    productOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    // Check category-specific offers
    const categoryOffers = activeOffers.filter(offer => 
      offer.category && offer.category.length > 0 &&
      offer.category.some(cat => cat && cat.category === product.product_category)
    );
    categoryOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    // Check general offers
    const generalOffers = activeOffers.filter(offer => 
      offer.product.length === 0 && offer.category.length === 0
    );
    generalOffers.forEach(offer => {
      if (offer.discountPercentage > maxOfferDiscount) {
        maxOfferDiscount = offer.discountPercentage;
      }
    });

    product.offerDiscount = maxOfferDiscount;
    console.log('Product:', product.name, 'Category:', product.product_category, 'Offer:', maxOfferDiscount);

    const variations = await ProductVariation.find({ product_id: productId }).lean();

    // Default variation selection
    let initialImages = [];
    let selectedSize = null;
    let selectedColor = null;
    let selectedVariationId = null;
    let selectedStock = 0; // track stock for front-end

    if (variations && variations.length) {
      // Pick first in-stock variation, otherwise first variation
      const defaultVariation = variations.find(v => v.stock_quantity > 0) || variations[0];

      if (defaultVariation) {
        initialImages = Array.isArray(defaultVariation.images) ? defaultVariation.images.slice() : [];
        selectedSize = defaultVariation.product_size;
        selectedColor = defaultVariation.product_color;
        selectedVariationId = defaultVariation._id;
        selectedStock = defaultVariation.stock_quantity || 0; // pass stock
      }
    }

    // Collect unique sizes and colors
    const sizes = [];
    const colors = [];
    variations.forEach(v => {
      if (!sizes.includes(v.product_size)) sizes.push(v.product_size);
      if (!colors.includes(v.product_color)) colors.push(v.product_color);
    });

    // Map size -> colors/images
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

    // Render page
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
      selectedStock // pass stock to front-end
    });

  } catch (err) {
    console.log(err);
    return res.status(500).send("Error loading product detail");
  }
};

module.exports = {
  productList,
  productDetail,
};
