(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    
    let currentIdnp = null;
    let meta = null; // Cache for dropdown data (SPR_RELATIVE_TYPE)

    // --- METADATA LOADER ---
    async function fetchMeta() {
        // If meta is already loaded, skip fetching
        if(meta) return;
        
        const res = await window.prisonApi.get('/detinut/meta/rude');
        if(res.success) meta = res;
        else throw new Error(res.error || "Nu s-au putut încărca nomenclatoarele pentru rude.");
    }

    // --- HTML & UI Helpers ---
    function injectRudeModal() {
        // Prevent duplicate injection
        if(document.getElementById('rudeModal')) return;

        // Modal for adding a new relative
        const html = `
        <div class="modal-overlay" id="rudeModal">
            <div class="modal-card" style="max-width:600px;">
                <div class="modal-header">
                    <h3 class="modal-title">Adaugă Rudă</h3>
                    <button class="btn-close" onclick="window.rudeOps.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="rudeForm" class="admin-form" onsubmit="return false;">
                        <div class="admin-grid-2">
                            <div class="f">
                                <label for="surname">Nume *</label>
                                <input type="text" id="surname" name="surname" class="full-width" required>
                            </div>
                            <div class="f">
                                <label for="name">Prenume *</label>
                                <input type="text" id="name" name="name" class="full-width" required>
                            </div>
                        </div>
                        <div class="admin-grid-2 mt-2">
                             <div class="f">
                                <label for="secName">Patronimic (Opțional)</label>
                                <input type="text" id="secName" name="secName" class="full-width">
                             </div>
                             <div class="f">
                                <label for="relTypeSelect">Tipul Relației *</label>
                                <select name="idRelativeType" id="relTypeSelect" class="full-width" required></select>
                            </div>
                        </div>
                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label for="dBirdth">Data Nașterii (Opțional)</label>
                                <input type="text" id="dBirdth" name="dBirdth" class="datepicker full-width" placeholder="DD.MM.YYYY">
                            </div>
                            <div class="f">
                                <label for="idnpRude">IDNP Rudă (Opțional)</label>
                                <input type="text" id="idnpRude" name="idnpRude" maxlength="13" class="full-width" placeholder="xxxxxxxxxxxxx">
                            </div>
                        </div>
                        <div class="f mt-2">
                            <label for="address">Adresa</label>
                            <input type="text" id="address" name="address" class="full-width">
                        </div>
                        <div class="f mt-2">
                            <label for="phone">Telefon</label>
                            <input type="text" id="phone" name="phone" class="full-width">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.rudeOps.closeModal()">Anulează</button>
                    <button class="btn-primary" id="btnRudeSave" onclick="window.rudeOps.submitForm()">Salvează</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Initialize date picker if available
        if (typeof window.flatpickr !== 'undefined') {
            flatpickr(document.getElementById('dBirdth'), { dateFormat: "d.m.Y" });
        }
    }
    
    function fillSelect(id, items) { 
        const el = document.getElementById(id); 
        if(!el) return;
        el.innerHTML = '<option value="">- Selectează -</option>' + 
                       items.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join(''); 
    }

    // --- DATA & RENDERER ---
    async function loadRelatives(container) {
        container.innerHTML = `<div class="loader-box">Se încarcă lista de rude...</div>`;
        
        try {
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/rude`);
            const rows = res.rows || [];
            const canWrite = res.canWrite; // Determined by W permission check in router

            const btnAdd = canWrite ? 
                `<button class="btn-primary" onclick="window.rudeOps.openModal()">+ Adaugă Rudă</button>` : '';

            let html = `
                <div class="flex-between" style="border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="margin:0; font-size:1.1rem; color:#1e293b;">Lista de Rude</h2>
                    ${btnAdd}
                </div>
            `;

            if (rows.length === 0) {
                html += `<div class="table-empty">Nu există rude înregistrate.</div>`;
            } else {
                html += `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nume & Prenume</th>
                                    <th>Relație</th>
                                    <th>Data Nașterii / IDNP</th>
                                    <th>Contact & Adresă</th>
                                    <th style="width:100px; text-align:center;">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                html += rows.map(r => `
                    <tr>
                        <td><b>${r.SURNAME} ${r.NAME}</b> ${r.SEC_NAME||''}</td>
                        <td>${r.RELATIVE_TYPE_NAME}</td>
                        <td>${r.D_BIRDTH_STR || r.Y_BIRDTH || '—'} ${r.IDNP ? `(${r.IDNP})` : ''}</td>
                        <td>${r.PHONE || '—'} / ${r.ADDRESS || '—'}</td>
                        <td class="text-center">
                            ${canWrite ? `<button class="btn-danger btn-tiny" onclick="window.rudeOps.delete(${r.ID})" title="Șterge Rudă">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>` : '—'}
                        </td>
                    </tr>
                `).join('');

                html += `</tbody></table></div>`;
            }
            container.innerHTML = html;

        } catch (e) {
            console.error("Error loading relatives:", e);
            container.innerHTML = `<div class="error-box">Eroare la încărcarea rudelor: ${e.message}</div>`;
        }
    }

    // --- GLOBAL OPERATIONS WRAPPER ---
    window.rudeOps = {
        openModal: () => {
            const modal = document.getElementById('rudeModal');
            const form = document.getElementById('rudeForm');
            if(form) form.reset();
            
            // Populate dropdown before opening
            if (meta && meta.relativeTypes) {
                fillSelect('relTypeSelect', meta.relativeTypes);
            }
            
            if(modal) modal.classList.add('open');
        },

        closeModal: () => {
            const modal = document.getElementById('rudeModal');
            if(modal) modal.classList.remove('open');
        },

        submitForm: async () => {
            const form = document.getElementById('rudeForm');
            const btn = document.getElementById('btnRudeSave');
            const fd = new FormData(form);
            // Convert FormData to plain object
            const payload = Object.fromEntries(fd);
            
            // Simple Client-side validation
            if(!payload.surname || !payload.name || !payload.idRelativeType) {
                // Use custom alert or visual feedback instead of browser alert
                console.error("Validation failed: Required fields missing.");
                return; 
            }

            btn.disabled = true;
            btn.textContent = "Se salvează...";

            try {
                const url = `/detinut/${currentIdnp}/rude`;
                const res = await window.prisonApi.post(url, payload);
                
                if(!res.success) throw new Error(res.error);
                
                window.rudeOps.closeModal();
                await loadRelatives(document.getElementById('profileContent')); // Reload list
            } catch (e) {
                alert("Eroare la salvare: " + e.message); // Use alert as a fallback error notification
            } finally {
                btn.disabled = false;
                btn.textContent = "Salvează";
            }
        },

        delete: async (id) => {
            if(!confirm("Sigur ștergeți această înregistrare de rudă? Această acțiune nu poate fi anulată.")) return;
            try {
                const res = await window.prisonApi.del(`/detinut/rude/${id}`);
                if (!res.success) throw new Error(res.error || "Ștergerea nu a reușit.");
                await loadRelatives(document.getElementById('profileContent')); // Reload list
            } catch(e) { 
                alert("Eroare la ștergere: " + e.message); 
            }
        }
    };

    // --- TAB RENDER ENTRY POINT ---
    window.DetinutTabs['rude'] = {
        render: async (container, detinutId) => {
             // Get IDNP from global context
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
             injectRudeModal();
             
             // 3. Load & Render Data Table
             await loadRelatives(container);
        }
    };
})();