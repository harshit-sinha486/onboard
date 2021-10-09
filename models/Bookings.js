const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require("../common/constants");

const DocSchema = new Schema(
    {
        serviceProvider: { type: ObjectId, ref: "ServiceProviders", default: null },
        customer: { type: ObjectId, ref: "Customers", default: null },
        staff: { type: ObjectId, ref: "Staffs", default: null },
        services: [{ type: Object }],
        isDoorStep: { type: Boolean, default: false },
        location: {
            type: { type: String, default: "Point" },
            coordinates: [{ type: Number, default: 0 }],
            address: { type: String, default: "" },
        },
        status: { type: String, default: constants.BOOKING_STATUS.CREATED, enum: Object.values(constants.BOOKING_STATUS) },
        bookedAt: { type: Date, default: 0 },
        startedAt: { type: Date, default: 0 },
        finishedAt: { type: Date, default: 0 },
        cancelledAt: { type: Date, default: 0 },
        cancelledBy: { type: String, default: "", enum: ["", "CUSTOMER", "ADMIN", "SERVICE_PROVIDER", "STAFF"] },
        totalAmout: { type: Number, default: 0 },
        promoCode: { type: String, default: "" },
        promoDiscount: { type: Number, default: 0 },
        serviceFee: { type: Number, default: 0 },
        extraFee: { type: Number, default: 0 },
        finalAmount: { type: Number, default: 0 },
        userRating: { type: Number, default: 0, enum: [0, 1, 2, 3, 4, 5] },
        userComments: { type: String, default: "" },
        staffRating: { type: Number, default: 0, enum: [0, 1, 2, 3, 4, 5] },
        staffComments: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Bookings", DocSchema);
