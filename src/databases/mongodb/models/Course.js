const mongoose = require("mongoose");
const { UnitSchema } = require("./Unit");

const CourseSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "Course name is required"],
    minLength: [1, "Course name is too short"],
    maxLength: [100, "Course name is too long"],
    trim: true,
  },
  desc: {
    type: String,
    required: [true, "Course description is required"],
    minLength: [1, "Course description is too short"],
    maxLength: [5000, "Course description is too long"],
    trim: true,
  },
  unitArr: {
    type: [UnitSchema], // array of units
    default: [],
  },
});

const Course = mongoose.model("course", CourseSchema);
module.exports = Course;
