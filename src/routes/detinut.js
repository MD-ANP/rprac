const express = require("express");
const db = require("../db");const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const PHOTOS_BASE_DIR = path.join(__dirname, "../../public/resources/photos");
const TEMP_DIR = path.join(__dirname, "../../public/resources/temp_uploads");

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (e) {}
}

const upload = multer({ dest: "temp_uploads/" });

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined ? null : val);

// --- AUTH HELPER ---
// Strict check: Only Admin(1), Main Medical/Evidenta(7), Secondary Medical(12) can edit General Data
async function canEditGeneral(userId) {
  if (!userId) return false;
  try {
    const res = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :u", { u: userId });
    if (!res.rows.length) return false;
    const role = Number(res.rows[0].ID_ROLE);
    return [1, 7, 12].includes(role); 
  } catch (e) { return false; }
}

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
// 1. METADATA ROUTES
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

// =============================================================================
// 2. GENERAL PROFILE READ & WRITE
// =============================================================================

// Header Data (Public/Read for all authenticated)
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

// Full General Data (Read all, Write guarded)
router.get("/detinut/:id/general_full", async (req, res) => {
  try {
    const uid = getUid(req);
    // Determine edit permission based on Role
    const canEdit = await canEditGeneral(uid);
    const id = req.params.id;

    // Fetch Main Data
    const dRes = await db.execute(`SELECT D.ID, D.IDNP, D.NAME, D.SURNAME, D.SEC_NAME, D.SEX, D.WPOLICE, TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH_STR, D.ID_SPR_CATEG_SOCIAL, D.ID_SPR_EDU_LEVEL, D.ID_MAR_STATUS, D.ID_SPR_NATIONALITY, D.ID_SPR_RELIGION, D.ID_HEALTH_STAT, S.NAME as STATUT_NAME, REL.NAME as RELIGION_NAME, NAT.NAME as NATIONALITY_NAME, EDU.NAME as EDU_NAME, MAR.NAME as MARITAL_NAME FROM PRISON.DETINUTI D LEFT JOIN PRISON.STATUT_HISTORY SH ON (SH.IDNP = D.IDNP AND SH.B_DATE = (SELECT MAX(B_DATE) FROM PRISON.STATUT_HISTORY WHERE IDNP = D.IDNP)) LEFT JOIN PRISON.SPR_STATUT S ON S.ID = SH.ID_STATUT LEFT JOIN PRISON.SPR_RELIGION REL ON REL.ID = D.ID_SPR_RELIGION LEFT JOIN PRISON.SPR_NATIONALITY NAT ON NAT.ID = D.ID_SPR_NATIONALITY LEFT JOIN PRISON.SPR_EDU_LEVEL EDU ON EDU.ID = D.ID_SPR_EDU_LEVEL LEFT JOIN PRISON.SPR_MAR_STATUS MAR ON MAR.ID = D.ID_MAR_STATUS WHERE D.ID = :id`, { id });

    if (!dRes.rows.length) return res.status(404).json({success:false, error:"Not found"});
    const detinut = dRes.rows[0];
    const idnp = detinut.IDNP;

    // Fetch Sub-entities
    const imgRes = await db.execute("SELECT IMAGE_TYPE FROM PRISON.IMAGES WHERE DETINUT_ID = :id ORDER BY IMAGE_TYPE ASC", { id });
    const images = (imgRes.rows || []).map(i => ({ id: i.IMAGE_TYPE, type: i.IMAGE_TYPE, url: `/resources/photos/${idnp.charAt(0)}/${idnp}/${i.IMAGE_TYPE}.webp?v=${Date.now()}` }));

    const citRes = await db.execute(`SELECT C.ID, S.NAME, TO_CHAR(C.BDATE, 'DD.MM.YYYY') as BDATE FROM PRISON.SITIZEN C JOIN PRISON.SPR_SITIZEN S ON S.ID = C.ID_SITIZEN WHERE C.IDNP = :idnp`, { idnp });
    const actRes = await db.execute(`SELECT A.ID, A.NRDOCUMENT, TO_CHAR(A.ELIBERAT_DATA, 'DD.MM.YYYY') as ELIB_STR, TO_CHAR(A.VALABIL_PINA, 'DD.MM.YYYY') as EXP_STR, T.NAME as TIP_DOC FROM PRISON.ACTE A JOIN PRISON.SPR_TIP_DOCUMENT T ON T.ID = A.ID_TIP_DOCUMENT WHERE A.IDNP = :idnp`, { idnp });
    const empRes = await db.execute(`SELECT E.ID, E.PLACE, P.NAME as PROFESSION, TO_CHAR(E.EDATE, 'DD.MM.YYYY') as START_DATE FROM PRISON.EMPLOYEMENT E LEFT JOIN PRISON.SPR_PROFESSION P ON P.ID = E.ID_PROFESSION WHERE E.IDNP = :idnp`, { idnp });
    const locRes = await db.execute(`SELECT L.ID, L.ADDRESS, TO_CHAR(L.START_DATE, 'DD.MM.YYYY') as START_DATE_STR, LOC.NAME as CITY FROM PRISON.L_LOCATION L LEFT JOIN PRISON.SPR_LOCALITY LOC ON LOC.ID = L.LOCALITY_ID WHERE L.IDNP = :idnp`, { idnp });

    res.json({ success: true, canEdit, detinut, images, citizenships: citRes.rows, acts: actRes.rows, employment: empRes.rows, address: locRes.rows });
  } catch(e) { res.status(500).json({success:false, error: e.message}); }
});

