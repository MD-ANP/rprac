// public/js/cautare.js
(function () {
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildLayout(container) {
    container.innerHTML = `
      <h1 class="app-title">Modul: Căutare</h1>
      <p class="app-subtitle">
        Căutare deținuți după nume, IDNP, dată naștere sau număr de dosar.
        Introduceți cel puțin un criteriu.
      </p>

      <section class="search-card">
        <h2 class="section-title">Criterii de căutare</h2>
        <form class="search-form" data-role="search">
          <div class="fields-grid">
            <div class="f">
              <label for="searchSurname">Nume</label>
              <input id="searchSurname" name="surname" type="text" autocomplete="off" placeholder="EX: POPESCU" />
            </div>
            <div class="f">
              <label for="searchName">Prenume</label>
              <input id="searchName" name="name" type="text" autocomplete="off" placeholder="EX: ION" />
            </div>
            <div class="f">
              <label for="searchSecName">Patronimic</label>
              <input id="searchSecName" name="secName" type="text" autocomplete="off" placeholder="EX: VASILE" />
            </div>
            <div class="f">
              <label for="searchIdnp">IDNP</label>
              <input id="searchIdnp" name="idnp" type="text" autocomplete="off" placeholder="EX: 1234567890123" />
            </div>
            <div class="f">
              <label for="searchBirth">Data nașterii</label>
              <input id="searchBirth" name="birth" type="text" autocomplete="off" placeholder="ZZ.LL.AAAA" />
            </div>
            <div class="f">
              <label for="searchId">Nr. Dosar</label>
              <input id="searchId" name="id" type="text" autocomplete="off" placeholder="EX: 12345" />
            </div>
          </div>

          <div class="search-actions">
            <button type="submit" class="btn-primary" data-role="submit">Caută</button>
          </div>
          <p class="form-message" id="searchMessage"></p>
        </form>
      </section>

      <section class="search-results" id="searchResultsSection" style="display:none;">
        <h2 class="section-title">Rezultate</h2>
        <p class="search-results-info" id="searchResultsInfo"></p>
        <div class="search-grid" id="searchGrid"></div>
      </section>
    `;
  }

  function setMessage(msgEl, text, type) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.className = "form-message" + (type ? " " + type : "");
  }

  function renderResults(sectionEl, infoEl, gridEl, data) {
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      sectionEl.style.display = "block";
      infoEl.textContent = "Nu a fost găsită nicio coincidență.";
      gridEl.innerHTML = "";
      return;
    }

    const maxRows = data.maxRows || results.length;
    const count = data.count || results.length;

    infoEl.textContent =
      count >= maxRows
        ? `Primele ${count} rezultate (limitat la ${maxRows}).`
        : `Rezultate găsite: ${count}.`;

    const cardsHtml = results
      .map((item) => {
        return `
          <article class="search-result-card">
            <div class="result-header">
              <span class="badge badge-status">${escapeHtml(
                (item.statut || "").toUpperCase()
              )}</span>
            </div>
            <div class="result-body">
              <div class="row"><span class="k">IDNP</span><span class="v">${escapeHtml(
                item.idnp
              )}</span></div>
              <div class="row"><span class="k">Nume</span><span class="v">${escapeHtml(
                item.surname
              )}</span></div>
              <div class="row"><span class="k">Prenume</span><span class="v">${escapeHtml(
                item.name
              )}</span></div>
              <div class="row"><span class="k">Patronimic</span><span class="v">${escapeHtml(
                item.secName
              )}</span></div>
              <div class="row"><span class="k">Naștere</span><span class="v">${escapeHtml(
                item.birth
              )}</span></div>
              <div class="row"><span class="k">Mișcare</span><span class="v">${escapeHtml(
                item.miscareText
              )}</span></div>
            </div>
            <div class="result-footer">
              <button type="button" class="btn-ghost btn-small" disabled title="Detalii încă nu sunt implementate">
                Detalii
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    gridEl.innerHTML = cardsHtml;
    sectionEl.style.display = "block";
  }

  async function handleSubmit(ev, container) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const msgEl = form.querySelector("#searchMessage");
    const submitBtn = form.querySelector('[data-role="submit"]');
    const sectionEl = container.querySelector("#searchResultsSection");
    const infoEl = container.querySelector("#searchResultsInfo");
    const gridEl = container.querySelector("#searchGrid");

    setMessage(msgEl, "", "");
    if (sectionEl) sectionEl.style.display = "none";
    if (gridEl) gridEl.innerHTML = "";

    const formData = new FormData(form);
    const payload = {
      surname: (formData.get("surname") || "").toString(),
      name: (formData.get("name") || "").toString(),
      secName: (formData.get("secName") || "").toString(),
      idnp: (formData.get("idnp") || "").toString(),
      birth: (formData.get("birth") || "").toString(),
      id: (formData.get("id") || "").toString()
    };

    const hasAny =
      payload.surname.trim() ||
      payload.name.trim() ||
      payload.secName.trim() ||
      payload.idnp.trim() ||
      payload.birth.trim() ||
      payload.id.trim();

    if (!hasAny) {
      setMessage(
        msgEl,
        "Introduceți cel puțin un criteriu de căutare.",
        "error"
      );
      return;
    }

    submitBtn.disabled = true;
    setMessage(msgEl, "Se caută, vă rugăm așteptați...", "");

    try {
      const data = await window.prisonApi.post(
        "/search/detinuti",
        payload
      );

      if (!data.success) {
        throw new Error(data.error || "Căutarea a eșuat.");
      }

      renderResults(sectionEl, infoEl, gridEl, data);
      setMessage(msgEl, "", "");
    } catch (err) {
      console.error("Eroare la căutare:", err);
      setMessage(
        msgEl,
        err.message || "Eroare la comunicarea cu serverul.",
        "error"
      );
    } finally {
      submitBtn.disabled = false;
    }
  }

  window.prisonModules = window.prisonModules || {};
  window.prisonModules.cautare = {
    init({ userId, container }) {
      buildLayout(container);

      const form = container.querySelector('form[data-role="search"]');
      if (form) {
        form.addEventListener("submit", (ev) => handleSubmit(ev, container));
      }
    }
  };
})();
