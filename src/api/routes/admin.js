const express = require("express");
const router = express.Router();
const cors = require("cors");
const mongoose = require("mongoose");
const basicAuth = require("express-basic-auth");
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

const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");

// My utilities
const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin, upload } = require("../../middlewares");
const {
  uploadOnCloudinary,
  deleteFromCloudinary,
} = require("../../utilities/cloudinary.js");

router.use(cors());

// ! remove extra routes

router.post("/dummy", adminAuth, async (req, res) => {
  //   console.log(req.body);

  try {
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(req.body.password, salt);
    req.body.password = newHashedPassword;

    await Admin.create(req.body);
    res.status(200).json({ statusText: statusText.LOGIN_IN_SUCCESS });
  } catch (error) {
    console.log("------", error.message);
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

router.post(
  "/register-user",
  adminAuth,
  upload.single("userImg"),
  async (req, res) => {
    const regisForm = req.body;

    try {
      let userImgPath = req.file?.path;
      let image = null;
      if (userImgPath) {
        const imageUploaded = await uploadOnCloudinary(userImgPath, "users");
        if (!imageUploaded) {
          return res.status(501).send({
            statusText: "Your file could not be uploaded.",
          });
        }
        image = {
          src: imageUploaded?.url,
          publicId: imageUploaded.public_id,
        };
      }

      regisForm.image = image;

      await User.create(regisForm);
      res.status(200).json({
        statusText: statusText.REGISTRATION_SUCCESS,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
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
    console.log("**********", adminDoc);
    if (!adminDoc) {
      // wrong adminId
      return res.status(401).json({
        statusText: statusText.INVALID_CREDS,
        areCredsInvalid: true,
      });
    }

    const hashedPassword = adminDoc.password;

    const isPasswordMatched = await bcrypt.compare(
      enteredPassword,
      hashedPassword
    );

    if (!isPasswordMatched) {
      // wrong password
      return res.status(400).json({
        statusText: statusText.INVALID_CREDS,
        areCredsInvalid: true,
      });
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

    res.status(200).json({
      statusText: statusText.LOGIN_IN_SUCCESS,
      token: token,
    });
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
          image: oldDoc.image,
          courseCount: oldDoc.courseIds.length,
        };

        return newDoc;
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        allVerticals: allVerticals,
      });
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
          image: oldDoc.image,
          unitCount: oldDoc.unitArr.length,
        };

        return newDoc;
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        verticalInfo: {
          name: verticalDoc.name,
          desc: verticalDoc.desc,
        },
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

      res.status(200).json({
        statusText: statusText.SUCCESS,
        allUnits: allUnits,
      });
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
  upload.single("verticalImg"),
  async (req, res) => {
    // no validation needed mongodb will handle even if name, desc, src is null/empty
    // console.log(req.body);
    // const { name, desc, imgSrc } = req.body;

    try {
      let verticalImgPath = req.file?.path;

      if (verticalImgPath) {
        const verticalImageUploaded = await uploadOnCloudinary(
          verticalImgPath,
          "verticals"
        );

        if (!verticalImageUploaded) {
          res.status(501).send({
            statusText: "Your file could not be uploaded.",
          });
        }

        let image = {
          src: verticalImageUploaded?.url,
          publicId: verticalImageUploaded.public_id,
        };

        await Vertical.create({
          ...req.body,
          image,
        });

        return res.status(200).json({
          statusText: statusText.VERTICAL_CREATE_SUCCESS,
        });
      }

      await Vertical.create({
        ...req.body,
      });

      return res.status(200).json({
        statusText: statusText.VERTICAL_CREATE_SUCCESS,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.patch(
  "/verticals/:verticalId",
  adminAuth,
  fetchPerson,
  isAdmin,
  upload.single("verticalImg"),
  async (req, res) => {
    const { verticalId } = req.params;
    let { name, desc } = req.body;

    let update = {};

    if (name) {
      update.name = name;
    }

    if (desc) {
      update.desc = desc;
    }

    // verticalId = null;

    let verticalImgPath = req.file?.path;

    try {
      let verticalDoc = await Vertical.findById(verticalId);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      if (verticalImgPath) {
        // delete previous image
        if (verticalDoc?.image?.publicId) {
          await deleteFromCloudinary(verticalDoc.image?.publicId);
        }

        // upload new image

        const verticalImageUploaded = await uploadOnCloudinary(
          verticalImgPath,
          "verticals"
        );

        if (!verticalImageUploaded) {
          res.status(501).send({
            statusText: "Your file could not be uploaded.",
          });
        }

        let image = {
          src: verticalImageUploaded?.url,
          publicId: verticalImageUploaded.public_id,
        };

        update.image = image;
      }

      verticalDoc = await Vertical.findByIdAndUpdate(verticalId, update, {
        new: true,
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        verticalInfo: {
          name: verticalDoc.name,
          desc: verticalDoc.desc,
          image: verticalDoc.image,
        },
      });
    } catch (err) {
      // console.log(err);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

router.patch(
  "/verticals/:verticalId/courses/:courseId",
  adminAuth,
  fetchPerson,
  isAdmin,
  upload.single("courseImg"),
  async (req, res) => {
    // todo : validation
    try {
      const { verticalId, courseId } = req.params;

      let courseImgPath = req.file?.path;

      let update = {};

      if (courseImgPath) {
        // delete previous image
        const courseDoc = await Course.findById(courseId);
        if (courseDoc?.image?.publicId) {
          await deleteFromCloudinary(courseDoc.image?.publicId);
        }

        // upload new image
        const courseImageUploaded = await uploadOnCloudinary(
          courseImgPath,
          "courses"
        );

        if (!courseImageUploaded) {
          res.status(501).send({
            statusText: "Your file could not be uploaded.",
          });
        }

        let image = {
          src: courseImageUploaded?.url,
          publicId: courseImageUploaded.public_id,
        };

        update.image = image;
      }

      update.name = req.body.name;
      update.desc = req.body.desc;

      const courseDoc = await Course.findByIdAndUpdate(courseId, update, {
        new: true,
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        courseInfo: {
          name: courseDoc.name,
          desc: courseDoc.desc,
          image: courseDoc.image,
        },
      });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

//! validated, doubt
router.post(
  "/verticals/:verticalId/courses/add",
  adminAuth,
  fetchPerson,
  isAdmin,
  upload.single("courseImg"),
  async (req, res) => {
    // todo : validation
    try {
      const { verticalId } = req.params;

      let courseImgPath = req.file?.path;
      const course = req.body;
      if (courseImgPath) {
        const courseImageUploaded = await uploadOnCloudinary(
          courseImgPath,
          "courses"
        );

        if (!courseImageUploaded) {
          res.status(501).send({
            statusText: "Your file could not be uploaded.",
          });
        }

        let image = {
          src: courseImageUploaded?.url,
          publicId: courseImageUploaded.public_id,
        };

        course.image = image;
      }

      const courseDoc = await Course.create(course);
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

      res.status(200).json({
        statusText: statusText.COURSE_CREATE_SUCCESS,
      });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
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
      const courseDoc = await Course.findById(courseId);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      courseDoc.unitArr.push(unit);
      await courseDoc.save();

      res.status(200).json({
        statusText: statusText.UNIT_CREATE_SUCCESS,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
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
      const vertical = await Vertical.findById(verticalId);
      if (!vertical) {
        return res.status(401).send({
          statusText: "Vertical Not Found",
        });
      }

      // deleting from cloudinary the image
      if (vertical?.image?.publicId) {
        await deleteFromCloudinary(vertical.image?.publicId);
      }

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

      res.status(200).json({
        statusText: statusText.VERTICAL_DELETE_SUCCESS,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
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
      const courseDoc = await Course.findById(courseId);
      // console.log(courseDoc);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      if (courseDoc?.image?.publicId) {
        // deleting from cloudinary the image
        await deleteFromCloudinary(courseDoc.image?.publicId);
      }

      // deleting the course
      await Course.findByIdAndDelete(courseId);
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

      res.status(200).json({
        statusText: statusText.COURSE_DELETE_SUCCESS,
      });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
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

      console.log("***********", courseDoc.unitArr.length);

      res.status(200).json({
        statusText: statusText.UNIT_DELETE_SUCCESS,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.get(
  "/verticals/:verticalId/courses/:courseId/units/:unitId",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    const { verticalId, courseId, unitId } = req.params;

    try {
      const courseDoc = await Course.findById(courseId);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      const unit = courseDoc.unitArr.find((unit) => unit._id == unitId);

      if (!unit) {
        return res.status(404).json({ statusText: statusText.UNIT_NOT_FOUND });
      }

      res.status(200).json({
        statusText: statusText.SUCCESS,
        unit,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.put(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/edit",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    const { verticalId, courseId, unitId } = req.params;
    let unit = req.body;

    let changedPdf = req.query.pdf;

    if (!unit.video) {
      return res.status(400).json({
        statusText: "Video details are required",
      });
    }

    try {
      let courseDocRead = await Course.findById(courseId);

      if (!courseDocRead) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      let unitIndex = courseDocRead.unitArr.findIndex(
        (unit) => unit._id == unitId
      );

      if (unitIndex === -1) {
        return res.status(404).json({ statusText: statusText.UNIT_NOT_FOUND });
      }

      // deleting files from cloudinary of pdf

      if (
        courseDocRead.unitArr[unitIndex].pdf?.publicId &&
        changedPdf === "true"
      ) {
        await deleteFromCloudinary(
          courseDocRead.unitArr[unitIndex].pdf?.publicId
        );
      }

      courseDocRead.unitArr[unitIndex] = unit;
      await courseDocRead.save();

      res.status(200).json({
        statusText: statusText.UNIT_CREATE_SUCCESS,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
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
        verticalInfo: {
          name: verticalDoc.name,
          desc: verticalDoc.desc,
        },
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

router.patch(
  "/users/:userId/toggle-suspend-user",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await User.findOne({ userId: userId });

      if (!user) {
        return res.status(404).json({
          statusText: "User not found",
        });
      }

      if (user.isSuspended) {
        user.isSuspended = false;
        await user.save();
        return res.status(200).json({
          statusText: "User unsuspended successfully",
        });
      }

      user.isSuspended = true;
      await user.save();

      return res.status(200).json({
        statusText: "User suspended successfully",
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

router.patch(
  "/users/reset-password/:userId",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const password = req.body.password;

      if (!password) {
        return res.status(404).send({
          statusText: "Password not found",
        });
      }

      if (password === "") {
        return res.status(404).send({
          statusText: "Password could not be empty",
        });
      }

      // changing the password for the users
      const user = await User.findOne({
        userId: userId,
      });

      if (!user) {
        return res.status(404).send({
          statusText: "User Not Found",
        });
      }

      user.password = password;
      await user.save();

      return res.status(200).send({
        statusText: "Password Updated successfully",
      });
    } catch (err) {
      return res.status(501).send({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.delete(
  "/users/delete-user/:userId",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      let user = await User.findOne({
        userId: userId,
      });
      if (!user) {
        return res.status(404).send({
          statusText: "User Not Found",
        });
      }

      await User.deleteOne({
        userId: userId,
      });

      return res.status(200).send({
        statusText: "User Deleted Successfully",
      });
    } catch (err) {
      res.status(501).send({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.get(
  "/users/profile/:userId",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    let { userId } = req.params;

    try {
      let user = await User.findOne({
        userId: userId,
      });

      if (!user) {
        return res.status(404).send({
          statusText: "User not found",
        });
      }

      if (!user.activity || user.activity == {}) {
        return res.status(200).send({
          statusText: "Success",
          data: {
            user: {
              ...user._doc,
              activity: {},
            },
            allVerticalsData: [],
          },
        });
      }

      let activity = user.activity;

      let allUnitsData = [];
      for (let vertical in activity) {
        const id = vertical.slice(1);
        let verticalData = await Vertical.findById(id);

        for (let course in activity[vertical]) {
          let courseId = course.slice(1);
          let courseData = await Course.findById(courseId);

          for (let unit in activity[vertical][course]) {
            let unitId = unit.slice(1);
            // let unitData = await Course.findById(unitId);
            let unitData = courseData.unitArr.find(
              (unit) => unit._id == unitId
            );
            
            allUnitsData.push({
              courseData: {
                _id: courseData._id,
                name: courseData.name,
              },
              verticalData: {
                _id: verticalData._id,
                name: verticalData.name,
              },
              unitData: {
                _id: unitData._id,
                name: unitData.video.title,
                progress: activity[vertical][course][unit],
              },
            });
          }
        }
      }

      allUnitsData = allUnitsData.sort((a, b) => {
        return new Date(b.unitData.progress.lastVisited).getTime() - new Date(a.unitData.progress.lastVisited).getTime();
      })

      return res.status(200).send({
        statusText: "Success",
        data: {
          user: {
            ...user._doc,
            activity: {},
          },
          allUnitsData,
        },
      });
    } catch (err) {
      console.log(err);
      return res.status(500).send({
        statusText: "Internal Server Error",
        error: err.message,
      });
    }
  }
);

router.post(
  "/upload-pdf",
  adminAuth,
  fetchPerson,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      let pdfPath = req.file?.path;
      if (!pdfPath) {
        return res.status(501).json({
          statusText: "PDF not provided",
        });
      }

      const pdfUploaded = await uploadOnCloudinary(pdfPath, "pdfs");

      if (!pdfUploaded) {
        return res.status(501).send({
          statusText: "Your file could not be uploaded.",
        });
      }

      return res.status(200).json({
        statusText: statusText.SUCCESS,
        pdf: {
          url: pdfUploaded.url,
          publicId: pdfUploaded.public_id,
        },
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

module.exports = router;
