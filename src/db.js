// src/db.js
const oracledb = require("oracledb");
const config = require("./config");

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Optional: get DATEs as strings if you want
// oracledb.fetchAsString = [oracledb.DATE];

let pool = null;

async function initPool() {
  if (pool) return pool;

  // If you use Instant Client on Windows/Linux:
  // oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_19_17" });

  pool = await oracledb.createPool({
    user: config.dbUser,
    password: config.dbPassword,
    connectString: config.dbConnectString,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1
  });

  console.log("Oracle pool created");
  return pool;
}

async function getConnection() {
  const p = await initPool();
  const conn = await p.getConnection();

  // Match legacy NLS date format
  await conn.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'DD.MM.YYYY'");

  return conn;
}

async function execute(sql, binds = {}, options = {}) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(sql, binds, options);
    return result;
  } finally {
    try {
      await conn.close();
    } catch (err) {
      console.error("Error closing connection:", err);
    }
  }
}

module.exports = {
  initPool,
  getConnection,
  execute
};
