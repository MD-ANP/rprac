(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    let meta = null; // Caches dropdown data
    let currentIdnp = null;
    let permissions = {};

    // --- CONFIGURATION ---
    // IDs correspond to database module IDs: 7=Greva, 8=Diagnoza, 10=Radio, 11=Consult
    const SUB_MODULES = [
        { key: 'greva',       label: 'Greva Foamei',        moduleId: 7 },
        { key: 'diagnoza',    label: 'Diagnoză Medicală',   moduleId: 8 },
        { key: 'radiografie', label: 'Radiografie',         moduleId: 10 },
        { key: 'consultare',  label: 'Consultare Externă',  moduleId: 11 }
    ];

    // --- PERMISSION HELPER ---
    // Fetches permissions for the specific medical modules for current user
    async function loadPermissions(userId) {
        if (Object.keys(permissions).length > 0) return; // already loaded
        try {
            const res = await window.prisonApi.get(`/profile?userId=${userId}`);
            if(res.success && res.permissions) {
                res.permissions.forEach(p => {
                    permissions[p.moduleId] = p.drept; // 'R', 'W' or null
                });
            }
        } catch(e) { console.error("Perms load error", e); }
    }

    function getRight(moduleId) {
        return permissions[moduleId] || null; // 'R', 'W', or null
    }

    // --- METADATA LOADER ---
    async function fetchMeta() {
        if(meta) return;
        const res = await window.prisonApi.get('/detinut/meta/medical');
        if(res.success) meta = res;
        else throw new Error("Nu s-au putut încărca nomenclatoarele medicale.");
    }

    // --- HTML GENERATORS ---
    function renderLayout(container, allowedTabs) {
        injectMedModal();
        
        if (allowedTabs.length === 0) {
            container.innerHTML = `<div class="admin-panel text-center"><p class="text-muted">Nu aveți drepturi de vizualizare pentru niciun sub-modul medical.</p></div>`;
            return;
        }

        container.innerHTML = `
          <div class="module-container">
            <div class="module-sidebar">
               <h4>Dosar Medical</h4>
               <nav id="medNav">
                 ${allowedTabs.map(t => `<button class="side-nav-btn" data-key="${t.key}">${t.label}</button>`).join('')}
               </nav>
            </div>
            <div class="module-content" id="medContent">
               <div class="loader-box">Selectați o categorie.</div>
            </div>
          </div>
        `;

        // Bind clicks
        const navBtns = container.querySelectorAll('.side-nav-btn');
        // FIX: Use querySelector instead of getElementById on a specific element
        const content = container.querySelector('#medContent');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadSubModule(btn.dataset.key, content);
            });
        });

        // Click first
        if (navBtns.length > 0) navBtns[0].click();
    }

    async function loadSubModule(key, container) {
        container.innerHTML = '<div class="loader-box">Se încarcă...</div>';
        
        try {
            // Fetch data
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/medical/${key}`);
            if(!res.success) throw new Error(res.error);

            // Re-verify Write permission from server response to be safe
            const serverCanWrite = res.canWrite; 
            
            renderTable(container, key, res.rows, serverCanWrite);
        } catch(e) {
            container.innerHTML = `<div class="error-box">Eroare: ${e.message}</div>`;
        }
    }

    function renderTable(container, key, rows, canWrite) {
        let cols = [];
        let rowMapper = null;
        let title = "";

        // Define Table Structure
        if (key === 'greva') {
            title = "Greva Foamei";
            cols = ["Data Start", "Data Stop", "Motiv"];
            rowMapper = r => `<td>${r.BDATE}</td><td>${r.EDATE||'—'}</td><td>${r.MOTIV||'—'}</td>`;
        } else if (key === 'diagnoza') {
            title = "Diagnoze Medicale";
            cols = ["Data", "Cod", "Diagnostic", "Note"];
            rowMapper = r => `<td>${r.ADATE}</td><td><span class="badge badge-none">${r.DIAGNOZ_COD||'?'}</span></td><td>${r.DIAGNOZ_NAME}</td><td>${r.NOTE||''}</td>`;
        } else if (key === 'radiografie') {
            title = "Radiografii";
            cols = ["Data", "Rezultat", "Penitenciar", "Comentarii"];
            rowMapper = r => `<td>${r.ADATE}</td><td><span class="badge ${r.REZULTAT==='Patologic'?'badge-write':'badge-read'}">${r.REZULTAT||'-'}</span></td><td>${r.PENITENCIAR||'-'}</td><td>${r.COMMENTS||''}</td>`;
        } else if (key === 'consultare') {
            title = "Consultări Externe";
            cols = ["Data", "Doctor", "Instituție", "Investigație"];
            rowMapper = r => `<td>${r.ADATE}</td><td>${r.NPP_DOCTOR||'-'}</td><td>${r.HOSPITAL||'-'}</td><td>${r.INVESTIGATIE||'-'}</td>`;
        }

        const btnAdd = canWrite ? `<button class="btn-primary btn-small" onclick="window.medOps.openAdd('${key}')">+ Adaugă</button>` : '';

        let html = `
            <div class="flex-between" style="border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
                <h3 style="margin:0; font-size:1.1rem; color:#1e293b;">${title}</h3>
                ${btnAdd}
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>${cols.map(c => `<th>${c}</th>`).join('')}${canWrite ? '<th style="width:100px; text-align:center;">Acțiuni</th>' : ''}</tr>
                    </thead>
                    <tbody>
        `;

        if (rows.length === 0) {
            html += `<tr><td colspan="${cols.length + (canWrite?1:0)}" class="table-empty">Nu există înregistrări.</td></tr>`;
        } else {
            html += rows.map(r => {
                // Escape JSON for onclick safety
                const safeJson = JSON.stringify(r).replace(/"/g, '&quot;');
                let act = '';
                if(canWrite) {
                    act = `<td class="text-center">
                        <button class="btn-ghost btn-tiny" onclick="window.medOps.openEdit('${key}', ${safeJson})">✏️</button>
                        <button class="btn-danger btn-tiny" onclick="window.medOps.del('${key}', ${r.ID})">×</button>
                    </td>`;
                }
                return `<tr>${rowMapper(r)}${act}</tr>`;
            }).join('');
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // --- MODAL & FORMS ---
    function injectMedModal() {
        if(document.getElementById('medModal')) return;
        const html = `
        <div class="modal-overlay" id="medModal">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title" id="medTitle">Înregistrare</h3>
                    <button class="btn-close" onclick="window.medOps.close()">×</button>
                </div>
                <div class="modal-body">
                    <form id="medForm" class="admin-form"></form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.medOps.close()">Anulează</button>
                    <button class="btn-primary" onclick="window.medOps.submit()">Salvează</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    // Builds form fields dynamically based on type
    function getFormFields(key, d = {}) {
        const today = new Date().toLocaleDateString('ro-RO');
        const opts = (arr, selId) => (arr||[]).map(i => `<option value="${i.ID}" ${String(i.ID) === String(selId) ? 'selected' : ''}>${i.NAME}</option>`).join('');

        if (key === 'greva') {
            return `
                <div class="admin-grid-2">
                    <div class="f"><label>Data Start</label><input type="text" name="bdate" class="datepicker" value="${d.BDATE || today}" placeholder="DD.MM.YYYY"></div>
                    <div class="f"><label>Data Stop</label><input type="text" name="edate" class="datepicker" value="${d.EDATE || ''}" placeholder="DD.MM.YYYY"></div>
                </div>
                <div class="f mt-4"><label>Motivul Grevei</label><select name="id_motiv" class="full-width"><option value="">- Selectează -</option>${opts(meta.motives, d.ID_MOTIV)}</select></div>
            `;
        }
        if (key === 'diagnoza') {
            return `
                <div class="f"><label>Data Diagnosticului</label><input type="text" name="adate" class="datepicker" value="${d.ADATE || today}" placeholder="DD.MM.YYYY"></div>
                <div class="f"><label>Diagnostic (ICD)</label><select name="id_diagnoz" class="full-width search-select"><option value="">- Caută Diagnostic -</option>${opts(meta.diagnoz, d.ID_DIAGNOZ)}</select></div>
                <div class="f"><label>Note / Detalii</label><textarea name="note" rows="3" class="full-width">${d.NOTE || ''}</textarea></div>
            `;
        }
        if (key === 'radiografie') {
            return `
                <div class="f"><label>Data Efectuării</label><input type="text" name="adate" class="datepicker" value="${d.ADATE || today}" placeholder="DD.MM.YYYY"></div>
                <div class="admin-grid-2">
                    <div class="f"><label>Rezultat</label><select name="id_resultat" class="full-width">${opts(meta.results, d.ID_RESULTAT)}</select></div>
                    <div class="f"><label>Penitenciar</label><select name="id_penitenciar" class="full-width">${opts(meta.penitenciars, d.ID_PENETENTIAR)}</select></div>
                </div>
                <div class="f"><label>Comentarii</label><textarea name="comments" rows="2" class="full-width">${d.COMMENTS || ''}</textarea></div>
            `;
        }
        if (key === 'consultare') {
            return `
                <div class="admin-grid-2">
                    <div class="f"><label>Data Consult</label><input type="text" name="adate" class="datepicker" value="${d.ADATE || today}" placeholder="DD.MM.YYYY"></div>
                    <div class="f"><label>Nume Doctor</label><input type="text" name="npp_doctor" value="${d.NPP_DOCTOR || ''}"></div>
                </div>
                <div class="f"><label>Instituție Medicală</label><select name="id_hospital" class="full-width">${opts(meta.hospitals, d.ID_HOSPITAL)}</select></div>
                <div class="f"><label>Tip Investigație</label><select name="id_investigatii" class="full-width">${opts(meta.investigations, d.ID_INVESTIGATII)}</select></div>
            `;
        }
        return '';
    }

    // --- GLOBAL OPERATIONS WRAPPER ---
    // Exposed to allow inline onclick handlers in generated HTML
    window.medOps = {
        currentKey: null,
        currentId: null,

        openAdd: (key) => {
            window.medOps.currentKey = key;
            window.medOps.currentId = null;
            const form = document.getElementById('medForm');
            form.innerHTML = getFormFields(key, {});
            document.getElementById('medTitle').textContent = `Adăugare ${key.toUpperCase()}`;
            document.getElementById('medModal').classList.add('open');
        },

        openEdit: (key, data) => {
            window.medOps.currentKey = key;
            window.medOps.currentId = data.ID;
            const form = document.getElementById('medForm');
            form.innerHTML = getFormFields(key, data);
            document.getElementById('medTitle').textContent = `Editare ${key.toUpperCase()}`;
            document.getElementById('medModal').classList.add('open');
        },

        close: () => {
            document.getElementById('medModal').classList.remove('open');
        },

        submit: async () => {
            const key = window.medOps.currentKey;
            const id = window.medOps.currentId;
            const form = document.getElementById('medForm');
            const fd = new FormData(form);
            const payload = Object.fromEntries(fd);

            try {
                let url, method;
                if (id) {
                    url = `/detinut/medical/${key}/${id}`;
                    method = 'PUT';
                } else {
                    url = `/detinut/${currentIdnp}/medical/${key}`;
                    method = 'POST';
                }

                // Manually calling fetch to support PUT/POST correctly
                const headers = { "Content-Type": "application/json" };
                const userId = sessionStorage.getItem("prison.userId");
                if (userId) headers["X-User-Id"] = userId;

                const res = await fetch(`/api${url}`, {
                    method: method,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if(!data.success) throw new Error(data.error);
                
                window.medOps.close();
                // Reload Module
                const content = document.getElementById('medContent');
                loadSubModule(key, content);

            } catch (e) {
                alert("Eroare: " + e.message);
            }
        },

        del: async (key, id) => {
            if(!confirm("Sigur ștergeți înregistrarea?")) return;
            try {
                await window.prisonApi.del(`/detinut/medical/${key}/${id}`);
                const content = document.getElementById('medContent');
                loadSubModule(key, content);
            } catch(e) { alert(e.message); }
        }
    };

    // --- MAIN RENDER ---
    window.DetinutTabs['medicina'] = {
        render: async (container, detinutId) => {
             // 1. Get IDNP from global context
             const idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
             if (!idnp) { container.innerHTML = '<div class="error-box">Lipsă IDNP.</div>'; return; }
             currentIdnp = idnp;

             // 2. Fetch Meta & Permissions
             try {
                 const userId = sessionStorage.getItem("prison.userId");
                 await Promise.all([fetchMeta(), loadPermissions(userId)]);
             } catch(e) {
                 container.innerHTML = `<div class="error-box">${e.message}</div>`;
                 return;
             }

             // 3. Filter Allowed Sub-Tabs
             const allowedTabs = SUB_MODULES.filter(m => {
                 const right = getRight(m.moduleId);
                 // Allow if right is R or W
                 return right === 'R' || right === 'W';
             });

             // 4. Render Sidebar
             renderLayout(container, allowedTabs);
        }
    };
})();