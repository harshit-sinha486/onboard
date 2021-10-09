const _ = require("lodash");
const Model = require("../../models");
const ServiceSchema = require("../../models/Services");
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
            console.log("account already verified");
            // return;
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

        await Model.ServiceProviders.updateOne({ _id: doc._id }, { $set: tobeUpdated });

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

        await Model.ServiceProviders.updateOne({ _id: doc._id }, { $set: tobeUpdated });
    } catch (error) {
        console.error("_sendPhoneVerification", error);
    }
};

// ONBOARDING API'S
module.exports.socialLogin = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.socialLogin.validateAsync(req.body);

        const socials = [];
        req.body.appleId && socials.push({ appleId: req.body.appleId });
        req.body.googleId && socials.push({ googleId: req.body.googleId });
        req.body.facebookId && socials.push({ facebookId: req.body.facebookId });
        if (!socials.length) throw new Error("MISSING_SOCIAL_HANDLE");

        let user = await Model.ServiceProviders.findOne({ $or: socials });
        let successMessage = "LOGIN_SUCCESSFULLY";

        if (!user) {
            // creating user
            user = await Model.ServiceProviders.create(req.body);
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
        await Validation.ServiceProvider.register.validateAsync(req.body);

        if (req.body.email) {
            const checkEmail = await Model.ServiceProviders.findOne({
                email: req.body.email,
                isDeleted: false,
            }).lean();
            if (checkEmail) throw new Error("EMAIL_ALREADY_EXISTS");
        }

        if (req.body.phoneNo) {
            const checkPhone = await Model.ServiceProviders.findOne({
                phoneNo: req.body.phoneNo,
                dialCode: req.body.dialCode,
                isDeleted: false,
            }).lean();
            if (checkPhone) throw new Error("PHONE_ALREADY_EXISTS");
        }

        const doc = await Model.ServiceProviders.create(req.body);
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
        await Validation.ServiceProvider.login.validateAsync(req.body);

        const criteria = [];
        if (req.body.email) {
            criteria.push({ email: req.body.email });
            criteria.push({ "temp.email": req.body.email });
        } else if (req.body.phoneNo && req.body.dialCode) {
            criteria.push({ phoneNo: req.body.phoneNo, dialCode: req.body.dialCode });
            criteria.push({ "temp.phoneNo": req.body.phoneNo });
        }

        const doc = await Model.ServiceProviders.findOne({
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
        // if (doc.isActive === false) return res.error(403, "ACCOUNT_NOT_ACTIVATED");

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
        await Model.ServiceProviders.updateOne({ _id: req.serviceprovider._id }, { accessToken: "" });

        return res.success("ACCOUNT_LOGOUT_SUCCESSFULLY");
    } catch (error) {
        next(error);
    }
};
module.exports.getProfile = async (req, res, next) => {
    try {
        const doc = await Model.ServiceProviders.findOne({
            _id: req.serviceprovider._id,
        });
        // console.log(doc);
        // const obj = {
        //     ...req.serviceprovider,
        //     phoneNo: doc.phoneNo,
        // };

        return res.success("DATA_FETCHED", doc);
    } catch (error) {
        next(error);
    }
};
module.exports.updateProfile = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.updateProfile.validateAsync(req.body);

        const nin = { $nin: [req.serviceprovider._id] };

        // check other accounts
        if (req.body.email) {
            const checkEmail = await Model.ServiceProviders.findOne({
                _id: nin,
                email: req.body.email,
                isDeleted: false,
            });
            if (checkEmail) throw new Error("EMAIL_ALREADY_IN_USE");
        }
        if (req.body.phoneNo) {
            const checkPhone = await Model.ServiceProviders.findOne({
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
        if (req.body.documents) {
            req.body.documents = req.body.documents.map((str) => ({ doc: str }));
        }
        const updated = await Model.ServiceProviders.findOneAndUpdate({ _id: req.serviceprovider._id }, { $set: req.body }, { new: true });

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
        await Validation.ServiceProvider.changePassword.validateAsync(req.body);

        if (req.body.oldPassword === req.body.newPassword) throw new Error("PASSWORDS_SHOULD_BE_DIFFERENT");

        const doc = await Model.ServiceProviders.findOne({
            _id: req.serviceprovider._id,
        });
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
        await Model.ServiceProviders.updateOne({ _id: req.serviceprovider._id }, { isDeleted: true });

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
            status: req.serviceprovider.isEmailVerified,
        });
    } catch (error) {
        next(error);
    }
};

