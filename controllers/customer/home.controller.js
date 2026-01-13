const userModel = require('../../models/userModel');
const Product = require('../../models/productModel');
const ProductVariation = require('../../models/productVariationModel');

const home = async (req, res) => {
  try {

    const bannerResult = await Product.aggregate([
      { $match: { is_active: true } },
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
      { $match: { is_active: true } },

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
      { $match: { is_active: true } },
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
