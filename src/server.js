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

const app = express();

// Parse JSON
app.use(express.json());

// Static files (frontend)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// API routes
app.use("/api", authRoutes);
app.use("/api", navRoutes);
app.use("/api", profileRoutes);
app.use("/api", searchRoutes);
app.use("/api", healthRoutes);
app.use("/api", adminRoutes);   // <--- adăugat

// Fallback to login.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

// Start server (DB is lazily initialized in db.js when first used)
function start() {
  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start();
