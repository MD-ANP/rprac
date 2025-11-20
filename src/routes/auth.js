// src/routes/auth.js
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../db");
const config = require("../config");

const router = express.Router();

/**
 * Legacy password verification:
 * - plain text match
 * - bcrypt ($2*... 60 chars)
 * - MD5 (32 hex chars)
 */
function verifyPasswordLegacy(input, dbHash) {
  if (!dbHash) return false;
  input = String(input);
  dbHash = String(dbHash);

  // Plain text
  if (input === dbHash) return true;

  // bcrypt
  if (dbHash.length === 60 && dbHash.startsWith("$2")) {
    try {
      return bcrypt.compareSync(input, dbHash);
    } catch {
      return false;
    }
  }

  // MD5
  if (dbHash.length === 32 && /^[a-fA-F0-9]{32}$/.test(dbHash)) {
    const md5 = crypto.createHash("md5").update(input, "utf8").digest("hex");
    return md5.toLowerCase() === dbHash.toLowerCase();
  }

  return false;
}

async function logUserAction(username, action, detail) {
  const safeUser = String(username || "").substring(0, 30);
  const safeDetail = String(detail || "").substring(0, 50);

  const sql =
    "INSERT INTO USER_LOGS (USERNAME, ACTION, E_DATE, DETINUT) " +
    "VALUES (:u, :a, SYSDATE, :d)";

  try {
    await db.execute(
      sql,
      { u: safeUser, a: action, d: safeDetail },
      { autoCommit: true }
    );
  } catch (err) {
    console.error("USER_LOGS insert failed:", err);
  }
}

async function isLoginBlocked(username) {
  const intervalDays = config.loginCooldownMinutes / (60 * 24); // minutes -> fraction of day

  const sql =
    "SELECT COUNT(*) AS CNT " +
    "FROM USER_LOGS " +
    "WHERE USERNAME = :u " +
    "  AND ACTION = 'LOGIN_FAIL' " +
    "  AND E_DATE >= SYSDATE - :intervalDays";

  try {
    const result = await db.execute(
      sql,
      { u: username, intervalDays },
      {}
    );
    const rows = result.rows || [];
    const count = rows.length ? Number(rows[0].CNT) : 0;
    return {
      blocked: count >= config.loginMaxFailedAttempts,
      failedCount: count
    };
  } catch (err) {
    console.error("Cooldown check failed:", err);
    return { blocked: false, failedCount: 0 };
  }
}

/**
 * GET /api/motives
 * Load SPR_MOTIV_ACCESS for dropdown.
 */
router.get("/motives", async (req, res) => {
  try {
    const sql =
      "SELECT ID, TEXT " +
      "FROM SPR_MOTIV_ACCESS " +
      "ORDER BY TEXT";
    const result = await db.execute(sql, {}, {});
    const motives = (result.rows || []).map((row) => ({
      id: Number(row.ID),
      text: String(row.TEXT || "")
    }));

    res.json({
      success: true,
      motives
    });
  } catch (err) {
    console.error("SPR_MOTIV_ACCESS query failed:", err);
    res.status(500).json({
      success: false,
      error: "Nu s-au putut încărca motivele de acces."
    });
  }
});

/**
 * POST /api/login
 * Body: { username, password, motivId }
 */
router.post("/login", async (req, res) => {
  const usernameRaw = (req.body.username || "").trim();
  const password = String(req.body.password || "");
  const motivId = Number(req.body.motivId || 0);

  if (!usernameRaw || !password || !motivId) {
    return res.status(400).json({
      success: false,
      error: "Utilizator, parolă și motiv acces sunt obligatorii."
    });
  }

  // Adjust if your DB stores usernames uppercased
  const username = usernameRaw; // or usernameRaw.toUpperCase();

  // Cooldown check
  const { blocked } = await isLoginBlocked(username);
  if (blocked) {
    await logUserAction(
      username,
      "LOGIN_BLOCKED",
      "Cooldown after too many failed attempts"
    );
    return res.status(429).json({
      success: false,
      error: "Prea multe încercări eșuate. Așteptați înainte de a reîncerca.",
      code: "COOLDOWN",
      retryAfterMinutes: config.loginCooldownMinutes
    });
  }

  try {
    // 1. Load user
    const userSql =
      "SELECT ID, USERNAME, PASSWD, ID_PENITENTIAR, ID_ROLE " +
      "FROM USERS " +
      "WHERE USERNAME = :u";

    const userResult = await db.execute(userSql, { u: username }, {});
    const userRows = userResult.rows || [];

    if (!userRows.length) {
      await logUserAction(username, "LOGIN_FAIL", "Invalid username or password");
      return res.status(401).json({
        success: false,
        error: "Utilizator sau parolă incorectă."
      });
    }

    const userRow = userRows[0];
    const dbHash = userRow.PASSWD || "";

    if (!verifyPasswordLegacy(password, dbHash)) {
      await logUserAction(username, "LOGIN_FAIL", "Invalid username or password");
      return res.status(401).json({
        success: false,
        error: "Utilizator sau parolă incorectă."
      });
    }

    // 2. Load motive text
    const motivSql = "SELECT TEXT FROM SPR_MOTIV_ACCESS WHERE ID = :id";
    const motivResult = await db.execute(motivSql, { id: motivId }, {});
    const motivRows = motivResult.rows || [];

    if (!motivRows.length || !motivRows[0].TEXT) {
      return res.status(400).json({
        success: false,
        error: "Motiv de acces invalid."
      });
    }

    const motivText = String(motivRows[0].TEXT);

    // 3. Update USERS: LAST_LOGIN + NOTES
    const updateSql =
      "UPDATE USERS " +
      "SET LAST_LOGIN = SYSDATE, " +
      "    NOTES = :note " +
      "WHERE ID = :id";

    await db.execute(
      updateSql,
      {
        note: motivText.substring(0, 50), // NOTES is VARCHAR2(50)
        id: userRow.ID
      },
      { autoCommit: true }
    );

    // 4. Log success
    await logUserAction(username, "LOGIN_OK", motivText);

    // 5. Return user payload
    const userPayload = {
      id: Number(userRow.ID),
      username: String(userRow.USERNAME),
      id_penitentiary: userRow.ID_PENITENTIAR != null ? Number(userRow.ID_PENITENTIAR) : null,
      id_role: userRow.ID_ROLE != null ? Number(userRow.ID_ROLE) : null
    };

    return res.json({
      success: true,
      user: userPayload
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      error: "Eroare internă la autentificare."
    });
  }
});

module.exports = router;
