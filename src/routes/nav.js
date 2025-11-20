// src/routes/nav.js
const express = require("express");
const db = require("../db");
const modulesConfig = require("../modulesConfig");

const router = express.Router();

/**
 * GET /api/nav?userId=123
 */
router.get("/nav", async (req, res) => {
  const userId = Number(req.query.userId || 0);

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Parametrul userId este obligatoriu."
    });
  }

  try {
    // 1) Load user (ID_ROLE)
    const userSql =
      "SELECT ID, USERNAME, ID_ROLE " +
      "FROM USERS " +
      "WHERE ID = :id";
    const userResult = await db.execute(userSql, { id: userId }, {});
    const userRows = userResult.rows || [];

    if (!userRows.length) {
      return res.status(401).json({
        success: false,
        error: "Utilizator inexistent sau invalid."
      });
    }

    const userRow = userRows[0];
    const roleId =
      userRow.ID_ROLE !== null && userRow.ID_ROLE !== undefined
        ? Number(userRow.ID_ROLE)
        : null;

    // 2) Prepare list of module IDs that need SPR_ACCESS check
    const moduleIds = modulesConfig
      .map((m) => m.oracleModuleId)
      .filter((id) => id !== null && id !== undefined);

    let accessMap = {};

    if (moduleIds.length > 0) {
      const bindParams = { userId: userId };
      const placeholders = moduleIds
        .map((id, idx) => {
          const name = `m${idx}`;
          bindParams[name] = id;
          return `:${name}`;
        })
        .join(",");

      const accessSql =
        "SELECT ID_MODUL, DREPT " +
        "FROM SPR_ACCESS " +
        "WHERE ID_USER = :userId " +
        `  AND ID_MODUL IN (${placeholders})`;

      const accessResult = await db.execute(accessSql, bindParams, {});
      const accessRows = accessResult.rows || [];

      accessRows.forEach((row) => {
        const modId = Number(row.ID_MODUL);
        const drept = String(row.DREPT || "").toUpperCase();
        accessMap[modId] = drept; // 'R' or 'W'
      });
    }

    function hasMinPermission(minPermission, drept) {
      if (!drept) return false;
      drept = drept.toUpperCase();
      if (minPermission === "W") {
        return drept === "W";
      }
      // minPermission === "R"
      return drept === "R" || drept === "W";
    }

    const allowedModules = modulesConfig
      .filter((mod) => {
        // Check role requirement first
        if (Array.isArray(mod.requiredRoles) && mod.requiredRoles.length > 0) {
          if (roleId === null || !mod.requiredRoles.includes(roleId)) {
            return false;
          }
        }

        // If no oracleModuleId, rely only on role
        if (mod.oracleModuleId === null) {
          return true;
        }

        const drept = accessMap[mod.oracleModuleId];
        return hasMinPermission(mod.minPermission || "R", drept);
      })
      .map((mod) => ({
        key: mod.key,
        label: mod.label,
        path: mod.path,
        minPermission: mod.minPermission,
        oracleModuleId: mod.oracleModuleId
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
    console.error("Error in /api/nav:", err);
    return res.status(500).json({
      success: false,
      error: "Eroare internă la generarea meniului."
    });
  }
});

module.exports = router;
