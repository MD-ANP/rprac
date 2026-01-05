const express = require("express");
const db = require("../../../db");
const router = express.Router();

const CITATIE_MODULE_ID = 36; 

// Helpers
function getUid(req) { return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; }
const safe = (val) => (val === undefined || val === '' || val === '0') ? null : val;

async function checkPermission(userId, moduleId, requiredRight = 'R') {
    if (!userId) return false;
    try {
        const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL = :m`;
        const res = await db.execute(sql, { u: userId, m: moduleId });
        const right = res.rows.length ? res.rows[0].DREPT : null;
        if (!right) return false;
        return requiredRight === 'R' ? (right === 'R' || right === 'W') : (right === 'W');
    } catch (e) { return false; }
}

// --- METADATA ---
router.get("/detinut/meta/citatie", async (req, res) => {
    if (!await checkPermission(getUid(req), CITATIE_MODULE_ID, 'R')) {
        return res.status(403).json({ success: false, error: "Acces interzis." });
    }
    try {
        const types = await db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_DOCUMENT_CITATIE ORDER BY ID");
        const instante = await db.execute("SELECT ID, NAME FROM PRISON.SPR_INSTANTE WHERE ACTIV = 1 ORDER BY NAME");
        const locuri = await db.execute("SELECT ID, NAME FROM PRISON.SPR_LOCJUDECATA WHERE ACTIV = 1 ORDER BY ID");
        const executori = await db.execute("SELECT ID, NAME FROM PRISON.SPR_EXECUTOR_TRANSFER ORDER BY ID");

        res.json({
            success: true,
            types: types.rows,
            instante: instante.rows,
            locuri: locuri.rows,
            executori: executori.rows
        });
    } catch(e) { res.status(500).json({success:false, error: e.message}); }
});

// --- LIST ---
router.get("/detinut/:idnp/citatii", async (req, res) => {
    const uid = getUid(req);
    if (!await checkPermission(uid, CITATIE_MODULE_ID, 'R')) return res.status(403).send();
    const canWrite = await checkPermission(uid, CITATIE_MODULE_ID, 'W');

    try {
        const sql = `SELECT * FROM PRISON.V_CITATIE WHERE IDNP = :idnp ORDER BY ADATE ASC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows, canWrite });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- ADD (POST) ---
router.post("/detinut/:idnp/citatie", async (req, res) => {
    if (!await checkPermission(getUid(req), CITATIE_MODULE_ID, 'W')) return res.status(403).send();
    
    const b = req.body;
    try {
        const sql = `
            INSERT INTO PRISON.CITATIE (
                IDNP, ID_TIP_DOCUMENT_CITATIE, NRDOCUMENT, ADATE, ORASEDINTA, 
                ID_INSTANTE, NPPJUDECATOR, USERID, INSERTEDDATE, NRSALA, 
                ID_EXECUTOR_TRANSFER, ID_LOCJUDECATA, ANULAT
            ) VALUES (
                :v_idnp, :v_tip, :v_nr, TO_DATE(:v_adate,'DD.MM.YYYY'), :v_ora,
                :v_inst, :v_jud, :v_user, SYSDATE, :v_sala, :v_exec, :v_loc, 'N'
            )
        `;
        await db.execute(sql, {
            v_idnp: req.params.idnp,
            v_tip: safe(b.ID_TIP_DOCUMENT_CITATIE),
            v_nr: safe(b.NRDOCUMENT),
            v_adate: safe(b.ADATE),
            v_ora: safe(b.ORASEDINTA),
            v_inst: safe(b.ID_INSTANTE),
            v_jud: safe(b.NPPJUDECATOR),
            v_user: getUid(req),
            v_sala: safe(b.NRSALA),
            v_exec: safe(b.ID_EXECUTOR_TRANSFER),
            v_loc: safe(b.ID_LOCJUDECATA)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch(e) { 
        console.error(e);
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// --- EDIT (PUT) ---
router.put("/detinut/citatie/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), CITATIE_MODULE_ID, 'W')) return res.status(403).send();
    
    const b = req.body;
    try {
        const sql = `
            UPDATE PRISON.CITATIE SET
                ID_TIP_DOCUMENT_CITATIE = :v_tip,
                NRDOCUMENT = :v_nr,
                ADATE = TO_DATE(:v_adate,'DD.MM.YYYY'),
                ORASEDINTA = :v_ora,
                ID_INSTANTE = :v_inst,
                NPPJUDECATOR = :v_jud,
                NRSALA = :v_sala,
                ID_EXECUTOR_TRANSFER = :v_exec,
                ID_LOCJUDECATA = :v_loc,
                ANULAT = :v_anulat
            WHERE ID = :v_id
        `;
        await db.execute(sql, {
            v_id: req.params.id,
            v_tip: safe(b.ID_TIP_DOCUMENT_CITATIE),
            v_nr: safe(b.NRDOCUMENT),
            v_adate: safe(b.ADATE),
            v_ora: safe(b.ORASEDINTA),
            v_inst: safe(b.ID_INSTANTE),
            v_jud: safe(b.NPPJUDECATOR),
            v_sala: safe(b.NRSALA),
            v_exec: safe(b.ID_EXECUTOR_TRANSFER),
            v_loc: safe(b.ID_LOCJUDECATA),
            v_anulat: b.ANULAT || 'N'
        }, { autoCommit: true });
        res.json({ success: true });
    } catch(e) { 
        console.error(e);
        res.status(500).json({ success: false, error: e.message }); 
    }
});

module.exports = router;