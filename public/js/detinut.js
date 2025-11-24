// public/js/detinut.js
(function () {
  // 1. Global Registry: Modules will register themselves here.
  // Example: window.DetinutTabs['medicina'] = { render: (container, id) => { ... } }
  window.DetinutTabs = window.DetinutTabs || {};

  // 2. State
  let currentId = null;
  const TABS_CONFIG = [
    { key: 'generale', label: 'Detalii Generale' },
    { key: 'medicina', label: 'Medicină' },
    { key: 'educatie', label: 'Educație' },
    { key: 'psihologie', label: 'Psihologie' },
    { key: 'social', label: 'Asistență Socială' },
    { key: 'securitate', label: 'Securitate' },
    { key: 'regim', label: 'Regim' },
    { key: 'vizite', label: 'Vizite & Colete' }
  ];

  // 3. Render The Skeleton
  function renderSkeleton(container) {
    // Add class for wide layout
    document.body.classList.add('profile-mode');

    container.innerHTML = `
      <div id="detinutHeader" class="profile-hero">
        <div class="loader-box">Se încarcă datele deținutului...</div>
      </div>

      <nav class="profile-tabs-nav" id="mainTabs">
        ${TABS_CONFIG.map(t => 
            `<button class="tab-btn" data-tab="${t.key}">${t.label}</button>`
        ).join('')}
      </nav>

      <div id="profileContent" class="profile-content-area">
         <div class="loader-box">Selectați un modul.</div>
      </div>
    `;

    // Bind Tab Clicks
    const contentArea = container.querySelector('#profileContent');
    const buttons = container.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // UI Active State
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabKey = btn.dataset.tab;
        loadModule(tabKey, contentArea);
      });
    });
  }

  // 4. Load Specific Module
  function loadModule(key, container) {
    const module = window.DetinutTabs[key];

    if (module && typeof module.render === 'function') {
      // Delegate rendering to the module
      module.render(container, currentId);
    } else {
      container.innerHTML = `
        <div class="text-center p-4">
          <h3>Modul în lucru: ${key.toUpperCase()}</h3>
          <p class="text-muted">Acest modul nu a fost încă implementat.</p>
        </div>
      `;
    }
  }

  // 5. Load Header Data
  async function loadHeader(id) {
    const el = document.getElementById('detinutHeader');
    if (!el) return;

    try {
      const res = await window.prisonApi.get(`/detinut/${id}/general`);
      if (!res.success) throw new Error(res.error);
      
      const d = res.data;
      // Store globally for sub-modules to access (e.g. IDNP)
      window.currentDetinutData = d;

      el.innerHTML = `
        <div class="profile-hero-content">
          <div class="hero-avatar">
            <div class="avatar-placeholder">
              ${d.SURNAME ? d.SURNAME[0] : '?'}${d.NAME ? d.NAME[0] : '?'}
            </div>
          </div>
          <div class="hero-info">
            <h1 class="hero-name">${d.SURNAME} ${d.NAME} ${d.SEC_NAME || ''}</h1>
            <div class="hero-meta">
              <div class="meta-item">
                <span class="meta-label">ID SISTEM</span>
                <span class="meta-val">${d.ID}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">IDNP</span>
                <span class="meta-val">${d.IDNP}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">DATA NAȘTERII</span>
                <span class="meta-val">${d.BIRDTH}</span>
              </div>
               <div class="meta-item">
                <span class="meta-label">LOCAȚIE</span>
                <span class="meta-val" style="color:#2563eb">${d.PENITENCIAR_NAME || 'Necunoscut'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<div class="error-box">Eroare header: ${e.message}</div>`;
    }
  }

  // 6. Main Init
  window.prisonModules = window.prisonModules || {};
  window.prisonModules.detinut = {
    init({ userId, container }) {
      const urlParams = new URLSearchParams(window.location.search);
      currentId = urlParams.get('id');

      if (!currentId) {
        container.innerHTML = '<div class="error-box">Lipsă ID Deținut în URL.</div>';
        return;
      }

      renderSkeleton(container);
      loadHeader(currentId);

      // Auto-select first tab
      const firstTab = container.querySelector('.tab-btn[data-tab="generale"]');
      if (firstTab) firstTab.click();
    },
    
    // Cleanup when leaving module (optional but good practice)
    destroy() {
      document.body.classList.remove('profile-mode');
    }
  };
})();