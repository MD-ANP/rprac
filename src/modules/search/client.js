(function () {
    const api = window.prisonApi;

    // --- Helpers ---
    const escapeHtml = (str) => String(str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    function buildLayout(container) {
        container.innerHTML = `
            <div class="search-module-wrapper">
                <header class="module-header">
                    <h1>🔍 Căutare Deținuți</h1>
                    <p>Filtrare avansată după date de identificare sau număr de dosar.</p>
                </header>

                <section class="modern-card search-filter-card">
                    <form id="searchForm" class="search-form-grid">
                        <div class="f-group"><label>Nume</label><input name="surname" type="text" placeholder="POPESCU"></div>
                        <div class="f-group"><label>Prenume</label><input name="name" type="text" placeholder="ION"></div>
                        <div class="f-group"><label>Patronimic</label><input name="secName" type="text" placeholder="VASILE"></div>
                        <div class="f-group"><label>IDNP</label><input name="idnp" type="text" placeholder="13 cifre" maxlength="13"></div>
                        <div class="f-group"><label>Data Nașterii</label><input name="birth" type="text" placeholder="ZZ.LL.AAAA"></div>
                        <div class="f-group"><label>Număr Dosar</label><input name="id" type="text" placeholder="Nr. Dosar"></div>
                        
                        <div class="search-submit-area">
                            <button type="submit" class="btn-primary btn-search-main">🔎 Caută în Baza de Date</button>
                        </div>
                    </form>
                    <div id="searchMessage" class="form-message"></div>
                </section>

                <section id="searchResultsSection" class="results-container" style="display:none;">
                    <div class="results-header">
                        <h2 class="card-label">Rezultate Găsite</h2>
                        <span id="searchResultsInfo" class="results-info-badge"></span>
                    </div>
                    <div id="searchGrid" class="inmate-compact-grid"></div>
                </section>
            </div>

            <style>
                .search-module-wrapper { max-width: 1200px; margin: 0 auto; padding: 15px; font-family: 'Inter', sans-serif; }
                .module-header { text-align: center; margin-bottom: 25px; }
                .module-header h1 { font-size: 1.8rem; font-weight: 800; margin: 0; color: #1e293b; }
                
                .modern-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                
                /* Form Grid */
                .search-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
                .f-group { display: flex; flex-direction: column; gap: 5px; }
                .f-group label { font-weight: 700; font-size: 0.8rem; color: #64748b; }
                .f-group input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; }
                
                .search-submit-area { grid-column: 1 / -1; display: flex; justify-content: center; padding-top: 10px; }
                .btn-primary { background: #2563eb; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
                .btn-primary:hover { background: #1d4ed8; }

                /* Results Grid Optimization */
                .results-container { margin-top: 30px; }
                .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
                
                /* Force 3 items per row on large screens */
                .inmate-compact-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
                    gap: 15px; 
                }

                /* Compact Result Card */
                .res-card { 
                    background: white; border: 1px solid #e2e8f0; border-radius: 10px; 
                    overflow: hidden; display: flex; flex-direction: column; 
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .res-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                
                .res-body { display: flex; padding: 12px; gap: 12px; flex: 1; }
                .res-img-box { width: 75px; height: 95px; background: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #f1f5f9; flex-shrink: 0; }
                .res-img-box img { width: 100%; height: 100%; object-fit: cover; }
                
                .res-info { flex: 1; min-width: 0; }
                .res-idnp { font-size: 0.7rem; color: #94a3b8; font-weight: 700; font-family: monospace; }
                .res-name { font-size: 1rem; font-weight: 800; color: #0f172a; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .res-birth { font-size: 0.8rem; color: #64748b; }
                
                .res-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-top: 5px; }
                .b-status { background: #dcfce7; color: #166534; }

                /* New Placement for "Ultima Miscare" */
                .res-movement-bar { 
                    background: #f8fafc; border-top: 1px solid #f1f5f9; 
                    padding: 8px 12px; font-size: 0.75rem; color: #475569; 
                    display: flex; align-items: center; gap: 5px;
                }
                .res-movement-bar strong { color: #2563eb; }

                .res-footer { padding: 10px 12px; display: flex; justify-content: flex-end; background: #fff; }
                .btn-open { background: #f1f5f9; color: #1e293b; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
                .btn-open:hover { background: #2563eb; color: white; border-color: #2563eb; }

                .form-message { text-align: center; margin-top: 10px; font-weight: 600; font-size: 0.9rem; }
                .form-message.error { color: #dc2626; }
            </style>
        `;
    }

    function renderResults(sectionEl, infoEl, gridEl, data) {
        const results = Array.isArray(data.results) ? data.results : [];
        if (!results.length) {
            sectionEl.style.display = "block";
            infoEl.textContent = "Niciun rezultat găsit.";
            gridEl.innerHTML = "";
            return;
        }

        infoEl.textContent = `Rezultate: ${results.length}`;
        gridEl.innerHTML = results.map(item => {
            const photoUrl = item.hasPhoto && item.idnp ? `/uploads/photos/${item.idnp.charAt(0)}/${item.idnp}/1.webp` : null;

            return `
                <article class="res-card">
                    <div class="res-body">
                        <div class="res-img-box">
                            ${photoUrl ? `<img src="${photoUrl}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjUiPjwvY2lyY2xlPjxwYXRoIGQ9Ik0yMCAyMWE4IDggMCAwIDAtMTYgMCI+PC9wYXRoPjwvc3ZnPg=='">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-weight:bold;">?</div>`}
                        </div>
                        <div class="res-info">
                            <div class="res-idnp">${escapeHtml(item.idnp)}</div>
                            <h3 class="res-name" title="${escapeHtml(item.surname)} ${escapeHtml(item.name)}">${escapeHtml(item.surname)} ${escapeHtml(item.name)}</h3>
                            <div class="res-birth">📅 ${escapeHtml(item.birth)}</div>
                            <span class="res-badge b-status">${escapeHtml(item.statut || "Activ")}</span>
                        </div>
                    </div>
                    
                    <div class="res-movement-bar">
                        <span>📍 <strong>Mișcare:</strong> ${escapeHtml(item.miscareText || "Nicio mișcare")}</span>
                    </div>

                    <div class="res-footer">
                        <button type="button" class="btn-open" onclick="window.location.href='/app/index.html?module=detinut&id=${item.id}'">📂 Deschide Dosar</button>
                    </div>
                </article>
            `;
        }).join("");

        sectionEl.style.display = "block";
    }

    async function handleSubmit(ev, container) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const msgEl = container.querySelector("#searchMessage");
        const sectionEl = container.querySelector("#searchResultsSection");
        const gridEl = container.querySelector("#searchGrid");

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        const hasAny = Object.values(payload).some(v => v.trim().length > 0);

        if (!hasAny) {
            msgEl.textContent = "Introduceți cel puțin un criteriu.";
            msgEl.className = "form-message error";
            return;
        }

        msgEl.textContent = "Se caută...";
        msgEl.className = "form-message";

        try {
            const data = await api.post("/search/detinuti", payload);
            if (!data.success) throw new Error(data.error);
            renderResults(sectionEl, container.querySelector("#searchResultsInfo"), gridEl, data);
            msgEl.textContent = "";
        } catch (err) {
            msgEl.textContent = err.message;
            msgEl.className = "form-message error";
        }
    }

    window.prisonModules = window.prisonModules || {};
    window.prisonModules.cautare = {
        init({ container }) {
            buildLayout(container);
            container.querySelector("#searchForm").addEventListener("submit", (ev) => handleSubmit(ev, container));
        }
    };
})();