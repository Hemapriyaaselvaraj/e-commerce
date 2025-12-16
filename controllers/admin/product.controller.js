const userModel = require("../../models/userModel");
const cloudinary = require("../../config/cloudinary");
const productCategoryModel = require("../../models/productCategoryModel");
const productColorModel = require("../../models/productColorModel");
const productSizeModel = require("../../models/productSizeModel");
const productTypeModel = require("../../models/productTypeModel");
const Product = require("../../models/productModel");
const ProductVariation = require("../../models/productVariationModel");
const productVariationModel = require("../../models/productVariationModel");
const { default: mongoose } = require("mongoose");

const getProductConfiguration = async (req, res) => {
  try {
    const user = await userModel.findOne({ _id: req.session.userId });
    if (!user) {
      return res.redirect("/user/login");
    }
    const categories = await productCategoryModel
      .find({})
      .sort({ category: 1 });
    const types = await productTypeModel.find({}).sort({ type: 1 });
    const sizes = await productSizeModel.find({}).sort({ size: 1 });
    const colors = await productColorModel.find({}).sort({ color: 1 });

    res.render("admin/productConfiguration", {
      name: user.firstName,
      data: {
        category: categories,
        type: types,
        size: sizes,
        color: colors,
      },
    });
  } catch (error) {
    console.error("Error loading product configuration:", error);
    res.redirect("/user/login");
  }
};

