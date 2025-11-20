// public/js/app.js
(function () {
  const navContainer = document.getElementById("navLinks");
  const userInfoEl = document.getElementById("userInfo");
  const logoutBtn = document.getElementById("logoutBtn");
  const appContent = document.getElementById("appContent");

  function getCurrentModuleKey() {
    const params = new URLSearchParams(window.location.search);
    return params.get("module") || null;
  }

  function ensureLoggedIn() {
    const userId = sessionStorage.getItem("prison.userId");
    const username = sessionStorage.getItem("prison.username");

    if (!userId || !username) {
      window.location.href = "/";
      return null;
    }

    userInfoEl.textContent = username;
    return userId;
  }

  function renderNav(modules, activeKey) {
    navContainer.innerHTML = "";

    modules.forEach((mod) => {
      const link = document.createElement("a");
      link.href = mod.path;
      link.textContent = mod.label;
      link.className = "nav-link";
      if (mod.key === activeKey) {
        link.classList.add("nav-link-active");
      }
      navContainer.appendChild(link);
    });
  }

  function renderModuleContent(activeKey) {
    // Simple placeholder for now
    let title = "Bine ai venit";
    let subtitle = "Selectează un modul din meniul de sus.";

    if (activeKey === "cautare") {
      title = "Modul: Căutare";
      subtitle = "Aici vei avea formularul de căutare.";
    } else if (activeKey === "profil") {
      title = "Modul: Profil utilizator";
      subtitle = "Aici vei afișa și edita datele utilizatorului.";
    } else if (activeKey === "admin") {
      title = "Modul: Pagina admin";
      subtitle = "Aici vor fi funcțiile administrative.";
    }

    appContent.innerHTML = `
      <h1 class="app-title">${title}</h1>
      <p class="app-subtitle">${subtitle}</p>
    `;
  }

  async function init() {
    const userId = ensureLoggedIn();
    if (!userId) return;

    const activeKey = getCurrentModuleKey();

    try {
      const data = await window.prisonApi.get(
        `/nav?userId=${encodeURIComponent(userId)}`
      );

      if (!data.success) {
        throw new Error(data.error || "Nu s-a putut încărca meniul.");
      }

      const modules = Array.isArray(data.modules) ? data.modules : [];
      renderNav(modules, activeKey);
      renderModuleContent(activeKey);
    } catch (err) {
      console.error("Eroare la încărcarea meniului:", err);
      appContent.innerHTML = `
        <h1 class="app-title">Eroare</h1>
        <p class="app-subtitle">${err.message || "Nu s-a putut încărca meniul sau modulul."}</p>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(() => {});

    logoutBtn.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("prison.userId");
        sessionStorage.removeItem("prison.username");
      } catch (e) {
        // ignore
      }
      window.location.href = "/";
    });
  });
})();
