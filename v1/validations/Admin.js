const Joi = require("joi").defaults((schema) => {
    switch (schema.type) {
        case "string":
            return schema.replace(/\s+/, " ");
        default:
            return schema;
    }
});

Joi.objectId = () => Joi.string().pattern(/^[0-9a-f]{24}$/, "valid ObjectId");

module.exports.identify = Joi.object({
    id: Joi.objectId().required(),
});

module.exports.socialLogin = Joi.object({
    appleId: Joi.string().optional(),
    googleId: Joi.string().optional(),
    facebookId: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phoneNo: Joi.string()
        .regex(/^[0-9]{5,}$/)
        .optional(),
    dialCode: Joi.string()
        .regex(/^\+?[0-9]{1,}$/)
        .optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().allow("").optional(),
    gender: Joi.string().allow("", "MALE", "FEMALE", "OTHER").optional(),
    deviceType: Joi.string().allow("WEB", "IOS", "ANDROID").optional(),
    deviceToken: Joi.string().optional(),
})
    .with("dialCode", "phoneNo")
    .xor("appleId", "googleId", "facebookId");

module.exports.register = Joi.object({
    email: Joi.string().email().optional(),
    phoneNo: Joi.string()
        .regex(/^[0-9]{5,}$/)
        .optional(),
    dialCode: Joi.string()
        .regex(/^\+?[0-9]{1,}$/)
        .optional(),
    deviceType: Joi.string().allow("WEB", "IOS", "ANDROID").optional(),
    deviceToken: Joi.string().optional(),
    password: Joi.string().required(),
    confirmPassword: Joi.ref("password"),
})
    .or("phoneNo", "email")
    .with("phoneNo", "dialCode")
    .with("password", "confirmPassword");

module.exports.login = Joi.object({
    email: Joi.string().email().optional(),
    phoneNo: Joi.string()
        .regex(/^[0-9]{5,}$/)
        .optional(),
    dialCode: Joi.string()
        .regex(/^\+?[0-9]{1,}$/)
        .optional(),
    password: Joi.string().required(),
    deviceType: Joi.string().allow("WEB", "IOS", "ANDROID").optional(),
    deviceToken: Joi.string().optional(),
})
    .or("phoneNo", "email")
    .with("phoneNo", "dialCode");

module.exports.updateProfile = Joi.object({
    email: Joi.string().email().optional(),
    phoneNo: Joi.string().allow("").optional(),
    dialCode: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().allow("").optional(),
    gender: Joi.string().allow("", "MALE", "FEMALE", "OTHER").optional(),
    country: Joi.string().optional(),
    state: Joi.string().optional(),
    city: Joi.string().optional(),
    address: Joi.string().optional(),
    latitude: Joi.string().optional(),
    longitude: Joi.string().optional(),
    birthDate: Joi.string().optional(),
    description: Joi.string().optional(),
    deviceToken: Joi.string().optional(),
    deviceType: Joi.string().optional(),
    docNumber: Joi.string().optional(),
    docImages: Joi.array().items(Joi.string().required()).optional(),
}).or("email", "phoneNo", "dialCode", "firstName", "lastName", "image", "gender", "country", "state", "city", "address", "latitude", "longitude", "birthDate", "description", "deviceToken", "deviceType", "docNumber", "docImages");

module.exports.changePassword = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required(),
});

module.exports.resetPassword = Joi.object({
    secretCode: Joi.string().optional(),
    accessToken: Joi.string().optional(),
    newPassword: Joi.string().required(),
    ReneterNewPassword: Joi.string().required().valid(Joi.ref("newPassword")),
}).xor("secretCode", "accessToken");

module.exports.sendOTP = Joi.object({
    email: Joi.string().email().optional(),
    phoneNo: Joi.string()
        .regex(/^[0-9]{5,}$/)
        .optional(),
    dialCode: Joi.string()
        .regex(/^\+?[0-9]{1,}$/)
        .optional(),
})
    .or("phoneNo", "email")
    .with("phoneNo", "dialCode");

module.exports.verifyOTP = Joi.object({
    email: Joi.string().email().optional(),
    phoneNo: Joi.string()
        .regex(/^[0-9]{5,}$/)
        .optional(),
    dialCode: Joi.string()
        .regex(/^\+?[0-9]{1,}$/)
        .optional(),
    secretCode: Joi.number().required(),
})
    .or("phoneNo", "email")
    .with("phoneNo", "dialCode");
