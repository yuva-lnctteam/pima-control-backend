const vars = {
  activity: {
    MIN_WATCH_TIME_IN_PERCENT: 40,
    // ! what if vdo is too long, then 50% watch time is a lot too watch
    CERTIFICATE_GENERATION_CUT_OFF_IN_PERCENT: 60,
    QUIZ_CUT_OFF_IN_PERCENT: 60,
    ACTIVITY_SUBMISSION_LIMIT: 3,
  },
  // MIN_WATCH_TIME_IN_PERCENT: 2,
  // CERTIFICATE_GENERATION_CUT_OFF_IN_PERCENT: 60,
  // QUIZ_CUT_OFF_IN_PERCENT: 60,
  imageFile: {
    ORIGINAL_UPLOADS_DIR_PATH: "./uploads/original",
    COMPRESSED_UPLOADS_DIR_PATH: "./uploads/compressed",
    IMAGE_SIZE_LIMIT_IN_BYTES: 1000 * 1000, // 1MB = 10^3KB = 10^6 Bytes
    IMAGE_MIME_TYPES_WHITE_LIST: ["image/jpeg", "image/png"],
    COMPRESS_IMG_WIDTH_IN_PX: 400,
    COMPRESS_IMG_HEIGHT_IN_PX: 400,
  },
  bcryptSaltRounds: 10,
  token: {
    expiry: {
      ADMIN_IN_SEC: 60 * 60 * 12,
      USER_IN_SEC: 60 * 60 * 24,
    },
  },
};

module.exports = { vars };
