// src/server.js
const express = require("express");
const path = require("path");
const config = require("./config");

const authRoutes = require("./routes/auth");
const navRoutes = require("./routes/nav");
const profileRoutes = require("./routes/profile");
const searchRoutes = require("./routes/search");
const healthRoutes = require("./routes/health");
const adminRoutes = require("./routes/admin");
const interogariRoutes = require("./routes/interogari"); // <--- Import
const detinutRoutes = require("./routes/detinut"); // <--- ADD THIS

const app = express();

app.use(express.json());
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.use("/api", authRoutes);
app.use("/api", navRoutes);
app.use("/api", profileRoutes);
app.use("/api", searchRoutes);
app.use("/api", healthRoutes);
app.use("/api", adminRoutes);
app.use("/api", interogariRoutes); // <--- Register
app.use("/api", detinutRoutes); // <--- ADD THIS

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

function start() {
  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start();