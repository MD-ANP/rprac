// src/routes/detinut.js
const express = require("express");
const db = require("../db");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
// Map legacy logic: public/photos/{first_digit_idnp}/{idnp}/...
const PHOTOS_BASE_DIR = path.join(__dirname, "../../public/photos");

// Multer setup (Temp storage)
const upload = multer({ dest: "temp_uploads/" });

// --- HELPERS ---

function getUid(req) {
  return Number(req.header("x-user-id") || 0);
}

// Check if user has one of the allowed roles (1, 7, 99) for editing
async function canEditGeneral(userId) {
  if (!userId) return false;
  try {
    const res = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :id", { id: userId });
    if (!res.rows.length) return false;
    const role = Number(res.rows[0].ID_ROLE);
    return [1, 7, 99].includes(role);
  } catch (e) {
    console.error("Role check failed", e);
    return false;
  }
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Convert legacy JPGs to WebP for a specific detainee
async function autoConvertImages(idnp, dbImages) {
  if (!idnp) return;
  const dir1 = idnp.substring(0, 1);
  const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
  
  if (!fs.existsSync(targetDir)) return;

  for (const img of dbImages) {
    const legacyName = `${img.ID}_${img.IMAGE_TYPE}.jpg`;
    const newName = `${img.ID}_${img.IMAGE_TYPE}.webp`;
    const legacyPath = path.join(targetDir, legacyName);
    const newPath = path.join(targetDir, newName);

    // If JPG exists but WebP doesn't
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      try {
        await sharp(legacyPath)
          .webp({ quality: 80 })
          .toFile(newPath);
        
        // Remove old file after successful conversion
        fs.unlinkSync(legacyPath);
        console.log(`Converted ${legacyName} to WebP`);
      } catch (e) {
        console.error(`Failed to convert ${legacyName}:`, e);
      }
    }
  }
}

