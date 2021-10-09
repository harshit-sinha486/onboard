const _ = require("lodash");
const Model = require("../../models");
const Validation = require("../validations");
const Auth = require("../../common/authenticate");
const functions = require("../../common/functions");

const _sendEmailVerification = async (doc, email) => {
    try {
        if (!doc) throw new Error("Document Missing");
        if (!email) throw new Error("Email Missing");

        doc = JSON.parse(JSON.stringify(doc));
        const tobeUpdated = {};
        // No change, in case - hasEmail, sameEmail, isVerified
        if (doc.email && doc.email === email && doc.isEmailVerified === true) {
            tobeUpdated.email = email;
            const token = functions.generateNumber(5);
            tobeUpdated.tempData = Object.assign({}, doc.tempData, {
                email: email,
                emailSecret: token,
                emailSecretExpiry: Date.now() + 60 * 60 * 1e3,
            });

            await Model.Customers.updateOne({ _id: doc._id }, { $set: tobeUpdated });

            if (token) {
                process.emit("sendEmail", {
                    to: email,
                    title: "Verify your account",
                    message: `Hello ,Please use this OTP to verify your account - <b>${token}</b>`,
                });
            }
            return;
        } else if (!doc.email) {
            tobeUpdated.email = email;
            tobeUpdated.isEmailVerified = false;
        }

        const token = functions.generateNumber(5);

        tobeUpdated.tempData = Object.assign({}, doc.tempData, {
            email: email,
            emailSecret: token,
            emailSecretExpiry: Date.now() + 60 * 60 * 1e3,
        });

        await Model.Customers.updateOne({ _id: doc._id }, { $set: tobeUpdated });

        if (token) {
            process.emit("sendEmail", {
                to: email,
                title: "Verify your account",
                message: `Please, use this code address to verify your account - <b>${token}</b>`,
            });
        }
    } catch (error) {
        console.error("_sendEmailVerification", error);
    }
};

const _sendPhoneVerification = async (doc, dialCode, phoneNo) => {
    try {
        if (!doc) throw new Error("Document Missing");
        if (!dialCode) throw new Error("Email Missing");
        if (!phoneNo) throw new Error("Email Missing");

        doc = JSON.parse(JSON.stringify(doc));

        const tobeUpdated = {};
        // No change, in case - hasEmail, sameEmail, isVerified
        if (doc.phoneNo && doc.dialCode && doc.phoneNo === phoneNo && doc.dialCode === dialCode && doc.isPhoneVerified === true) {
            return;
        } else if (!doc.phoneNo && !doc.dialCode) {
            tobeUpdated.phoneNo = phoneNo;
            tobeUpdated.dialCode = dialCode;
            tobeUpdated.isPhoneVerified = false;
        }

        tobeUpdated.tempData = Object.assign({}, doc.tempData, {
            phoneNo: phoneNo,
            dialCode: dialCode,
            phoneSecretCode: "12345" || functions.generateNumber(5),
            phoneSecretExpiry: Date.now() + 60 * 60 * 1e3,
        });

        await Model.Customers.updateOne({ _id: doc._id }, { $set: tobeUpdated });
    } catch (error) {
        console.error("_sendPhoneVerification", error);
    }
};

