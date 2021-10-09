const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DocSchema = new Schema(
    {
        name: { type: String, default: "", index: true },
        image: { type: String, default: "" },
        description: { type: String, default: "" },
        parent: { type: Schema.Types.ObjectId, ref: "Categories", default: null },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Categories", DocSchema);
