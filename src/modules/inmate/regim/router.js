const express = require("express");
const db = require("../../../db"); 
const router = express.Router();

// --- HELPERS ---
function getUid(req) { 
    return req.header("x-user-id") ? Number(req.header("x-user-id")) : 0; 
}

const safe = (val) => (val === undefined || val === '' || val === '0') ? null : val;

async function checkPermission(userId, moduleId, requiredRight = 'R') {
    if (!userId) return false;
    try {
        // Assuming PRISON.SPR_ACCESS has columns ID_USER, ID_MODUL, DREPT ('R' or 'W')
        const sql = `SELECT DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL = :m`;
        const res = await db.execute(sql, { u: userId, m: moduleId });
        
        if (!res.rows.length) return false; // No entry = No access
        
        const right = res.rows[0].DREPT;
        // If we need Write ('W'), the user must have 'W'.
        // If we need Read ('R'), 'R' or 'W' is fine.
        if (requiredRight === 'W') return right === 'W';
        return (right === 'R' || right === 'W');
    } catch (e) { 
        console.error("Permission check failed:", e);
        return false; 
    }
}

// Module Constants
const MOD_INTREVEDERI = 29;
const MOD_COLETE = 30;
const MOD_TEHNICA = 31;
const MOD_INCIDENTE = 32; // Predispus, Constringere, Obiecte
const MOD_DEPLASARI = 33;

