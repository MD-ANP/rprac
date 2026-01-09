(function () {
    const api = window.prisonApi;
    let currentSearchParams = {};

    const escapeHtml = (str) => String(str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    function highlight(text, query) {
        if (!query || !text) return escapeHtml(text);
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const parts = String(text).split(new RegExp(`(${escapedQuery})`, 'gi'));
        return parts.map(part => 
            part.toLowerCase() === query.toLowerCase() ? `<mark class="search-highlight">${escapeHtml(part)}</mark>` : escapeHtml(part)
        ).join("");
    }

    function buildLayout(container) {
        container.innerHTML = `
            <div class="search-module-wrapper">
                <header class="module-header">
                    <h1>Căutare Deținuți</h1>
                    <p>Gestionarea bazei de date și vizualizarea dosarelor active.</p>
                </header>

                <section class="modern-card search-filter-card">
                    <form id="searchForm" class="search-form-grid" autocomplete="off">
                        <div class="f-group"><label>Nume</label><input name="surname" type="text" placeholder="POPESCU"></div>
                        <div class="f-group"><label>Prenume</label><input name="name" type="text" placeholder="ION"></div>
                        <div class="f-group"><label>IDNP / Cod</label><input name="idnp" type="text" placeholder="Căutare parțială..." maxlength="20"></div>
                        <div class="f-group"><label>Data Nașterii</label><input name="birth" type="text" placeholder="ZZ.LL.AAAA"></div>
                        <div class="f-group"><label>Nr. Dosar</label><input name="id" type="text" placeholder="Dosar"></div>
                        
                        <div class="search-submit-area">
                            <button type="button" id="resetBtn" class="btn-reset">Șterge filtre</button>
                            <button type="submit" class="btn-primary btn-search-main">Pornește Căutarea</button>
                        </div>
                    </form>
                    <div id="searchMessage" class="form-message"></div>
                </section>

                <section id="searchResultsSection" class="results-container" style="display:none;">
                    <div class="results-header">
                        <span id="searchResultsInfo" class="results-info-badge"></span>
                    </div>
                    <div id="searchGrid" class="inmate-compact-grid"></div>
                </section>
            </div>

            <style>
                :root { 
                    --p-blue: #2563eb; 
                    --p-blue-glow: rgba(37, 99, 235, 0.15);
                    --p-text: #0f172a; 
                    --p-gray: #64748b; 
                    --p-border: #e2e8f0; 
                }

                /* Lărgirea paginii pentru a permite mai multe elemente pe rând */
                .search-module-wrapper { max-width: 1650px; margin: 0 auto; padding: 30px 20px; font-family: 'Inter', sans-serif; }
                
                .module-header { margin-bottom: 40px; }
                .header-badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 10px; }
                .module-header h1 { font-size: 2.5rem; font-weight: 900; color: var(--p-text); margin: 0; letter-spacing: -0.03em; }
                .module-header p { color: var(--p-gray); font-size: 1.1rem; }

                .modern-card { background: white; border: 1px solid var(--p-border); border-radius: 24px; padding: 35px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .search-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                .f-group { display: flex; flex-direction: column; gap: 8px; }
                .f-group label { font-weight: 700; font-size: 0.8rem; color: var(--p-gray); text-transform: uppercase; }
                .f-group input { padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 1rem; background: #f8fafc; transition: 0.2s; }
                .f-group input:focus { border-color: var(--p-blue); background: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,0.1); outline: none; }

                .search-submit-area { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 15px; padding-top: 25px; border-top: 1px solid #f1f5f9; }
                .btn-primary { background: var(--p-blue); color: white; border: none; padding: 15px 45px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.3s; }
                .btn-reset { background: #f1f5f9; color: var(--p-gray); border: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; cursor: pointer; }

                /* Grid configurat pentru 4 coloane pe ecrane mari */
                .results-container { margin-top: 50px; }
                .inmate-compact-grid { 
                    display: grid; 
                    gap: 25px; 
                    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); 
                }

                /* Card Premium Design */
                .res-card { 
                    background: white; 
                    border: 1px solid var(--p-border); 
                    border-radius: 24px; 
                    display: flex; 
                    flex-direction: column; 
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    position: relative;
                    overflow: hidden;
                }
                
                /* Hover state "Baked" corespunzător */
                .res-card:hover { 
                    transform: translateY(-8px); 
                    border-color: var(--p-blue);
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.08), 0 0 0 4px var(--p-blue-glow);
                }

                .res-body { display: flex; padding: 25px; gap: 20px; flex: 1; align-items: flex-start; }
                .res-img-box { 
                    width: 100px; height: 130px; border-radius: 16px; overflow: hidden; 
                    border: 1px solid #f1f5f9; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.04); 
                    background: #f8fafc;
                }
                .res-img-box img { width: 100%; height: 100%; object-fit: cover; }
                
                .res-info { flex: 1; min-width: 0; }
                .res-idnp { font-size: 0.75rem; color: var(--p-gray); font-weight: 700; font-family: 'Roboto Mono', monospace; margin-bottom: 4px; }
                
                .res-name { 
                    font-size: 0.95rem; 
                    font-weight: 800; 
                    color: var(--p-text); 
                    margin: 0; 
                    line-height: 1.3;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-height: 2.6em; 
                }

                .res-birth { font-size: 0.85rem; color: var(--p-gray); margin-top: 10px; font-weight: 500; }
                .res-badge { 
                    display: inline-block; padding: 4px 10px; border-radius: 6px; 
                    font-size: 0.65rem; font-weight: 800; text-transform: uppercase; 
                    margin-top: 12px; background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; 
                }

                .res-movement-bar { 
                    background: #f8fafc; padding: 12px 20px; font-size: 0.8rem; color: #475569; 
                    border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; 
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .res-movement-bar strong { color: var(--p-blue); }

                .res-footer { 
                    padding: 20px; 
                    display: flex; 
                    justify-content: center; 
                    background: white; 
                }
                
                .btn-open-dossier { 
                    background: #0f172a; 
                    color: white; 
                    border: none; 
                    padding: 14px 0; 
                    border-radius: 16px; 
                    font-weight: 700; 
                    font-size: 0.85rem; 
                    cursor: pointer; 
                    transition: all 0.3s;
                    width: 100%; /* Lățime completă în containerul de padding pentru impact vizual */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                
                .btn-open-dossier:hover { 
                    background: var(--p-blue); 
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
                }

                .search-highlight { background: #fef08a; padding: 0 2px; border-radius: 3px; color: #854d0e; }
                .form-message { text-align: center; margin-top: 15px; font-weight: 600; }
                
                .results-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding: 0 5px; }
                .results-info-badge { background: var(--p-text); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;
    }

    function renderResults(sectionEl, infoEl, gridEl, data) {
        const results = Array.isArray(data.results) ? data.results : [];
        sectionEl.style.display = "block";

        if (!results.length) {
            infoEl.textContent = "0 rezultate";
            gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 80px; color:var(--p-gray);">🏜️ Nu am găsit nicio persoană cu datele introduse. Încercați alți parametri.</div>`;
            return;
        }

        infoEl.textContent = `${results.length} rezultate`;
        gridEl.innerHTML = results.map(item => {
            const photoUrl = item.hasPhoto && item.idnp ? `/uploads/photos/${item.idnp.charAt(0)}/${item.idnp}/1.webp` : null;

            return `
                <article class="res-card">
                    <div class="res-body">
                        <div class="res-img-box">
                            ${photoUrl ? `<img src="${photoUrl}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjUiPjwvY2lyY2xlPjxwYXRoIGQ9Ik0yMCAyMWE4IDggMCAwIDAtMTYgMCI+PC9wYXRoPjwvc3ZnPg=='">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-weight:bold; font-size:2rem;">?</div>`}
                        </div>
                        <div class="res-info">
                            <div class="res-idnp">${highlight(item.idnp, currentSearchParams.idnp)}</div>
                            <h3 class="res-name" title="${escapeHtml(item.surname)} ${escapeHtml(item.name)}">${highlight(item.surname, currentSearchParams.surname)} ${highlight(item.name, currentSearchParams.name)}</h3>
                            <div class="res-birth">📅 ${highlight(item.birth, currentSearchParams.birth)}</div>
                            <span class="res-badge">${escapeHtml(item.statut || "Activ")}</span>
                        </div>
                    </div>
                    <div class="res-movement-bar" title="${escapeHtml(item.miscareText)}">
                        📍 <strong>Locație:</strong> ${escapeHtml(item.miscareText || "Nespecificată")}
                    </div>
                    <div class="res-footer">
                        <button type="button" class="btn-open-dossier" onclick="window.location.href='/app/index.html?module=detinut&id=${item.id}'">
                            <span>📂 Deschide Dosar</span>
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    async function handleSubmit(ev, container) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const msgEl = container.querySelector("#searchMessage");
        const sectionEl = container.querySelector("#searchResultsSection");
        const gridEl = container.querySelector("#searchGrid");

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        currentSearchParams = payload;

        const hasAny = Object.values(payload).some(v => v.trim().length > 0);
        if (!hasAny) {
            msgEl.textContent = "Introduceți cel puțin un criteriu pentru căutare.";
            msgEl.style.color = "#dc2626";
            return;
        }

        msgEl.textContent = "Se procesează cererea...";
        msgEl.style.color = "#2563eb";

        try {
            const data = await api.post("/search/detinuti", payload);
            if (!data.success) throw new Error(data.error);
            renderResults(sectionEl, container.querySelector("#searchResultsInfo"), gridEl, data);
            msgEl.textContent = "";
        } catch (err) {
            msgEl.textContent = err.message;
            msgEl.style.color = "#dc2626";
        }
    }

    window.prisonModules = window.prisonModules || {};
    window.prisonModules.cautare = {
        init({ container }) {
            buildLayout(container);
            const form = container.querySelector("#searchForm");
            container.querySelector("#resetBtn").addEventListener("click", () => {
                form.reset();
                container.querySelector("#searchResultsSection").style.display = "none";
                container.querySelector("#searchMessage").textContent = "";
            });
            form.addEventListener("submit", (ev) => handleSubmit(ev, container));
        }
    };
})();