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

  // --- 1. DB Health Check ---
  async function checkHealth() {
    if (!authCard) return;
    try {
      const data = await window.prisonApi.get("/health");
      if (data && data.dbAvailable === false) {
        authCard.innerHTML = `
          <h1 class="auth-title">Eroare conexiune DB</h1>
          <p class="auth-subtitle">
            Contactați administratorul: <a href="mailto:admin@anp.gov.md">admin@anp.gov.md</a>
          </p>
        `;
      }
    } catch (err) { console.error("Health check error", err); }
  }

  // --- 2. Load System Announcement ---
  async function loadAnnouncement() {
    try {
      console.log("Fetching announcement...");
      const data = await window.prisonApi.get("/ann");
      console.log("Announcement data:", data);

      if (data.success && data.message && data.message.trim().length > 0) {
        const banner = document.getElementById("systemAnnouncement");
        const textEl = document.getElementById("sysAnnText");
        
        if (banner && textEl) {
          textEl.textContent = data.message;
          // Force display flex to override display:none
          banner.style.display = "flex"; 
          // Add visible class for animation
          setTimeout(() => banner.classList.add('visible'), 50);
        }
      } else {
        console.log("No active announcement found.");
      }
    } catch (e) {
      console.error("Error loading announcement:", e);
    }
  }

  // --- 3. Load Motives ---
  async function loadMotives() {
    if (!motivationEl) return;
    try {
      const data = await window.prisonApi.get("/motives");
      if (!data.success) throw new Error(data.error);

      motivationEl.innerHTML = '<option value="">-- Selectați motivul --</option>';
      (data.motives || []).forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.text;
        motivationEl.appendChild(opt);
      });
    } catch (err) {
      console.error("Motives load error:", err);
    }
  }

  // --- 4. Handle Login ---
  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!formEl) return;
    setMessage("", "");

    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    const motivId = motivationEl.value;

    if (!username || !password || !motivId) {
      setMessage("Toate câmpurile sunt obligatorii.", "error");
      return;
    }

    loginBtn.disabled = true;

    try {
      const data = await window.prisonApi.post("/login", { username, password, motivId });
      if (!data.success) throw new Error(data.error || "Login failed");

      sessionStorage.setItem("prison.userId", data.user.id);
      sessionStorage.setItem("prison.username", data.user.username);
      
      window.location.href = "/app/index.html?module=cautare";
    } catch (err) {
      setMessage(err.message, "error");
    } finally {
      loginBtn.disabled = false;
    }
  }

  // --- Init ---
  document.addEventListener("DOMContentLoaded", () => {
    // Run checks parallel
    checkHealth();
    loadMotives();
    loadAnnouncement();

    if (formEl) formEl.addEventListener("submit", handleSubmit);
    if (guideBtn) guideBtn.addEventListener("click", () => window.location.href = "/ghid.html");
  });
})();