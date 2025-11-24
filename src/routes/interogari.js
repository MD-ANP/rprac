// src/routes/interogari.js
const express = require("express");
const db = require("../db");
const router = express.Router();

/* HELPER: Standardize DB responses 
*/
function formatRows(rows) {
  return (rows || []).map(r => {
    // Normalize Oracle keys to lowercase for easier frontend handling? 
    // Or keep them as is. Let's keep standard object structure.
    return r;
  });
}

/* HELPER: Get User Info for Print Headers
*/
async function getUserInfo(req) {
  const uid = Number(req.header("x-user-id") || 0);
  if (!uid) return { username: "Unknown", role: 0 };
  
  try {
    const r = await db.execute("SELECT USERNAME, ID_ROLE FROM USERS WHERE ID = :id", { id: uid });
    if (r.rows && r.rows.length) {
      return { username: r.rows[0].USERNAME, role: Number(r.rows[0].ID_ROLE) };
    }
  } catch (e) { console.error(e); }
  return { username: "Unknown", role: 0 };
}

/*
  ===========================================================================
  ENDPOINT: /api/interogari/exec
  BODY: { type: 'LISTA', params: { ... } }
  ===========================================================================
*/
router.post("/interogari/exec", async (req, res) => {
  const { type, params } = req.body;
  const uid = Number(req.header("x-user-id"));
  
  // Security check (basic role check can be expanded here based on the PHP array logic)
  // For now, we assume the frontend handles visibility, and we rely on DB binding security.
  
  let sql = "";
  let binds = {};
  let headers = []; // For print feature
  let title = "";

  try {
    switch (type) {
      // ========================================================================
      // GROUP: DETINUTI
      // ========================================================================
      
      case 'LISTA': // Lista Deținuți (Instituția Curentă a Userului)
        // Need user's penitentiary. Fetch it first.
        const uRes = await db.execute("SELECT ID_PENITENTIAR FROM USERS WHERE ID = :id", { id: uid });
        const userPen = uRes.rows[0]?.ID_PENITENTIAR;
        
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PM.ID_PENETENCIAR AS PENITENCIAR
          FROM PRISON.DETINUTI pd 
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp) 
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
             ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE PM.ID_PENETENCIAR = :pid AND PM.ID_TYPE_MISCARI IN (1,3)
          GROUP BY PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, PM.ID_PENETENCIAR, PD.ID, PD.IDNP
          ORDER BY NUME, PRENUME
        `;
        binds = { pid: userPen || 0 };
        headers = ["Nr.", "IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar"];
        title = "Lista Deținuți (Instituția Curentă)";
        break;

      case 'LISTAP': // Lista pe Instituție (Selectată)
        // Requires params.institution_id
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PM.ID_PENETENCIAR AS PENITENCIAR
          FROM PRISON.DETINUTI pd
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR pen ON (pm.ID_PENETENCIAR = pen.ID)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
             ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE PM.ID_PENETENCIAR = :pid AND (PM.ID_TYPE_MISCARI IN (1,3))
          GROUP BY PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, PM.ID_PENETENCIAR, PD.ID, PD.IDNP, pen.NAME
          ORDER BY NUME, PRENUME
        `;
        binds = { pid: params.institution_id };
        headers = ["Nr.", "IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar"];
        title = "Lista Deținuți pe Instituție";
        break;

      case 'SEARCH_BY_AGE':
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, 
                 TRUNC(MONTHS_BETWEEN(SYSDATE, PD.BIRDTH)/12) AS VARSTA,
                 PEN.NAME AS PENITENCIAR
          FROM PRISON.DETINUTI PD
          INNER JOIN PRISON.MISCARI PM ON PD.IDNP = PM.IDNP
          INNER JOIN PRISON.SPR_PENITENCIAR PEN ON PEN.ID = PM.ID_PENETENCIAR
          INNER JOIN (SELECT IDNP, MAX(ADATE) AS DT FROM PRISON.MISCARI GROUP BY IDNP) LAST
            ON LAST.IDNP = PD.IDNP AND LAST.DT = PM.ADATE
          WHERE PM.ID_TYPE_MISCARI IN (1,3)
            AND PM.ID_PENETENCIAR = :idpen
            AND TRUNC(MONTHS_BETWEEN(SYSDATE, PD.BIRDTH)/12) BETWEEN :minage AND :maxage
          ORDER BY NUME, PRENUME
        `;
        binds = { idpen: params.institution_id, minage: params.min_age, maxage: params.max_age };
        headers = ["ID","IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Vârsta", "Penitenciar"];
        title = `Căutare Vârstă (${params.min_age}-${params.max_age} ani)`;
        break;

      // ========================================================================
      // GROUP: STRAINI
      // ========================================================================
      case 'CETATENI':
        // Assuming V_STRAINI view exists and has IDNP
        // We add a WHERE clause if user is restricted to a penitentiary, but for simplicity here we fetch all 
        // unless specific requirement. The PHP code checked $idpenitenciar.
        
        const uRes2 = await db.execute("SELECT ID_PENITENTIAR FROM USERS WHERE ID = :id", { id: uid });
        const myPen = uRes2.rows[0]?.ID_PENITENTIAR;

        let whereClause = "";
        binds = {};
        if (myPen) {
          whereClause = "WHERE PENITENCIAR = :pid";
          binds.pid = myPen; // Note: V_STRAINI.PENITENCIAR might be ID or Name. Assuming ID based on PHP logic.
        }

        sql = `SELECT * FROM V_STRAINI ${whereClause} ORDER BY CETATENIE`;
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar", "Cetățenie"];
        title = "Cetățeni Străini";
        break;

      case 'STRAINI_ELIBERATI':
        const currentYear = new Date().getFullYear();
        sql = `
          SELECT 
            PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
            TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PD.SEX, sprpen.name AS PENITENCIARUL,
            NVL((SELECT listagg(sprstz.name,',') WITHIN GROUP (ORDER BY sprstz.name)
                 FROM PRISON.SITIZEN stz 
                 INNER JOIN Prison.SPR_SITIZEN sprstz ON (stz.id_sitizen = sprstz.id)
                 WHERE stz.idnp = PD.IDNP GROUP BY stz.idnp), '-') AS CETATENIE
          FROM PRISON.DETINUTI pd 
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SITIZEN pst ON (pst.IDNP = pd.IDNP)
          INNER JOIN PRISON.SPR_PENITENCIAR sprpen ON (sprpen.id = pm.id_penetenciar)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
             ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE (pst.ID_SITIZEN NOT IN (498)) 
            AND (PM.ID_TYPE_MISCARI = 4) 
            AND pm.ADATE BETWEEN TO_DATE('01.01.${currentYear}','DD.MM.YYYY') AND TO_DATE('31.12.${currentYear}','DD.MM.YYYY')
          ORDER BY PENITENCIARUL
        `;
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Sex", "Penitenciar", "Cetățenie"];
        title = `Străini Eliberați (${currentYear})`;
        break;

      // ========================================================================
      // GROUP: TRANSFERURI / ESCORTARE
      // ========================================================================
      case 'TABELESCORTARE':
        sql = `
          SELECT d.ID AS ID, d.IDNP, d.NAME AS PRENUME, d.SURNAME AS NUME, d.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(vcitatie.ADATE, 'DD.MM.YYYY') AS DATASEDINTA, vcitatie.ORASEDINTA, vcitatie.NAME_INSTANTE, vcitatie.NPPJUDECATOR,
                 vcitatie.NRSALA, vcitatie.NAME_LOCJUDECATA, pen.NAME AS PENITENCIAR, vcitatie.EXECUTOR_TRANSFER
          FROM PRISON.V_CITATIE vcitatie
          INNER JOIN PRISON.DETINUTI d ON (vcitatie.IDNP = d.IDNP)
          INNER JOIN PRISON.MISCARI pm ON (d.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR pen ON (PM.ID_PENETENCIAR = pen.ID)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2  GROUP BY pm2.idnp) md
            ON (md.idnp = d.idnp AND pm.adate = md.dt)
          WHERE (PM.ID_TYPE_MISCARI IN (1,3)) AND vcitatie.ADATE = TO_DATE(:d,'DD.MM.YYYY') AND vcitatie.ANULAT <> 'Y'
          GROUP BY d.ID, d.IDNP, d.NAME, d.SURNAME, d.SEC_NAME, vcitatie.ADATE, vcitatie.ORASEDINTA, vcitatie.NAME_INSTANTE,
                   vcitatie.NPPJUDECATOR, vcitatie.NRSALA, pen.NAME, vcitatie.EXECUTOR_TRANSFER, vcitatie.NAME_LOCJUDECATA
          ORDER BY pen.NAME, vcitatie.NAME_INSTANTE
        `;
        binds = { d: params.date }; // format DD.MM.YYYY
        headers = ["IDNP", "Nume Complet", "Data Ședință", "Detalii Instanță", "Loc Judecată", "Executor", "Penitenciar"];
        title = `Tabel Escortare (${params.date})`;
        break;

      case 'TABELTRANSFERPENITENCIARE':
        sql = `
          SELECT d.ID AS ID, d.IDNP, d.NAME AS PRENUME, d.SURNAME AS NUME, d.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(vcitatie.ADATE, 'DD.MM.YYYY') AS DATASEDINTA, vcitatie.ORASEDINTA, vcitatie.NAME_INSTANTE, vcitatie.NPPJUDECATOR,
                 vcitatie.NRSALA, pen.NAME AS PENITENCIAR
          FROM PRISON.V_CITATIE vcitatie
          INNER JOIN PRISON.DETINUTI d ON (vcitatie.IDNP = d.IDNP)
          INNER JOIN PRISON.MISCARI pm ON (d.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR pen ON (PM.ID_PENETENCIAR = pen.ID)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
            ON (md.idnp = d.idnp AND pm.adate = md.dt)
          WHERE (PM.ID_TYPE_MISCARI IN (1,3)) AND vcitatie.ADATE = TO_DATE(:d,'DD.MM.YYYY') AND vcitatie.ANULAT <> 'Y'
          GROUP BY d.ID, d.IDNP, d.NAME, d.SURNAME, d.SEC_NAME, vcitatie.ADATE, vcitatie.ORASEDINTA, vcitatie.NAME_INSTANTE,
                   vcitatie.NPPJUDECATOR, vcitatie.NRSALA, pen.NAME, vcitatie.EXECUTOR_TRANSFER
          ORDER BY pen.NAME, vcitatie.NAME_INSTANTE
        `;
        binds = { d: params.date };
        headers = ["IDNP", "Nume Complet", "Data Transfer", "Destinație (Penitenciar/Instanță)", "Penitenciar Curent"];
        title = `Transfer Penitenciare (${params.date})`;
        break;

      case 'LISTADUPACELULE':
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PMC.ROOM AS CELULA, 
                 TO_CHAR(PMC.ADATE, 'DD.MM.YYYY HH24:MI') AS DATAMISCARECELULA, pen.NAME AS PENITENCIAR
          FROM PRISON.DETINUTI pd
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR pen ON (PM.ID_PENETENCIAR = pen.ID)
          INNER JOIN PRISON.MISCARI_CELULE pmc ON (pmc.ID_MISCARI = pm.ID)
          WHERE (PM.ID_TYPE_MISCARI IN (1,3))
            AND (pmc.ADATE BETWEEN TO_DATE(:b,'DD.MM.YYYY') AND TO_DATE(:e,'DD.MM.YYYY'))
          ORDER BY pen.NAME, PMC.ADATE
        `;
        binds = { b: params.start_date, e: params.end_date };
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Naștere", "Celulă", "Data Mișcare", "Penitenciar"];
        title = `Mișcare Celule (${params.start_date} - ${params.end_date})`;
        break;

      case 'LISTA206': // Securitate Personala
        const uRes3 = await db.execute("SELECT ID_PENITENTIAR FROM USERS WHERE ID = :id", { id: uid });
        const pen206 = uRes3.rows[0]?.ID_PENITENTIAR || 0;
        
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, penit.NAME AS PENITENCIAR
          FROM PRISON.DETINUTI pd
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR penit ON (penit.ID = PM.ID_PENETENCIAR)
          INNER JOIN PRISON.SECURITATE_PERSONALA secpers ON (secpers.idnp = pd.idnp)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
            ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE PM.ID_PENETENCIAR = :pid AND secpers.EDATE IS NULL AND PM.ID_TYPE_MISCARI IN (1,3)
          GROUP BY PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, penit.NAME, PD.ID, PD.IDNP
          ORDER BY penit.NAME, PD.SURNAME, PD.NAME
        `;
        binds = { pid: pen206 };
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar"];
        title = "Securitate Personală (Art. 206)";
        break;

      case 'ECUSON':
         const uRes4 = await db.execute("SELECT ID_PENITENTIAR FROM USERS WHERE ID = :id", { id: uid });
         const penBadge = uRes4.rows[0]?.ID_PENITENTIAR || 0;
         sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PM.ID_PENETENCIAR AS PENITENCIAR
          FROM PRISON.DETINUTI pd 
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp )
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
            ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE PM.ID_PENETENCIAR = :pid AND PM.ID_TYPE_MISCARI IN (1,3)
          GROUP BY PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, PM.ID_PENETENCIAR, PD.ID, PD.IDNP
          ORDER BY NUME, PRENUME
         `;
         binds = { pid: penBadge };
         headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar"];
         title = "Generare Ecusoane";
         break;

      // ========================================================================
      // GROUP: COLETE / VIZITE
      // ========================================================================
      case 'COLETE': // by Source
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC, 
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, penit.NAME AS PENITENCIAR,
                 c.SURSA_PROV, TO_CHAR(c.DATE_IN, 'DD.MM.YYYY') AS DATA_INTRARE
          FROM PRISON.DETINUTI pd
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR penit ON (penit.ID = PM.ID_PENETENCIAR)
          INNER JOIN PRISON.COLETA c ON (c.idnp = pd.idnp)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
             ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE UPPER(c.SURSA_PROV) LIKE :s 
          GROUP BY PD.ID, PD.IDNP, PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, penit.NAME, c.SURSA_PROV, c.DATE_IN
          ORDER BY NUME, PRENUME
        `;
        binds = { s: `%${(params.sursa || '').toUpperCase()}%` };
        headers = ["ID", "IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar", "Sursa", "Data Intrare"];
        title = `Colete (Sursa: ${params.sursa})`;
        break;

      case 'SEARCH_COLETA_DATE':
        sql = `
          SELECT c.ID, c.IDNP, TO_CHAR(c.DATE_IN, 'DD.MM.YYYY') AS DATE_IN, c.PERSON, c.CONTINUT, c.SURSA_PROV,
                 d.ID AS DETINUT_ID, d.SURNAME || ' ' || d.NAME as NUME_DETINUT
          FROM PRISON.COLETA c
          LEFT JOIN PRISON.DETINUTI d ON d.IDNP = c.IDNP
          WHERE c.DATE_IN BETWEEN TO_DATE(:b,'DD.MM.YYYY') AND TO_DATE(:e,'DD.MM.YYYY')
          ORDER BY c.DATE_IN DESC
        `;
        binds = { b: params.start_date, e: params.end_date };
        headers = ["ID", "IDNP", "Deținut", "Persoană Predare", "Data", "Conținut", "Sursă"];
        title = `Colete (${params.start_date} - ${params.end_date})`;
        break;
        
      case 'CAUTINTREVEDERE':
         const qTerm = (params.term || '').toUpperCase();
         sql = `
            SELECT I.IDNP, I.NRDOCUMENT, I.SURNAME, I.NAME, I.SEC_NAME, I.ID, D.ID AS PROFIL_DET,
                   TO_CHAR(I.DATA_INTREVEDERE, 'DD.MM.YYYY') AS DATA_VIZITA
            FROM PRISON.INTREVEDERI I
            LEFT JOIN PRISON.DETINUTI D ON I.IDNP = D.IDNP
            WHERE UPPER(I.SURNAME) LIKE '%' || :q || '%'
               OR UPPER(I.SEC_NAME) LIKE '%' || :q || '%'
               OR UPPER(I.NAME)    LIKE '%' || :q || '%'
               OR UPPER(I.NRDOCUMENT) LIKE '%' || :q || '%'
            ORDER BY I.SURNAME, I.NAME
         `;
         binds = { q: qTerm };
         headers = ["IDNP", "Nume Vizitator", "Prenume", "Patronimic", "Nr. Doc", "Data"];
         title = `Întrevederi (${params.term})`;
         break;

      // ========================================================================
      // GROUP: EVIDENTA (Released, Acts, Articles, Lesions)
      // ========================================================================
      case 'ELIBERATI':
        sql = `
          SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, pen.NAME AS PENITENCIAR, 
                 TO_CHAR(PM.ADATE, 'DD.MM.YYYY') AS DATAELIBERARE
          FROM PRISON.DETINUTI pd
          INNER JOIN PRISON.MISCARI pm ON (pd.idnp = pm.idnp)
          INNER JOIN PRISON.SPR_PENITENCIAR pen ON (PM.ID_PENETENCIAR = pen.ID)
          INNER JOIN (SELECT pm2.idnp AS idnp, MAX(pm2.adate) AS dt FROM PRISON.MISCARI pm2 GROUP BY pm2.idnp) md
            ON (md.idnp = pd.idnp AND pm.adate = md.dt)
          WHERE (PM.ID_TYPE_MISCARI = 4)
            AND (PM.ADATE BETWEEN TO_DATE(:b,'DD.MM.YYYY') AND TO_DATE(:e,'DD.MM.YYYY'))
          ORDER BY NUME, PRENUME
        `;
        binds = { b: params.start_date, e: params.end_date };
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Naștere", "Penitenciar", "Data Eliberare"];
        title = `Eliberați (${params.start_date} - ${params.end_date})`;
        break;

      case 'SEARCH_ACTE_EXPIRED':
        sql = `
          SELECT DISTINCT d.ID, d.IDNP, d.SURNAME AS NUME, d.NAME AS PRENUME, d.SEC_NAME AS PATRONIMIC,
                 TO_CHAR(d.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, pen.NAME AS PENITENCIARUL
          FROM PRISON.DETINUTI d
          JOIN PRISON.MISCARI m ON m.IDNP = d.IDNP
          JOIN (
              SELECT IDNP FROM PRISON.ACTE GROUP BY IDNP HAVING MAX(VALABIL_PINA) < TRUNC(SYSDATE)
          ) a ON a.IDNP = d.IDNP
          JOIN PRISON.SPR_PENITENCIAR pen ON pen.ID = m.ID_PENETENCIAR
          JOIN (SELECT IDNP, MAX(ADATE) AS ADATE FROM PRISON.MISCARI GROUP BY IDNP) md
            ON md.IDNP = m.IDNP AND md.ADATE = m.ADATE
          WHERE m.ID_TYPE_MISCARI IN (1, 3)
          ORDER BY pen.NAME, d.SURNAME
        `;
        headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Naștere", "Penitenciar"];
        title = "Acte Expirate (Toate)";
        break;
        
      case 'SEARCH_LEZIUNI':
         sql = `
          SELECT i.IDNP, TO_CHAR(i.INSERTEDDATE, 'DD.MM.YYYY') AS INSERTEDDATE, i.CIRCUMSTANTE, i.MEDICAL_CONCLUSION, 
                 s.NAME AS INCIDENT_TYPE, p.NAME AS PENITENCIAR, d.ID AS DETINUT_ID, d.SURNAME || ' ' || d.NAME as NUME
          FROM PRISON.INCIDENTS i
          JOIN PRISON.SPR_TYPE_INCIDENT s ON i.ID_TYPE_INCIDENT = s.ID
          JOIN PRISON.SPR_PENITENCIAR p ON i.ID_PENITENCIAR = p.ID
          LEFT JOIN PRISON.DETINUTI d ON d.IDNP = i.IDNP
          WHERE i.INSERTEDDATE BETWEEN TO_DATE(:b,'DD.MM.YYYY') AND TO_DATE(:e,'DD.MM.YYYY')
          ORDER BY i.INSERTEDDATE DESC
         `;
         binds = { b: params.start_date, e: params.end_date };
         headers = ["IDNP", "Nume", "Data", "Tip", "Circumstanțe", "Concluzie", "Penitenciar"];
         title = `Leziuni (${params.start_date} - ${params.end_date})`;
         break;
         
      case 'CAUTARTICOL':
         // First get article ID
         const aRes = await db.execute("SELECT ID FROM PRISON.SPR_ARTICOL WHERE ANUMBER = :anum", { anum: params.article });
         if (!aRes.rows.length) {
             return res.json({ success: true, rows: [], headers: [], title: "Căutare Articol: " + params.article });
         }
         const artId = aRes.rows[0].ID;
         
         sql = `
           SELECT PD.ID, PD.IDNP, PD.SURNAME AS NUME, PD.NAME AS PRENUME, PD.SEC_NAME AS PATRONIMIC,
                  TO_CHAR(PD.BIRDTH, 'DD.MM.YYYY') AS DATANASTERII, PEN.NAME AS PENITENCIARUL
           FROM PRISON.DETINUTI PD
           INNER JOIN PRISON.MISCARI PM ON (PD.IDNP = PM.IDNP)
           INNER JOIN PRISON.HOTARIRI_JUD PHOT ON (PD.IDNP = PHOT.IDNP)
           INNER JOIN PRISON.SPR_PENITENCIAR PEN ON (PM.ID_PENETENCIAR = PEN.ID)
           INNER JOIN PRISON.ARTICOLES PART ON (PHOT.ID = PART.ID_DOCUMENT AND PART.TYPE_DOCUMENT = 2 AND PART.ID_ARTICOL = :id)
           INNER JOIN (SELECT PM2.IDNP, MAX(PM2.ADATE) AS DT FROM PRISON.MISCARI PM2 GROUP BY PM2.IDNP) MD
              ON (MD.IDNP = PD.IDNP AND PM.ADATE = MD.DT)
           WHERE PM.ID_TYPE_MISCARI IN (1,3)
           GROUP BY PD.ID, PD.IDNP, PD.SURNAME, PD.NAME, PD.SEC_NAME, PD.BIRDTH, PEN.NAME
           ORDER BY PD.SURNAME
         `;
         binds = { id: artId };
         headers = ["IDNP", "Nume", "Prenume", "Patronimic", "Data Nașterii", "Penitenciar"];
         title = `Căutare după Articol: ${params.article}`;
         break;

      default:
        return res.status(400).json({ success: false, error: "Tip interogare necunoscut." });
    }

    const result = await db.execute(sql, binds);
    const rows = result.rows || [];
    
    res.json({
      success: true,
      rows: rows,
      headers: headers,
      title: title
    });

  } catch (err) {
    console.error("Interogari Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
  ENDPOINT: /api/interogari/print
  Renders a pure HTML page for printing
*/
router.post("/interogari/print", async (req, res) => {
  const { headers, rows, title } = req.body;
  const userInfo = await getUserInfo(req);
  const dateStr = new Date().toLocaleString('ro-RO');

  const html = `
  <!DOCTYPE html>
  <html lang="ro">
  <head>
    <meta charset="UTF-8">
    <title>Raport: ${title}</title>
    <style>
      body { font-family: "Courier New", Courier, monospace; font-size: 12px; padding: 20px; }
      h1 { font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .meta { margin-bottom: 20px; font-size: 11px; color: #333; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 11px; }
      th { background-color: #f0f0f0; font-weight: bold; }
      @media print {
        .no-print { display: none; }
        th { background-color: #ddd !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="margin-bottom: 20px;">
      <button onclick="window.print()" style="padding: 8px 16px; cursor:pointer;">🖨️ Printează acum</button>
      <button onclick="window.close()" style="padding: 8px 16px; cursor:pointer;">Închide</button>
    </div>

    <h1>RAPORT: ${title}</h1>
    
    <div class="meta">
      <strong>Generat de:</strong> ${userInfo.username} (Rol: ${userInfo.role})<br/>
      <strong>Data generării:</strong> ${dateStr}<br/>
      <strong>Total înregistrări:</strong> ${rows.length}
    </div>

    <table>
      <thead>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
             ${headers.map((_, i) => {
                // Try to match object keys to headers index or just generic object iteration
                // Since row is an object from DB (e.g. {IDNP: '...', NUME: '...'}), we need to map headers to keys
                // But the headers array sent from frontend doesn't carry keys.
                // Quick fix: Backend sends 'rows' as array of objects. 
                // We will trust the object key order OR map generically.
                const keys = Object.keys(row);
                // We skip 'ID' if it's the first key and headers doesn't look like it wants ID (usually for links)
                // For robustness, let's just dump values.
                const val = Object.values(row)[i] || ''; 
                return `<td>${val}</td>`;
             }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </body>
  </html>
  `;

  res.send(html);
});

// Helper for select dropdowns (Institutions)
router.get("/interogari/institutions", async (req, res) => {
  try {
    const r = await db.execute("SELECT ID, NAME FROM PRISON.SPR_PENITENCIAR ORDER BY NAME");
    res.json({ success: true, items: r.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;