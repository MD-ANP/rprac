(function () {
    window.DetinutTabs = window.DetinutTabs || {};
    const api = window.prisonApi;
    
    let meta = {}; 
    let userPerms = {}; 
    let permsLoaded = false;

    // --- CONSTANTS ---
    const MODS = {
        INTREVEDERI: 29,
        COLETE: 30,
        TEHNICA: 31,
        INCIDENTE: 32, 
        DEPLASARI: 33
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
            const res = await api.get('/detinut/meta/combined');
            if (res.success) {
                meta = res.meta;
                meta.loaded = true;
            }
        } catch (e) { console.error("Meta load failed", e); }
    }

    async function ensurePermissions() {
        if (permsLoaded) return;
        try {
            const res = await api.get('/detinut/permissions/regim');
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
                .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
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

    // --- 1. INTREVEDERI (Meetings) ---
    window.DetinutTabs['intrevederi'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]); 
            const idnp = getIdnp();
            const editable = canEdit(MODS.INTREVEDERI);

            if(!idnp) return container.innerHTML = '<div class="error-box">Lipsă IDNP</div>';

            const loadData = async () => {
                container.innerHTML = '<div class="loader-box">Se încarcă...</div>';
                const res = await api.get(`/detinut/${idnp}/intrevederi`);
                if(!res.success) return container.innerHTML = `<div class="error-box">${res.error}</div>`;
                
                const rowsHtml = (res.rows || []).map(r => `
                    <tr>
                        <td>${r.NAME_DURATION || '-'}</td>
                        <td>${fmt(r.BDATE)}</td>
                        <td>${fmt(r.EDATE)}</td>
                        <td>${r.NAME} ${r.SURNAME} ${r.SEC_NAME || ''}</td>
                        <td>${r.NRDOCUMENT || '-'}</td>
                        <td>${r.NAME_RELATIVE_TYPE || '-'}</td>
                        <td>${r.COMMENTS || ''}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.meetingOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2 style="color:#2563eb">Întrevederi</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalMeeting').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Tip</th><th>Început</th><th>Sfârșit</th><th>NPP</th><th>Document</th><th>Rudenie</th><th>Notă</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml || `<tr><td colspan="${editable ? 8 : 7}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalMeeting', 'Întrevedere Nouă', `
                        <div class="f"><label>Tip</label><select id="m_dur">${opts(meta.durations)}</select></div>
                        <div class="grid-2">
                            <div class="f"><label>Început</label><input type="text" class="dp" id="m_bdate"></div>
                            <div class="f"><label>Sfârșit</label><input type="text" class="dp" id="m_edate"></div>
                        </div>
                        <div class="grid-3">
                            <div class="f"><label>Nume</label><input type="text" id="m_name"></div>
                            <div class="f"><label>Prenume</label><input type="text" id="m_surname"></div>
                            <div class="f"><label>Patronimic</label><input type="text" id="m_sec"></div>
                        </div>
                        <div class="grid-2">
                            <div class="f"><label>Tip Doc</label><select id="m_tdoc">${opts(meta.docTypes)}</select></div>
                            <div class="f"><label>Nr Doc</label><input type="text" id="m_ndoc"></div>
                        </div>
                        <div class="f"><label>Rudenie</label><select id="m_rel">${opts(meta.relatives)}</select></div>
                        <div class="f"><label>Notă</label><textarea id="m_comm"></textarea></div>
                    `, 'window.meetingOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            
            window.meetingOps = {
                add: async () => {
                    const payload = {
                        id_duration: document.getElementById('m_dur').value,
                        bdate: document.getElementById('m_bdate').value,
                        edate: document.getElementById('m_edate').value,
                        name: document.getElementById('m_name').value,
                        surname: document.getElementById('m_surname').value,
                        sec_name: document.getElementById('m_sec').value,
                        id_tip_doc: document.getElementById('m_tdoc').value,
                        nrdoc: document.getElementById('m_ndoc').value,
                        id_rel_type: document.getElementById('m_rel').value,
                        comments: document.getElementById('m_comm').value
                    };
                    await api.post(`/detinut/${idnp}/intrevederi`, payload);
                    document.getElementById('modalMeeting').classList.remove('open');
                    loadData();
                },
                del: async (id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/intrevederi/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 2. COLETE ---
    window.DetinutTabs['colete'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.COLETE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/colete`);
                const rows = (res.rows||[]).map(r => `
                    <tr>
                        <td>${fmt(r.DATE_IN)}</td><td>${fmt(r.DATE_OPEN)}</td><td>${r.PERSON}</td><td>${r.CONTINUT}</td>
                        <td>${fmt(r.DATE_INMINARE)}</td><td>${r.NOT_ALLOWED}</td><td>${r.SURSA_PROV}</td><td>${r.COMMENTS}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.coletOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');

                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Colete</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalColet').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Sosire</th><th>Deschidere</th><th>NPP</th><th>Conținut</th><th>Înmânare</th><th>Interzise</th><th>Sursă</th><th>Notă</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 9 : 8}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalColet', 'Colet Nou', `
                        <div class="grid-3"><div class="f"><label>Sosire</label><input class="dp" id="c_di"></div><div class="f"><label>Deschidere</label><input class="dp" id="c_do"></div><div class="f"><label>Înmânare</label><input class="dp" id="c_dim"></div></div>
                        <div class="f"><label>NPP Colaborator</label><input id="c_pers"></div>
                        <div class="f"><label>Conținut</label><textarea id="c_cont"></textarea></div>
                        <div class="f"><label>Interzise</label><textarea id="c_na"></textarea></div>
                        <div class="f"><label>Sursă</label><input id="c_sursa"></div>
                        <div class="f"><label>Notă</label><textarea id="c_comm"></textarea></div>
                    `, 'window.coletOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.coletOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/colete`, {
                        date_in: document.getElementById('c_di').value, date_open: document.getElementById('c_do').value,
                        date_inm: document.getElementById('c_dim').value, person: document.getElementById('c_pers').value,
                        continut: document.getElementById('c_cont').value, not_allowed: document.getElementById('c_na').value,
                        sursa_prov: document.getElementById('c_sursa').value, comments: document.getElementById('c_comm').value
                    });
                    document.getElementById('modalColet').classList.remove('open');
                    loadData();
                },
                del: async(id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/colete/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 3. TEHNICA ---
    window.DetinutTabs['tehnica'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.TEHNICA);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/tehnica`);
                const rows = (res.rows||[]).map(r => `
                    <tr>
                        <td>${fmt(r.ADATE)}</td><td>${r.NPP}</td><td>${r.NAME_TIP_DOCUMENT}</td><td>${r.NRDOCUMENT}</td>
                        <td>${r.NAME_TIP_TEHNICA}</td><td>${r.MODEL}</td><td>${r.SERIA}</td><td>${r.NAME_ID_PENETENTIAR}</td>
                        <td>${fmt(r.DATE_OUT)}</td><td>${r.MOTIV}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.techOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>`).join('');
                
                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Tehnică</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalTech').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>NPP</th><th>Doc</th><th>Nr</th><th>Tip</th><th>Model</th><th>Serie</th><th>Penitenciar</th><th>Scoatere</th><th>Motiv</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 11 : 10}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalTech', 'Tehnică Nouă', `
                        <div class="grid-2"><div class="f"><label>Data</label><input class="dp" id="t_adate"></div><div class="f"><label>NPP</label><input id="t_npp"></div></div>
                        <div class="grid-2"><div class="f"><label>Doc</label><select id="t_tdoc">${opts(meta.docTypes)}</select></div><div class="f"><label>Nr Doc</label><input id="t_ndoc"></div></div>
                        <div class="grid-3"><div class="f"><label>Tip</label><select id="t_type">${opts(meta.techTypes)}</select></div><div class="f"><label>Model</label><input id="t_mod"></div><div class="f"><label>Serie</label><input id="t_ser"></div></div>
                        <div class="f"><label>Penitenciar</label><select id="t_pen">${opts(meta.penitenciars)}</select></div>
                        <div class="grid-2"><div class="f"><label>Dată Scoatere</label><input class="dp" id="t_dout"></div><div class="f"><label>Motiv</label><input id="t_mot"></div></div>
                    `, 'window.techOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.techOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/tehnica`, {
                        adate: document.getElementById('t_adate').value, npp: document.getElementById('t_npp').value,
                        id_tip_doc: document.getElementById('t_tdoc').value, nrdoc: document.getElementById('t_ndoc').value,
                        tip_tehnica: document.getElementById('t_type').value, model: document.getElementById('t_mod').value,
                        seria: document.getElementById('t_ser').value, id_pen: document.getElementById('t_pen').value,
                        date_out: document.getElementById('t_dout').value, motiv: document.getElementById('t_mot').value
                    });
                    document.getElementById('modalTech').classList.remove('open');
                    loadData();
                },
                del: async(id)=>{ if(confirm('Ștergeți?')) { await api.del(`/detinut/tehnica/${id}`); loadData(); }}
            };
            loadData();
        }
    };

    // --- 4. ALTE DATE (Deplasari) ---
    window.DetinutTabs['altedate'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.DEPLASARI);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/deplasari`);
                const rows = (res.rows||[]).map(r => `
                    <tr>
                        <td>${fmt(r.ADATE)}</td><td>${r.NAME_PENITENCIAR}</td><td>${r.NAME_TIP_DEPLASARII}</td><td>${r.MOTIV}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.depOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>
                `).join('');
                container.innerHTML = `
                    <div class="admin-panel">
                        <div class="flex-between mb-4">
                            <h2>Deplasări (Alte Date)</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('modalDep').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Penitenciar</th><th>Tip</th><th>Motiv</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 5 : 4}" class="text-center text-muted">Lipsă date.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('modalDep', 'Deplasare Nouă', `
                        <div class="f"><label>Data</label><input class="dp" id="d_adate"></div>
                        <div class="f"><label>Penitenciar</label><select id="d_pen">${opts(meta.penitenciars)}</select></div>
                        <div class="f"><label>Tip</label><select id="d_tip">${opts(meta.depTypes)}</select></div>
                        <div class="f"><label>Motiv</label><textarea id="d_mot"></textarea></div>
                    `, 'window.depOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.depOps = {
                add: async () => {
                    await api.post(`/detinut/${idnp}/deplasari`, {
                        adate: document.getElementById('d_adate').value, id_pen: document.getElementById('d_pen').value,
                        id_tip: document.getElementById('d_tip').value, motiv: document.getElementById('d_mot').value
                    });
                    document.getElementById('modalDep').classList.remove('open');
                    loadData();
                },
                del: async(id)=>{ if(confirm('Ștergeți?')) { await api.del(`/detinut/deplasari/${id}`); loadData(); }}
            };
            loadData();
        }
    };

    // --- 5.1 PREDISPUS ---
    window.DetinutTabs['predispus'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.INCIDENTE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/incidente/predispus`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${fmt(r.ADATE)}</td>
                        <td><span style="color:#d97706; font-weight:bold;">${r.NAME_PREDISPUS}</span></td>
                        <td>${fmt(r.EDATE)}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.predOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>`).join('');
                
                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #f59e0b;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#b45309">⚠️ Evidență: Predispus la...</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mPred').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data Luării</th><th>Caracteristica</th><th>Data Scoatere</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 4 : 3}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mPred', 'Adaugă Caracteristică', `
                        <div class="f"><label>Data Luării</label><input class="dp" id="ip_adate"></div>
                        <div class="f"><label>Predispus la</label><select id="ip_id">${opts(meta.predispus)}</select></div>
                        <div class="f"><label>Data Scoatere (Opțional)</label><input class="dp" id="ip_edate"></div>
                    `, 'window.predOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.predOps = {
                add: async () => { 
                    await api.post(`/detinut/${idnp}/incidente/predispus`, { adate: document.getElementById('ip_adate').value, id_pred: document.getElementById('ip_id').value, edate: document.getElementById('ip_edate').value }); 
                    document.getElementById('mPred').classList.remove('open');
                    loadData(); 
                },
                del: async (id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/incidente/predispus/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 5.2 CONSTRINGERE ---
    window.DetinutTabs['constringere'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.INCIDENTE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/incidente/constringere`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${fmt(r.ADATE)}</td>
                        <td><span style="font-weight:600">${r.NAME_TIP_MASURA}</span></td>
                        <td>${r.NAME_PENITENCIAR}</td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.consOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>`).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #ef4444;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#b91c1c">🛑 Măsuri de Constrângere</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mCons').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data Aplicării</th><th>Măsura</th><th>Penitenciar</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 4 : 3}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mCons', 'Adaugă Măsură', `
                        <div class="f"><label>Data</label><input class="dp" id="ic_adate"></div>
                        <div class="f"><label>Măsura</label><select id="ic_id">${opts(meta.measures)}</select></div>
                        <div class="f"><label>Penitenciar</label><select id="ic_pen">${opts(meta.penitenciars)}</select></div>
                    `, 'window.consOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.consOps = {
                add: async () => { 
                    await api.post(`/detinut/${idnp}/incidente/constringere`, { adate: document.getElementById('ic_adate').value, id_tip: document.getElementById('ic_id').value, id_pen: document.getElementById('ic_pen').value }); 
                    document.getElementById('mCons').classList.remove('open');
                    loadData(); 
                },
                del: async (id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/incidente/constringere/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- 5.3 OBIECTE INTERZISE ---
    window.DetinutTabs['obiecte'] = {
        render: async (container) => {
            await Promise.all([ensureMeta(), ensurePermissions()]);
            const idnp = getIdnp();
            const editable = canEdit(MODS.INCIDENTE);

            const loadData = async () => {
                const res = await api.get(`/detinut/${idnp}/incidente/obiecte`);
                const rows = (res.rows || []).map(r => `
                    <tr>
                        <td>${fmt(r.ADATE)}</td>
                        <td style="color:#be123c; font-weight:bold;">${r.NAME_OBIECTE_INTERZISE}</td>
                        <td>${r.PLACE || '-'}</td>
                        <td>${r.NAME_MOTAL_PERC || '-'}</td>
                        <td><small>${r.COMMENTS || ''}</small></td>
                        ${editable ? `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.objOps.del(${r.ID})">×</button></td>` : ''}
                    </tr>`).join('');

                container.innerHTML = `
                    <div class="admin-panel" style="border-top: 4px solid #10b981;">
                        <div class="flex-between mb-4">
                            <h2 style="color:#047857">🔫 Obiecte Interzise Depistate</h2>
                            ${editable ? `<button class="btn-primary" onclick="document.getElementById('mObj').classList.add('open')">Adaugă</button>` : ''}
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Obiect</th><th>Loc Depistare</th><th>Modalitate</th><th>Note</th>
                                        ${editable ? `<th>Acțiuni</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows || `<tr><td colspan="${editable ? 6 : 5}" class="text-center text-muted">Nu există înregistrări.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                    ${editable ? getModalHtml('mObj', 'Raport Obiect Interzis', `
                        <div class="f"><label>Data</label><input class="dp" id="io_adate"></div>
                        <div class="f"><label>Obiect</label><select id="io_id">${opts(meta.forbidden)}</select></div>
                        <div class="grid-2">
                            <div class="f"><label>Loc Ascundere</label><input id="io_place" placeholder="Ex: Buzunar"></div>
                            <div class="f"><label>Modalitate</label><select id="io_mod">${opts(meta.searchModes)}</select></div>
                        </div>
                        <div class="f"><label>Mențiuni (Note)</label><textarea id="io_comm"></textarea></div>
                    `, 'window.objOps.add') : ''}
                `;
                if(editable && window.flatpickr) window.flatpickr(".dp", { dateFormat: "d.m.Y" });
            };
            window.objOps = {
                add: async () => { 
                    try {
                        const payload = { 
                            adate: document.getElementById('io_adate').value, 
                            id_ob: document.getElementById('io_id').value, 
                            place: document.getElementById('io_place').value, 
                            id_modal: document.getElementById('io_mod').value, 
                            comments: document.getElementById('io_comm').value 
                        };
                        const res = await api.post(`/detinut/${idnp}/incidente/obiecte`, payload);
                        if(res.success) {
                             document.getElementById('mObj').classList.remove('open');
                             loadData();
                        } else {
                            alert("Eroare: " + (res.error || "Unknown"));
                        }
                    } catch(e) { console.error(e); alert("Eroare conexiune"); }
                },
                del: async (id) => { if(confirm('Ștergeți?')) { await api.del(`/detinut/incidente/obiecte/${id}`); loadData(); } }
            };
            loadData();
        }
    };

    // --- MASTER TAB: REGIM ---
    window.DetinutTabs['regim'] = {
        render: async (container) => {
            // Load permissions on init so we have them cached for sub-tabs
            await ensurePermissions();

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
                    
                    /* Colors for specific pills */
                    .pill-warn.active { background: #f59e0b; border-color: #f59e0b; }
                    .pill-danger.active { background: #ef4444; border-color: #ef4444; }
                    .pill-green.active { background: #10b981; border-color: #10b981; }

                    #regimSubContent { min-height: 400px; animation: fadeIn 0.3s ease-out; }
                </style>

                <div class="regim-sub-nav">
                    <button class="regim-pill active" onclick="window.regimMaster.switch('intrevederi', this)">🤝 Întrevederi</button>
                    <button class="regim-pill" onclick="window.regimMaster.switch('colete', this)">📦 Colete</button>
                    <button class="regim-pill" onclick="window.regimMaster.switch('tehnica', this)">📱 Tehnică</button>
                    <button class="regim-pill" onclick="window.regimMaster.switch('altedate', this)">🚌 Deplasări</button>
                    
                    <div style="width:1px; background:#e2e8f0; margin:0 5px;"></div>

                    <button class="regim-pill pill-warn" onclick="window.regimMaster.switch('predispus', this)">⚠️ Predispus</button>
                    <button class="regim-pill pill-danger" onclick="window.regimMaster.switch('constringere', this)">🛑 Constrângeri</button>
                    <button class="regim-pill pill-green" onclick="window.regimMaster.switch('obiecte', this)">🔫 Obiecte</button>
                </div>
                
                <div id="regimSubContent">
                    <div class="loader-box">Se inițializează...</div>
                </div>
            `;

            window.regimMaster = {
                switch: async (subKey, btnEl) => {
                    container.querySelectorAll('.regim-pill').forEach(b => b.classList.remove('active'));
                    if(btnEl) btnEl.classList.add('active');

                    const contentDiv = document.getElementById('regimSubContent');
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
            // Load default
            window.regimMaster.switch('intrevederi', container.querySelector('.regim-pill'));
        }
    };
})();