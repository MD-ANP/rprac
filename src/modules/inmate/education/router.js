const express = require("express");
const db = require("../../../db"); // <-- CRITICAL FIX
const router = express.Router();

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined ? null : val);

// --- AUTH HELPER (Shared with other modules) ---
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

// =============================================================================
// EDUCATION ROUTES (ID 13-18)
// =============================================================================

// ID 13: INSTRUIRE (General, Prof, Alte)
router.get("/detinut/:idnp/educatie/instr_gen", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 13, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const canWrite = await checkPermission(uid, 13, 'W');
    const resQ = await db.execute(`SELECT NAME_CLASA, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_PENITENCIAR FROM PRISON.V_INSTRUIRE_GENERALA WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});
router.get("/detinut/:idnp/educatie/instr_prof", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 13, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const canWrite = await checkPermission(uid, 13, 'W');
    const resQ = await db.execute(`SELECT NAME_PROFESSION, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_PENITENCIAR FROM PRISON.V_INSTRUIRE_PROF WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});
router.get("/detinut/:idnp/educatie/instr_alte", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 13, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const canWrite = await checkPermission(uid, 13, 'W');
    const resQ = await db.execute(`SELECT NAME_PROGRAM, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_PENITENCIAR, NAME_CALIFICATIV, NAME FROM PRISON.V_INSTRUIRE_ALTE WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

// ID 14: CULTURAL / SPORT
router.get("/detinut/:idnp/educatie/cultural", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 14, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 14, 'W');
    const resQ = await db.execute(`SELECT NAME, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_PENITENCIAR FROM PRISON.V_ACTIVITATE_CULTURAL WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});
router.get("/detinut/:idnp/educatie/sport", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 14, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 14, 'W');
    const resQ = await db.execute(`SELECT NAME, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_PENITENCIAR FROM PRISON.V_ACTIVITATE_CULTURAL WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

// ID 15: MUNCA (REM/NEREM)
router.get("/detinut/:idnp/educatie/munca_rem", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 15, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 15, 'W');
    const resQ = await db.execute(`SELECT NAME_REMUNERAT, WORK_PLACE, TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NRZILE, NAME_KOEFICIENT_NOCIV FROM PRISON.V_REMUNERAT WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

router.get("/detinut/:idnp/educatie/munca_nerem", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 15, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 15, 'W');
    const resQ = await db.execute(`SELECT ID, WORK_PLACE, TO_CHAR(ADATE, 'DD.MM.YYYY') as ADATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, HOURS FROM PRISON.NEREMUNERAT WHERE IDNP=:idnp ORDER BY ADATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});
router.post("/detinut/:idnp/educatie/munca_nerem", async (req, res) => {
    if (!await checkPermission(getUid(req), 15, 'W')) return res.status(403).json({ success: false });
    const { work_place, adate, edate, hours } = req.body;
    try { await db.execute("INSERT INTO PRISON.NEREMUNERAT (ID, IDNP, WORK_PLACE, ADATE, EDATE, HOURS) VALUES (PRISON.NEREMUNERAT_SEQ.NEXTVAL, :idnp, :wp, TO_DATE(:a,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :h)", {idnp:req.params.idnp, wp:safe(work_place), a:safe(adate), e:safe(edate), h:safe(hours)}, {autoCommit:true}); res.json({success:true}); } catch(e){ res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/educatie/munca_nerem/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 15, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.NEREMUNERAT WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e){ res.status(500).json({success:false, error:e.message}); }
});

// ID 16: SANCTIUNI
router.get("/detinut/:idnp/educatie/sanctiuni", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 16, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 16, 'W');
    const resQ = await db.execute(`SELECT TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(EDATE, 'DD.MM.YYYY') as EDATE, NAME_SANCTIUNE, FACTS FROM PRISON.V_SANCTIUNI WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

// ID 17: STIMULARI
router.get("/detinut/:idnp/educatie/stimulari", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 17, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 17, 'W');
    const resQ = await db.execute(`SELECT TO_CHAR(ADATE, 'DD.MM.YYYY') as ADATE, NAME_STIMULARE, FACTS FROM PRISON.V_STIMULARI WHERE IDNP=:idnp ORDER BY ADATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

// ID 18: CARACTERISTICA
router.get("/detinut/:idnp/educatie/caracteristica", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 18, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 18, 'W');
    const resQ = await db.execute(`SELECT TO_CHAR(BDATE, 'DD.MM.YYYY') as BDATE, PENITENCIAR, STATUS, EXECUTPROGRAM, COMPORTAMENT FROM PRISON.V_CARACTERISTICA WHERE IDNP=:idnp ORDER BY BDATE DESC`, {idnp:req.params.idnp});
    res.json({success:true, rows:resQ.rows, canWrite});
});

module.exports = router;