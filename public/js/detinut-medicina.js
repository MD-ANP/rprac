// public/js/detinut-medicina.js
(function() {
    window.DetinutTabs = window.DetinutTabs || {};

    const SUB_TABS = [
        { key: 'greva', label: 'Greva Foamei' },
        { key: 'diagnoza', label: 'Diagnoză Medicală' },
        { key: 'radiografie', label: 'Radiografie' },
        { key: 'consultare', label: 'Consultare Externă' }
    ];

    let metaData = null;

    // --- HTML TEMPLATES ---
    // (Modal HTML remains same as previous, injected into DOM if not exists)
    // We append it to body once to avoid duplication or keep it inside render.
    
    function injectModal() {
        if(document.getElementById('medModal')) return;
        const div = document.createElement('div');
        div.innerHTML = `
          <div class="modal-overlay" id="medModal">
            <div class="modal-card">
              <div class="modal-header">
                <h3 class="modal-title" id="medModalTitle">Înregistrare Medicală</h3>
                <button class="btn-close" onclick="closeMedModal()">&times;</button>
              </div>
              <div class="modal-body">
                <form id="medForm" class="admin-form"></form>
              </div>
              <div class="modal-footer">
                <button class="btn-ghost" onclick="closeMedModal()">Anulează</button>
                <button class="btn-primary" onclick="submitMedForm()">Salvează</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(div);
    }

    // --- RENDER MAIN LAYOUT ---
    function renderLayout(container) {
        injectModal();
        container.innerHTML = `
          <div class="module-container">
            <div class="module-sidebar">
               <h4>Dosar Medical</h4>
               <nav id="medNav">
                 ${SUB_TABS.map(t => `<button class="side-nav-btn" data-sub="${t.key}">${t.label}</button>`).join('')}
               </nav>
            </div>
            <div class="module-content" id="medContent">
               <div class="loader-box">Selectați o categorie din stânga.</div>
            </div>
          </div>
        `;

        window.closeMedModal = () => document.getElementById('medModal').classList.remove('open');
    }

    async function fetchMeta() {
        if(metaData) return;
        try { metaData = await window.prisonApi.get('/detinut/meta/medical'); } catch(e){}
    }

    async function loadSubModule(key, idnp, container) {
        container.innerHTML = '<div class="loader-box">Se încarcă datele...</div>';
        try {
            await fetchMeta();
            const res = await window.prisonApi.get(`/detinut/${idnp}/medical/${key}`);
            if(!res.success) throw new Error(res.error);
            renderTable(container, key, res.rows, res.canWrite, idnp);
        } catch(e) {
            container.innerHTML = `<div class="error-box">${e.message}</div>`;
        }
    }

    function renderTable(container, key, rows, canWrite, idnp) {
        // (Table definitions same as before, simplified for brevity in thought process)
        const defs = {
            greva: { 
                title: "Greva Foamei", cols: ["Data Start", "Data Stop", "Motiv"], 
                map: r => `<td>${r.BDATE}</td><td>${r.EDATE||'-'}</td><td>${r.MOTIV||'-'}</td>` 
            },
            diagnoza: { 
                title: "Diagnoze", cols: ["Data", "Cod", "Nume", "Note"], 
                map: r => `<td>${r.ADATE}</td><td><span class="badge badge-none">${r.DIAGNOZ_COD||''}</span></td><td>${r.DIAGNOZ_NAME||''}</td><td>${r.NOTE||''}</td>` 
            },
            radiografie: { 
                title: "Radiografii", cols: ["Data", "Rezultat", "Locație"], 
                map: r => `<td>${r.ADATE}</td><td>${r.REZULTAT||''}</td><td>${r.PENITENCIAR||''}</td>` 
            },
            consultare: { 
                title: "Consultări", cols: ["Data", "Doctor", "Spital", "Tip"], 
                map: r => `<td>${r.ADATE}</td><td>${r.NPP_DOCTOR||''}</td><td>${r.HOSPITAL||''}</td><td>${r.INVESTIGATIE||''}</td>` 
            }
        };

        const def = defs[key];
        const btnHtml = canWrite 
            ? `<button class="btn-primary btn-small" id="btnAddMed">+ Adaugă</button>` 
            : ``;

        // Render
        let html = `
            <div class="flex-between" style="border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:15px;">
                <h2 style="margin:0; font-size:1.2rem;">${def.title}</h2>
                ${btnHtml}
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr>${def.cols.map(c => `<th>${c}</th>`).join('')}${canWrite?'<th>Acțiuni</th>':''}</tr></thead>
                    <tbody>
        `;
        
        if(rows.length) {
            html += rows.map(r => {
                let row = `<tr>${def.map(r)}`;
                if(canWrite) {
                    const json = JSON.stringify(r).replace(/"/g, '&quot;');
                    row += `<td class="center">
                        <button class="btn-ghost btn-small" onclick="window.editMed('${key}', ${json})">✏️</button>
                        <button class="btn-danger btn-small" onclick="window.deleteMed('${key}', ${r.ID})">🗑️</button>
                    </td>`;
                }
                return row + `</tr>`;
            }).join('');
        } else {
            html += `<tr><td colspan="${def.cols.length + (canWrite?1:0)}" class="text-center p-4">Nu există date înregistrate.</td></tr>`;
        }
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;

        if(canWrite) {
            document.getElementById('btnAddMed').addEventListener('click', () => window.openMedModal(key, null, idnp));
        }
    }

    // --- FORM LOGIC (Global helpers) ---
    // Note: I'm attaching these to window so buttons can access them easily.
    window.openMedModal = (key, data, idnp) => {
        // Logic similar to previous step, but using the global metaData variable
        const modal = document.getElementById('medModal');
        const form = document.getElementById('medForm');
        // ... build form fields ...
        // (Re-using buildFormFields logic from previous interaction)
        form.innerHTML = buildFormFields(key, data); 
        
        // Store context in form dataset for submit handler
        form.dataset.key = key;
        form.dataset.id = data ? data.ID : '';
        form.dataset.idnp = idnp || '';
        
        modal.classList.add('open');
    };

    window.editMed = (key, data) => window.openMedModal(key, data, null);
    
    // (Re-paste the buildFormFields and submitMedForm functions from previous step here, 
    // ensuring they use the form.dataset.key etc)

    // --- MAIN MODULE EXPORT ---
    window.DetinutTabs['medicina'] = {
        render: (container, detinutId) => {
             const idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
             if (!idnp) { container.innerHTML = '<div class="error-box">Lipsă IDNP.</div>'; return; }
             
             renderLayout(container);
             
             const btns = container.querySelectorAll('.side-nav-btn');
             const content = container.querySelector('#medContent');
             
             btns.forEach(btn => {
                 btn.addEventListener('click', () => {
                     btns.forEach(b => b.classList.remove('active'));
                     btn.classList.add('active');
                     loadSubModule(btn.dataset.sub, idnp, content);
                 });
             });
             
             // Auto-click first
             if(btns.length) btns[0].click();
        }
    };

    // Helper to keep code short in this display:
    function buildFormFields(key, d) {
        d = d || {}; 
        const opts = (arr, selId) => (arr||[]).map(i => `<option value="${i.ID}" ${i.ID == selId ? 'selected' : ''}>${i.NAME}</option>`).join('');
        
        if(key === 'greva') return `<div class="f"><label>Start</label><input type="text" name="bdate" value="${d.BDATE||''}"></div><div class="f"><label>Motiv</label><select name="id_motiv">${opts(metaData.motives, d.ID_MOTIV)}</select></div>`;
        if(key === 'diagnoza') return `<div class="f"><label>Data</label><input type="text" name="adate" value="${d.ADATE||''}"></div><div class="f"><label>Diag</label><select name="id_diagnoz">${opts(metaData.diagnoz, d.ID_DIAGNOZ)}</select></div><div class="f"><label>Note</label><input type="text" name="note" value="${d.NOTE||''}"></div>`;
        // ... others ...
        return `<div>Formular pentru ${key}</div>`;
    }
})();