// public/js/admin.js
(function () {
  const api = window.prisonApi;

  // --- Helper Functions ---
  function qs(root, sel) {
    return root.querySelector(sel);
  }
  function qsa(root, sel) {
    return Array.from(root.querySelectorAll(sel));
  }

  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "admin-msg" + (type ? " " + type : "");
  }

  function fillSelect(sel, items, placeholder) {
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
  }

  // Ensure Chart.js is loaded
  function ensureChartJS() {
    return new Promise((resolve, reject) => {
      if (window.Chart) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadMeta() {
    const data = await api.get("/admin/meta");
    if (!data.success) throw new Error(data.error || "Eroare meta.");
    return data;
  }

  // --- Rights Management ---
  async function loadRights(container, userId) {
    container.textContent = "Se încarcă drepturile...";
    const data = await api.get(`/admin/user/${userId}/rights`);
    if (!data.success) {
      container.textContent = data.error || "Eroare drepturi.";
      return;
    }
    const mods = data.modules || [];
    if (!mods.length) {
      container.textContent = "Nu există module definite.";
      return;
    }

    const rows = mods
      .map((m) => {
        const id = m.moduleId;
        const drept = (m.drept || "N").toUpperCase();
        return `
        <tr data-module-id="${id}" data-access-id="${m.accessId || ""}">
          <td>${m.moduleName}</td>
          <td class="c"><input type="radio" name="mod-${id}" value="N"${
          drept === "N" ? " checked" : ""
        }></td>
          <td class="c"><input type="radio" name="mod-${id}" value="R"${
          drept === "R" ? " checked" : ""
        }></td>
          <td class="c"><input type="radio" name="mod-${id}" value="W"${
          drept === "W" ? " checked" : ""
        }></td>
        </tr>
      `;
      })
      .join("");

    container.innerHTML = `
      <div class="rights-wrap">
        <div class="rights-top">
          <input type="text" class="rights-filter" placeholder="Filtrează module..." />
          <div class="rights-bulk">
            <button type="button" data-bulk="N">Fără</button>
            <button type="button" data-bulk="R">Citire</button>
            <button type="button" data-bulk="W">Scriere</button>
          </div>
        </div>
        <table class="rights-table">
          <thead>
            <tr>
              <th>Modul</th>
              <th class="c">Fără</th>
              <th class="c">Citire</th>
              <th class="c">Scriere</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="form-buttons right">
          <button type="button" class="btn-secondary rights-save">Salvează drepturi</button>
        </div>
        <div class="admin-msg" id="rightsMsg"></div>
      </div>
    `;

    const filter = qs(container, ".rights-filter");
    const tbody = qs(container, "tbody");
    const msg = qs(container, "#rightsMsg");

    if (filter && tbody) {
      filter.addEventListener("input", () => {
        const q = filter.value.toLowerCase();
        qsa(tbody, "tr").forEach((tr) => {
          const name = (tr.cells[0].textContent || "").toLowerCase();
          tr.style.display = name.indexOf(q) !== -1 ? "" : "none";
        });
      });
    }

    qsa(container, "[data-bulk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-bulk");
        qsa(tbody, `input[type=radio][value=${v}]`).forEach(
          (r) => (r.checked = true)
        );
      });
    });

    const saveBtn = qs(container, ".rights-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        setMsg(msg, "", "");
        const rights = [];
        qsa(tbody, "tr").forEach((tr) => {
          const moduleId = Number(tr.getAttribute("data-module-id"));
          const accessId = tr.getAttribute("data-access-id");
          const checked = qs(tr, "input[type=radio]:checked");
          if (!checked) return;
          rights.push({
            moduleId,
            accessId: accessId ? Number(accessId) : null,
            drept: checked.value,
          });
        });
        try {
          const resp = await api.post(`/admin/user/${userId}/rights`, {
            rights,
          });
          if (!resp.success) throw new Error(resp.error || "Eroare salvare.");
          setMsg(msg, "Drepturi salvate.", "success");
        } catch (e) {
          setMsg(msg, e.message || "Eroare la salvarea drepturilor.", "error");
        }
      });
    }
  }

  // --- User Cards & Actions ---
  function renderUserCard(user, meta) {
    const div = document.createElement("div");
    div.className = "admin-user-card";
    
    let lastLogin = "N/A";
    if (user.lastLogin) {
      try {
        const d = new Date(user.lastLogin);
        if (!isNaN(d.getTime())) {
          lastLogin = d.toLocaleString('ro-RO', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
          });
        } else {
            lastLogin = user.lastLogin; 
        }
      } catch(e) { lastLogin = user.lastLogin; }
    }

    div.innerHTML = `
      <h3 class="admin-user-title">
        ${user.username} <span style="font-weight:400; color:#64748b; font-size:0.9em;">(ID: ${user.id})</span>
      </h3>
      
      <div class="admin-grid-2">
        <div class="f">
           <label>Ultima autentificare</label>
           <input type="text" value="${lastLogin}" readonly style="background:#f8fafc; color:#64748b;">
        </div>

        <div class="f">
          <label>Username (Login)</label>
          <input type="text" name="username" value="${user.username}">
        </div>

        <div class="f">
          <label>Resetare Parolă</label>
          <input type="text" name="password" value="" placeholder="(Lasă gol pt. a păstra)">
        </div>

        <div class="f">
          <label>Rol Acces</label>
          <select name="roleId"></select>
        </div>

        <div class="f">
          <label>Penitenciar</label>
          <select name="penitenciarId"></select>
        </div>
      </div>

      <div class="admin-card-actions">
        <button type="button" class="btn-primary btn-save">Salvează schimbări</button>
        <button type="button" class="btn-danger btn-deactivate">Dezactivează utilizator</button>
      </div>
      
      <div class="admin-msg user-msg"></div>
    `;

    const roleSel = qs(div, "select[name=roleId]");
    const penSel = qs(div, "select[name=penitenciarId]");
    
    // Add placeholders to handle null values correctly
    fillSelect(roleSel, meta.roles, "-- Selectează --");
    fillSelect(penSel, meta.penitenciars, "-- Selectează --");
    
    // Set value or empty string for null
    if (user.roleId !== null && user.roleId !== undefined) {
        roleSel.value = String(user.roleId);
    } else {
        roleSel.value = "";
    }

    if (user.penitenciarId !== null && user.penitenciarId !== undefined) {
        penSel.value = String(user.penitenciarId);
    } else {
        penSel.value = "";
    }

    const msg = qs(div, ".user-msg");
    
    const btnSave = qs(div, ".btn-save");
    btnSave.addEventListener("click", async () => {
      setMsg(msg, "Se salvează...", "");
      
      const rVal = roleSel.value;
      const pVal = penSel.value;

      const payload = {
        username: qs(div, "input[name=username]").value.trim(),
        password: qs(div, "input[name=password]").value.trim(),
        // Convert to Number, default to 0 for constraints
        roleId: rVal === "" ? 0 : Number(rVal),
        penitenciarId: pVal === "" ? 0 : Number(pVal),
      };

      try {
        const resp = await api.post(`/admin/user/${user.id}/update`, payload);
        if (!resp.success) throw new Error(resp.error || "Eroare actualizare.");
        setMsg(msg, "Salvat cu succes.", "success");
        qs(div, "input[name=password]").value = "";
      } catch (e) {
        setMsg(msg, e.message, "error");
      }
    });

    const btnDeact = qs(div, ".btn-deactivate");
    btnDeact.addEventListener("click", async () => {
      if (!confirm("Sigur dezactivați acest utilizator?")) return;
      try {
        const resp = await api.post(`/admin/user/${user.id}/deactivate`, {});
        if (!resp.success) throw new Error(resp.error || "Eroare dezactivare.");
        setMsg(msg, "Utilizator dezactivat.", "success");
        div.style.opacity = "0.5";
        div.style.pointerEvents = "none";
      } catch (e) {
        setMsg(msg, e.message, "error");
      }
    });

    return div;
  }

  // --- Announcements (Simplified: Only One allowed) ---
  async function initAnnouncements(root) {
    const listEl = qs(root, "#adminAnnList");
    const form = qs(root, "#adminAnnForm");
    const msg = qs(root, "#adminAnnMsg");

    async function refresh() {
      listEl.textContent = "Se încarcă...";
      try {
        const data = await api.get("/admin/ann");
        if (!data.success) throw new Error(data.error || "Eroare anunțuri.");
        const items = data.items || [];
        
        listEl.innerHTML = "";
        
        if (!items.length) {
          listEl.innerHTML = '<div style="padding:10px; color:#6b7280; font-style:italic;">Nu există niciun anunț activ.</div>';
          return;
        }

        // Show only the latest one
        const latest = items[0]; // Assuming order DESC from backend
        const row = document.createElement("div");
        row.className = "ann-item";
        row.style.background = "#fff";
        row.innerHTML = `
            <div style="flex:1;">
                <strong style="display:block; font-size:0.75rem; color:#2563eb; text-transform:uppercase; margin-bottom:4px;">Anunț Activ</strong>
                <span class="ann-text" style="font-size:1rem;">${latest.message}</span>
            </div>
            <button type="button" class="btn-danger btn-small">Șterge</button>
        `;
        
        const btn = qs(row, "button");
        btn.addEventListener("click", async () => {
            if (!confirm(`Ștergi anunțul?`)) return;
            try {
              // Delete specific ID or all - safer to delete all if we enforce single
              const resp = await api.del(`/admin/ann`); 
              if (!resp.success) throw new Error(resp.error || "Eroare ștergere.");
              refresh();
            } catch (e) {
              setMsg(msg, e.message || "Eroare ștergere.", "error");
            }
        });
        listEl.appendChild(row);

      } catch (e) {
        listEl.textContent = e.message || "Eroare anunțuri.";
      }
    }

    if (form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        setMsg(msg, "", "");
        const text = qs(form, "textarea[name=message]").value.trim();
        if (!text) {
          setMsg(msg, "Textul este gol.", "error");
          return;
        }
        try {
          // Enforce Singleton: Delete all existing before adding new
          await api.del("/admin/ann");

          const resp = await api.post("/admin/ann", { message: text });
          if (!resp.success) throw new Error(resp.error || "Eroare salvare.");
          
          qs(form, "textarea[name=message]").value = "";
          setMsg(msg, "Anunț publicat.", "success");
          refresh();
        } catch (e) {
          setMsg(msg, e.message || "Eroare salvare.", "error");
        }
      });
    }

    refresh();
  }

  // --- Statistics Panel ---
  async function initStatsPanel(root) {
    const activeVal = qs(root, "#statActive");
    const deactVal = qs(root, "#statDeact");
    const inactVal = qs(root, "#statInact");
    const canvas = qs(root, "#usersByPrisonChart");
    const container = qs(root, "[data-admin-panel=stats]");

    if (!container || !canvas) return;

    // Load Data and ChartJS
    try {
      await ensureChartJS();
      const res = await api.get("/admin/stats/users");
      if (!res.success) throw new Error(res.error || "Eroare date statistici");

      // Set Counters
      if(activeVal) activeVal.textContent = res.counters.active;
      if(deactVal) deactVal.textContent = res.counters.deactivated;
      if(inactVal) inactVal.textContent = res.counters.inactive;

      // --- FIX: Check for and destroy existing chart instance ---
      // Chart.js 4.x attaches the instance to the canvas using Chart.getChart(canvas)
      if (window.Chart) {
          const existingChart = window.Chart.getChart(canvas);
          if (existingChart) {
            existingChart.destroy();
          }
      }

      // Render Chart
      const dist = res.distribution || [];
      const labels = dist.map(d => d.label);
      const data = dist.map(d => d.count);

      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Număr Useri',
            data: data,
            backgroundColor: '#2563eb',
            barPercentage: 0.7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: labels.length > 8 ? 'y' : 'x', // Horizontal if many items
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });

    } catch (e) {
      console.error("Stats Error:", e);
      // Don't append error if one already exists to avoid clutter
      if(!container.querySelector('.admin-msg.error')) {
          container.innerHTML += `<div class="admin-msg error">Eroare încărcare statistici: ${e.message}</div>`;
      }
    }
  }

  // --- Panels Initialization ---
  async function initCreatePanel(root, meta) {
    const form = qs(root, "#adminCreateForm");
    const msg = qs(root, "#adminCreateMsg");
    if (!form) return;

    fillSelect(qs(form, "select[name=roleId]"), meta.roles, "-- Rol --");
    fillSelect(
      qs(form, "select[name=penitenciarId]"),
      meta.penitenciars,
      "-- Penitenciar --"
    );

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg(msg, "", "");
      const fd = new FormData(form);
      
      const rVal = fd.get("roleId");
      const pVal = fd.get("penitenciarId");

      const payload = {
        username: fd.get("username"),
        password: fd.get("password"),
        autoPassword: fd.get("autoPassword") === "on",
        // Ensure values are Numbers, defaulting to 0
        roleId: rVal === "" ? 0 : Number(rVal),
        penitenciarId: pVal === "" ? 0 : Number(pVal),
      };
      try {
        const data = await api.post("/admin/user/create", payload);
        if (!data.success) throw new Error(data.error || "Eroare creare.");
        let txt = `Utilizator creat: ${data.username}`;
        if (data.autoPassword) txt += ` | Parolă: ${data.autoPassword}`;
        setMsg(msg, txt, "success");
        form.reset();
      } catch (e) {
        setMsg(msg, e.message || "Eroare creare.", "error");
      }
    });
  }

  async function initBulkPanel(root, meta) {
    const form = qs(root, "#adminBulkForm");
    const msg = qs(root, "#adminBulkMsg");
    const report = qs(root, "#adminBulkReport");
    if (!form) return;

    fillSelect(qs(form, "select[name=roleId]"), meta.roles, "-- Rol --");
    fillSelect(
      qs(form, "select[name=penitenciarId]"),
      meta.penitenciars,
      "-- Penitenciar --"
    );

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg(msg, "", "");
      report.textContent = "";
      const fd = new FormData(form);
      
      const rVal = fd.get("roleId");
      const pVal = fd.get("penitenciarId");

      const payload = {
        usernamesText: fd.get("usernamesText"),
        // Ensure values are Numbers, defaulting to 0
        roleId: rVal === "" ? 0 : Number(rVal),
        penitenciarId: pVal === "" ? 0 : Number(pVal),
        autoPassword: fd.get("autoPassword") === "on",
        samePassword: fd.get("samePassword"),
      };
      try {
        const data = await api.post("/admin/user/bulk", payload);
        if (!data.success) throw new Error(data.error || "Eroare bulk.");
        setMsg(
          msg,
          `Adăugate: ${data.okCount || 0}, Eșecuri: ${data.failCount || 0}`,
          "success"
        );
        report.textContent = (data.report || []).join("\n");
      } catch (e) {
        setMsg(msg, e.message || "Eroare bulk.", "error");
      }
    });
  }

  async function initSearchPanel(root, meta) {
    const form = qs(root, "#adminSearchForm");
    const results = qs(root, "#adminSearchResults");
    if (!form || !results) return;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const q = qs(form, "input[name=q]").value.trim();
      if (!q) {
        results.textContent = "Introduceți un termen de căutare.";
        return;
      }
      results.textContent = "Se caută...";
      try {
        const data = await api.get(
          `/admin/user/search?q=${encodeURIComponent(q)}`
        );
        if (!data.success) throw new Error(data.error || "Eroare căutare.");
        const users = data.users || [];
        if (!users.length) {
          results.textContent = "Nu a fost găsit niciun utilizator.";
          return;
        }
        results.innerHTML = "";
        users.forEach((u) => results.appendChild(renderUserCard(u, meta)));
      } catch (e) {
        results.textContent = e.message || "Eroare căutare.";
      }
    });
  }

  function setupTabs(root) {
    const buttons = qsa(root, "[data-admin-tab]");
    const panels = qsa(root, "[data-admin-panel]");
    function show(name) {
      panels.forEach((p) => {
        p.style.display =
          p.getAttribute("data-admin-panel") === name ? "" : "none";
      });
      buttons.forEach((b) => {
        b.className = "admin-tab-btn"; 
        if (b.getAttribute("data-admin-tab") === name) {
          b.classList.add("active");
        }
      });
      // Lazy load stats when tab is clicked
      if (name === "stats") {
        const container = qs(root, "[data-admin-panel=stats]");
        // Simple check to prevent double init if we wanted, 
        // but re-init refreshes data which is good.
        initStatsPanel(root);
      }
    }
    buttons.forEach((b) =>
      b.addEventListener("click", () => show(b.getAttribute("data-admin-tab")))
    );
    show("create"); // Default tab
  }

  // --- Main Render Function ---
  async function renderAdminPage(mainEl) {
    if (!mainEl) return;
    mainEl.innerHTML = `<div class="admin-msg">Se încarcă administrarea...</div>`;
    try {
      const meta = await loadMeta();

      mainEl.innerHTML = `
        <div class="admin-page">
          <header class="admin-header-main">
            <h1 class="admin-title">Administrare</h1>
            <p class="app-subtitle">Gestionează utilizatori, drepturi și anunțuri.</p>
          </header>

          <div class="admin-tabs">
            <button type="button" class="admin-tab-btn" data-admin-tab="create">Adaugă User</button>
            <button type="button" class="admin-tab-btn" data-admin-tab="bulk">Import Masiv</button>
            <button type="button" class="admin-tab-btn" data-admin-tab="search">Caută & Editează</button>
            <button type="button" class="admin-tab-btn" data-admin-tab="ann">Anunțuri</button>
            <button type="button" class="admin-tab-btn" data-admin-tab="stats">Statistici</button>
          </div>

          <!-- CREATE PANEL -->
          <section class="admin-panel" data-admin-panel="create">
            <h2>👤 Adaugă utilizator nou</h2>
            <form id="adminCreateForm" class="admin-form">
              <div class="admin-grid-2">
                <div class="f">
                  <label>Username (lowercase)</label>
                  <input type="text" name="username" autocomplete="off" placeholder="ex: popescu.ion">
                </div>
                <div class="f">
                  <label>Parolă</label>
                  <input type="text" name="password" autocomplete="off" placeholder="Parolă inițială">
                  <label style="margin-top:6px; font-weight:400; font-size:0.8rem; color:#666;">
                    <input type="checkbox" name="autoPassword"> Generează automat
                  </label>
                </div>
                <div class="f">
                  <label>Rol</label>
                  <select name="roleId"></select>
                </div>
                <div class="f">
                  <label>Penitenciar</label>
                  <select name="penitenciarId"></select>
                </div>
              </div>
              <div class="form-buttons right">
                <button type="submit" class="btn-primary">Creează utilizator</button>
              </div>
              <div id="adminCreateMsg" class="admin-msg"></div>
            </form>
          </section>

          <!-- BULK PANEL -->
          <section class="admin-panel" data-admin-panel="bulk">
            <h2>📥 Adaugă utilizatori în masă</h2>
            <p style="font-size:0.85rem; color:#6b7280; margin-bottom:12px;">
              Introduceți o listă de utilizatori (unul pe linie sau separați prin virgulă).
            </p>
            <form id="adminBulkForm" class="admin-form">
              <textarea name="usernamesText" rows="6" placeholder="popescu.ion&#10;vasile.george&#10;..." style="font-family:monospace;"></textarea>

              <div class="admin-grid-2">
                <div class="f">
                  <label>Rol (pentru toți)</label>
                  <select name="roleId"></select>
                </div>
                <div class="f">
                  <label>Penitenciar (pentru toți)</label>
                  <select name="penitenciarId"></select>
                </div>
              </div>

              <div style="background:#f3f4f6; padding:10px; border-radius:8px;">
                <label style="margin-bottom:8px; display:block;">Setări Parolă</label>
                <div class="admin-grid-2">
                  <label style="font-weight:400;">
                    <input type="checkbox" name="autoPassword"> Generare aleatorie unică
                  </label>
                  <div>
                    <input type="text" name="samePassword" placeholder="Sau o parolă comună..." style="margin-top:0;">
                  </div>
                </div>
              </div>

              <div class="form-buttons right">
                <button type="submit" class="btn-primary">Procesează lista</button>
              </div>
              <pre id="adminBulkReport" class="admin-report"></pre>
              <div id="adminBulkMsg" class="admin-msg"></div>
            </form>
          </section>

          <!-- SEARCH PANEL -->
          <section class="admin-panel" data-admin-panel="search">
            <h2>🔎 Caută și gestionează</h2>
            <form id="adminSearchForm" class="admin-form">
               <div style="display:flex; gap:10px;">
                 <div style="flex:1;">
                    <input type="text" name="q" autocomplete="off" placeholder="Caută după nume sau ID..." style="width:100%;">
                 </div>
                 <button type="submit" class="btn-primary">Caută</button>
               </div>
            </form>
            <div id="adminSearchResults" class="admin-results"></div>
          </section>

          <!-- ANNOUNCEMENTS PANEL -->
          <section class="admin-panel" data-admin-panel="ann">
            <div style="display:flex; justify-content:space-between; align-items:center;">
               <h2>📢 Anunțuri sistem</h2>
            </div>
            <form id="adminAnnForm" class="admin-form" style="margin-bottom:20px;">
              <label>Setează mesaj nou (înlocuiește orice anunț existent)</label>
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <textarea name="message" rows="2" style="flex:1;" placeholder="Scrie un mesaj pentru toți utilizatorii..."></textarea>
                <button type="submit" class="btn-primary" style="margin-top:4px;">Publică</button>
              </div>
            </form>
            <div id="adminAnnMsg" class="admin-msg"></div>
            <div id="adminAnnList" class="ann-list" style="margin-top:20px;"></div>
          </section>

          <!-- STATS PANEL (New) -->
          <section class="admin-panel" data-admin-panel="stats">
             <h2>📊 Statistici Utilizatori</h2>
             
             <!-- KPI Cards -->
             <div class="admin-grid-3" style="margin-bottom: 24px;">
               <div class="stat-card">
                 <div class="stat-label">Useri Activi (< 3 luni)</div>
                 <div class="stat-val" id="statActive">...</div>
               </div>
               <div class="stat-card">
                 <div class="stat-label">Dezactivați ("INACTIV")</div>
                 <div class="stat-val" id="statDeact">...</div>
               </div>
               <div class="stat-card">
                 <div class="stat-label">Inactivi (> 3 luni)</div>
                 <div class="stat-val" id="statInact">...</div>
               </div>
             </div>

             <!-- Chart Container -->
             <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
                <h3 style="margin-top:0; font-size:1rem; color:#475569; margin-bottom:12px;">Repartiție useri după penitenciar</h3>
                <div style="height: 400px; position: relative;">
                  <canvas id="usersByPrisonChart"></canvas>
                </div>
             </div>
          </section>

        </div>
        
        <!-- Extra Style for Stats -->
        <style>
          .admin-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .stat-card { background: #fff; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; }
          .stat-label { font-size: 0.85rem; color: #64748b; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
          .stat-val { font-size: 1.8rem; font-weight: 700; color: #2563eb; }
          @media(max-width: 700px) { .admin-grid-3 { grid-template-columns: 1fr; } }
        </style>
      `;

      const root = mainEl.firstElementChild;
      setupTabs(root);
      await initCreatePanel(root, meta);
      await initBulkPanel(root, meta);
      await initSearchPanel(root, meta);
      await initAnnouncements(root);
      // initStatsPanel is called via tab click
    } catch (err) {
      mainEl.innerHTML = `<div class="admin-msg error">${
        err.message || "Eroare la încărcare."
      }</div>`;
    }
  }

  window.prisonModules = window.prisonModules || {};
  window.prisonModules.admin = {
    init({ userId, container }) {
      renderAdminPage(container);
    },
  };
})();