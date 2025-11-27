const express = require("express");
const db = require("../../../db"); 
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// FIX: Use process.cwd() to target project root correctly
const PHOTOS_BASE_DIR = path.join(process.cwd(), "public/resources/photos");
const TEMP_DIR = path.join(process.cwd(), "public/resources/temp_uploads");

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (e) {}
}

const upload = multer({ dest: TEMP_DIR });

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}
const safe = (val) => (val === undefined ? null : val);

// --- AUTH HELPER ---
async function canEditGeneral(userId) {
  if (!userId) return false;
  try {
    const res = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :u", { u: userId });
    if (!res.rows.length) return false;
    const role = Number(res.rows[0].ID_ROLE);
    // Roles allowed to edit: 1, 7, 99
    return [1, 7, 99].includes(role); 
  } catch (e) { return false; }
}

// --- METADATA ROUTES ---
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

// --- GENERAL PROFILE READ ---
router.get("/detinut/:id/general", async (req, res) => {
  try {
    const sql = `
      SELECT D.ID, D.IDNP, D.SURNAME, D.NAME, D.SEC_NAME, 
             TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH, 
             P.NAME as PENITENCIAR_NAME,
             D.FOLDERPENDING  -- <--- ADDED COLUMN
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

router.get("/detinut/:id/general_full", async (req, res) => {
  try {
    const uid = getUid(req);
    const canEdit = await canEditGeneral(uid);
    const id = req.params.id;

    const dRes = await db.execute(`SELECT D.ID, D.IDNP, D.NAME, D.SURNAME, D.SEC_NAME, D.SEX, D.WPOLICE, TO_CHAR(D.BIRDTH, 'DD.MM.YYYY') as BIRDTH_STR, D.ID_SPR_CATEG_SOCIAL, D.ID_SPR_EDU_LEVEL, D.ID_MAR_STATUS, D.ID_SPR_NATIONALITY, D.ID_SPR_RELIGION, D.ID_HEALTH_STAT, S.NAME as STATUT_NAME, REL.NAME as RELIGION_NAME, NAT.NAME as NATIONALITY_NAME, EDU.NAME as EDU_NAME, MAR.NAME as MARITAL_NAME FROM PRISON.DETINUTI D LEFT JOIN PRISON.STATUT_HISTORY SH ON (SH.IDNP = D.IDNP AND SH.B_DATE = (SELECT MAX(B_DATE) FROM PRISON.STATUT_HISTORY WHERE IDNP = D.IDNP)) LEFT JOIN PRISON.SPR_STATUT S ON S.ID = SH.ID_STATUT LEFT JOIN PRISON.SPR_RELIGION REL ON REL.ID = D.ID_SPR_RELIGION LEFT JOIN PRISON.SPR_NATIONALITY NAT ON NAT.ID = D.ID_SPR_NATIONALITY LEFT JOIN PRISON.SPR_EDU_LEVEL EDU ON EDU.ID = D.ID_SPR_EDU_LEVEL LEFT JOIN PRISON.SPR_MAR_STATUS MAR ON MAR.ID = D.ID_MAR_STATUS WHERE D.ID = :id`, { id });

    if (!dRes.rows.length) return res.status(404).json({success:false, error:"Not found"});
    const detinut = dRes.rows[0];
    const idnp = detinut.IDNP;

    const imgRes = await db.execute("SELECT IMAGE_TYPE FROM PRISON.IMAGES WHERE DETINUT_ID = :id ORDER BY IMAGE_TYPE ASC", { id });
    const images = (imgRes.rows || []).map(i => ({ id: i.IMAGE_TYPE, type: i.IMAGE_TYPE, url: `/resources/photos/${idnp.charAt(0)}/${idnp}/${i.IMAGE_TYPE}.webp?v=${Date.now()}` }));

    const citRes = await db.execute(`SELECT C.ID, S.NAME, TO_CHAR(C.BDATE, 'DD.MM.YYYY') as BDATE FROM PRISON.SITIZEN C JOIN PRISON.SPR_SITIZEN S ON S.ID = C.ID_SITIZEN WHERE C.IDNP = :idnp`, { idnp });
    const actRes = await db.execute(`SELECT A.ID, A.NRDOCUMENT, TO_CHAR(A.ELIBERAT_DATA, 'DD.MM.YYYY') as ELIB_STR, TO_CHAR(A.VALABIL_PINA, 'DD.MM.YYYY') as EXP_STR, T.NAME as TIP_DOC FROM PRISON.ACTE A JOIN PRISON.SPR_TIP_DOCUMENT T ON T.ID = A.ID_TIP_DOCUMENT WHERE A.IDNP = :idnp`, { idnp });
    const empRes = await db.execute(`SELECT E.ID, E.PLACE, P.NAME as PROFESSION, TO_CHAR(E.EDATE, 'DD.MM.YYYY') as START_DATE FROM PRISON.EMPLOYEMENT E LEFT JOIN PRISON.SPR_PROFESSION P ON P.ID = E.ID_PROFESSION WHERE E.IDNP = :idnp`, { idnp });
    const locRes = await db.execute(`SELECT L.ID, L.ADDRESS, TO_CHAR(L.START_DATE, 'DD.MM.YYYY') as START_DATE_STR, LOC.NAME as CITY FROM PRISON.L_LOCATION L LEFT JOIN PRISON.SPR_LOCALITY LOC ON LOC.ID = L.LOCALITY_ID WHERE L.IDNP = :idnp`, { idnp });

    res.json({ success: true, canEdit, detinut, images, citizenships: citRes.rows, acts: actRes.rows, employment: empRes.rows, address: locRes.rows });
  } catch(e) { res.status(500).json({success:false, error: e.message}); }
});

// --- UPDATE MAIN ---
router.post("/detinut/:id/update_main", async (req, res) => {
  const uid = getUid(req);
  if (!(await canEditGeneral(uid))) return res.status(403).json({success:false, error: "Acces interzis la editare."});
  
  const { name, surname, sec_name, birth, sex, wpolice, id_categ, id_edu, id_mar, id_nat, id_rel, id_health } = req.body;
  try {
    // FIX: Renamed :in to :nat and :s to :snm to avoid reserved keyword conflicts
    const sql = `
        UPDATE PRISON.DETINUTI 
        SET NAME=:n, 
            SURNAME=:snm, 
            SEC_NAME=:sec, 
            SEX=:sex, 
            BIRDTH=TO_DATE(:b, 'DD.MM.YYYY'), 
            WPOLICE=:w, 
            ID_SPR_CATEG_SOCIAL=:ic, 
            ID_SPR_EDU_LEVEL=:ie, 
            ID_MAR_STATUS=:im, 
            ID_SPR_NATIONALITY=:nat, 
            ID_SPR_RELIGION=:ir, 
            ID_HEALTH_STAT=:ih 
        WHERE ID = :id`;
    
    await db.execute(sql, { 
        n: safe(name), 
        snm: safe(surname), 
        sec: safe(sec_name), 
        sex: safe(sex), 
        b: safe(birth), 
        w: wpolice||'N', 
        ic: safe(id_categ), 
        ie: safe(id_edu), 
        im: safe(id_mar), 
        nat: safe(id_nat), // Renamed from :in
        ir: safe(id_rel), 
        ih: safe(id_health), 
        id: req.params.id 
    }, { autoCommit: true });
    
    res.json({success:true});
  } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// --- SUB-ENTITIES CRUD ---

// Acte
router.post("/detinut/:idnp/acte", async (req, res) => {
    if (!await canEditGeneral(getUid(req))) return res.status(403).json({success:false});
    
    // FIX: Removed 'ID' (trigger handles it) and renamed 'ELIBERAT_DE' -> 'ELIBERAT_CATRE'
    const { id_tip, nr_doc, issued_by, date_issue, date_exp } = req.body;
    try { 
        await db.execute(
            `INSERT INTO PRISON.ACTE (
                IDNP, 
                ID_TIP_DOCUMENT, 
                NRDOCUMENT, 
                ELIBERAT_CATRE, 
                ELIBERAT_DATA, 
                VALABIL_PINA
             ) VALUES (
                :idnp, 
                :tip, 
                :nr, 
                :iby, 
                TO_DATE(:di,'DD.MM.YYYY'), 
                TO_DATE(:de,'DD.MM.YYYY')
             )`, 
            { 
                idnp: req.params.idnp, 
                tip: safe(id_tip), 
                nr: safe(nr_doc), 
                iby: safe(issued_by), // Maps to ELIBERAT_CATRE
                di: safe(date_issue), 
                de: safe(date_exp) 
            }, 
            { autoCommit: true }
        ); 
        res.json({success:true}); 
    } catch(e) { res.status(500).json({success:false, error:e.message}); }
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
    
    // FIX: Removed 'ID' column and sequence. 
    // The DB trigger 'L_LOCATION_TRG' will handle ID generation using 'L_LOCATION2_SEQ'.
    const { locality_id, address, start_date } = req.body;
    try { 
        await db.execute(
            `INSERT INTO PRISON.L_LOCATION (
                IDNP, 
                LOCALITY_ID, 
                ADDRESS, 
                START_DATE
             ) VALUES (
                :idnp, 
                :lid, 
                :addr, 
                TO_DATE(:d,'DD.MM.YYYY')
             )`, 
            { 
                idnp: req.params.idnp, 
                lid: safe(locality_id), 
                addr: safe(address), 
                d: safe(start_date) 
            }, 
            { autoCommit: true }
        ); 
        res.json({success:true}); 
    } catch(e) { res.status(500).json({success:false, error:e.message}); }
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
        const dRes = await db.execute("SELECT IDNP FROM PRISON.DETINUTI WHERE ID=:id", {id:req.params.id});
        if(!dRes.rows.length) throw new Error("Deținut invalid");
        const idnp = dRes.rows[0].IDNP;
        const dir1 = idnp.charAt(0);
        
        const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp);
        if(!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, {recursive:true});
        
        const targetPath = path.join(targetDir, `${type}.webp`);
        
        await sharp(req.file.path)
           .resize(600)
           .webp({ quality: 80 })
           .toFile(targetPath);
           
        fs.unlink(req.file.path, ()=>{});
        
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

module.exports = router;