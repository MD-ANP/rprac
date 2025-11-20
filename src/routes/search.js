// src/routes/search.js
const express = require("express");
const db = require("../db");

const router = express.Router();

/**
 * POST /api/search/detinuti
 *
 * Body JSON:
 *  {
 *    surname: string,
 *    name: string,
 *    secName: string,
 *    idnp: string,
 *    birth: "DD.MM.YYYY",
 *    id: string
 *  }
 *
 * Returns up to maxRows results, with last movement info.
 */
router.post("/search/detinuti", async (req, res) => {
  const body = req.body || {};

  let surname  = (body.surname  || "").trim();
  let name     = (body.name     || "").trim();
  let secName  = (body.secName  || "").trim();
  let idnp     = (body.idnp     || "").trim();
  let birth    = (body.birth    || "").trim();
  let id       = (body.id       || "").trim();

  // Normalize to uppercase (DB columns are uppercase, keeps indexes usable)
  if (surname) surname = surname.toUpperCase();
  if (name)    name    = name.toUpperCase();
  if (secName) secName = secName.toUpperCase();

  const hasAny =
    surname || name || secName || idnp || birth || id;

  if (!hasAny) {
    return res.status(400).json({
      success: false,
      error: "Introduceți cel puțin un criteriu de căutare."
    });
  }

  if (birth) {
    // Very light validation for DD.MM.YYYY
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(birth)) {
      return res.status(400).json({
        success: false,
        error: "Data nașterii trebuie să fie în formatul ZZ.LL.AAAA."
      });
    }
  } else {
    birth = null;
  }

  const maxRows = 200; // hard cap for performance

  const binds = {
    surname: surname ? surname + "%" : null,
    name:    name    ? name    + "%" : null,
    secName: secName ? secName + "%" : null,
    idnp:    idnp    ? idnp    + "%" : null,
    id:      id      ? id      + "%" : null,
    birth,
    maxRows
  };

  const sql = `
    SELECT *
    FROM (
      SELECT
        v.ID,
        v.IDNP,
        v.SURNAME,
        v.NAME,
        v.SEC_NAME,
        TO_CHAR(v.BIRDTH, 'DD.MM.YYYY') AS BIRDTH_STR,
        v.STATUT,
        lm.id_penetenciar AS LAST_PEN,
        lm.id_type_miscari AS LAST_TYPE,
        ROW_NUMBER() OVER (ORDER BY v.SURNAME, v.NAME, v.IDNP) AS RN
      FROM PRISON.V_DETINUTI_STATUT v
      LEFT JOIN (
        SELECT idnp, id_penetenciar, id_type_miscari
        FROM (
          SELECT
            idnp,
            id_penetenciar,
            id_type_miscari,
            adate,
            id,
            ROW_NUMBER() OVER (PARTITION BY idnp ORDER BY adate DESC, id DESC) AS rn
          FROM PRISON.MISCARI
        )
        WHERE rn = 1
      ) lm ON lm.idnp = v.idnp
      WHERE 1=1
        AND (:surname IS NULL OR v.SURNAME  LIKE :surname)
        AND (:name    IS NULL OR v.NAME     LIKE :name)
        AND (:secName IS NULL OR v.SEC_NAME LIKE :secName)
        AND (:idnp    IS NULL OR v.IDNP     LIKE :idnp)
        AND (:id      IS NULL OR TO_CHAR(v.ID) LIKE :id)
        AND (:birth   IS NULL OR v.BIRDTH = TO_DATE(:birth, 'DD.MM.YYYY'))
    )
    WHERE RN <= :maxRows
  `;

  const typeMap = {
    1: "SOSIT",
    2: "PLECAT",
    3: "TRANZIT",
    4: "ELIBERAT",
    7: "TRANSFER ALT STAT",
    8: "EXTRADAT",
    9: "IN CAUTARE",
    5: "DECES",
    6: "EVADAT"
  };

  try {
    const result = await db.execute(sql, binds, {});
    const rows = result.rows || [];

    const items = rows.map((row) => {
      const lastTypeId = row.LAST_TYPE != null ? Number(row.LAST_TYPE) : null;
      const lastTypeLabel = lastTypeId != null && typeMap[lastTypeId]
        ? typeMap[lastTypeId]
        : "NECUNOSCUT";

      const pen = row.LAST_PEN != null ? String(row.LAST_PEN) : "";
      const miscareText = pen
        ? `Penitenciar: ${pen} - ${lastTypeLabel}`
        : lastTypeLabel;

      return {
        id: Number(row.ID),
        idnp: String(row.IDNP || ""),
        surname: String(row.SURNAME || ""),
        name: String(row.NAME || ""),
        secName: String(row.SEC_NAME || ""),
        birth: String(row.BIRDTH_STR || ""),
        statut: String(row.STATUT || ""),
        lastPen: pen,
        lastTypeId: lastTypeId,
        lastTypeLabel,
        miscareText
      };
    });

    return res.json({
      success: true,
      maxRows,
      count: items.length,
      results: items
    });
  } catch (err) {
    console.error("Error in /api/search/detinuti:", err);
    return res.status(500).json({
      success: false,
      error: "Eroare internă la căutare."
    });
  }
});

module.exports = router;
