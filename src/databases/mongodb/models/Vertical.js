const mongoose = require("mongoose");

const VerticalSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "Vertical name is required"],
    minLength: [1, "Vertical name is too short"],
    maxLength: [100, "Vertical name is too long"],
    trim: true,
  },

  desc: {
    type: String,
    required: [true, "Vertical description is required"],
    minLength: [1, "Vertical description is too short"],
    maxLength: [5000, "Vertical description is too long"],
    trim: true,
  },
  certUnlocked: {
    type: Number,
    default: 0,
  },
  imgSrc: {
    type: String,
    required: [true, "Image source is required"],
    trim: true,
  },

  courseIds: {
    type: [mongoose.Types.ObjectId],
    default: [],
  },
});

const Vertical = mongoose.model("vertical", VerticalSchema);
module.exports = Vertical;
