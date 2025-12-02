const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const walletSchema = new Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId,
     ref: "User", 
     required: true 
    },
    amount: {
    type:Number,
    min: 0
    },
    type: { 
        type: String, 
        enum: ["credit", "debit"], 
        required: true 
    },
    description: {
        type:String,
        required:false
    },
    date: { 
        type: Date, 
        default: Date.now }
});

module.exports = mongoose.model("WalletTransaction", walletSchema);
