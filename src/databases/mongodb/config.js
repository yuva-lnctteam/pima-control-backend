const mongoose = require("mongoose");
require("dotenv").config();

const connectToMongoDB = () => {
  mongoose
    .connect(process.env.MONGODB_ATLAS_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.log("Failed to connect to MongoDB", err);
    });
};

module.exports = connectToMongoDB;
