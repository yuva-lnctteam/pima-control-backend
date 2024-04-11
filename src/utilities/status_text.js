const statusText = {
  INVALID_CREDS: "Please try to login with correct credentials",
  LOGIN_IN_SUCCESS: "You have been signed in successfully",
  INTERNAL_SERVER_ERROR: "Internal server error",
  PASS_RESET_SUCCESS: "Pass reset successfully",
  PASS_RESET_ALREADY: "Pass reset already",
  CURRENT_PASS_INCORRECT: "The current password is incorrect",
  REGISTERED_ALREADY: "Registered already",
  PASSWORD_NOT_RESET: "Password not reset",

  USER_ID_AVAILABLE: "User Id is available",
  USER_ID_NOT_AVAILABLE: "User Id is not available",

  TOKEN_NOT_FOUND: "Token not found",
  INVALID_TOKEN: "Invalid token",
  VERIFIED_TOKEN: "Token verified",
  REGISTRATION_SUCCESS: "Registered successfully",

  SUCCESS: "Successful",
  FAIL: "Failed",
  PREREQ_NOT_SATISFIED:
    "Prerequisites not satisfied - Password not reset or not registered",
  NOT_ELIGIBLE_TO_TAKE_QUIZ:
    "Not eligible to take quiz - watch time less than required",

  VERTICAL_CREATE_SUCCESS: "Vertical created successfully",
  VERTICAL_NOT_FOUND: "No such vertical exists",

  COURSE_CREATE_SUCCESS: "Course created successfully",
  COURSE_NOT_FOUND: "No such course exists",

  RESOURCE_NOT_FOUND: "Resource doesn't exist",

  UNIT_CREATE_SUCCESS: "Unit added successfully",

  VERTICAL_DELETE_SUCCESS: "Vertical deleted successfully",
  COURSE_DELETE_SUCCESS: "Course deleted successfully",
  UNIT_DELETE_SUCCESS: "Unit deleted successfully",

  INVALID_CERT_ID: "Invalid certificate Id",
  CERT_CUTOFF_NOT_CROSSED:
    "You haven't crossed the certificate generation cutoff",

  FILE_UPLOAD_SUCCESS: "File uploaded successfully",
  FILE_UPLOAD_FAIL: "Failed to upload the file. Please try again",

  ACTIVITY_SUBMISSION_LIMIT_EXCEEDED: "Activity submission limit exceeded",
};

module.exports = statusText;
