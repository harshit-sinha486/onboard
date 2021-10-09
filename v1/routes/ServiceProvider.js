const router = require("express").Router();
const multer = require("multer");
const storage = multer.diskStorage({
    destination: "public/uploads/serviceProviders",
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
router.post("/socialLogin", Controller.ServiceProvider.socialLogin);
router.post("/register", Controller.ServiceProvider.register);
router.post("/login", Controller.ServiceProvider.login);
router.post("/logout", Auth.verify("ServiceProvider"), Controller.ServiceProvider.logout);
router.get("/getProfile", Auth.verify("ServiceProvider"), Controller.ServiceProvider.getProfile);
router.put("/updateProfile", Auth.verify("ServiceProvider"), Controller.ServiceProvider.updateProfile);
router.post("/changePassword", Auth.verify("ServiceProvider"), Controller.ServiceProvider.changePassword);
router.delete("/deleteAccount", Auth.verify("ServiceProvider"), Controller.ServiceProvider.deleteAccount);
router.post("/uploadFile", Auth.verify("ServiceProvider"), upload.single("file"), Controller.ServiceProvider.uploadFile);

router.post("/sendOtp", Controller.ServiceProvider.sendOtp);
router.post("/verifyOtp", Controller.ServiceProvider.verifyOtp);
router.post("/checkVerification", Auth.verify("ServiceProvider"), Controller.ServiceProvider.checkVerification);
router.post("/sendEmailVerification", Auth.verify("ServiceProvider"), Controller.ServiceProvider.sendEmailVerification);
router.post("/verifyAccountEmail", Controller.ServiceProvider.verifyAccountEmail);
router.post("/forgotPassword", Controller.ServiceProvider.sendOtp);
router.post("/resetPassword", Controller.ServiceProvider.resetPassword);

//Professionals CRUD
router.post("/createProfessionals", Auth.verify("ServiceProvider"), Controller.ServiceProvider.createProfessionals);
router.get("/readProfessionals", Auth.verify("ServiceProvider"), Controller.ServiceProvider.readProfessionals);
router.put("/updateProfessionals", Auth.verify("ServiceProvider"), Controller.ServiceProvider.updateProfessionals);
router.delete("/deleteProfessionals", Auth.verify("ServiceProvider"), Controller.ServiceProvider.deleteProfessionals);

// Services CRUD
router.post("/addService", Auth.verify("ServiceProvider"), Controller.ServiceProvider.addService);
router.put("/editService/:id", Auth.verify("ServiceProvider"), Controller.ServiceProvider.editService);
router.get("/getService", Auth.verify("ServiceProvider"), Controller.ServiceProvider.getService);
router.delete("/deleteService", Auth.verify("ServiceProvider"), Controller.ServiceProvider.deleteService);

// activeStatus API
router.post("/activeStatus", Auth.verify("ServiceProvider"), Controller.ServiceProvider.activeStatus);

module.exports = router;
