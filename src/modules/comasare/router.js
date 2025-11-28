const express = require("express");
const db = require("../../db");
const router = express.Router();

// Allowed Roles
const ALLOWED_ROLES = [7, 99];

// Tables to update simply (IDNP -> IDNP)
// Derived directly from your legacy code list
const SIMPLE_TABLES = [
    'PRISON.ACTE',
    'PRISON.ACTIVITATE_CULTURAL',
    'PRISON.ARESTARI',
    'PRISON.AUTOMUTILARE',
    'PRISON.AUTORITATE',
    'PRISON.CARACTER_PSIH',
    'PRISON.CARACTERISTICA',
    'PRISON.CITATIE',
    'PRISON.COLETA',
    'PRISON.CONSILIEREA_PSIH',
    'PRISON.CONSTRINGERE',
    'PRISON.CONSULTARE_MIN',
    'PRISON.CONTEST_SANCTIUNE',
    'PRISON.DEPLASARI',
    'PRISON.DIAGNOZ',
    'PRISON.EMPLOYEMENT',
    'PRISON.EMPLOYEMENT_PRISON',
    'PRISON.EVADARE',
    'PRISON.FACT_STAT',
    'PRISON.GREVA_FOAMEI',
    'PRISON.GRUPA_RISC',
    'PRISON.HOTARIRI_JUD',
    'PRISON.INCIDENTS',
    'PRISON.INDEMNIZARE',
    'PRISON.INSTRUIRE_ALTE',
    'PRISON.INSTRUIRE_GENERALA',
    'PRISON.INSTRUIRE_PROF',
    'PRISON.INTREVEDERI',
    'PRISON.LEZIUNI_CORPORALE',
    'PRISON.MISCARI',
    'PRISON.MISCARI_UP',
    'PRISON.MISCARI2',
    'PRISON.NEREMUNERAT',
    'PRISON.OBIECTE_INTERZISE',
    'PRISON.PENDINGFOLDER',
    'PRISON.PREDISPUS',
    'PRISON.PROG_ASIST_SOC',
    'PRISON.PROGRAME_PSIH_SOC',
    'PRISON.RADIOGRAFIE',
    'PRISON.REDUCERETERMEN',
    'PRISON.SITIZEN',
    'PRISON.REMUNERAT',
    'PRISON.SANCTIUNI',
    'PRISON.SECURITATE_PERSONALA',
    'PRISON.SOL_PROBLEM_SOC',
    'PRISON.STIMULARI',
    'PRISON.TEHNICA'
];

// Tables where column name might differ (from legacy code)
// e.g. COMPLICI uses IDNP_DET, RELATIVES uses IDNP_DET
const SPECIAL_TABLES = [
    { table: 'PRISON.COMPLICI', col: 'IDNP_DET' },
    { table: 'PRISON.RELATIVES', col: 'IDNP_DET' }
];