// --- DROPDOWN METADATA ---
router.get("/detinut/meta/general", async (req, res) => {
  try {
    const [statut, categ, edu, mar, nat, rel, loc] = await Promise.all([
      db.execute("SELECT ID, NAME FROM PRISON.SPR_STATUT ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_CATEG_SOCIAL ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_EDU_LEVEL ORDER BY ID"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_MAR_STATUS ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_NATIONALITY ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_RELIGION ORDER BY NAME"),
      db.execute("SELECT ID, NAME FROM PRISON.SPR_LOCALITY ORDER BY NAME") // Simplified
    ]);
    res.json({
      success: true,
      statut: statut.rows,
      social: categ.rows,
      edu: edu.rows,
      marital: mar.rows,
      nationality: nat.rows,
      religion: rel.rows,
      locality: loc.rows
    });
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- GET FULL GENERAL DATA ---
router.get("/detinut/:id/general_full", async (req, res) => {
  try {
    const uid = getUid(req);
    const canEdit = await canEditGeneral(uid);
    const id = req.params.id;

    // 1. Main Detainee Data
    const dRes = await db.execute(`
      SELECT D.*, 
             TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH_STR,
             S.NAME as STATUT_NAME,
             REL.NAME as RELIGION_NAME,
             NAT.NAME as NATIONALITY_NAME
      FROM PRISON.DETINUTI D
      LEFT JOIN PRISON.STATUT_HISTORY SH ON (SH.IDNP = D.IDNP AND SH.B_DATE = (SELECT MAX(B_DATE) FROM PRISON.STATUT_HISTORY WHERE IDNP = D.IDNP))
      LEFT JOIN PRISON.SPR_STATUT S ON S.ID = SH.ID_STATUT
      LEFT JOIN PRISON.SPR_RELIGION REL ON REL.ID = D.ID_SPR_RELIGION
      LEFT JOIN PRISON.SPR_NATIONALITY NAT ON NAT.ID = D.ID_SPR_NATIONALITY
      WHERE D.ID = :id
    `, { id });

    if (!dRes.rows.length) return res.status(404).json({success:false, error:"Not found"});
    const detinut = dRes.rows[0];
    const idnp = detinut.IDNP;

    // 2. Fetch Photos (and trigger conversion)
    const imgRes = await db.execute("SELECT ID, IMAGE_TYPE FROM PRISON.IMAGES WHERE DETINUT_ID = :id ORDER BY IMAGE_TYPE ASC", { id });
    const images = imgRes.rows || [];
    
    // Background conversion (non-blocking)
    autoConvertImages(idnp, images).catch(console.error);

    // 3. Citizenship
    const citRes = await db.execute(`
      SELECT C.ID, C.ID_SITIZEN, S.NAME, TO_CHAR(C.BDATE, 'DD.MM.YYYY') as BDATE 
      FROM PRISON.SITIZEN C
      JOIN PRISON.SPR_SITIZEN S ON S.ID = C.ID_SITIZEN
      WHERE C.IDNP = :idnp
    `, { idnp });

    // 4. Address (L_LOCATION)
    const locRes = await db.execute(`
      SELECT L.ID, L.ADDRESS, LOC.NAME as CITY
      FROM PRISON.L_LOCATION L
      LEFT JOIN PRISON.SPR_LOCALITY LOC ON LOC.ID = L.LOCALITY_ID
      WHERE L.IDNP = :idnp ORDER BY L.START_DATE DESC FETCH FIRST 1 ROWS ONLY
    `, { idnp });

    res.json({
      success: true,
      canEdit,
      detinut,
      images: images.map(i => ({ 
        id: i.ID, 
        type: i.IMAGE_TYPE, 
        url: `/photos/${idnp.substring(0,1)}/${idnp}/${i.ID}_${i.IMAGE_TYPE}.webp?v=${Date.now()}` // Cache buster
      })),
      citizenships: citRes.rows,
      address: locRes.rows[0] || null
    });

  } catch(e) {
    console.error(e);
    res.status(500).json({success:false, error: e.message});
  }
});

// --- UPDATE MAIN INFO ---
router.post("/detinut/:id/update_main", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error:"Acces interzis"});
  
  const { name, surname, sec_name, birth, sex, idnp } = req.body;
  
  try {
    await db.execute(`
      UPDATE PRISON.DETINUTI 
      SET NAME = :n, SURNAME = :s, SEC_NAME = :sn, SEX = :sex, BIRDTH = TO_DATE(:b, 'DD.MM.YYYY')
      WHERE ID = :id
    `, { n:name, s:surname, sn:sec_name, sex, b:birth, id:req.params.id }, { autoCommit: true });
    
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- UPDATE RELIGION ---
router.post("/detinut/:id/update_religion", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});
  
  try {
    await db.execute("UPDATE PRISON.DETINUTI SET ID_SPR_RELIGION = :r WHERE ID = :id", 
      { r: req.body.religionId, id: req.params.id }, { autoCommit: true });
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- PHOTOS: UPLOAD ---
router.post("/detinut/:id/photos", upload.single("image"), async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error:"Acces interzis"});

  if (!req.file) return res.status(400).json({success:false, error:"No file"});

  const detId = req.params.id;
  const type = req.body.type || "3"; // Default to 'Other'

  try {
    // 1. Get IDNP
    const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID = :id", {id: detId});
    if(!dRes.rows.length) throw new Error("Detinut not found");
    const idnp = dRes.rows[0].IDNP;

    // 2. Insert DB
    // Need to get the ID back. Oracle RETURNING INTO syntax or Sequence then Insert.
    // Assuming Sequence PRISON.IMAGES_SEQ
    const seqRes = await db.execute("SELECT PRISON.IMAGES_SEQ.NEXTVAL AS NEXTID FROM DUAL");
    const newId = seqRes.rows[0].NEXTID;

    await db.execute(
      "INSERT INTO PRISON.IMAGES (ID, DETINUT_ID, IMAGE_TYPE) VALUES (:id, :did, :type)",
      { id: newId, did: detId, type }, 
      { autoCommit: true }
    );

    // 3. Process & Save Image
    const dir1 = idnp.substring(0, 1);
    const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
    ensureDir(targetDir);

    const targetFile = path.join(targetDir, `${newId}_${type}.webp`);

    await sharp(req.file.path)
      .webp({ quality: 80 })
      .toFile(targetFile);

    // Cleanup temp
    fs.unlinkSync(req.file.path);

    res.json({success:true});
  } catch(e) {
    if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(e);
    res.status(500).json({success:false, error:e.message});
  }
});

// --- PHOTOS: DELETE ---
router.delete("/detinut/:id/photos/:photoId", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false});

  const photoId = req.params.photoId;
  const detId = req.params.id;

  try {
    // Check ownership
    const chk = await db.execute("SELECT IMAGE_TYPE, DETINUT_ID FROM PRISON.IMAGES WHERE ID = :id", {id: photoId});
    if (!chk.rows.length || String(chk.rows[0].DETINUT_ID) !== String(detId)) {
      return res.status(400).json({success:false, error:"Invalid photo"});
    }
    const type = chk.rows[0].IMAGE_TYPE;

    // Get IDNP for path
    const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID = :id", {id: detId});
    const idnp = dRes.rows[0].IDNP;

    // DB Delete
    await db.execute("DELETE FROM PRISON.IMAGES WHERE ID = :id", {id: photoId}, {autoCommit: true});

    // File Delete
    const dir1 = idnp.substring(0, 1);
    const filePath = path.join(PHOTOS_BASE_DIR, dir1, idnp, `${photoId}_${type}.webp`);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});


