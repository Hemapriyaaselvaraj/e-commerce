const mongoose = require("mongoose");

const productTypeSchema = new mongoose.Schema({
    type:{
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("product-type",productTypeSchema)