const express = require("express");
const db = require("../../../db");
const router = express.Router();

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined ? null : val);

// --- HELPER: Permission Checker ---
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
  } catch (e) { return false; }
}

// --- 1. PERMISSIONS ENDPOINT ---
router.get("/detinut/permissions/securitate", async (req, res) => {
    const uid = getUid(req);
    if (!uid) return res.json({ success: true, perms: {} });

    try {
        // IDs: 26=Securitate Pers, 27=Evadare, 28=Autoritate
        const sql = `SELECT ID_MODUL, DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL IN (26, 27, 28)`;
        const result = await db.execute(sql, { u: uid });
        
        const perms = {};
        result.rows.forEach(r => perms[r.ID_MODUL] = r.DREPT);
        
        res.json({ success: true, perms });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- 2. METADATA ---
router.get("/detinut/meta/securitate", async (req, res) => {
  try {
    const [statusCrim, penitenciars, tipSecur] = await Promise.all([
      db.execute("SELECT ID, NAME FROM PRISON.SPR_STATUS_CRIM ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_SECURITATE_APLICATE ORDER BY NAME")
    ]);
    res.json({
      success: true,
      statusCrim: statusCrim.rows,
      penitenciars: penitenciars.rows,
      tipSecur: tipSecur.rows
    });
  } catch(e) { 
    res.status(500).json({success:false, error: e.message}); 
  }
});

// --- 3. AUTORITATE (ID 28) ---
router.get("/detinut/:idnp/securitate/autoritate", async (req, res) => {
    if (!await checkPermission(getUid(req), 28, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    // Using V_AUTORITATE based on PHP source
    const sql = `SELECT ID, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_STATUS_CRIM, ALIASS, MOTIV FROM PRISON.V_AUTORITATE WHERE IDNP = :idnp ORDER BY BDATE DESC NULLS LAST`;
    const result = await db.execute(sql, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});

router.post("/detinut/:idnp/securitate/autoritate", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 28, 'W')) return res.status(403).json({ success: false });
    
    const { bdate, edate, motiv, id_status_crim, aliass } = req.body;
    
    // FIX: Truncate IP to 15 chars to prevent ORA-12899
    const ip = (req.ip || '0.0.0.0').substring(0, 15);
    
    // FIX: Clean SQL syntax to prevent ORA-01745
    const sql = `
        INSERT INTO PRISON.AUTORITATE 
        (ID, IDNP, BDATE, EDATE, MOTIV, ID_STATUS_CRIM, ALIASS, CREATEDBY, CREATEIPUSER, INSERTEDDATE) 
        VALUES 
        (PRISON.AUTORITATE_SEQ.NEXTVAL, :idnp, TO_DATE(:b,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :motiv, :stat, :alias, :usr, :ip, SYSDATE)
    `;
    
    try { 
        await db.execute(sql, { 
            idnp: req.params.idnp, 
            b: safe(bdate), 
            e: safe(edate), 
            motiv: safe(motiv), 
            stat: safe(id_status_crim), 
            alias: safe(aliass),
            usr: uid, 
            ip: ip // Passed truncated IP
        }, { autoCommit: true }); 
        res.json({ success: true }); 
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/securitate/autoritate/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 28, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.AUTORITATE WHERE ID = :id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- 4. EVADARE (ID 27) ---
router.get("/detinut/:idnp/securitate/evadare", async (req, res) => {
    if (!await checkPermission(getUid(req), 27, 'R')) return res.status(403).json({ success: false });
    const sql = `SELECT ID, TO_CHAR(OUT_DATE, 'DD.MM.YYYY') as OUT_DATE, TO_CHAR(IN_DATE, 'DD.MM.YYYY') as IN_DATE, NAME_PENITENCIAR, HUNTER FROM PRISON.V_EVADARE WHERE IDNP = :idnp ORDER BY OUT_DATE DESC NULLS LAST`;
    const result = await db.execute(sql, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});

router.post("/detinut/:idnp/securitate/evadare", async (req, res) => {
    if (!await checkPermission(getUid(req), 27, 'W')) return res.status(403).json({ success: false });
    
    const { id_penitenciar, out_date, in_date, hunter } = req.body;
    
    // FIX: Renamed :in and :out to :d_in and :d_out to avoid ORA-01745
    // FIX: Removed ID from insert (Your trigger EVADARE_TRG handles it)
    const sql = `
        INSERT INTO PRISON.EVADARE 
        (IDNP, OUT_DATE, IN_DATE, ID_PENITENCIAR, HUNTER)
        VALUES 
        (:idnp, TO_DATE(:d_out,'DD.MM.YYYY'), TO_DATE(:d_in,'DD.MM.YYYY'), :pen, :hunt)
    `;
    
    try { 
        await db.execute(sql, { 
            idnp: req.params.idnp, 
            d_out: safe(out_date), // Renamed key
            d_in: safe(in_date),   // Renamed key
            pen: safe(id_penitenciar), 
            hunt: safe(hunter)
        }, { autoCommit: true }); 
        res.json({ success: true }); 
    } catch(e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

router.delete("/detinut/securitate/evadare/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 27, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.EVADARE WHERE ID = :id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- 5. SECURITATE PERSONALA (ID 26) ---
router.get("/detinut/:idnp/securitate/pers", async (req, res) => {
    if (!await checkPermission(getUid(req), 26, 'R')) return res.status(403).json({ success: false });
    const sql = `SELECT ID, NAME_TIP_SECUR_APL, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, TEMEI_LUARE, TEMEI_SCOATE FROM PRISON.V_SECURITATE_PERSONALA WHERE IDNP = :idnp ORDER BY BDATE DESC NULLS LAST`;
    const result = await db.execute(sql, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});

router.post("/detinut/:idnp/securitate/pers", async (req, res) => {
    if (!await checkPermission(getUid(req), 26, 'W')) return res.status(403).json({ success: false });
    const { id_tip, bdate, edate, temei_luare, temei_scoate } = req.body;

    const sql = `INSERT INTO PRISON.SECURITATE_PERSONALA (ID, IDNP, BDATE, EDATE, TEMEI_LUARE, TEMEI_SCOATE, ID_TIP_SECUR_APL)
                 VALUES (PRISON.SECURITATE_PERSONALA_SEQ.NEXTVAL, :idnp, TO_DATE(:b,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :tl, :ts, :tip)`;
    try {
        await db.execute(sql, { 
            idnp: req.params.idnp, b: safe(bdate), e: safe(edate), 
            tl: safe(temei_luare), ts: safe(temei_scoate), tip: safe(id_tip)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/securitate/pers/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 26, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.SECURITATE_PERSONALA WHERE ID = :id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;