module.exports.sendOtp = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.sendOTP.validateAsync(req.body);
        let doc = null;

        if (req.body.email) {
            doc = await Model.ServiceProviders.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        } else if (req.body.phoneNo) {
            doc = await Model.ServiceProviders.findOne({
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
        await Validation.ServiceProvider.verifyOTP.validateAsync(req.body);
        let doc = null;

        if (req.body.email) {
            doc = await Model.ServiceProviders.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        } else if (req.body.phoneNo) {
            doc = await Model.ServiceProviders.findOne({
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

        const doc = await Model.ServiceProviders.findOne({
            _id: req.serviceprovider._id,
        });
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

        const doc = await Model.ServiceProviders.findOne({
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
module.exports.sendPasswordResetLink = async (req, res, next) => {
    try {
        if (!req.body.email && !req.body.username) throw new Error("MISSING_PARAMETERS");
        let user = null;

        if (req.body.email) {
            user = await Model.ServiceProviders.findOne({
                email: req.body.email,
                isDeleted: false,
            });
        } else if (req.body.username) {
            user = await Model.ServiceProviders.findOne({
                username: req.body.username,
                isDeleted: false,
            });
        }

        if (!user) throw new Error("ACCOUNT_NOT_FOUND");
        if (user.isBlocked) throw new Error("Your account has been blocked");

        const oneTimeCode = functions.generateString(25);
        user.oneTimeCode = oneTimeCode;
        await user.save();

        // let payload = null;

        // if (req.body.type === "verify") {
        //     payload = {
        //         _ok: "verification Link Sent",
        //         to: user.email,
        //         title: "Verify your account",
        //         message: `Please, follow this url address to verify your account - ${process.env.HOST}/verifyAccount.html?token=${oneTimeCode}`,
        //     };
        // } else if (req.body.type === "recover") {
        //     payload = {
        //         _ok: "Forgot Password Link Sent",
        //         to: user.email,
        //         title: "Reset your account password",
        //         message: `Please, follow this url address to recover your account - ${process.env.HOST}/forgotPassword.html?token=${oneTimeCode}`,
        //     };
        // } else {
        //     throw new Error("INVALID PARAMETERS");
        // }

        // process.emit("sendEmail", payload);

        return res.success("RECOVERY_LINK_SENT");
    } catch (error) {
        next(error);
    }
};
module.exports.resetPassword = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.resetPassword.validateAsync(req.body);

        const doc = await Model.ServiceProviders.findOne({
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

// isActive Status for SP

module.exports.activeStatus = async (req, res, next) => {
    try {
        const status = req.body.status;
        await Model.ServiceProviders.updateOne({ _id: req.serviceprovider._id }, { isActive: status });

        return res.success("STATUS_SUCCESSFULLY_SET_TO " + status);
    } catch (error) {
        next(error);
    }
};

// SERVICES CRUD

module.exports.addService = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.addService.validateAsync(req.body);

        const data = new ServiceSchema(req.body);
        const save = await data.save();
        return res.success("SERVICE_ADDED_SUCCESSFULLY", save);
    } catch (error) {
        next(error);
    }
};

module.exports.editService = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.editService.validateAsync(req.body);

        const result = await Model.Services.updateOne({ _id: req.params.id }, { $set: req.body });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

module.exports.getService = async (req, res, next) => {
    try {
        const find = await ServiceSchema.find({ isDeleted: false });
        res.json(find);
    } catch (error) {
        next(error);
    }
};

module.exports.deleteService = async (req, res, next) => {
    try {
        await Model.Services.updateOne({ _id: req.body._id }, { isDeleted: true });

        return res.success("SERVICE_DELETED");
    } catch (error) {
        next(error);
    }
};

// MANAGE PROFFESSIONALS CRUD

module.exports.createProfessionals = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.createProfessionals.validateAsync(req.body);

        if (req.body.email) {
            const checkEmail = await Model.Staffs.findOne({
                email: req.body.email,
                isDeleted: false,
            }).lean();
            if (checkEmail) throw new Error("EMAIL_ALREADY_EXISTS");
        }

        if (req.body.phoneNo) {
            const checkPhone = await Model.Staffs.findOne({
                phoneNo: req.body.phoneNo,
                dialCode: req.body.dialCode,
                isDeleted: false,
            }).lean();
            if (checkPhone) throw new Error("PHONE_ALREADY_EXISTS");
        }

        const doc = await Model.Staffs.create(req.body);
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

module.exports.updateProfessionals = async (req, res, next) => {
    try {
        await Validation.ServiceProvider.updateProfessionals.validateAsync(req.body);

        const doc = await Model.Staffs.updateOne({ _id: req.params.id }, { $set: req.body });
        res.json(doc);
    } catch (error) {
        next(error);
    }
};

module.exports.readProfessionals = async (req, res, next) => {
    try {
        Model.Staffs.find()
            .sort({ name: -1 })
            .then((users) => {
                res.status(200).send(users);
            })
            .catch((err) => {
                res.status(500).send({
                    message: err.message || "Error Occured",
                });
            });
    } catch (error) {
        next(error);
    }
};

module.exports.deleteProfessionals = async (req, res, next) => {
    try {
        await Model.Staffs.odel.Staffs.findByIdAndUpdate(req.body.id, {
            isDeleted: true,
        })
            .then((user) => {
                if (!user) {
                    return res.status(404).send({
                        message: "User not found ",
                    });
                }
                res.send({ message: "User deleted successfully!" });
            })
            .catch((err) => {
                return res.status(500).send({
                    message: "Could not delete user ",
                });
            });
    } catch (error) {
        next(error);
    }
};
