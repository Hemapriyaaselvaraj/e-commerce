const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema({

    color:{
        type: String,
        required: true,
    }
}
);

module.exports = mongoose.model("product-color",productColorSchema)