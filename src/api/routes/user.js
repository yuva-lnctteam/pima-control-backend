const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const basicAuth = require("express-basic-auth");

// require("dotenv").config();
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
// const sharp = require("sharp");

// My models
const User = require("../../databases/mongodb/models/User");
const Vertical = require("../../databases/mongodb/models/Vertical");
const Course = require("../../databases/mongodb/models/Course");

// Basic Authentication middleware
const userId = process.env.userId;
const userPassword = process.env.userPassword;

const userAuth = basicAuth({
  users: { [userId]: userPassword },
  challenge: true,
  unauthorizedResponse: "Unauthorized",
});

// My middlewares
const {
  fetchPerson,
  isUser,
  isEligibleToTakeQuiz,
  isUnitIdValid,
  doesQuizExist,
  doesUnitActivityExist,
  upload,
} = require("../../middlewares");

// My utilities
const statusText = require("../../utilities/status_text.js");
const { vars } = require("../../utilities/constants.js");
const {
  encodeCertificateId,
  generateFirebasePublicURL,
  // getUserActivityDefaultObj,
  addRequiredUnitActivity,
  isRequiredUnitActivityPresent,
} = require("../../utilities/helper_functions.js");
const {
  uploadOnCloudinary,
  deleteFromCloudinary,
} = require("../../utilities/cloudinary.js");

/******************** My Configs **********************/
// Multer
// const upload = require("../../config/multer_config");
// console.log(upload);

// Firebase
// const bucket = require("../../databases/firebase/config");

// ! Dont bind data to req, bind them to res, change this at all routes and middlewares reference: https://stackoverflow.com/questions/18875292/passing-variables-to-the-next-middleware-using-next-in-express-js
// todo: only send statusText and not error field in response

/////////////////////////////////////////////////////////////////////////////////////////////////

// router.post("/dummy", async (req, res) => {
//   console.log(req);
//   console.log("skfjnksnsf");
//   try {
//     const salt = await bcrypt.genSalt(10);
//     const newHashedPassword = await bcrypt.hash(req.body.password, salt);
//     req.body.password = newHashedPassword;

//     await User.create(req.body);
//     res.status(200).json({ statusText: statusText.LOGIN_IN_SUCCESS });
//   } catch (error) {
//     console.log(error.message);
//     res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
//   }
// });

// router.post('/update-password', async (req, res)=>{
//     const userId = req.body.id;
//     const newPass = req.body.password;
//     const salt = await bcrypt.genSalt(vars.bcryptSaltRounds);
//     const hashedPassword = await bcrypt.hash(newPass, salt);

//     const userr = await User.findById(userId);
//     console.log(userr);
//     console.log(newPass);
//     console.log(hashedPassword);

//     const updatedUser = await User.findByIdAndUpdate(userId, {password: hashedPassword}, {new: true});

//     res.json({});

// })

// Since main portal in the register form has no input field for username, username by default is email, and it can also login from email or username both. So here, we have to also handle case where user don't have username and wants to login. "Allow login with email also".
router.post("/login", userAuth, async (req, res) => {
  // console.log("login request received: ", req.body);
  // todo : validation
  // console.log(req.originalUrl);
  // console.log(req.body);

  //userId can be email too....
  let userIdOrEmail = req.body.userId; // mongo works even if userId and pass are empty, undefined, or null
  let enteredPassword = req.body.password;

  try {
    //!new
    //* Find the user in Portal's DB, if present just match the password and login, no need to access main portal's API.
    //* Special case handled below, if the user's password is changed later on the Yuva Portal, and main portal had not updated the password.

    let userDoc1 = await User.findOne({
      $or: [{ userId: userIdOrEmail }, { email: userIdOrEmail }],
    });

    if (!userDoc1) {
      return res.status(404).json({ statusText: "User Not Found" });
    }

    if (userDoc1?.isSuspended) {
      return res.status(403).json({ statusText: "Your account is suspended" });
    }

    if (userDoc1.password !== enteredPassword) {
      return res.status(401).json({ statusText: "Incorrect Password" });
    }

    console.log(userDoc1);
    //Generate token and login
    const data1 = {
      exp: Math.floor(Date.now() / 1000) + vars.token.expiry.USER_IN_SEC,
      person: {
        mongoId: userDoc1._id,
        role: "user",
      },
    };

    const token1 = jwt.sign(data1, process.env.JWT_SECRET);

    return res.status(200).json({
      statusText: statusText.LOGIN_IN_SUCCESS,
      token: token1,
    });
  } catch (err) {
    console.log(err.message);

    res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
  }
});

