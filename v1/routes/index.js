const router = require("express").Router();
const CustomersRoutes = require("./Customer");
const ServiceProvidersRoutes = require("./ServiceProvider");
const StaffsRoutes = require("./Staff");
const AdminRoutes = require("./Admin");

router.use("/Customer", CustomersRoutes);
router.use("/ServiceProvider", ServiceProvidersRoutes);
router.use("/Staff", StaffsRoutes);
router.use("/Admin", AdminRoutes);

module.exports = router;
