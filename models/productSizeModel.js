const mongoose = require("mongoose");

const productSizeSchema = new mongoose.Schema({

    size:{
        type: Number,
        required: true,
    }
}
);

module.exports = mongoose.model("product-size",productSizeSchema)