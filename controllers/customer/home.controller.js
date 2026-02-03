const userModel = require('../../models/userModel');
const Product = require('../../models/productModel');
const ProductVariation = require('../../models/productVariationModel');
const productCategoryModel = require('../../models/productCategoryModel');
const productTypeModel = require('../../models/productTypeModel');

const home = async (req, res) => {
  try {
    // Get active categories and types
    const [activeCategories, activeTypes] = await Promise.all([
      productCategoryModel.find({ isActive: true }).lean(),
      productTypeModel.find({ isActive: true }).lean()
    ]);

    const activeCategoryNames = activeCategories.map(c => c.category);
    const activeTypeNames = activeTypes.map(t => t.type);

    // Base filter for active products with active categories and types
    const baseFilter = {
      is_active: true,
      product_category: { $in: activeCategoryNames },
      product_type: { $in: activeTypeNames }
    };

    const bannerResult = await Product.aggregate([
      { $match: baseFilter },
      { $sample: { size: 1 } },

      {
        $lookup: {
          from: "product_variations",
          localField: "_id",
          foreignField: "product_id",
          as: "variations"
        }
      },

      {
        $addFields: {
          bannerImage: {
            $arrayElemAt: [
              { $arrayElemAt: ["$variations.images", 0] },
              0
            ]
          }
        }
      }
    ]);

    const bannerImage = bannerResult[0]?.bannerImage || null;

    const categoryImages = await Product.aggregate([
      { $match: baseFilter },

      {
        $group: {
          _id: "$product_category",
          product: { $first: "$$ROOT" }
        }
      },

      {
        $lookup: {
          from: "product_variations",
          localField: "product._id",
          foreignField: "product_id",
          as: "variations"
        }
      },

      {
        $addFields: {
          categoryImage: {
            $arrayElemAt: [
              { $arrayElemAt: ["$variations.images", 0] },
              0
            ]
          }
        }
      }
    ]);


    const featuredProducts = await Product.aggregate([
      { $match: baseFilter },
      { $sample: { size: 4 } },

      {
        $lookup: {
          from: "product_variations",
          localField: "_id",
          foreignField: "product_id",
          as: "variations"
        }
      },

      {
        $addFields: {
          image: {
            $arrayElemAt: [
              { $arrayElemAt: ["$variations.images", 0] },
              0
            ]
          }
        }
      }
    ]);


    res.render("user/home", {
      bannerImage,
      categories: categoryImages,
      featuredProducts
    });

  } catch (error) {
    console.error("Home route error:", error);
    res.status(500).render('user/500', { 
      message: 'Unable to load the home page at the moment. Please refresh the page or try again later.' 
    });
  }
};

module.exports = { home };