// =========================================================================
// 1. GREVA FOAMEI (Module 7)
// =========================================================================

// READ
router.get("/detinut/:idnp/medical/greva", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 7, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
  
  const canWrite = await checkPermission(uid, 7, 'W');
  const sql = `
    SELECT G.ID, TO_CHAR(G.BDATE, 'DD.MM.YYYY') as BDATE, TO_CHAR(G.EDATE, 'DD.MM.YYYY') as EDATE, 
           G.ID_MOTIV, S.NAME as MOTIV
    FROM PRISON.GREVA_FOAMEI G
    LEFT JOIN PRISON.SPR_MOTIV_GREVA_FOAMEI S ON S.ID = G.ID_MOTIV
    WHERE G.IDNP = :idnp ORDER BY G.BDATE DESC
  `;
  const result = await db.execute(sql, { idnp: req.params.idnp });
  res.json({ success: true, rows: result.rows, canWrite });
});

// CREATE
router.post("/detinut/:idnp/medical/greva", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false, error: "Acces interzis (Write)." });

  const { bdate, edate, id_motiv } = req.body;
  const sql = `
    INSERT INTO PRISON.GREVA_FOAMEI (ID, IDNP, BDATE, EDATE, ID_MOTIV)
    VALUES (PRISON.GREVA_FOAMEI_SEQ.NEXTVAL, :idnp, TO_DATE(:b,'DD.MM.YYYY'), TO_DATE(:e,'DD.MM.YYYY'), :m)
  `;
  try {
    await db.execute(sql, { idnp: req.params.idnp, b: bdate, e: edate || null, m: id_motiv }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// UPDATE
router.put("/detinut/medical/greva/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false, error: "Acces interzis." });

  const { bdate, edate, id_motiv } = req.body;
  const sql = `
    UPDATE PRISON.GREVA_FOAMEI
    SET BDATE = TO_DATE(:b,'DD.MM.YYYY'), EDATE = TO_DATE(:e,'DD.MM.YYYY'), ID_MOTIV = :m
    WHERE ID = :id
  `;
  try {
    await db.execute(sql, { b: bdate, e: edate || null, m: id_motiv, id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE
router.delete("/detinut/medical/greva/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 7, 'W')) return res.status(403).json({ success: false, error: "Acces interzis." });
  
  try {
    await db.execute("DELETE FROM PRISON.GREVA_FOAMEI WHERE ID = :id", { id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});


// =========================================================================
// 2. DIAGNOZA (Module 8)
// =========================================================================

// READ
router.get("/detinut/:idnp/medical/diagnoza", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 8, 'R')) return res.status(403).json({ success: false, error: "Acces interzis." });
  const canWrite = await checkPermission(uid, 8, 'W');
  const sql = `
    SELECT D.ID, TO_CHAR(D.ADATE, 'DD.MM.YYYY') as ADATE, D.NOTE,
           D.ID_DIAGNOZ, S.NAME as DIAGNOZ_NAME, S.ID as DIAGNOZ_COD
    FROM PRISON.DIAGNOZ D
    LEFT JOIN PRISON.SPR_DIAGNOZ S ON S.ID = D.ID_DIAGNOZ
    WHERE D.IDNP = :idnp ORDER BY D.ADATE DESC
  `;
  const result = await db.execute(sql, { idnp: req.params.idnp });
  res.json({ success: true, rows: result.rows, canWrite });
});

// CREATE
router.post("/detinut/:idnp/medical/diagnoza", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false, error: "Acces interzis." });
  const { adate, id_diagnoz, note } = req.body;
  const sql = `
    INSERT INTO PRISON.DIAGNOZ (ID, IDNP, ADATE, ID_DIAGNOZ, NOTE)
    VALUES (PRISON.DIAGNOZ_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :diag, :note)
  `;
  try {
    await db.execute(sql, { idnp: req.params.idnp, d: adate, diag: id_diagnoz, note: note }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// UPDATE
router.put("/detinut/medical/diagnoza/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false, error: "Acces interzis." });
  const { adate, id_diagnoz, note } = req.body;
  const sql = `UPDATE PRISON.DIAGNOZ SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), ID_DIAGNOZ=:diag, NOTE=:note WHERE ID=:id`;
  try {
    await db.execute(sql, { d: adate, diag: id_diagnoz, note, id: req.params.id }, { autoCommit: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE
router.delete("/detinut/medical/diagnoza/:id", async (req, res) => {
  const uid = getUid(req);
  if (!await checkPermission(uid, 8, 'W')) return res.status(403).json({ success: false, error: "Acces interzis." });
  try {
    await db.execute("DELETE FROM PRISON.DIAGNOZ WHERE ID=:id", {id: req.params.id}, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});


// =========================================================================
// 3. RADIOGRAFIE (Module 10)
// =========================================================================

// READ
router.get("/detinut/:idnp/medical/radiografie", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 10, 'R')) return res.status(403).json({success:false, error:"Acces interzis"});
  const canWrite = await checkPermission(uid, 10, 'W');
  const sql = `
    SELECT R.ID, TO_CHAR(R.ADATE, 'DD.MM.YYYY') as ADATE, R.COMMENTS,
           R.ID_PENETENTIAR, R.ID_RESULTAT,
           P.NAME as PENITENCIAR, RES.NAME as REZULTAT
    FROM PRISON.RADIOGRAFIE R
    LEFT JOIN PRISON.SPR_PENITENCIAR P ON P.ID = R.ID_PENETENTIAR
    LEFT JOIN PRISON.SPR_RADIOGRAFIE_RESULTAT RES ON RES.ID = R.ID_RESULTAT
    WHERE R.IDNP = :idnp ORDER BY R.ADATE DESC
  `;
  const result = await db.execute(sql, { idnp: req.params.idnp });
  res.json({ success: true, rows: result.rows, canWrite });
});

// CREATE
router.post("/detinut/:idnp/medical/radiografie", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
  const { adate, id_resultat, id_penitenciar, comments } = req.body;
  const sql = `
    INSERT INTO PRISON.RADIOGRAFIE (ID, IDNP, ADATE, ID_RESULTAT, ID_PENETENTIAR, COMMENTS)
    VALUES (PRISON.RADIOGRAFIE_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :res, :pen, :comm)
  `;
  try {
    await db.execute(sql, { idnp: req.params.idnp, d:adate, res:id_resultat, pen:id_penitenciar, comm:comments }, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// UPDATE
router.put("/detinut/medical/radiografie/:id", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
  const { adate, id_resultat, id_penitenciar, comments } = req.body;
  const sql = `UPDATE PRISON.RADIOGRAFIE SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), ID_RESULTAT=:res, ID_PENETENTIAR=:pen, COMMENTS=:comm WHERE ID=:id`;
  try {
    await db.execute(sql, {d:adate, res:id_resultat, pen:id_penitenciar, comm:comments, id:req.params.id}, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// DELETE
router.delete("/detinut/medical/radiografie/:id", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 10, 'W')) return res.status(403).json({success:false});
  try {
    await db.execute("DELETE FROM PRISON.RADIOGRAFIE WHERE ID=:id", {id:req.params.id}, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});


// =========================================================================
// 4. CONSULTARE (Module 11)
// =========================================================================

// READ
router.get("/detinut/:idnp/medical/consultare", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 11, 'R')) return res.status(403).json({success:false, error:"Acces interzis"});
  const canWrite = await checkPermission(uid, 11, 'W');
  const sql = `
    SELECT C.ID, TO_CHAR(C.ADATE, 'DD.MM.YYYY') as ADATE, C.NPP_DOCTOR,
           C.ID_HOSPITAL, C.ID_INVESTIGATII,
           H.NAME as HOSPITAL, I.NAME as INVESTIGATIE
    FROM PRISON.CONSULTARE_MIN C
    LEFT JOIN PRISON.SPR_HOSPITALS H ON H.ID = C.ID_HOSPITAL
    LEFT JOIN PRISON.SPR_INVESTIGATII I ON I.ID = C.ID_INVESTIGATII
    WHERE C.IDNP = :idnp ORDER BY C.ADATE DESC
  `;
  const result = await db.execute(sql, { idnp: req.params.idnp });
  res.json({ success: true, rows: result.rows, canWrite });
});

// CREATE
router.post("/detinut/:idnp/medical/consultare", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
  const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
  const sql = `
    INSERT INTO PRISON.CONSULTARE_MIN (ID, IDNP, ADATE, NPP_DOCTOR, ID_HOSPITAL, ID_INVESTIGATII)
    VALUES (PRISON.CONSULTARE_MIN_SEQ.NEXTVAL, :idnp, TO_DATE(:d,'DD.MM.YYYY'), :doc, :hosp, :inv)
  `;
  try {
    await db.execute(sql, { idnp:req.params.idnp, d:adate, doc:npp_doctor, hosp:id_hospital, inv:id_investigatii }, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// UPDATE
router.put("/detinut/medical/consultare/:id", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
  const { adate, npp_doctor, id_hospital, id_investigatii } = req.body;
  const sql = `UPDATE PRISON.CONSULTARE_MIN SET ADATE=TO_DATE(:d,'DD.MM.YYYY'), NPP_DOCTOR=:doc, ID_HOSPITAL=:hosp, ID_INVESTIGATII=:inv WHERE ID=:id`;
  try {
    await db.execute(sql, {d:adate, doc:npp_doctor, hosp:id_hospital, inv:id_investigatii, id:req.params.id}, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// DELETE
router.delete("/detinut/medical/consultare/:id", async (req, res) => {
  const uid = getUid(req);
  if(!await checkPermission(uid, 11, 'W')) return res.status(403).json({success:false});
  try {
    await db.execute("DELETE FROM PRISON.CONSULTARE_MIN WHERE ID=:id", {id:req.params.id}, {autoCommit:true});
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

module.exports = router;