// src/server.js
const express = require("express");
const path = require("path");
const config = require("./config");
const db = require("./db");

const app = express();
app.use(express.json());

// 1. SERVE RESOURCES (CSS, Images, Core JS)
app.use("/resources", express.static(path.join(__dirname, "..", "resources")));

// 2. SERVE PUBLIC (HTML files)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// 3. SERVE MODULE SCRIPTS (Allows <script src="/modules/...">)
app.use("/modules", express.static(path.join(__dirname, "modules")));

// 4. REGISTER API ROUTES (Modularized)
app.use("/api", require("./modules/admin/router"));
app.use("/api", require("./modules/auth/router"));
app.use("/api", require("./modules/search/router"));
app.use("/api", require("./modules/user/nav.router"));
app.use("/api", require("./modules/user/profile.router"));
app.use("/api", require("./modules/reports/router"));
app.use("/api", require("./modules/health/router"));
app.use("/api", require("./modules/detinut-add/router"));
app.use("/api", require("./modules/comasare/router"));


// Inmate Modules
app.use("/api", require("./modules/inmate/profile/router"));
app.use("/api", require("./modules/inmate/medical/router"));
app.use("/api", require("./modules/inmate/garantii/router"));
app.use("/api", require("./modules/inmate/rude/router"));
app.use("/api", require("./modules/inmate/complici/router"));
app.use("/api", require("./modules/inmate/hotariri/router"));


app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

function start() {
  console.log("Initializing DB Pool...");
  db.initPool()
    .then(() => {
      console.log("✅ DB Pool Initialized.");
      app.listen(config.port, () => {
        console.log(`Server listening on http://localhost:${config.port}`);
      });
    })
    .catch((err) => {
      console.error("❌ Failed to init DB:", err);
      app.listen(config.port, () => {
        console.log(`Server started (Offline Mode) on http://localhost:${config.port}`);
      });
    });
}

start();