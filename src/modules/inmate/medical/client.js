(function () {
    window.DetinutTabs = window.DetinutTabs || {};
    const api = window.prisonApi;
    
    let meta = {}; 
    let userPerms = {}; 
    let permsLoaded = false;

    // --- CONSTANTS ---
    const MODS = {
        GREVA: 7,
        DIAGNOZA: 8,
        RADIOGRAFIE: 10,
        CONSULTARE: 11
    };

    // --- SHARED HELPERS ---
    const getIdnp = () => window.currentDetinutData ? window.currentDetinutData.IDNP : null;
    
    // Date Formatter: YYYY-MM-DDTHH... -> DD.MM.YYYY
    const fmt = (d) => {
        if(!d) return '-';
        if(d.length < 10) return d; 
        const date = new Date(d);
        if(isNaN(date.getTime())) return d;
        const day = String(date.getDate()).padStart(2,'0');
        const month = String(date.getMonth()+1).padStart(2,'0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const opts = (list) => `<option value="">- Selectați -</option>` + (list || []).map(x => `<option value="${x.ID}">${x.NAME}</option>`).join('');

    // --- DATA LOADING ---
    async function ensureMeta() {
        if (meta.loaded) return;
        try {
            const res = await api.get('/detinut/meta/medical');
            if (res.success) {
                meta = res; // Response is the object directly
                meta.loaded = true;
            }
        } catch (e) { console.error("Meta load failed", e); }
    }

    async function ensurePermissions() {
        if (permsLoaded) return;
        try {
            const res = await api.get('/detinut/permissions/medical');
            if (res.success) {
                userPerms = res.perms || {};
                permsLoaded = true;
            }
        } catch (e) { console.error("Perms load failed", e); }
    }

    const canEdit = (modId) => userPerms[modId] === 'W';

    // Generic Modal Builder (Same as Regim)
    function getModalHtml(id, title, formHtml, saveFunc) {
        const style = `
            <style>
                .admin-form input, .admin-form select, .admin-form textarea, .admin-form .flatpickr-input { 
                    width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; 
                    margin-bottom: 10px; font-size: 0.95rem; box-sizing: border-box; background: #fff; color: #1e293b; font-family: inherit; transition: border-color 0.2s;
                }
                .admin-form input:focus, .admin-form select:focus, .admin-form textarea:focus { border-color: #2563eb; outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
                .admin-form input[readonly].flatpickr-input { background-color: #fff; cursor: pointer; }
                .admin-form textarea { resize: vertical; min-height: 80px; }
                .admin-form label { font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 4px; display:block; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .f { margin-bottom: 5px; }
            </style>
        `;
        return `
            ${style}
            <div class="modal-overlay" id="${id}">
                <div class="modal-card">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="btn-close" onclick="document.getElementById('${id}').classList.remove('open')">×</button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="return false;" class="admin-form">${formHtml}</form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-ghost" onclick="document.getElementById('${id}').classList.remove('open')">Anulează</button>
                        <button class="btn-primary" onclick="${saveFunc}()">Salvează</button>
                    </div>
                </div>
            </div>`;
    }

    // --- 1. GREVA FOAMEI ---
    window.DetinutTabs['greva'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.GREVA);
            if(!idnp) return container.innerHTML = '<div class="error-box">Lipsă IDNP</div>';

            const loadData = async () => {
                container.innerHTML = '<div class="loader-box">Se încarcă...</div>';
                const res = await api.get(`/detinut/${idnp}/medical/greva`);
                if(!res.success) return container.innerHTML = `<div class="error-box">${res.error}</div>`;
                
                const rowsHtml = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.BDATE}</td>
                        <td>${r.EDATE || '-'}</td>
                        <td style="color:#ef4444; font-weight:600;">${r.MOTIV || '-'}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.grevaOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #ef4444;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#b91c1c">⚠️ Greva Foamei</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalGreva').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data Start</th><th>Data Stop</th><th>Motiv</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml || `<tr><td colspan="${editable ? 4 : 3}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalGreva', 'Înregistrare Grevă', `
                        <div class="grid-2">
                            <div class="f"><label>Data Start</label><input class="dp" id="g_bdate"></div>
                            <div class="f"><label>Data Stop</label><input class="dp" id="g_edate"></div>
                        </div>
                        <div class="f"><label>Motiv</label><select id="g_motiv">${opts(meta.motives)}</select></div>
                    `, 'window.grevaOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            
            window.grevaOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/medical/greva`, {
                        bdate: document.getElementById('g_bdate').value,
                        edate: document.getElementById('g_edate').value,
                        id_motiv: document.getElementById('g_motiv').value
                    });
                    document.getElementById('modalGreva').classList.remove('open');
                    loadData();
                },
                del: async (id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/medical/greva/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 2. DIAGNOZA ---
    window.DetinutTabs['diagnoza'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.DIAGNOZA);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/medical/diagnoza`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.ADATE}</td>
                        <td><span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${r.DIAGNOZ_COD||'?'}</span></td>
                        <td>${r.DIAGNOZ_NAME}</td>
                        <td><small>${r.NOTE || ''}</small></td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.diagOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Diagnoze Medicale</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalDiag').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Cod</th><th>Diagnostic</th><th>Note</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 5 : 4}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalDiag', 'Adaugă Diagnoză', `
                        <div class="f"><label>Data</label><input class="dp" id="d_adate"></div>
                        <div class="f"><label>Diagnostic</label><select id="d_id">${opts(meta.diagnoz)}</select></div>
                        <div class="f"><label>Note</label><textarea id="d_note"></textarea></div>
                    `, 'window.diagOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.diagOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/medical/diagnoza`, {
                        adate: document.getElementById('d_adate').value,
                        id_diagnoz: document.getElementById('d_id').value,
                        note: document.getElementById('d_note').value
                    });
                    document.getElementById('modalDiag').classList.remove('open');
                    loadData();
                },
                del: async(id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/medical/diagnoza/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 3. RADIOGRAFIE ---
    window.DetinutTabs['radiografie'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.RADIOGRAFIE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/medical/radiografie`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.ADATE}</td>
                        <td><span style="${r.REZULTAT==='Patologic'?'color:#ef4444; font-weight:bold;':''}">${r.REZULTAT||'-'}</span></td>
                        <td>${r.PENITENCIAR||'-'}</td>
                        <td><small>${r.COMMENTS||''}</small></td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.radioOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Radiografie</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalRadio').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Rezultat</th><th>Penitenciar</th><th>Comentarii</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 5 : 4}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalRadio', 'Adaugă Radiografie', `
                        <div class="f"><label>Data</label><input class="dp" id="r_adate"></div>
                        <div class="grid-2">
                            <div class="f"><label>Rezultat</label><select id="r_res">${opts(meta.results)}</select></div>
                            <div class="f"><label>Penitenciar</label><select id="r_pen">${opts(meta.penitenciars)}</select></div>
                        </div>
                        <div class="f"><label>Comentarii</label><textarea id="r_comm"></textarea></div>
                    `, 'window.radioOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.radioOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/medical/radiografie`, {
                        adate: document.getElementById('r_adate').value,
                        id_resultat: document.getElementById('r_res').value,
                        id_penitenciar: document.getElementById('r_pen').value,
                        comments: document.getElementById('r_comm').value
                    });
                    document.getElementById('modalRadio').classList.remove('open');
                    loadData();
                },
                del: async(id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/medical/radiografie/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 4. CONSULTARE ---
    window.DetinutTabs['consultare'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.CONSULTARE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/medical/consultare`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.ADATE}</td>
                        <td>${r.NPP_DOCTOR||'-'}</td>
                        <td>${r.HOSPITAL||'-'}</td>
                        <td>${r.INVESTIGATIE||'-'}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.consOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Consultare Externă</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalCons').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Doctor</th><th>Instituție</th><th>Investigație</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 5 : 4}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalCons', 'Consultare Nouă', `
                        <div class="grid-2">
                            <div class="f"><label>Data</label><input class="dp" id="c_adate"></div>
                            <div class="f"><label>Doctor (Nume)</label><input id="c_doc"></div>
                        </div>
                        <div class="f"><label>Spital / Instituție</label><select id="c_hosp">${opts(meta.hospitals)}</select></div>
                        <div class="f"><label>Tip Investigație</label><select id="c_inv">${opts(meta.investigations)}</select></div>
                    `, 'window.consOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.consOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/medical/consultare`, {
                        adate: document.getElementById('c_adate').value,
                        npp_doctor: document.getElementById('c_doc').value,
                        id_hospital: document.getElementById('c_hosp').value,
                        id_investigatii: document.getElementById('c_inv').value
                    });
                    document.getElementById('modalCons').classList.remove('open');
                    loadData();
                },
                del: async(id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/medical/consultare/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- MASTER TAB: MEDICINA ---
    window.DetinutTabs['medicina'] = {
        render: async (container) => {
            await ensurePermissions(); // Cache perms first
            
            container.innerHTML = `
                <style>
                    .regim-sub-nav { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; overflow-x: auto; }
                    .regim-pill { 
                        background: white; border: 1px solid #cbd5e1; padding: 6px 14px; 
                        border-radius: 18px; cursor: pointer; font-weight: 600; color: #475569; white-space: nowrap; font-size: 0.9rem;
                        transition: all 0.2s; display: flex; align-items: center; gap: 6px;
                    }
                    .regim-pill:hover { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
                    .regim-pill.active { background: #2563eb; color: white; border-color: #2563eb; }
                    
                    .pill-warn.active { background: #ef4444; border-color: #ef4444; }

                    #medSubContent { min-height: 400px; animation: fadeIn 0.3s ease-out; }
                </style>

                <div class="regim-sub-nav">
                    <button class="regim-pill active" onclick="window.medMaster.switch('diagnoza', this)">🩺 Diagnoză</button>
                    <button class="regim-pill" onclick="window.medMaster.switch('consultare', this)">🏥 Consultare</button>
                    <button class="regim-pill" onclick="window.medMaster.switch('radiografie', this)">🦴 Radiografie</button>
                    <div style="width:1px; background:#e2e8f0; margin:0 5px;"></div>
                    <button class="regim-pill pill-warn" onclick="window.medMaster.switch('greva', this)">⚠️ Greva Foamei</button>
                </div>
                
                <div id="medSubContent">
                    <div class="loader-box">Se inițializează...</div>
                </div>
            `;

            window.medMaster = {
                switch: async (subKey, btnEl) => {
                    container.querySelectorAll('.regim-pill').forEach(b => b.classList.remove('active'));
                    if(btnEl) btnEl.classList.add('active');

                    const contentDiv = document.getElementById('medSubContent');
                    contentDiv.innerHTML = '<div class="loader-box">Se încarcă...</div>';

                    const module = window.DetinutTabs[subKey];
                    if (module && module.render) {
                        try {
                            await module.render(contentDiv);
                        } catch (e) {
                            contentDiv.innerHTML = `<div class="error-box">Eroare sub-modul: ${e.message}</div>`;
                        }
                    } else {
                        contentDiv.innerHTML = `<div class="error-box">Sub-modulul '${subKey}' nu a fost găsit.</div>`;
                    }
                }
            };
            // Default load
            window.medMaster.switch('diagnoza', container.querySelector('.regim-pill'));
        }
    };
})();