const express = require("express");
const db = require("../../db");const oracledb = require("oracledb"); // <--- Ensures BIND_OUT and NUMBER are available
const router = express.Router();

// Middleware to check permissions (Roles 1, 7, 99)
async function checkPermission(req, res, next) {
  const uid = req.header("x-user-id");
  if (!uid) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const r = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :id", { id: uid });
    if (r.rows.length > 0) {
      const role = Number(r.rows[0].ID_ROLE);
      // Roles allowed: 1, 7, 99
      if ([1, 7, 99].includes(role)) {
        return next();
      }
    }
    return res.status(403).json({ success: false, error: "Access denied." });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error checking permissions." });
  }
}

router.post("/detinuti/add", checkPermission, async (req, res) => {
  const { nume, prenume, patronimic, data_nasterii, idnp } = req.body;

  // Basic validation
  if (!nume || !prenume || !data_nasterii || !idnp) {
    return res.json({ success: false, error: "Toate câmpurile (mai puțin patronimic) sunt obligatorii." });
  }

  const sql = `
    INSERT INTO PRISON.DETINUTI (
      NAME, 
      SURNAME, 
      SEC_NAME, 
      BIRDTH, 
      IDNP,
      -- Defaults required by Non-Null constraints
      SEX, WPOLICE, ID_SPR_CATEG_SOCIAL, ID_SPR_EDU_LEVEL, 
      ID_HEALTH_STAT, ID_MAR_STATUS, ID_SPR_NATIONALITY, ID_SPR_RELIGION
    ) VALUES (
      :prenume, 
      :nume, 
      :patronimic, 
      TO_DATE(:dob, 'DD.MM.YYYY'), 
      :idnp,
      'M', 'N', 0, 0, 0, 0, 0, 0
    )
    RETURNING ID INTO :rid
  `;

  try {
    const result = await db.execute(
      sql, 
      {
        prenume: prenume,
        nume: nume,
        patronimic: patronimic || '-',
        dob: data_nasterii,
        idnp: idnp,
        // Using correct oracledb constants
        rid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } 
      },
      { autoCommit: true } // <--- CRITICAL FIX: Commits the transaction
    );

    const newId = result.outBinds.rid ? result.outBinds.rid[0] : null;

    res.json({ success: true, message: "Deținut adăugat cu succes.", id: newId });

  } catch (err) {
    console.error("Add Detinut Error:", err);
    // Handle Unique Constraint on IDNP
    if (err.message.includes("unique constraint") && err.message.includes("IDNP")) {
      return res.json({ success: false, error: "Acest IDNP există deja în baza de date." });
    }
    res.status(500).json({ success: false, error: "Eroare la salvarea în baza de date." });
  }
});

module.exports = router;