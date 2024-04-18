//THIS FILE IS USED FOR CERTIFICATE GENERATION

// const express = require("express");
// const router = express.Router();
// const basicAuth = require('express-basic-auth');

// // Basic Authentication middleware
// const userId = process.env.userId;
// const userPassword = process.env.userPassword;

// const userAuth = basicAuth({
//     users: { [userId]: userPassword }, 
//     challenge: true, 
//     unauthorizedResponse: 'Unauthorized',
//   });

// // My models
// const User = require("../../databases/mongodb/models/User");
// const Course = require("../../databases/mongodb/models/Course");

// const statusText = require("../../utilities/status_text.js");
// const { vars } = require("../../utilities/constants");
// const {
//   isoDateStringToDDMMYYY,
//   isRequiredUnitActivityPresent,
// } = require("../../utilities/helper_functions");
// const Vertical = require("../../databases/mongodb/models/Vertical");

// // ! what if the user's activity field is not present, and we include it in the projection
// // todo: verify vertical id and correct unit srch for loop

// module.exports = router;
