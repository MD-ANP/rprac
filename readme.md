📋 Status Proiect: Sistem Gestiune Detinuți (rprac)

Acest document monitorizează progresul implementării modulelor sistemului, interfața cu baza de date Oracle și frontend-ul Node.js.
🚀 Module Finalizate (Core)
Modul	Descriere	Status
Autentificare	Pagina de login și sesiunile utilizatorilor.	✅ Finalizat
Ghid de Utilizare	Documentația de ajutor integrată în aplicație.	✅ Finalizat
Adăugare Deținut	Formularul principal de înregistrare (IDNP, Date Personale).	✅ Finalizat
Comasare	Funcționalitatea de unire a înregistrărilor duplicate.	✅ Finalizat
Profil Utilizator	Vizualizarea și gestionarea propriului profil de utilizator.	✅ Finalizat
Rapoarte & Interogări	Generatorul de rapoarte și extragerea datelor complexe.	✅ Finalizat
📂 Module Date Deținuți (Tab-uri Profil)
Modul	Descriere	Status
Date Generale	Informații de bază despre deținut.	✅ Finalizat
Garanții	Garanții și obligații legale.	✅ Finalizat
Hotărâri	Deciziile instanțelor judecătorești.	✅ Finalizat
Mișcări	Transferuri între celule sau instituții.	✅ Finalizat
Citații	Managementul citațiilor (Module ID 36).	✅ Finalizat
Rude	Managementul listei de rude (Module ID 3).	✅ Finalizat
Complici	Înregistrarea persoanelor implicate în aceleași cauze.	✅ Finalizat
Medicină	Evidența medicală și istoricul clinic.	✅ Finalizat
🛠️ Module în Lucru sau În Așteptare
🏗️ În curs de dezvoltare (WIP)

    Educație: Integrarea activităților educaționale.

    Psihologie: Fișele de evaluare psihologică.

    Social: Asistența socială și reintegrarea.

    Securitate: Clasificarea deținuților și riscurile.

    Regim: Managementul regimului de detenție.

⏳ În Așteptare (Backlog)

    Incidente: Raportarea incidentelor critice și a abaterilor disciplinare.

    Căutare Globală: Optimizarea căutării pentru a ignora diferențele de diacritice (ex: "ș" vs "s").

    Raport Creare User: Generarea automată a raportului de confirmare la crearea unui cont nou de admin.

⚙️ Pagina de Administrare
Funcționalitate	Status	Note
Adaugă Utilizator	✅ Finalizat	Creare conturi individuale.
Import Useri în Masă	✅ Finalizat	Import via CSV/Excel.
Statistici	✅ Finalizat	Grafice și date de sistem.
Anunțuri	✅ Finalizat	🐛 Bug: Culoarea textului este prea albă, greu de citit.
Editare Utilizatori	🏗️ În Lucru	Căutarea funcționează, butonul de editare necesită logică.
🐛 Probleme Cunoscute & Optimizări

    UI/UX: Fixarea contrastului în modulul de Anunțuri din panoul de Admin.

    Database: Optimizarea query-urilor de tip LIKE în Oracle pentru a trata diacriticele ca echivalente (Romanian Insensitive Search).

    Performanță: Verificarea indexării pe coloana IDNP pentru a asigura viteza în modulele Citații și Rude.

Ultima actualizare: 05.01.2026 Responsabil: Gemini Thought Partner & Lead Developer