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
    res.status(500).render('admin/500', { 
      message: 'We\'re having trouble loading the product configuration page. Please try refreshing or contact technical support if the problem continues.',
      name: 'Admin'
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || !value.trim()) {
      return res.status(400).json({ 
        message: "Please enter a category name. The name cannot be empty." 
      });
    }

    const trimmedValue = value.trim();
    
    // Check for existing category (case-insensitive, exact match)
    const isCategoryAlreadyAvailable = await productCategoryModel.findOne({
      category: { $regex: new RegExp(`^${trimmedValue}$`, 'i') }
    });

    if (isCategoryAlreadyAvailable) {
      return res.status(400).json({ 
        message: `A category with the name "${trimmedValue}" already exists. Please choose a different name.` 
      });
    }

    const newCategory = new productCategoryModel({
      category: trimmedValue.toUpperCase(),
    });
    await newCategory.save();

    res.status(201).json({
      message: "Category created successfully!",
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ 
      message: "We couldn't create the category due to a technical issue. Please try again or contact support if the problem continues." 
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { value } = req.body;
    const { id } = req.params;

    if (!value || !value.trim()) {
      return res.status(400).json({ 
        message: "Please enter a category name. The name cannot be empty." 
      });
    }

    const existingCategory = await productCategoryModel.findById(id);

    if (!existingCategory) {
      return res.status(404).json({ 
        message: "Category not found. It may have been deleted by another admin." 
      });
    }

    const isCategoryAlreadyAvailable = await productCategoryModel.findOne({
      category: { $regex: `^${value.trim()}$`, $options: "i" },
      _id: { $ne: id }
    });

    if (isCategoryAlreadyAvailable) {
      return res.status(400).json({ 
        message: "A category with this name already exists. Please choose a different name." 
      });
    }

    var myquery = { _id: id };
    var newvalues = {
      $set: { category: value.trim().toUpperCase() },
    };

    await productCategoryModel.updateOne(myquery, newvalues);

    res.status(200).json({
      message: "Category updated successfully!",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ 
      message: "We couldn't update the category due to a technical issue. Please try again or contact support if the problem continues." 
    });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await productCategoryModel.findById(id);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: "Category not found" 
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({ 
      success: true, 
      isActive: category.isActive 
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await productCategoryModel.findById(id);
    if (!category) {
      return res.status(404).json({ 
        message: "Category not found. It may have already been deleted." 
      });
    }

    await productCategoryModel.findByIdAndDelete(id);

    res.status(200).json({
      message: "Category deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ 
      message: "We couldn't delete the category due to a technical issue. Please try again or contact support if the problem continues." 
    });
  }
};

const createType = async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || !value.trim()) {
      return res.status(400).json({ 
        message: "Please enter a product type name. The name cannot be empty." 
      });
    }

    const trimmedValue = value.trim();

    const isTypeAlreadyAvailable = await productTypeModel.findOne({
      type: { $regex: new RegExp(`^${trimmedValue}$`, 'i') }
    });

    if (isTypeAlreadyAvailable) {
      return res.status(400).json({ 
        message: `A product type with the name "${trimmedValue}" already exists. Please choose a different name.` 
      });
    }

    const newType = new productTypeModel({ type: trimmedValue.toUpperCase() });
    await newType.save();

    res.status(201).json({
      message: "Product type created successfully!",
    });
  } catch (error) {
    console.error("Error creating type:", error);
    res.status(500).json({ 
      message: "We couldn't create the product type due to a technical issue. Please try again or contact support if the problem continues." 
    });
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

const toggleTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await productTypeModel.findById(id);
    
    if (!type) {
      return res.status(404).json({ 
        success: false, 
        message: "Product type not found" 
      });
    }

    type.isActive = !type.isActive;
    await type.save();

    res.json({ 
      success: true, 
      isActive: type.isActive 
    });
  } catch (error) {
    console.error("Toggle type status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
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
    
    if (!value) {
      return res.status(400).json({ 
        message: "Please enter a size value. The value cannot be empty." 
      });
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || value === '' || value.includes('e')) {
      return res.status(400).json({ 
        message: "Size must be a valid number!" 
      });
    }

    const isSizeAlreadyAvailable = await productSizeModel.findOne({
      size: numericValue,
    });

    if (isSizeAlreadyAvailable) {
      return res.status(400).json({ 
        message: "A size with this value already exists. Please choose a different size." 
      });
    }

    const newSize = new productSizeModel({ size: numericValue });
    await newSize.save();

    res.status(201).json({
      message: "Size created successfully!",
    });
  } catch (error) {
    console.error("Error creating size:", error);
    res.status(500).json({ 
      message: "We couldn't create the size due to a technical issue. Please try again or contact support if the problem continues." 
    });
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

const toggleSizeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const size = await productSizeModel.findById(id);
    
    if (!size) {
      return res.status(404).json({ 
        success: false, 
        message: "Size not found" 
      });
    }

    size.isActive = !size.isActive;
    await size.save();

    res.json({ 
      success: true, 
      isActive: size.isActive 
    });
  } catch (error) {
    console.error("Toggle size status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
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

    if (!value || !value.trim()) {
      return res.status(400).json({ 
        message: "Please enter a color name. The name cannot be empty." 
      });
    }

    const trimmedValue = value.trim();

    const isColorAlreadyAvailable = await productColorModel.findOne({
      color: { $regex: new RegExp(`^${trimmedValue}$`, 'i') }
    });

    if (isColorAlreadyAvailable) {
      return res.status(400).json({ 
        message: `A color with the name "${trimmedValue}" already exists. Please choose a different name.` 
      });
    }

    const newColor = new productColorModel({ color: trimmedValue.toUpperCase() });
    await newColor.save();

    res.status(201).json({
      message: "Color created successfully!",
    });
  } catch (error) {
    console.error("Error creating color:", error);
    res.status(500).json({ 
      message: "We couldn't create the color due to a technical issue. Please try again or contact support if the problem continues." 
    });
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

const toggleColorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const color = await productColorModel.findById(id);
    
    if (!color) {
      return res.status(404).json({ 
        success: false, 
        message: "Color not found" 
      });
    }

    color.isActive = !color.isActive;
    await color.save();

    res.json({ 
      success: true, 
      isActive: color.isActive 
    });
  } catch (error) {
    console.error("Toggle color status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
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

  let sizes = await productSizeModel.find({ isActive: true });
  sizes = sizes.sort((a, b) => Number(a.size) - Number(b.size));
  const colors = await productColorModel.find({ isActive: true }).sort({ color: 1 });
  const categories = await productCategoryModel.find({ isActive: true }).sort({ category: 1 });
  const types = await productTypeModel.find({ isActive: true }).sort({ type: 1 });

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
      
      // Validate minimum 4 images per variation
      if (images.length < 4) {
        return res.status(400).json({ 
          error: `Each product variation must have at least 4 images. Variation ${i + 1} (${variation.size} - ${variation.color}) has only ${images.length} image(s). Please add ${4 - images.length} more image(s).` 
        });
      }
      
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
    console.error('Error creating product:', err);
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
                _id: "$$v._id",
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

    const categories = await productCategoryModel.find({ isActive: true }).lean();
    const types = await productTypeModel.find({ isActive: true }).lean();
    const sizes = await productSizeModel.find({ isActive: true }).lean();
    const colors = await productColorModel.find({ isActive: true }).lean();

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

    const files = req.files || [];
    const getVariationImages = index =>
      files.filter(file => file.fieldname === `variationImages_${index}`).map(file => file.path);

    const changes = [];
    const processedVariationIds = new Set();

    for (let i = 0; i < variations.length; i++) {
      const { size, color, stock, variationId } = variations[i];
      
      const newImageUrls = getVariationImages(i);
      const deletedImages = req.body[`deletedVariationImage_${i}`] || [];

      let targetVariation = null;
      
      // If variationId is provided, try to find the existing variation by ID
      if (variationId) {
        targetVariation = existingVariations.find(v => v._id.toString() === variationId);
        processedVariationIds.add(variationId);
      }
      
      // If no variation found by ID, try to find by size+color (for new variations)
      if (!targetVariation) {
        targetVariation = existingVariations.find(v => 
          v.product_size === size && 
          v.product_color === color &&
          !processedVariationIds.has(v._id.toString())
        );
        if (targetVariation) {
          processedVariationIds.add(targetVariation._id.toString());
        }
      }

      if (targetVariation) {
        // Updating existing variation
        const finalImages = [
          ...newImageUrls,
          ...(targetVariation.images || []).filter(url => !deletedImages.includes(url))
        ];
        
        // Validate minimum 4 images per variation
        if (finalImages.length < 4) {
          return res.status(400).json({ 
            error: `Each product variation must have at least 4 images. Variation ${i + 1} (${size} - ${color}) will have only ${finalImages.length} image(s) after your changes. Please add ${4 - finalImages.length} more image(s).` 
          });
        }
        
        targetVariation.product_size = size;
        targetVariation.product_color = color;
        targetVariation.stock_quantity = stock;
        targetVariation.images = finalImages;
        targetVariation.updated_at = new Date();
        changes.push(targetVariation.save());
      } else {
        // Creating new variation
        if (newImageUrls.length < 4) {
          return res.status(400).json({ 
            error: `Each product variation must have at least 4 images. New variation ${i + 1} (${size} - ${color}) has only ${newImageUrls.length} image(s). Please add ${4 - newImageUrls.length} more image(s).` 
          });
        }
        
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

    // Delete variations that are no longer in the submitted list
    for (const v of existingVariations) {
      if (!processedVariationIds.has(v._id.toString())) {
        changes.push(ProductVariation.deleteOne({ _id: v._id }));
      }
    }

    await Promise.all(changes);

    if (req.method === 'PATCH' || req.headers['content-type']?.includes('application/json')) {
      res.status(200).json({ success: true, message: 'Product updated successfully' });
    } else {
      res.redirect('/admin/products');
    }
  } catch (err) {
    console.error("Error updating product:", err);
    
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
  toggleCategoryStatus,
  createType,
  createColor,
  createSize,
  updateType,
  updateColor,
  updateSize,
  deleteType,
  deleteColor,
  deleteSize,
  toggleTypeStatus,
  toggleSizeStatus,
  toggleColorStatus,
  getProducts,
  toggleActive,
  getAddProduct,
  createProduct,
  getEditProduct,
  postEditProduct,
  logout
};
