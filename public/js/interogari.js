// public/js/interogari.js
(function () {
  let currentUser = null;
  let institutions = [];

  async function loadInstitutions() {
    const d = await window.prisonApi.get("/interogari/institutions");
    if (d.success) institutions = d.items || [];
  }

  function renderTabs(container) {
    container.innerHTML = `
      <div class="admin-page">
         <header class="admin-header-main">
            <h1 class="admin-title">Interogări și Rapoarte</h1>
            <p class="app-subtitle">Generare rapoarte operaționale.</p>
         </header>

         <div class="admin-tabs">
            <button class="admin-tab-btn active" data-tab="detinuti">👤 Deținuți</button>
            <button class="admin-tab-btn" data-tab="colete">📦 Colete & Vizite</button>
            <button class="admin-tab-btn" data-tab="transfer">🚐 Transferuri</button>
            <button class="admin-tab-btn" data-tab="evidenta">📋 Evidență & Acte</button>
            <button class="admin-tab-btn" data-tab="straini">🌍 Străini</button>
         </div>

         <!-- TAB: DETINUTI -->
         <div class="admin-panel" data-panel="detinuti">
            <h2>Rapoarte Deținuți</h2>
            <div class="admin-grid-2">
               <div class="card-action">
                  <h3>Lista Generală</h3>
                  <p>Afișează toți deținuții din penitenciarul curent.</p>
                  <button class="btn-primary" onclick="runQuery('LISTA')">Generează Lista</button>
               </div>
               <div class="card-action">
                  <h3>Lista pe Instituție</h3>
                  <select id="sel_inst_listap" class="full-width mb-2">
                     <option value="">Selectează Penitenciar...</option>
                     ${institutions.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join('')}
                  </select>
                  <button class="btn-primary" onclick="runQuery('LISTAP', {institution_id: getValue('sel_inst_listap')})">Generează</button>
               </div>
               <div class="card-action span-2">
                  <h3>Căutare Vârstă</h3>
                  <div class="row-flex">
                     <input type="number" id="age_min" placeholder="Min Ani" class="sm-input">
                     <input type="number" id="age_max" placeholder="Max Ani" class="sm-input">
                     <select id="sel_inst_age">
                        ${institutions.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join('')}
                     </select>
                     <button class="btn-primary" onclick="runQuery('SEARCH_BY_AGE', {min_age: getValue('age_min'), max_age: getValue('age_max'), institution_id: getValue('sel_inst_age')})">Caută</button>
                  </div>
               </div>
            </div>
         </div>

         <!-- TAB: COLETE -->
         <div class="admin-panel hidden" data-panel="colete">
            <h2>Colete și Vizite</h2>
            <div class="admin-grid-2">
               <div class="card-action">
                  <h3>Caută Colet (Sursă)</h3>
                  <input type="text" id="col_source" placeholder="Nume sursă..." class="mb-2 full-width">
                  <button class="btn-primary" onclick="runQuery('COLETE', {sursa: getValue('col_source')})">Caută</button>
               </div>
               <div class="card-action">
                  <h3>Colete după Dată</h3>
                  <div class="row-flex mb-2">
                     <input type="text" id="col_d1" placeholder="DD.MM.YYYY">
                     <input type="text" id="col_d2" placeholder="DD.MM.YYYY">
                  </div>
                  <button class="btn-primary" onclick="runQuery('SEARCH_COLETA_DATE', {start_date: getValue('col_d1'), end_date: getValue('col_d2')})">Caută</button>
               </div>
               <div class="card-action span-2">
                  <h3>Căutare Întrevedere</h3>
                  <input type="text" id="viz_name" placeholder="Nume vizitator..." class="mb-2 full-width">
                  <button class="btn-primary" onclick="runQuery('CAUTINTREVEDERE', {term: getValue('viz_name')})">Caută</button>
               </div>
            </div>
         </div>

         <!-- TAB: TRANSFER -->
         <div class="admin-panel hidden" data-panel="transfer">
             <h2>Transferuri și Escortări</h2>
             <div class="admin-grid-2">
                <div class="card-action">
                   <h3>Tabel Escortare</h3>
                   <input type="text" id="esc_date" placeholder="DD.MM.YYYY" value="${new Date().toLocaleDateString('ro-RO')}" class="mb-2 full-width">
                   <button class="btn-primary" onclick="runQuery('TABELESCORTARE', {date: getValue('esc_date')})">Generează</button>
                </div>
                <div class="card-action">
                   <h3>Transfer Penitenciare</h3>
                   <input type="text" id="trans_date" placeholder="DD.MM.YYYY" value="${new Date().toLocaleDateString('ro-RO')}" class="mb-2 full-width">
                   <button class="btn-primary" onclick="runQuery('TABELTRANSFERPENITENCIARE', {date: getValue('trans_date')})">Generează</button>
                </div>
                <div class="card-action">
                   <h3>Mișcare Celule</h3>
                   <div class="row-flex mb-2">
                     <input type="text" id="cell_d1" placeholder="Start (DD.MM.YYYY)">
                     <input type="text" id="cell_d2" placeholder="End">
                   </div>
                   <button class="btn-primary" onclick="runQuery('LISTADUPACELULE', {start_date: getValue('cell_d1'), end_date: getValue('cell_d2')})">Caută</button>
                </div>
                <div class="card-action">
                   <h3>Securitate Personală (206)</h3>
                   <p>Deținuți cu regim special.</p>
                   <button class="btn-primary" onclick="runQuery('LISTA206')">Generează</button>
                </div>
                 <div class="card-action">
                   <h3>Ecusoane</h3>
                   <p>Generare listă pentru ecusoane.</p>
                   <button class="btn-primary" onclick="runQuery('ECUSON')">Generează</button>
                </div>
             </div>
         </div>

         <!-- TAB: EVIDENTA -->
         <div class="admin-panel hidden" data-panel="evidenta">
             <h2>Evidență și Acte</h2>
             <div class="admin-grid-2">
                <div class="card-action">
                   <h3>Acte Expirate</h3>
                   <p>Listă completă deținuți cu acte expirate.</p>
                   <button class="btn-primary" onclick="runQuery('SEARCH_ACTE_EXPIRED')">Caută</button>
                </div>
                 <div class="card-action">
                   <h3>Căutare după Articol</h3>
                   <input type="text" id="art_num" placeholder="Număr articol..." class="mb-2 full-width">
                   <button class="btn-primary" onclick="runQuery('CAUTARTICOL', {article: getValue('art_num')})">Caută</button>
                </div>
                <div class="card-action">
                   <h3>Deținuți Eliberați</h3>
                    <div class="row-flex mb-2">
                     <input type="text" id="rel_d1" placeholder="Start">
                     <input type="text" id="rel_d2" placeholder="End">
                   </div>
                   <button class="btn-primary" onclick="runQuery('ELIBERATI', {start_date: getValue('rel_d1'), end_date: getValue('rel_d2')})">Caută</button>
                </div>
                 <div class="card-action">
                   <h3>Registru Leziuni</h3>
                    <div class="row-flex mb-2">
                     <input type="text" id="lez_d1" placeholder="Start">
                     <input type="text" id="lez_d2" placeholder="End">
                   </div>
                   <button class="btn-primary" onclick="runQuery('SEARCH_LEZIUNI', {start_date: getValue('lez_d1'), end_date: getValue('lez_d2')})">Caută</button>
                </div>
             </div>
         </div>
         
         <!-- TAB: STRAINI -->
         <div class="admin-panel hidden" data-panel="straini">
            <h2>Evidență Străini</h2>
             <div class="admin-grid-2">
                <div class="card-action">
                   <h3>Cetățeni Străini</h3>
                   <p>Listă activă.</p>
                   <button class="btn-primary" onclick="runQuery('CETATENI')">Generează</button>
                </div>
                <div class="card-action">
                   <h3>Străini Eliberați (An Curent)</h3>
                   <p>Rapoarte pe anul în curs.</p>
                   <button class="btn-primary" onclick="runQuery('STRAINI_ELIBERATI')">Generează</button>
                </div>
             </div>
         </div>

         <!-- RESULTS SECTION -->
         <div id="queryResultsArea" class="mt-4 hidden">
            <div class="flex-between">
               <h2 id="resTitle">Rezultate</h2>
               <button class="btn-secondary" onclick="printCurrentResults()">🖨️ Printează PDF</button>
            </div>
            <div class="table-wrapper">
               <table class="data-table" id="resTable">
                  <thead></thead>
                  <tbody></tbody>
               </table>
            </div>
         </div>
      </div>
    `;

    // Helper logic for tabs
    container.querySelectorAll('.admin-tab-btn').forEach(btn => {
       btn.addEventListener('click', () => {
          container.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          container.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
          container.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.remove('hidden');
       });
    });
  }

  // Global helpers exposed to inline onclicks
  window.getValue = (id) => {
     const el = document.getElementById(id);
     return el ? el.value.trim() : '';
  };

  let lastResult = null;

  window.runQuery = async (type, params = {}) => {
     const resArea = document.getElementById('queryResultsArea');
     const tHead = document.querySelector('#resTable thead');
     const tBody = document.querySelector('#resTable tbody');
     const titleEl = document.getElementById('resTitle');

     // Clear previous
     resArea.classList.remove('hidden');
     tBody.innerHTML = '<tr><td colspan="10" class="text-center">Se încarcă...</td></tr>';
     
     try {
        const data = await window.prisonApi.post('/interogari/exec', { type, params });
        if(!data.success) throw new Error(data.error);

        lastResult = data; // Store for printing
        titleEl.textContent = data.title;
        
        // CHANGED: Updated <th>Acțiuni</th> to <th>Profil</th>
        tHead.innerHTML = `<tr>${data.headers.map(h => `<th>${h}</th>`).join('')}<th>Profil</th></tr>`;
        
        // Render Rows
        if(data.rows.length === 0) {
           tBody.innerHTML = `<tr><td colspan="${data.headers.length + 1}" class="text-center p-4">Nu au fost găsite rezultate.</td></tr>`;
        } else {
           tBody.innerHTML = data.rows.map(r => {
              // We ignore the first column 'ID' usually used for links, but let's grab it if exists
              const id = r.ID || r.IDDETINUT || 0; 
              const cells = Object.values(r).map(v => `<td>${v === null ? '' : v}</td>`).join('');
              // Simple link logic
              const btn = id ? `<button class="btn-small" onclick="window.location.href='/app/index.html?module=profile&id=${id}'">Profil</button>` : '';
              return `<tr>${cells}<td>${btn}</td></tr>`;
           }).join('');
        }
     } catch(e) {
        tBody.innerHTML = `<tr><td colspan="10" class="error-text">Eroare: ${e.message}</td></tr>`;
     }
  };

  window.printCurrentResults = async () => {
     if(!lastResult) return;
     
     // Send data to backend to render HTML page
     // We use a trick: create a hidden form and submit it to new tab
     const form = document.createElement('form');
     form.method = 'POST';
     form.action = '/api/interogari/print';
     form.target = '_blank';
     
     // Add auth token if needed (cookies usually handle this, but let's see. 
     // Since it's a form post to new tab, custom headers are hard.
     // We will rely on IP or if needed, pass token in hidden input, though less secure)
     
     // Actually, the fetch approach is cleaner but requires blob handling for new tab.
     // Let's stick to fetch -> blob -> URL
     
     try {
       const resp = await fetch('/api/interogari/print', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'x-user-id': sessionStorage.getItem("prison.userId")
          },
          body: JSON.stringify(lastResult)
       });
       const blob = await resp.blob();
       const url = URL.createObjectURL(blob);
       window.open(url, '_blank');
     } catch(e) {
        alert("Eroare la generarea printului.");
     }
  };

  // Register Module
  window.prisonModules = window.prisonModules || {};
  window.prisonModules.interogari = {
    async init({ userId, container }) {
      await loadInstitutions();
      renderTabs(container);
    }
  };
})();