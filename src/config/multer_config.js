const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

/************************  Multer config **********************/

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/original");
  },
  filename: (req, file, cb) => {
    // console.log(file);

    const uniqueFileNameWithoutExt = uuidv4(); // a system generated unique file name without any extension
    cb(null, uniqueFileNameWithoutExt);
  },
});

const storageExcel = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(file);
    cb(null, "uploads/excel");
  },
  filename: (req, file, cb) => {
    const fileName = file.filename + "_" + Date.now();
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  // todo: create file-ext white list and reject here itself if possible
  //   console.log(file);

  // const fileSizeInBytes = 0;
  // const fileMimeType = "skswjdn";
  // if (!isFileSizeValid(fileSizeInBytes)) {
  //   cb("err");
  // } else if (!isFileMimeTypeValid) {
  //   cb("err");
  // }

  cb(null, true);
};

const limits = {
  fileSize: 3000 * 1000,
};

// const multerOpts = { storage: storage, fileFilter: fileFilter, limits: limits };
// const upload = multer(multerOpts);

// const uploadExcel = multer({ storage: storageExcel });

// module.exports = { upload, uploadExcel };
