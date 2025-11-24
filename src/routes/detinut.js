const express = require("express");
const db = require("../db");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// =============================================================================
// CONFIGURATION
// =============================================================================
const PHOTOS_BASE_DIR = path.join(__dirname, "../../public/photos");
const TEMP_DIR = path.join(__dirname, "../../temp_uploads");

// Ensure temp_uploads exists for Multer
if (!fs.existsSync(TEMP_DIR)) {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch(e) {}
}
const upload = multer({ dest: "temp_uploads/" });

// =============================================================================
// HELPERS
// =============================================================================

function getUid(req) {
  const uid = req.header("x-user-id");
  return uid ? Number(uid) : 0;
}

// Oracle throws "ORA-01008: not all variables bound" if a value is undefined.
// This helper converts undefined to null.
const safe = (val) => (val === undefined ? null : val);

async function canEditGeneral(userId) {
  if (!userId) return false;
  try {
    const res = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :p_req_uid", { p_req_uid: userId });
    // Safety check: if user ID is invalid/deleted, return false instead of crashing
    if (!res || !res.rows || !res.rows.length) return false;
    
    const role = Number(res.rows[0].ID_ROLE);
    // Roles allowed to edit: 1=Admin, 7=Evidenta, 99=Dev
    return [1, 7, 99].includes(role);
  } catch (e) {
    console.error("Auth Check Failed:", e.message);
    return false;
  }
}

