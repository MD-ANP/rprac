(function() {
    // --- CSS ---
    const style = `
    <style>
        .comasare-wrapper {
            background-color: #f1f5f9;
            min-height: calc(100vh - 150px);
            padding: 30px;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }

        .comasare-container {
            max-width: 1100px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }

        /* HEADER */
        .comasare-header {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border-bottom: 1px solid #ef4444;
            color: #991b1b;
            padding: 25px;
            text-align: center;
            position: relative;
        }
        .comasare-header h2 {
            margin: 0 0 10px 0;
            font-size: 1.8rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .comasare-header p {
            margin: 0;
            font-size: 0.95rem;
            opacity: 0.9;
            max-width: 700px;
            margin: 0 auto;
            line-height: 1.5;
        }

        /* GRID SYSTEM */
        .comasare-grid {
            display: grid;
            grid-template-columns: 1fr 80px 1fr;
            padding: 30px;
            gap: 20px;
            align-items: stretch;
            background: #fff;
        }

        /* PROFILES */
        .profile-section {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .profile-label {
            font-weight: 700;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            display: block;
        }
        .label-source { color: #d97706; }
        .label-target { color: #059669; }

        .search-box input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.2s;
            outline: none;
        }
        .search-box input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .profile-card {
            flex: 1;
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 20px;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            position: relative;
            min-height: 280px;
        }

        .profile-card.active {
            border-style: solid;
            background: #fff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .profile-card.source.active { border-color: #f59e0b; background: #fffbeb; }
        .profile-card.target.active { border-color: #10b981; background: #ecfdf5; }

        /* ARROW DIVIDER */
        .arrow-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .arrow-circle {
            width: 50px;
            height: 50px;
            background: #f1f5f9;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: #64748b;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 2;
        }
        .arrow-line {
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 2px;
            background: #e2e8f0;
            z-index: 1;
        }

        /* SEARCH RESULTS DROPDOWN */
        .search-wrapper { position: relative; }
        .search-results {
            position: absolute;
            top: 105%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 50;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .search-item {
            padding: 10px 15px;
            cursor: pointer;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .search-item:hover { background: #f0f9ff; }
        .search-item strong { color: #1e293b; }
        .search-item span { color: #64748b; font-size: 0.9rem; }

        /* PREVIEW CONTENT */
        .detinut-preview {
            text-align: center;
            width: 100%;
        }
        .detinut-preview img {
            width: 120px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 3px solid #fff;
        }
        .detinut-preview h3 { margin: 0; color: #1e293b; font-size: 1.2rem; }
        .detinut-preview .idnp { 
            font-family: monospace; 
            font-size: 1.1rem; 
            background: #e2e8f0; 
            padding: 2px 8px; 
            border-radius: 4px; 
            color: #334155; 
            display: inline-block;
            margin: 5px 0;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 10px;
        }
        .badge-source { background: #fef3c7; color: #d97706; border: 1px solid #f59e0b; }
        .badge-target { background: #d1fae5; color: #059669; border: 1px solid #10b981; }

        /* ACTION FOOTER */
        .action-footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .btn-merge {
            background: #ef4444;
            color: white;
            border: none;
            padding: 12px 40px;
            font-size: 1.1rem;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
        .btn-merge:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 8px rgba(239, 68, 68, 0.3); background: #dc2626; }
        .btn-merge:active:not(:disabled) { transform: translateY(0); }
        .btn-merge:disabled { background: #cbd5e1; cursor: not-allowed; box-shadow: none; color: #94a3b8; }

        /* CONSOLE */
        .log-console {
            background: #0f172a;
            color: #34d399;
            font-family: 'Consolas', 'Monaco', monospace;
            padding: 20px;
            height: 250px;
            overflow-y: auto;
            font-size: 0.9rem;
            line-height: 1.5;
            border-top: 1px solid #1e293b;
        }
        .log-line { border-left: 3px solid transparent; padding-left: 10px; margin-bottom: 2px; }
        .log-line.header { color: #f8fafc; font-weight: bold; border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); padding: 5px 10px; margin: 10px 0; }
        .log-line.error { color: #f87171; border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        .log-line.success { color: #34d399; border-color: #10b981; }
        .log-line.info { color: #94a3b8; }
        
        /* SCROLLBAR */
        .log-console::-webkit-scrollbar { width: 8px; }
        .log-console::-webkit-scrollbar-track { background: #1e293b; }
        .log-console::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    </style>
    `;

    // --- STATE ---
    let sourceDetinut = null;
    let targetDetinut = null;

    // --- HELPERS ---
    async function searchInmates(query) {
        if (!query || query.length < 3) return [];
        const res = await window.prisonApi.get(`/comasare/search?q=${encodeURIComponent(query)}`);
        return res.success ? res.rows : [];
    }

    function renderProfile(containerId, detinut, type) {
        const el = document.getElementById(containerId);
        
        if (!detinut) {
            el.className = `profile-card ${type}`; // Reset classes
            el.innerHTML = `
                <div style="text-align:center; color:#94a3b8;">
                    <div style="font-size:3rem; margin-bottom:10px; opacity:0.3;">${type === 'source' ? '📤' : '📥'}</div>
                    <div>Selectați deținutul ${type === 'source' ? 'sursă' : 'destinație'}</div>
                </div>
            `;
            return;
        }

        // Active State
        el.className = `profile-card ${type} active`;

        const dir1 = detinut.IDNP ? detinut.IDNP.charAt(0) : '0';
        const photo = `/resources/photos/${dir1}/${detinut.IDNP}/1.webp`;

        el.innerHTML = `
            <div class="detinut-preview">
                <img src="${photo}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjUiPjwvY2lyY2xlPjxwYXRoIGQ9Ik0yMCAyMWE4IDggMCAwIDAtMTYgMCI+PC9wYXRoPjwvc3ZnPg=='">
                <h3>${detinut.SURNAME} ${detinut.NAME}</h3>
                <div class="idnp">${detinut.IDNP}</div>
                <div style="color:#64748b; font-size:0.9rem;">${detinut.BIRDTH || 'Data nașterii necunoscută'}</div>
                
                <div class="status-badge badge-${type}">
                    ${type === 'source' ? 'URMEAZĂ A FI ȘTERS (LOGIC)' : 'VA PRIMI DATELE'}
                </div>
            </div>
        `;
    }

    // --- MAIN RENDER ---
    async function render(container) {
        container.innerHTML = style + `
            <div class="comasare-wrapper">
                <div class="comasare-container">
                    
                    <div class="comasare-header">
                        <h2>⚠️ Comasare Dosare ⚠️</h2>
                        <p>
                            Acest modul permite migrarea datelor (istoric, sentințe, acte) de la un profil duplicat la unul corect.
                            <br>Datele sursei vor fi mutate, iar profilul sursă va fi marcat ca "COMASAT".
                        </p>
                    </div>

                    <div class="comasare-grid">
                        
                        <!-- Source Column -->
                        <div class="profile-section">
                            <label class="profile-label label-source">1. Profil Sursă (VECHI)</label>
                            <div class="search-wrapper">
                                <div class="search-box">
                                    <input type="text" id="searchSource" placeholder="Caută după Nume sau IDNP..." autocomplete="off">
                                </div>
                                <div id="resultsSource" class="search-results"></div>
                            </div>
                            <div id="cardSource" class="profile-card source"></div>
                        </div>

                        <!-- Divider -->
                        <div class="arrow-divider">
                            <div class="arrow-line"></div>
                            <div class="arrow-circle">➜</div>
                        </div>

                        <!-- Target Column -->
                        <div class="profile-section">
                            <label class="profile-label label-target">2. Profil Destinație (NOU)</label>
                            <div class="search-wrapper">
                                <div class="search-box">
                                    <input type="text" id="searchTarget" placeholder="Caută după Nume sau IDNP..." autocomplete="off">
                                </div>
                                <div id="resultsTarget" class="search-results"></div>
                            </div>
                            <div id="cardTarget" class="profile-card target"></div>
                        </div>

                    </div>

                    <div class="action-footer">
                        <button id="btnMerge" class="btn-merge" disabled>
                            <span>EXECUTĂ COMASAREA</span>
                        </button>
                    </div>

                    <div id="consoleLog" class="log-console">
                        <div class="log-line info">În așteptare...</div>
                    </div>
                </div>
            </div>
        `;

        // Init Cards
        renderProfile('cardSource', null, 'source');
        renderProfile('cardTarget', null, 'target');

        setupSearch('searchSource', 'resultsSource', 'source');
        setupSearch('searchTarget', 'resultsTarget', 'target');
        
        document.getElementById('btnMerge').onclick = executeMerge;
    }

    function setupSearch(inputId, resultsId, type) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        let debounce = null;

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${resultsId}`)) {
                results.innerHTML = '';
            }
        });

        input.oninput = () => {
            clearTimeout(debounce);
            debounce = setTimeout(async () => {
                const val = input.value.trim();
                if(val.length < 3) { results.innerHTML = ''; return; }
                
                const rows = await searchInmates(val);
                
                if (rows.length === 0) {
                    results.innerHTML = '<div style="padding:10px; color:#64748b; text-align:center;">Nu au fost găsite rezultate</div>';
                    return;
                }

                results.innerHTML = rows.map(r => `
                    <div class="search-item" onclick="window.comasareOps.select('${type}', '${r.IDNP}', '${r.NAME}', '${r.SURNAME}', '${r.BIRDTH}')">
                        <div>
                            <strong>${r.SURNAME} ${r.NAME}</strong>
                            <div style="font-size:0.8rem; color:#64748b;">${r.BIRDTH || '-'}</div>
                        </div>
                        <span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${r.IDNP}</span>
                    </div>
                `).join('');
            }, 300);
        };
    }

    window.comasareOps = {
        select: (type, idnp, name, surname, birth) => {
            const obj = { IDNP: idnp, NAME: name, SURNAME: surname, BIRDTH: birth };
            
            if (type === 'source') {
                sourceDetinut = obj;
                document.getElementById('searchSource').value = `${surname} ${name}`;
                document.getElementById('resultsSource').innerHTML = '';
                renderProfile('cardSource', obj, 'source');
            } else {
                targetDetinut = obj;
                document.getElementById('searchTarget').value = `${surname} ${name}`;
                document.getElementById('resultsTarget').innerHTML = '';
                renderProfile('cardTarget', obj, 'target');
            }

            // Validation Logic
            const btn = document.getElementById('btnMerge');
            if (sourceDetinut && targetDetinut) {
                if (sourceDetinut.IDNP === targetDetinut.IDNP) {
                    btn.disabled = true;
                    alert("Eroare: Sursa și Destinația nu pot fi aceeași persoană.");
                } else {
                    btn.disabled = false;
                }
            } else {
                btn.disabled = true;
            }
        }
    };

    async function executeMerge() {
        if (!sourceDetinut || !targetDetinut) return;
        
        const confirmMsg = `⚠️ ATENȚIE: COMASARE IREVERSIBILĂ ⚠️\n\nTransferați datele de la:\n${sourceDetinut.SURNAME} ${sourceDetinut.NAME}\n\nCătre:\n${targetDetinut.SURNAME} ${targetDetinut.NAME}\n\nSunteți absolut sigur?`;
        
        if (!confirm(confirmMsg)) return;

        const consoleDiv = document.getElementById('consoleLog');
        consoleDiv.innerHTML = ''; // Clear previous logs
        
        // Helper log function
        const log = (msg, type='info') => {
            const d = new Date().toLocaleTimeString();
            consoleDiv.innerHTML += `<div class="log-line ${type}">[${d}] ${msg}</div>`;
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        };

        log("INIȚIERE PROCES COMASARE...", 'header');
        
        const btn = document.getElementById('btnMerge');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> SE PROCESEAZĂ...`;

        try {
            const res = await window.prisonApi.post('/comasare/execute', {
                old_idnp: sourceDetinut.IDNP,
                new_idnp: targetDetinut.IDNP
            });

            if (res.logs && Array.isArray(res.logs)) {
                res.logs.forEach(l => log(l.message, l.type));
            }

            if (res.success) {
                log("PROCES FINALIZAT CU SUCCES!", 'header');
                alert("Comasarea a fost finalizată cu succes!");
                
                // Reset UI
                sourceDetinut = null;
                targetDetinut = null;
                renderProfile('cardSource', null, 'source');
                renderProfile('cardTarget', null, 'target');
                document.getElementById('searchSource').value = '';
                document.getElementById('searchTarget').value = '';
                btn.innerHTML = `<span>EXECUTĂ COMASAREA</span>`;
            } else {
                log("PROCESUL S-A ÎNCHEIAT CU ERORI.", 'error');
                alert("Procesul s-a încheiat cu erori. Verificați consola.");
                btn.disabled = false;
                btn.innerHTML = `<span>REÎNCEARCĂ</span>`;
            }

        } catch (e) {
            log(`EROARE CRITICĂ: ${e.message}`, 'error');
            alert("Eroare de conexiune sau server!");
            btn.disabled = false;
            btn.innerHTML = `<span>REÎNCEARCĂ</span>`;
        }
    }

    // Register module
    window.prisonModules = window.prisonModules || {};
    window.prisonModules.comasare = { init: (opts) => render(opts.container) };
})();