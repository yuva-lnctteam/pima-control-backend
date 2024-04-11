const mongoose = require("mongoose");

// ! manual validation required, mongoose validation is not working
const UnitSchema = mongoose.Schema({
  video: {
    title: {
      type: String,
      required: [true, "Video title is required"],
      trim: true,
    },
    desc: {
      type: String,
      default: "",
      trim: true,
    },
    vdoSrc: {
      type: String,
      required: [true, "Video source is required"],
      trim: true,
    },
  },
  text: {
    type: String,
    // default: "",
    required: [true, "Video text content is required"],
    trim: true,
  },
  activities: {
    type: Array,
    default: [],
  },
  quiz: {
    type: Array,
    default: [],
  },
});

const Unit = mongoose.model("unit", UnitSchema);

module.exports = { Unit, UnitSchema };