const createCategory = async (req, res) => {
  try {
    const { value } = req.body;

    const isCategoryAlreadyAvailable = await productCategoryModel.findOne({
      category: { $regex: `^${value}$`, $options: "i" },
    });

    if (isCategoryAlreadyAvailable) {
      throw new Error("Category already exists");
    }

    const newCategory = new productCategoryModel({
      category: value.toUpperCase(),
    });
    await newCategory.save();

    res.status(201).json({
      message: "Category created",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to create category" });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { value } = req.body;
    const { id } = req.params;

    const existingCategory = await productCategoryModel.findById(id);

    if (!existingCategory) {
      throw new Error("Category not found");
    }

    const isCategoryAlreadyAvailable = await productCategoryModel.findOne({
      category: { $regex: `^${value}$`, $options: "i" },
    });

    if (isCategoryAlreadyAvailable) {
      throw new Error("Category already exists");
    }

    var myquery = { _id: id };
    var newvalues = {
      $set: { category: value.toUpperCase() },
    };

    await productCategoryModel.updateOne(myquery, newvalues);

    res.status(200).json({
      message: "Category updated",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to update category" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await productCategoryModel.findByIdAndDelete(id);

    res.status(200).json({
      message: "Category deleted",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to delete category" });
  }
};

const createType = async (req, res) => {
  try {
    const { value } = req.body;

    const isTypeAlreadyAvailable = await productTypeModel.findOne({
      type: { $regex: `^${value}$`, $options: "i" },
    });

    if (isTypeAlreadyAvailable) {
      throw new Error("Type already exists");
    }

    const newType = new productTypeModel({ type: value.toUpperCase() });
    await newType.save();

    res.status(201).json({
      message: "Type created",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create type" });
  }
};

const updateType = async (req, res) => {
  try {
    const { value } = req.body;
    const { id } = req.params;

    const existingType = await productTypeModel.findById(id);

    if (!existingType) {
      throw new Error("Type not found");
    }

    const isTypeAlreadyAvailable = await productTypeModel.findOne({
      type: { $regex: `^${value}$`, $options: "i" },
    });

    if (isTypeAlreadyAvailable) {
      throw new Error("Type already exists");
    }

    const myquery = { _id: id };
    const newvalues = {
      $set: { type: value.toUpperCase() },
    };

    await productTypeModel.updateOne(myquery, newvalues);

    res.status(200).json({
      message: "Type updated",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update type" });
  }
};

const deleteType = async (req, res) => {
  try {
    const { id } = req.params;

    await productTypeModel.findByIdAndDelete(id);

    res.status(200).json({
      message: "Type deleted",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete type" });
  }
};

const createSize = async (req, res) => {
  try {
    const value = req.body.value?.trim();
    const isSizeAlreadyAvailable = await productSizeModel.findOne({
      size: value,
    });

    if (isSizeAlreadyAvailable) {
      throw new Error("Size already exists");
    }

    const newSize = new productSizeModel({ size: Number(value) });
    await newSize.save();

    res.status(201).json({
      message: "Size created",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create size" });
  }
};

const updateSize = async (req, res) => {
  try {
    const { value } = req.body;
    const { id } = req.params;

    if (value === undefined || value === null || value === "") {
      throw new Error("Size value is missing");
    }

    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      throw new Error("Size must be a number");
    }

    const existingSize = await productSizeModel.findById(id);
    if (!existingSize) {
      throw new Error("Size not found");
    }

    const isSizeAlreadyAvailable = await productSizeModel.findOne({
      size: numericValue,
      _id: { $ne: id },
    });

    if (isSizeAlreadyAvailable) {
      throw new Error("Size already exists");
    }

    await productSizeModel.updateOne(
      { _id: id },
      { $set: { size: numericValue } }
    );

    res.status(200).json({
      message: "Size updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to update size",
    });
  }
};

const deleteSize = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await productSizeModel.findByIdAndDelete(id);

    if (!deleted) {
      throw new Error("Size not found");
    }

    res.status(200).json({
      message: "Size deleted",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete size" });
  }
};

const createColor = async (req, res) => {
  try {
    const { value } = req.body;

    const isColorAlreadyAvailable = await productColorModel.findOne({
      color: { $regex: `^${value}$`, $options: "i" },
    });

    if (isColorAlreadyAvailable) {
      throw new Error("Color already exists");
    }

    const newColor = new productColorModel({ color: value.toUpperCase() });
    await newColor.save();

    res.status(201).json({
      message: "Color created",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to create color" });
  }
};

const updateColor = async (req, res) => {
  try {
    const { value } = req.body;
    const { id } = req.params;

    const existingColor = await productColorModel.findById(id);

    if (!existingColor) {
      throw new Error("Color not found");
    }

    const isColorAlreadyAvailable = await productColorModel.findOne({
      color: { $regex: `^${value}$`, $options: "i" },
    });

    if (isColorAlreadyAvailable) {
      throw new Error("Color already exists");
    }

    const myquery = { _id: id };
    const newvalues = {
      $set: { color: value.toUpperCase() },
    };

    await productColorModel.updateOne(myquery, newvalues);

    res.status(200).json({
      message: "Color updated",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to update color" });
  }
};

const deleteColor = async (req, res) => {
  try {
    const { id } = req.params;

    await productColorModel.findByIdAndDelete(id);

    res.status(200).json({
      message: "Color deleted",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to delete color" });
  }
};

const getProducts = async (req, res) => {
  try {
    const user = await userModel.findById(req.session.userId);
    const categories = await productCategoryModel.find({});
    const types = await productTypeModel.find({});

    const {
      category = "all",
      type = "all",
      sort = "latest",
      search = "",
      page = 1,
    } = req.query;

    const pageSize = 7;
    const currentPage = parseInt(page) || 1;

    const filter = {};

    if (category !== "all") filter.product_category = category;
    if (type !== "all") filter.product_type = type;
    if (search) filter.name = { $regex: search, $options: "i" };

    let sortObj = { created_at: -1, _id: -1 };
    if (sort === "nameAsc") sortObj = { name: 1, created_at: -1, _id: -1 };
    else if (sort === "nameDesc")
      sortObj = { name: -1, created_at: -1, _id: -1 };

    const totalResults = await Product.countDocuments(filter);
    const skipCount = (currentPage - 1) * pageSize;

    // Use aggregation to get products with their first variation image
    const products = await Product.aggregate([
      { $match: filter },
      { $sort: sortObj },
      { $skip: skipCount },
      { $limit: pageSize },
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
          firstImage: {
            $arrayElemAt: [
              {
                $arrayElemAt: ["$variations.images", 0]
              },
              0
            ]
          }
        }
      }
    ]);

    const totalPages = Math.ceil(totalResults / pageSize);

    res.render("admin/products", {
      name: user.firstName || "Admin",
      products,
      categories,
      types,
      currentCategory: category,
      currentType: type,
      currentSort: sort,
      currentSearch: search,
      currentPage,
      totalPages,
      totalResults,
      pageSize,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch products" });
  }
};

const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    product.is_active = !product.is_active;
    await product.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update status",
    });
  }
};

const getAddProduct = async (req, res) => {
  const user = await userModel.findOne({ _id: req.session.userId });

  let sizes = await productSizeModel.find();
  sizes = sizes.sort((a, b) => Number(a.size) - Number(b.size));
  const colors = await productColorModel.find().sort({ color: 1 });
  const categories = await productCategoryModel.find().sort({ category: 1 });
  const types = await productTypeModel.find().sort({ type: 1 });

  res.render("admin/addProduct", {
    name: user.firstName,
    categories,
    types,
    sizes,
    colors,
    mode: "add",
    product: {},
  });
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      description,
      price,
      category,
      type,
      variations,
    } = req.body;

    const newProduct = new Product({
      name,
      product_sku: sku,
      description,
      price,
      product_category: category,
      product_type: type,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const savedProduct = await newProduct.save();

    const variationEntries = [];
    const files = req.files || [];

    
    for (let i = 0; i < variations.length; i++) {
      const variation = variations[i];
      const images = files.filter(file => file.fieldname === `variationImages_${i}`) || [];
      
      
      const imageUrls = images.map((file) => file.path);

      const newVariation = new ProductVariation({
        product_id: savedProduct._id,
        product_size: variation.size,
        product_color: variation.color,
        stock_quantity: variation.stock,
        images: imageUrls,
        created_at: new Date(),
        updated_at: new Date(),
      });

      variationEntries.push(newVariation.save());
    }

    await Promise.all(variationEntries);

    res.status(201).json({ message: "Product created successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEditProduct = async(req,res) => {
  try{
    const productId = req.params.id;

    const result = await Product.aggregate([
      {
        $match: {_id: new mongoose.Types.ObjectId(productId)}
      },
      {
        $lookup:{
          from:"product_variations",
          localField: "_id",
          foreignField:"product_id",
          as:"variations"
        }
      },
      {
        $addFields:{
          variations:{
            $map:{
              input:"$variations",
              as: "v",
              in:{
                size: "$$v.product_size",
                color: "$$v.product_color",
                stock: "$$v.stock_quantity",
                images: "$$v.images"
              }
            }
          }
        }
      }
    ]);

    if(!result.length) return res.status(404).send("Product not found");

    const product = result[0];

    const categories = await productCategoryModel.find({}).lean();
    const types = await productTypeModel.find({}).lean();
    const sizes = await productSizeModel.find({}).lean();
    const colors = await productColorModel.find({}).lean();

    const user = await userModel.findById(req.session.userId);
    res.render("admin/addProduct", {
      name: user?.firstName || "",
      product,
      categories,
      types,
      sizes,
      colors,
      mode: "edit"
    });

}catch(err) {
  res.status(500).send("Server error");
}
};

const postEditProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).send('Product not found');

    const {
      name,
      price,
      description,
      category: product_category,
      type: product_type,
      variations = [],
    } = req.body;

    Object.assign(product, {
      name,
      price,
      description,
      product_category,
      product_type,
    });
    const savedProduct = await product.save();

    const existingVariations = await ProductVariation.find({ product_id: productId });

    const findExistingVar = (size, color) =>
      existingVariations.find(v => v.product_size === size && v.product_color === color);

    const files = req.files || [];
    const getVariationImages = index =>
      files.filter(file => file.fieldname === `variationImages_${index}`).map(file => file.path);

    const submittedKeys = new Set();
    const changes = [];

    for (let i = 0; i < variations.length; i++) {
      const { size, color, stock } = variations[i];
      const key = `${size}__${color}`;
      submittedKeys.add(key);

      const newImageUrls = getVariationImages(i);
      const deletedImages = req.body[`deletedVariationImage_${i}`] || [];

      const existing = findExistingVar(size, color);

      if (existing) {
        existing.stock_quantity = stock;
        existing.images = [
          ...newImageUrls,
          ...(existing.images || []).filter(url => !deletedImages.includes(url))
        ];
        existing.updated_at = new Date();
        changes.push(existing.save());
      } else {
        changes.push(
          new ProductVariation({
            product_id: savedProduct._id,
            product_size: size,
            product_color: color,
            stock_quantity: stock,
            images: newImageUrls,
            created_at: new Date(),
            updated_at: new Date(),
          }).save()
        );
      }
    }

    for (const v of existingVariations) {
      const key = `${v.product_size}__${v.product_color}`;
      if (!submittedKeys.has(key)) {
        changes.push(ProductVariation.deleteOne({ _id: v._id }));
      }
    }

    await Promise.all(changes);

    // Handle both AJAX and form submissions
    if (req.method === 'PATCH' || req.headers['content-type']?.includes('application/json')) {
      res.status(200).json({ success: true, message: 'Product updated successfully' });
    } else {
      res.redirect('/admin/products');
    }
  } catch (err) {
    console.error("Error updating product:", err);
    
    // Handle both AJAX and form submissions
    if (req.method === 'PATCH' || req.headers['content-type']?.includes('application/json')) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.status(500).send(`Error updating product: ${err.message}`);
    }
  }
};

const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout failed:", err);
      return res.redirect('/admin/dashboard');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/user/login');
  });
};


module.exports = {
  getProductConfiguration,
  createCategory,
  updateCategory,
  deleteCategory,
  createType,
  createColor,
  createSize,
  updateType,
  updateColor,
  updateSize,
  deleteType,
  deleteColor,
  deleteSize,
  getProducts,
  toggleActive,
  getAddProduct,
  createProduct,
  getEditProduct,
  postEditProduct,
  logout
};
