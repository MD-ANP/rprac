(function () {
    window.DetinutTabs = window.DetinutTabs || {};
    const api = window.prisonApi;
    
    let meta = {}; 
    let userPerms = {}; 
    let permsLoaded = false;

    // --- CONSTANTS ---
    const MODS = {
        PERS_SEC: 26,
        EVADARE: 27,
        AUTORITATE: 28
    };

    // --- SHARED HELPERS ---
    const getIdnp = () => window.currentDetinutData ? window.currentDetinutData.IDNP : null;
    
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
            const res = await api.get('/detinut/meta/securitate');
            if (res.success) {
                meta = res;
                meta.loaded = true;
            }
        } catch (e) { console.error("Meta load failed", e); }
    }

    async function ensurePermissions() {
        if (permsLoaded) return;
        try {
            const res = await api.get('/detinut/permissions/securitate');
            if (res.success) {
                userPerms = res.perms || {};
                permsLoaded = true;
            }
        } catch (e) { console.error("Perms load failed", e); }
    }

    const canEdit = (modId) => userPerms[modId] === 'W';

    // Generic Modal Builder
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

    // --- 1. AUTORITATE (ID 28) ---
    window.DetinutTabs['autoritate'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.AUTORITATE);
            if(!idnp) return container.innerHTML = '<div class="error-box">Lipsă IDNP</div>';

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/securitate/autoritate`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.BDATE}</td>
                        <td><span style="color:#7c3aed; font-weight:bold;">${r.NAME_STATUS_CRIM}</span></td>
                        <td>${r.ALIASS || '-'}</td>
                        <td>${r.EDATE || '-'}</td>
                        <td><small>${r.MOTIV || '-'}</small></td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.secOps.del('autoritate', ${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #8b5cf6;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#6d28d9">👑 Autoritate Criminală</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mAuth').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data Atribuirii</th><th>Statut</th><th>Alias</th><th>Data Scoatere</th><th>Motiv Scoatere</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 6 : 5}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mAuth', 'Autoritate Nouă', `
                        <div class="f"><label>Statut</label><select id="a_stat">${opts(meta.statusCrim)}</select></div>
                        <div class="f"><label>Alias</label><input id="a_alias"></div>
                        <div class="grid-2">
                            <div class="f"><label>Data Atribuirii</label><input class="dp" id="a_bdate"></div>
                            <div class="f"><label>Data Scoatere</label><input class="dp" id="a_edate"></div>
                        </div>
                        <div class="f"><label>Motiv Scoatere</label><input id="a_motiv"></div>
                    `, 'window.secOps.addAuth') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            loadData();
        }
    };

    // --- 2. EVADARE (ID 27) ---
    window.DetinutTabs['evadare'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.EVADARE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/securitate/evadare`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.OUT_DATE}</td>
                        <td>${r.NAME_PENITENCIAR}</td>
                        <td>${r.IN_DATE || '-'}</td>
                        <td>${r.HUNTER || '-'}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.secOps.del('evadare', ${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #ef4444;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#b91c1c">🏃 Evadări</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mEsc').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data Evadării</th><th>Penitenciar</th><th>Data Reținerii</th><th>Cine a reținut</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 5 : 4}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mEsc', 'Înregistrare Evadare', `
                        <div class="f"><label>Penitenciar</label><select id="e_pen">${opts(meta.penitenciars)}</select></div>
                        <div class="grid-2">
                            <div class="f"><label>Data Evadării</label><input class="dp" id="e_out"></div>
                            <div class="f"><label>Data Reținerii</label><input class="dp" id="e_in"></div>
                        </div>
                        <div class="f"><label>Cine a reținut</label><input id="e_hunt"></div>
                    `, 'window.secOps.addEsc') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            loadData();
        }
    };

    // --- 3. SECURITATE PERSONALA (ID 26) ---
    window.DetinutTabs['securitate_personala'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.PERS_SEC);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/securitate/pers`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.NAME_TIP_SECUR_APL}</td>
                        <td>${r.BDATE}</td>
                        <td><small>${r.TEMEI_LUARE || '-'}</small></td>
                        <td>${r.EDATE || '-'}</td>
                        <td><small>${r.TEMEI_SCOATE || '-'}</small></td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.secOps.del('pers', ${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #3b82f6;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#1d4ed8">🛡️ Securitate Personală</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mPers').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Tip Securitate</th><th>Data Luării</th><th>Temei Luare</th><th>Data Scoatere</th><th>Temei Scoatere</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 6 : 5}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mPers', 'Înscriere Securitate', `
                        <div class="f"><label>Tip Securitate</label><select id="p_tip">${opts(meta.tipSecur)}</select></div>
                        <div class="grid-2">
                            <div class="f"><label>Data Luării</label><input class="dp" id="p_bdate"></div>
                            <div class="f"><label>Data Scoatere</label><input class="dp" id="p_edate"></div>
                        </div>
                        <div class="f"><label>Temei Luare</label><textarea id="p_tluare"></textarea></div>
                        <div class="f"><label>Temei Scoatere</label><textarea id="p_tscoate"></textarea></div>
                    `, 'window.secOps.addPers') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            loadData();
        }
    };

    // --- GLOBAL OPERATIONS ---
    window.secOps = {
        addAuth: async () => {
            await api.post(`/detinut/${getIdnp()}/securitate/autoritate`, {
                id_status_crim: document.getElementById('a_stat').value,
                aliass: document.getElementById('a_alias').value,
                bdate: document.getElementById('a_bdate').value,
                edate: document.getElementById('a_edate').value,
                motiv: document.getElementById('a_motiv').value
            });
            document.getElementById('mAuth').classList.remove('open');
            window.DetinutTabs['autoritate'].render(document.querySelector('#secSubContent'));
        },
        addEsc: async () => {
            await api.post(`/detinut/${getIdnp()}/securitate/evadare`, {
                id_penitenciar: document.getElementById('e_pen').value,
                out_date: document.getElementById('e_out').value,
                in_date: document.getElementById('e_in').value,
                hunter: document.getElementById('e_hunt').value
            });
            document.getElementById('mEsc').classList.remove('open');
            window.DetinutTabs['evadare'].render(document.querySelector('#secSubContent'));
        },
        addPers: async () => {
            await api.post(`/detinut/${getIdnp()}/securitate/pers`, {
                id_tip: document.getElementById('p_tip').value,
                bdate: document.getElementById('p_bdate').value,
                edate: document.getElementById('p_edate').value,
                temei_luare: document.getElementById('p_tluare').value,
                temei_scoate: document.getElementById('p_tscoate').value
            });
            document.getElementById('mPers').classList.remove('open');
            window.DetinutTabs['securitate_personala'].render(document.querySelector('#secSubContent'));
        },
        del: async (type, id) => {
            if(!confirm('Sigur ștergeți?')) return;
            const subKey = type === 'pers' ? 'securitate_personala' : type;
            await api.del(`/detinut/securitate/${type}/${id}`);
            window.DetinutTabs[subKey].render(document.querySelector('#secSubContent'));
        }
    };

    // --- MASTER TAB ---
    window.DetinutTabs['securitate'] = {
        render: async (container) => {
            await ensurePermissions(); // Load perms first
            
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
                    
                    .pill-purple.active { background: #8b5cf6; border-color: #8b5cf6; }
                    .pill-red.active { background: #ef4444; border-color: #ef4444; }

                    #secSubContent { min-height: 400px; animation: fadeIn 0.3s ease-out; }
                </style>

                <div class="regim-sub-nav">
                    <button class="regim-pill active" onclick="window.secMaster.switch('securitate_personala', this)">🛡️ Securitate Personală</button>
                    <button class="regim-pill pill-purple" onclick="window.secMaster.switch('autoritate', this)">👑 Autoritate</button>
                    <button class="regim-pill pill-red" onclick="window.secMaster.switch('evadare', this)">🏃 Evadare</button>
                </div>
                
                <div id="secSubContent">
                    <div class="loader-box">Se inițializează...</div>
                </div>
            `;

            window.secMaster = {
                switch: async (subKey, btnEl) => {
                    container.querySelectorAll('.regim-pill').forEach(b => b.classList.remove('active'));
                    if(btnEl) btnEl.classList.add('active');

                    const contentDiv = document.getElementById('secSubContent');
                    contentDiv.innerHTML = '<div class="loader-box">Se încarcă...</div>';

                    const module = window.DetinutTabs[subKey];
                    if (module && module.render) {
                        try { await module.render(contentDiv); } 
                        catch (e) { contentDiv.innerHTML = `<div class="error-box">Eroare sub-modul: ${e.message}</div>`; }
                    } else {
                        contentDiv.innerHTML = `<div class="error-box">Sub-modulul '${subKey}' nu a fost găsit.</div>`;
                    }
                }
            };
            // Default load
            window.secMaster.switch('securitate_personala', container.querySelector('.regim-pill'));
        }
    };
})();