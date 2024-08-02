const mongoose = require("mongoose");

// ! manual validation required, mongoose validation is not working
const UnitSchema = mongoose.Schema({
    // name: {
    //     type: String,
    // },
    // desc: {
    //     type: String,
    // },
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
            // required: [true, "Video source is required"],
            trim: true,
        },
    },
    pdf: {
        type: Object,
    },
    image: {
        type: Object,
    },
    activities: {
        type: Array,
        default: [],
    },
    quiz: {
        type: Array,
        default: [],
    },
    lastVisited: {
        type: Date,
    }
});

const Unit = mongoose.model("unit", UnitSchema);

module.exports = { Unit, UnitSchema };
