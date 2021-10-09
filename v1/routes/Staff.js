const router = require("express").Router();
const multer = require("multer");
const storage = multer.diskStorage({
    destination: "public/uploads/staffs",
    filename: function (req, file, cb) {
        const extension = "".concat(file.originalname).split(".").pop();
        const filename = Date.now().toString(36);
        cb(null, `${filename}.${extension}`);
    },
});
const upload = multer({ storage });

const Auth = require("../../common/authenticate");
const Controller = require("../controllers");

router.post("/login", Controller.Staff.login);
router.post("/logout", Auth.verify("Staff"), Controller.Staff.logout);

router.post("/sendOtp", Controller.Staff.sendOtp);
router.post("/verifyOtp", Controller.Staff.verifyOtp);
router.post("/forgotPassword", Controller.Staff.resetPassword);

module.exports = router;
