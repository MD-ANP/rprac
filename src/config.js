// src/config.js

module.exports = {
  port: process.env.PORT || 3000,

  // Oracle 11g connection
  dbUser: process.env.DB_USER || "PRISON",
  dbPassword: process.env.DB_PASSWORD || "ANP35",
  dbConnectString:
    process.env.DB_CONNECT_STRING ||
    "(DESCRIPTION=(ADDRESS=(PROTOCOL=tcp)(HOST=10.0.0.200)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=XEPDB1)))",

  // Login security
  loginCooldownMinutes: 15,
  loginMaxFailedAttempts: 5
};
