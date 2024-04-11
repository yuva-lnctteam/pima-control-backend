const express = require("express");
const router = express.Router();
const cors = require("cors");
const mongoose = require("mongoose");
const basicAuth = require("express-basic-auth");
const xlsx = require("xlsx");
const fileUpload = require("express-fileupload");
require("dotenv").config();

// Basic Authentication middleware
const adminId = process.env.adminId;
const adminPassword = process.env.adminPassword;

const adminAuth = basicAuth({
  users: { [adminId]: adminPassword }, // Replace with actual admin credentials
  challenge: true, // Send a 401 Unauthorized response on failed authentication
  unauthorizedResponse: "Unauthorized", // Response message on failed authentication
});

// My models
const Admin = require("../../databases/mongodb/models/Admin");
const Vertical = require("../../databases/mongodb/models/Vertical");
const Course = require("../../databases/mongodb/models/Course");
const User = require("../../databases/mongodb/models/User");
const {ExcelUser} = require("../../databases/mongodb/models/ExcelUser")

const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");

// My utilities
const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin } = require("../../middlewares");

router.use(cors());
router.use(fileUpload());

// ! remove extra routes

router.post("/users/upload", async(req, res) => {

  try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
      }
    
      const uploadedFile = req.files.file;
      const workbook = xlsx.read(uploadedFile.data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      let data = xlsx.utils.sheet_to_json(sheet);
      
    // WRAP EVERYTHING IN TRY CATCH
    
      if(data.length == 0){
        res.status(404).json({ error: statusText.FILE_UPLOAD_FAIL, message: "Excel Sheet does not contain any data" });
      }
    
      const headObj = data[0];
      let name = Object.keys(headObj);
    
      const validName = ["S.No.", "Name", "Email"]
      
      // check if it is valid
      name = name.map((n) => n.trim())
    
      for(let i=0; i<validName.length; i++){
        if(name[i] != validName[i]){
          return res.status(400).json({ error: statusText.FILE_UPLOAD_FAIL, message: "Excel Sheet does not follow the correct format" })
        }
      }
    
      data = data.map((d) => ({name: d.Name, email: d.Email}));
      // console.log(data[0]);
      const op = await ExcelUser.insertMany(data);
    
      res.status(200).json({ statusText: statusText.SUCCESS, message: "Excel File uploaded Successfully"});
    
  } catch (error) {
    console.log(error);
    res.send("error");
  }

  console.log("On the excel route");

})

router.post("/dummy", adminAuth, async (req, res) => {
  //   console.log(req.body);

  try {
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(req.body.password, salt);
    req.body.password = newHashedPassword;

    await Admin.create(req.body);
    res.status(200).json({ statusText: statusText.LOGIN_IN_SUCCESS });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
  }
});

router.post(
  "/verify-token",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    res.status(200).json({ statusText: statusText.SUCCESS });
  }
);

//////////////////////////////////////// LOGIN ////////////////////////////////////////////////

