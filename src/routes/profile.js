// src/routes/profile.js
const express = require("express");
const db = require("../db");

const router = express.Router();

/**
 * GET /api/profile?userId=123
 *
 * Returns:
 *  - user info (USERS)
 *  - last 40 USER_LOGS by USERNAME
 *  - permissions for all SPR_MODULES, based on SPR_ACCESS for this user
 */
router.get("/profile", async (req, res) => {
  const userId = Number(req.query.userId || 0);
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Parametrul userId este obligatoriu."
    });
  }

  try {
    // --- 1) User info ---
    let userRow;

    try {
      const userSql =
        "SELECT ID, USERNAME, ID_ROLE, ID_PENITENTIAR " +
        "FROM USERS " +
        "WHERE ID = :id";

      const userResult = await db.execute(userSql, { id: userId }, {});
      const userRows = userResult.rows || [];

      if (!userRows.length) {
        return res.status(404).json({
          success: false,
          error: "Utilizatorul nu a fost găsit."
        });
      }

      userRow = userRows[0];
    } catch (err) {
      console.error("USERS query failed in /api/profile:", err);
      return res.status(500).json({
        success: false,
        error: "Eroare internă la încărcarea utilizatorului."
      });
    }

    const username = String(userRow.USERNAME);

    // --- 2) Logs (last 40) ---
    let logs = [];
    try {
      const logsSql =
        "SELECT * FROM (" +
        "  SELECT USERNAME, ACTION, E_DATE, DETINUT " +
        "  FROM PRISON.USER_LOGS " +
        "  WHERE USERNAME = :u " +
        "  ORDER BY E_DATE DESC" +
        ") WHERE ROWNUM <= 10";

      const logsResult = await db.execute(logsSql, { u: username }, {});
      logs = (logsResult.rows || []).map((row) => ({
        username: String(row.USERNAME || ""),
        action: String(row.ACTION || ""),
        date: row.E_DATE,
        detail: String(row.DETINUT || "")
      }));
    } catch (err) {
      console.error("USER_LOGS query failed in /api/profile:", err);
      // logs stays []
    }

    // --- 3) Permissions (modules + SPR_ACCESS) ---
    let permissions = [];
    try {
      const permSql =
        "SELECT m.ID AS MODULE_ID, m.NAME AS MODULE_NAME, a.DREPT " +
        "FROM PRISON.SPR_MODULES m " +
        "LEFT JOIN PRISON.SPR_ACCESS a " +
        "  ON a.ID_MODUL = m.ID " +
        " AND a.ID_USER = :p_user_id " + // <--- bind name changed here
        "ORDER BY m.NAME";

      const permResult = await db.execute(permSql, { p_user_id: userId }, {});
      permissions = (permResult.rows || []).map((row) => {
        const dreptRaw = row.DREPT ? String(row.DREPT).toUpperCase() : null;
        let label = "Niciun Drept";
        if (dreptRaw === "W") label = "SCRIERE";
        else if (dreptRaw === "R") label = "Citire";

        return {
          moduleId: Number(row.MODULE_ID),
          moduleName: String(row.MODULE_NAME || ""),
          drept: dreptRaw, // 'R', 'W', null
          permissionLabel: label
        };
      });
    } catch (err) {
      console.error("SPR_MODULES/SPR_ACCESS query failed in /api/profile:", err);
      // permissions stays []
    }

    // --- 4) Successful JSON payload ---
    return res.json({
      success: true,
      user: {
        id: Number(userRow.ID),
        username,
        id_role:
          userRow.ID_ROLE !== null && userRow.ID_ROLE !== undefined
            ? Number(userRow.ID_ROLE)
            : null,
        id_penitentiary:
          userRow.ID_PENITENTIAR !== null &&
          userRow.ID_PENITENTIAR !== undefined
            ? Number(userRow.ID_PENITENTIAR)
            : null
      },
      logs,
      permissions
    });
  } catch (err) {
    console.error("Unexpected error in /api/profile:", err);
    return res.status(500).json({
      success: false,
      error: "Eroare internă la încărcarea profilului."
    });
  }
});

module.exports = router;