// ONBOARDING API'S
module.exports.socialLogin = async (req, res, next) => {
    try {
        await Validation.Customer.socialLogin.validateAsync(req.body);

        const socials = [];
        req.body.appleId && socials.push({ appleId: req.body.appleId });
        req.body.googleId && socials.push({ googleId: req.body.googleId });
        req.body.facebookId && socials.push({ facebookId: req.body.facebookId });
        if (!socials.length) throw new Error("MISSING_SOCIAL_HANDLE");

        let user = await Model.Customers.findOne({ $or: socials });
        let successMessage = "LOGIN_SUCCESSFULLY";

        if (!user) {
            // creating user
            user = await Model.Customers.create(req.body);
            successMessage = "REGISTER_SUCCESSFULLY";
        }

        for (const key in req.body) {
            user[key] = req.body[key];
        }

        user.accessToken = await Auth.getToken({ _id: user._id });

        if (user.email) {
            user.isEmailVerified = true;
        }
        if (user.phoneNo) {
            user.isPhoneVerified = true;
        }
        await user.save();
        return res.success(successMessage, user);
    } catch (error) {
        next(error);
    }
};
module.exports.register = async (req, res, next) => {
    try {
        await Validation.Customer.register.validateAsync(req.body);

        if (req.body.email) {
            const checkEmail = await Model.Customers.findOne({
                email: req.body.email,
                isDeleted: false,
            }).lean();
            if (checkEmail) throw new Error("EMAIL_ALREADY_EXISTS");
        }

        if (req.body.phoneNo) {
            const checkPhone = await Model.Customers.findOne({
                phoneNo: req.body.phoneNo,
                dialCode: req.body.dialCode,
                isDeleted: false,
            }).lean();
            if (checkPhone) throw new Error("PHONE_ALREADY_EXISTS");
        }

        const doc = await Model.Customers.create(req.body);
        doc.accessToken = await Auth.getToken({ _id: doc._id });
        await doc.setPassword(req.body.password);
        await doc.save();

        if (req.body.email) await _sendEmailVerification(doc, req.body.email);
        if (req.body.dialCode && req.body.phoneNo) await _sendPhoneVerification(doc, req.body.dialCode, req.body.phoneNo);

        return res.success("ACCOUNT_CREATED_SUCCESSFULLY", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.login = async (req, res, next) => {
    try {
        await Validation.Customer.login.validateAsync(req.body);
        const criteria = [];
        if (req.body.email) {
            criteria.push({ email: req.body.email });
            criteria.push({ "temp.email": req.body.email });
        } else if (req.body.phoneNo && req.body.dialCode) {
            criteria.push({ phoneNo: req.body.phoneNo, dialCode: req.body.dialCode });
            criteria.push({ "temp.phoneNo": req.body.phoneNo });
        }
        const doc = await Model.Customers.findOne({
            $or: criteria,
            isDeleted: false,
        });
        if (!doc) throw new Error("INVALID_CREDENTIALS");

        await doc.authenticate(req.body.password);

        if (req.body.email && !doc.isEmailVerified) {
            return res.error(403, "ACCOUNT_NOT_VERIFIED");
        }
        if (req.body.phoneNo && !doc.isPhoneVerified) {
            return res.error(403, "ACCOUNT_NOT_VERIFIED");
        }
        if (doc.isBlocked) {
            return res.error(403, "ACCOUNT_BLOCKED");
        }

        doc.loginCount += 1;
        doc.accessToken = await Auth.getToken({ _id: doc._id });
        doc.deviceToken = req.body.deviceToken;
        doc.deviceType = req.body.deviceType;
        await doc.save();

        return res.success("ACCOUNT_LOGIN_SUCCESSFULLY", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.logout = async (req, res, next) => {
    try {
        await Model.Customers.updateOne({ _id: req.customer._id }, { accessToken: "" });

        return res.success("ACCOUNT_LOGOUT_SUCCESSFULLY");
    } catch (error) {
        next(error);
    }
};
module.exports.getProfile = async (req, res, next) => {
    try {
        const doc = await Model.Customers.findOne({ _id: req.customer._id });
        // console.log(doc);
        // const obj = {
        //     ...req.customer,
        //     phoneNo: doc.phoneNo,
        // };

        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.updateProfile = async (req, res, next) => {
    try {
        await Validation.Customer.updateProfile.validateAsync(req.body);

        const nin = { $nin: [req.customer._id] };

        // check other accounts
        if (req.body.email) {
            const checkEmail = await Model.Customers.findOne({
                _id: nin,
                email: req.body.email,
                isDeleted: false,
            });
            if (checkEmail) throw new Error("EMAIL_ALREADY_IN_USE");
        }
        if (req.body.phoneNo) {
            const checkPhone = await Model.Customers.findOne({
                _id: nin,
                dialCode: req.body.dialCode,
                phoneNo: req.body.phoneNo,
                isDeleted: false,
            });
            if (checkPhone) throw new Error("PHONE_ALREADY_IN_USE");
        }

        const email = req.body.email;
        // const phoneNo = req.body.phoneNo;
        // const dialCode = req.body.dialCode;

        delete req.body.email;
        // delete req.body.phoneNo;
        // delete req.body.dialCode;

        req.body.isProfileSetup = true;
        const updated = await Model.Customers.findOneAndUpdate({ _id: req.customer._id }, { $set: req.body }, { new: true });

        await _sendEmailVerification(updated, email);
        if (req.body.email) await _sendEmailVerification(updated, email);
        // if (req.body.dialCode && req.body.phoneNo) await _sendPhoneVerification(doc, req.body.dialCode, req.body.phoneNo);

        return res.success("PROFILE_UPDATED_SUCCESSFULLY", updated);
    } catch (error) {
        next(error);
    }
};
module.exports.changePassword = async (req, res, next) => {
    try {
        await Validation.Customer.changePassword.validateAsync(req.body);

        if (req.body.oldPassword === req.body.newPassword) throw new Error("PASSWORDS_SHOULD_BE_DIFFERENT");

        const doc = await Model.Customers.findOne({ _id: req.customer._id });
        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");

        await doc.authenticate(req.body.oldPassword);
        await doc.setPassword(req.body.newPassword);
        await doc.save();

        return res.success("PASSWORD_CHANGED_SUCCESSFULLY");
    } catch (error) {
        next(error);
    }
};
module.exports.deleteAccount = async (req, res, next) => {
    try {
        await Model.Customers.updateOne({ _id: req.customer._id }, { isDeleted: true });

        return res.success("ACCOUNT_DELETED");
    } catch (error) {
        next(error);
    }
};
module.exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) throw new Error("UPLOADING_ERROR");

        const filePath = "/" + req.file.path.replace(/\/?public\/?/g, "");

        return res.success("FILE_UPLOADED", { filePath });
    } catch (error) {
        next(error);
    }
};
module.exports.checkVerification = async (req, res, next) => {
    try {
        return res.success("Account Info", {
            status: req.customer.isEmailVerified,
        });
    } catch (error) {
        next(error);
    }
};

module.exports.sendOtp = async (req, res, next) => {
    try {
        await Validation.Customer.sendOTP.validateAsync(req.body);
        let doc = null;
        if (req.body.email) {
            doc = await Model.Customers.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        } else if (req.body.phoneNo) {
            doc = await Model.Customers.findOne({
                dialCode: req.body.dialCode,
                phoneNo: req.body.phoneNo,
                isDeleted: false,
            });
        }

        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");
        if (doc.isBlocked) throw new Error("ACCOUNT_BLOCKED");

        if (req.body.email) await _sendEmailVerification(doc, req.body.email);
        if (req.body.dialCode && req.body.phoneNo) await _sendPhoneVerification(doc, req.body.dialCode, req.body.phoneNo);

        return res.success("OTP Sent");
    } catch (error) {
        next(error);
    }
};
module.exports.verifyOtp = async (req, res, next) => {
    try {
        await Validation.Customer.verifyOTP.validateAsync(req.body);
        let doc = null;

        if (req.body.email) {
            doc = await Model.Customers.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        } else if (req.body.phoneNo) {
            doc = await Model.Customers.findOne({
                $or: [
                    { dialCode: req.body.dialCode, phoneNo: req.body.phoneNo },
                    {
                        "tempData.dialCode": req.body.dialCode,
                        "tempData.phoneNo": req.body.phoneNo,
                    },
                ],
                isDeleted: false,
            });
        }

        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");
        if (doc.isBlocked) throw new Error("ACCOUNT_BLOCKED");

        if (req.body.email) {
            if (req.body.secretCode !== doc.tempData.emailSecret) throw new Error("INVALID_OTP");
            doc.tempData.emailSecret = "";
            doc.tempData.emailSecretExpiry = new Date(0);
            doc.isEmailVerified = true;
            doc.accessToken = await Auth.getToken({ _id: doc._id });
        }

        if (req.body.phoneNo) {
            if (req.body.secretCode !== doc.tempData.phoneSecretCode) throw new Error("INVALID_OTP");
            doc.tempData.phoneSecretCode = "";
            doc.tempData.phoneSecretExpiry = new Date(0);
            doc.isPhoneVerified = true;
            doc.accessToken = await Auth.getToken({ _id: doc._id });
        }

        await doc.save();

        return res.success("OTP Verified", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.sendEmailVerification = async (req, res, next) => {
    try {
        if (!req.body.email) throw new Error("MISSING_PARAMETERS");

        const doc = await Model.Customers.findOne({ _id: req.customer._id });
        await _sendEmailVerification(doc, req.body.email);

        return res.success("VERIFICATION_LINK_SENT");
    } catch (error) {
        next(error);
    }
};
module.exports.verifyAccountEmail = async (req, res, next) => {
    try {
        if (!req.body.token) throw new Error("MISSING_PARAMETERS");

        const decoded = JSON.parse(Buffer.from(req.body.token, "hex").toString("utf8"));

        const doc = await Model.Customers.findOne({
            _id: decoded._id,
            "tempData.emailSecret": req.body.token,
            isDeleted: false,
        });
        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");
        if (!doc.tempData || !doc.tempData.emailSecretExpiry || doc.tempData.emailSecretExpiry < Date.now()) {
            throw new Error("LINK_EXPIRED");
        }

        doc.email = doc.tempData.email;
        doc.isEmailVerified = true;

        const tempData = { ...doc.tempData };
        if (doc.tempData.email === decoded.email) {
            delete tempData.email;
        }
        delete tempData.emailSecret;
        delete tempData.emailSecretExpiry;
        doc.tempData = tempData;

        await doc.save();

        return res.success("EMAIL_VERIFIED_SUCCESSFULLY");
    } catch (error) {
        console.error(error);
        error.message = "INVALID_LINK";
        next(error);
    }
};
module.exports.resetPassword = async (req, res, next) => {
    try {
        await Validation.Customer.resetPassword.validateAsync(req.body);

        const doc = await Model.Customers.findOne({
            $or: [{ accessToken: req.body.accessToken }, { secretCode: req.body.secretCode }],
        });
        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");
        doc.accessToken = "";
        await doc.setPassword(req.body.newPassword);
        await doc.save();
        return res.success("Password reset successfully");
    } catch (error) {
        next(error);
    }
};

// HomeScreen Api's

module.exports.getCategories = async (req, res, next) => {
    try {
        const AllParlourNames = await Model.Categories.find({
            parent: null,
            isDeleted: false,
        }).sort({ name: 1 });
        return res.success("DATA_FETCHED", AllParlourNames);
    } catch (error) {
        next(error);
    }
};

module.exports.StaffByCategoryId = async (req, res, next) => {
    try {
        let doc = await Model.Categories.aggregate([
            { $match: { _id: ObjectId(req.params.id) } },
            {
                $lookup: {
                    from: "services",
                    localField: "_id",
                    foreignField: "category",
                    as: "services",
                },
            },
            {
                $lookup: {
                    from: "staffs",
                    localField: "services._id",
                    foreignField: "services",
                    as: "staff",
                },
            },
        ]);
        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};

module.exports.staffServicesById = async (req, res, next) => {
    try {
        const doc = await Model.Staffs.findById({ _id: req.params.id }, { services: 1 }).populate("services");
        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};

// Filtering & Sorting

module.exports.preFilterData = async (req, res, next) => {
    try {
        let doc = await Model.Staffs.aggregate([
            { $match: {} },
            {
                $lookup: {
                    from: "staffs",
                    let: { id: "$_id" },
                    pipeline: [
                        {
                            $group: {
                                _id: null,
                                homeMin: { $min: "$homePrice" },
                                homeMax: { $max: "$homePrice" },
                            },
                        },
                    ],
                    as: "newField",
                },
            },
            { $unwind: { path: "$newField" } },
            {
                $group: {
                    _id: null,
                    salonMin: { $min: "$salonPrice" },
                    salonMax: { $max: "$salonPrice" },
                    homeMax: { $first: "$newField.homeMax" },
                    homeMin: { $first: "$newField.homeMin" },
                },
            },
            {
                $addFields: {
                    minimum: {
                        $cond: [{ $gt: ["$salonMin", "$homeMin"] }, "$homeMin", "$salonMin"],
                    },
                },
            },
            {
                $addFields: {
                    maximum: {
                        $cond: [{ $gt: ["$salonMax", "$homeMax"] }, "$salonMax", "$homeMax"],
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    salonMin: 0,
                    salonMax: 0,
                    homeMax: 0,
                    homeMin: 0,
                },
            },
        ]);
        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};

module.exports.filterAndSort = async (req, res, next) => {
    try {
        const priceMin = Number(req.body.priceMin) || 0;
        const priceMax = Number(req.body.priceMax) || 0;

        if (priceMin < priceMax) {
            filter = {
                $and: [{ salonPrice: { $gte: priceMin, $lte: priceMax } }, { homePrice: { $gte: priceMin, $lte: priceMax } }],
            };
        }

        const sort = {};
        if (req.body.sortBy) {
            if (req.body.sortBy === "popularity") {
                sort.ratings = -1;
            } else if (req.body.sortBy === "highToLow") {
                sort.salonPrice = -1;
            } else if (req.body.sortBy === "lowToHigh") {
                sort.salonPrice = 1;
            } else if (req.body.sortBy === "newest") {
                sort.createdAt = -1;
            }
        }

        const pipeline = [{ $match: filter }];

        // push only if sort has keys
        Object.keys(sort).length && pipeline.push({ $sort: sort });

        const results = await Model.Staffs.aggregate(pipeline);

        return res.success("FETCHED_SUCCESSFULLY", results);
    } catch (error) {
        next(error);
    }
};

// module.exports.getServices = async (req, res, next) => {
//   try {
//     const AllServices = await Model.Services.find();
//     return res.success("DATA_FETCHED", AllServices);
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports.getProfessionals = async (req, res, next) => {
//   try {
//     const AllServices = await Model.Staffs.find();
//     return res.success("DATA_FETCHED", AllServices);
//   } catch (error) {
//     next(error);
//   }
// };
