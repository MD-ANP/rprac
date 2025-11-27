(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    
    let currentIdnp = null;
    let meta = null; // Cache for dropdown data (SPR_COMPLICI_STATUS)

    // --- METADATA LOADER ---
    async function fetchMeta() {
        if(meta) return;
        
        const res = await window.prisonApi.get('/detinut/meta/complici');
        if(res.success) meta = res;
        else throw new Error(res.error || "Nu s-au putut încărca nomenclatoarele pentru complici.");
    }

    // --- HTML & UI Helpers ---
    function injectCompliceModal() {
        if(document.getElementById('compliceModal')) return;

        // Modal for adding a new accomplice
        const html = `
        <div class="modal-overlay" id="compliceModal">
            <div class="modal-card" style="max-width:700px;">
                <div class="modal-header">
                    <h3 class="modal-title">Adaugă Complice</h3>
                    <button class="btn-close" onclick="window.compliceOps.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="compliceForm" class="admin-form" onsubmit="return false;">
                        <div class="admin-grid-3">
                            <div class="f">
                                <label for="nume">Nume *</label>
                                <input type="text" id="nume" name="nume" class="full-width" required>
                            </div>
                            <div class="f">
                                <label for="prenume">Prenume *</label>
                                <input type="text" id="prenume" name="prenume" class="full-width" required>
                            </div>
                            <div class="f">
                                <label for="patronimic">Patronimic</label>
                                <input type="text" id="patronimic" name="patronimic" class="full-width">
                            </div>
                        </div>

                        <div class="admin-grid-3 mt-2">
                            <div class="f">
                                <label for="idnpComplice">IDNP Complice</label>
                                <input type="text" id="idnpComplice" name="idnpComplice" maxlength="13" class="full-width" placeholder="xxxxxxxxxxxxx">
                            </div>
                            <div class="f">
                                <label for="birthday">Data Nașterii</label>
                                <input type="text" id="birthday" name="birthday" class="datepicker full-width" placeholder="DD.MM.YYYY">
                            </div>
                            <div class="f">
                                <label for="idStatus">Status *</label>
                                <select name="idStatus" id="compliceStatusSelect" class="full-width" required></select>
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label for="dosar">Nr. Dosar Penal</label>
                                <input type="text" id="dosar" name="dosar" class="full-width">
                            </div>
                            <div class="f">
                                <label for="hDate">Data Hotărârii (Dosar)</label>
                                <input type="text" id="hDate" name="hDate" class="datepicker full-width" placeholder="DD.MM.YYYY">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.compliceOps.closeModal()">Anulează</button>
                    <button class="btn-primary" id="btnCompliceSave" onclick="window.compliceOps.submitForm()">Salvează</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Initialize date pickers if available
        if (typeof window.flatpickr !== 'undefined') {
            flatpickr(document.getElementById('birthday'), { dateFormat: "d.m.Y" });
            flatpickr(document.getElementById('hDate'), { dateFormat: "d.m.Y" });
        }
    }
    
    function fillSelect(id, items) { 
        const el = document.getElementById(id); 
        if(!el) return;
        el.innerHTML = '<option value="">- Selectează -</option>' + 
                       items.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join(''); 
    }

    // --- DATA & RENDERER ---
    async function loadComplici(container) {
        container.innerHTML = `<div class="loader-box">Se încarcă lista de complici...</div>`;
        
        try {
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/complici`);
            const rows = res.rows || [];
            const canWrite = res.canWrite; 

            const btnAdd = canWrite ? 
                `<button class="btn-primary" onclick="window.compliceOps.openModal()">+ Adaugă Complice</button>` : '';

            let html = `
                <div class="flex-between" style="border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="margin:0; font-size:1.1rem; color:#1e293b;">Lista de Complici</h2>
                    ${btnAdd}
                </div>
            `;

            if (rows.length === 0) {
                html += `<div class="table-empty">Nu există complici înregistrați.</div>`;
            } else {
                html += `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nume & Prenume</th>
                                    <th>IDNP / Data Nașterii</th>
                                    <th>Status</th>
                                    <th>Dosar Penal</th>
                                    <th style="width:100px; text-align:center;">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                html += rows.map(r => `
                    <tr>
                        <td><b>${r.NUME} ${r.PRENUME}</b> ${r.PATRONIMIC||'—'}</td>
                        <td>${r.IDNP || '—'} / ${r.BIRTHDAY_STR || '—'}</td>
                        <td><span class="badge ${r.ID_STATUS === 1 ? 'badge-info' : 'badge-default'}">${r.STATUS_NAME}</span></td>
                        <td>${r.DOSAR || '—'} ${r.HDATE_STR ? `(Hot. ${r.HDATE_STR})` : ''}</td>
                        <td class="text-center">
                            ${canWrite ? `<button class="btn-danger btn-tiny" onclick="window.compliceOps.delete(${r.ID})" title="Șterge Complice">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>` : '—'}
                        </td>
                    </tr>
                `).join('');

                html += `</tbody></table></div>`;
            }
            container.innerHTML = html;

        } catch (e) {
            console.error("Error loading complici:", e);
            container.innerHTML = `<div class="error-box">Eroare la încărcarea complicilor: ${e.message}</div>`;
        }
    }

    // --- GLOBAL OPERATIONS WRAPPER ---
    window.compliceOps = {
        openModal: () => {
            const modal = document.getElementById('compliceModal');
            const form = document.getElementById('compliceForm');
            if(form) form.reset();
            
            // Populate dropdown before opening
            if (meta && meta.compliciStatus) {
                fillSelect('compliceStatusSelect', meta.compliciStatus);
            }
            
            if(modal) modal.classList.add('open');
        },

        closeModal: () => {
            const modal = document.getElementById('compliceModal');
            if(modal) modal.classList.remove('open');
        },

        submitForm: async () => {
            const form = document.getElementById('compliceForm');
            const btn = document.getElementById('btnCompliceSave');
            const fd = new FormData(form);
            const payload = Object.fromEntries(fd);
            
            if(!payload.nume || !payload.prenume || !payload.idStatus) {
                alert("Vă rugăm completați Nume, Prenume și Statusul complicelui.");
                return; 
            }

            btn.disabled = true;
            btn.textContent = "Se salvează...";

            try {
                const url = `/detinut/${currentIdnp}/complici`;
                const res = await window.prisonApi.post(url, payload);
                
                if(!res.success) throw new Error(res.error);
                
                window.compliceOps.closeModal();
                await loadComplici(document.getElementById('profileContent')); // Reload list
            } catch (e) {
                alert("Eroare la salvare: " + e.message); 
            } finally {
                btn.disabled = false;
                btn.textContent = "Salvează";
            }
        },

        delete: async (id) => {
            if(!confirm("Sigur ștergeți această înregistrare de complice?")) return;
            try {
                const res = await window.prisonApi.del(`/detinut/complici/${id}`);
                if (!res.success) throw new Error(res.error || "Ștergerea nu a reușit.");
                await loadComplici(document.getElementById('profileContent')); // Reload list
            } catch(e) { 
                alert("Eroare la ștergere: " + e.message); 
            }
        }
    };

    // --- TAB RENDER ENTRY POINT ---
    window.DetinutTabs['complici'] = {
        render: async (container, detinutId) => {
             const idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
             if (!idnp) { 
                 container.innerHTML = '<div class="error-box">Lipsă IDNP al deținutului.</div>'; 
                 return; 
             }
             currentIdnp = idnp;

             // 1. Fetch Metadata (Dropdowns)
             try {
                 await fetchMeta();
             } catch(e) {
                 container.innerHTML = `<div class="error-box">${e.message}</div>`;
                 return;
             }

             // 2. Inject Modal UI
             injectCompliceModal();
             
             // 3. Load & Render Data Table
             await loadComplici(container);
        }
    };
})();