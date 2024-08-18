const express = require("express");
const app = express();
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");

// const csvUpload = require("express-fileupload");
const cors = require("cors");

const allowedOrigins = [
  "https://pima-control.vercel.app",
  "https://portal.pima.in",
  "http://localhost:3000", // Example for local development
];

const corsOptions = {
  // array of allowed origins
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  // origin: 'http://localhost:3000', // Only allow requests from your website
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Enable cookies and authentication headers
};

app.options('*', cors(corsOptions)); 

// app.use(cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({})); // to use req.body
app.use(express.urlencoded({ extended: true }));

// RATE LIMITER
/* const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
}); */

// app.use(limiter);

// Mine returns
const connectToMongoDB = require("./databases/mongodb/config");
const { header } = require("express-validator");
connectToMongoDB();

// const { createDir } = require("./utilities/helper_functions");
// const { vars } = require("./utilities/constants");

// routes
app.use("/api/user/auth", require("./api/routes/user.js"));

app.use("/api/admin/auth", require("./api/routes/admin.js"));

app.use("/api/public", require("./api/routes/public.js"));

app.get("/", (req, res) => {
  res.send("Welcome to Pima Control API");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is listening at port ${PORT}`);

  //   createDir(vars.imageFile.ORIGINAL_UPLOADS_DIR_PATH);
  //   createDir(vars.imageFile.COMPRESSED_UPLOADS_DIR_PATH);
});

/*
todo:
while deployment:
make all import like mongodb in lowercase
uncomment createDir
firebase private key error while deployment:
https://stackoverflow.com/questions/50299329/node-js-firebase-service-account-private-key-wont-parse
*/
