// src/routes/health.js
const express = require("express");
const db = require("../../db");
const router = express.Router();

/**
 * GET /api/health
 * Tries a trivial SELECT 1 FROM DUAL.
 * If it fails (Oracle client missing, DB down, etc.), we tell the frontend
 * that the DB connection is not available.
 */
router.get("/health", async (req, res) => {
  try {
    await db.execute("SELECT 1 FROM DUAL", {}, {});
    return res.json({
      success: true,
      dbAvailable: true
    });
  } catch (err) {
    console.error("DB health check failed:", err);
    return res.status(200).json({
      success: false,
      dbAvailable: false,
      message:
        "Pagina web este accesibilă dar conexiunea cu baza de date a eșuat. Vă rugăm contactați-ne de urgență la anp.siarprac@anp.gov.md."
    });
  }
});

module.exports = router;
