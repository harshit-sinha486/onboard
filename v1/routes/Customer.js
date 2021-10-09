const router = require("express").Router();
const multer = require("multer");
const storage = multer.diskStorage({
    destination: "public/uploads/customers",
    filename: function (req, file, cb) {
        const extension = "".concat(file.originalname).split(".").pop();
        const filename = Date.now().toString(36);
        cb(null, `${filename}.${extension}`);
    },
});
const upload = multer({ storage });

const Auth = require("../../common/authenticate");
const Controller = require("../controllers");

//  ONBOARDING API'S
router.post("/socialLogin", Controller.Customer.socialLogin);
router.post("/register", Controller.Customer.register);
router.post("/login", Controller.Customer.login);
router.post("/logout", Auth.verify("Customer"), Controller.Customer.logout);
router.get("/getProfile", Auth.verify("Customer"), Controller.Customer.getProfile);
router.put("/updateProfile", Auth.verify("Customer"), Controller.Customer.updateProfile);
router.post("/changePassword", Auth.verify("Customer"), Controller.Customer.changePassword);
router.delete("/deleteAccount", Auth.verify("Customer"), Controller.Customer.deleteAccount);
router.post("/uploadFile", Auth.verify("Customer"), upload.single("file"), Controller.Customer.uploadFile);

router.post("/sendOtp", Controller.Customer.sendOtp);
router.post("/verifyOtp", Controller.Customer.verifyOtp);
router.post("/checkVerification", Auth.verify("Customer"), Controller.Customer.checkVerification);
router.post("/sendEmailVerification", Auth.verify("Customer"), Controller.Customer.sendEmailVerification);
router.post("/verifyAccountEmail", Controller.Customer.verifyAccountEmail);
router.post("/forgotPassword", Controller.Customer.sendOtp);
router.post("/resetPassword", Controller.Customer.resetPassword);

// HomeScreen Api's

router.get("/getcategories", Auth.verify("Customer"), Controller.Customer.getCategories);
router.get("/StaffByCategory/:id", Auth.verify("Customer"), Controller.Customer.StaffByCategoryId);
router.get("/staffServices/:id", Auth.verify("Customer"), Controller.Customer.staffServicesById);

// Filtering & Sorting

router.get("/preFilterData", Auth.verify("Customer"), Controller.Customer.preFilterData);
router.get("/filterAndSort", Auth.verify("Customer"), Controller.Customer.filterAndSort);

// router.get("/getprofessionals",Controller.Customer.getProfessionals)
// router.get("/getservices", Controller.Customer.getServices);

module.exports = router;
