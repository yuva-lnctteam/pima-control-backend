const express = require("express");
const router = express.Router();
const basicAuth = require('express-basic-auth');

// Basic Authentication middleware
const userId = process.env.userId;
const userPassword = process.env.userPassword;

const userAuth = basicAuth({
    users: { [userId]: userPassword }, 
    challenge: true, 
    unauthorizedResponse: 'Unauthorized',
  });

// My models
const User = require("../../databases/mongodb/models/User");
const Course = require("../../databases/mongodb/models/Course");

const statusText = require("../../utilities/status_text.js");
const { vars } = require("../../utilities/constants");
const {
  isoDateStringToDDMMYYY,
  decodeCertificateId,
  isRequiredUnitActivityPresent,
} = require("../../utilities/helper_functions");
const Vertical = require("../../databases/mongodb/models/Vertical");

// ! what if the user's activity field is not present, and we include it in the projection
// todo: verify vertical id and correct unit srch for loop

router.get("/certificate/:certId", userAuth, async (req, res) => {
  const { certId } = req.params;
//   console.log(certId);

  const { userMongoId, verticalId, courseId, unitId } =
    decodeCertificateId(certId);

  try {
    const userProj = {
      fName: 1,
      mName: 1,
      lName: 1,
      activity: 1,
    };

    const userDoc = await User.findById(userMongoId, userProj);
    // console.log(userDoc);

    if (!isRequiredUnitActivityPresent(userDoc, verticalId, courseId, unitId)) {
    //   console.log("Invalid cert Id: Invalid User mongoId");

      return res.status(404).json({success: false, statusText: statusText.INVALID_CERT_ID });
    }

    const unitActivity =
      userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`];
    // console.log(unitActivity);

    if (
      unitActivity.quiz.scoreInPercent <
      vars.activity.CERTIFICATE_GENERATION_CUT_OFF_IN_PERCENT
    ) {
    //   console.log("Quiz score less than cert cut off");
      return res
        .status(404)
        .json({success: false, statusText: statusText.CERT_CUTOFF_NOT_CROSSED });
    }

    const courseProj = {
      name: 1,
      unitArr: 1,
    };

    
    const courseDoc = await Course.findById(courseId, courseProj);
    // console.log(courseDoc);

    if (!courseDoc) {
    //   console.log("Invalid cert Id: Course doc not found");
      return res.status(404).json({ success: false, statusText: statusText.INVALID_CERT_ID });
    }

    let unitDoc = null;
    // ! blunder about searching unit through ids
    for (let i = 0; i < courseDoc.unitArr.length; i++) {
      const currUnit = courseDoc.unitArr[i];
      if (currUnit._id == unitId) {
        unitDoc = currUnit;
        break;
      }
    }

    if (!unitDoc) {
    //   console.log("Invalid cert Id: Unit doc not found");
      return res.status(404).json({success: false, statusText: statusText.INVALID_CERT_ID });
    }

    // console.log(userDoc.mName);
    // console.log("mName" in userDoc);

    const holderName =
      userDoc.fName +
      " " +
      (!userDoc.mName || userDoc.mName.length === 0
        ? ""
        : userDoc.mName + " ") +
      userDoc.lName;

    // console.log(unitDoc);

    res.status(200).json({
        success: true,
      statusText: statusText.SUCCESS,
      certInfo: {
        holderName: holderName,
        passingDate: isoDateStringToDDMMYYY(unitActivity.quiz.passingDate),
        courseName: courseDoc.name,
        unitId: unitId,
      },
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
});

module.exports = router;
