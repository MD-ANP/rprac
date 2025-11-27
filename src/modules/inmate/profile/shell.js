(function () {
  // 1. Global Registry & Config
  window.DetinutTabs = window.DetinutTabs || {};
  
  const loadedScripts = {};
  let currentUserRole = null;

  // Configuration for tabs including permission rules
  // role: required role ID to see the tab (optional)
  const TABS_CONFIG = [
    { key: 'generale', label: 'Date Generale' },
    { key: 'garantii', label: 'Garanții' },
    { key: 'hotariri', label: 'Hotărîri' },
    { key: 'miscari', label: 'Mișcări' },
    { key: 'incidente', label: 'Incidente' },
    { key: 'citatii', label: 'Citații' },
    { key: 'rude', label: 'Rude' },
    { key: 'complici', label: 'Complici' },
    { key: 'medicina', label: 'Medicină'},
    { key: 'educatie', label: 'Educație'}, 
    { key: 'psihologie', label: 'Psihologie' },
    { key: 'social', label: 'Social' },
    { key: 'securitate', label: 'Securitate' },
    { key: 'regim', label: 'Regim' },
  ];

  // NEW: Map tab keys to their new modular paths
  const MODULE_SCRIPT_MAP = {
    'generale': '/modules/inmate/profile/client.js',
    'medicina': '/modules/inmate/medical/client.js',
    'garantii': '/modules/inmate/garantii/client.js',
    'rude': '/modules/inmate/rude/client.js',
    'complici': '/modules/inmate/complici/client.js',
  };

  let currentId = null;

  // 2. DYNAMIC SCRIPT LOADER
  function loadScript(src) {
    if (loadedScripts[src]) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { loadedScripts[src] = true; resolve(); };
      s.onerror = () => { console.warn(`[Module Loader] Failed ${src}`); resolve(); };
      document.head.appendChild(s);
    });
  }

  // 3. FETCH USER CONTEXT
  async function fetchUserContext() {
     if (currentUserRole !== null) return;
     try {
       const userId = sessionStorage.getItem("prison.userId");
       if (!userId) return;
       const res = await window.prisonApi.get(`/nav?userId=${userId}`);
       if (res.success && res.user) {
         currentUserRole = res.user.id_role;
       }
     } catch (e) {
       console.error("Failed to fetch user role", e);
     }
  }

  // 4. RENDER SHELL
  async function renderSkeleton(container) {
    document.body.classList.add('profile-mode');
    
    await fetchUserContext();

    const visibleTabs = TABS_CONFIG.filter(t => {
        if (!t.roles) return true;
        return t.roles.includes(currentUserRole);
    });

    container.innerHTML = `
      <div id="detinutHeader" class="detinut-header">
         <div class="loader-box">Se încarcă datele...</div>
      </div>

      <nav class="profile-tabs-nav" id="mainTabs">
        ${visibleTabs.map(t => 
            `<button class="tab-btn" data-tab="${t.key}">${t.label}</button>`
        ).join('')}
      </nav>

      <div id="profileContent" class="profile-content-area">
         <div class="loader-box">Selectați un modul.</div>
      </div>
    `;

    // Bind Clicks
    const contentArea = container.querySelector('#profileContent');
    const buttons = container.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await loadAndRenderModule(btn.dataset.tab, contentArea);
      });
    });
  }

  // 5. HEADER LOGIC
  async function loadHeader(id) {
    const el = document.getElementById('detinutHeader');
    if (!el) return;
    try {
      const res = await window.prisonApi.get(`/detinut/${id}/general`);
      if (!res.success) throw new Error(res.error);
      const d = res.data;
      
      window.currentDetinutData = d; 
      
      const dir1 = d.IDNP ? d.IDNP.charAt(0) : '0';
      const photoFront = `/resources/photos/${dir1}/${d.IDNP}/1.webp`;
      const photoProfile = `/resources/photos/${dir1}/${d.IDNP}/2.webp`;

      // --- NEW LOGIC START ---
      let guaranteeHtml = '';
      if (d.FOLDERPENDING === 'Y') {
          guaranteeHtml = `<div class="badge-guarantee">⚠️ GARANȚII DE STAT!</div>`;
      }
      // --- NEW LOGIC END ---

      el.innerHTML = `
        <div class="header-photos">
           <img src="${photoFront}" class="header-photo" onerror="this.classList.add('empty'); this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjUiPjwvY2lyY2xlPjxwYXRoIGQ9Ik0yMCAyMWE4IDggMCAwIDAtMTYgMCI+PC9wYXRoPjwvc3ZnPg==';">
           <img src="${photoProfile}" class="header-photo" onerror="this.style.display='none'">
        </div>
        <div class="header-info">
           <h1 class="header-name">
              ${d.SURNAME} ${d.NAME} ${d.SEC_NAME || ''}
              <div style="font-size:0.5em; line-height:1; vertical-align:middle;">${guaranteeHtml}</div>
           </h1>
           <div class="header-meta">
              <div class="meta-pill"><span class="meta-label">ID SISTEM:</span><span class="meta-val">${d.ID}</span></div>
              <div class="meta-pill"><span class="meta-label">IDNP:</span><span class="meta-val">${d.IDNP}</span></div>
              <div class="meta-pill"><span class="meta-label">DATA NAȘTERII:</span><span class="meta-val">${d.BIRDTH}</span></div>
              <div class="meta-pill"><span class="meta-label">PENITENCIAR:</span><span class="meta-val" style="color:#2563eb">${d.PENITENCIAR_NAME || 'Necunoscut'}</span></div>
           </div>
        </div>
        <div class="header-actions" id="headerActions"></div>
      `;
    } catch (e) { 
        el.innerHTML = `<div class="error-box">Eroare header: ${e.message}</div>`; 
        throw e;
    }
  }

  // 6. MODULE LOADING
  async function loadAndRenderModule(key, container) {
    const actionContainer = document.getElementById('headerActions');
    if(actionContainer) actionContainer.innerHTML = '';

    container.innerHTML = '<div class="loader-box">Se încarcă modulul...</div>';
    
    // NEW LOGIC: Use the map to find the correct path
    const scriptPath = MODULE_SCRIPT_MAP[key];

    if (scriptPath && !loadedScripts[scriptPath]) {
        await loadScript(scriptPath);
    } else if (!scriptPath) {
        // Fallback for modules not yet in the map (psihologie, securitate, etc.)
        container.innerHTML = `<div class="text-center p-4"><h3 style="color:#94a3b8">Modul în lucru: ${key.toUpperCase()}</h3></div>`;
        return;
    }
    // END NEW LOGIC
    
    const module = window.DetinutTabs[key];
    if (module && typeof module.render === 'function') {
      try { await module.render(container, currentId); } 
      catch (err) { container.innerHTML = `<div class="error-box">Eroare modul: ${err.message}</div>`; }
    } else {
      container.innerHTML = `<div class="text-center p-4"><h3 style="color:#94a3b8">Modul în lucru: ${key.toUpperCase()}</h3></div>`;
    }
  }

  // 7. INIT
  window.prisonModules = window.prisonModules || {};
  window.prisonModules.detinut = {
    async init({ userId, container }) {
      const urlParams = new URLSearchParams(window.location.search);
      currentId = urlParams.get('id');
      if (!currentId) { container.innerHTML = '<div class="error-box">Lipsă ID Deținut.</div>'; return; }
      
      try {
          await renderSkeleton(container);
          await loadHeader(currentId);
          
          const firstTab = container.querySelector('.tab-btn');
          if (firstTab) firstTab.click();
          
      } catch (e) {
          console.error("Init failed", e);
      }
    },
    destroy() { document.body.classList.remove('profile-mode'); }
  };
})();