async function checkPermission(userId, moduleId, requiredRight = 'R') {
  if (!userId) return false;
  try {
    const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :p_req_uid AND ID_MODUL = :p_mod_id`;
    const res = await db.execute(sql, { p_req_uid: userId, p_mod_id: moduleId });
    const right = res.rows.length ? res.rows[0].DREPT : null;
    if (!right) return false;
    if (requiredRight === 'R') return (right === 'R' || right === 'W');
    if (requiredRight === 'W') return (right === 'W');
    return false;
  } catch (e) {
    return false;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Converts old JPGs to WebP on the fly if needed
async function autoConvertImages(idnp, dbImages) {
  if (!idnp) return;
  const dir1 = idnp.substring(0, 1);
  const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
  if (!fs.existsSync(targetDir)) return;

  for (const img of dbImages) {
    const type = img.IMAGE_TYPE;
    const legacyName = `${type}.jpg`; 
    const newName = `${type}.webp`;
    const legacyPath = path.join(targetDir, legacyName);
    const newPath = path.join(targetDir, newName);

    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      try {
        await sharp(legacyPath).webp({ quality: 80 }).toFile(newPath);
        fs.unlinkSync(legacyPath);
      } catch (e) { console.error(`[AutoConvert] Failed ${legacyName}:`, e); }
    }
  }
}

// =============================================================================
// 1. METADATA ROUTES (Dropdowns)
// =============================================================================

router.get("/detinut/meta/general", async (req, res) => {
  try {
    const [statut, categ, edu, mar, nat, rel, loc, cit, docTypes, profs, health] = await Promise.all([
      db.execute("SELECT ID, NAME FROM PRISON.SPR_STATUT ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_CATEG_SOCIAL ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_EDU_LEVEL ORDER BY ID"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_MAR_STATUS ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_NATIONALITY ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_RELIGION ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_LOCALITY ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_SITIZEN ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_DOCUMENT ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_PROFESSION ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_HEALTH_STAT ORDER BY NAME")
    ]);
    res.json({
      success: true,
      statut: statut.rows, social: categ.rows, edu: edu.rows, marital: mar.rows,
      nationality: nat.rows, religion: rel.rows, locality: loc.rows, citizen: cit.rows,
      docTypes: docTypes.rows, professions: profs.rows, health: health.rows
    });
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// =============================================================================
// 2. READ ROUTES (Full Profile Data)
// =============================================================================

router.get("/detinut/:id/general_full", async (req, res) => {
  try {
    const uid = getUid(req);
    const canEdit = await canEditGeneral(uid);
    const id = req.params.id;

    // Use p_det_id to avoid "ID" keyword conflicts
    const dRes = await db.execute(`
      SELECT D.ID, D.NAME, D.SURNAME, D.SEC_NAME, D.IDNP, D.SEX, D.WPOLICE, 
             TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH_STR,
             D.ID_SPR_CATEG_SOCIAL, D.ID_SPR_EDU_LEVEL, D.ID_MAR_STATUS, 
             D.ID_SPR_NATIONALITY, D.ID_SPR_RELIGION, D.ID_HEALTH_STAT,
             -- Text Values
             S.NAME as STATUT_NAME, REL.NAME as RELIGION_NAME, NAT.NAME as NATIONALITY_NAME,
             CAT.NAME as SOCIAL_NAME, EDU.NAME as EDU_NAME, MAR.NAME as MARITAL_NAME, HLT.NAME as HEALTH_NAME,
             -- Placeholder for Birth Place if columns don't exist directly
             'Moldova' as BIRTH_COUNTRY 
      FROM PRISON.DETINUTI D
      LEFT JOIN PRISON.STATUT_HISTORY SH ON (SH.IDNP = D.IDNP AND SH.B_DATE = (SELECT MAX(B_DATE) FROM PRISON.STATUT_HISTORY WHERE IDNP = D.IDNP))
      LEFT JOIN PRISON.SPR_STATUT S ON S.ID = SH.ID_STATUT
      LEFT JOIN PRISON.SPR_RELIGION REL ON REL.ID = D.ID_SPR_RELIGION
      LEFT JOIN PRISON.SPR_NATIONALITY NAT ON NAT.ID = D.ID_SPR_NATIONALITY
      LEFT JOIN PRISON.SPR_CATEG_SOCIAL CAT ON CAT.ID = D.ID_SPR_CATEG_SOCIAL
      LEFT JOIN PRISON.SPR_EDU_LEVEL EDU ON EDU.ID = D.ID_SPR_EDU_LEVEL
      LEFT JOIN PRISON.SPR_MAR_STATUS MAR ON MAR.ID = D.ID_MAR_STATUS
      LEFT JOIN PRISON.SPR_HEALTH_STAT HLT ON HLT.ID = D.ID_HEALTH_STAT
      WHERE D.ID = :p_det_id
    `, { p_det_id: id });

    if (!dRes.rows.length) return res.status(404).json({success:false, error:"Not found"});
    const detinut = dRes.rows[0];
    const idnp = detinut.IDNP;

    const imgRes = await db.execute("SELECT IMAGE_TYPE FROM PRISON.IMAGES WHERE DETINUT_ID = :p_det_id ORDER BY IMAGE_TYPE ASC", { p_det_id: id });
    const images = imgRes.rows || [];
    autoConvertImages(idnp, images).catch(console.error);

    const citRes = await db.execute(`
      SELECT C.ID, C.ID_SITIZEN, S.NAME, TO_CHAR(C.BDATE, 'DD.MM.YYYY') as BDATE 
      FROM PRISON.SITIZEN C JOIN PRISON.SPR_SITIZEN S ON S.ID = C.ID_SITIZEN
      WHERE C.IDNP = :p_idnp ORDER BY C.BDATE DESC
    `, { p_idnp: idnp });

    const actRes = await db.execute(`
      SELECT A.ID, A.NRDOCUMENT, A.ELIBERAT_CATRE, 
             TO_CHAR(A.ELIBERAT_DATA, 'DD.MM.YYYY') as ELIB_STR, TO_CHAR(A.VALABIL_PINA, 'DD.MM.YYYY') as EXP_STR,
             T.NAME as TIP_DOC
      FROM PRISON.ACTE A JOIN PRISON.SPR_TIP_DOCUMENT T ON T.ID = A.ID_TIP_DOCUMENT
      WHERE A.IDNP = :p_idnp ORDER BY A.ELIBERAT_DATA DESC
    `, { p_idnp: idnp });

    const empRes = await db.execute(`
      SELECT E.ID, E.PLACE, P.NAME as PROFESSION, TO_CHAR(E.EDATE, 'DD.MM.YYYY') as START_DATE
      FROM PRISON.EMPLOYEMENT E LEFT JOIN PRISON.SPR_PROFESSION P ON P.ID = E.ID_PROFESSION
      WHERE E.IDNP = :p_idnp ORDER BY E.EDATE DESC
    `, { p_idnp: idnp });

    const locRes = await db.execute(`
      SELECT L.ID, L.ADDRESS, L.LOCALITY_ID, L.START_DATE, TO_CHAR(L.START_DATE, 'DD.MM.YYYY') as START_DATE_STR, LOC.NAME as CITY
      FROM PRISON.L_LOCATION L LEFT JOIN PRISON.SPR_LOCALITY LOC ON LOC.ID = L.LOCALITY_ID
      WHERE L.IDNP = :p_idnp ORDER BY L.START_DATE DESC
    `, { p_idnp: idnp });

    res.json({
      success: true, canEdit, detinut,
      images: images.map(i => ({ id: i.IMAGE_TYPE, type: i.IMAGE_TYPE, url: `/photos/${idnp.substring(0,1)}/${idnp}/${i.IMAGE_TYPE}.webp?v=${Date.now()}` })),
      citizenships: citRes.rows, acts: actRes.rows, employment: empRes.rows, address: locRes.rows
    });
  } catch(e) { res.status(500).json({success:false, error: e.message}); }
});

// Header Route (Compact info)
router.get("/detinut/:id/general", async (req, res) => {
  try {
    const sql = `
      SELECT D.ID, D.IDNP, D.SURNAME, D.NAME, D.SEC_NAME, TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH, P.NAME as PENITENCIAR_NAME
      FROM PRISON.DETINUTI D
      LEFT JOIN PRISON.MISCARI M ON M.IDNP = D.IDNP
      LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = M.ID_PENETENCIAR
      WHERE D.ID = :p_det_id ORDER BY M.ADATE DESC FETCH FIRST 1 ROWS ONLY
    `;
    const result = await db.execute(sql, { p_det_id: req.params.id });
    if (!result.rows.length) return res.json({ success: false, error: "Deținut nu a fost găsit." });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// 3. UPDATE ROUTES (Main Data)
// =============================================================================

router.post("/detinut/:id/update_main", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error:"Acces interzis"});
  
  const { name, surname, sec_name, birth, sex, wpolice, id_categ, id_edu, id_mar, id_nat, id_rel, id_health } = req.body;
  
  try {
    // Use safe() and p_ prefixes
    const sql = `
      UPDATE PRISON.DETINUTI 
      SET NAME=:p_n, SURNAME=:p_s, SEC_NAME=:p_sn, SEX=:p_sex, BIRDTH=TO_DATE(:p_b, 'DD.MM.YYYY'),
          WPOLICE=:p_wp, ID_SPR_CATEG_SOCIAL=:p_ic, ID_SPR_EDU_LEVEL=:p_ie, ID_MAR_STATUS=:p_im, 
          ID_SPR_NATIONALITY=:p_in, ID_SPR_RELIGION=:p_ir, ID_HEALTH_STAT=:p_ih
      WHERE ID = :p_id
    `;
    const binds = {
      p_n: safe(name), p_s: safe(surname), p_sn: safe(sec_name), p_sex: safe(sex), p_b: safe(birth),
      p_wp: wpolice || 'N', p_ic: safe(id_categ), p_ie: safe(id_edu), p_im: safe(id_mar), 
      p_in: safe(id_nat), p_ir: safe(id_rel), p_ih: safe(id_health), p_id: req.params.id
    };
    await db.execute(sql, binds, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// =============================================================================
// 4. SUB-MODULE CRUDs (Citizenship, Address, Acts, Employment)
// =============================================================================

// --- CITIZENSHIP ---
router.post("/detinut/:idnp/citizenship", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try {
    await db.execute("INSERT INTO PRISON.SITIZEN (ID, IDNP, ID_SITIZEN, BDATE) VALUES (PRISON.SITIZEN_SEQ.NEXTVAL, :p_idnp, :p_cit, TO_DATE(:p_d, 'DD.MM.YYYY'))", 
    { p_idnp: req.params.idnp, p_cit: safe(req.body.id_sitizen), p_d: safe(req.body.bdate) }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/citizenship/:id", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try { await db.execute("DELETE FROM PRISON.SITIZEN WHERE ID = :p_id", { p_id: req.params.id }, { autoCommit: true }); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- ADDRESS ---
router.post("/detinut/:idnp/address", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try {
    await db.execute("INSERT INTO PRISON.L_LOCATION (ID, IDNP, LOCALITY_ID, ADDRESS, START_DATE) VALUES (PRISON.L_LOCATION2_SEQ.NEXTVAL, :p_idnp, :p_loc, :p_addr, TO_DATE(:p_d, 'DD.MM.YYYY'))", 
    { p_idnp: req.params.idnp, p_loc: safe(req.body.locality_id), p_addr: safe(req.body.address), p_d: safe(req.body.start_date) }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/address/:id", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try { await db.execute("DELETE FROM PRISON.L_LOCATION WHERE ID = :p_id", { p_id: req.params.id }, { autoCommit: true }); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- ACTE (DOCUMENTS) ---
router.post("/detinut/:idnp/acte", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  const { id_tip, nr_doc, issued_by, date_issue, date_exp } = req.body;
  try {
    await db.execute(`
      INSERT INTO PRISON.ACTE (ID, IDNP, ID_TIP_DOCUMENT, NRDOCUMENT, ELIBERAT_CATRE, ELIBERAT_DATA, VALABIL_PINA) 
      VALUES (PRISON.ACTE_SEQ.NEXTVAL, :p_idnp, :p_tip, :p_nr, :p_issue, TO_DATE(:p_di, 'DD.MM.YYYY'), TO_DATE(:p_de, 'DD.MM.YYYY'))
    `, { p_idnp: req.params.idnp, p_tip: safe(id_tip), p_nr: safe(nr_doc), p_issue: safe(issued_by), p_di: safe(date_issue), p_de: safe(date_exp) }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/acte/:id", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try { await db.execute("DELETE FROM PRISON.ACTE WHERE ID = :p_id", { p_id: req.params.id }, { autoCommit: true }); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- EMPLOYMENT ---
router.post("/detinut/:idnp/employment", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  const { place, id_prof, date_start } = req.body;
  try {
    await db.execute(`INSERT INTO PRISON.EMPLOYEMENT (ID, IDNP, PLACE, ID_PROFESSION, EDATE) VALUES (PRISON.EMPLOYEMENT_SEQ.NEXTVAL, :p_idnp, :p_pl, :p_pr, TO_DATE(:p_d, 'DD.MM.YYYY'))`, 
    { p_idnp: req.params.idnp, p_pl: safe(place), p_pr: safe(id_prof), p_d: safe(date_start) }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/employment/:id", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try { await db.execute("DELETE FROM PRISON.EMPLOYEMENT WHERE ID = :p_id", { p_id: req.params.id }, { autoCommit: true }); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// =============================================================================
// 5. PHOTOS (Upload & Delete)
// =============================================================================

router.post("/detinut/:id/photos", upload.single("image"), async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error:"Acces interzis"});
  if (!req.file) return res.status(400).json({success:false, error:"No file"});
  const detId = req.params.id;
  const type = req.body.type || "3"; 
  let targetFile = null;
  try {
    const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID = :p_id", {p_id: detId});
    if(!dRes.rows.length) throw new Error("Detinut not found");
    const idnp = dRes.rows[0].IDNP;
    const dir1 = idnp.substring(0, 1);
    const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
    ensureDir(targetDir);
    targetFile = path.join(targetDir, `${type}.webp`);
    await sharp(req.file.path).webp({ quality: 80 }).toFile(targetFile);
    await db.execute("DELETE FROM PRISON.IMAGES WHERE DETINUT_ID = :p_did AND IMAGE_TYPE = :p_type", { p_did: detId, p_type: type }, { autoCommit: true });
    await db.execute("INSERT INTO PRISON.IMAGES (DETINUT_ID, IMAGE_TYPE) VALUES (:p_did, :p_type)", { p_did: detId, p_type: type }, { autoCommit: true });
    if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({success:true});
  } catch(e) {
    if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if(targetFile && fs.existsSync(targetFile)) { try { fs.unlinkSync(targetFile); } catch(err){} }
    res.status(500).json({success:false, error:e.message});
  }
});
router.delete("/detinut/:id/photos/:type", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  try {
    const type = req.params.type;
    const detId = req.params.id;
    const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID = :p_id", {p_id: detId});
    if(!dRes.rows.length) return res.status(404).json({error: "Detinut not found"});
    const idnp = dRes.rows[0].IDNP;
    await db.execute("DELETE FROM PRISON.IMAGES WHERE DETINUT_ID = :p_did AND IMAGE_TYPE = :p_type", { p_did: detId, p_type: type }, { autoCommit: true });
    const dir1 = idnp.substring(0, 1);
    const pWebp = path.join(PHOTOS_BASE_DIR, dir1, idnp, `${type}.webp`);
    const pJpg  = path.join(PHOTOS_BASE_DIR, dir1, idnp, `${type}.jpg`);
    if(fs.existsSync(pWebp)) fs.unlinkSync(pWebp);
    if(fs.existsSync(pJpg)) fs.unlinkSync(pJpg);
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// =============================================================================
// 6. MEDICAL ROUTES (Perms: 7, 8, 10, 11)
// =============================================================================

// --- GREVA FOAMEI (Modul 7) ---
router.get("/detinut/:idnp/medical/greva", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const canWrite = await checkPermission(uid, 7, 'W');
    const sql = `SELECT G.ID, TO_CHAR(G.BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(G.EDATE, 'DD.MM.YYYY') as EDATE, G.ID_MOTIV, S.NAME as MOTIV FROM PRISON.GREVA_FOAMEI G LEFT JOIN PRISON.SPR_MOTIV_GREVA_FOAMEI S ON S.ID = G.ID_MOTIV WHERE G.IDNP = :p_idnp ORDER BY G.BDATE DESC`;
    const result = await db.execute(sql, { p_idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/greva", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false });
    const { bdate, edate, id_motiv } = req.body;
    try { await db.execute("INSERT INTO PRISON.GREVA_FOAMEI (ID, IDNP, BDATE, EDATE, ID_MOTIV) VALUES (PRISON.GREVA_FOAMEI_SEQ.NEXTVAL, :p_idnp, TO_DATE(:p_b,'DD.MM.YYYY'), TO_DATE(:p_e,'DD.MM.YYYY'), :p_m)", { p_idnp: req.params.idnp, p_b: safe(bdate), p_e: safe(edate), p_m: safe(id_motiv) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put("/detinut/medical/greva/:id", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false });
    const { bdate, edate, id_motiv } = req.body;
    try { await db.execute("UPDATE PRISON.GREVA_FOAMEI SET BDATE = TO_DATE(:p_b,'DD.MM.YYYY'), EDATE = TO_DATE(:p_e,'DD.MM.YYYY'), ID_MOTIV = :p_m WHERE ID = :p_id", { p_b: safe(bdate), p_e: safe(edate), p_m: safe(id_motiv), p_id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/greva/:id", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.GREVA_FOAMEI WHERE ID = :p_id", { p_id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- DIAGNOZA (Modul 8) ---
router.get("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 8, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 8, 'W');
    const sql = `SELECT D.ID, TO_CHAR(D.ADATE, 'DD.MM.YYYY') as ADATE, D.NOTE, D.ID_DIAGNOZ, S.NAME as DIAGNOZ_NAME, S.ID as DIAGNOZ_COD FROM PRISON.DIAGNOZ D LEFT JOIN PRISON.SPR_DIAGNOZ S ON S.ID = D.ID_DIAGNOZ WHERE D.IDNP = :p_idnp ORDER BY D.ADATE DESC`;
    const result = await db.execute(sql, { p_idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false });
    const { adate, id_diagnoz, note } = req.body;
    try { await db.execute("INSERT INTO PRISON.DIAGNOZ (ID, IDNP, ADATE, ID_DIAGNOZ, NOTE) VALUES (PRISON.DIAGNOZ_SEQ.NEXTVAL, :p_idnp, TO_DATE(:p_d,'DD.MM.YYYY'), :p_diag, :p_note)", { p_idnp: req.params.idnp, p_d: safe(adate), p_diag: safe(id_diagnoz), p_note: safe(note) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put("/detinut/medical/diagnoza/:id", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false });
    const { adate, id_diagnoz, note } = req.body;
    try { await db.execute("UPDATE PRISON.DIAGNOZ SET ADATE=TO_DATE(:p_d,'DD.MM.YYYY'), ID_DIAGNOZ=:p_diag, NOTE=:p_note WHERE ID=:p_id", { p_d: safe(adate), p_diag: safe(id_diagnoz), p_note: safe(note), p_id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/diagnoza/:id", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.DIAGNOZ WHERE ID=:p_del_id", {p_del_id: req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- RADIOGRAFIE (Modul 10) ---
router.get("/detinut/:idnp/medical/radiografie", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 10, 'R')) return res.status(403).json({success:false});
    const canWrite = await checkPermission(uid, 10, 'W');
    const sql = `SELECT R.ID, TO_CHAR(R.ADATE, 'DD.MM.YYYY') as ADATE, R.COMMENTS, R.ID_PENETENTIAR, R.ID_RESULTAT, P.NAME as PENITENCIAR, RES.NAME as REZULTAT FROM PRISON.RADIOGRAFIE R LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = R.ID_PENETENTIAR LEFT JOIN PRISON.SPR_RADIOGRAFIE_RESULTAT RES ON RES.ID = R.ID_RESULTAT WHERE R.IDNP = :p_idnp ORDER BY R.ADATE DESC`;
    const result = await db.execute(sql, { p_idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/radiografie", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
    const { adate, id_resultat, id_penitenciar, comments } = req.body;
    try { await db.execute("INSERT INTO PRISON.RADIOGRAFIE (ID, IDNP, ADATE, ID_RESULTAT, ID_PENETENTIAR, COMMENTS) VALUES (PRISON.RADIOGRAFIE_SEQ.NEXTVAL, :p_idnp, TO_DATE(:p_d,'DD.MM.YYYY'), :p_res, :p_pen, :p_comm)", { p_idnp: req.params.idnp, p_d:safe(adate), p_res:safe(id_resultat), p_pen:safe(id_penitenciar), p_comm:safe(comments) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.put("/detinut/medical/radiografie/:id", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
    const { adate, id_resultat, id_penitenciar, comments } = req.body;
    try { await db.execute("UPDATE PRISON.RADIOGRAFIE SET ADATE=TO_DATE(:p_d,'DD.MM.YYYY'), ID_RESULTAT=:p_res, ID_PENETENTIAR=:p_pen, COMMENTS=:p_comm WHERE ID=:p_id", {p_d:safe(adate), p_res:safe(id_resultat), p_pen:safe(id_penitenciar), p_comm:safe(comments), p_id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/radiografie/:id", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.RADIOGRAFIE WHERE ID=:p_del_id", {p_del_id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- CONSULTARE (Modul 11) ---
router.get("/detinut/:idnp/medical/consultare", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 11, 'R')) return res.status(403).json({success:false});
    const canWrite = await checkPermission(uid, 11, 'W');
    const sql = `SELECT C.ID, TO_CHAR(C.ADATE, 'DD.MM.YYYY') as ADATE, C.NPP_DOCTOR, C.ID_HOSPITAL, C.ID_INVESTIGATII, H.NAME as HOSPITAL, I.NAME as INVESTIGATIE FROM PRISON.CONSULTARE_MIN C LEFT JOIN PRISON.SPR_HOSPITALS H ON H.ID = C.ID_HOSPITAL LEFT JOIN PRISON.SPR_INVESTIGATII I ON I.ID = C.ID_INVESTIGATII WHERE C.IDNP = :p_idnp ORDER BY C.ADATE DESC`;
    const result = await db.execute(sql, { p_idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/consultare", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
    const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
    try { await db.execute("INSERT INTO PRISON.CONSULTARE_MIN (ID, IDNP, ADATE, NPP_DOCTOR, ID_HOSPITAL, ID_INVESTIGATII) VALUES (PRISON.CONSULTARE_MIN_SEQ.NEXTVAL, :p_idnp, TO_DATE(:p_d,'DD.MM.YYYY'), :p_doc, :p_hosp, :p_inv)", { p_idnp:req.params.idnp, p_d:safe(adate), p_doc:safe(npp_doctor), p_hosp:safe(id_hospital), p_inv:safe(id_investigatii) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.put("/detinut/medical/consultare/:id", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
    const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
    try { await db.execute("UPDATE PRISON.CONSULTARE_MIN SET ADATE=TO_DATE(:p_d,'DD.MM.YYYY'), NPP_DOCTOR=:p_doc, ID_HOSPITAL=:p_hosp, ID_INVESTIGATII=:p_inv WHERE ID=:p_id", {p_d:safe(adate), p_doc:safe(npp_doctor), p_hosp:safe(id_hospital), p_inv:safe(id_investigatii), p_id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/consultare/:id", async (req, res) => {
    const uid = getUid(req);
    if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.CONSULTARE_MIN WHERE ID=:p_del_id", {p_del_id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

module.exports = router;