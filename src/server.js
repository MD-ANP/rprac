const express = require("express");
const path = require("path");
const config = require("./config");
const db = require("./db");

const app = express();

// --- CONFIGURARE MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- RESURSE STATICE ---
const PATHS = {
    resources: path.join(__dirname, "..", "resources"),
    public: path.join(__dirname, "..", "public"),
    modules: path.join(__dirname, "modules"),
    uploads: path.join(__dirname, "..", "uploads")
};

app.use("/resources", express.static(PATHS.resources));
app.use("/modules", express.static(PATHS.modules));
app.use("/uploads", express.static(PATHS.uploads));
app.use(express.static(PATHS.public));

// --- RUTE API (MODULARIZATE) ---

// 1. Module de Sistem & Autentificare
app.use("/api", require("./modules/auth/router"));
app.use("/api", require("./modules/user/nav.router"));
app.use("/api", require("./modules/admin/router"));
app.use("/api", require("./modules/health/router"));

// 2. Module de Căutare și Gestiune Generală
app.use("/api", require("./modules/search/router"));
app.use("/api", require("./modules/detinut-add/router"));
app.use("/api", require("./modules/comasare/router"));
app.use("/api", require("./modules/reports/router"));

// 3. Module Specifice Deținut (Inmate)
const INMATE_ROUTES = [
    "profile", "medical", "garantii", "rude", 
    "complici", "hotariri", "citatie", "miscari"
];

INMATE_ROUTES.forEach(route => {
    app.use("/api", require(`./modules/inmate/${route}/router`));
});

// --- RUTE PRINCIPALE ---
app.get("/", (req, res) => {
    res.sendFile(path.join(PATHS.public, "login.html"));
});

// --- HANDLERS EROARE ---

// 404 - Not Found
app.use((req, res) => {
    res.status(404).json({ success: false, error: "Ruta API nu a fost găsită." });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Internal Server Error:", err.stack);
    res.status(500).json({ success: false, error: "Eroare internă de server." });
});

// --- INIȚIALIZARE SERVER ---
async function startServer() {
    console.log("-----------------------------------------");
    console.log("🚀 Initializing System...");

    try {
        console.log("📡 Connecting to Oracle Database...");
        await db.initPool();
        console.log("✅ DB Pool Initialized Successfully.");
        
        app.listen(config.port, () => {
            console.log(`🌐 Server Online: http://localhost:${config.port}`);
            console.log("-----------------------------------------");
        });
    } catch (err) {
        console.error("❌ Critical: Failed to init DB Pool:", err.message);
        
        // Pornire în modul limitat (Offline) dacă baza de date e indisponibilă
        app.listen(config.port, () => {
            console.log(`⚠️  Server started in OFFLINE MODE on port ${config.port}`);
            console.log("-----------------------------------------");
        });
    }
}

startServer();