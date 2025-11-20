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

  function renderDefaultContent(activeKey) {
    let title = "Bine ai venit";
    let subtitle = "Selectează un modul din meniul de sus.";

    if (activeKey) {
      subtitle = `Modulul "${activeKey}" nu are încă o implementare dedicată.`;
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

      // Meanwhile, load the nav.
      const navData = await window.prisonApi.get(
        `/nav?userId=${encodeURIComponent(userId)}`
      );

      if (!navData.success) {
        throw new Error(navData.error || "Nu s-a putut încărca meniul.");
      }

      const modules = Array.isArray(navData.modules) ? navData.modules : [];

      // default active module
      if (!activeKey && modules.length > 0) {
        activeKey = modules[0].key;
        const url = new URL(window.location.href);
        url.searchParams.set("module", activeKey);
        window.history.replaceState({}, "", url.toString());
      }

      // if URL module not allowed, fallback
      if (
        activeKey &&
        !modules.some((m) => m.key === activeKey) &&
        modules.length > 0
      ) {
        activeKey = modules[0].key;
        const url = new URL(window.location.href);
        url.searchParams.set("module", activeKey);
        window.history.replaceState({}, "", url.toString());
      }

      renderNav(modules, activeKey);
      runModule(activeKey, userId);


    } catch (err) {
      console.error("Eroare la încărcarea aplicației:", err);
      appContent.innerHTML = `
        <h1 class="app-title">Eroare</h1>
        <p class="app-subtitle">${(err && err.message) || "Nu s-a putut încărca meniul sau modulul."}</p>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initApp().catch(() => {});

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
