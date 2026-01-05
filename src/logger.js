// src/utils/logger.js
const db = require("./db");

/**
 * Înregistrează o acțiune a utilizatorului în tabelul PRISON.USER_LOGS
 */
async function logUserAction(username, action, detail) {
  const safeUser = String(username || "").substring(0, 30);
  const safeDetail = String(detail || "").substring(0, 50);

  const sql =
    "INSERT INTO PRISON.USER_LOGS (USERNAME, ACTION, E_DATE, DETINUT) " +
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

module.exports = { logUserAction };