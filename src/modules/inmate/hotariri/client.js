(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    
    // State
    let meta = null;
    let _idnp = null;
    let _canWrite = false;

    // --- HELPERS ---

    // DB returns "2023-11-20T10:00:00.000Z" OR "20.11.2023"
    // We want PURE "20.11.2023" with no time.
    function formatDisplayDate(val) {
        if (!val) return '';
        let str = String(val);
        
        // If it contains "T", chop it off immediately to avoid timezone shifts
        if (str.includes('T')) {
            str = str.split('T')[0]; // "2023-11-20"
        }

        // If it matches YYYY-MM-DD
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = str.split('-');
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }

        // If it matches DD.MM.YYYY, return as is
        if (str.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            return str;
        }

        return str; // Fallback
    }

    // Convert API/DB format to Input format (YYYY-MM-DD)
    function toInputDate(val) {
        if (!val) return "";
        let str = String(val);

        if (str.includes('T')) {
            str = str.split('T')[0];
            return str;
        }
        
        // Handle DD.MM.YYYY -> YYYY-MM-DD
        if (str.includes('.')) {
            const parts = str.split(".");
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        return str;
    }

    // Convert Input format (YYYY-MM-DD) to API/DB format (DD.MM.YYYY)
    function toDbDate(str) {
        if (!str) return "";
        const parts = str.split("-");
        if (parts.length !== 3) return str;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    async function fetchMeta() {
        if (meta) return;
        const res = await window.prisonApi.get('/detinut/meta/hotariri');
        if (res.success) meta = res;
    }

    function opts(items, selectedId) {
        return '<option value="">- Selectați -</option>' + 
               (items || []).map(i => `<option value="${i.ID}" ${String(i.ID) === String(selectedId) ? 'selected' : ''}>${i.NAME}</option>`).join('');
    }

    // --- RENDER MAIN ---
    async function render(container, detinutId) {
        _idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
        if (!_idnp) {
            container.innerHTML = '<div class="error-box">Lipsă IDNP.</div>';
            return;
        }

        container.innerHTML = `<div class="loader-box">Se încarcă hotărârile...</div>`;

        try {
            await fetchMeta();
            const data = await window.prisonApi.get(`/detinut/${_idnp}/hotariri`);
            
            _canWrite = data.canWrite;

            // Polished CSS injection
            const style = `
            <style>
                /* Modal Polish */

                .art-badge {
                display: inline-block;
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                color: #334155;
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                margin-right: 4px;
                margin-top: 4px;
                }

                .modal-overlay {
                    backdrop-filter: blur(2px);
                    background: rgba(0,0,0,0.5);
                }
                .modal-hotariri {
                    display: flex;
                    flex-direction: column;
                    max-height: 85vh; /* Fit within viewport */
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                }
                .modal-hotariri .modal-body {
                    overflow-y: auto;
                    padding: 20px;
                    background: #fff;
                }
                .modal-hotariri .modal-footer {
                    border-top: 1px solid #e2e8f0;
                    padding: 15px 20px;
                    background: #f8fafc;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }

                /* Grid Layout */
                .hotarire-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                .full-width { grid-column: 1 / -1; }
                
                /* Labels & Inputs */
                .form-group label {
                    display: block;
                    font-size: 0.75rem;
                    color: #475569;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    transition: border-color 0.2s;
                }
                .form-group input:focus, .form-group select:focus {
                    border-color: #3b82f6;
                    outline: none;
                }
                
                /* Read-Only Mode */
                .form-group input:disabled, .form-group select:disabled, .form-group textarea:disabled {
                    background-color: #f8fafc;
                    color: #334155;
                    border-color: #e2e8f0;
                    cursor: not-allowed;
                }

                /* Section Headers */
                .section-header {
                    grid-column: 1 / -1;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #1e293b;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 5px;
                    margin-top: 15px;
                    margin-bottom: 10px;
                }
                .section-header:first-child { margin-top: 0; }

                /* Term Inputs Group */
                .term-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #f1f5f9;
                    padding: 5px;
                    border-radius: 6px;
                }
                .term-wrapper { display: flex; flex-direction: column; align-items: center; flex: 1; }
                .term-wrapper input { text-align: center; font-weight: bold; }
                .term-wrapper span { font-size: 0.65rem; color: #64748b; margin-top: 2px; }

                /* Data Table adjustments */
                .data-table th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 0.8rem; }
                .data-table td { vertical-align: middle; font-size: 0.9rem; }
                
                /* Sub-modal Add Section */
                .sub-add-box {
                    margin-bottom:10px; 
                    padding:10px; 
                    background:#f1f5f9; 
                    border-radius:6px; 
                    border:1px solid #e2e8f0;
                }
            </style>`;

            let html = style + `
                <div class="admin-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3>Hotărâri Active</h3>
                        ${_canWrite ? `<button class="btn-primary" onclick="window.hotaririOps.openAdd()">+ Adaugă Hotărâre</button>` : ''}
                    </div>
                    ${renderTable(data.active, false)}
                    
                    <h3 style="margin-top:40px; color:#94a3b8; font-size:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">Antecedente (Arhivă)</h3>
                    ${renderTable(data.antecedents, true)}
                </div>
                ${renderModals()}
            `;
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<div class="error-box">${e.message}</div>`;
        }
    }

    function renderTable(rows, isAntecedent) {
        if (!rows || rows.length === 0) return `<div class="p-3 text-muted" style="background:#f8fafc; border-radius:6px; text-align:center;">Nu există înregistrări.</div>`;
        
        return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="100">Data</th>
                        <th>Document / Articole</th>
                        <th>Pedeapsa</th>
                        <th>Penitenciar</th>
                        <th>Perioada</th>
                        <th width="120" class="text-center">Acțiuni</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => {
                        // Format articles list
                        let artHtml = '';
                        if (r.ARTICOLE && r.ARTICOLE.length > 0) {
                            artHtml = `<div style="margin-top:2px;">` + 
                                r.ARTICOLE.map(a => {
                                    // 1. Article Number + Index (e.g. 188^1)
                                    let artLabel = `${a.ART_NUMBER}`; 
                                    if (a.ART_INDICE) artLabel += `<sup>${a.ART_INDICE}</sup>`;

                                    // 2. Paragraph (Alineat)
                                    let alinLabel = a.ALIN_NUMBER ? ` (${a.ALIN_NUMBER})` : '';

                                    // 3. Letter (Litera)
                                    let litLabel = a.LIT_TEXT ? ` ${a.LIT_TEXT})` : '';

                                    return `<span class="art-badge">Art. ${artLabel}${alinLabel}${litLabel}</span>`;
                                }).join('') + 
                            `</div>`;
                        }

                        return `
                        <tr>
                            <td>${formatDisplayDate(r.D_DATE)}</td>
                            <td>
                                <div style="font-weight:600; color:#0f172a;">${r.DOCUMENTNAME || 'Nedefinit'}</div>
                                ${r.NRDOSARPENAL ? `<div style="font-size:0.8rem; color:#64748b;">Dosar: ${r.NRDOSARPENAL}</div>` : ''}
                                ${artHtml}
                            </td>
                            <td>
                                <span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.85rem;">
                                    ${r.TERMENULANI}a ${r.TERMENULLUNI}l ${r.TERMENULZILE}z
                                </span>
                            </td>
                            <td>${r.NAMETIPPENITENCIAR || '-'}</td>
                            <td>
                                <div style="font-size:0.85rem; line-height:1.4;">
                                    <span style="color:#15803d">Start:</span> ${formatDisplayDate(r.B_DATE)}<br/>
                                    <span style="color:#b91c1c">Stop:</span> ${formatDisplayDate(r.E_DATE)}
                                </div>
                            </td>
                            <td class="text-center">
                                ${!isAntecedent ? `
                                    <div style="display:flex; justify-content:center; gap:5px;">
                                        <button class="btn-tiny" onclick="window.hotaririOps.openSubModules(${r.ID})" title="Sub-module">⚙️</button>
                                        
                                        <button class="btn-tiny ${_canWrite ? '' : 'btn-secondary'}" 
                                            onclick="window.hotaririOps.openEdit(${r.ID})" 
                                            title="${_canWrite ? 'Editează' : 'Vizualizează Detalii'}">
                                            ${_canWrite ? '✏️' : '👁️'}
                                        </button>

                                        ${_canWrite ? `
                                            <button class="btn-tiny btn-danger" onclick="window.hotaririOps.delete(${r.ID})" title="Șterge">🗑️</button>
                                        ` : ''}
                                    </div>
                                ` : '<span class="text-muted" style="font-size:0.8rem">Arhivat</span>'}
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>`;
    }

    function renderModals() {
        return `
        <!-- Main Modal -->
        <div id="hotarireModal" class="modal-overlay">
            <div class="modal-card modal-hotariri" style="max-width:900px; width:95%;">
                <div class="modal-header">
                    <h3 class="modal-title" id="hotarireModalTitle">Gestionare Hotărâre</h3>
                    <button class="btn-close" onclick="window.closeModal('hotarireModal')">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form id="hotarireForm" class="hotarire-grid">
                        
                        <div class="section-header">1. Informații Generale</div>
                        
                        <div class="form-group">
                            <label>Data Hotărârii</label>
                            <input type="date" name="d_date">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Tip Document</label>
                            <select name="id_tip_hot_jud">${opts(meta.tipDoc)}</select>
                        </div>
                        <div class="form-group">
                            <label>Nr. Dosar Penal</label>
                            <input type="text" name="nrdosarpenal" placeholder="Ex: 1-25/2023">
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>Instanța de Judecată</label>
                            <select name="id_instante">${opts(meta.instante)}</select>
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Nume Judecător</label>
                            <input type="text" name="judecator">
                        </div>

                         <div class="form-group full-width">
                            <label>Organ de Urmărire Penală</label>
                            <select name="id_organup">${opts(meta.instanteUp)}</select>
                        </div>

                        <div class="section-header">2. Pedeapsa și Termene</div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>Termen de Executare</label>
                            <div class="term-group">
                                <div class="term-wrapper"><input type="number" name="termenulani" min="0" placeholder="0"><span>ANI</span></div>
                                <div class="term-wrapper"><input type="number" name="termenulluni" min="0" placeholder="0"><span>LUNI</span></div>
                                <div class="term-wrapper"><input type="number" name="termenulzile" min="0" placeholder="0"><span>ZILE</span></div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Început Termen</label>
                            <input type="date" name="b_date">
                        </div>
                        <div class="form-group">
                            <label>Data Definitivă</label>
                            <input type="date" name="definitiv">
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>Tip Penitenciar</label>
                            <select name="id_tip_penitenciar">${opts(meta.tipPen)}</select>
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Condiții Eliberare</label>
                            <select name="id_tip_elib_cond">${opts(meta.tipElib)}</select>
                        </div>

                        <div class="section-header">3. Sancțiuni Complementare</div>

                        <div class="form-group">
                            <label>Amendă (MDL)</label>
                            <input type="text" name="amenda" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label>Prejudiciu (MDL)</label>
                            <input type="text" name="prejudiciu" placeholder="0.00">
                        </div>
                        
                        <div class="form-group">
                             <label>Muncă Nerem.</label>
                             <div class="term-group">
                                <div class="term-wrapper"><input type="number" name="muncaneremunzile" placeholder="0"><span>ZILE</span></div>
                                <div class="term-wrapper"><input type="number" name="muncaneremunore" placeholder="0"><span>ORE</span></div>
                             </div>
                        </div>
                        <div class="form-group">
                             <label>Arest Domiciliu</label>
                             <div class="term-group">
                                <div class="term-wrapper"><input type="number" name="arestdomzile" placeholder="0"><span>ZILE</span></div>
                                <div class="term-wrapper"><input type="number" name="arestdomore" placeholder="0"><span>ORE</span></div>
                             </div>
                        </div>

                        <div class="form-group">
                             <label>Detenție pe viață?</label>
                             <select name="perlife">
                                <option value="N">NU</option>
                                <option value="Y">DA</option>
                             </select>
                        </div>

                        <div class="form-group full-width">
                            <label>Note și Observații</label>
                            <textarea name="note" rows="3" placeholder="Alte detalii..."></textarea>
                        </div>

                    </form>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="window.closeModal('hotarireModal')">Închide</button>
                    <button class="btn-primary" id="btnSaveHotarire" onclick="window.hotaririOps.save()">Salvează Modificările</button>
                </div>
            </div>
        </div>

        <!-- Sub Modal -->
        <div id="subModal" class="modal-overlay">
            <div class="modal-card modal-hotariri" style="max-width:700px;">
                 <div class="modal-header">
                    <h3 class="modal-title">Detalii Avansate</h3>
                    <button class="btn-close" onclick="window.closeModal('subModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="admin-tabs" style="margin-bottom:15px; background:#f1f5f9; padding:5px; border-radius:6px; display:inline-flex;">
                        <button class="admin-tab-btn active" onclick="window.hotaririOps.switchSubTab('art', event)">Articole</button>
                        <button class="admin-tab-btn" onclick="window.hotaririOps.switchSubTab('int', event)">Intervale</button>
                        <button class="admin-tab-btn" onclick="window.hotaririOps.switchSubTab('red', event)">Reduceri</button>
                    </div>
                    <div id="subContent"></div>
                </div>
            </div>
        </div>`;
    }

    // --- LOGIC ---
    window.hotaririOps = {
        currentId: null,

        openAdd: () => {
            window.hotaririOps.currentId = null;
            document.getElementById('hotarireForm').reset();
            const title = document.getElementById('hotarireModalTitle');
            const saveBtn = document.getElementById('btnSaveHotarire');
            const inputs = document.getElementById('hotarireForm').querySelectorAll('input, select, textarea');

            // Reset permissions UI
            title.textContent = "Adaugă Hotărâre";
            saveBtn.style.display = 'inline-block';
            inputs.forEach(i => i.disabled = false);

            document.getElementById('hotarireModal').classList.add('open');
        },

        openEdit: async (id) => {
            const res = await window.prisonApi.get(`/detinut/${_idnp}/hotariri`);
            const row = res.active.find(r => r.ID == id);
            if (!row) return;

            window.hotaririOps.currentId = id;
            const f = document.getElementById('hotarireForm');
            const title = document.getElementById('hotarireModalTitle');
            const saveBtn = document.getElementById('btnSaveHotarire');
            const inputs = f.querySelectorAll('input, select, textarea');
            
            f.d_date.value = toInputDate(row.D_DATE);
            f.id_tip_hot_jud.value = row.ID_TIP_HOT_JUD || '';
            f.nrdosarpenal.value = row.NRDOSARPENAL || '';
            f.id_instante.value = row.ID_INSTANTE || '';
            f.judecator.value = row.JUDECATOR || '';
            f.id_organup.value = row.ID_ORGANUP || '';

            f.termenulani.value = row.TERMENULANI || 0;
            f.termenulluni.value = row.TERMENULLUNI || 0;
            f.termenulzile.value = row.TERMENULZILE || 0;

            f.b_date.value = toInputDate(row.B_DATE);
            f.definitiv.value = toInputDate(row.DEFINITIV);
            f.id_tip_penitenciar.value = row.ID_TIP_PENITENCIAR || '';
            f.id_tip_elib_cond.value = row.ID_TIP_ELIB_COND || '';

            f.amenda.value = row.AMENDA || '';
            f.prejudiciu.value = row.PREJUDICIU || '';
            f.muncaneremunzile.value = row.MUNCANEREMUNZILE || 0;
            f.muncaneremunore.value = row.MUNCANEREMUNORE || 0; 
            f.arestdomzile.value = row.ARESTDOMZILE || 0;
            f.arestdomore.value = row.ARESTDOMORE || 0;
            f.perlife.value = row.PERLIFE || 'N';
            f.note.value = row.NOTE || '';

            // Handle Read-Only Mode
            if (_canWrite) {
                title.textContent = "Editare Hotărâre";
                saveBtn.style.display = 'inline-block';
                inputs.forEach(i => i.disabled = false);
            } else {
                title.textContent = "Detalii Hotărâre (Vizualizare)";
                saveBtn.style.display = 'none';
                inputs.forEach(i => i.disabled = true);
            }

            document.getElementById('hotarireModal').classList.add('open');
        },

        save: async () => {
            if (!_canWrite) return; // Guard
            const form = document.getElementById('hotarireForm');
            const fd = new FormData(form);
            const payload = Object.fromEntries(fd);
            
            ['d_date', 'definitiv', 'b_date'].forEach(k => {
                if(payload[k]) payload[k] = toDbDate(payload[k]);
            });

            const id = window.hotaririOps.currentId;
            const url = id ? `/detinut/hotariri/${id}` : `/detinut/${_idnp}/hotariri`;
            const method = id ? 'PUT' : 'POST';

            try {
                if (method === 'PUT') {
                   const headers = { "Content-Type": "application/json", "x-user-id": sessionStorage.getItem("prison.userId") };
                   const res = await fetch(`/api${url}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
                   const json = await res.json();
                   if(!json.success) throw new Error(json.error || "Eroare salvare");
                } else {
                   await window.prisonApi.post(url, payload);
                }

                window.closeModal('hotarireModal');
                window.DetinutTabs['hotariri'].render(document.getElementById('profileContent'), _idnp);
            } catch (e) {
                alert("Eroare: " + e.message);
            }
        },

        delete: async (id) => {
            if (!confirm("Sigur ștergeți?")) return;
            try {
                await window.prisonApi.del(`/detinut/hotariri/${id}`);
                window.DetinutTabs['hotariri'].render(document.getElementById('profileContent'), _idnp);
            } catch (e) {
                alert(e.message);
            }
        },

        openSubModules: (id) => {
            window.hotaririOps.currentId = id;
            document.getElementById('subModal').classList.add('open');
            window.hotaririOps.switchSubTab('art');
        },

        switchSubTab: async (tab, event) => {
            if(event) {
                document.querySelectorAll('#subModal .admin-tab-btn').forEach(b => b.classList.remove('active'));
                event.target.classList.add('active');
            }
            const container = document.getElementById('subContent');
            const id = window.hotaririOps.currentId;
            container.innerHTML = '<div class="loader-box">...</div>';

            if (tab === 'art') {
                const res = await window.prisonApi.get(`/detinut/hotariri/${id}/articole`);
                container.innerHTML = `
                    ${_canWrite ? `
                    <div class="sub-add-box">
                        <h5 style="margin-bottom:8px; margin-top:0; font-size:0.9rem;">Adaugă Articol</h5>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="add_art" placeholder="Art" style="width:70px; padding:5px;">
                            <input type="text" id="add_alin" placeholder="Alin" style="width:70px; padding:5px;">
                            <input type="text" id="add_lit" placeholder="Lit" style="width:70px; padding:5px;">
                            <button class="btn-primary" style="padding:5px 15px;" onclick="window.hotaririOps.addSub('art')">Adaugă</button>
                        </div>
                    </div>` : ''}
                    <table class="compact-table" style="width:100%">
                        <thead><tr><th>Articol</th><th>Alineat</th><th>Litera</th><th></th></tr></thead>
                        <tbody>
                            ${(res.rows||[]).map(r => `
                                <tr>
                                    <td>${r.ID_ARTICOL}</td>
                                    <td>${r.ID_ALINEAT||'-'}</td>
                                    <td>${r.ID_LETTER||'-'}</td>
                                    <td class="text-right">${_canWrite ? `<span class="del-x" style="cursor:pointer; color:red; font-weight:bold;" onclick="window.hotaririOps.delSub('articole', ${r.ID}, 'art')">&times;</span>` : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
            } else if (tab === 'int') {
                const res = await window.prisonApi.get(`/detinut/hotariri/${id}/intervale`);
                 container.innerHTML = `
                    ${_canWrite ? `
                    <div class="sub-add-box">
                        <h5 style="margin-bottom:8px; margin-top:0; font-size:0.9rem;">Adaugă Interval Exclus</h5>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="date" id="add_bdate" style="padding:5px;">
                            <span>-></span>
                            <input type="date" id="add_edate" style="padding:5px;">
                            <button class="btn-primary" style="padding:5px 15px;" onclick="window.hotaririOps.addSub('int')">Adaugă</button>
                        </div>
                    </div>` : ''}
                    <table class="compact-table" style="width:100%">
                        <thead><tr><th>Început</th><th>Sfârșit</th><th></th></tr></thead>
                        <tbody>
                            ${(res.rows||[]).map(r => `
                                <tr>
                                    <td>${r.B_DATE}</td>
                                    <td>${r.E_DATE}</td>
                                    <td class="text-right">${_canWrite ? `<span class="del-x" style="cursor:pointer; color:red; font-weight:bold;" onclick="window.hotaririOps.delSub('intervale', ${r.ID}, 'int')">&times;</span>` : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
            } else if (tab === 'red') {
                const res = await window.prisonApi.get(`/detinut/hotariri/${id}/reduceri`);
                container.innerHTML = `
                    ${_canWrite ? `
                    <div class="sub-add-box">
                        <h5 style="margin-bottom:8px; margin-top:0; font-size:0.9rem;">Adaugă Reducere</h5>
                        <div style="display:flex; gap:8px;">
                            <input type="number" id="add_zile" placeholder="Zile" style="width:80px; padding:5px;">
                            <select id="add_mec" style="flex:1; padding:5px;">${opts(meta.mecReduc)}</select>
                            <button class="btn-primary" style="padding:5px 15px;" onclick="window.hotaririOps.addSub('red')">Adaugă</button>
                        </div>
                    </div>` : ''}
                    <table class="compact-table" style="width:100%">
                        <thead><tr><th>Zile</th><th>Mecanism</th><th></th></tr></thead>
                        <tbody>
                            ${(res.rows||[]).map(r => `
                                <tr>
                                    <td>${r.NRZILE}</td>
                                    <td>${r.MECANISM_NAME}</td>
                                    <td class="text-right">${_canWrite ? `<span class="del-x" style="cursor:pointer; color:red; font-weight:bold;" onclick="window.hotaririOps.delSub('reduceri', ${r.ID}, 'red')">&times;</span>` : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
            }
        },

        addSub: async (type) => {
            const id = window.hotaririOps.currentId;
            let payload = {};
            let url = "";

            if (type === 'art') {
                payload = {
                    articol: document.getElementById('add_art').value,
                    aliniat: document.getElementById('add_alin').value,
                    litera: document.getElementById('add_lit').value
                };
                url = `/detinut/hotariri/${id}/articole`;
            } else if (type === 'int') {
                payload = {
                    b_date: toDbDate(document.getElementById('add_bdate').value),
                    e_date: toDbDate(document.getElementById('add_edate').value)
                };
                url = `/detinut/hotariri/${id}/intervale`;
            } else if (type === 'red') {
                // ADDED PARSE INT to fix invalid number error
                const nrzile = parseInt(document.getElementById('add_zile').value, 10);
                if (isNaN(nrzile)) {
                    alert("Numărul de zile trebuie să fie valid.");
                    return;
                }

                payload = {
                    idnp: _idnp,
                    nrzile: nrzile,
                    id_mecanism: document.getElementById('add_mec').value
                };
                url = `/detinut/hotariri/${id}/reduceri`;
            }

            try {
                await window.prisonApi.post(url, payload);
                window.hotaririOps.switchSubTab(type);
            } catch (e) {
                alert("Eroare: " + e.message);
            }
        },

        delSub: async (endpoint, subId, tabKey) => {
            if(!confirm("Ștergeți?")) return;
            try {
                await window.prisonApi.del(`/detinut/${endpoint}/${subId}`);
                window.hotaririOps.switchSubTab(tabKey);
            } catch (e) { alert(e.message); }
        }
    };

    window.DetinutTabs['hotariri'] = { render };
})();