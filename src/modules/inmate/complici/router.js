const express = require("express");
const db = require("../../../db");
const router = express.Router();

// Modulul ID 4 pentru "Complici" (presupus următorul ID)
const COMPLICI_MODULE_ID = 4; 

// --- Funcții Helper (Copiate pentru modularitate) ---
function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined || val === '') ? null : val;

/**
 * Verifică permisiunile utilizatorului pe un modul specific.
 */
async function checkPermission(userId, moduleId, requiredRight = 'R') {
  if (!userId) return false;
  try {
    const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL = :m`;
    const res = await db.execute(sql, { u: userId, m: moduleId });
    const right = res.rows.length ? res.rows[0].DREPT : null;
    
    if (!right) return false;
    
    if (requiredRight === 'R') return (right === 'R' || right === 'W');
    if (requiredRight === 'W') return (right === 'W');
    
    return false;
  } catch (e) { 
    console.error("Permission check failed:", e);
    return false;
  }
}

// --- METADATA ROUTE (SPR_COMPLICI_STATUS) ---
router.get("/detinut/meta/complici", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, COMPLICI_MODULE_ID, 'R')) {
      return res.status(403).json({ success: false, error: "Acces interzis la metadate." });
  }

  try {
    const statusRes = await db.execute("SELECT ID, NAME FROM PRISON.SPR_COMPLICI_STATUS ORDER BY NAME");
    res.json({
      success: true,
      compliciStatus: statusRes.rows
    });
  } catch(e) { 
    console.error("Error loading complici statuses:", e);
    res.status(500).json({success:false, error: "Eroare la încărcarea statutelor complicilor."}); 
  }
});


// --- LIST COMPLICI (GET) ---
router.get("/detinut/:idnp/complici", async (req, res) => {
    const uid = getUid(req);
    // Check Read Permission
    if (!await checkPermission(uid, COMPLICI_MODULE_ID, 'R')) {
        return res.status(403).json({ success: false, error: "Acces interzis (Permisiune R lipsă)." });
    }
    
    // Check Write Permission separately to enable/disable UI buttons
    const canWrite = await checkPermission(uid, COMPLICI_MODULE_ID, 'W');
    
    try {
        const sql = `
            SELECT C.ID, C.IDNP, C.NUME, C.PRENUME, C.PATRONIMIC, C.DOSAR, 
                   C.ID_STATUS,
                   TO_CHAR(C.BIRTHDAY, 'DD.MM.YYYY') as BIRTHDAY_STR,
                   TO_CHAR(C.HDATE, 'DD.MM.YYYY') as HDATE_STR,
                   SCS.NAME as STATUS_NAME
            FROM PRISON.COMPLICI C
            INNER JOIN PRISON.SPR_COMPLICI_STATUS SCS ON SCS.ID = C.ID_STATUS
            WHERE C.IDNP_DET = :idnp
            ORDER BY C.HDATE DESC
        `;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows, canWrite });
    } catch (e) {
        console.error("Error listing complici:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- ADD COMPLICE (POST) ---
router.post("/detinut/:idnp/complici", async (req, res) => {
    // Check Write Permission
    if (!await checkPermission(getUid(req), COMPLICI_MODULE_ID, 'W')) {
        return res.status(403).json({ success: false, error: "Permisiuni insuficiente pentru adăugare (Permisiune W lipsă)." });
    }
    
    const { nume, prenume, patronimic, birthday, idnpComplice, dosar, hDate, idStatus } = req.body;
    
    // Basic validation
    if (!nume || !prenume || !idStatus) {
        return res.status(400).json({ success: false, error: "Nume, Prenume și Statusul sunt obligatorii." });
    }

    try {
        // ID is populated by the trigger COMPLICI_TRG (using COMPLICI_SEQ.nextval)
        const sql = `
            INSERT INTO PRISON.COMPLICI (
                IDNP_DET, NUME, PRENUME, PATRONIMIC, IDNP, BIRTHDAY, HDATE, DOSAR, ID_STATUS
            ) VALUES (
                :idnp_det, :nume, :prenume, :patronimic, :idnpComplice, 
                ${birthday ? `TO_DATE(:birthday,'DD.MM.YYYY')` : `NULL`}, 
                ${hDate ? `TO_DATE(:hDate,'DD.MM.YYYY')` : `NULL`}, 
                :dosar, :idStatus
            )
        `;
        
        await db.execute(
            sql, 
            {
                idnp_det: req.params.idnp,
                nume: nume.toUpperCase(),
                prenume: prenume.toUpperCase(),
                patronimic: safe(patronimic),
                idnpComplice: safe(idnpComplice),
                birthday: safe(birthday),
                hDate: safe(hDate),
                dosar: safe(dosar),
                idStatus: Number(idStatus),
            }, 
            { autoCommit: true }
        ); 
        res.json({ success: true }); 
    } catch(e) { 
        console.error("Add Complice Error:", e);
        res.status(500).json({ success: false, error: e.message || "Eroare la adăugarea complicelui." }); 
    }
});

// --- DELETE COMPLICE (DELETE) ---
router.delete("/detinut/complici/:id", async (req, res) => {
    // Check Write Permission
    if (!await checkPermission(getUid(req), COMPLICI_MODULE_ID, 'W')) {
        return res.status(403).json({ success: false, error: "Permisiuni insuficiente pentru ștergere (Permisiune W lipsă)." });
    }
    
    try { 
        const id = Number(req.params.id);
        const result = await db.execute("DELETE FROM PRISON.COMPLICI WHERE ID = :id", { id }, { autoCommit: true }); 
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ success: false, error: "Înregistrarea nu a fost găsită." });
        }
        
        res.json({ success: true }); 
    } catch(e) { 
        console.error("Delete Complice Error:", e);
        res.status(500).json({ success: false, error: e.message || "Eroare la ștergerea complicelui." }); 
    }
});

module.exports = router;