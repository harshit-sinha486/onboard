const router = require("express").Router();
const multer = require("multer");
const storage = multer.diskStorage({
    destination: "public/uploads/admin",
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

router.post("/login", Controller.Admin.login);
router.post("/logout", Auth.verify("Admin"), Controller.Admin.logout);
router.get("/getProfile", Auth.verify("Admin"), Controller.Admin.getProfile);
router.put("/updateProfile", Auth.verify("Admin"), Controller.Admin.updateProfile);
router.post("/changePassword", Auth.verify("Admin"), Controller.Admin.changePassword);
router.post("/uploadFile", Auth.verify("Admin"), upload.single("file"), Controller.Admin.uploadFile);

router.post("/forgotPassword", Controller.Admin.sendNewPasswordInEmail);

module.exports = router;
