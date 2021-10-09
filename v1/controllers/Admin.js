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

            await Model.Admins.updateOne({ _id: doc._id }, { $set: tobeUpdated });

            if (token) {
                process.emit("sendEmail", {
                    to: email,
                    title: "Verify your account",
                    message: `Please, use this code address to verify your account - <b>${token}</b>`,
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

        await Model.Admins.updateOne({ _id: doc._id }, { $set: tobeUpdated });

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

// ONBOARDING API'S
module.exports.login = async (req, res, next) => {
    try {
        await Validation.Admin.login.validateAsync(req.body);

        const criteria = [];
        if (req.body.email) {
            criteria.push({ email: req.body.email });
            criteria.push({ "temp.email": req.body.email });
        } else if (req.body.phoneNo && req.body.dialCode) {
            criteria.push({ phoneNo: req.body.phoneNo });
            criteria.push({ dialCode: req.body.dialCode });
            criteria.push({ "temp.phoneNo": req.body.phoneNo });
        }
        const doc = await Model.Admins.findOne({
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
        await Model.Admins.updateOne({ _id: req.admin._id }, { accessToken: "" });

        return res.success("ACCOUNT_LOGOUT_SUCCESSFULLY");
    } catch (error) {
        next(error);
    }
};
module.exports.getProfile = async (req, res, next) => {
    try {
        const doc = await Model.Admins.findOne({ _id: req.admin._id });
        // console.log(doc);
        // const obj = {
        //     ...req.admin,
        //     phoneNo: doc.phoneNo,
        // };

        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.updateProfile = async (req, res, next) => {
    try {
        await Validation.Admin.updateProfile.validateAsync(req.body);

        const nin = { $nin: [req.admin._id] };

        // check other accounts
        if (req.body.email) {
            const checkEmail = await Model.Admins.findOne({
                _id: nin,
                email: req.body.email,
                isDeleted: false,
            });
            if (checkEmail) throw new Error("EMAIL_ALREADY_IN_USE");
        }
        if (req.body.phoneNo) {
            const checkPhone = await Model.Admins.findOne({
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
        const updated = await Model.Admins.findOneAndUpdate({ _id: req.admin._id }, { $set: req.body }, { new: true });

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
        await Validation.Admin.changePassword.validateAsync(req.body);

        if (req.body.oldPassword === req.body.newPassword) throw new Error("PASSWORDS_SHOULD_BE_DIFFERENT");

        const doc = await Model.Admins.findOne({ _id: req.admin._id });
        if (!doc) throw new Error("ACCOUNT_NOT_FOUND");

        await doc.authenticate(req.body.oldPassword);
        await doc.setPassword(req.body.newPassword);
        await doc.save();

        return res.success("PASSWORD_CHANGED_SUCCESSFULLY");
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

module.exports.sendNewPasswordInEmail = async (req, res, next) => {
    try {
        await Validation.Customer.sendOTP.validateAsync(req.body);
        let doc = null;
        if (req.body.email) {
            doc = await Model.Admins.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        }
        const _sendNewPasswordInEmail = async (doc, email) => {
            try {
                if (!doc) throw new Error("Document Missing");
                if (!email) throw new Error("Email Missing");

                // doc = JSON.parse(JSON.stringify(doc));

                const token = functions.generateNumber(8);
                if (!doc) throw new Error("ACCOUNT_NOT_FOUND");
                await doc.setPassword(token);
                await doc.save();

                if (token) {
                    process.emit("sendEmail", {
                        to: email,
                        title: "Account New Password",
                        message: `Please, use this code address to verify your account - <b>${token}</b>`,
                    });
                }
            } catch (error) {
                console.error("_sendNewPasswordInEmail", error);
            }
        };
        if (req.body.email) await _sendNewPasswordInEmail(doc, req.body.email);

        return res.success("New Password Sent");
    } catch (error) {
        next(error);
    }
};
