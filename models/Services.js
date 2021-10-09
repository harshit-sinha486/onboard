const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const DocSchema = new Schema(
    {
        serviceProvider: { type: ObjectId, ref: "ServiceProviders", required: true },
        category: { type: ObjectId, ref: "Categories", default: null },
        name: { type: String, default: "" },
        homePrice: { type: Number, default: 0 },
        salonPrice: { type: Number, default: 0 },
        description: { type: String, default: " " },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
        isFixedPrice: { type: Boolean, default: true },
    },
    { timestamps: true }
);
module.exports = mongoose.model("Services", DocSchema);
