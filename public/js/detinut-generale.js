(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    let meta = null;
    let _detId = null;
    let _idnp = null;

    // --- UTILS ---
    async function fetchMeta() {
        if(meta) return;
        try {
            const res = await window.prisonApi.get('/detinut/meta/general');
            if(res.success) meta = res;
        } catch(e) { console.error("Failed to load meta", e); }
    }

    function safeVal(v) { return v || '—'; }

    // --- HTML GENERATORS ---
    function renderViewField(label, value) {
        return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value" style="font-weight:600; color:#334155;">${safeVal(value)}</span></div>`;
    }

    function renderEditField(label, name, value, type='text', options=[]) {
        if(type === 'select') {
            const opts = options.map(o => `<option value="${o.ID}" ${String(o.ID) === String(value) ? 'selected' : ''}>${o.NAME}</option>`).join('');
            return `<div class="f"><label>${label}</label><select name="${name}" class="full-width"><option value="">- Select -</option>${opts}</select></div>`;
        }
        return `<div class="f"><label>${label}</label><input type="${type}" name="${name}" value="${value||''}" class="full-width" autocomplete="off"></div>`;
    }

    // --- MODAL INJECTOR ---
    function injectModals() {
        if(document.getElementById('photoModal')) return;

        const html = `
        <!-- PHOTO MODAL -->
        <div class="modal-overlay" id="photoModal"><div class="modal-card">
            <div class="modal-header"><h3>Gestionare Foto</h3><button class="btn-close" onclick="closeModal('photoModal')">×</button></div>
            <div class="modal-body">
                <div class="f mb-2"><label>Tip Fotografie</label><select id="photoType" class="full-width"><option value="1">1. Frontal</option><option value="2">2. Lateral</option><option value="3">3. Semne Particulare</option><option value="4">4. Tatuaje</option></select></div>
                <div class="upload-area" id="dropArea"><div class="upload-icon">☁️</div><div class="upload-text">Trage imagine aici sau click</div><input type="file" id="photoInput" accept="image/*" hidden><div class="upload-preview" id="photoPreview"></div></div>
            </div>
            <div class="modal-footer"><button class="btn-ghost" onclick="closeModal('photoModal')">Anulează</button><button class="btn-primary" id="btnSavePhoto" disabled>Încarcă</button></div>
        </div></div>

        <!-- ACT MODAL -->
        <div class="modal-overlay" id="actModal"><div class="modal-card">
            <div class="modal-header"><h3>Adaugă Act Identitate</h3><button class="btn-close" onclick="closeModal('actModal')">×</button></div>
            <div class="modal-body"><form id="formAct" class="admin-form">
                <div class="f"><label>Tip Document</label><select name="id_tip" id="actTip" class="full-width"></select></div>
                <div class="f"><label>Număr Document</label><input type="text" name="nr_doc" class="full-width"></div>
                <div class="f"><label>Eliberat de</label><input type="text" name="issued_by" class="full-width"></div>
                <div class="admin-grid-2">
                    <div class="f"><label>Data Eliberării</label><input type="text" name="date_issue" class="datepicker" placeholder="DD.MM.YYYY"></div>
                    <div class="f"><label>Valabil Până</label><input type="text" name="date_exp" class="datepicker" placeholder="DD.MM.YYYY"></div>
                </div>
            </form></div>
            <div class="modal-footer"><button class="btn-ghost" onclick="closeModal('actModal')">Anulează</button><button class="btn-primary" onclick="submitAct()">Salvează</button></div>
        </div></div>

        <!-- JOB MODAL -->
        <div class="modal-overlay" id="jobModal"><div class="modal-card">
            <div class="modal-header"><h3>Adaugă Loc de Muncă</h3><button class="btn-close" onclick="closeModal('jobModal')">×</button></div>
            <div class="modal-body"><form id="formJob" class="admin-form">
                <div class="f"><label>Locul de Muncă (Instituția)</label><input type="text" name="place" class="full-width"></div>
                <div class="f"><label>Profesia / Funcția</label><select name="id_prof" id="jobProf" class="full-width"></select></div>
                <div class="f"><label>Data Angajării</label><input type="text" name="date_start" class="datepicker" placeholder="DD.MM.YYYY"></div>
            </form></div>
            <div class="modal-footer"><button class="btn-ghost" onclick="closeModal('jobModal')">Anulează</button><button class="btn-primary" onclick="submitJob()">Salvează</button></div>
        </div></div>

        <!-- NEW: CITIZEN MODAL -->
        <div class="modal-overlay" id="citModal"><div class="modal-card" style="max-width:400px;">
            <div class="modal-header"><h3>Adaugă Cetățenie</h3><button class="btn-close" onclick="closeModal('citModal')">×</button></div>
            <div class="modal-body"><form id="formCit" class="admin-form">
                <div class="f"><label>Țara</label><select name="id_sitizen" id="citList" class="full-width"></select></div>
                <div class="f"><label>Data Dobândirii (Opțional)</label><input type="text" name="bdate" class="datepicker" placeholder="DD.MM.YYYY"></div>
            </form></div>
            <div class="modal-footer"><button class="btn-ghost" onclick="closeModal('citModal')">Anulează</button><button class="btn-primary" onclick="submitCit()">Adaugă</button></div>
        </div></div>

        <!-- NEW: ADDRESS MODAL -->
        <div class="modal-overlay" id="addrModal"><div class="modal-card">
            <div class="modal-header"><h3>Adaugă Domiciliu</h3><button class="btn-close" onclick="closeModal('addrModal')">×</button></div>
            <div class="modal-body"><form id="formAddr" class="admin-form">
                <div class="f">
                    <label>Localitate</label>
                    <select name="locality_id" id="addrLoc" class="full-width search-select"></select>
                </div>
                <div class="f"><label>Adresa Exactă (Strada, Nr)</label><input type="text" name="address" class="full-width"></div>
                <div class="f"><label>Data Înregistrării</label><input type="text" name="start_date" class="datepicker" placeholder="DD.MM.YYYY" value="${new Date().toLocaleDateString('ro-RO')}"></div>
            </form></div>
            <div class="modal-footer"><button class="btn-ghost" onclick="closeModal('addrModal')">Anulează</button><button class="btn-primary" onclick="submitAddr()">Salvează</button></div>
        </div></div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    // --- MAIN RENDER ---
    window.DetinutTabs['generale'] = {
        render: async (container, detinutId) => {
            _detId = detinutId;
            injectModals();
            
            try {
                await fetchMeta();
                const res = await window.prisonApi.get(`/detinut/${detinutId}/general_full`);
                if(!res.success) throw new Error(res.error);

                const { detinut, canEdit, images, citizenships, acts, employment, address } = res;
                _idnp = detinut.IDNP;

                // --- Setup Toggle Function for Edit Mode ---
                window.toggleEditMode = () => {
                     const view = document.getElementById('viewMode');
                     const edit = document.getElementById('editForm');
                     const btn = document.getElementById('portal-edit-btn');
                     
                     if(!view || !edit) return;

                     const isEditing = edit.classList.contains('hidden');
                     
                     if (isEditing) {
                        view.classList.add('hidden');
                        edit.classList.remove('hidden');
                        if(btn) {
                            btn.innerHTML = '❌ Anulează';
                            btn.classList.add('active');
                        }
                     } else {
                        view.classList.remove('hidden');
                        edit.classList.add('hidden');
                        if(btn) {
                            btn.innerHTML = '✏️ Editează Date';
                            btn.classList.remove('active');
                        }
                     }
                };

                // --- INJECT EDIT BUTTON INTO HEADER ---
                // We now target #headerActions explicitly created by shell.js
                // Clear existing first
                const actionContainer = document.getElementById('headerActions');
                if(actionContainer) actionContainer.innerHTML = '';
                
                if(canEdit && actionContainer) {
                    const editBtn = document.createElement('button');
                    editBtn.id = 'portal-edit-btn';
                    editBtn.className = 'btn-compact-edit';
                    editBtn.innerHTML = '✏️ Editează Date';
                    editBtn.onclick = window.toggleEditMode;
                    actionContainer.appendChild(editBtn);
                }

                // UI
                container.innerHTML = `
                <div class="profile-page-wrapper">
                    <!-- VIEW MODE (Cards Grid) -->
                    <div id="viewMode">
                        <div class="gen-grid-3">
                            <div class="admin-panel">
                                <div class="profile-section-title">👤 Identitate</div>
                                <div class="detail-stack">
                                    ${renderViewField('Nume', detinut.SURNAME)}
                                    ${renderViewField('Prenume', detinut.NAME)}
                                    ${renderViewField('Patronimic', detinut.SEC_NAME)}
                                    ${renderViewField('IDNP', detinut.IDNP)}
                                    ${renderViewField('Data Nașterii', detinut.BIRDTH_STR)}
                                    ${renderViewField('Sex', detinut.SEX)}
                                </div>
                            </div>
                            <div class="admin-panel">
                                <div class="profile-section-title">⚖️ Statut & Social</div>
                                <div class="detail-stack">
                                    ${renderViewField('Statut Juridic', detinut.STATUT_NAME)}
                                    ${renderViewField('Stare Civilă', detinut.MARITAL_NAME)}
                                    ${renderViewField('Religie', detinut.RELIGION_NAME)}
                                    ${renderViewField('Studii', detinut.EDU_NAME)}
                                    ${renderViewField('Naționalitate', detinut.NATIONALITY_NAME)}
                                </div>
                            </div>
                            <div class="admin-panel">
                                <div class="profile-section-title">🌍 Origine & Domiciliu</div>
                                <div class="mb-2">
                                    <div class="flex-between">
                                        <span class="detail-label block">Cetățenie</span>
                                        ${canEdit ? `<button class="btn-tiny" onclick="openCitModal()">+ Adaugă</button>` : ''}
                                    </div>
                                    <div class="badges mt-1">
                                        ${citizenships.map(c => `<span class="badge badge-read">${c.NAME} ${canEdit?`<b class="del-x" onclick="delCit(${c.ID})">×</b>`:''}</span>`).join('')}
                                    </div>
                                </div>
                                <div class="mt-4">
                                    <div class="flex-between">
                                        <span class="detail-label">Domiciliu</span>
                                        ${canEdit ? `<button class="btn-tiny" onclick="openAddrModal()">+ Adaugă</button>` : ''}
                                    </div>
                                    <ul class="addr-list mt-1">
                                       ${address.map(a => `<li><b>${a.START_DATE_STR}</b>: ${a.CITY}, ${a.ADDRESS} ${canEdit?`<span class="del-x" onclick="delAddr(${a.ID})">×</span>`:''}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div class="gen-grid-3 mt-4" style="grid-template-columns: 1fr 1fr;">
                            <div class="admin-panel">
                                <div class="flex-between mb-2">
                                    <div class="profile-section-title m-0 border-0">🪪 Acte de Identitate</div>
                                    ${canEdit ? `<button class="btn-tiny" onclick="openActModal()">+ Adaugă</button>` : ''}
                                </div>
                                <table class="compact-table">
                                    <thead><tr><th>Tip</th><th>Număr</th><th>Eliberat</th><th>Expiră</th><th></th></tr></thead>
                                    <tbody>
                                        ${acts.map(a => `<tr><td>${a.TIP_DOC}</td><td><b>${a.NRDOCUMENT}</b></td><td>${a.ELIBERAT_DE||'-'}</td><td>${a.EXP_STR}</td><td class="text-right">${canEdit?`<button class="btn-danger btn-small" onclick="delAct(${a.ID})">×</button>`:''}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="admin-panel">
                                <div class="flex-between mb-2">
                                    <div class="profile-section-title m-0 border-0">💼 Loc de Muncă</div>
                                    ${canEdit ? `<button class="btn-tiny" onclick="openJobModal()">+ Adaugă</button>` : ''}
                                </div>
                                <table class="compact-table">
                                    <thead><tr><th>Loc Muncă</th><th>Profesie</th><th>Data</th><th></th></tr></thead>
                                    <tbody>
                                        ${employment.map(e => `<tr><td>${e.PLACE}</td><td>${e.PROFESSION || '-'}</td><td>${e.START_DATE}</td><td class="text-right">${canEdit?`<button class="btn-danger btn-small" onclick="delJob(${e.ID})">×</button>`:''}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="admin-panel mt-4">
                            <div class="flex-between">
                                <div class="profile-section-title">Galerie Foto</div>
                                ${canEdit ? `<button class="btn-tiny" onclick="openPhotoModal()">Gestionare Foto</button>`:''}
                            </div>
                            <div class="gallery-row">
                                ${images.map(img => `<div class="gallery-item"><a href="${img.url}" target="_blank"><img src="${img.url}"></a></div>`).join('')}
                                ${images.length === 0 ? '<span class="text-muted p-2">Fără fotografii.</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- EDIT FORM (Hidden by default) -->
                    <form id="editForm" class="admin-panel hidden">
                        <div class="profile-section-title mb-4">Editare Date Principale</div>
                        <div class="gen-grid-3">
                            ${renderEditField('Nume', 'surname', detinut.SURNAME)}
                            ${renderEditField('Prenume', 'name', detinut.NAME)}
                            ${renderEditField('Patronimic', 'sec_name', detinut.SEC_NAME)}
                            ${renderEditField('Data Nașterii', 'birth', detinut.BIRDTH_STR)}
                            ${renderEditField('Sex', 'sex', detinut.SEX, 'select', [{ID:'M',NAME:'M'},{ID:'F',NAME:'F'}])}
                            ${renderEditField('Colaborator?', 'wpolice', detinut.WPOLICE, 'select', [{ID:'N',NAME:'NU'},{ID:'Y',NAME:'DA'}])}
                            ${renderEditField('Naționalitate', 'id_nat', detinut.ID_SPR_NATIONALITY, 'select', meta.nationality)}
                            ${renderEditField('Religie', 'id_rel', detinut.ID_SPR_RELIGION, 'select', meta.religion)}
                            ${renderEditField('Stare Civilă', 'id_mar', detinut.ID_MAR_STATUS, 'select', meta.marital)}
                            ${renderEditField('Studii', 'id_edu', detinut.ID_SPR_EDU_LEVEL, 'select', meta.edu)}
                            ${renderEditField('Categ. Socială', 'id_categ', detinut.ID_SPR_CATEG_SOCIAL, 'select', meta.social)}
                            ${renderEditField('Sănătate', 'id_health', detinut.ID_HEALTH_STAT, 'select', meta.health)}
                        </div>
                        <div class="form-buttons right mt-4">
                            <button type="button" class="btn-ghost" onclick="toggleEditMode()">Anulează</button>
                            <button type="submit" class="btn-primary">Salvează</button>
                        </div>
                    </form>
                </div>`;

                if(canEdit) {
                    document.getElementById('editForm').onsubmit = async (e) => {
                        e.preventDefault();
                        try { await window.prisonApi.post(`/detinut/${detinutId}/update_main`, Object.fromEntries(new FormData(e.target))); reload(); } catch(err) { alert(err.message); }
                    };
                    
                    window.openActModal = () => { fillSelect('actTip', meta.docTypes); openM('actModal'); };
                    window.openJobModal = () => { fillSelect('jobProf', meta.professions); openM('jobModal'); };
                    window.openCitModal = () => { fillSelect('citList', meta.citizen); openM('citModal'); };
                    window.openAddrModal = () => { fillSelect('addrLoc', meta.locality); openM('addrModal'); };
                    window.openPhotoModal = () => { setupDragDrop(); openM('photoModal'); };
                }

            } catch(e) {
                container.innerHTML = `<div class="error-box">Eroare încărcare profil: ${e.message}</div>`;
            }
        }
    };

    // --- LOGIC ---
    function reload() { window.DetinutTabs['generale'].render(document.getElementById('profileContent'), _detId); }
    function openM(id) { document.getElementById(id).classList.add('open'); }
    window.closeModal = (id) => document.getElementById(id).classList.remove('open');
    function fillSelect(id, items) { 
        const el = document.getElementById(id); 
        el.innerHTML = '<option value="">- Selectează -</option>' + items.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join(''); 
    }

    // Submit Handlers
    window.submitAct = async () => { await postForm('formAct', `/detinut/${_idnp}/acte`, 'actModal'); };
    window.submitJob = async () => { await postForm('formJob', `/detinut/${_idnp}/employment`, 'jobModal'); };
    window.submitCit = async () => { await postForm('formCit', `/detinut/${_idnp}/citizenship`, 'citModal'); };
    window.submitAddr = async () => { await postForm('formAddr', `/detinut/${_idnp}/address`, 'addrModal'); };

    async function postForm(formId, url, modalId) {
        const form = document.getElementById(formId);
        try { await window.prisonApi.post(url, Object.fromEntries(new FormData(form))); window.closeModal(modalId); reload(); } 
        catch(e){alert(e.message);}
    }

    // Deletes
    window.delCit = (id) => delC(`/detinut/citizenship/${id}`);
    window.delAct = (id) => delC(`/detinut/acte/${id}`);
    window.delJob = (id) => delC(`/detinut/employment/${id}`);
    window.delAddr = (id) => delC(`/detinut/address/${id}`);
    
    async function delC(url) { 
        if(confirm('Sigur ștergeți?')) { 
            try { await window.prisonApi.del(url); reload(); }
            catch(e) { alert(e.message); }
        } 
    }

    // Drag Drop
    function setupDragDrop() {
        const da = document.getElementById('dropArea'), inp = document.getElementById('photoInput'), pre = document.getElementById('photoPreview'), btn = document.getElementById('btnSavePhoto');
        let file;
        da.onclick = () => inp.click();
        inp.onchange = () => { file=inp.files[0]; showP(file); };
        da.ondragover = (e) => { e.preventDefault(); da.classList.add('dragover'); };
        da.ondragleave = () => da.classList.remove('dragover');
        da.ondrop = (e) => { e.preventDefault(); da.classList.remove('dragover'); file=e.dataTransfer.files[0]; showP(file); };
        function showP(f) { if(f && f.type.startsWith('image/')) { const r = new FileReader(); r.onload=e=>{ pre.innerHTML=`<img src="${e.target.result}" class="preview-img">`; btn.disabled=false; }; r.readAsDataURL(f); } }
        btn.onclick = async () => {
            if(!file) return;
            const fd = new FormData(); fd.append('image', file); fd.append('type', document.getElementById('photoType').value);
            btn.innerText = 'Se încarcă...';
            btn.disabled = true;
            
            // Raw fetch because api wrapper usually handles JSON, and this is Multipart
            try {
                const res = await fetch(`/api/detinut/${_detId}/photos`, { 
                    method:'POST', 
                    headers:{"x-user-id":sessionStorage.getItem("prison.userId")}, 
                    body:fd 
                });
                const d = await res.json();
                if(!d.success) throw new Error(d.error);
                window.closeModal('photoModal'); 
                reload();
            } catch(e) {
                alert("Eroare upload: " + e.message);
                btn.innerText = 'Încarcă';
                btn.disabled = false;
            }
        };
    }
})();