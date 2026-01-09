const express = require("express");
const db = require("../../../db");
const router = express.Router();

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined ? null : val);

// --- HELPER: Permission Checker (DB Based) ---
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
router.get("/detinut/permissions/medical", async (req, res) => {
    const uid = getUid(req);
    if (!uid) return res.json({ success: true, perms: {} });

    try {
        // IDs: 7=Greva, 8=Diagnoza, 10=Radiografie, 11=Consult
        const sql = `SELECT ID_MODUL, DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL IN (7, 8, 10, 11)`;
        const result = await db.execute(sql, { u: uid });
        
        const perms = {};
        result.rows.forEach(r => perms[r.ID_MODUL] = r.DREPT);
        
        res.json({ success: true, perms });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- 2. METADATA ---
router.get("/detinut/meta/medical", async (req, res) => {
  try {
    const [motives, diagnoz, results, penitenciars, hospitals, inv] = await Promise.all([
      db.execute("SELECT ID, NAME FROM PRISON.SPR_MOTIV_GREVA_FOAMEI ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_DIAGNOZ ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_RADIOGRAFIE_RESULTAT ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_HOSPITALS ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_INVESTIGATII ORDER BY NAME")
    ]);
    res.json({
      success: true,
      motives: motives.rows,
      diagnoz: diagnoz.rows,
      results: results.rows,
      penitenciars: penitenciars.rows,
      hospitals: hospitals.rows,
      investigations: inv.rows
    });
  } catch(e) { 
    res.status(500).json({success:false, error: e.message}); 
  }
});

// --- 3. GREVA FOAMEI (ID 7) ---
router.get("/detinut/:idnp/medical/greva", async (req, res) => {
    if (!await checkPermission(getUid(req), 7, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const result = await db.execute(`SELECT G.ID, TO_CHAR(G.BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(G.EDATE, 'DD.MM.YYYY') as EDATE, G.ID_MOTIV, S.NAME as MOTIV FROM PRISON.GREVA_FOAMEI G LEFT JOIN PRISON.SPR_MOTIV_GREVA_FOAMEI S ON S.ID = G.ID_MOTIV WHERE G.IDNP = :idnp ORDER BY G.BDATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});
router.post("/detinut/:idnp/medical/greva", async (req, res) => {
    if (!await checkPermission(getUid(req), 7, 'W')) return res.status(403).json({ success: false });
    const { bdate, edate, id_motiv } = req.body;
    try { await db.execute("INSERT INTO PRISON.GREVA_FOAMEI (ID, IDNP, BDATE, EDATE, ID_MOTIV) VALUES (PRISON.GREVA_FOAMEI_SEQ.NEXTVAL, :idnp, TO_DATE(:b,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :m)", { idnp: req.params.idnp, b: safe(bdate), e: safe(edate), m: safe(id_motiv) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/greva/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 7, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.GREVA_FOAMEI WHERE ID = :id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- 4. DIAGNOZA (ID 8) ---
router.get("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'R')) return res.status(403).json({ success: false });
    const result = await db.execute(`SELECT D.ID, TO_CHAR(D.ADATE, 'DD.MM.YYYY') as ADATE, D.NOTE, D.ID_DIAGNOZ, S.NAME as DIAGNOZ_NAME, S.ID as DIAGNOZ_COD FROM PRISON.DIAGNOZ D LEFT JOIN PRISON.SPR_DIAGNOZ S ON S.ID = D.ID_DIAGNOZ WHERE D.IDNP = :idnp ORDER BY D.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});
router.post("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'W')) return res.status(403).json({ success: false });
    const { adate, id_diagnoz, note } = req.body;
    try { await db.execute("INSERT INTO PRISON.DIAGNOZ (ID, IDNP, ADATE, ID_DIAGNOZ, NOTE) VALUES (PRISON.DIAGNOZ_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :diag, :note)", { idnp: req.params.idnp, d: safe(adate), diag: safe(id_diagnoz), note: safe(note) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/diagnoza/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.DIAGNOZ WHERE ID=:id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- 5. RADIOGRAFIE (ID 10) ---
router.get("/detinut/:idnp/medical/radiografie", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'R')) return res.status(403).json({ success: false });
    const result = await db.execute(`SELECT R.ID, TO_CHAR(R.ADATE, 'DD.MM.YYYY') as ADATE, R.COMMENTS, R.ID_PENETENTIAR, R.ID_RESULTAT, P.NAME as PENITENCIAR, RES.NAME as REZULTAT FROM PRISON.RADIOGRAFIE R LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = R.ID_PENETENTIAR LEFT JOIN PRISON.SPR_RADIOGRAFIE_RESULTAT RES ON RES.ID = R.ID_RESULTAT WHERE R.IDNP = :idnp ORDER BY R.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});
router.post("/detinut/:idnp/medical/radiografie", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'W')) return res.status(403).json({ success: false });
    const { adate, id_resultat, id_penitenciar, comments } = req.body;
    try { await db.execute("INSERT INTO PRISON.RADIOGRAFIE (ID, IDNP, ADATE, ID_RESULTAT, ID_PENETENTIAR, COMMENTS) VALUES (PRISON.RADIOGRAFIE_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :res, :pen, :comm)", { idnp: req.params.idnp, d:safe(adate), res:safe(id_resultat), pen:safe(id_penitenciar), comm:safe(comments) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/radiografie/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.RADIOGRAFIE WHERE ID=:id", { id:req.params.id }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- 6. CONSULTARE (ID 11) ---
router.get("/detinut/:idnp/medical/consultare", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'R')) return res.status(403).json({ success: false });
    const result = await db.execute(`SELECT C.ID, TO_CHAR(C.ADATE, 'DD.MM.YYYY') as ADATE, C.NPP_DOCTOR, C.ID_HOSPITAL, C.ID_INVESTIGATII, H.NAME as HOSPITAL, I.NAME as INVESTIGATIE FROM PRISON.CONSULTARE_MIN C LEFT JOIN PRISON.SPR_HOSPITALS H ON H.ID = C.ID_HOSPITAL LEFT JOIN PRISON.SPR_INVESTIGATII I ON I.ID = C.ID_INVESTIGATII WHERE C.IDNP = :idnp ORDER BY C.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows });
});
router.post("/detinut/:idnp/medical/consultare", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'W')) return res.status(403).json({ success: false });
    const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
    try { await db.execute("INSERT INTO PRISON.CONSULTARE_MIN (ID, IDNP, ADATE, NPP_DOCTOR, ID_HOSPITAL, ID_INVESTIGATII) VALUES (PRISON.CONSULTARE_MIN_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :doc, :hosp, :inv)", { idnp:req.params.idnp, d:safe(adate), doc:safe(npp_doctor), hosp:safe(id_hospital), inv:safe(id_investigatii) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/consultare/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.CONSULTARE_MIN WHERE ID=:id", { id:req.params.id }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

module.exports = router;