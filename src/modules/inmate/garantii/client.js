(function() {
    window.DetinutTabs = window.DetinutTabs || {};

    let currentIdnp = null;
    let currentDetId = null;
    let selectedFile = null; // Store file selected via drag or input

    // --- RENDER FUNCTION ---
    window.DetinutTabs['garantii'] = {
        render: async (container, detinutId) => {
            currentDetId = detinutId;
            if (window.currentDetinutData) {
                currentIdnp = window.currentDetinutData.IDNP;
            } else {
                try {
                    const r = await window.prisonApi.get(`/detinut/${detinutId}/general`);
                    if(r.success) currentIdnp = r.data.IDNP;
                } catch(e) {}
            }

            if (!currentIdnp) {
                container.innerHTML = `<div class="error-box">Eroare: IDNP lipsă pentru acest deținut.</div>`;
                return;
            }

            // Inject Modal HTML
            injectGarantModal();

            // Build UI layout
            container.innerHTML = `
                <div class="admin-panel">
                    <div class="flex-between" style="border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                        <div>
                            <h2 style="margin:0; color:#dc2626;">Garanții de Stat (PDF)</h2>
                            <p class="text-muted" style="margin:4px 0 0 0; font-size:0.9rem;">
                                Încărcați documentele scanate privind garanțiile de stat.
                            </p>
                        </div>
                        <button class="btn-primary" onclick="window.garantOps.openModal()">
                            ⬆️ Adaugă Document
                        </button>
                    </div>

                    <div id="garantListArea">
                        <div class="loader-box">Se încarcă lista...</div>
                    </div>
                </div>
            `;

            // Initial Load
            await loadFiles();
        }
    };

    // --- MODAL INJECTION ---
    function injectGarantModal() {
        if(document.getElementById('garantModal')) return;

        const html = `
        <div class="modal-overlay" id="garantModal">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title">Încărcare Garanție de Stat</h3>
                    <button class="btn-close" onclick="window.garantOps.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="garantUploadForm" class="admin-form" onsubmit="return false;">
                        
                        <div class="upload-area" id="garantDropArea">
                            <div class="upload-icon">📄</div>
                            <div class="upload-text" id="garantDropText">Trage fișierul PDF aici sau click pentru a selecta</div>
                            <input type="file" id="garantFileInput" accept="application/pdf" hidden>
                        </div>
                        
                        <div class="f mt-4">
                            <label>Descriere Document</label>
                            <input type="text" name="descriere" id="garantDesc" class="full-width" placeholder="ex: Hotărâre judecătorească nr..." autocomplete="off">
                        </div>

                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.garantOps.closeModal()">Anulează</button>
                    <button class="btn-primary" id="btnGarantSave" onclick="window.garantOps.submitUpload()">Încarcă</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Setup Drag & Drop Events
        setTimeout(() => {
            const area = document.getElementById('garantDropArea');
            const input = document.getElementById('garantFileInput');
            
            if(!area || !input) return;

            area.onclick = () => input.click();
            
            input.onchange = (e) => {
                handleFileSelect(e.target.files[0]);
            };

            area.ondragover = (e) => { e.preventDefault(); area.classList.add('dragover'); };
            area.ondragleave = () => area.classList.remove('dragover');
            area.ondrop = (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
                handleFileSelect(e.dataTransfer.files[0]);
            };
        }, 500);
    }

    function handleFileSelect(file) {
        const textEl = document.getElementById('garantDropText');
        const descEl = document.getElementById('garantDesc');

        if (!file) return;
        if (file.type !== 'application/pdf') {
            alert("Doar fișiere PDF sunt acceptate!");
            return;
        }
        
        selectedFile = file;
        textEl.textContent = `✅ Selectat: ${file.name}`;
        textEl.style.color = '#15803d';
        textEl.style.fontWeight = 'bold';

        // Auto-fill description if empty
        if (!descEl.value) {
            descEl.value = file.name.replace('.pdf', '');
        }
    }

    // --- LOGIC HELPER ---
    async function loadFiles() {
        const listArea = document.getElementById('garantListArea');
        if (!listArea) return;

        try {
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/garantii`);
            const rows = res.rows || [];

            if (rows.length === 0) {
                listArea.innerHTML = `<div class="table-empty">Nu există documente încărcate.</div>`;
                return;
            }

            let html = `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Descriere Document</th>
                                <th style="width:180px;">Data Încărcării</th>
                                <th style="width:150px; text-align:center;">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            html += rows.map(r => `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:1.2rem; color:#dc2626;">📄</span>
                            <span style="font-weight:600; color:#1e293b;">${r.DESCRIERE}</span>
                        </div>
                    </td>
                    <td>${r.DATA_UPLOAD}</td>
                    <td class="text-center">
                        <a href="/api/detinut/${currentIdnp}/garantii/download/${r.ID}" target="_blank" class="btn-ghost btn-tiny" style="text-decoration:none;">⬇️ PDF</a>
                        <button class="btn-danger btn-tiny" onclick="window.garantOps.delete(${r.ID})">Șterge</button>
                    </td>
                </tr>
            `).join('');

            html += `</tbody></table></div>`;
            listArea.innerHTML = html;

        } catch (e) {
            listArea.innerHTML = `<div class="error-box">Eroare: ${e.message}</div>`;
        }
    }

    // --- GLOBAL OPERATIONS ---
    window.garantOps = {
        openModal: () => {
            selectedFile = null;
            const modal = document.getElementById('garantModal');
            const form = document.getElementById('garantUploadForm');
            const textEl = document.getElementById('garantDropText');
            
            if(form) form.reset();
            if(textEl) {
                textEl.textContent = "Trage fișierul PDF aici sau click pentru a selecta";
                textEl.style.color = "";
                textEl.style.fontWeight = "";
            }
            if(modal) modal.classList.add('open');
        },

        closeModal: () => {
            const modal = document.getElementById('garantModal');
            if(modal) modal.classList.remove('open');
        },

        submitUpload: async () => {
            if (!selectedFile) {
                alert("Vă rugăm selectați un fișier PDF.");
                return;
            }

            const descInput = document.getElementById('garantDesc');
            const desc = descInput.value.trim() || selectedFile.name;
            const btn = document.getElementById('btnGarantSave');

            const formData = new FormData();
            formData.append('pdf', selectedFile);
            formData.append('descriere', desc);

            btn.disabled = true;
            btn.textContent = "Se încarcă...";

            try {
                const userId = sessionStorage.getItem("prison.userId");
                const res = await fetch(`/api/detinut/${currentIdnp}/garantii`, {
                    method: 'POST',
                    headers: { "x-user-id": userId },
                    body: formData
                });
                
                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                window.garantOps.closeModal();
                await loadFiles();
                
                // Refresh Badge Logic (Optional: force reload module/header)
                if(document.getElementById('detinutHeader')) {
                     const nameEl = document.querySelector('.header-name');
                     if(nameEl && !nameEl.querySelector('.badge-guarantee')) {
                         nameEl.insertAdjacentHTML('beforeend', '<div style="font-size:0.5em; line-height:1; vertical-align:middle; display:inline-block;"><div class="badge-guarantee">⚠️ GARANȚII DE STAT!</div></div>');
                     }
                }

            } catch (e) {
                alert("Eroare la încărcare: " + e.message);
            } finally {
                btn.disabled = false;
                btn.textContent = "Încarcă";
            }
        },

        delete: async (id) => {
            if (!confirm("Sigur ștergeți acest document?")) return;
            try {
                await window.prisonApi.del(`/detinut/garantii/${id}`);
                await loadFiles();
                
                // Remove badge if list empty (lazy check)
                // Ideally backend tells us status, but we can guess or refresh header
                const listArea = document.getElementById('garantListArea');
                if(listArea && listArea.innerText.includes("Nu există documente")) {
                     const badge = document.querySelector('.badge-guarantee');
                     if(badge) badge.parentElement.remove();
                }

            } catch (e) {
                alert("Eroare la ștergere: " + e.message);
            }
        }
    };
})();