const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// My models
const User = require("./databases/mongodb/models/User");
const Course = require("./databases/mongodb/models/Course");
const Vertical = require("./databases/mongodb/models/Vertical");
const Unit = require("./databases/mongodb/models/Unit");

const statusText = require("./utilities/status_text.js");
const { vars } = require("./utilities/constants");

////////////////////////////////////////////////////////////////////////////////////////

const fetchPerson = (req, res, next) => {
  const token = req.header("auth-token");
  // console.log(token);
  // * if token is verified then the mongoId contained in the token always belongs to some user doc

  if (!token) {
    return res
      .status(401)
      .send({ statusText: statusText.TOKEN_NOT_FOUND, isLoggedIn: false });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.mongoId = data.person.mongoId;
    req.role = data.person.role;

    // console.log(req.role);
    next();
  } catch (err) {
    // console.log(err.message);

    res
      .status(401)
      .send({ statusText: statusText.INVALID_TOKEN, isLoggedIn: false });
  }
};

const isUser = (req, res, next) => {
  // console.log(req.role);

  if (req.role !== "user") {
    return res
      .status(401)
      .send({ statusText: statusText.INVALID_TOKEN, isUser: false });
  }
  next();
};

const isAdmin = (req, res, next) => {
  // console.log(req.role);

  if (req.role !== "admin") {
    return res
      .status(401)
      .send({ statusText: statusText.INVALID_TOKEN, isAdmin: false });
  }

  next();
};

const arePrereqSatisfied = async (req, res, next) => {
  const userDoc = await User.findById(req.mongoId);
  // console.log(userDoc);

  if (!userDoc.isPassReset || !userDoc.isRegistered) {
    return res
      .status(403)
      .json({ statusText: statusText.PREREQ_NOT_SATISFIED, userDoc: userDoc });
  }

  req.userDoc = userDoc;

  next();
};

// ! check whether the user is eligible to take quiz, this is imp in cases when user directly copy pastes the url of the quiz page and tries to submit it
const isEligibleToTakeQuiz = async (req, res, next) => {
  try {
    const { verticalId, courseId, unitId } = req.params;
    const userDoc = await User.findById(req.mongoId);

    // ! why are we not checking that the verticalid, courseid, unitid is valid
    const verticalKey = `v${verticalId}`;
    const courseKey = `c${courseId}`;
    const unitKey = `u${unitId}`;

    // console.log(userDoc.activity[verticalKey][courseKey][unitKey]);

    /* this if condition also makes sure that vId, cId and uId exists, as userDoc contains the 
  vdo watch time only if the userDoc contains the activity for that particular vId, cId and uId
  and if the userDoc contains the vId, cId, uId this means those ids are valid as other routes like
  update-progress validate them
  */
    if (
      !(
        userDoc.activity &&
        userDoc.activity[verticalKey] &&
        userDoc.activity[verticalKey][courseKey] &&
        userDoc.activity[verticalKey][courseKey][unitKey] &&
        userDoc.activity[verticalKey][courseKey][unitKey].video
          .watchTimeInPercent >= vars.activity.MIN_WATCH_TIME_IN_PERCENT
      )
    ) {
      return res.status(403).json({
        statusText: statusText.NOT_ELIGIBLE_TO_TAKE_QUIZ,
        isEligibleToTakeQuiz: false,
      });
    }

    next();
  } catch (err) {
    console.log(err);
  }
};

const isUnitIdValid = async (req, res, next) => {
  try {
    const { verticalId, courseId, unitId } = req.params;

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

    //! blunder logic about comparing unit Ids

    let unitFound = false;
    courseDoc.unitArr.forEach((currUnit) => {
      if (currUnit._id.toString() === unitId) {
        unitFound = true;
      }
    });

    if (!unitFound) {
      res.status(404).json({ statusText: statusText.RESOURCE_NOT_FOUND });
    }

    next();
  } catch (err) {
    console.log(err.message);

    res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
};

const doesQuizExist = async (req, res, next) => {
  try {
    const { verticalId, courseId, unitId } = req.params;

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

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
};

const doesUnitActivityExist = async (req, res, next) => {
  try {
    const { verticalId, courseId, unitId } = req.params;

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

    const activityIndex = Number(req.body.activityIndex); // req.body comes from multer

    // console.log(unitDoc);
    // check if activityIndex exists
    if (
      !(
        unitDoc &&
        unitDoc.activities &&
        unitDoc.activities.length >= activityIndex + 1
      )
    ) {
      return res
        .status(404)
        .json({ statusText: statusText.RESOURCE_NOT_FOUND });
    }

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  fetchPerson,
  isUser,
  isAdmin,
  arePrereqSatisfied,
  isEligibleToTakeQuiz,
  isUnitIdValid,
  doesQuizExist,
  doesUnitActivityExist,
};

/*
References: https://stackoverflow.com/questions/11637353/comparing-mongoose-id-and-strings
*/
