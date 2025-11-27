const express = require("express");
const db = require("../../../db");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");

// --- CONFIGURATION ---
const PHOTOS_BASE_DIR = path.join(process.cwd(), "public/resources/photos");
const TEMP_DIR = path.join(process.cwd(), "public/resources/temp_uploads");

if (!fs.existsSync(TEMP_DIR)) {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Doar fișiere PDF sunt acceptate!'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function getUid(req) { 
  return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}

// --- FIX IP FUNCTION ---
function getIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  
  // 1. Dacă sunt mai multe IP-uri (prin proxy), luăm primul
  if (ip.indexOf(',') > -1) {
      ip = ip.split(',')[0].trim();
  }

  // 2. Curățăm prefixul IPv6 specific Node.js (::ffff:) pentru a rămâne cu IPv4 curat
  // Ex: ::ffff:192.168.1.5 (16 chars) devine 192.168.1.5 (11 chars)
  if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
  }

  // 3. Forțăm limita de 15 caractere a bazei de date
  return ip.substring(0, 15);
}

async function syncFolderPending(idnp) {
    const countRes = await db.execute(
        "SELECT COUNT(*) AS CNT FROM PRISON.PENDINGFOLDER WHERE IDNP = :p_idnp", 
        { p_idnp: idnp }
    );
    const count = countRes.rows[0].CNT;
    const flag = count > 0 ? 'Y' : 'N';

    await db.execute(
        "UPDATE PRISON.DETINUTI SET FOLDERPENDING = :p_flag WHERE IDNP = :p_idnp",
        { p_flag: flag, p_idnp: idnp },
        { autoCommit: true }
    );
}

// --- ROUTES ---

// 1. LIST
router.get("/detinut/:idnp/garantii", async (req, res) => {
    try {
        const sql = `
            SELECT ID, DESCRIERE, TO_CHAR(INSERTEDDATE, 'DD.MM.YYYY HH24:MI') as DATA_UPLOAD 
            FROM PRISON.PENDINGFOLDER 
            WHERE IDNP = :p_idnp 
            ORDER BY INSERTEDDATE DESC
        `;
        const result = await db.execute(sql, { p_idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. UPLOAD
router.post("/detinut/:idnp/garantii", upload.single('pdf'), async (req, res) => {
    const userId = getUid(req);
    const idnp = req.params.idnp;
    
    if (!req.file) return res.status(400).json({ success: false, error: "Lipsă fișier PDF." });

    try {
        const dir1 = idnp.charAt(0);
        const targetDir = path.join(PHOTOS_BASE_DIR, dir1, idnp, "garant");
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const desc = req.body.descriere || req.file.originalname;
        const userIp = getIp(req); // Folosim funcția fixată

        const insertSql = `
            INSERT INTO PRISON.PENDINGFOLDER (
                IDNP, DESCRIERE, USERID, IPUSER, INSERTEDDATE, DOCUMENTDATE
            ) VALUES (
                :p_idnp, :p_desc, :p_uid, :p_ip, SYSDATE, SYSDATE
            ) RETURNING ID INTO :p_rid
        `;
        
        const dbRes = await db.execute(insertSql, {
            p_idnp: idnp,
            p_desc: desc,
            p_uid: userId,
            p_ip: userIp,
            p_rid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }, { autoCommit: true });

        const newId = dbRes.outBinds.p_rid[0];
        const finalPath = path.join(targetDir, `${newId}.pdf`);
        fs.renameSync(req.file.path, finalPath);

        await syncFolderPending(idnp);

        res.json({ success: true, id: newId });

    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("Upload error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. DELETE
router.delete("/detinut/garantii/:id", async (req, res) => {
    const fileId = req.params.id;
    try {
        const infoRes = await db.execute("SELECT IDNP FROM PRISON.PENDINGFOLDER WHERE ID = :p_id", { p_id: fileId });
        if (!infoRes.rows.length) throw new Error("Fișierul nu există.");
        
        const idnp = infoRes.rows[0].IDNP;
        
        await db.execute("DELETE FROM PRISON.PENDINGFOLDER WHERE ID = :p_id", { p_id: fileId }, { autoCommit: true });

        const dir1 = idnp.charAt(0);
        const filePath = path.join(PHOTOS_BASE_DIR, dir1, idnp, "garant", `${fileId}.pdf`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await syncFolderPending(idnp);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. DOWNLOAD
router.get("/detinut/:idnp/garantii/download/:id", async (req, res) => {
    try {
        const idnp = req.params.idnp;
        const id = req.params.id;
        
        const dbRes = await db.execute("SELECT DESCRIERE FROM PRISON.PENDINGFOLDER WHERE ID = :p_id AND IDNP = :p_idnp", { p_id: id, p_idnp: idnp });
        if (!dbRes.rows.length) return res.status(404).send("File record not found.");
        
        const originalName = dbRes.rows[0].DESCRIERE;
        const dir1 = idnp.charAt(0);
        const filePath = path.join(PHOTOS_BASE_DIR, dir1, idnp, "garant", `${id}.pdf`);

        if (fs.existsSync(filePath)) {
            let downloadName = originalName.endsWith('.pdf') ? originalName : originalName + '.pdf';
            downloadName = downloadName.replace(/[^a-z0-9\.]/gi, '_');
            res.download(filePath, downloadName);
        } else {
            res.status(404).send("Physical file missing.");
        }
    } catch (e) {
        res.status(500).send(e.message);
    }
});

module.exports = router;