// src/routes/search.js
const express = require("express");
const db = require("../db");
const router = express.Router();

router.post("/search/detinuti", async (req, res) => {
  const { surname, name, secName, idnp, birth, id } = req.body;
  const maxRows = 20;

  // Updated SQL: Check for existence of Type 1 (Frontal) photo only
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
        img.IMAGE_TYPE AS HAS_PHOTO, 
        ROW_NUMBER() OVER (ORDER BY v.SURNAME, v.NAME, v.IDNP) AS RN
      FROM PRISON.V_DETINUTI_STATUT v
      LEFT JOIN (
        SELECT idnp, id_penetenciar, id_type_miscari
        FROM (
          SELECT idnp, id_penetenciar, id_type_miscari, adate, id,
                 ROW_NUMBER() OVER (PARTITION BY idnp ORDER BY adate DESC, id DESC) AS rn
          FROM PRISON.MISCARI
        )
        WHERE rn = 1
      ) lm ON lm.idnp = v.idnp
      LEFT JOIN (
          SELECT DETINUT_ID, IMAGE_TYPE FROM PRISON.IMAGES WHERE IMAGE_TYPE = 1
      ) img ON img.DETINUT_ID = v.ID
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

  const binds = {
    surname: surname ? `%${surname.toUpperCase()}%` : null,
    name: name ? `%${name.toUpperCase()}%` : null,
    secName: secName ? `%${secName.toUpperCase()}%` : null,
    idnp: idnp ? `%${idnp}%` : null,
    id: id ? `%${id}%` : null,
    birth: birth || null,
    maxRows
  };

  try {
    const result = await db.execute(sql, binds);
    const rows = result.rows || [];

    // Helper maps
    let pens = {};
    if (rows.length) {
      const pRes = await db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR");
      (pRes.rows || []).forEach((r) => (pens[r.ID] = r.NAME));
    }

    const items = rows.map((row) => {
      const penName = pens[row.LAST_PEN] || "Necunoscut";
      let miscareText = `Ultima mișcare: ${penName}`;
      if (row.LAST_TYPE === 1) miscareText += " (Intrare)";
      if (row.LAST_TYPE === 2) miscareText += " (Ieșire)";

      return {
        id: Number(row.ID),
        idnp: String(row.IDNP || ""),
        surname: String(row.SURNAME || ""),
        name: String(row.NAME || ""),
        secName: String(row.SEC_NAME || ""),
        birth: String(row.BIRDTH_STR || ""),
        statut: String(row.STATUT || ""),
        hasPhoto: !!row.HAS_PHOTO, // Boolean flag
        miscareText
      };
    });

    res.json({
      success: true,
      maxRows,
      count: items.length,
      results: items
    });
  } catch (err) {
    console.error("Error in /api/search/detinuti:", err);
    res.status(500).json({ success: false, error: "Eroare internă la căutare." });
  }
});

module.exports = router;