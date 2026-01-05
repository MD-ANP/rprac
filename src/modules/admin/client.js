(function () {
    const api = window.prisonApi;

    // --- Helper Functions ---
    const qs = (root, sel) => root.querySelector(sel);
    const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));

    const setMsg = (el, text, type) => {
        if (!el) return;
        el.textContent = text || "";
        el.className = `admin-msg ${type || ""}`;
    };

    const fillSelect = (sel, items, placeholder) => {
        if (!sel) return;
        sel.innerHTML = "";
        if (placeholder) {
            const o = document.createElement("option");
            o.value = "";
            o.textContent = placeholder;
            sel.appendChild(o);
        }
        items.forEach((it) => {
            const o = document.createElement("option");
            o.value = it.id;
            o.textContent = it.name;
            sel.appendChild(o);
        });
    };

    const ensureChartJS = () => {
        return new Promise((resolve, reject) => {
            if (window.Chart) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    };

    const loadMeta = async () => {
        const data = await api.get("/admin/meta");
        if (!data.success) throw new Error(data.error || "Eroare meta.");
        return data;
    };

    const getUid_helper = () => localStorage.getItem('userId') || 0;

    // --- Rights Management ---
    async function loadRightsInCard(container, userId) {
        container.innerHTML = "<div class='loader-sm'>Se încarcă modulele...</div>";
        try {
            const data = await window.prisonApi.get(`/admin/user/${userId}/rights`);
            if (!data.success) throw new Error();

            const rows = data.modules.map(m => `
                <tr data-module-id="${m.moduleId}" data-access-id="${m.accessId || ''}">
                    <td class="truncate" title="${m.moduleName}">${m.moduleName}</td>
                    <td class="c"><input type="radio" name="mod-${userId}-${m.moduleId}" value="N" ${m.drept === 'N' ? 'checked' : ''}></td>
                    <td class="c"><input type="radio" name="mod-${userId}-${m.moduleId}" value="R" ${m.drept === 'R' ? 'checked' : ''}></td>
                    <td class="c"><input type="radio" name="mod-${userId}-${m.moduleId}" value="W" ${m.drept === 'W' ? 'checked' : ''}></td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="rights-table-container">
                    <table class="rights-table compact">
                        <thead><tr><th>Modul</th><th>Fără</th><th>Citire</th><th>Scriere</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <button type="button" class="btn-secondary btn-save-rights full-width mt-10">💾 Salvează Drepturi Acces</button>
            `;

            container.querySelector(".btn-save-rights").onclick = async () => {
                const rights = Array.from(container.querySelectorAll("tbody tr")).map(tr => ({
                    moduleId: Number(tr.dataset.moduleId),
                    accessId: tr.dataset.accessId ? Number(tr.dataset.accessId) : null,
                    drept: tr.querySelector("input:checked").value
                }));
                const resp = await window.prisonApi.post(`/admin/user/${userId}/rights`, { rights });
                alert(resp.success ? "Drepturi salvate!" : "Eroare: " + resp.error);
            };
        } catch (e) { container.innerHTML = "<div class='error-text'>Eroare la încărcarea modulelor.</div>"; }
    }

    // --- User Card Rendering ---
    function renderUserCard(user, meta) {
        const div = document.createElement("div");
        div.className = "admin-user-card";

        div.innerHTML = `
          <div class="admin-two-col">
            <div class="left-col">
              <h3 class="admin-user-title">👤 ${user.username} <small class="text-muted">(ID: ${user.id})</small></h3>
              
              <div class="f-group">
                <label>Ultima logare</label>
                <input type="text" value="${user.lastLogin || 'Niciodată'}" readonly class="readonly-input">
              </div>
              
              <div class="f-group">
                <label>Username (Login)</label>
                <input type="text" name="username" value="${user.username}" autocomplete="off">
              </div>
              
              <div class="f-group">
                <label>Resetare Parolă</label>
                <input type="text" name="password" placeholder="Lasă gol pentru a păstra parola actuală" autocomplete="off">
              </div>
              
              <div class="admin-grid-2">
                <div class="f-group">
                    <label>Rol Acces</label>
                    <select name="roleId"></select>
                </div>
                <div class="f-group">
                    <label>Penitenciar</label>
                    <select name="penitenciarId"></select>
                </div>
              </div>
              
              <div class="admin-card-actions mt-20">
                <button type="button" class="btn-primary btn-save">💾 Salvează Date</button>
                <button type="button" class="btn-danger btn-deactivate">🚫 Dezactivează Cont</button>
              </div>

              <div class="proof-section mt-20">
                <label class="section-label">📄 Document Justificativ (Proof PDF)</label>
                <div id="proof-status-${user.id}" class="proof-status-box">
                    ${user.hasProof ? 
                        `<a href="/api/admin/user/${user.id}/proof/view" target="_blank" class="btn-view-pdf">👁️ Vezi Document Semnat</a>` : 
                        `<span class="error-text">⚠️ Documentul lipsește de pe server</span>`}
                </div>
                
                <div class="upload-controls mt-10">
                    <input type="file" id="file-${user.id}" accept=".pdf" style="display:none">
                    <button type="button" class="btn-ghost btn-sm" onclick="document.getElementById('file-${user.id}').click()">📁 Alege Fișier</button>
                    <button type="button" class="btn-success btn-sm btn-upload" id="upload-btn-${user.id}" style="display:none;">🚀 Confirmă Încărcarea</button>
                </div>
                <p class="hint">Încărcarea va suprascrie orice document existent pentru acest utilizator.</p>
              </div>
            </div>

            <div class="right-col">
               <h3 class="admin-user-title">🔐 Drepturi Module</h3>
               <div class="rights-card-inner" id="rights-container-${user.id}"></div>
            </div>
          </div>
          <div class="admin-msg user-msg"></div>
        `;

        const roleSel = div.querySelector("select[name=roleId]");
        const penSel = div.querySelector("select[name=penitenciarId]");
        fillSelect(roleSel, meta.roles, "-- Rol --");
        fillSelect(penSel, meta.penitenciars, "-- Penitenciar --");
        roleSel.value = user.roleId || "";
        penSel.value = user.penitenciarId || "";

        loadRightsInCard(div.querySelector(`#rights-container-${user.id}`), user.id);

        const fInput = div.querySelector(`#file-${user.id}`);
        const uBtn = div.querySelector(`#upload-btn-${user.id}`);
        
        fInput.onchange = () => { if(fInput.files.length > 0) uBtn.style.display = "inline-block"; };
        
        uBtn.onclick = async () => {
            const file = fInput.files[0];
            if(!file) return;
            const fd = new FormData();
            fd.append('proof', file);
            uBtn.disabled = true;
            uBtn.textContent = "Se încarcă...";

            try {
                const resp = await fetch(`/api/admin/user/${user.id}/proof`, { 
                    method: 'POST', 
                    body: fd, 
                    headers: { 'x-user-id': getUid_helper() } 
                }).then(res => res.json());

                if(resp.success) { 
                    alert("Documentul a fost salvat cu succes!"); 
                    location.reload(); 
                } else throw new Error(resp.error || "Eroare la server."); 
            } catch(e) { 
                alert("Eroare la upload: " + e.message); 
                uBtn.disabled = false;
                uBtn.textContent = "Confirmă Încărcarea";
            }
        };

        div.querySelector(".btn-save").onclick = async () => {
            const msg = div.querySelector(".user-msg");
            setMsg(msg, "Se salvează...", "info");
            const payload = {
                username: div.querySelector("input[name=username]").value.trim(),
                password: div.querySelector("input[name=password]").value.trim(),
                roleId: Number(roleSel.value),
                penitenciarId: Number(penSel.value)
            };
            try {
                const res = await api.post(`/admin/user/${user.id}/update`, payload);
                if (!res.success) throw new Error(res.error);
                setMsg(msg, "Datele utilizatorului au fost actualizate.", "success");
                div.querySelector("input[name=password]").value = "";
            } catch (e) { setMsg(msg, e.message, "error"); }
        };

        div.querySelector(".btn-deactivate").onclick = async () => {
            if (!confirm(`Dezactivați utilizatorul ${user.username}?`)) return;
            try {
                const res = await api.post(`/admin/user/${user.id}/deactivate`, {});
                if (!res.success) throw new Error(res.error);
                location.reload();
            } catch (e) { alert("Eroare: " + e.message); }
        };

        return div;
    }

    // --- Announcements ---
    async function initAnnouncements(root) {
        const listEl = qs(root, "#adminAnnList");
        const form = qs(root, "#adminAnnForm");
        const msg = qs(root, "#adminAnnMsg");

        const refresh = async () => {
            listEl.innerHTML = "<div class='loader-sm'>Se încarcă...</div>";
            try {
                const data = await api.get("/admin/ann");
                if (!data.success) throw new Error(data.error || "Eroare anunțuri.");
                const items = data.items || [];
                listEl.innerHTML = "";
                
                if (!items.length) {
                    listEl.innerHTML = '<div class="empty-state">Nu există niciun anunț activ.</div>';
                    return;
                }

                const latest = items[0];
                const row = document.createElement("div");
                row.className = "ann-card-display";
                row.innerHTML = `
                    <div class="ann-content">
                        <span class="ann-badge">Anunț Activ</span>
                        <p class="ann-text-body">${latest.message}</p>
                    </div>
                    <button type="button" class="btn-danger-outline btn-sm">Șterge</button>
                `;
                row.querySelector("button").onclick = async () => {
                    if (!confirm(`Ștergi anunțul?`)) return;
                    try {
                        const resp = await api.del(`/admin/ann`); 
                        if (!resp.success) throw new Error(resp.error || "Eroare.");
                        refresh();
                    } catch (e) { setMsg(msg, e.message, "error"); }
                };
                listEl.appendChild(row);
            } catch (e) { listEl.textContent = e.message; }
        };

        if (form) {
            form.onsubmit = async (ev) => {
                ev.preventDefault();
                const text = qs(form, "textarea[name=message]").value.trim();
                if (!text) return setMsg(msg, "Textul este gol.", "error");
                try {
                    await api.del("/admin/ann");
                    const resp = await api.post("/admin/ann", { message: text });
                    if (!resp.success) throw new Error(resp.error);
                    qs(form, "textarea[name=message]").value = "";
                    setMsg(msg, "Anunț publicat.", "success");
                    refresh();
                } catch (e) { setMsg(msg, e.message, "error"); }
            };
        }
        refresh();
    }

    // --- Statistics ---
    async function initStatsPanel(root) {
        const canvas = qs(root, "#usersByPrisonChart");
        if (!canvas) return;
        try {
            await ensureChartJS();
            const res = await api.get("/admin/stats/users");
            if (!res.success) throw new Error(res.error);

            qs(root, "#statActive").textContent = res.counters.active;
            qs(root, "#statDeact").textContent = res.counters.deactivated;
            qs(root, "#statInact").textContent = res.counters.inactive;

            const existingChart = window.Chart.getChart(canvas);
            if (existingChart) existingChart.destroy();

            const dist = res.distribution || [];
            new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dist.map(d => d.label),
                    datasets: [{
                        label: 'Utilizatori',
                        data: dist.map(d => d.count),
                        backgroundColor: '#2563eb',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                }
            });
        } catch (e) { console.error(e); }
    }

    // --- Search ---
    async function initSearchPanel(root, meta) {
        const form = qs(root, "#adminSearchForm");
        const results = qs(root, "#adminSearchResults");
        if (!form) return;
        form.onsubmit = async (ev) => {
            ev.preventDefault();
            const q = qs(form, "input[name=q]").value.trim();
            if (!q) return results.innerHTML = "<p class='info-text'>Introduceți un termen de căutare.</p>";
            results.innerHTML = "<div class='loader'>Se caută utilizatorii...</div>";
            try {
                const data = await api.get(`/admin/user/search?q=${encodeURIComponent(q)}`);
                if (!data.success) throw new Error(data.error);
                results.innerHTML = "";
                if (!data.users.length) return results.innerHTML = "<p class='info-text'>Niciun rezultat găsit.</p>";
                data.users.forEach(u => results.appendChild(renderUserCard(u, meta)));
            } catch (e) { results.innerHTML = `<p class='error-text'>${e.message}</p>`; }
        };
    }

    // --- Main Panels ---
    async function initCreatePanel(root, meta) {
        const form = qs(root, "#adminCreateForm");
        const msg = qs(root, "#adminCreateMsg");
        if (!form) return;
        fillSelect(qs(form, "select[name=roleId]"), meta.roles, "-- Rol --");
        fillSelect(qs(form, "select[name=penitenciarId]"), meta.penitenciars, "-- Penitenciar --");
        form.onsubmit = async (ev) => {
            ev.preventDefault();
            const fd = new FormData(form);
            const payload = {
                username: fd.get("username"),
                password: fd.get("password"),
                autoPassword: fd.get("autoPassword") === "on",
                roleId: Number(fd.get("roleId") || 0),
                penitenciarId: Number(fd.get("penitenciarId") || 0)
            };
            try {
                const data = await api.post("/admin/user/create", payload);
                if (!data.success) throw new Error(data.error);
                setMsg(msg, `Creat: ${data.username} ${data.autoPassword ? '| Pwd: ' + data.autoPassword : ''}`, "success");
                form.reset();
            } catch (e) { setMsg(msg, e.message, "error"); }
        };
    }

    async function initBulkPanel(root, meta) {
        const form = qs(root, "#adminBulkForm");
        const msg = qs(root, "#adminBulkMsg");
        const report = qs(root, "#adminBulkReport");
        if (!form) return;
        fillSelect(qs(form, "select[name=roleId]"), meta.roles, "-- Rol --");
        fillSelect(qs(form, "select[name=penitenciarId]"), meta.penitenciars, "-- Penitenciar --");
        form.onsubmit = async (ev) => {
            ev.preventDefault();
            const fd = new FormData(form);
            const payload = {
                usernamesText: fd.get("usernamesText"),
                roleId: Number(fd.get("roleId") || 0),
                penitenciarId: Number(fd.get("penitenciarId") || 0),
                autoPassword: fd.get("autoPassword") === "on"
            };
            try {
                const data = await api.post("/admin/user/bulk", payload);
                if (!data.success) throw new Error(data.error);
                setMsg(msg, `Adăugate: ${data.okCount}, Eșecuri: ${data.failCount}`, "success");
                report.textContent = (data.report || []).join("\n");
            } catch (e) { setMsg(msg, e.message, "error"); }
        };
    }

    // --- Tabs ---
    function setupTabs(root) {
        const buttons = qsa(root, "[data-admin-tab]");
        const panels = qsa(root, "[data-admin-panel]");
        const show = (name) => {
            panels.forEach(p => p.style.display = p.dataset.adminPanel === name ? "block" : "none");
            buttons.forEach(b => b.classList.toggle("active", b.dataset.adminTab === name));
            if (name === "stats") initStatsPanel(root);
        };
        buttons.forEach(b => b.onclick = () => show(b.dataset.adminTab));
        show("create");
    }

    // --- Render ---
    async function renderAdminPage(mainEl) {
        try {
            const meta = await loadMeta();
            mainEl.innerHTML = `
                <div class="admin-wrapper">
                    <header class="admin-page-header">
                        <h1>⚙️ Administrare Sistem</h1>
                        <p>Panou de control pentru utilizatori, drepturi și monitorizare rprac.</p>
                    </header>

                    <div class="admin-tabs-nav">
                        <button class="admin-tab-btn active" data-admin-tab="create">👤 Adaugă User</button>
                        <button class="admin-tab-btn" data-admin-tab="bulk">📥 Import Masiv</button>
                        <button class="admin-tab-btn" data-admin-tab="search">🔎 Căutare & Editare</button>
                        <button class="admin-tab-btn" data-admin-tab="ann">📢 Anunțuri</button>
                        <button class="admin-tab-btn" data-admin-tab="stats">📊 Statistici</button>
                    </div>

                    <main class="admin-content-area">
                        <section class="admin-panel" data-admin-panel="create">
                            <div class="panel-header"><h2>Creează Utilizator Nou</h2></div>
                            <form id="adminCreateForm" class="modern-form">
                                <div class="admin-grid-2">
                                    <div class="f-group"><label>Username</label><input type="text" name="username" required></div>
                                    <div class="f-group">
                                        <label>Parolă</label>
                                        <input type="text" name="password" placeholder="Parolă manuală">
                                        <label class="check-label"><input type="checkbox" name="autoPassword"> Generează automat</label>
                                    </div>
                                    <div class="f-group"><label>Rol</label><select name="roleId" required></select></div>
                                    <div class="f-group"><label>Penitenciar</label><select name="penitenciarId" required></select></div>
                                </div>
                                <div class="btn-row-end"><button type="submit" class="btn-primary">Creează Cont</button></div>
                                <div id="adminCreateMsg"></div>
                            </form>
                        </section>

                        <section class="admin-panel" data-admin-panel="bulk" style="display:none">
                            <div class="panel-header"><h2>Import Masiv Utilizatori</h2></div>
                            <form id="adminBulkForm" class="modern-form">
                                <label>Listă usernames (unul pe linie sau virgulă)</label>
                                <textarea name="usernamesText" rows="5" class="full-width-textarea" placeholder="popescu.ion, vasilescu.dan..."></textarea>
                                <div class="admin-grid-2 mt-10">
                                    <div class="f-group"><label>Rol Comun</label><select name="roleId"></select></div>
                                    <div class="f-group"><label>Penitenciar Comun</label><select name="penitenciarId"></select></div>
                                </div>
                                <div class="bulk-pwd-settings mt-10">
                                    <label class="check-label"><input type="checkbox" name="autoPassword"> Parole unice automate</label>
                                </div>
                                <div class="btn-row-end mt-10"><button type="submit" class="btn-primary">Procesează Importul</button></div>
                                <pre id="adminBulkReport" class="report-box"></pre>
                                <div id="adminBulkMsg"></div>
                            </form>
                        </section>

                        <section class="admin-panel" data-admin-panel="search" style="display:none">
                            <div class="panel-header"><h2>Căutare Utilizatori</h2></div>
                            <div class="search-container-centered">
                                <form id="adminSearchForm" class="search-bar-modern">
                                    <input type="text" name="q" placeholder="Nume utilizator sau ID..." autocomplete="off">
                                    <button type="submit" class="btn-primary">Caută</button>
                                </form>
                            </div>
                            <div id="adminSearchResults" class="results-container"></div>
                        </section>

                        <section class="admin-panel" data-admin-panel="ann" style="display:none">
                            <div class="panel-header"><h2>Anunțuri Globale</h2></div>
                            <form id="adminAnnForm" class="modern-form">
                                <div class="f-group">
                                    <label>Mesaj Anunț</label>
                                    <textarea name="message" rows="4" class="full-width-textarea" placeholder="Mesajul tău va apărea tuturor utilizatorilor rprac..."></textarea>
                                </div>
                                <div class="btn-full-width-container">
                                    <button type="submit" class="btn-primary btn-full-width">Publică Anunț Sistem</button>
                                </div>
                                <div id="adminAnnMsg"></div>
                            </form>
                            <div id="adminAnnList" class="mt-20"></div>
                        </section>

                        <section class="admin-panel" data-admin-panel="stats" style="display:none">
                            <div class="stats-kpi-grid">
                                <div class="kpi-card active">
                                    <span class="kpi-label">Activitate recentă</span>
                                    <span class="kpi-val" id="statActive">0</span>
                                </div>
                                <div class="kpi-card deact">
                                    <span class="kpi-label">Dezactivați</span>
                                    <span class="kpi-val" id="statDeact">0</span>
                                </div>
                                <div class="kpi-card dormant">
                                    <span class="kpi-label">Dormanți (>3 luni)</span>
                                    <span class="kpi-val" id="statInact">0</span>
                                </div>
                            </div>
                            <div class="chart-wrapper mt-20">
                                <h3>Distribuție Utilizatori per Penitenciar</h3>
                                <div class="canvas-holder"><canvas id="usersByPrisonChart"></canvas></div>
                            </div>
                        </section>
                    </main>
                </div>

                <style>
                    :root {
                        --primary: #2563eb; --primary-hover: #1d4ed8;
                        --bg: #f8fafc; --card: #ffffff;
                        --text: #1e293b; --text-light: #64748b;
                        --border: #e2e8f0; --danger: #dc2626;
                        --success: #059669; --info: #0891b2;
                    }

                    .admin-wrapper { font-family: 'Inter', system-ui, sans-serif; color: var(--text); background: var(--bg); padding: 20px; max-width: 1100px; margin: 0 auto; }
                    .admin-page-header { text-align: center; margin-bottom: 30px; }
                    .admin-page-header h1 { font-size: 2.2rem; font-weight: 800; margin: 0; color: var(--text); }
                    .admin-page-header p { color: var(--text-light); font-size: 1.1rem; margin-top: 8px; }

                    /* Tabs */
                    .admin-tabs-nav { display: flex; justify-content: center; gap: 8px; border-bottom: 2px solid var(--border); margin-bottom: 30px; }
                    .admin-tab-btn { padding: 14px 24px; border: none; background: none; cursor: pointer; font-weight: 700; color: var(--text-light); transition: 0.2s; border-radius: 8px 8px 0 0; }
                    .admin-tab-btn:hover { color: var(--primary); background: #f1f5f9; }
                    .admin-tab-btn.active { color: var(--primary); border-bottom: 4px solid var(--primary); background: #fff; }

                    /* Forms & Inputs */
                    .modern-form { background: var(--card); padding: 30px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                    .f-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; width: 100%; }
                    .f-group label { font-weight: 700; font-size: 0.95rem; color: var(--text); }
                    
                    input[type="text"], input[type="password"], select, textarea { 
                        width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; 
                        transition: all 0.2s; background: #fff; color: var(--text); box-sizing: border-box;
                    }
                    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); ring: 2px solid #bfdbfe; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
                    .full-width-textarea { min-height: 120px; resize: vertical; }

                    /* Buttons */
                    .btn-primary { background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; transition: 0.2s; }
                    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
                    .btn-danger { background: var(--danger); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; }
                    
                    /* Centering Search */
                    .search-container-centered { display: flex; justify-content: center; margin-bottom: 30px; }
                    .search-bar-modern { display: flex; gap: 0; width: 100%; max-width: 600px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-radius: 10px; overflow: hidden; }
                    .search-bar-modern input { border-radius: 10px 0 0 10px; border-right: none; flex: 1; }
                    .search-bar-modern button { border-radius: 0 10px 10px 0; padding: 0 30px; }

                    /* Announcement Styling */
                    .btn-full-width-container { width: 100%; margin-top: 10px; }
                    .btn-full-width { width: 100%; display: block; font-size: 1.1rem; padding: 15px; }

                    .ann-card-display { 
                        display: flex; justify-content: space-between; align-items: center; 
                        background: #334155; color: white; padding: 25px; border-radius: 12px; 
                        margin-top: 20px; border: 1px solid #475569; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
                    }
                    .ann-badge { font-size: 0.8rem; text-transform: uppercase; font-weight: 900; color: #fbbf24; letter-spacing: 0.05em; margin-bottom: 8px; display: block; }
                    .ann-text-body { margin: 0; font-size: 1.15rem; line-height: 1.6; color: #f8fafc; font-weight: 500; }
                    .btn-danger-outline { border: 2px solid #ef4444; color: #ef4444; background: transparent; font-weight: 700; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
                    .btn-danger-outline:hover { background: #ef4444; color: white; }

                    /* KPI Cards */
                    .stats-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                    .kpi-card { padding: 25px; border-radius: 15px; text-align: center; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                    .kpi-card.active { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
                    .kpi-card.deact { background: linear-gradient(135deg, #475569, #334155); }
                    .kpi-card.dormant { background: linear-gradient(135deg, #94a3b8, #64748b); }
                    .kpi-label { font-size: 0.9rem; text-transform: uppercase; font-weight: 800; opacity: 0.9; letter-spacing: 0.025em; }
                    .kpi-val { font-size: 2.5rem; font-weight: 900; display: block; margin-top: 5px; }

                    /* User Card */
                    .admin-user-card { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 35px; width: 100%; box-sizing: border-box; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); margin-bottom: 30px; }
                    .admin-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                    .left-col { border-right: 1px solid var(--border); padding-right: 40px; }
                    .admin-user-title { margin-top: 0; font-size: 1.5rem; font-weight: 800; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; }

                    .mt-10 { margin-top: 10px; } .mt-20 { margin-top: 20px; }
                    .btn-row-end { display: flex; justify-content: flex-end; }
                    
                    @media (max-width: 1000px) { 
                        .admin-two-col { grid-template-columns: 1fr; } .left-col { border-right: none; padding-right: 0; }
                        .stats-kpi-grid { grid-template-columns: 1fr; }
                    }
                </style>
            `;

            const root = mainEl.firstElementChild;
            setupTabs(root);
            initCreatePanel(root, meta);
            initBulkPanel(root, meta);
            initSearchPanel(root, meta);
            initAnnouncements(root);
        } catch (err) {
            mainEl.innerHTML = `<div class="admin-msg error">${err.message}</div>`;
        }
    }

    window.prisonModules = window.prisonModules || {};
    window.prisonModules.admin = {
        init({ container }) { renderAdminPage(container); },
    };
})();