router.post("/update-user", userAuth, fetchPerson, isUser, async (req, res) => {
  const updatedDoc = req.body;

  console.log(updatedDoc);
  try {
    let presentUserDoc = await User.findOne({ email: updatedDoc.email });

    if (presentUserDoc && presentUserDoc._id != req.mongoId) {
      return res.status(409).json({ statusText: "Email already exists" });
    }

    presentUserDoc = await User.findOne({ userId: updatedDoc.userId });

    if (presentUserDoc && presentUserDoc._id != req.mongoId) {
      return res.status(409).json({ statusText: "Username already exists" });
    }

    let userDoc = await User.findByIdAndUpdate(req.mongoId, updatedDoc, {
      new: true,
    });

    if (!userDoc) {
      return res.status(404).json({ statusText: "User not found" });
    }

    return res
      .status(200)
      .json({ statusText: "Profile updated", userDoc: userDoc });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/edit-profile-pic",
  userAuth,
  fetchPerson,
  isUser,
  upload.single("userImg"),
  async (req, res) => {
    const mongoId = req.mongoId;

    try {
      let user = await User.findById(mongoId);

      //   console.log(user)
      if (!user) {
        return res.status(404).json({ statusText: "User not found" });
      }

      // delete old image from cloudinary
      if (user.image.publicId) {
        await deleteFromCloudinary(user.image.publicId);
      }

      let userImgPath = req.file?.path;
      if (!userImgPath) {
        return res.status(501).json({
          statusText: statusText.INTERNAL_SERVER_ERROR,
        });
      }

      const userImg = await uploadOnCloudinary(userImgPath, "users");

      if (!userImg) {
        res.status(501).send({
          statusText: "Your file could not be uploaded.",
        });
      }

      let image = {
        src: userImg?.url,
        publicId: userImg.public_id,
      };

      let updatedUser = await User.findByIdAndUpdate(
        mongoId,
        { image },
        { new: true }
      );

      res
        .status(200)
        .json({ statusText: "Profile pic updated", userDoc: updatedUser });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.post(
  "/reset-password",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    // user is already logged in, so we dont need userId
    // console.log(req.originalUrl);

    const { currPassword, newPassword } = req.body;
    const mongoId = req.mongoId;

    try {
      const userDoc = await User.findById(mongoId);

      if (userDoc.isPassReset) {
        return res.status(403).json({
          statusText: statusText.PASS_RESET_ALREADY,
          isPassReset: true,
        });
      }

      // const hashedPassword = userDoc.password;
      // const passwordCompare = await bcrypt.compare(
      //   currPassword,
      //   hashedPassword
      // );

      // if (!passwordCompare) {
      //   return res.status(401).json({
      //     statusText: statusText.CURRENT_PASS_INCORRECT,
      //     isCurrPasswordIncorrect: true,
      //   });
      // }

      // const salt = await bcrypt.genSalt(10);
      // const newHashedPassword = await bcrypt.hash(newPassword, salt);

      await User.findByIdAndUpdate(
        mongoId,
        { password: newPassword, isPassReset: true },
        { overwrite: false }
      );

      res.status(200).json({ statusText: statusText.PASS_RESET_SUCCESS });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.post(
  "/verify-token",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    // console.log(req.originalUrl);

    try {
      const userDoc = await User.findById(req.mongoId)
        .select("-_id -password -activity")
        .exec();
      return res.status(200).json({
        statusText: statusText.VERIFIED_TOKEN,
        userDoc: userDoc,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

//!TO DELETE
// router.get("/add-data", async (req, res)=>{
//     const allUsers = await User.find();
//     for(let i = 0; i<allUsers.length; i++){
//         console.log("USER ", i+1);
//         let activity = allUsers[i].activity;

//         for(vertical in activity){
//             for(course in activity[vertical]){
//                 for(unit in activity[vertical][course]){
//                     for(quiz in activity[vertical][course][unit]){
//                         const quizScore = activity[vertical][course][unit].quiz.scoreInPercent;
//                         if(quizScore>=60){
//                             const verticalId = vertical.slice(1);
//                             await Vertical.findByIdAndUpdate(verticalId, { $inc: { certUnlocked: 1 } });
//                         }
//                     }
//                 }
//             }
//         }
//         // if(i==3)break;
//     }
//     res.end();
// })

// ! validated
router.get("/verticals/all", userAuth, async (req, res) => {
  // todo: verify role, reason: a student can paste the url on browser and potray himself as an admin
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
        // certUnlocked: oldDoc.certUnlocked ? oldDoc.certUnlocked : 0,
      };

      return newDoc;
    });

    // console.log(allVerticals);

    res.status(200).json({
      statusText: statusText.SUCCESS,
      allVerticals: allVerticals,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ statusText: statusText.FAIL });
  }
});

//! validated
router.get(
  "/verticals/:verticalId/courses/all",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    const { verticalId } = req.params;

    try {
      const verticalDoc = await Vertical.findById(verticalId);
      // console.log(verticalDoc);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      let allCourses = await Course.find({
        _id: { $in: verticalDoc.courseIds },
      });

      allCourses = allCourses.map((oldDoc) => {
        const newDoc = {
          _id: oldDoc._id,
          name: oldDoc.name,
          desc: oldDoc.desc,
          unitCount: oldDoc.unitArr.length,
          image: oldDoc.image,
        };

        return newDoc;
      });

      // console.log(allCourses.length);

      res.status(200).json({
        statusText: statusText.SUCCESS,
        allCourses: allCourses,
        verticalDoc: { name: verticalDoc.name, desc: verticalDoc.desc },
      });
    } catch (err) {
      // console.log(err);
      res.status(500).json({ statusText: statusText.FAIL });
    }
  }
);

// ! validated
router.get(
  "/verticals/:verticalId/courses/:courseId/units/all",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    const { courseId } = req.params;

    try {
      const courseProj = {
        name: 1,
        desc: 1,
        unitArr: 1,
        _id: 0,
      };

      const courseDoc = await Course.findById(courseId, courseProj);

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
          image: oldDoc.image,
        };

        return newDoc;
      });

      res.status(200).json({
        statusText: statusText.SUCCESS,
        allUnits: allUnits,
        courseInfo: { name: courseDoc.name, desc: courseDoc.desc },
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * ! need to verify whether coursedoc exists or not
 * ! case: quiz is present in the unit or not, if no quiz then no cert
 * ! if no quiz then also this route works and even calculates whether user if eligible to take quiz/cert or not
 * ! if there's no quiz then no quiz/cert card is displayed on the frontend page
 * ! and if user directly enters the url of a quiz, which belongs to a unit with no quiz
 * ! that frontend quiz page can handle it on its own
 */

//! validated

//certificate Id route
// router.get(
//   "/verticals/:verticalId/courses/:courseId/units/:unitId/get-cert-id",
//   userAuth,
//   fetchPerson,
//   isUser,
//   async (req, res) => {
//     const { verticalId, courseId, unitId } = req.params;
//     const mongoId = req.mongoId;
//     try {
//       const certId = encodeCertificateId(mongoId, verticalId, courseId, unitId);
//       res.status(200).json({ success: true, certId });
//     } catch (error) {
//       res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
//     }
//   }
// );

router.get(
  "/verticals/:verticalId/courses/:courseId/units/:unitId",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    // todo : validation
    // console.log(req.originalUrl);

    const { verticalId, courseId, unitId } = req.params;
    const mongoId = req.mongoId;
    // console.log(mongoId);

    try {
      // find course and then the required unit from the unitArr of that course
      const courseProj = {
        name: 1,
        unitArr: 1,
      };

      const courseDoc = await Course.findById(courseId, courseProj);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      let unit = null;
      courseDoc.unitArr.forEach((singleUnit) => {
        if (singleUnit._id == unitId) {
          unit = singleUnit;
        }
      });

      const userProj = {
        fName: 1,
        mName: 1,
        lName: 1,
        activity: 1,
      };

      // find user doc and decide whether user is eligible to take quiz  or get certificate
      // cannot use eligible-middleware here because if he is not eligible then we just need to disable btn and display the page too, in other pages we redirect

      const userDoc = await User.findById(mongoId, userProj);

      // console.log(userDoc);

      let isEligibleToTakeQuiz = false;
      // let isCertGenerated = false;

      /* 
            we dont want to put values in isEligibleToTakeQuiz, isCertGenerated by comparing with default values 
            like scoreInPercent which is -1, because what to keep as default values might change in the future
            */
      if (
        isRequiredUnitActivityPresent(userDoc, verticalId, courseId, unitId)
      ) {
        const unitActivity =
          userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];

        isEligibleToTakeQuiz =
          unitActivity.video.watchTimeInPercent >=
          vars.activity.MIN_WATCH_TIME_IN_PERCENT;

        userDoc.activity[`v${verticalId}`][`c${courseId}`][
          `u${unitId}`
        ].lastVisited = new Date().toISOString();
      } else {
        // add default unit activity field to the user doc
        addRequiredUnitActivity(userDoc, verticalId, courseId, unitId);
        if (!unit.video.vdoSrc || unit.video.vdoSrc === "") {
          userDoc.activity[`v${verticalId}`][`c${courseId}`][
            `u${unitId}`
          ].video.watchTimeInPercent = 100;
          isEligibleToTakeQuiz = true;
        }

        userDoc.activity[`v${verticalId}`][`c${courseId}`][
          `u${unitId}`
        ].lastVisited = new Date().toISOString();
      }

      await User.findByIdAndUpdate(mongoId, {
        activity: userDoc.activity,
      });
      // console.log("isCertGenerated: ", isCertGenerated);

      // we need courseInfo and userInfo for the "Get certificate button" which redirects on the cert's url and url contains courseId, unitId, userId
      // const certId = encodeCertificateId(
      //   userDoc._id,
      //   verticalId,
      //   courseDoc._id,
      //   unit._id
      // );
      // console.log(certId);

      const unitActivity =
        userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];

      const storedWatchPercentage = unitActivity.video.watchTimeInPercent;
      // console.log("storedWatchPercentage: ", storedWatchPercentage);
      res.status(200).json({
        statusText: statusText.SUCCESS,
        // certId: certId,
        unit: unit,
        isEligibleToTakeQuiz: isEligibleToTakeQuiz,
        // isCertGenerated: isCertGenerated,
        storedWatchPercentage: storedWatchPercentage,
        videoWatchTimeCutoffPercentage: vars.activity.MIN_WATCH_TIME_IN_PERCENT,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

//! MAJOR CHANGE: Now the watch percentage we get from client is the overall total percentage instead of add on
router.post(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/video/update-progress",
  userAuth,
  fetchPerson,
  isUser,
  isUnitIdValid,
  async (req, res) => {
    try {
      const { verticalId, courseId, unitId } = req.params;
      const { vdoWatchTimeInPercent } = req.body;
      // console.log(vdoWatchTimeInPercent);
      // console.log("vdoWatchTimeInPercent: ", vdoWatchTimeInPercent);
      const mongoId = req.mongoId;

      const userDoc = await User.findById(mongoId);

      addRequiredUnitActivity(userDoc, verticalId, courseId, unitId); // adds only if not present

      const unitActivity =
        userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];
      // unitActivity is a reference var to userDoc.activity[vKey][ckey][uKey]

      // newPercent = oldPercent + latest(current)
      // unitActivity.video.watchTimeInPercent += vdoWatchTimeInPercent; // this line updates userDoc
      //! Point where the major change occurs
      unitActivity.video.watchTimeInPercent = vdoWatchTimeInPercent; // this line updates userDoc

      const updatedDoc = await User.findByIdAndUpdate(mongoId, userDoc, {
        new: true,
      });

      res.status(200).json({ statusText: statusText.SUCCESS });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

/***
 * ! validated
 * ! see in future: what if a user enters the url of a quiz, and takes unit doesnot contain a quiz
 * ! in such a case frontend quiz page will handle it on its own
 */
router.get(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/quiz",
  userAuth,
  fetchPerson,
  isUser,
  async (req, res) => {
    try {
      const { verticalId, courseId, unitId } = req.params;
      const mongoId = req.mongoId;

      // first validate vId,cId,uId, then check quiz exists, then check isEligibleToTakeQuiz

      // imp to validate verticalId as its included in the activity object
      const verticalProj = {
        _id: 1,
      };

      const verticalDoc = await Vertical.findById(verticalId, verticalProj);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.RESOURCE_NOT_FOUND });
      }

      // validate cId
      const courseProj = {
        _id: 0,
        unitArr: 1,
      };

      const courseDoc = await Course.findById(courseId, courseProj);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.RESOURCE_NOT_FOUND });
      }

      // console.log(courseDoc.unitArr.length);

      // validate uId
      let unitDoc = null;
      courseDoc.unitArr.forEach((currUnit) => {
        if (currUnit._id.toString() === unitId) {
          unitDoc = currUnit;
        }
      });

      // check if quiz exists
      if (!(unitDoc && unitDoc.quiz && unitDoc.quiz.length > 0)) {
        return res
          .status(404)
          .json({ statusText: statusText.RESOURCE_NOT_FOUND });
      }

      let userProj = {
        _id: 0,
        activity: 1,
      };

      const userDoc = await User.findById(mongoId, userProj);
      addRequiredUnitActivity(userDoc, verticalId, courseId, unitId);

      // check if user is eligible to take quiz
      const unitActivity =
        userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];

      if (!unitDoc.video.vdoSrc || unitDoc.video.vdoSrc === "") {
        return res.status(200).json({
          statusText: statusText.SUCCESS,
          quiz: unitDoc.quiz,
          isEligibleToTakeQuiz: true,
          quizScoreInPercent: unitActivity.quiz.scoreInPercent,
        });
      }

      if (
        unitActivity.video.watchTimeInPercent <
        vars.activity.MIN_WATCH_TIME_IN_PERCENT
      ) {
        return res.status(403).json({
          statusText: statusText.NOT_ELIGIBLE_TO_TAKE_QUIZ,
        });
      }

      userDoc.activity[`v${verticalId}`][`c${courseId}`][
        `u${unitId}`
      ].lastVisited = new Date().toISOString();

      // hh
      await userDoc.save();

      res.status(200).json({
        statusText: statusText.SUCCESS,
        quiz: unitDoc.quiz,
        isEligibleToTakeQuiz: true,
        quizScoreInPercent: unitActivity.quiz.scoreInPercent,
      });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.post(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/quiz/submit",
  userAuth,
  fetchPerson,
  isUser,
  doesQuizExist,
  isEligibleToTakeQuiz,
  async (req, res) => {
    try {
      const { verticalId, courseId, unitId } = req.params;
      const { quizScoreInPercent } = req.body;
      const mongoId = req.mongoId;

      const userDoc = await User.findById(mongoId);

      addRequiredUnitActivity(userDoc, verticalId, courseId, unitId);

      // always update by creating a new doc for activity out of the previous one

      // check cutoff on quiz submit only, the user can always see the quiz page (except watchtime criteria)
      let hasPassedQuiz = false;
      let hasPassedQuizFirstTime = false;
      const unitActivity =
        userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];
      // we are sure unitActivity exists as the isEligibleToTakeQuiz middleware is satisfied

      if (
        unitActivity.quiz.scoreInPercent < vars.activity.QUIZ_CUT_OFF_IN_PERCENT
      ) {
        // user hasn't passed quiz before, now only we can update the score

        // update the score
        unitActivity.quiz = {
          scoreInPercent: quizScoreInPercent,
          passingDate: new Date().toISOString(),
        };

        if (
          quizScoreInPercent >=
          vars.activity.CERTIFICATE_GENERATION_CUT_OFF_IN_PERCENT
        ) {
          hasPassedQuiz = true;
          hasPassedQuizFirstTime = true;

          unitActivity.quiz = {
            scoreInPercent: quizScoreInPercent,
            passingDate: new Date().toISOString(),
          };

          unitActivity.lastVisited = new Date().toISOString();
          // increase number of cert unlocked for this vertical by one

          // await Vertical.findByIdAndUpdate(verticalId, { //certificate unlock count in mongo
          //   $inc: { certUnlocked: 1 },
          // });
        }

        userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`] =
          unitActivity;

        const updatedDoc = await User.findByIdAndUpdate(mongoId, userDoc, {
          new: true,
        });

        // console.log(updatedDoc);
      } else {
        // user has passed quiz before
        hasPassedQuiz = true;
        // console.log("Quiz passed already, no update in score");
      }

      // console.log(hasPassedQuiz, hasPassedQuizFirstTime);

      res.status(200).json({
        statusText: statusText.SUCCESS,
        hasPassedQuiz: hasPassedQuiz,
        hasPassedQuizFirstTime: hasPassedQuizFirstTime,
      });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({
        statusText: statusText.INTERNAL_SERVER_ERROR,
      });
    }
  }
);

router.get("/profile", userAuth, fetchPerson, isUser, async (req, res) => {
  try {
    let user = await User.findById(req.mongoId);

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
      let verticalData = await Vertical.findById(id)?.select("name _id");

      if (!verticalData) {
        await User.findByIdAndUpdate(req.mongoId, {
          $unset: { [`activity.${vertical}`]: "" },
        });
        continue;
      }

      for (let course in activity[vertical]) {
        let courseId = course.slice(1);
        let courseData = await Course.findById(courseId);

        if (!courseData) {
          await User.findByIdAndUpdate(req.mongoId, {
            $unset: { [`activity.${vertical}.${course}`]: "" },
          });

          continue;
        }

        for (let unit in activity[vertical][course]) {
          let unitId = unit.slice(1);
          // if(!unitData){
          //     await User.findByIdAndUpdate(req.mongoId, { $unset: { [`activity.${vertical}.${course}.${unit}`]: "" } });

          //     continue;
          // }
          let unitData = courseData.unitArr.find((unit) => unit._id == unitId);

          if (!unitData) {
            await User.findByIdAndUpdate(req.mongoId, {
              $unset: {
                [`activity.${vertical}.${course}.${unit}`]: "",
              },
            });
            continue;
          }

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
    res.status(500).send({
      statusText: "Internal Server Error",
      error: err.message,
    });
  }
});

// const { unlink, stat } = require("node:fs/promises");
// const { all } = require("./admin");

// router.post(
//     "/verticals/:verticalId/courses/:courseId/units/:unitId/activity/submit",
//     fetchPerson,
//     isUser,
//     upload.single("activityImg"),
//     doesUnitActivityExist,
//     async (req, res) => {
//         try {
//             // todo: if multiple submits are allowed we need to delete the older one from firebase, or we can allow atmost 2 submits per activity
//             const { verticalId, courseId, unitId } = req.params;
//             const mongoId = req.mongoId;
//             const activityIndex = Number(req.body.activityIndex); // req.body comes from multer
//             // console.log(activityIndex);

//             const userDoc = await User.findById(mongoId);
//             addRequiredUnitActivity(userDoc, verticalId, courseId, unitId);

//             const unitActivity =
//                 userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];

//             // todo: delete old activityImg from firebase

//             //! very imp to add default value
//             if (!unitActivity.activities[activityIndex]) {
//                 unitActivity.activities[activityIndex] = ["", 0];
//             }

//             const submissionCount = unitActivity.activities[activityIndex][1];
//             if (submissionCount >= vars.activity.ACTIVITY_SUBMISSION_LIMIT) {
//                 return res.status(403).json({
//                     statusText: statusText.ACTIVITY_SUBMISSION_LIMIT_EXCEEDED,
//                 });
//             }

//             // we recieve req.body and req.file due to multer
//             // console.log(req.file);

//             const fileName = req.file.filename;
//             const originalFilePath = req.file.path;
//             const compressedFilePath = `uploads/compressed/${fileName}`;

//             // compress file from 'original-file-path' to 'compressed-file-path'
//             const compressResult = await sharp(originalFilePath)
//                 .resize({
//                     width: vars.imageFile.COMPRESS_IMG_WIDTH_IN_PX,
//                     fit: sharp.fit.contain,
//                 })
//                 .jpeg({ quality: 90 })
//                 .toFile(compressedFilePath);

//             // console.log(compressResult);

//             // unlink original file
//             await unlink(originalFilePath);

//             // upload compressed file to firebase, with downloadToken = fileName

//             const firebaseFileDownloadToken = fileName;
//             const metadata = {
//                 metadata: {
//                     firebaseStorageDownloadTokens: firebaseFileDownloadToken,
//                 },
//                 contentType: "image/jpeg",
//                 cacheControl: "public, max-age=31536000",
//             };

//             // Upload compressed file to the bucket
//             const result = await bucket.upload(compressedFilePath, {
//                 gzip: true,
//                 metadata: metadata,
//             });

//             // console.log(result);
//             // console.log(`Uploaded to Firebase: ${firebaseFileDownloadToken}`);

//             const bucketName = bucket.name;
//             const firebasePublicURL = generateFirebasePublicURL(
//                 bucketName,
//                 firebaseFileDownloadToken
//             );
//             // unlink compressed file
//             await unlink(compressedFilePath);

//             // Delete old file before saving new file download token to MongoDB
//             unitActivity.activities[activityIndex][0] = firebaseFileDownloadToken;
//             unitActivity.activities[activityIndex][1]++;

//             const updatedDoc = await User.findByIdAndUpdate(mongoId, userDoc, {
//                 new: true,
//             });
//             // console.log(updatedDoc.activity);

//             res.status(200).json({
//                 statusText: statusText.FILE_UPLOAD_SUCCESS,
//             });
//         } catch (err) {
//             console.log(err.message);
//             res.status(500).json({
//                 statusText: statusText.FILE_UPLOAD_FAIL,
//             });
//         }
//     }
// );

// router.post

module.exports = router;

/*
References:
Sending emails:
https://stackoverflow.com/questions/24695750/is-it-po0ssible-to-to-send-bulk-pre-rendered-email-via-the-sendgrid-api
https://stackoverflow.com/questions/41329056/bulk-email-sending-usiing-node-js
*/

// mini route
router.get("/check-authorized", userAuth, fetchPerson, async (req, res) => {
  res.status(200).json({ statusText: "Authorized" });
});