router.post("/login", adminAuth, async (req, res) => {
  // todo : validation

  const adminId = req.body.adminId; // mongo works even if adminId and pass is an empty or undefined
  const enteredPassword = req.body.password;
  console.log("adminId: ", adminId);
  console.log("enteredPassword: ", enteredPassword);

  try {
    // match creds
    const adminDoc = await Admin.findOne({ adminId: adminId });
    console.log("**********",adminDoc);
    if (!adminDoc) {
      // wrong adminId
      return res
        .status(401)
        .json({ statusText: statusText.INVALID_CREDS, areCredsInvalid: true });
    }

    const hashedPassword = adminDoc.password;

    const isPasswordMatched = await bcrypt.compare(
      enteredPassword,
      hashedPassword
    );

    if (!isPasswordMatched) {
      // wrong password
      return res
        .status(400)
        .json({ statusText: statusText.INVALID_CREDS, areCredsInvalid: true });
    }

    // generate token
    const data = {
      exp: Math.floor(Date.now() / 1000) + vars.token.expiry.ADMIN_IN_SEC,
      person: {
        mongoId: adminDoc._id,
        role: "admin",
      },
    };

    const token = jwt.sign(data, process.env.JWT_SECRET);

    res
      .status(200)
      .json({ statusText: statusText.LOGIN_IN_SUCCESS, token: token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
});

/////////////////////////////////////////// All //////////////////////////////////////////

router.get(
  "/verticals/all",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // console.log(req.originalUrl);

    try {
      let allVerticals = await Vertical.find();
      // console.log(allVerticals);

      allVerticals = allVerticals.map((oldDoc) => {
        const newDoc = {
          _id: oldDoc._id,
          name: oldDoc.name,
          desc: oldDoc.desc,
          imgSrc: oldDoc.imgSrc,
          courseCount: oldDoc.courseIds.length,
        };

        return newDoc;
      });

      res
        .status(200)
        .json({ statusText: statusText.SUCCESS, allVerticals: allVerticals });
    } catch (err) {
      // console.log(err.message);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

//! validated
router.get(
  "/verticals/:verticalId/courses/all",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    const { verticalId } = req.params;
    // verticalId = null;

    try {
      const verticalDoc = await Vertical.findById(verticalId);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      // console.log(verticalDoc);

      let allCourses = await Course.find({
        _id: { $in: verticalDoc.courseIds },
      });
      // console.log(allCourses);

      allCourses = allCourses.map((oldDoc) => {
        const newDoc = {
          _id: oldDoc._id,
          name: oldDoc.name,
          desc: oldDoc.desc,
          unitCount: oldDoc.unitArr.length,
        };

        return newDoc;
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        verticalInfo: { name: verticalDoc.name, desc: verticalDoc.desc },
        allCourses: allCourses,
      });
    } catch (err) {
      // console.log(err);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

router.get(
  "/verticals/:verticalId/courses/:courseId/units/all",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    // console.log(req.originalUrl);

    const { courseId } = req.params;

    try {
      const courseDoc = await Course.findById(courseId);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      // console.log(courseDoc);

      let allUnits = courseDoc.unitArr;
      allUnits = allUnits.map((oldDoc) => {
        const newDoc = {
          _id: oldDoc._id,
          video: {
            title: oldDoc.video.title,
            desc: oldDoc.video.desc,
            vdoSrc: oldDoc.video.vdoSrc,
          },
          activityCount: oldDoc.activities.length,
          quizCount: oldDoc.quiz.length,
        };

        return newDoc;
      });

      res
        .status(200)
        .json({ statusText: statusText.SUCCESS, allUnits: allUnits });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

/////////////////////////////////////////// ADD ///////////////////////////////////////////

//! validated
router.post(
  "/verticals/add",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // no validation needed mongodb will handle even if name, desc, src is null/empty
    // console.log(req.body);
    // const { name, desc, imgSrc } = req.body;

    try {
      await Vertical.create(req.body);
      res.status(200).json({ statusText: statusText.VERTICAL_CREATE_SUCCESS });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

//! validated, doubt
router.post(
  "/verticals/:verticalId/courses/add",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    const { verticalId } = req.params;

    try {
      const courseDoc = await Course.create(req.body);
      // console.log(courseDoc);

      const verticalDoc = await Vertical.findOneAndUpdate(
        { _id: verticalId },
        { $push: { courseIds: courseDoc._id } },
        { new: true }
      );

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      // console.log(verticalDoc); // new = true to return the updated doc

      res.status(200).json({ statusText: statusText.COURSE_CREATE_SUCCESS });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

// ! validated, doubt
router.post(
  "/verticals/:verticalId/courses/:courseId/units/add",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // console.log(req.originalUrl);

    // todo : validation
    let unit = req.body;
    let { courseId } = req.params;

    // ! manually check and add field in unit doc
    // unit = {
    //   video: {
    //     title: "a",
    //     desc: "a",
    //     vdoSrc: "",
    //   },
    // };

    // courseId = "640186d18eb87edf965c9941";

    try {
      // const courseDoc = await Course.findOneAndUpdate(
      //   { _id: courseId }
      //   { $push: { unitArr: unit } },
      //   { new: true }
      // );

      const courseDoc = await Course.findById(courseId);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      console.log("*********",unit);

      courseDoc.unitArr.push(unit);
      courseDoc.save((err, updatedCourseDoc) => {
        if (err) {
          // console.error("apoorv", err.message);

          res
            .status(500)
            .json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        } else {
          // console.log(updatedCourseDoc);

          res.status(200).json({ statusText: statusText.UNIT_CREATE_SUCCESS });
        }
      });

      // console.log(courseDoc); // new = true to return the updated doc
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

//////////////////////////////////////// DELETE //////////////////////////////////////////

//! validated
router.delete(
  "/verticals/:verticalId/delete",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // no validation needed mongodb will handle even if verticalId is null(404)/empty string

    // todo : validation
    const { verticalId } = req.params;

    try {
      const verticalDoc = await Vertical.findByIdAndDelete(verticalId); // returns the doc just before deletion
      // console.log(verticalDoc);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      await Course.deleteMany({
        _id: { $in: verticalDoc.courseIds },
      });

      res.status(200).json({ statusText: statusText.VERTICAL_DELETE_SUCCESS });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

//! validated
router.delete(
  "/verticals/:verticalId/courses/:courseId/delete",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation

    const { verticalId, courseId } = req.params;
    // console.log(courseId);

    const objectCourseId = mongoose.Types.ObjectId(courseId); // imp to convert to string to objectId

    try {
      const courseDoc = await Course.findByIdAndDelete(courseId);
      // console.log(courseDoc);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      const verticalDoc = await Vertical.findOneAndUpdate(
        { _id: verticalId },
        {
          $pull: {
            courseIds: { $in: [objectCourseId] },
          },
        },
        { new: true }
      );
      // new = true to return updated doc

      // console.log(verticalDoc);

      res.status(200).json({ statusText: statusText.COURSE_DELETE_SUCCESS });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

//! validated
router.delete(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/delete",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    const { verticalId, courseId, unitId } = req.params;
    const unitObjectId = mongoose.Types.ObjectId(unitId);

    try {
      const courseDoc = await Course.findOneAndUpdate(
        { _id: courseId },
        {
          $pull: {
            unitArr: { _id: unitObjectId },
          },
        },
        { new: true }
      );

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      console.log("***********",courseDoc.unitArr.length);

      res.status(200).json({ statusText: statusText.UNIT_DELETE_SUCCESS });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

// router.post("/add-users", csvUpload(), async (req, res) => {
//   console.log(req.originalUrl);
//   // ! todo: SEND MAILS

//   try {
//     const input = req.files.userCreds.data; // csvUploads (in index.js) file adds file to req.files
//     const options = {};
//     parse(input, options, (err, records) => {
//       if (err) {
//         console.log(err);
//         res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
//       } else {
//         console.log(records);

//         try {
//           // create users and send bulk emails
//         } catch (err) {
//           console.log(err);
//         }
//         res.status(200).json({ statusText: statusText.SUCCESS });
//       }
//     });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
//   }
// });

/********************************************** EDIT ****************************************************/

router.patch(
  "/verticals/:verticalId/edit",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    const { verticalId } = req.params;

    try {
      const verticalDoc = await Vertical.findById(verticalId);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      // console.log(verticalDoc);

      verticalDoc.findOneAndUpdate({ _id: verticalId }, {});

      let allCourses = await Course.find({
        _id: { $in: verticalDoc.courseIds },
      });
      // console.log(allCourses);

      allCourses = allCourses.map((oldDoc) => {
        const newDoc = {
          _id: oldDoc._id,
          name: oldDoc.name,
          desc: oldDoc.desc,
          unitCount: oldDoc.unitArr.length,
        };

        return newDoc;
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        verticalInfo: { name: verticalDoc.name, desc: verticalDoc.desc },
        allCourses: allCourses,
      });
    } catch (err) {
      // console.log(err);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

router.get("/users/all", adminAuth, fetchPerson, isAdmin, async (req, res) => {
  // todo : paginate, the user count is too high
  let {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "fName",
    sortType = "asc",
    collegeName = "",
  } = req.query;

  page = parseInt(page);

  try {
    const totalDocs = await User.find({
      $or: [
        { fName: { $regex: new RegExp(search, "i") } },
        { userId: { $regex: new RegExp(search, "i") } },
      ],
      collegeName: { $regex: new RegExp(collegeName, "i") },
    }).countDocuments();

    const filteredUsers = await User.find({
      $or: [
        { fName: { $regex: new RegExp(search, "i") } },
        { userId: { $regex: new RegExp(search, "i") } },
      ],
      collegeName: { $regex: new RegExp(collegeName, "i") },
    })
      .select("-password")
      .sort({ [sortBy]: sortType === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      statusText: statusText.SUCCESS,
      page: page,
      totalPages: Math.ceil(totalDocs / limit),
      limit: limit,
      hasNextPage: page * limit < totalDocs,
      filteredUsers,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ statusText: statusText.FAIL });
  }
});

router.get(
  "/users/college-names",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    const { search } = req.query;
    try {
      let collegeNames = await User.aggregate([
        {
          $match: {
            collegeName: { $regex: new RegExp(search, "i") },
          },
        },
        {
          $group: {
            _id: "$collegeName",
          },
        },
      ]);

      collegeNames = collegeNames.map((clg) => clg?._id);

      // console.log("**********",collegeNames);

      return res
        .status(200)
        .json({ statusText: statusText.SUCCESS, collegeNames });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

router.get(
  "/users/:userId",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    let { userId } = req.params;
    if (userId == "")
      res
        .status(400)
        .json({ statusText: statusText.FAIL, message: "userId is empty" });

    try {
      let user = await User.findOne({ userId }).select("-password");
      if (!user) {
        return res
          .status(404)
          .json({ statusText: statusText.FAIL, message: "user not found" });
      }

      const vertNames = await Vertical.find().select("_id name");
      const vertMap = {};
      const vertData = {};
      vertNames.forEach((vert) => {
        vertMap[vert._id] = vert.name;
        vertData[vert.name] = 0;
      });

      let activity = user.activity;
      for (let vertical in activity) {
        let ct = 0;
        for (let course in activity[vertical]) {
          for (let unit in activity[vertical][course]) {
            for (let quiz in activity[vertical][course][unit]) {
              const quizScore =
                activity[vertical][course][unit].quiz.scoreInPercent;
              if (quizScore >= 60) {
                ct += 1;
              }
            }
          }
        }

        vertData[vertMap[vertical.substring(1)]] = ct;
      }

      // remove activity from user object
      user.activity = vertData;

      return res.status(200).json({
        statusText: statusText.SUCCESS,
        user: { ...user._doc },
      });
    } catch (err) {
      return res
        .status(200)
        .json({ statusText: statusText.FAIL, message: "Invalid userId" });
    }
  }
);

module.exports = router;
