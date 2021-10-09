const _ = require("lodash");
const Model = require("../../models");
const Validation = require("../validations");
const Auth = require("../../common/authenticate");
const functions = require("../../common/functions");

module.exports.login = async (req, res, next) => {
    try {
        await Validation.Staff.login.validateAsync(req.body);

        const doc = await Model.Staffs.findOne({ $or: [{ email: req.body.email }, { dialCode: req.body.dialCode, phoneNo: req.body.phoneNo }, { "temp.email": req.body.email }], isDeleted: false });
        if (!doc) throw new Error("INVALID_CREDENTIALS");

        // if (req.body.email && !doc.isEmailVerified) {
        //     return res.error(403, "ACCOUNT_NOT_VERIFIED");
        // }
        // if (req.body.phoneNo && !doc.isPhoneVerified) {
        //     return res.error(403, "ACCOUNT_NOT_VERIFIED");
        // }
        // if (doc.isBlocked) {
        //     return res.error(403, "ACCOUNT_BLOCKED");
        // }
        // if (doc.isActive === false) return res.error(403, "ACCOUNT_NOT_ACTIVATED");

        await doc.authenticate(req.body.password);
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
        await Model.Staffs.updateOne({ _id: req.staff._id }, { accessToken: "" });

        return res.success("ACCOUNT_LOGOUT_SUCCESSFULLY");
    } catch (error) {
        next(error);
    }
};
module.exports.sendOtp = async (req, res, next) => {
    try {
        await Validation.Staff.sendOTP.validateAsync(req.body);
        let doc = null;

        if (req.body.email) {
            doc = await Model.Staffs.findOne({ email: req.body.email, isDeleted: false });
        } else if (req.body.phoneNo) {
            doc = await Model.Staffs.findOne({ dialCode: req.body.dialCode, phoneNo: req.body.phoneNo, isDeleted: false });
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
        await Validation.Staff.verifyOTP.validateAsync(req.body);
        let doc = null;

        if (req.body.email) {
            doc = await Model.Staffs.findOne({ email: req.body.email, isDeleted: false });
        } else if (req.body.phoneNo) {
            doc = await Model.Staffs.findOne({
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

module.exports.resetPassword = async (req, res, next) => {
    try {
        await Validation.Staff.resetPassword.validateAsync(req.body);

        const doc = await Model.Staffs.findOne({ $or: [{ accessToken: req.body.accessToken }, { secretCode: req.body.secretCode }] });
        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");

        await doc.setPassword(req.body.newPassword);
        await doc.save();

        return res.success("Password reset successfully");
    } catch (error) {
        next(error);
    }
};

// module.exports.ratings = async (req, res, next) => {
//     try {
//         await Model.Ratings.aggregate([{$group:{_id: "$objectId", avgRating: { $avg: "$ratings" }}}])
//     } catch (error) {
//         next(error);
//     }
// };
