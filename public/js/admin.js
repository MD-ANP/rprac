// public/js/admin.js
(function () {
  const api = window.prisonApi;

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
    items.forEach(it => {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.name;
      sel.appendChild(o);
    });
  }

  async function loadMeta() {
    const data = await api.get("/admin/meta");
    if (!data.success) throw new Error(data.error || "Eroare meta.");
    return data;
  }

  // ----- RIGHTS -----
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

    const rows = mods.map(m => {
      const id = m.moduleId;
      const drept = (m.drept || "N").toUpperCase();
      return `
        <tr data-module-id="${id}" data-access-id="${m.accessId || ""}">
          <td>${m.moduleName}</td>
          <td class="c"><input type="radio" name="mod-${id}" value="N"${drept === "N" ? " checked" : ""}></td>
          <td class="c"><input type="radio" name="mod-${id}" value="R"${drept === "R" ? " checked" : ""}></td>
          <td class="c"><input type="radio" name="mod-${id}" value="W"${drept === "W" ? " checked" : ""}></td>
        </tr>
      `;
    }).join("");

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
        qsa(tbody, "tr").forEach(tr => {
          const name = (tr.cells[0].textContent || "").toLowerCase();
          tr.style.display = name.indexOf(q) !== -1 ? "" : "none";
        });
      });
    }

    qsa(container, "[data-bulk]").forEach(btn => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-bulk");
        qsa(tbody, `input[type=radio][value=${v}]`).forEach(r => r.checked = true);
      });
    });

    const saveBtn = qs(container, ".rights-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        setMsg(msg, "", "");
        const rights = [];
        qsa(tbody, "tr").forEach(tr => {
          const moduleId = Number(tr.getAttribute("data-module-id"));
          const accessId = tr.getAttribute("data-access-id");
          const checked = qs(tr, "input[type=radio]:checked");
          if (!checked) return;
          rights.push({
            moduleId,
            accessId: accessId ? Number(accessId) : null,
            drept: checked.value
          });
        });
        try {
          const resp = await api.post(`/admin/user/${userId}/rights`, { rights });
          if (!resp.success) throw new Error(resp.error || "Eroare salvare.");
          setMsg(msg, "Drepturi salvate.", "success");
        } catch (e) {
          setMsg(msg, e.message || "Eroare la salvarea drepturilor.", "error");
        }
      });
    }
  }

  // ----- USER SEARCH RESULTS -----
  function renderUserCard(user, meta) {
    const div = document.createElement("div");
    div.className = "admin-user-card";
    const lastLogin = user.lastLogin || "N/A";

    div.innerHTML = `
      <h3 class="admin-user-title">Utilizator: ${user.username} (ID: ${user.id})</h3>
      <div class="admin-grid-2">
        <div class="f">
          <label>ID</label>
          <input type="text" value="${user.id}" readonly>
        </div>
        <div class="f">
          <label>Ultima autentificare</label>
          <input type="text" value="${lastLogin}" readonly>
        </div>
        <div class="f">
          <label>Username (lowercase)</label>
          <input type="text" name="username" value="${user.username}">
        </div>
        <div class="f">
          <label>Parolă</label>
          <input type="text" name="password" value="${user.password || ""}">
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
      <div class="form-buttons">
        <button type="button" class="btn-primary btn-save">Salvează schimbări</button>
        <button type="button" class="btn-danger btn-deactivate">Dezactivează utilizator</button>
      </div>
      <div class="admin-msg user-msg"></div>
      <div class="admin-rights"></div>
    `;

    const roleSel = qs(div, "select[name=roleId]");
    const penSel = qs(div, "select[name=penitenciarId]");
    fillSelect(roleSel, meta.roles, null);
    fillSelect(penSel, meta.penitenciars, null);
    if (user.roleId) roleSel.value = String(user.roleId);
    if (user.penitenciarId) penSel.value = String(user.penitenciarId);

    const msg = qs(div, ".user-msg");
    const rightsContainer = qs(div, ".admin-rights");

    const btnSave = qs(div, ".btn-save");
    btnSave.addEventListener("click", async () => {
      setMsg(msg, "", "");
      const payload = {
        username: qs(div, "input[name=username]").value.trim(),
        password: qs(div, "input[name=password]").value.trim(),
        roleId: roleSel.value,
        penitenciarId: penSel.value
      };
      try {
        const resp = await api.post(`/admin/user/${user.id}/update`, payload);
        if (!resp.success) throw new Error(resp.error || "Eroare la actualizare.");
        setMsg(msg, "Utilizator actualizat.", "success");
      } catch (e) {
        setMsg(msg, e.message || "Eroare la actualizare.", "error");
      }
    });

    const btnDeact = qs(div, ".btn-deactivate");
    btnDeact.addEventListener("click", async () => {
      if (!confirm("Sigur dezactivați acest utilizator?")) return;
      setMsg(msg, "", "");
      try {
        const resp = await api.post(`/admin/user/${user.id}/deactivate`, {});
        if (!resp.success) throw new Error(resp.error || "Eroare la dezactivare.");
        setMsg(msg, "Utilizator dezactivat.", "success");
      } catch (e) {
        setMsg(msg, e.message || "Eroare la dezactivare.", "error");
      }
    });

    // load rights lazily
    loadRights(rightsContainer, user.id).catch(err => {
      rightsContainer.textContent = err.message || "Eroare la drepturi.";
    });

    return div;
  }

  // ----- ANNOUNCEMENTS -----
  async function initAnnouncements(root) {
    const listEl = qs(root, "#adminAnnList");
    const form = qs(root, "#adminAnnForm");
    const msg = qs(root, "#adminAnnMsg");
    const delAll = qs(root, "#adminAnnDelAll");

    async function refresh() {
      listEl.textContent = "Se încarcă...";
      try {
        const data = await api.get("/admin/ann");
        if (!data.success) throw new Error(data.error || "Eroare anunțuri.");
        const items = data.items || [];
        if (!items.length) {
          listEl.textContent = "Niciun anunț.";
          return;
        }
        listEl.innerHTML = "";
        items.forEach(it => {
          const row = document.createElement("div");
          row.className = "ann-item";
          row.innerHTML = `
            <span class="ann-id">#${it.id}</span>
            <span class="ann-text">${it.message}</span>
            <button type="button" data-id="${it.id}">Șterge</button>
          `;
          const btn = qs(row, "button");
          btn.addEventListener("click", async () => {
            if (!confirm(`Ștergi anunțul #${it.id}?`)) return;
            try {
              const resp = await api.del(`/admin/ann/${it.id}`);
              if (!resp.success) throw new Error(resp.error || "Eroare ștergere.");
              refresh();
            } catch (e) {
              setMsg(msg, e.message || "Eroare ștergere.", "error");
            }
          });
          listEl.appendChild(row);
        });
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

    if (delAll) {
      delAll.addEventListener("click", async () => {
        if (!confirm("Ștergi TOATE anunțurile?")) return;
        setMsg(msg, "", "");
        try {
          const resp = await api.del("/admin/ann");
          if (!resp.success) throw new Error(resp.error || "Eroare ștergere.");
          setMsg(msg, "Toate anunțurile au fost șterse.", "success");
          refresh();
        } catch (e) {
          setMsg(msg, e.message || "Eroare ștergere.", "error");
        }
      });
    }

    refresh();
  }

  // ----- BULK / CREATE / SEARCH INIT -----
  async function initCreatePanel(root, meta) {
    const form = qs(root, "#adminCreateForm");
    const msg = qs(root, "#adminCreateMsg");
    if (!form) return;

    fillSelect(qs(form, "select[name=roleId]"), meta.roles, "-- Rol --");
    fillSelect(qs(form, "select[name=penitenciarId]"), meta.penitenciars, "-- Penitenciar --");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg(msg, "", "");
      const fd = new FormData(form);
      const payload = {
        username: fd.get("username"),
        password: fd.get("password"),
        autoPassword: fd.get("autoPassword") === "on",
        roleId: fd.get("roleId"),
        penitenciarId: fd.get("penitenciarId")
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
    fillSelect(qs(form, "select[name=penitenciarId]"), meta.penitenciars, "-- Penitenciar --");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg(msg, "", "");
      report.textContent = "";
      const fd = new FormData(form);
      const payload = {
        usernamesText: fd.get("usernamesText"),
        roleId: fd.get("roleId"),
        penitenciarId: fd.get("penitenciarId"),
        autoPassword: fd.get("autoPassword") === "on",
        samePassword: fd.get("samePassword")
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
        const data = await api.get(`/admin/user/search?q=${encodeURIComponent(q)}`);
        if (!data.success) throw new Error(data.error || "Eroare căutare.");
        const users = data.users || [];
        if (!users.length) {
          results.textContent = "Nu a fost găsit niciun utilizator.";
          return;
        }
        results.innerHTML = "";
        users.forEach(u => results.appendChild(renderUserCard(u, meta)));
      } catch (e) {
        results.textContent = e.message || "Eroare căutare.";
      }
    });
  }

  function setupTabs(root) {
    const buttons = qsa(root, "[data-admin-tab]");
    const panels = qsa(root, "[data-admin-panel]");
    function show(name) {
      panels.forEach(p => {
        p.style.display = p.getAttribute("data-admin-panel") === name ? "" : "none";
      });
      buttons.forEach(b => {
        if (b.getAttribute("data-admin-tab") === name) {
          b.classList.add("btn-primary");
          b.classList.remove("btn-secondary");
        } else {
          b.classList.remove("btn-primary");
          b.classList.add("btn-secondary");
        }
      });
    }
    buttons.forEach(b => b.addEventListener("click", () => show(b.getAttribute("data-admin-tab"))));
    show("create");
  }

  // ---- main entry ----
  async function renderAdminPage(mainEl) {
    if (!mainEl) return;
    mainEl.innerHTML = `<div class="admin-msg">Se încarcă administrarea...</div>`;
    try {
      const meta = await loadMeta();

      mainEl.innerHTML = `
        <div class="admin-page">
          <h1 class="admin-title">Administrare utilizatori</h1>
          <div class="admin-tabs">
            <button type="button" class="btn-secondary" data-admin-tab="bulk">Adaugă în masă</button>
            <button type="button" class="btn-secondary" data-admin-tab="create">Adaugă user</button>
            <button type="button" class="btn-secondary" data-admin-tab="search">Caută user</button>
            <button type="button" class="btn-secondary" data-admin-tab="ann">Anunț</button>
          </div>

          <section class="admin-panel" data-admin-panel="bulk">
            <h2>📥 Adaugă utilizatori în masă</h2>
            <form id="adminBulkForm" class="admin-form">
              <label>Usernames (virgulă / ; / linii noi)</label>
              <textarea name="usernamesText" rows="5"></textarea>

              <div class="admin-grid-2">
                <div class="f">
                  <label>Rol</label>
                  <select name="roleId"></select>
                </div>
                <div class="f">
                  <label>Penitenciar</label>
                  <select name="penitenciarId"></select>
                </div>
              </div>

              <label>
                <input type="checkbox" name="autoPassword"> Generează parolă pentru fiecare
              </label>
              <label>…sau aceeași parolă pentru toți</label>
              <input type="text" name="samePassword">

              <div class="form-buttons right">
                <button type="submit" class="btn-primary">Creează în masă</button>
              </div>
              <pre id="adminBulkReport" class="admin-report"></pre>
              <div id="adminBulkMsg" class="admin-msg"></div>
            </form>
          </section>

          <section class="admin-panel" data-admin-panel="create">
            <h2>➕ Adaugă utilizator</h2>
            <form id="adminCreateForm" class="admin-form">
              <div class="admin-grid-2">
                <div class="f">
                  <label>Username (lowercase)</label>
                  <input type="text" name="username" autocomplete="off">
                </div>
                <div class="f">
                  <label>Parolă</label>
                  <input type="text" name="password" autocomplete="off">
                  <label>
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

          <section class="admin-panel" data-admin-panel="search">
            <h2>🔎 Caută utilizator</h2>
            <form id="adminSearchForm" class="admin-form admin-form-inline">
              <label>Username (lowercase) sau ID</label>
              <div class="row">
                <input type="text" name="q" autocomplete="off">
                <button type="submit" class="btn-primary">Caută</button>
              </div>
            </form>
            <div id="adminSearchResults" class="admin-results"></div>
          </section>

          <section class="admin-panel" data-admin-panel="ann">
            <h2>📢 Anunțuri</h2>
            <form id="adminAnnForm" class="admin-form">
              <label>Text anunț</label>
              <textarea name="message" rows="3"></textarea>
              <div class="form-buttons right">
                <button type="submit" class="btn-primary">Publică</button>
              </div>
            </form>
            <button type="button" id="adminAnnDelAll" class="btn-danger btn-small">Șterge toate anunțurile</button>
            <div id="adminAnnMsg" class="admin-msg"></div>
            <div id="adminAnnList" class="ann-list"></div>
          </section>
        </div>
      `;

      const root = mainEl.firstElementChild;
      setupTabs(root);
      await initCreatePanel(root, meta);
      await initBulkPanel(root, meta);
      await initSearchPanel(root, meta);
      await initAnnouncements(root);
    } catch (err) {
      mainEl.innerHTML = `<div class="admin-msg error">${err.message || "Eroare la încărcare."}</div>`;
    }
  }

  window.renderAdminPage = renderAdminPage;
})();
