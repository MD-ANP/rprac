const express = require("express");
const db = require("../db");

const router = express.Router();

/** Simple admin guard: requires x-user-id and role 7 */
async function adminGuard(req, res, next) {
  const uid = Number(req.header("x-user-id") || req.header("X-User-Id"));
  if (!uid) return res.status(401).json({ success: false, error: "Neautorizat." });

  try {
    const r = await db.execute(
      "SELECT ID_ROLE FROM USERS WHERE ID = :id",
      { id: uid }
    );
    if (!r.rows || !r.rows.length) {
      return res.status(401).json({ success: false, error: "Utilizator inexistent." });
    }
    const roleId = Number(r.rows[0].ID_ROLE);
    if (roleId !== 7) {
      return res.status(403).json({ success: false, error: "Acces interzis (rol ≠ 7)." });
    }
    req.adminId = uid;
    next();
  } catch (err) {
    console.error("adminGuard:", err);
    res.status(500).json({ success: false, error: "Eroare internă." });
  }
}

router.use(adminGuard);

/** GET /api/admin/meta -> roles + penitenciars */
router.get("/admin/meta", async (req, res) => {
  try {
    const rolesRes = await db.execute(
      "SELECT ID, NAME FROM SPR_ROLES ORDER BY NAME"
    );
    const penRes = await db.execute(
      "SELECT ID, NAME FROM SPR_PENITENCIAR ORDER BY NAME"
    );

    res.json({
      success: true,
      roles: (rolesRes.rows || []).map(r => ({ id: Number(r.ID), name: r.NAME })),
      penitenciars: (penRes.rows || []).map(r => ({ id: Number(r.ID), name: r.NAME }))
    });
  } catch (err) {
    console.error("/admin/meta:", err);
    res.status(500).json({ success: false, error: "Eroare meta." });
  }
});

/** GET /api/admin/stats/users -> Statistics for the new tab */
router.get("/admin/stats/users", async (req, res) => {
  try {
    // 1. User Counters
    // Active: Login < 3 months
    // Deactivated: Name contains 'INACTIV'
    // Inactive: Not deactivated, but login > 3 months or never
    const sqlCounters = `
      SELECT
        SUM(CASE WHEN LAST_LOGIN >= ADD_MONTHS(SYSDATE,-3) THEN 1 ELSE 0 END) AS ACTIVE_CNT,
        SUM(CASE WHEN INSTR(UPPER(NVL(USERNAME,'')),'INACTIV')>0 THEN 1 ELSE 0 END) AS DEACTIVATED_CNT,
        SUM(CASE WHEN INSTR(UPPER(NVL(USERNAME,'')),'INACTIV')=0
                 AND (LAST_LOGIN IS NULL OR LAST_LOGIN < ADD_MONTHS(SYSDATE,-3))
                THEN 1 ELSE 0 END) AS INACTIVE_CNT
      FROM USERS
    `;
    const r1 = await db.execute(sqlCounters);
    const row1 = r1.rows && r1.rows[0] ? r1.rows[0] : {};

    // 2. Users by Penitentiary (checking non-zero counts)
    const sqlDist = `
      SELECT sp.NAME AS PENITENCIAR, COUNT(u.ID) AS CNT
      FROM SPR_PENITENCIAR sp
      LEFT JOIN USERS u ON u.ID_PENITENTIAR = sp.ID
      GROUP BY sp.NAME
      HAVING COUNT(u.ID) > 0
      ORDER BY sp.NAME
    `;
    const r2 = await db.execute(sqlDist);
    const dist = (r2.rows || []).map(r => ({ label: r.PENITENCIAR, count: Number(r.CNT) }));

    res.json({
      success: true,
      counters: {
        active: Number(row1.ACTIVE_CNT || 0),
        deactivated: Number(row1.DEACTIVATED_CNT || 0),
        inactive: Number(row1.INACTIVE_CNT || 0)
      },
      distribution: dist
    });
  } catch (err) {
    console.error("/admin/stats/users:", err);
    res.status(500).json({ success: false, error: "Eroare statistici." });
  }
});

function genPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** POST /api/admin/user/create */
router.post("/admin/user/create", async (req, res) => {
  try {
    let { username, password, autoPassword, roleId, penitenciarId } = req.body || {};
    username = (username || "").trim().toLowerCase();
    password = (password || "").trim();
    const autoPass = !!autoPassword;
    const role = Number(roleId);
    const pen = Number(penitenciarId);

    // FIX: Check isNaN to allow 0 (ANP)
    if (!username || (!password && !autoPass) || isNaN(role) || isNaN(pen)) {
      return res.status(400).json({
        success: false,
        error: "Username, rol, penitenciar și parolă / auto-parolă obligatorii."
      });
    }
    if (autoPass) password = genPassword(10);

    await db.execute(
      `INSERT INTO USERS (USERNAME, PASSWD, ID_ROLE, ID_PENITENTIAR, USERTYPE, USERDATE)
       VALUES (:u, :p, :r, :pen, 1, SYSDATE)`,
      { u: username, p: password, r: role, pen },
      { autoCommit: true }
    );

    res.json({
      success: true,
      username,
      autoPassword: autoPass ? password : null
    });
  } catch (err) {
    console.error("/admin/user/create:", err);
    res.status(500).json({ success: false, error: "Eroare la crearea utilizatorului." });
  }
});

