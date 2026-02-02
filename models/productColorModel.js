const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema({
    color:{
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("product-color",productColorSchema)