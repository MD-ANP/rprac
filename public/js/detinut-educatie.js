(function() {
    window.DetinutTabs = window.DetinutTabs || {};
    let currentIdnp = null;
    let permissions = {};

    // --- CONFIGURATION ---
    // Maps UI tabs to DB Permission IDs and API keys
    const SUB_MODULES = [
        // ID 13: Instruire
        { key: 'instr_gen',     label: 'Instruire Generală',     moduleId: 13, group: 'Instruire' },
        { key: 'instr_prof',    label: 'Instruire Profesională', moduleId: 13, group: 'Instruire' },
        { key: 'instr_alte',    label: 'Alte Instruiri',         moduleId: 13, group: 'Instruire' },
        
        // ID 14: Social / Cultural / Sport
        { key: 'cultural',      label: 'Cultural-Artistic',      moduleId: 14, group: 'Educativ-Social' },
        { key: 'sport',         label: 'Activități Sportive',    moduleId: 14, group: 'Educativ-Social' },

        // ID 15: Muncă
        { key: 'munca_rem',     label: 'Muncă Remunerată',       moduleId: 15, group: 'Muncă' },
        { key: 'munca_nerem',   label: 'Muncă Neremunerată',     moduleId: 15, group: 'Muncă' },

        // ID 16: Sancțiuni
        { key: 'sanctiuni',     label: 'Sancțiuni',              moduleId: 16, group: 'Disciplinar' },

        // ID 17: Stimulări
        { key: 'stimulari',     label: 'Stimulări',              moduleId: 17, group: 'Disciplinar' },

        // ID 18: Caracteristica
        { key: 'caracteristica',label: 'Caracteristici',         moduleId: 18, group: 'Caracterizare' }
    ];

    // --- PERMISSION HELPER ---
    async function loadPermissions(userId) {
        if (Object.keys(permissions).length > 0) return;
        try {
            const res = await window.prisonApi.get(`/profile?userId=${userId}`);
            if(res.success && res.permissions) {
                res.permissions.forEach(p => permissions[p.moduleId] = p.drept);
            }
        } catch(e) { console.error("Perms load error", e); }
    }

    function getRight(moduleId) {
        return permissions[moduleId] || null; // 'R', 'W', or null
    }

    // --- HTML RENDERERS ---
    function renderLayout(container, allowedTabs) {
        injectEduModal();
        
        if (allowedTabs.length === 0) {
            container.innerHTML = `<div class="admin-panel text-center"><p class="text-muted">Nu aveți drepturi de vizualizare.</p></div>`;
            return;
        }

        // Group tabs by 'group' property for sidebar
        const groups = {};
        allowedTabs.forEach(t => {
            if(!groups[t.group]) groups[t.group] = [];
            groups[t.group].push(t);
        });

        let navHtml = '';
        for (const [grpName, items] of Object.entries(groups)) {
            navHtml += `<h4 style="margin: 15px 0 5px 20px; font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">${grpName}</h4>`;
            navHtml += items.map(t => `<button class="side-nav-btn" data-key="${t.key}">${t.label}</button>`).join('');
        }

        container.innerHTML = `
          <div class="module-container">
            <div class="module-sidebar">
               <nav id="eduNav">${navHtml}</nav>
            </div>
            <div class="module-content" id="eduContent">
               <div class="loader-box">Selectați o categorie.</div>
            </div>
          </div>
        `;

        const navBtns = container.querySelectorAll('.side-nav-btn');
        const content = container.querySelector('#eduContent');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadSubModule(btn.dataset.key, content);
            });
        });

        if (navBtns.length > 0) navBtns[0].click();
    }

    async function loadSubModule(key, container) {
        container.innerHTML = '<div class="loader-box">Se încarcă...</div>';
        
        try {
            const res = await window.prisonApi.get(`/detinut/${currentIdnp}/educatie/${key}`);
            if(!res.success) throw new Error(res.error);

            // Determine if Write is allowed based on server response OR locally cached perms
            // Note: API returns 'canWrite' based on Permission Check
            const canWrite = res.canWrite;
            
            renderTable(container, key, res.rows, canWrite);
        } catch(e) {
            container.innerHTML = `<div class="error-box">Eroare: ${e.message}</div>`;
        }
    }

    // --- TABLE DEFINITIONS ---
    function renderTable(container, key, rows, canWrite) {
        let cols = [];
        let rowMapper = null;
        let title = "";
        let allowAdd = false;

        // READ-ONLY MODULES (per legacy code)
        if (key === 'instr_gen') {
            title = "Instruire Generală";
            cols = ["Clasa", "Început", "Sfârșit", "Instituția"];
            rowMapper = r => `<td>${r.NAME_CLASA||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_PENITENCIAR||'-'}</td>`;
        } 
        else if (key === 'instr_prof') {
            title = "Instruire Profesională";
            cols = ["Specialitate", "Început", "Sfârșit", "Instituția"];
            rowMapper = r => `<td>${r.NAME_PROFESSION||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_PENITENCIAR||'-'}</td>`;
        }
        else if (key === 'instr_alte') {
            title = "Alte Instruiri";
            cols = ["Tip", "Început", "Sfârșit", "Inst.", "Calificativ", "Notă"];
            rowMapper = r => `<td>${r.NAME_PROGRAM||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_PENITENCIAR||'-'}</td><td>${r.NAME_CALIFICATIV||'-'}</td><td>${r.NAME||'-'}</td>`;
        }
        else if (key === 'cultural') {
            title = "Activități Culturale";
            cols = ["Activitate", "Început", "Sfârșit", "Instituția"];
            rowMapper = r => `<td>${r.NAME||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_PENITENCIAR||'-'}</td>`;
        }
        else if (key === 'sport') {
            title = "Activități Sportive";
            cols = ["Activitate", "Început", "Sfârșit", "Instituția"];
            rowMapper = r => `<td>${r.NAME||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_PENITENCIAR||'-'}</td>`;
        }
        else if (key === 'munca_rem') {
            title = "Muncă Remunerată";
            cols = ["Tip", "Loc Muncă", "Început", "Sfârșit", "Zile", "Coef. Nociv"];
            rowMapper = r => `<td>${r.NAME_REMUNERAT||'-'}</td><td>${r.WORK_PLACE||'-'}</td><td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NRZILE||'-'}</td><td>${r.NAME_KOEFICIENT_NOCIV||'-'}</td>`;
        }
        else if (key === 'sanctiuni') {
            title = "Sancțiuni";
            cols = ["Data Aplicării", "Sfârșit", "Tip", "Fapta"];
            rowMapper = r => `<td>${r.BDATE||'-'}</td><td>${r.EDATE||'-'}</td><td>${r.NAME_SANCTIUNE||'-'}</td><td>${r.FACTS||'-'}</td>`;
        }
        else if (key === 'stimulari') {
            title = "Stimulări";
            cols = ["Data", "Tip", "Motiv"];
            rowMapper = r => `<td>${r.ADATE||'-'}</td><td>${r.NAME_STIMULARE||'-'}</td><td>${r.FACTS||'-'}</td>`;
        }
        else if (key === 'caracteristica') {
            title = "Caracteristici";
            cols = ["Data", "Instituția", "Calificator"];
            rowMapper = r => {
                let car = [];
                if(r.STATUS) car.push(`Caracteristica: ${r.STATUS}`);
                if(r.EXECUTPROGRAM) car.push(`${r.EXECUTPROGRAM} Program individual.`);
                if(r.COMPORTAMENT) car.push(`Comportament ${r.COMPORTAMENT}`);
                return `<td>${r.BDATE||'-'}</td><td>${r.PENITENCIAR||'-'}</td><td style="white-space:pre-line">${car.join('; ')||'—'}</td>`;
            };
        }

        // WRITE-SUPPORTED MODULES
        else if (key === 'munca_nerem') {
            title = "Muncă Neremunerată";
            allowAdd = canWrite;
            cols = ["Loc Muncă", "Început", "Sfârșit", "Ore"];
            rowMapper = r => `<td>${r.WORK_PLACE}</td><td>${r.ADATE}</td><td>${r.EDATE||'-'}</td><td>${r.HOURS}</td>`;
        }

        // Build HTML
        const btnAdd = allowAdd ? `<button class="btn-primary btn-small" onclick="window.eduOps.openAdd('${key}')">+ Adaugă</button>` : '';

        let html = `
            <div class="flex-between" style="border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
                <h3 style="margin:0; font-size:1.1rem; color:#1e293b;">${title}</h3>
                ${btnAdd}
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>${cols.map(c => `<th>${c}</th>`).join('')}${allowAdd ? '<th style="width:50px;"></th>' : ''}</tr>
                    </thead>
                    <tbody>
        `;

        if (rows.length === 0) {
            html += `<tr><td colspan="${cols.length + (allowAdd?1:0)}" class="table-empty">Nu există înregistrări.</td></tr>`;
        } else {
            html += rows.map(r => {
                let act = '';
                if(allowAdd) {
                    act = `<td class="text-center"><button class="btn-danger btn-tiny" onclick="window.eduOps.del('${key}', ${r.ID})">×</button></td>`;
                }
                return `<tr>${rowMapper(r)}${act}</tr>`;
            }).join('');
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // --- MODAL & FORM (Only for Neremunerat currently) ---
    function injectEduModal() {
        if(document.getElementById('eduModal')) return;
        const html = `
        <div class="modal-overlay" id="eduModal">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title">Adăugare Neremunerat</h3>
                    <button class="btn-close" onclick="window.eduOps.close()">×</button>
                </div>
                <div class="modal-body">
                    <form id="eduForm" class="admin-form">
                        <div class="f"><label>Locul de Muncă</label><input type="text" name="work_place" class="full-width" required></div>
                        <div class="admin-grid-2">
                             <div class="f"><label>Data Început</label><input type="text" name="adate" class="datepicker" placeholder="DD.MM.YYYY" required></div>
                             <div class="f"><label>Data Sfârșit</label><input type="text" name="edate" class="datepicker" placeholder="DD.MM.YYYY"></div>
                        </div>
                        <div class="f"><label>Ore</label><input type="number" name="hours" class="full-width" required></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-ghost" onclick="window.eduOps.close()">Anulează</button>
                    <button class="btn-primary" onclick="window.eduOps.submit()">Salvează</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    window.eduOps = {
        currentKey: null,
        close: () => document.getElementById('eduModal').classList.remove('open'),
        openAdd: (key) => {
            if(key !== 'munca_nerem') return; // Only one supported for write per legacy
            window.eduOps.currentKey = key;
            document.getElementById('eduForm').reset();
            document.getElementById('eduModal').classList.add('open');
        },
        submit: async () => {
            const key = window.eduOps.currentKey;
            const form = document.getElementById('eduForm');
            if(!form.reportValidity()) return;
            
            const payload = Object.fromEntries(new FormData(form));
            try {
                // Using API wrapper which supports POST
                const url = `/detinut/${currentIdnp}/educatie/${key}`;
                const userId = sessionStorage.getItem("prison.userId");

                const res = await fetch(`/api${url}`, {
                    method: 'POST',
                    headers: { "Content-Type": "application/json", "X-User-Id": userId },
                    body: JSON.stringify(payload)
                });
                const d = await res.json();
                if(!d.success) throw new Error(d.error);

                window.eduOps.close();
                const content = document.querySelector('#eduContent');
                loadSubModule(key, content);
            } catch(e) { alert(e.message); }
        },
        del: async (key, id) => {
            if(!confirm("Sigur ștergeți?")) return;
            try {
                await window.prisonApi.del(`/detinut/educatie/${key}/${id}`);
                const content = document.querySelector('#eduContent');
                loadSubModule(key, content);
            } catch(e) { alert(e.message); }
        }
    };

    // --- MAIN RENDER ---
    window.DetinutTabs['educatie'] = {
        render: async (container, detinutId) => {
             const idnp = window.currentDetinutData ? window.currentDetinutData.IDNP : null;
             if (!idnp) { container.innerHTML = '<div class="error-box">Lipsă IDNP.</div>'; return; }
             currentIdnp = idnp;

             const userId = sessionStorage.getItem("prison.userId");
             await loadPermissions(userId);

             // Filter Tabs
             const allowedTabs = SUB_MODULES.filter(m => {
                 const right = getRight(m.moduleId);
                 return right === 'R' || right === 'W';
             });

             renderLayout(container, allowedTabs);
        }
    };
})();