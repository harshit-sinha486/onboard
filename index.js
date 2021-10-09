"use strict";
require("dotenv").config();

const express = require("express");
const app = express();
const server = require("http").createServer(app);
const cors = require("cors");
const logger = require("morgan");
const bodyParser = require("body-parser");
const connection = require("./common/connection");
const processes = require("./common/processes");
const responses = require("./common/responses");
const v1Routes = require("./v1/routes");

app.use(cors());
app.use(responses());
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/v1", v1Routes);
app.use("/", express.static(__dirname + "/public"));

// 404, Not Found
app.use((req, res, next) => res.error(404, "NOT_FOUND"));

// Error handling
app.use((error, req, res, next) => {
    console.error(error);
    return res.error(400, error.message || error);
});

// Listening & Initializing
server.listen(process.env.PORT, async () => {
    console.log(`Environment:`, process.env.NODE_ENV);
    console.log(`Running on:`, process.env.PORT);

    connection.mongodb();
    processes.init();
});