// Update Main Profile
router.post("/detinut/:id/update_main", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error: "Acces interzis la editare."});
  
  const { name, surname, sec_name, birth, sex, wpolice, id_categ, id_edu, id_mar, id_nat, id_rel, id_health } = req.body;
  try {
    const sql = `UPDATE PRISON.DETINUTI SET NAME=:n, SURNAME=:s, SEC_NAME=:sn, SEX=:sex, BIRDTH=TO_DATE(:b, 'DD.MM.YYYY'), WPOLICE=:w, ID_SPR_CATEG_SOCIAL=:ic, ID_SPR_EDU_LEVEL=:ie, ID_MAR_STATUS=:im, ID_SPR_NATIONALITY=:in, ID_SPR_RELIGION=:ir, ID_HEALTH_STAT=:ih WHERE ID = :id`;
    await db.execute(sql, { n: safe(name), s: safe(surname), sn: safe(sec_name), sex: safe(sex), b: safe(birth), w: wpolice||'N', ic: safe(id_categ), ie: safe(id_edu), im: safe(id_mar), in: safe(id_nat), ir: safe(id_rel), ih: safe(id_health), id: req.params.id }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- SUB-ENTITIES CRUD (Acts, Jobs, Citizenship, Address) ---

// Acte
router.post("/detinut/:idnp/acte", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    const { id_tip, nr_doc, issued_by, date_issue, date_exp } = req.body;
    try { await db.execute("INSERT INTO PRISON.ACTE (ID, IDNP, ID_TIP_DOCUMENT, NRDOCUMENT, ELIBERAT_DE, ELIBERAT_DATA, VALABIL_PINA) VALUES (PRISON.ACTE_SEQ.NEXTVAL, :idnp, :tip, :nr, :by, TO_DATE(:di,'DD.MM.YYYY'), TO_DATE(:de,'DD.MM.YYYY'))", { idnp:req.params.idnp, tip:safe(id_tip), nr:safe(nr_doc), by:safe(issued_by), di:safe(date_issue), de:safe(date_exp) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/acte/:id", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.ACTE WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// Employment
router.post("/detinut/:idnp/employment", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    const { place, id_prof, date_start } = req.body;
    try { await db.execute("INSERT INTO PRISON.EMPLOYEMENT (ID, IDNP, PLACE, ID_PROFESSION, EDATE) VALUES (PRISON.EMPLOYEMENT_SEQ.NEXTVAL, :idnp, :pl, :prof, TO_DATE(:d,'DD.MM.YYYY'))", { idnp:req.params.idnp, pl:safe(place), prof:safe(id_prof), d:safe(date_start) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/employment/:id", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.EMPLOYEMENT WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// Citizenship
router.post("/detinut/:idnp/citizenship", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    const { id_sitizen, bdate } = req.body;
    try { await db.execute("INSERT INTO PRISON.SITIZEN (ID, IDNP, ID_SITIZEN, BDATE) VALUES (PRISON.SITIZEN_SEQ.NEXTVAL, :idnp, :s, TO_DATE(:d,'DD.MM.YYYY'))", { idnp:req.params.idnp, s:safe(id_sitizen), d:safe(bdate) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/citizenship/:id", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.SITIZEN WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// Address
router.post("/detinut/:idnp/address", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    const { locality_id, address, start_date } = req.body;
    try { await db.execute("INSERT INTO PRISON.L_LOCATION (ID, IDNP, LOCALITY_ID, ADDRESS, START_DATE) VALUES (PRISON.L_LOCATION_SEQ.NEXTVAL, :idnp, :lid, :addr, TO_DATE(:d,'DD.MM.YYYY'))", { idnp:req.params.idnp, lid:safe(locality_id), addr:safe(address), d:safe(start_date) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/address/:id", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    try { await db.execute("DELETE FROM PRISON.L_LOCATION WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- PHOTOS ---
router.post("/detinut/:id/photos", upload.single('image'), async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    
    if (!req.file) return res.status(400).json({success:false, error:"Lipsă fișier"});
    const type = req.body.type || "1";
    
    try {
        // Get IDNP to build path
        const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID=:id", {id:req.params.id});
        if(!dRes.rows.length) throw new Error("Deținut invalid");
        const idnp = dRes.rows[0].IDNP;
        const dir1 = idnp.charAt(0);
        
        const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
        if(!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, {recursive:true});
        
        const targetPath = path.join(targetDir, `${type}.webp`);
        
        await sharp(req.file.path)
           .resize(600) // Reasonable max width
           .webp({ quality: 80 })
           .toFile(targetPath);
           
        // Cleanup temp
        fs.unlink(req.file.path, ()=>{});
        
        // Update DB Record
        // Check if exists
        const check = await db.execute("SELECT 1 FROM PRISON.IMAGES WHERE DETINUT_ID=:id AND IMAGE_TYPE=:t", {id:req.params.id, t:type});
        if(check.rows.length === 0) {
             await db.execute("INSERT INTO PRISON.IMAGES (DETINUT_ID, IMAGE_TYPE) VALUES (:id, :t)", {id:req.params.id, t:type}, {autoCommit:true});
        }
        
        res.json({success:true});
    } catch(e) {
        if(req.file) fs.unlink(req.file.path, ()=>{});
        res.status(500).json({success:false, error:e.message});
    }
});

// =============================================================================
// 3. MEDICAL ROUTES (RESTRICTED)
// =============================================================================

// --- GREVA FOAMEI (ID 7) ---
router.get("/detinut/:idnp/medical/greva", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
    const canWrite = await checkPermission(uid, 7, 'W');
    const result = await db.execute(`SELECT G.ID, TO_CHAR(G.BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(G.EDATE, 'DD.MM.YYYY') as EDATE, G.ID_MOTIV, S.NAME as MOTIV FROM PRISON.GREVA_FOAMEI G LEFT JOIN PRISON.SPR_MOTIV_GREVA_FOAMEI S ON S.ID = G.ID_MOTIV WHERE G.IDNP = :idnp ORDER BY G.BDATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/greva", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false });
    const { bdate, edate, id_motiv } = req.body;
    try { await db.execute("INSERT INTO PRISON.GREVA_FOAMEI (ID, IDNP, BDATE, EDATE, ID_MOTIV) VALUES (PRISON.GREVA_FOAMEI_SEQ.NEXTVAL, :idnp, TO_DATE(:b,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :m)", { idnp: req.params.idnp, b: safe(bdate), e: safe(edate), m: safe(id_motiv) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put("/detinut/medical/greva/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 7, 'W')) return res.status(403).json({ success: false });
    const { bdate, edate, id_motiv } = req.body;
    try { await db.execute("UPDATE PRISON.GREVA_FOAMEI SET BDATE = TO_DATE(:b,'DD.MM.YYYY'), EDATE = TO_DATE(:e,'DD.MM.YYYY'), ID_MOTIV = :m WHERE ID = :id", { b: safe(bdate), e: safe(edate), m: safe(id_motiv), id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/greva/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 7, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.GREVA_FOAMEI WHERE ID = :id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- DIAGNOZA (ID 8) ---
router.get("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 8, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 8, 'W');
    const result = await db.execute(`SELECT D.ID, TO_CHAR(D.ADATE, 'DD.MM.YYYY') as ADATE, D.NOTE, D.ID_DIAGNOZ, S.NAME as DIAGNOZ_NAME, S.ID as DIAGNOZ_COD FROM PRISON.DIAGNOZ D LEFT JOIN PRISON.SPR_DIAGNOZ S ON S.ID = D.ID_DIAGNOZ WHERE D.IDNP = :idnp ORDER BY D.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/diagnoza", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'W')) return res.status(403).json({ success: false });
    const { adate, id_diagnoz, note } = req.body;
    try { await db.execute("INSERT INTO PRISON.DIAGNOZ (ID, IDNP, ADATE, ID_DIAGNOZ, NOTE) VALUES (PRISON.DIAGNOZ_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :diag, :note)", { idnp: req.params.idnp, d: safe(adate), diag: safe(id_diagnoz), note: safe(note) }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put("/detinut/medical/diagnoza/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'W')) return res.status(403).json({ success: false });
    const { adate, id_diagnoz, note } = req.body;
    try { await db.execute("UPDATE PRISON.DIAGNOZ SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), ID_DIAGNOZ=:diag, NOTE=:note WHERE ID=:id", { d: safe(adate), diag: safe(id_diagnoz), note: safe(note), id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete("/detinut/medical/diagnoza/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 8, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.DIAGNOZ WHERE ID=:id", { id: req.params.id }, { autoCommit: true }); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- RADIOGRAFIE (ID 10) ---
router.get("/detinut/:idnp/medical/radiografie", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 10, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 10, 'W');
    const result = await db.execute(`SELECT R.ID, TO_CHAR(R.ADATE, 'DD.MM.YYYY') as ADATE, R.COMMENTS, R.ID_PENETENTIAR, R.ID_RESULTAT, P.NAME as PENITENCIAR, RES.NAME as REZULTAT FROM PRISON.RADIOGRAFIE R LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = R.ID_PENETENTIAR LEFT JOIN PRISON.SPR_RADIOGRAFIE_RESULTAT RES ON RES.ID = R.ID_RESULTAT WHERE R.IDNP = :idnp ORDER BY R.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/radiografie", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'W')) return res.status(403).json({ success: false });
    const { adate, id_resultat, id_penitenciar, comments } = req.body;
    try { await db.execute("INSERT INTO PRISON.RADIOGRAFIE (ID, IDNP, ADATE, ID_RESULTAT, ID_PENETENTIAR, COMMENTS) VALUES (PRISON.RADIOGRAFIE_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :res, :pen, :comm)", { idnp: req.params.idnp, d:safe(adate), res:safe(id_resultat), pen:safe(id_penitenciar), comm:safe(comments) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.put("/detinut/medical/radiografie/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'W')) return res.status(403).json({ success: false });
    const { adate, id_resultat, id_penitenciar, comments } = req.body;
    try { await db.execute("UPDATE PRISON.RADIOGRAFIE SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), ID_RESULTAT=:res, ID_PENETENTIAR=:pen, COMMENTS=:comm WHERE ID=:id", {d:safe(adate), res:safe(id_resultat), pen:safe(id_penitenciar), comm:safe(comments), id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/radiografie/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 10, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.RADIOGRAFIE WHERE ID=:id", { id:req.params.id }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- CONSULTARE (ID 11) ---
router.get("/detinut/:idnp/medical/consultare", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, 11, 'R')) return res.status(403).json({ success: false });
    const canWrite = await checkPermission(uid, 11, 'W');
    const result = await db.execute(`SELECT C.ID, TO_CHAR(C.ADATE, 'DD.MM.YYYY') as ADATE, C.NPP_DOCTOR, C.ID_HOSPITAL, C.ID_INVESTIGATII, H.NAME as HOSPITAL, I.NAME as INVESTIGATIE FROM PRISON.CONSULTARE_MIN C LEFT JOIN PRISON.SPR_HOSPITALS H ON H.ID = C.ID_HOSPITAL LEFT JOIN PRISON.SPR_INVESTIGATII I ON I.ID = C.ID_INVESTIGATII WHERE C.IDNP = :idnp ORDER BY C.ADATE DESC`, { idnp: req.params.idnp });
    res.json({ success: true, rows: result.rows, canWrite });
});
router.post("/detinut/:idnp/medical/consultare", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'W')) return res.status(403).json({ success: false });
    const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
    try { await db.execute("INSERT INTO PRISON.CONSULTARE_MIN (ID, IDNP, ADATE, NPP_DOCTOR, ID_HOSPITAL, ID_INVESTIGATII) VALUES (PRISON.CONSULTARE_MIN_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :doc, :hosp, :inv)", { idnp:req.params.idnp, d:safe(adate), doc:safe(npp_doctor), hosp:safe(id_hospital), inv:safe(id_investigatii) }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.put("/detinut/medical/consultare/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'W')) return res.status(403).json({ success: false });
    const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
    try { await db.execute("UPDATE PRISON.CONSULTARE_MIN SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), NPP_DOCTOR=:doc, ID_HOSPITAL=:hosp, ID_INVESTIGATII=:inv WHERE ID=:id", {d:safe(adate), doc:safe(npp_doctor), hosp:safe(id_hospital), inv:safe(id_investigatii), id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});
router.delete("/detinut/medical/consultare/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), 11, 'W')) return res.status(403).json({ success: false });
    try { await db.execute("DELETE FROM PRISON.CONSULTARE_MIN WHERE ID=:id", { id:req.params.id }, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// =============================================================================
// 4. EDUCATION ROUTES (ROLES 3, 7, 99)
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
    // Using same view as provided in legacy, assuming sharing or user can correct
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