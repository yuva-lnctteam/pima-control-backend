const mongoose = require("mongoose");
require("dotenv").config();

const DB_NAME = process.env.DB_NAME;
const connectToMongoDB = () => {
    mongoose
        .connect(`${process.env.MONGODB_ATLAS_URI}/${DB_NAME}`)
        .then(() => {
            console.log("Connected to MongoDB");
        })
        .catch((err) => {
            console.log("Failed to connect to MongoDB", err);
        });
};

module.exports = connectToMongoDB;
