// public/js/profil.js
(function () {
  function formatDate(value) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return String(value);
    }
    return d.toLocaleString("ro-RO");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function loadProfile(userId) {
    const data = await window.prisonApi.get(
      `/profile?userId=${encodeURIComponent(userId)}`
    );
    if (!data.success) {
      throw new Error(data.error || "Nu s-a putut încărca profilul.");
    }
    return data;
  }

  function renderProfile(container, profileData) {
    const { user, logs, permissions } = profileData;

    const logsRows =
      (logs || [])
        .map(
          (log) => `
        <tr>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(formatDate(log.date))}</td>
          <td>${escapeHtml(log.detail)}</td>
        </tr>
      `
        )
        .join("") ||
      `<tr><td colspan="3" class="table-empty">Nu există activitate înregistrată.</td></tr>`;

    const permRows =
      (permissions || [])
        .map((p) => {
          let badgeClass = "badge-none";
          if (p.drept === "W") badgeClass = "badge-write";
          else if (p.drept === "R") badgeClass = "badge-read";

          return `
        <tr>
          <td>${escapeHtml(p.moduleName)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(
            p.permissionLabel
          )}</span></td>
        </tr>
      `;
        })
        .join("") ||
      `<tr><td colspan="2" class="table-empty">Nu există module definite.</td></tr>`;

    container.innerHTML = `
      <h1 class="app-title">Profil utilizator</h1>
      <p class="app-subtitle">
        Informații și drepturi pentru utilizatorul <strong>${escapeHtml(
          user.username
        )}</strong>.
      </p>

      <div class="profile-sections">
        <section class="profile-card">
          <h2 class="section-title">Detalii utilizator</h2>
          <div class="profile-details">
            <div class="detail-row">
              <span class="detail-label">ID utilizator</span>
              <span class="detail-value">${user.id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rol (ID_ROLE)</span>
              <span class="detail-value">${
                user.id_role !== null && user.id_role !== undefined
                  ? user.id_role
                  : "—"
              }</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">ID penitenciar</span>
              <span class="detail-value">${
                user.id_penitentiary !== null &&
                user.id_penitentiary !== undefined
                  ? user.id_penitentiary
                  : "—"
              }</span>
            </div>
          </div>
        </section>

        <section class="profile-card">
          <h2 class="section-title">Drepturi pe module</h2>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Modul</th>
                  <th>Drept</th>
                </tr>
              </thead>
              <tbody>
                ${permRows}
              </tbody>
            </table>
          </div>
        </section>

        <section class="profile-card">
          <h2 class="section-title">Activitate recentă (ultimele 10 înregistrări)</h2>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Acțiune</th>
                  <th>Dată</th>
                  <th>Detalii</th>
                </tr>
              </thead>
              <tbody>
                ${logsRows}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // Register module
  window.prisonModules = window.prisonModules || {};
  window.prisonModules.profil = {
    async init({ userId, container }) {
      try {
        const data = await loadProfile(userId);
        renderProfile(container, data);
      } catch (err) {
        console.error("Eroare la profil:", err);
        container.innerHTML = `
          <h1 class="app-title">Eroare</h1>
          <p class="app-subtitle">${escapeHtml(
            err.message || "Nu s-a putut încărca profilul utilizatorului."
          )}</p>
        `;
      }
    }
  };
})();
