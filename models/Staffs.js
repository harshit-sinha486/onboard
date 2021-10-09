const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const bcrypt = require("bcryptjs");

const DocSchema = new Schema(
    {
        email: { type: String, default: "", index: true },
        phoneNo: { type: String, default: "" },
        dialCode: { type: String, default: "" },
        password: { type: String, default: "", index: true },
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        image: { type: String, default: "" },
        gender: { type: String, default: "", enum: ["", "MALE", "FEMALE", "OTHER"] },
        country: { type: String, default: "" },
        state: { type: String, default: "" },
        city: { type: String, default: "" },
        address: { type: String, default: "" },
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        birthDate: { type: Date, default: 0 },
        amount: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        isProfileSetup: { type: Boolean, default: false },
        isNotification: { type: Boolean, default: false },
        isEmailVerified: { type: Boolean, default: false },
        isPhoneVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: false },
        isApproved: { type: Boolean, default: false },
        isBlocked: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        appleId: { type: String, default: "", index: true },
        googleId: { type: String, default: "", index: true },
        facebookId: { type: String, default: "", index: true },
        loginCount: { type: Number, default: 0 },
        description: { type: String, default: "" },
        accessToken: { type: String, default: "", index: true },
        deviceToken: { type: String, default: "", index: true },
        deviceType: { type: String, default: "", enum: ["", "WEB", "IOS", "ANDROID"] },
        secretCode: { type: String, default: "" },
        secretExpiry: { type: Date, default: 0 },
        tempData: { type: Object, default: {} },

        // apart from onboarding
        services: [{ type: ObjectId, ref: "Services" }],
        homePrice: { type: Number, default: 0 },
        salonPrice: { type: Number, default: 0 },
        ratings: [{ type: Schema.Types.ObjectId, ref: "Ratings", default: "" }],
    },
    { timestamps: true }
);

DocSchema.index({ dialCode: 1, phoneNo: 1 });
DocSchema.set("toJSON", { getters: true, virtuals: true });

DocSchema.virtual("fullName")
    .get(function () {
        return this.firstName + " " + this.lastName;
    })
    .set(function (val) {
        this.firstName = val.substr(0, val.indexOf(" "));
        this.lastName = val.substr(val.indexOf(" ") + 1);
    });

DocSchema.methods.authenticate = function (password, callback) {
    const promise = new Promise((resolve, reject) => {
        if (!password) reject(new Error("MISSING_PASSWORD"));

        bcrypt.compare(password, this.password, (error, result) => {
            if (!result) reject(new Error("INVALID_PASSWORD"));
            resolve(this);
        });
    });

    if (typeof callback !== "function") return promise;
    promise.then((result) => callback(null, result)).catch((err) => callback(err));
};

DocSchema.methods.setPassword = function (password, callback) {
    const promise = new Promise((resolve, reject) => {
        if (!password) reject(new Error("Missing Password"));

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) reject(err);
            this.password = hash;
            resolve(this);
        });
    });

    if (typeof callback !== "function") return promise;
    promise.then((result) => callback(null, result)).catch((err) => callback(err));
};

module.exports = mongoose.model("Staffs", DocSchema);
