const express = require("express");
const path = require("path");
const config = require("./config");

// We still use these legacy routes for now
const detinutRoutes = require("./routes/detinut");

const app = express();
app.use(express.json());

// 1. SERVE RESOURCES (This was missing!)
// This allows HTML files to find /resources/css/styles.css
app.use("/resources", express.static(path.join(__dirname, "..", "resources")));

// 2. SERVE PUBLIC (HTML files)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// 3. SERVE MODULE SCRIPTS
// This allows <script src="/modules/..."> to work
app.use("/modules", express.static(path.join(__dirname, "modules")));

// 4. API ROUTES
// New Modules
app.use("/api", require("./modules/admin/router"));
app.use("/api", require("./modules/auth/router"));
app.use("/api", require("./modules/search/router"));
app.use("/api", require("./modules/user/nav.router"));
app.use("/api", require("./modules/user/profile.router"));
app.use("/api", require("./modules/reports/router"));
app.use("/api", require("./modules/health/router"));
app.use("/api", require("./modules/detinut-add/router"));
// Legacy/Shared Routes
app.use("/api", detinutRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

function start() {
  // Initialize DB Pool (if db.js exports initPool, otherwise just start)
  const db = require("./db");
  if (db.initPool) {
      db.initPool().then(() => {
          app.listen(config.port, () => {
            console.log(`Server listening on http://localhost:${config.port}`);
          });
      }).catch(err => console.error("DB Init Error:", err));
  } else {
      app.listen(config.port, () => {
        console.log(`Server listening on http://localhost:${config.port}`);
      });
  }
}

start();