/** POST /api/admin/user/bulk */
router.post("/admin/user/bulk", async (req, res) => {
  let conn;
  try {
    let { usernamesText, roleId, penitenciarId, autoPassword, samePassword } = req.body || {};
    const blob = (usernamesText || "").trim();
    const role = Number(roleId);
    const pen = Number(penitenciarId);
    const autoPass = !!autoPassword;
    const onePass = (samePassword || "").trim();

    // FIX: Check isNaN to allow 0
    if (!blob || isNaN(role) || isNaN(pen)) {
      return res.status(400).json({
        success: false,
        error: "Lista utilizatori, rol și penitenciar obligatorii."
      });
    }

    const list = blob
      .split(/[\r\n,;]+/)
      .map(v => v.trim().toLowerCase())
      .filter(v => v.length);

    if (!list.length) {
      return res.status(400).json({ success: false, error: "Nu există usernames valide." });
    }

    conn = await db.getConnection();
    let ok = 0, fail = 0;
    const report = [];

    for (const u of list) {
      let pwd = "";
      if (autoPass) pwd = genPassword(10);
      else if (onePass) pwd = onePass;
      else {
        fail++;
        report.push(`⨯ ${u} — lipsă parolă`);
        continue;
      }

      try {
        await conn.execute(
          `INSERT INTO USERS (USERNAME, PASSWD, ID_ROLE, ID_PENITENTIAR, USERTYPE, USERDATE)
           VALUES (:u, :p, :r, :pen, 1, SYSDATE)`,
          { u, p: pwd, r: role, pen }
        );
        ok++;
        report.push(autoPass ? `✓ ${u} — parolă: ${pwd}` : `✓ ${u}`);
      } catch (e) {
        fail++;
        report.push(`⨯ ${u} — ${e.message || "Eroare"}`);
      }
    }

    await conn.commit();
    res.json({ success: true, okCount: ok, failCount: fail, report });
  } catch (err) {
    console.error("/admin/user/bulk:", err);
    if (conn) try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ success: false, error: "Eroare la adăugarea în masă." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

/** GET /api/admin/user/search?q=... */
router.get("/admin/user/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim().toLowerCase();
    if (!q) {
      return res.status(400).json({ success: false, error: "Termen de căutare lipsă." });
    }
    const like = q + "%";
    const isNum = /^[0-9]+$/.test(q);
    let sql, binds = { term: like };
    if (isNum) {
      sql = `
        SELECT ID, USERNAME, PASSWD, ID_ROLE, ID_PENITENTIAR, LAST_LOGIN
        FROM USERS
        WHERE LOWER(USERNAME) LIKE :term OR ID = :id
        ORDER BY ID
      `;
      binds.id = Number(q);
    } else {
      sql = `
        SELECT ID, USERNAME, PASSWD, ID_ROLE, ID_PENITENTIAR, LAST_LOGIN
        FROM USERS
        WHERE LOWER(USERNAME) LIKE :term
        ORDER BY ID
      `;
    }

    const r = await db.execute(sql, binds);
    const users = (r.rows || []).map(row => ({
      id: Number(row.ID),
      username: row.USERNAME,
      password: row.PASSWD,
      roleId: Number(row.ID_ROLE),
      penitenciarId: Number(row.ID_PENITENTIAR),
      lastLogin: row.LAST_LOGIN || null
    }));
    res.json({ success: true, users });
  } catch (err) {
    console.error("/admin/user/search:", err);
    res.status(500).json({ success: false, error: "Eroare la căutare." });
  }
});

/** POST /api/admin/user/:id/update */
router.post("/admin/user/:id/update", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "ID invalid." });

    let { username, password, roleId, penitenciarId } = req.body || {};
    username = (username || "").trim().toLowerCase();
    password = (password || "").trim();
    const role = Number(roleId);
    const pen = Number(penitenciarId);
    
    // FIX: Check isNaN to allow 0
    if (!username || isNaN(role) || isNaN(pen)) {
      return res.status(400).json({ success: false, error: "Câmpuri obligatorii lipsă." });
    }

    let sql, binds;
    if (password) {
      sql = `
        UPDATE USERS
        SET USERNAME = :u, PASSWD = :p, ID_ROLE = :r, ID_PENITENTIAR = :pen
        WHERE ID = :id
      `;
      binds = { u: username, p: password, r: role, pen, id };
    } else {
      sql = `
        UPDATE USERS
        SET USERNAME = :u, ID_ROLE = :r, ID_PENITENTIAR = :pen
        WHERE ID = :id
      `;
      binds = { u: username, r: role, pen, id };
    }

    await db.execute(sql, binds, { autoCommit: true });
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/user/:id/update:", err);
    res.status(500).json({ success: false, error: "Eroare la actualizare." });
  }
});

