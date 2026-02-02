const mongoose = require("mongoose");

const productSizeSchema = new mongoose.Schema({
    size:{
        type: Number,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("product-size",productSizeSchema)