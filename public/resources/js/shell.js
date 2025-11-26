// public/js/shell.js
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
      // CHANGED: Check visibility flag before rendering
      if (mod.visible === false) return; 

      const link = document.createElement("a");
      link.href = mod.path || '#';
      link.textContent = mod.label;
      link.className = "nav-link";
      if (mod.key === activeKey) {
        link.classList.add("nav-link-active");
      }
      navContainer.appendChild(link);
    });
  }

  function renderDefaultContent(activeKey) {
    let title = "Bine ai venit";
    let subtitle = "Selectează un modul din meniul de sus.";

    if (activeKey) {
      subtitle = `Modulul "${activeKey}" nu are încă o implementare dedicată sau nu a fost găsit.`;
    }

    appContent.innerHTML = `
      <h1 class="app-title">${title}</h1>
      <p class="app-subtitle">${subtitle}</p>
    `;
  }

  function runModule(activeKey, userId) {
    const registry = window.prisonModules || {};
    appContent.innerHTML = "";

    if (registry[activeKey] && typeof registry[activeKey].init === "function") {
      registry[activeKey].init({ userId, container: appContent });
    } else {
      renderDefaultContent(activeKey);
    }
  }

  async function initApp() {
    const userId = ensureLoggedIn();
    if (!userId) return;

    let activeKey = getCurrentModuleKey();

    try {
      const navData = await window.prisonApi.get(
        `/nav?userId=${encodeURIComponent(userId)}`
      );

      if (!navData.success) {
        throw new Error(navData.error || "Nu s-a putut încărca meniul.");
      }

      const modules = Array.isArray(navData.modules) ? navData.modules : [];

      // If no module in URL, pick first visible one
      if (!activeKey && modules.length > 0) {
        // Find first visible module
        const first = modules.find(m => m.visible !== false) || modules[0];
        activeKey = first.key;
        const url = new URL(window.location.href);
        url.searchParams.set("module", activeKey);
        window.history.replaceState({}, "", url.toString());
      }

      // Security Check: Is the requested module in the allowed list?
      // (Even hidden modules like 'detinut' should be in this list now)
      if (
        activeKey &&
        !modules.some((m) => m.key === activeKey) &&
        modules.length > 0
      ) {
        console.warn(`Module ${activeKey} not allowed or not found. Redirecting.`);
        const first = modules.find(m => m.visible !== false) || modules[0];
        activeKey = first.key;
        const url = new URL(window.location.href);
        url.searchParams.set("module", activeKey);
        window.history.replaceState({}, "", url.toString());
      }

      renderNav(modules, activeKey);
      runModule(activeKey, userId);

    } catch (err) {
      console.error("App Init Error:", err);
      appContent.innerHTML = `
        <h1 class="app-title">Eroare</h1>
        <p class="app-subtitle">${err.message || "Eroare la inițializare."}</p>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initApp().catch(() => {});

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("prison.userId");
        sessionStorage.removeItem("prison.username");
        window.location.href = "/";
      });
    }
  });
})();