// src/routes/nav.js
const express = require("express");
const db = require("../../db");
const modulesConfig = require("../../modulesConfig");

const router = express.Router();

router.get("/nav", async (req, res) => {
  const userId = Number(req.query.userId || 0);

  if (!userId) {
    return res.status(400).json({ success: false, error: "UserId lipsă." });
  }

  try {
    // 1) Load user role
    const userSql = "SELECT ID, USERNAME, ID_ROLE FROM USERS WHERE ID = :id";
    const userResult = await db.execute(userSql, { id: userId });
    
    if (!userResult.rows || !userResult.rows.length) {
      return res.status(401).json({ success: false, error: "Utilizator invalid." });
    }

    const userRow = userResult.rows[0];
    const roleId = userRow.ID_ROLE != null ? Number(userRow.ID_ROLE) : null;

    // 2) Load permissions
    const moduleIds = modulesConfig
      .map(m => m.oracleModuleId)
      .filter(id => id != null);

    let accessMap = {};

    if (moduleIds.length > 0) {
      // Build IN clause
      const bindParams = { userId };
      const placeholders = moduleIds.map((id, idx) => {
         bindParams[`m${idx}`] = id;
         return `:m${idx}`;
      }).join(",");

      const accessSql = `SELECT ID_MODUL, DREPT FROM SPR_ACCESS WHERE ID_USER = :userId AND ID_MODUL IN (${placeholders})`;
      const accessRes = await db.execute(accessSql, bindParams);
      
      (accessRes.rows || []).forEach(row => {
        accessMap[Number(row.ID_MODUL)] = (row.DREPT || "").toUpperCase();
      });
    }

    function hasMinPermission(min, actual) {
      if (!actual) return false;
      if (min === "W") return actual === "W";
      return actual === "R" || actual === "W";
    }

    // 3) Filter allowed modules
    const allowedModules = modulesConfig
      .filter((mod) => {
        // CHANGED: We DO NOT return false here for invisible modules.
        // We only filter if the User lacks the Role or Permission.

        // Role check
        if (Array.isArray(mod.requiredRoles) && mod.requiredRoles.length > 0) {
          if (roleId === null || !mod.requiredRoles.includes(roleId)) {
            return false;
          }
        }
        
        // Permission check
        if (mod.oracleModuleId === null) return true;
        const drept = accessMap[mod.oracleModuleId];
        return hasMinPermission(mod.minPermission || "R", drept);
      })
      .map((mod) => ({
        key: mod.key,
        label: mod.label,
        path: mod.path,
        visible: mod.visible !== false // Pass visibility to frontend
      }));

    return res.json({
      success: true,
      user: {
        id: Number(userRow.ID),
        username: String(userRow.USERNAME),
        id_role: roleId
      },
      modules: allowedModules
    });

  } catch (err) {
    console.error("Nav Error:", err);
    return res.status(500).json({ success: false, error: "Eroare meniu." });
  }
});

module.exports = router;