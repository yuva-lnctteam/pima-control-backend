require("dotenv").config();
const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");

// todo: can we init firebase once like mongodb

const serviceAccount = require("./service_account");
// console.log(serviceAccount);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_NAME,
});

const bucket = getStorage().bucket();
// console.log(bucket.name);

module.exports = bucket;
