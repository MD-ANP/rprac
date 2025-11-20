// public/js/login.js
(function () {
  const formEl = document.getElementById("loginForm");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const motivationEl = document.getElementById("motivation");
  const messageEl = document.getElementById("loginMessage");
  const loginBtn = document.getElementById("loginBtn");
  const guideBtn = document.getElementById("guideBtn");
  const authCard = document.querySelector(".auth-card");

  function setMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.className = "form-message" + (type ? " " + type : "");
  }

  async function checkHealth() {
    if (!authCard) return;
    try {
      const data = await window.prisonApi.get("/health");

      // Doar dacă serverul spune explicit că DB NU e disponibilă
      if (data && data.dbAvailable === false) {
        authCard.innerHTML = `
          <h1 class="auth-title">Eroare conexiune bază de date</h1>
          <p class="auth-subtitle">
            Pagina web este accesibilă dar conexiunea cu baza de date a eșuat.
            Vă rugăm contactați-ne de urgență la
            <a href="mailto:anp.siarprac@anp.gov.md">anp.siarprac@anp.gov.md</a>.
          </p>
        `;
      }
      // Dacă dbAvailable este true sau null/undefined → nu facem nimic,
      // lăsăm login-ul să funcționeze normal.
    } catch (err) {
      // Nu mai speriem utilizatorul; doar logăm în consolă.
      console.error("Eroare la /api/health:", err);
    }
  }

  async function loadMotives() {
    if (!motivationEl) return;
    try {
      const data = await window.prisonApi.get("/motives");
      if (!data.success || !Array.isArray(data.motives)) {
        throw new Error(data.error || "Nu s-au putut încărca motivele de acces.");
      }

      motivationEl.innerHTML =
        '<option value="">-- Selectați motivul --</option>';
      data.motives.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.text;
        motivationEl.appendChild(opt);
      });
    } catch (err) {
      console.error("Eroare la /api/motives:", err);
      // Lăsăm opțiunea default, utilizatorul nu poate continua fără selectare oricum.
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!formEl) return;
    setMessage("", "");
    if (!usernameEl || !passwordEl || !motivationEl || !loginBtn) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    const motivId = motivationEl.value;

    if (!username || !password || !motivId) {
      setMessage("Completați utilizatorul, parola și motivul de acces.", "error");
      return;
    }

    loginBtn.disabled = true;

    try {
      const payload = {
        username,
        password,
        motivId
      };

      const data = await window.prisonApi.post("/login", payload);
      if (!data.success) {
        throw new Error(data.error || "Autentificare eșuată.");
      }

      try {
        sessionStorage.setItem("prison.userId", String(data.user.id));
        sessionStorage.setItem("prison.username", String(data.user.username));
      } catch (e) {
        // ignore
      }

      window.location.href = "/app/index.html?module=cautare";
    } catch (err) {
      console.error("Eroare la login:", err);
      setMessage(
        err.message || "Nu s-a putut realiza autentificarea.",
        "error"
      );
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    checkHealth().catch(() => {});
    loadMotives().catch(() => {});

    if (formEl) {
      formEl.addEventListener("submit", handleSubmit);
    }

    if (guideBtn) {
      guideBtn.addEventListener("click", () => {
        window.location.href = "/ghid.html";
      });
    }
  });
})();
