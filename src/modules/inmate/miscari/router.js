const express = require("express");
const db = require("../../../db");
const router = express.Router();

const MODULE_ID = 5; // As requested

// --- Helpers ---
function getUid(req) {
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0;
}

const safe = (val) => (val === undefined || val === '' || val === 'null') ? null : val;

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

// --- METADATA ---
router.get("/detinut/meta/miscari", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });

  try {
    const [types, motiv, pen, inst, docs, sec, reg, cmotiv] = await Promise.all([
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TYPE_MISCARI ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_MOTIV ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_INSTANTE ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TIPDOCJURIDIC ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TYPE_SECTOR ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_REGIM ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_CELULA_MOTIV ORDER BY NAME")
    ]);

    res.json({
      success: true,
      types: types.rows,
      motives: motiv.rows,
      penitenciars: pen.rows,
      instante: inst.rows,
      docTypes: docs.rows,
      sectors: sec.rows,
      regims: reg.rows,
      cellMotives: cmotiv.rows
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- LIST MOVEMENTS (HIERARCHICAL) ---
router.get("/detinut/:idnp/miscari", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
  
  const canWrite = await checkPermission(uid, MODULE_ID, 'W');
  const idnp = req.params.idnp;

  try {
    // 1. Fetch Main Movements
    const sqlM = `
      SELECT M.ID, M.IDNP, TO_CHAR(M.ADATE, 'DD.MM.YYYY HH24:MI:SS') as ADATE_STR, 
             M.ID_PENETENCIAR, P.NAME as PENITENCIAR_NAME,
             M.ID_MOTIV, MO.NAME as MOTIV_NAME,
             M.ID_INSTANTE, I.NAME as INSTANTA_NAME,
             M.ID_TYPE_MISCARI, TM.NAME as TYPE_NAME
      FROM PRISON.MISCARI M
      LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = M.ID_PENETENCIAR
      LEFT JOIN PRISON.SPR_MOTIV MO ON MO.ID = M.ID_MOTIV
      LEFT JOIN PRISON.SPR_INSTANTE I ON I.ID = M.ID_INSTANTE
      LEFT JOIN PRISON.SPR_TYPE_MISCARI TM ON TM.ID = M.ID_TYPE_MISCARI
      WHERE M.IDNP = :idnp
      ORDER BY M.ADATE DESC
    `;
    const resM = await db.execute(sqlM, { idnp });
    const movements = resM.rows || [];

    // 2. Fetch Nested Data (Cell Moves, Docs, UP)
    // We fetch all for this IDNP and map them in JS to avoid N+1 queries.
    
    // Cell Moves
    const sqlC = `
      SELECT C.ID, C.ID_MISCARI, C.ROOM, TO_CHAR(C.ADATE, 'DD.MM.YYYY HH24:MI') as ADATE_STR,
             C.ID_MOTIV, CM.NAME as MOTIV_NAME,
             C.ID_TIP_SECTOR, S.NAME as SECTOR_NAME,
             C.ID_TIP_REGIM, R.NAME as REGIM_NAME
      FROM PRISON.MISCARI_CELULE C
      JOIN PRISON.MISCARI M ON M.ID = C.ID_MISCARI
      LEFT JOIN PRISON.SPR_CELULA_MOTIV CM ON CM.ID = C.ID_MOTIV
      LEFT JOIN PRISON.SPR_TYPE_SECTOR S ON S.ID = C.ID_TIP_SECTOR
      LEFT JOIN PRISON.SPR_TIP_REGIM R ON R.ID = C.ID_TIP_REGIM
      WHERE M.IDNP = :idnp
      ORDER BY C.ADATE ASC
    `;
    const resC = await db.execute(sqlC, { idnp });
    
    // Docs (Type 3 = Miscare, Type 4 = Celula)
    const sqlD = `
      SELECT D.ID, D.ID_DECIZIE, D.TIP_DECIZIE, D.NRDOC, TO_CHAR(D.DATADOC, 'DD.MM.YYYY') as DATADOC_STR,
             D.EXECUTOR, D.TEMEI, TD.NAME as TIPDOC_NAME, I.NAME as EMITENT_NAME
      FROM PRISON.DOC_JURIDIC D
      LEFT JOIN PRISON.SPR_TIPDOCJURIDIC TD ON TD.ID = D.ID_TIPDOC
      LEFT JOIN PRISON.SPR_INSTANTE I ON I.ID = D.ID_EMITENT_INSTANTE
      WHERE D.TIP_DECIZIE IN (3, 4) 
      AND D.ID_DECIZIE IN (
          SELECT ID FROM PRISON.MISCARI WHERE IDNP = :idnp
          UNION 
          SELECT C.ID FROM PRISON.MISCARI_CELULE C JOIN PRISON.MISCARI M ON M.ID = C.ID_MISCARI WHERE M.IDNP = :idnp
      )
    `;
    const resD = await db.execute(sqlD, { idnp });

    // Urmarire Penala
    const sqlUP = `
      SELECT U.ID, U.ID_MISCARI, TO_CHAR(U.ADATE, 'DD.MM.YYYY') as ADATE_STR, U.ID_EMITENT
      FROM PRISON.MISCARI_UP U
      JOIN PRISON.MISCARI M ON M.ID = U.ID_MISCARI
      WHERE M.IDNP = :idnp
    `;
    const resUP = await db.execute(sqlUP, { idnp });

    // Assemble Data
    const cellMap = {}; // by ID_MISCARI
    resC.rows.forEach(c => {
      if (!cellMap[c.ID_MISCARI]) cellMap[c.ID_MISCARI] = [];
      // Attach docs to cell
      c.docs = resD.rows.filter(d => d.TIP_DECIZIE === 4 && d.ID_DECIZIE === c.ID);
      cellMap[c.ID_MISCARI].push(c);
    });

    const finalTree = movements.map(m => ({
      ...m,
      docs: resD.rows.filter(d => d.TIP_DECIZIE === 3 && d.ID_DECIZIE === m.ID),
      cells: cellMap[m.ID] || [],
      up: resUP.rows.filter(u => u.ID_MISCARI === m.ID)
    }));

    res.json({ success: true, data: finalTree, canWrite });

  } catch (e) {
    console.error("Miscari List Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- ADD MISCARE ---
router.post("/detinut/:idnp/miscari", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  
  const { adate, id_penitenciar, id_instante, id_type, id_motiv } = req.body;
  
  try {
    const sql = `
      INSERT INTO PRISON.MISCARI (ID, IDNP, ADATE, ID_PENETENCIAR, ID_MOTIV, ID_INSTANTE, ID_TYPE_MISCARI)
      VALUES (PRISON.MISCARI_SEQ.NEXTVAL, :idnp, TO_TIMESTAMP(:ad, 'DD.MM.YYYY HH24:MI:SS'), :pen, :mot, :inst, :typ)
    `;
    await db.execute(sql, {
      idnp: req.params.idnp,
      ad: adate, // Expects 'DD.MM.YYYY HH:mm:ss'
      pen: safe(id_penitenciar),
      mot: safe(id_motiv),
      inst: safe(id_instante),
      typ: safe(id_type)
    }, { autoCommit: true });
    
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- UPDATE MISCARE ---
router.put("/detinut/miscari/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  const { adate, id_penitenciar, id_instante, id_type, id_motiv } = req.body;
  try {
    const sql = `
      UPDATE PRISON.MISCARI SET 
        ADATE = TO_TIMESTAMP(:ad, 'DD.MM.YYYY HH24:MI:SS'), 
        ID_PENETENCIAR = :pen, 
        ID_MOTIV = :mot, 
        ID_INSTANTE = :inst, 
        ID_TYPE_MISCARI = :typ
      WHERE ID = :id
    `;
    await db.execute(sql, {
      ad: adate, pen: safe(id_penitenciar), mot: safe(id_motiv), 
      inst: safe(id_instante), typ: safe(id_type), id: req.params.id
    }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- DELETE MISCARE ---
router.delete("/detinut/miscari/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  try {
    // Delete cascading manully if needed, or rely on FK
    // Deleting child records first to be safe
    await db.execute("DELETE FROM PRISON.DOC_JURIDIC WHERE TIP_DECIZIE=3 AND ID_DECIZIE=:id", {id:req.params.id});
    await db.execute("DELETE FROM PRISON.MISCARI_CELULE WHERE ID_MISCARI=:id", {id:req.params.id});
    await db.execute("DELETE FROM PRISON.MISCARI_UP WHERE ID_MISCARI=:id", {id:req.params.id});
    
    await db.execute("DELETE FROM PRISON.MISCARI WHERE ID=:id", {id:req.params.id}, {autoCommit:true});
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- DOCS (General for Tip 3 and Tip 4) ---
router.post("/detinut/miscari/docs", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  const { parentId, tipDecizie, nrDoc, dataDoc, emitent, temei, idTipDoc, idEmitentInst } = req.body;
  try {
    // TIP_DECIZIE: 3 for Miscare, 4 for Celula
    const sql = `
      INSERT INTO PRISON.DOC_JURIDIC (ID, ID_DECIZIE, TIP_DECIZIE, ID_TIPDOC, NRDOC, DATADOC, ID_EMITENT_INSTANTE, TEMEI, EXECUTOR)
      VALUES (PRISON.DOC_JURIDIC_SEQ.NEXTVAL, :pid, :td, :itd, :nr, TO_DATE(:dd,'DD.MM.YYYY'), :iei, :tem, :em)
    `;
    await db.execute(sql, {
      pid: parentId, td: tipDecizie, itd: safe(idTipDoc), nr: safe(nrDoc), 
      dd: safe(dataDoc), iei: safe(idEmitentInst), tem: safe(temei), em: safe(emitent)
    }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- CELL MOVEMENTS ---
router.post("/detinut/miscari/:id/cells", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  const { room, adate, id_motiv, id_sector, id_regim } = req.body;
  try {
    const sql = `
      INSERT INTO PRISON.MISCARI_CELULE (ID, ID_MISCARI, ROOM, ADATE, ID_MOTIV, ID_TIP_SECTOR, ID_TIP_REGIM)
      VALUES (PRISON.MISCARI_CELULE_SEQ.NEXTVAL, :mid, :rm, TO_TIMESTAMP(:ad, 'DD.MM.YYYY HH24:MI:SS'), :mot, :sec, :reg)
    `;
    await db.execute(sql, {
      mid: req.params.id, rm: safe(room), ad: adate, 
      mot: safe(id_motiv), sec: safe(id_sector), reg: safe(id_regim)
    }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- UP (URMARIRE PENALA) ---
router.post("/detinut/miscari/:id/up", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  const { idnp, adate, id_emitent } = req.body;
  try {
    const sql = `
      INSERT INTO PRISON.MISCARI_UP (ID, IDNP, ID_MISCARI, ADATE, ID_EMITENT)
      VALUES (PRISON.MISCARI_UP_SEQ.NEXTVAL, :idnp, :mid, TO_DATE(:ad, 'DD.MM.YYYY'), :emi)
    `;
    await db.execute(sql, {
      idnp: idnp, mid: req.params.id, ad: adate, emi: safe(id_emitent)
    }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/up/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  try {
    await db.execute("DELETE FROM PRISON.MISCARI_UP WHERE ID=:id", {id:req.params.id}, {autoCommit:true});
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;