const express = require("express");
const db = require("../../../db");
const router = express.Router();

// Modulul ID 3 pentru "Rude" (conform cererii)
const RUDE_MODULE_ID = 3; 

// --- Funcții Helper ---

// Extrage ID-ul utilizatorului din header (pentru verificare permisiuni)
function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}

// Asigură că valoarea este null dacă este undefined, altfel returnează valoarea
const safe = (val) => (val === undefined || val === '') ? null : val;

/**
 * Verifică permisiunile utilizatorului pe un modul specific.
 * @param {number} userId - ID-ul utilizatorului.
 * @param {number} moduleId - ID-ul modulului din SPR_MODULES (aici 3).
 * @param {'R'|'W'} requiredRight - Dreptul minim necesar ('R' sau 'W').
 * @returns {Promise<boolean>}
 */
async function checkPermission(userId, moduleId, requiredRight = 'R') {
  if (!userId) return false;
  try {
    const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL = :m`;
    const res = await db.execute(sql, { u: userId, m: moduleId });
    const right = res.rows.length ? res.rows[0].DREPT : null;
    
    if (!right) return false;
    
    // R (Read) allows R or W access
    if (requiredRight === 'R') return (right === 'R' || right === 'W');
    // W (Write) only allows W access
    if (requiredRight === 'W') return (right === 'W');
    
    return false;
  } catch (e) { 
    console.error("Permission check failed:", e);
    return false;
  }
}

// --- METADATA ROUTE (SPR_RELATIVE_TYPE) ---
router.get("/detinut/meta/rude", async (req, res) => {
  // Metadata is public/read-only info, R access is sufficient
  const uid = getUid(req);
  if (!await checkPermission(uid, RUDE_MODULE_ID, 'R')) {
      return res.status(403).json({ success: false, error: "Acces interzis la metadate." });
  }

  try {
    const typesRes = await db.execute("SELECT ID, NAME FROM PRISON.SPR_RELATIVE_TYPE ORDER BY NAME");
    res.json({
      success: true,
      relativeTypes: typesRes.rows
    });
  } catch(e) { 
    console.error("Error loading relative types:", e);
    res.status(500).json({success:false, error: "Eroare la încărcarea tipurilor de rude."}); 
  }
});


// --- LIST RELATIVES (GET) ---
router.get("/detinut/:idnp/rude", async (req, res) => {
    const uid = getUid(req);
    // Check Read Permission
    if (!await checkPermission(uid, RUDE_MODULE_ID, 'R')) {
        return res.status(403).json({ success: false, error: "Acces interzis (Permisiune R lipsă)." });
    }
    
    // Check Write Permission separately to enable/disable UI buttons
    const canWrite = await checkPermission(uid, RUDE_MODULE_ID, 'W');
    
    try {
        const sql = `
            SELECT R.ID, R.IDNP_DET, R.SURNAME, R.NAME, R.SEC_NAME, R.IDNP, R.PHONE, R.ADDRESS,
                   R.ID_RELATIVE_TYPE,
                   TO_CHAR(R.D_BIRDTH, 'DD.MM.YYYY') as D_BIRDTH_STR,
                   SRT.NAME as RELATIVE_TYPE_NAME
            FROM PRISON.RELATIVES R
            INNER JOIN PRISON.SPR_RELATIVE_TYPE SRT ON SRT.ID = R.ID_RELATIVE_TYPE
            WHERE R.IDNP_DET = :idnp
            ORDER BY R.SURNAME, R.NAME
        `;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows, canWrite });
    } catch (e) {
        console.error("Error listing relatives:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- ADD RELATIVE (POST) ---
router.post("/detinut/:idnp/rude", async (req, res) => {
    // Check Write Permission
    if (!await checkPermission(getUid(req), RUDE_MODULE_ID, 'W')) {
        return res.status(403).json({ success: false, error: "Permisiuni insuficiente pentru adăugare (Permisiune W lipsă)." });
    }
    
    const { surname, name, secName, dBirdth, idRelativeType, idnpRude, phone, address } = req.body;
    
    // Basic validation
    if (!surname || !name || !idRelativeType) {
        return res.status(400).json({ success: false, error: "Nume, Prenume și Tipul Relației sunt obligatorii." });
    }

    try {
        // ID is populated by the trigger RELATIVES_TRG1 (using RELATIVES_SEQ.nextval)
        const sql = `
            INSERT INTO PRISON.RELATIVES (
                IDNP_DET, SURNAME, NAME, SEC_NAME, D_BIRDTH, ID_RELATIVE_TYPE, IDNP, PHONE, ADDRESS
            ) VALUES (
                :idnp_det, :surname, :name, :secName, 
                ${dBirdth ? `TO_DATE(:dBirdth,'DD.MM.YYYY')` : `NULL`}, 
                :idType, :idnpRude, :phone, :address
            )
        `;
        
        await db.execute(
            sql, 
            {
                idnp_det: req.params.idnp,
                surname: surname.toUpperCase(),
                name: name.toUpperCase(),
                secName: safe(secName),
                dBirdth: safe(dBirdth),
                idType: Number(idRelativeType),
                idnpRude: safe(idnpRude),
                phone: safe(phone),
                address: safe(address)
            }, 
            { autoCommit: true }
        ); 
        res.json({ success: true }); 
    } catch(e) { 
        console.error("Add Relative Error:", e);
        res.status(500).json({ success: false, error: e.message || "Eroare la adăugarea rudei." }); 
    }
});

// --- DELETE RELATIVE (DELETE) ---
router.delete("/detinut/rude/:id", async (req, res) => {
    // Check Write Permission
    if (!await checkPermission(getUid(req), RUDE_MODULE_ID, 'W')) {
        return res.status(403).json({ success: false, error: "Permisiuni insuficiente pentru ștergere (Permisiune W lipsă)." });
    }
    
    try { 
        const id = Number(req.params.id);
        const result = await db.execute("DELETE FROM PRISON.RELATIVES WHERE ID = :id", { id }, { autoCommit: true }); 
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ success: false, error: "Înregistrarea nu a fost găsită." });
        }
        
        res.json({ success: true }); 
    } catch(e) { 
        console.error("Delete Relative Error:", e);
        res.status(500).json({ success: false, error: e.message || "Eroare la ștergerea rudei." }); 
    }
});

module.exports = router;