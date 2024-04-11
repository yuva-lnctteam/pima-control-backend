const mongoose = require("mongoose");

const excelUserSchema = new mongoose.Schema({
    name: {
        type: "String",
        required: true, 
    },
    email: {
        type: "String",
        required: true,
        unique: true,
    }
})

const ExcelUser = mongoose.model("ExcelUser", excelUserSchema);
module.exports = { ExcelUser }