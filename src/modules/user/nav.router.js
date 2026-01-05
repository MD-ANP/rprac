const express = require("express");
const db = require("../../db");
const path = require("path");
const fs = require("fs");
const modulesConfig = require("../../modulesConfig"); 
const { logUserAction } = require("../../logger");


const router = express.Router();


router.get("/nav", async (req, res) => {
    const userId = Number(req.query.userId || 0);
    if (!userId) return res.status(400).json({ success: false, error: "UserId lipsă." });

    try {
        const userResult = await db.execute("SELECT ID_ROLE FROM USERS WHERE ID = :id", { id: userId });
        if (!userResult.rows?.length) return res.status(401).json({ success: false });

        const roleId = userResult.rows[0].ID_ROLE != null ? Number(userResult.rows[0].ID_ROLE) : null;
        const moduleIds = modulesConfig.map(m => m.oracleModuleId).filter(id => id != null);
        
        let accessMap = {};
        if (moduleIds.length > 0) {
            const bindParams = { v_uid: userId };
            const placeholders = moduleIds.map((id, idx) => {
                bindParams[`m${idx}`] = id;
                return `:m${idx}`;
            }).join(",");

            const accessSql = `SELECT ID_MODUL, DREPT FROM SPR_ACCESS WHERE ID_USER = :v_uid AND ID_MODUL IN (${placeholders})`;
            const accessRes = await db.execute(accessSql, bindParams);
            accessRes.rows.forEach(row => { accessMap[Number(row.ID_MODUL)] = (row.DREPT || "").toUpperCase(); });
        }

        const allowedModules = modulesConfig.filter((mod) => {
            if (Array.isArray(mod.requiredRoles) && mod.requiredRoles.length > 0) {
                if (roleId === null || !mod.requiredRoles.includes(roleId)) return false;
            }
            if (mod.oracleModuleId === null) return true;
            const drept = accessMap[mod.oracleModuleId];
            const min = mod.minPermission || "R";
            return min === "W" ? drept === "W" : (drept === "R" || drept === "W");
        }).map((mod) => ({
            key: mod.key,
            label: mod.label,
            path: mod.path,
            visible: mod.visible !== false
        }));

        logUserAction(userId, "USER_PROFILE", "Accesare profil utilizator");
        res.json({ success: true, modules: allowedModules });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * 2. GET /api/profile?userId=...
 * Date user + Verificare PDF (Cale corectată)
 */
router.get("/profile", async (req, res) => {
    const userId = Number(req.query.userId || 0);
    
    // Logăm accesarea profilului

    try {
        // 1. Luăm datele userului
        const userRes = await db.execute(
            "SELECT ID, USERNAME, ID_ROLE, ID_PENITENTIAR FROM USERS WHERE ID = :id", 
            { id: userId }
        );
        
        if (!userRes.rows.length) return res.status(404).json({ success: false });
        const userRow = userRes.rows[0];

        // 2. Verificăm Proof PDF pe disc
        const proofPath = path.join(process.cwd(), 'uploads', 'users', String(userId), 'proof.pdf');
        const hasProof = fs.existsSync(proofPath);

        // 3. Luăm logurile - CORECTAT pentru Case Sensitivity
        // Folosim UPPER pentru a ne asigura că match-ul se face indiferent de cum a fost scris username-ul în logs
        const logsSql = `
            SELECT * FROM (
                SELECT ACTION, E_DATE, DETINUT 
                FROM PRISON.USER_LOGS 
                WHERE UPPER(USERNAME) = UPPER(:u) 
                ORDER BY E_DATE DESC
            ) WHERE ROWNUM <= 15
        `;

        const logsRes = await db.execute(logsSql, { u: userRow.USERNAME });

        // 4. Luăm permisiunile
        const permRes = await db.execute(
            "SELECT m.NAME, a.DREPT FROM PRISON.SPR_MODULES m LEFT JOIN PRISON.SPR_ACCESS a ON a.ID_MODUL = m.ID AND a.ID_USER = :v_uid ORDER BY m.NAME",
            { v_uid: userId }
        );

        // 5. Trimitem răspunsul mapat corect
        // Atenție: Ne asigurăm că proprietățile trimise (action, date, detinut) 
        // corespund cu ce randează funcția ta renderProfile din frontend.
        res.json({
            success: true,
            user: { 
                id: Number(userRow.ID), 
                username: userRow.USERNAME, 
                role: userRow.ID_ROLE, 
                prison: userRow.ID_PENITENTIAR, 
                hasProof 
            },
            // Mapăm manual rândurile pentru a fi siguri de nume (case-insensitive)
            logs: logsRes.rows.map(row => ({
                ACTION: row.ACTION,
                E_DATE: row.E_DATE,
                DETINUT: row.DETINUT
            })),
            permissions: permRes.rows
        });

    } catch (err) { 
        console.error("Eroare Profil:", err);
        res.status(500).json({ success: false, error: err.message }); 
    }
});

/**
 * 3. GET /api/profile/proof?userId=...
 */
router.get("/profile/proof", (req, res) => {
    const userId = req.query.userId;
    const filePath = path.join(process.cwd(), 'uploads', 'users', String(userId), 'proof.pdf');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("Fișierul nu a fost găsit pe disk.");
    }
});

module.exports = router;