// --- 1. METADATA ---
router.get("/detinut/permissions/regim", async (req, res) => {
    const uid = getUid(req);
    if (!uid) return res.json({ success: true, perms: {} });

    try {
        // IDs: 29=Intrevederi, 30=Colete, 31=Tehnica, 32=Incidente, 33=Deplasari
        const sql = `SELECT ID_MODUL, DREPT FROM PRISON.SPR_ACCESS WHERE ID_USER = :u AND ID_MODUL IN (29, 30, 31, 32, 33)`;
        const result = await db.execute(sql, { u: uid });
        
        // Convert to map: { 29: 'W', 30: 'R' }
        const perms = {};
        result.rows.forEach(r => perms[r.ID_MODUL] = r.DREPT);
        
        res.json({ success: true, perms });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});




router.get("/detinut/meta/combined", async (req, res) => {
    try {
        // Metadata is usually public or low-security, but you can restrict it if needed
        const [
            durations, tips, relatives, penits, tipTehnica, 
            tipDeplasari, predispus, tipMasura, obInterzise, motalPerc
        ] = await Promise.all([
            db.execute("SELECT ID, NAME FROM PRISON.SPR_DURATION ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_DOCUMENT ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_RELATIVE_TYPE ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_TEHNICA ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_DEPLASARI ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_PREDISPUS ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_TIP_CONSTRINGERE ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_OBIECTE_INTERZISE ORDER BY NAME"),
            db.execute("SELECT ID, NAME FROM PRISON.SPR_MOTAL_PER ORDER BY NAME")
        ]);

        res.json({
            success: true,
            meta: {
                durations: durations.rows,
                docTypes: tips.rows,
                relatives: relatives.rows,
                penitenciars: penits.rows,
                techTypes: tipTehnica.rows,
                depTypes: tipDeplasari.rows,
                predispus: predispus.rows,
                measures: tipMasura.rows,
                forbidden: obInterzise.rows,
                searchModes: motalPerc.rows
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==========================================
// MODULE: INTREVEDERI (ID 29)
// ==========================================

router.get("/detinut/:idnp/intrevederi", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INTREVEDERI, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_INTREVEDERI WHERE IDNP = :idnp ORDER BY BDATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/intrevederi", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INTREVEDERI, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { bdate, edate, id_duration, name, id_tip_doc, nrdoc, surname, sec_name, id_rel_type, comments } = req.body;
    try {
        const sql = `INSERT INTO PRISON.INTREVEDERI (ID, IDNP, BDATE, EDATE, ID_DURATION, NAME, ID_TIP_DOCUMENT, NRDOCUMENT, SURNAME, SEC_NAME, ID_RELATIVE_TYPE, COMMENTS) VALUES (PRISON.INTREVEDERI_SEQ.NEXTVAL, :idnp, TO_DATE(:bdate,'DD.MM.YYYY'), TO_DATE(:edate,'DD.MM.YYYY'), :id_dur, :name, :id_tdoc, :nrdoc, :surname, :sec_name, :id_rel, :comm)`;
        await db.execute(sql, {
            idnp: req.params.idnp, bdate: safe(bdate), edate: safe(edate), id_dur: safe(id_duration),
            name: safe(name), id_tdoc: safe(id_tip_doc), nrdoc: safe(nrdoc), surname: safe(surname),
            sec_name: safe(sec_name), id_rel: safe(id_rel_type), comm: safe(comments)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/intrevederi/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INTREVEDERI, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try {
        await db.execute("DELETE FROM PRISON.INTREVEDERI WHERE ID = :id", { id: req.params.id }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ==========================================
// MODULE: COLETE (ID 30)
// ==========================================

router.get("/detinut/:idnp/colete", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_COLETE, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_COLETA WHERE IDNP = :idnp ORDER BY DATE_IN DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/colete", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_COLETE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { date_in, date_open, person, continut, date_inm, not_allowed, sursa_prov, comments } = req.body;
    try {
        const sql = `INSERT INTO PRISON.COLETA (ID, IDNP, DATE_IN, DATE_OPEN, PERSON, CONTINUT, DATE_INMINARE, NOT_ALLOWED, SURSA_PROV, COMMENTS) VALUES (PRISON.COLETA_SEQ.NEXTVAL, :idnp, TO_DATE(:di,'DD.MM.YYYY'), TO_DATE(:do,'DD.MM.YYYY'), :pers, :cont, TO_DATE(:dim,'DD.MM.YYYY'), :na, :sursa, :comm)`;
        await db.execute(sql, {
            idnp: req.params.idnp, di: safe(date_in), do: safe(date_open), pers: safe(person),
            cont: safe(continut), dim: safe(date_inm), na: safe(not_allowed), sursa: safe(sursa_prov), comm: safe(comments)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/colete/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_COLETE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try {
        await db.execute("DELETE FROM PRISON.COLETA WHERE ID = :id", { id: req.params.id }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ==========================================
// MODULE: TEHNICA (ID 31)
// ==========================================

router.get("/detinut/:idnp/tehnica", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_TEHNICA, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_TEHNICA WHERE IDNP = :idnp ORDER BY ADATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/tehnica", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_TEHNICA, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { adate, npp, id_tip_doc, nrdoc, tip_tehnica, model, seria, id_pen, date_out, motiv } = req.body;
    try {
        const sql = `INSERT INTO PRISON.TEHNICA (ID, IDNP, ADATE, NPP, ID_TIP_DOCUMENT, NRDOCUMENT, TIP_TEHNICA, MODEL, SERIA, ID_PENETENTIAR, DATE_OUT, MOTIV) VALUES (PRISON.TEHNICA_SEQ.NEXTVAL, :idnp, TO_DATE(:adate,'DD.MM.YYYY'), :npp, :id_tdoc, :nrdoc, :tip_t, :model, :seria, :id_pen, TO_DATE(:dout,'DD.MM.YYYY'), :motiv)`;
        await db.execute(sql, {
            idnp: req.params.idnp, adate: safe(adate), npp: safe(npp), id_tdoc: safe(id_tip_doc),
            nrdoc: safe(nrdoc), tip_t: safe(tip_tehnica), model: safe(model), seria: safe(seria),
            id_pen: safe(id_pen), dout: safe(date_out), motiv: safe(motiv)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/tehnica/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_TEHNICA, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try {
        await db.execute("DELETE FROM PRISON.TEHNICA WHERE ID = :id", { id: req.params.id }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ==========================================
// MODULE: DEPLASARI (ID 33)
// ==========================================

router.get("/detinut/:idnp/deplasari", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_DEPLASARI, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_DEPLASARI WHERE IDNP = :idnp ORDER BY ADATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/deplasari", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_DEPLASARI, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { adate, id_pen, id_tip, motiv } = req.body;
    try {
        const sql = `INSERT INTO PRISON.DEPLASARI (ID, IDNP, ADATE, ID_PENETETIAR, ID_TIP_DEPLASARII, MOTIV) VALUES (PRISON.DEPLASARI_SEQ.NEXTVAL, :idnp, TO_DATE(:adate,'DD.MM.YYYY'), :id_pen, :id_tip, :motiv)`;
        await db.execute(sql, {
            idnp: req.params.idnp, adate: safe(adate), id_pen: safe(id_pen), id_tip: safe(id_tip), motiv: safe(motiv)
        }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/deplasari/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_DEPLASARI, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try {
        await db.execute("DELETE FROM PRISON.DEPLASARI WHERE ID = :id", { id: req.params.id }, { autoCommit: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ==========================================
// MODULE: INCIDENTE / INCALCARI (ID 32)
// ==========================================

// 1. Predispus
router.get("/detinut/:idnp/incidente/predispus", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_PREDISPUS WHERE IDNP = :idnp ORDER BY ADATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/incidente/predispus", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { adate, id_pred, edate } = req.body;
    try {
        await db.execute(
            `INSERT INTO PRISON.PREDISPUS (ID, IDNP, ADATE, ID_PREDISPUS, EDATE) VALUES (PRISON.PREDISPUS_SEQ.NEXTVAL, :idnp, TO_DATE(:a,'DD.MM.YYYY'), :p, TO_DATE(:e,'DD.MM.YYYY'))`,
            { idnp: req.params.idnp, a: safe(adate), p: safe(id_pred), e: safe(edate) }, { autoCommit: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/incidente/predispus/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try { await db.execute("DELETE FROM PRISON.PREDISPUS WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// 2. Constringere
router.get("/detinut/:idnp/incidente/constringere", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_CONSTRINGERE WHERE IDNP = :idnp ORDER BY ADATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/incidente/constringere", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { adate, id_tip, id_pen } = req.body;
    try {
        await db.execute(
            `INSERT INTO PRISON.CONSTRINGERE (ID, IDNP, ADATE, ID_TIP_MASURA, ID_PENETENTIAR) VALUES (PRISON.CONSTRINGERE_SEQ.NEXTVAL, :idnp, TO_DATE(:a,'DD.MM.YYYY'), :t, :p)`,
            { idnp: req.params.idnp, a: safe(adate), t: safe(id_tip), p: safe(id_pen) }, { autoCommit: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/incidente/constringere/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try { await db.execute("DELETE FROM PRISON.CONSTRINGERE WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

// 3. Obiecte
router.get("/detinut/:idnp/incidente/obiecte", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'R')) return res.status(403).json({success:false, error:"Acces interzis (R)"});
    try {
        const sql = `SELECT * FROM PRISON.V_OBIECTE_INTERZISE WHERE IDNP = :idnp ORDER BY ADATE DESC`;
        const result = await db.execute(sql, { idnp: req.params.idnp });
        res.json({ success: true, rows: result.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post("/detinut/:idnp/incidente/obiecte", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    const { adate, id_ob, place, id_modal, comments } = req.body;
    try {
        // FIX: Removed "ID" and "PRISON.OBIECTE_SEQ.NEXTVAL"
        // The trigger "OBIECTE_INTERZISE_TRG1" will automatically assign the correct ID.
        await db.execute(
            `INSERT INTO PRISON.OBIECTE_INTERZISE (IDNP, ADATE, ID_OBIECTE_INTERZISE, PLACE, ID_MOTAL_PERC, COMMENTS) 
             VALUES (:idnp, TO_DATE(:a,'DD.MM.YYYY'), :o, :p, :m, :c)`,
            { idnp: req.params.idnp, a: safe(adate), o: safe(id_ob), p: safe(place), m: safe(id_modal), c: safe(comments) }, { autoCommit: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/detinut/incidente/obiecte/:id", async (req, res) => {
    if (!await checkPermission(getUid(req), MOD_INCIDENTE, 'W')) return res.status(403).json({success:false, error:"Acces interzis (W)"});
    try { await db.execute("DELETE FROM PRISON.OBIECTE_INTERZISE WHERE ID=:id", {id:req.params.id}, {autoCommit:true}); res.json({success:true}); } catch(e) { res.status(500).json({success:false, error:e.message}); }
});

module.exports = router;