/** POST /api/admin/user/:id/deactivate */
router.post("/admin/user/:id/deactivate", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "ID invalid." });

    const randomHex =
      Math.floor(100000000 + Math.random() * 900000000).toString(16) +
      Math.floor(100000000 + Math.random() * 900000000).toString(16);

    await db.execute(
      `UPDATE USERS
       SET USERNAME = 'INACTIV.' || USERNAME,
           PASSWD   = :p
       WHERE ID = :id`,
      { p: randomHex, id },
      { autoCommit: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/user/:id/deactivate:", err);
    res.status(500).json({ success: false, error: "Eroare la dezactivare." });
  }
});

/** GET /api/admin/user/:id/rights */
router.get("/admin/user/:id/rights", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "ID invalid." });

    const r = await db.execute(
      `
      SELECT
        m.ID   AS MODULE_ID,
        m.NAME AS MODULE_NAME,
        a.ID   AS ACCESS_ID,
        a.DREPT
      FROM SPR_MODULES m
      LEFT JOIN SPR_ACCESS a
        ON a.ID_MODUL = m.ID
        AND a.ID_USER  = :uid
      ORDER BY m.NAME
      `,
      { uid: id }
    );

    const modules = (r.rows || []).map(row => ({
      moduleId: Number(row.MODULE_ID),
      moduleName: row.MODULE_NAME,
      accessId: row.ACCESS_ID ? Number(row.ACCESS_ID) : null,
      drept: row.DREPT || "N"
    }));
    res.json({ success: true, modules });
  } catch (err) {
    console.error("/admin/user/:id/rights:", err);
    res.status(500).json({ success: false, error: "Eroare la încărcarea drepturilor." });
  }
});

/** POST /api/admin/user/:id/rights */
router.post("/admin/user/:id/rights", async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "ID invalid." });

    const rights = Array.isArray(req.body.rights) ? req.body.rights : [];
    if (!rights.length) {
      return res.status(400).json({ success: false, error: "Nu există drepturi de salvat." });
    }

    conn = await db.getConnection();

    for (const r of rights) {
      const modul = Number(r.moduleId);
      const drept = (r.drept || "N").toUpperCase();
      if (!modul || !["N", "R", "W"].includes(drept)) continue;

      const accessId = r.accessId ? Number(r.accessId) : null;
      if (!accessId && (drept === "R" || drept === "W")) {
        await conn.execute(
          `INSERT INTO PRISON.SPR_ACCESS (ID, ID_MODUL, ID_USER, DREPT)
           VALUES (PRISON.SPR_ACCESS_SEQ.NEXTVAL, :m, :u, :d)`,
          { m: modul, u: id, d: drept }
        );
      } else if (accessId && drept === "N") {
        await conn.execute(
          "DELETE FROM SPR_ACCESS WHERE ID = :id",
          { id: accessId }
        );
      } else if (accessId) {
        await conn.execute(
          "UPDATE SPR_ACCESS SET DREPT = :d WHERE ID = :id",
          { d: drept, id: accessId }
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/user/:id/rights:", err);
    if (conn) try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ success: false, error: "Eroare la salvarea drepturilor." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

/** Announcements */

// GET /api/admin/ann
router.get("/admin/ann", async (req, res) => {
  try {
    const r = await db.execute(
      "SELECT ID, MESAJ FROM PRISON.ANUNT ORDER BY ID DESC"
    );
    res.json({
      success: true,
      items: (r.rows || []).map(row => ({
        id: Number(row.ID),
        message: (row.MESAJ || "").trim()
      }))
    });
  } catch (err) {
    console.error("/admin/ann GET:", err);
    res.status(500).json({ success: false, error: "Eroare la încărcarea anunțurilor." });
  }
});

// POST /api/admin/ann
router.post("/admin/ann", async (req, res) => {
  try {
    const msg = (req.body.message || "").trim();
    if (!msg) {
      return res.status(400).json({ success: false, error: "Textul este gol." });
    }
    await db.execute(
      "INSERT INTO PRISON.ANUNT (ID, MESAJ) VALUES (ANUNT_SEQ.NEXTVAL, :m)",
      { m: msg },
      { autoCommit: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/ann POST:", err);
    res.status(500).json({ success: false, error: "Eroare la salvare." });
  }
});

// DELETE /api/admin/ann (all)
router.delete("/admin/ann", async (req, res) => {
  try {
    await db.execute("DELETE FROM PRISON.ANUNT", {}, { autoCommit: true });
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/ann DELETE all:", err);
    res.status(500).json({ success: false, error: "Eroare la ștergere." });
  }
});

// DELETE /api/admin/ann/:id
router.delete("/admin/ann/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "ID invalid." });

    await db.execute(
      "DELETE FROM PRISON.ANUNT WHERE ID = :id",
      { id },
      { autoCommit: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("/admin/ann/:id DELETE:", err);
    res.status(500).json({ success: false, error: "Eroare la ștergere." });
  }
});

module.exports = router;