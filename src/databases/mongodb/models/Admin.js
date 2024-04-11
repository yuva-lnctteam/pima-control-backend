const mongoose = require("mongoose");

const AdminSchema = mongoose.Schema({
  fName: {
    type: String,
    default: "",
  },
  mName: {
    type: String,
    default: "",
  },
  lName: {
    type: String,
    default: "",
  },

  email: {
    type: String,
    default: "",
  },

  adminId: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },

  phone: {
    type: String,
    default: "",
  },
});
const Admin = mongoose.model("admin", AdminSchema);
Admin.createIndexes();
module.exports = Admin;
