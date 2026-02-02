const mongoose = require("mongoose");

const productCategorySchema = new mongoose.Schema({
    category:{
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("product-category",productCategorySchema)