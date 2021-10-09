const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const DocSchema = new Schema(
    {
        serviceProvider: { type: ObjectId, ref: "ServiceProviders", default: null },
        customer: { type: ObjectId, ref: "Customers", default: null },
        staff: { type: ObjectId, ref: "Staffs", default: null },
        services: [{ type: Object }],
        totalAmout: { type: Number, default: 0 },
        finalAmount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Bookings", DocSchema);
