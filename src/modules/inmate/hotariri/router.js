const express = require("express");
const db = require("../../../db");
const router = express.Router();

// Module ID 4 = Hotariri
const MODULE_ID = 4;

// Helper: Get User ID from header
function getUid(req) {
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0;
}

// Helper: Safe value for binds (convert undefined/empty to null)
const safe = (val) => (val === undefined || val === '' || val === 'null') ? null : val;

// Helper: Check Permissions
async function checkPermission(userId, moduleId, requiredRight = 'R') {
  if (!userId) return false;
  try {
    const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :b_u AND ID_MODUL = :b_m`;
    const res = await db.execute(sql, { b_u: userId, b_m: moduleId });
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

// Helper: Get Username for audit/logging
async function getUsername(userId) {
  try {
    const res = await db.execute("SELECT USERNAME FROM USERS WHERE ID = :b_id", { b_id: userId });
    return res.rows.length ? res.rows[0].USERNAME : 'SYSTEM';
  } catch (e) { return 'UNKNOWN'; }
}

// ==========================================
// 1. METADATA ROUTES
// ==========================================
router.get("/detinut/meta/hotariri", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'R')) {
    return res.status(403).json({ success: false, error: "Acces interzis." });
  }

  try {
    const [tipDoc, tipPen, instante, instanteUp, tipElib, mecReduc] = await Promise.all([
      db.execute("SELECT ID, NAME FROM SPR_TIPDOCJURIDIC ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM SPR_TIP_PENITENCIAR ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM SPR_INSTANTE WHERE ACTIV = 1 ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM SPR_INSTANTEUP ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM SPR_TIP_ELIB_COND ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM SPR_MECANISMREDUCERETERMEN ORDER BY NAME")
    ]);

    res.json({
      success: true,
      tipDoc: tipDoc.rows,
      tipPen: tipPen.rows,
      instante: instante.rows,
      instanteUp: instanteUp.rows,
      tipElib: tipElib.rows,
      mecReduc: mecReduc.rows
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 2. LIST ROUTES
// ==========================================
router.get("/detinut/:idnp/hotariri", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'R')) {
    return res.status(403).json({ success: false, error: "Acces interzis." });
  }
  const canWrite = await checkPermission(uid, MODULE_ID, 'W');

  try {
    // We select * to ensure all columns are available. 
    // Date formatting (stripping T00:00:00) is handled in the client.
    const activeRes = await db.execute(
      `SELECT * FROM V_OPEN_HOTARIRI WHERE IDNP = :b_idnp ORDER BY D_DATE ASC`, 
      { b_idnp: req.params.idnp }
    );
    
    const antRes = await db.execute(
      `SELECT * FROM V_ANTECEDENTE WHERE IDNP = :b_idnp ORDER BY D_DATE ASC`, 
      { b_idnp: req.params.idnp }
    );

    res.json({ 
      success: true, 
      active: activeRes.rows || [], 
      antecedents: antRes.rows || [],
      canWrite 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 3. MAIN CRUD ROUTES (HOTARIRI_JUD)
// ==========================================

// INSERT
router.post("/detinut/:idnp/hotariri", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'W')) return res.status(403).json({ success: false });

  const body = req.body;
  
  // Using b_ prefix to ensure NO reserved words conflict (like USER, DATE, TYPE)
  const sql = `
    INSERT INTO HOTARIRI_JUD (
      IDNP, D_DATE, ID_TIP_HOT_JUD, TERMENULANI, TERMENULLUNI, TERMENULZILE,
      ID_TIP_PENITENCIAR, DEFINITIV, AMENDA, PREJUDICIU,
      MUNCANEREMUNZILE, MUNCANEREMUNORE, ARESTDOMZILE, ARESTDOMORE,
      PERLIFE, ID_INSTANTE, JUDECATOR, NRDOSARPENAL, ID_ORGANUP,
      B_DATE, ID_TIP_ELIB_COND, NOTE
    ) VALUES (
      :b_idnp, TO_DATE(:b_d_date, 'DD.MM.YYYY'), :b_id_tip, :b_ani, :b_luni, :b_zile,
      :b_id_pen, TO_DATE(:b_definitiv, 'DD.MM.YYYY'), :b_amenda, :b_prejudiciu,
      :b_mn_zile, :b_mn_ore, :b_ad_zile, :b_ad_ore,
      :b_perlife, :b_id_inst, :b_judecator, :b_dosar, :b_id_org_up,
      TO_DATE(:b_b_date, 'DD.MM.YYYY'), :b_id_elib, :b_note
    )
  `;

  try {
    await db.execute(sql, {
      b_idnp: req.params.idnp,
      b_d_date: safe(body.d_date),
      b_id_tip: safe(body.id_tip_hot_jud),
      b_ani: safe(body.termenulani),
      b_luni: safe(body.termenulluni),
      b_zile: safe(body.termenulzile),
      b_id_pen: safe(body.id_tip_penitenciar),
      b_definitiv: safe(body.definitiv),
      b_amenda: safe(body.amenda),
      b_prejudiciu: safe(body.prejudiciu),
      b_mn_zile: safe(body.muncaneremunzile),
      b_mn_ore: safe(body.muncaneremunore),
      b_ad_zile: safe(body.arestdomzile),
      b_ad_ore: safe(body.arestdomore),
      b_perlife: safe(body.perlife),
      b_id_inst: safe(body.id_instante),
      b_judecator: safe(body.judecator),
      b_dosar: safe(body.nrdosarpenal),
      b_id_org_up: safe(body.id_organup),
      b_b_date: safe(body.b_date),
      b_id_elib: safe(body.id_tip_elib_cond),
      b_note: safe(body.note)
    }, { autoCommit: true });

    res.json({ success: true });
  } catch (e) {
    console.error("Add Hotarire Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// UPDATE
router.put("/detinut/hotariri/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'W')) return res.status(403).json({ success: false });

  const body = req.body;

  const sql = `
    UPDATE HOTARIRI_JUD SET 
      D_DATE = TO_DATE(:b_d_date, 'DD.MM.YYYY'),
      ID_TIP_HOT_JUD = :b_id_tip,
      TERMENULANI = :b_ani,
      TERMENULLUNI = :b_luni,
      TERMENULZILE = :b_zile,
      ID_TIP_PENITENCIAR = :b_id_pen,
      DEFINITIV = TO_DATE(:b_definitiv, 'DD.MM.YYYY'),
      AMENDA = :b_amenda,
      PREJUDICIU = :b_prejudiciu,
      MUNCANEREMUNZILE = :b_mn_zile,
      MUNCANEREMUNORE = :b_mn_ore,
      ARESTDOMZILE = :b_ad_zile,
      ARESTDOMORE = :b_ad_ore,
      PERLIFE = :b_perlife,
      ID_INSTANTE = :b_id_inst,
      JUDECATOR = :b_judecator,
      NRDOSARPENAL = :b_dosar,
      ID_ORGANUP = :b_id_org_up,
      B_DATE = TO_DATE(:b_b_date, 'DD.MM.YYYY'),
      ID_TIP_ELIB_COND = :b_id_elib,
      NOTE = :b_note
    WHERE ID = :b_id
  `;

  try {
    await db.execute(sql, {
      b_id: req.params.id,
      b_d_date: safe(body.d_date),
      b_id_tip: safe(body.id_tip_hot_jud),
      b_ani: safe(body.termenulani),
      b_luni: safe(body.termenulluni),
      b_zile: safe(body.termenulzile),
      b_id_pen: safe(body.id_tip_penitenciar),
      b_definitiv: safe(body.definitiv),
      b_amenda: safe(body.amenda),
      b_prejudiciu: safe(body.prejudiciu),
      b_mn_zile: safe(body.muncaneremunzile),
      b_mn_ore: safe(body.muncaneremunore),
      b_ad_zile: safe(body.arestdomzile),
      b_ad_ore: safe(body.arestdomore),
      b_perlife: safe(body.perlife),
      b_id_inst: safe(body.id_instante),
      b_judecator: safe(body.judecator),
      b_dosar: safe(body.nrdosarpenal),
      b_id_org_up: safe(body.id_organup),
      b_b_date: safe(body.b_date),
      b_id_elib: safe(body.id_tip_elib_cond),
      b_note: safe(body.note)
    }, { autoCommit: true });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE
router.delete("/detinut/hotariri/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'W')) return res.status(403).json({ success: false });

  try {
    await db.execute("DELETE FROM HOTARIRI_JUD WHERE ID = :b_id", { b_id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 4. SUB-MODULE: ARTICOLE
// ==========================================

router.get("/detinut/hotariri/:id/articole", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'R')) return res.status(403).json({ success: false });

  try {
    const sql = `SELECT * FROM ARTICOLES WHERE ID_DOCUMENT = :b_id AND TYPE_DOCUMENT = '2' ORDER BY ID ASC`;
    const result = await db.execute(sql, { b_id: req.params.id });
    res.json({ success: true, rows: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/detinut/hotariri/:id/articole", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'W')) return res.status(403).json({ success: false });

  const { articol, aliniat, litera } = req.body;

  try {
    const sql = `
      INSERT INTO ARTICOLES (ID_DOCUMENT, TYPE_DOCUMENT, ID_ARTICOL, ID_ALINEAT, ID_LETTER) 
      VALUES (:b_id, '2', :b_art, :b_alin, :b_lit)
    `;
    await db.execute(sql, {
      b_id: req.params.id,
      b_art: safe(articol),
      b_alin: safe(aliniat),
      b_lit: safe(litera)
    }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/detinut/articole/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  try {
    await db.execute("DELETE FROM ARTICOLES WHERE ID = :b_id", { b_id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 5. SUB-MODULE: INTERVALE
// ==========================================

router.get("/detinut/hotariri/:id/intervale", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'R')) return res.status(403).json({ success: false });
  try {
    // Format dates directly in SQL for cleaner consumption
    const sql = `
      SELECT ID, TO_CHAR(B_DATE, 'DD.MM.YYYY') as B_DATE, TO_CHAR(E_DATE, 'DD.MM.YYYY') as E_DATE 
      FROM INTERVALEXCLUS 
      WHERE ID_HOTARIRE = :b_id
    `;
    const result = await db.execute(sql, { b_id: req.params.id });
    res.json({ success: true, rows: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/detinut/hotariri/:id/intervale", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  const { b_date, e_date } = req.body;
  try {
    const sql = `
      INSERT INTO INTERVALEXCLUS (ID_HOTARIRE, B_DATE, E_DATE) 
      VALUES (:b_id, TO_DATE(:b_start,'DD.MM.YYYY'), TO_DATE(:b_end,'DD.MM.YYYY'))
    `;
    await db.execute(sql, { 
      b_id: req.params.id, 
      b_start: safe(b_date), 
      b_end: safe(e_date) 
    }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/detinut/intervale/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  try {
    await db.execute("DELETE FROM INTERVALEXCLUS WHERE ID = :b_id", { b_id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 6. SUB-MODULE: REDUCERI
// ==========================================

router.get("/detinut/hotariri/:id/reduceri", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'R')) return res.status(403).json({ success: false });
  try {
    const sql = `
      SELECT reduc.ID, reduc.NRZILE, spr_reduc.NAME AS MECANISM_NAME 
      FROM PRISON.REDUCERETERMEN reduc 
      INNER JOIN PRISON.SPR_MECANISMREDUCERETERMEN spr_reduc ON (reduc.IDMECANISMREDUCERE = spr_reduc.ID) 
      WHERE reduc.IDHOTARIRE = :b_id
    `;
    const result = await db.execute(sql, { b_id: req.params.id });
    res.json({ success: true, rows: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/detinut/hotariri/:id/reduceri", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, MODULE_ID, 'W')) return res.status(403).json({ success: false });
  
  const { idnp, nrzile, id_mecanism } = req.body;
  const username = await getUsername(uid);
  const ip = req.ip || '0.0.0.0';

  try {
    const sql = `
      INSERT INTO REDUCERETERMEN (IDNP, IDHOTARIRE, NRZILE, IDMECANISMREDUCERE, CREATEDBY, CREATEDIPUSER, INSERTEDDATE) 
      VALUES (:b_idnp, :b_id, :b_zile, :b_mec, :b_user, :b_ip, SYSDATE)
    `;
    await db.execute(sql, { 
      b_idnp: safe(idnp), 
      b_id: req.params.id, 
      b_zile: safe(nrzile), 
      b_mec: safe(id_mecanism),
      b_user: username,
      b_ip: ip
    }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/detinut/reduceri/:id", async (req, res) => {
  if (!await checkPermission(getUid(req), MODULE_ID, 'W')) return res.status(403).json({ success: false });
  try {
    await db.execute("DELETE FROM REDUCERETERMEN WHERE ID = :b_id", { b_id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;