// Helper: Check Role
async function checkAccess(req, res, next) {
    const uid = req.header("x-user-id");
    if (!uid) return res.status(403).json({ success: false, error: "Lipsă utilizator" });

    try {
        const result = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :id", { id: uid });
        if (result.rows.length === 0) return res.status(403).json({ success: false, error: "Utilizator invalid" });
        
        const role = result.rows[0].ID_ROLE;
        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(403).json({ success: false, error: "Acces interzis! Doar rolurile 7 și 99." });
        }
        next();
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

// 1. SEARCH INMATE
router.get("/comasare/search", checkAccess, async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 3) return res.json({ success: true, rows: [] });

    try {
        // Search by IDNP or Name
        const sql = `
            SELECT ID, IDNP, NAME, SURNAME, SEC_NAME, BIRDTH 
            FROM PRISON.DETINUTI 
            WHERE (IDNP LIKE :q || '%' OR UPPER(NAME) LIKE UPPER('%' || :q || '%') OR UPPER(SURNAME) LIKE UPPER('%' || :q || '%'))
            AND ROWNUM <= 10
        `;
        const result = await db.execute(sql, { q });
        res.json({ success: true, rows: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. EXECUTE MERGE
router.post("/comasare/execute", checkAccess, async (req, res) => {
    const { old_idnp, new_idnp } = req.body;

    if (!old_idnp || !new_idnp) {
        return res.status(400).json({ success: false, error: "Lipsesc IDNP-urile" });
    }
    if (old_idnp === new_idnp) {
        return res.status(400).json({ success: false, error: "IDNP-urile trebuie să fie diferite" });
    }

    const logs = [];

    // Helper to log
    const log = (msg, type = 'info') => logs.push({ message: msg, type });

    try {
        log(`Începere comasare: ${old_idnp} -> ${new_idnp}`, 'header');

        // 1. Execute Simple Updates
        for (const table of SIMPLE_TABLES) {
            try {
                const sql = `UPDATE ${table} SET IDNP = :b_new WHERE IDNP = :b_old`;
                const result = await db.execute(sql, { b_new: new_idnp, b_old: old_idnp }, { autoCommit: true });
                log(`[${table}] Actualizat: ${result.rowsAffected} rânduri.`, 'success');
            } catch (e) {
                // Don't break, just log error as requested
                log(`[${table}] Eroare: ${e.message}`, 'error');
            }
        }

        // 2. Execute Special Updates (Different Column Names)
        for (const item of SPECIAL_TABLES) {
            try {
                const sql = `UPDATE ${item.table} SET ${item.col} = :b_new WHERE ${item.col} = :b_old`;
                const result = await db.execute(sql, { b_new: new_idnp, b_old: old_idnp }, { autoCommit: true });
                log(`[${item.table}] Actualizat: ${result.rowsAffected} rânduri.`, 'success');
            } catch (e) {
                log(`[${item.table}] Eroare: ${e.message}`, 'error');
            }
        }

        // 3. Mark OLD Profile as Merged (Legacy logic)
        try {
            const sqlOld = `UPDATE PRISON.DETINUTI SET NAME = NAME || '(COMASAT ' || TO_CHAR(SYSDATE, 'YYYY') || ')' WHERE IDNP = :b_old`;
            await db.execute(sqlOld, { b_old: old_idnp }, { autoCommit: true });
            log(`[DETINUTI] Profil vechi marcat ca COMASAT.`, 'success');
        } catch (e) {
            log(`[DETINUTI - VECHI] Eroare marcare: ${e.message}`, 'error');
        }

        // 4. Update NEW Profile with data from OLD (Legacy logic)
        try {
            const sqlNew = `
                UPDATE PRISON.DETINUTI T1
                SET (BIRDTH, STATE_ID, SEX, WPOLICE, ID_SPR_CATEG_SOCIAL, ID_SPR_EDU_LEVEL, 
                     ID_HEALTH_STAT, ID_MAR_STATUS, ID_SPR_NATIONALITY, ID_SPR_RELIGION, IDNP1, FOLDERPENDING) = 
                    (SELECT BIRDTH, STATE_ID, SEX, WPOLICE, ID_SPR_CATEG_SOCIAL, ID_SPR_EDU_LEVEL, 
                            ID_HEALTH_STAT, ID_MAR_STATUS, ID_SPR_NATIONALITY, ID_SPR_RELIGION, IDNP1, FOLDERPENDING
                     FROM PRISON.DETINUTI T2 WHERE T2.IDNP = :b_old)
                WHERE T1.IDNP = :b_new
            `;
            const resNew = await db.execute(sqlNew, { b_new: new_idnp, b_old: old_idnp }, { autoCommit: true });
            log(`[DETINUTI] Profil nou actualizat cu datele vechi (${resNew.rowsAffected} rânduri).`, 'success');
        } catch (e) {
            log(`[DETINUTI - NOU] Eroare actualizare date: ${e.message}`, 'error');
        }

        log("Proces de comasare finalizat.", 'header');
        res.json({ success: true, logs });

    } catch (globalError) {
        log(`Eroare critică: ${globalError.message}`, 'error');
        res.json({ success: false, logs });
    }
});

module.exports = router;