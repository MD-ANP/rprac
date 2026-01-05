(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    
    let currentIdnp = null;
    let meta = null; 
    let currentEditId = null; // Track if we are editing or adding

    // --- METADATA LOADER ---
    async function fetchMeta() {
        if(meta) return;
        const res = await window.prisonApi.get('/detinut/meta/citatie');
        if(res.success) meta = res;
        else throw new Error(res.error || "Nu s-au putut încărca nomenclatoarele.");
    }

    function formatEuroDate(dateStr) {
    if (!dateStr) return '—';
    
    // Dacă este format ISO (conține 'T')
    if (dateStr.includes('T')) {
        const [datePart] = dateStr.split('T'); // Luăm doar "2025-05-18"
        const [year, month, day] = datePart.split('-');
        return `${day}.${month}.${year}`;
    }
    
    return dateStr; // Returnăm așa cum este dacă nu e ISO
    }

    function formatShortTime(timeStr) {
    if (!timeStr) return '—';
    // Dacă primim un format lung, tăiem primele 5 caractere (HH:mm)
    // Funcționează și dacă string-ul este deja "22:00"
    return timeStr.substring(0, 5);
    }

    // --- HTML & UI Helpers ---
    function injectCitatieModal() {
        if(document.getElementById('citatieModal')) return;

        const html = `
        <div class="modal-overlay" id="citatieModal">
            <div class="modal-card" style="max-width:700px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="citatieModalTitle">Adaugă Citație</h3>
                    <button class="btn-close" onclick="window.citatieOps.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="citatieForm" class="admin-form" onsubmit="return false;">
                        <input type="hidden" name="ID" id="cit_id">
                        
                        <div class="admin-grid-2">
                            <div class="f">
                                <label>Tip Document *</label>
                                <select name="ID_TIP_DOCUMENT_CITATIE" id="cit_tip" class="full-width" required></select>
                            </div>
                            <div class="f">
                                <label>Nr. Document</label>
                                <input type="text" name="NRDOCUMENT" id="cit_nr" class="full-width">
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label>Data Ședinței *</label>
                                <input type="text" name="ADATE" id="cit_date" class="datepicker full-width" placeholder="DD.MM.YYYY" required>
                            </div>
                            <div class="f">
                                <label>Ora Ședinței *</label>
                                <input type="text" name="ORASEDINTA" id="cit_ora" class="full-width" placeholder="HH:MM" required>
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label>Instanța de Judecată</label>
                                <select name="ID_INSTANTE" id="cit_instanta" class="full-width"></select>
                            </div>
                            <div class="f">
                                <label>Loc de Judecată</label>
                                <select name="ID_LOCJUDECATA" id="cit_loc" class="full-width"></select>
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label>Nr. Sală</label>
                                <input type="text" name="NRSALA" id="cit_sala" class="full-width">
                            </div>
                            <div class="f">
                                <label>Judecător</label>
                                <input type="text" name="NPPJUDECATOR" id="cit_judecator" class="full-width">
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-2">
                            <div class="f">
                                <label>Executor Transfer</label>
                                <select name="ID_EXECUTOR_TRANSFER" id="cit_exec" class="full-width"></select>
                            </div>
                            <div class="f" id="anulat_container" style="display:none;">
                                <label>Status (Anulat)</label>
                                <select name="ANULAT" id="cit_anulat" class="full-width">
                                    <option value="N">Nu</option>
                                    <option value="Y">Da</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.citatieOps.closeModal()">Anulează</button>
                    <button class="btn-primary" id="btnCitatieSave" onclick="window.citatieOps.submitForm()">Salvează</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (typeof window.flatpickr !== 'undefined') {
            flatpickr(document.getElementById('cit_date'), { dateFormat: "d.m.Y" });
        }
    }
    
    function fillSelect(id, items) { 
        const el = document.getElementById(id); 
        if(!el) return;
        el.innerHTML = '<option value="0">- Selectează -</option>' + 
                       items.map(i => `<option value="${i.ID}">${i.NAME}</option>`).join(''); 
    }

    async function loadCitations(container) {
        container.innerHTML = `<div class="loader-box">Se încarcă citațiile...</div>`;
        try {
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/citatii`);
            const rows = res.rows || [];
            const canWrite = res.canWrite;

            let html = `
                <div class="flex-between mb-4" style="border-bottom:1px solid #e2e8f0; padding-bottom:15px;">
                    <h2 style="margin:0; font-size:1.1rem;">Citații pentru IDNP: ${currentIdnp}</h2>
                    ${canWrite ? `<button class="btn-primary" onclick="window.citatieOps.openModal()">+ Adaugă Citație</button>` : ''}
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Tip Document</th>
                                <th>Nr. Document</th>
                                <th>Data/Ora Ședinței</th>
                                <th>Instanța / Sală</th>
                                <th>Judecător</th>
                                <th>Status</th>
                                <th style="text-align:center;">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (rows.length === 0) {
                html += `<tr><td colspan="7" class="text-center">Nu există citații înregistrate.</td></tr>`;
            } else {
                html += rows.map(r => `
                    <tr class="${r.ANULAT === 'Y' ? 'row-cancelled' : ''}">
                        <td>${r.TIP_DOCUMENT_CITATIE || '—'}</td>
                        <td>${r.NRDOCUMENT || '—'}</td>
                        <td><b>${formatEuroDate(r.ADATE)}</b> <br> <br> <small>${formatShortTime(r.ORASEDINTA)}</small></td>
                        <td>${r.NAME_INSTANTE || '—'} <br> <small>Sala: ${r.NRSALA || '—'}</small></td>
                        <td>${r.NPPJUDECATOR || '—'}</td>
                        <td>${r.ANULAT === 'Y' ? '<span class="badge badge-danger">Anulat</span>' : '<span class="badge badge-success">Activ</span>'}</td>
                        <td class="text-center">
                            ${canWrite ? `<button class="btn-tiny" onclick='window.citatieOps.openModal(${JSON.stringify(r)})' title="Editare">✏️</button>` : '—'}
                        </td>
                    </tr>
                `).join('');
            }
            html += `</tbody></table></div>`;
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<div class="error-box">Eroare: ${e.message}</div>`;
        }
    }

    window.citatieOps = {
        openModal: (data = null) => {
            injectCitatieModal();
            const form = document.getElementById('citatieForm');
            form.reset();
            
            fillSelect('cit_tip', meta.types);
            fillSelect('cit_instanta', meta.instante);
            fillSelect('cit_loc', meta.locuri);
            fillSelect('cit_exec', meta.executori);

            if (data) {
                currentEditId = data.ID;
                document.getElementById('citatieModalTitle').textContent = "Editare Citație";
                document.getElementById('anulat_container').style.display = "block";
                // Fill fields
                document.getElementById('cit_id').value = data.ID;
                document.getElementById('cit_tip').value = data.ID_TIP_DOCUMENT_CITATIE;
                document.getElementById('cit_nr').value = data.NRDOCUMENT;
                document.getElementById('cit_date').value = data.ADATE;
                document.getElementById('cit_ora').value = data.ORASEDINTA;
                document.getElementById('cit_instanta').value = data.ID_INSTANTE || 0;
                document.getElementById('cit_loc').value = data.ID_LOCJUDECATA || '';
                document.getElementById('cit_sala').value = data.NRSALA;
                document.getElementById('cit_judecator').value = data.NPPJUDECATOR;
                document.getElementById('cit_exec').value = data.ID_EXECUTOR_TRANSFER || 0;
                document.getElementById('cit_anulat').value = data.ANULAT;
            } else {
                currentEditId = null;
                document.getElementById('citatieModalTitle').textContent = "Adaugă Citație";
                document.getElementById('anulat_container').style.display = "none";
            }
            
            document.getElementById('citatieModal').classList.add('open');
        },

        closeModal: () => {
            document.getElementById('citatieModal').classList.remove('open');
        },

        submitForm: async () => {
            const btn = document.getElementById('btnCitatieSave');
            const fd = new FormData(document.getElementById('citatieForm'));
            const payload = Object.fromEntries(fd);
            
            btn.disabled = true;
            try {
                const url = currentEditId ? `/detinut/citatie/${currentEditId}` : `/detinut/${currentIdnp}/citatie`;
                const method = currentEditId ? 'put' : 'post';
                
                const res = await window.prisonApi[method](url, payload);
                if(!res.success) throw new Error(res.error);
                
                window.citatieOps.closeModal();
                await loadCitations(document.getElementById('profileContent'));
            } catch (e) {
                alert("Eroare: " + e.message);
            } finally {
                btn.disabled = false;
            }
        }
    };

    window.DetinutTabs['citatie'] = {
        render: async (container) => {
            const idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
            if (!idnp) { container.innerHTML = 'IDNP lipsă.'; return; }
            currentIdnp = idnp;

            try {
                await fetchMeta();
                injectCitatieModal();
                await loadCitations(container);
            } catch(e) {
                container.innerHTML = `<div class="error-box">${e.message}</div>`;
            }
        }
    };
})();