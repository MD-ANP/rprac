(function () {
    const api = window.prisonApi;

    function buildLayout(container) {
        container.innerHTML = `
            <div class="add-detinut-wrapper">
                <header class="module-header">
                    <div class="header-icon">👤</div>
                    <div class="header-text">
                        <h1>Înregistrare Deținut</h1>
                        <p>Introduceți datele pentru crearea dosarului primar.</p>
                    </div>
                </header>

                <section class="modern-card form-card-compact">
                    <form id="addDetinutForm" class="styled-form" autocomplete="off">
                        
                        <div class="idnp-row">
                            <div class="f-group full-width">
                                <label for="f-idnp">Cod Personal / IDNP</label>
                                <input type="text" id="f-idnp" name="idnp" 
                                       placeholder="Introduceți codul de identificare..." class="input-idnp-compact" required>
                            </div>
                        </div>

                        <div class="divider"><span>Date Personale</span></div>

                        <div class="form-grid-3">
                            <div class="f-group">
                                <label>Nume</label>
                                <input type="text" name="nume" placeholder="POPESCU" required>
                            </div>
                            <div class="f-group">
                                <label>Prenume</label>
                                <input type="text" name="prenume" placeholder="ION" required>
                            </div>
                            <div class="f-group">
                                <label>Patronimic</label>
                                <input type="text" name="patronimic" placeholder="VASILE">
                            </div>
                        </div>

                        <div class="form-grid-2 mt-2 align-center">
                            <div class="f-group">
                                <label>Data Nașterii</label>
                                <input type="text" name="data_nasterii" id="f-birth" 
                                       placeholder="ZZ.LL.AAAA" maxlength="10" required>
                            </div>
                            <div class="f-group info-box">
                                <p>Verificați corectitudinea datelor conform actelor de identitate înainte de salvare.</p>
                            </div>
                        </div>

                        <div class="form-actions-compact">
                            <button type="button" class="btn-secondary" onclick="window.history.back()">Anulează</button>
                            <button type="submit" class="btn-save-primary">💾 Salvează Deținut</button>
                        </div>
                    </form>
                    <div id="addMessage" class="form-message"></div>
                </section>
            </div>

            <style>
                .add-detinut-wrapper { max-width: 900px; margin: 0 auto; padding: 10px 20px; font-family: 'Inter', sans-serif; }
                
                .module-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; justify-content: center; }
                .header-icon { font-size: 2rem; }
                .module-header h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0; }
                .module-header p { color: #64748b; font-size: 0.9rem; margin: 0; }

                .modern-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }

                .idnp-row { margin-bottom: 15px; }
                .input-idnp-compact { 
                    width: 100%; text-align: center; font-size: 1.2rem; font-weight: 700;
                    font-family: 'Roboto Mono', monospace; padding: 12px; border: 2px solid #e2e8f0; 
                    border-radius: 10px; background: #f8fafc; transition: 0.2s;
                }
                .input-idnp-compact:focus { border-color: #2563eb; background: #fff; outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

                .divider { position: relative; text-align: center; margin: 15px 0; }
                .divider::before { content: ""; position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: #f1f5f9; z-index: 1; }
                .divider span { position: relative; z-index: 2; background: #fff; padding: 0 10px; color: #94a3b8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }

                .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                
                /* Grid Alignment Fix */
                .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .align-center { align-items: center; } 
                
                .mt-2 { margin-top: 15px; }

                .f-group { display: flex; flex-direction: column; gap: 5px; }
                .f-group label { font-weight: 700; font-size: 0.8rem; color: #475569; }
                .f-group input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; }
                
                /* Info Box Polishing */
                .info-box p { 
                    margin: 0; 
                    font-size: 0.85rem; 
                    color: #64748b; 
                    font-style: italic; 
                    line-height: 1.3;
                    border-left: 3px solid #e2e8f0;
                    padding-left: 12px;
                }

                .form-actions-compact { display: flex; justify-content: center; gap: 15px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9; }
                .btn-save-primary { background: #2563eb; color: #fff; border: none; padding: 12px 30px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: 0.2s; }
                .btn-save-primary:hover { background: #1d4ed8; transform: translateY(-1px); }
                .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; }

                .form-message { margin-top: 10px; text-align: center; font-weight: 700; font-size: 0.9rem; min-height: 1.2em; }
                .form-message.error { color: #dc2626; }
                .form-message.success { color: #16a34a; }

                @media (max-width: 600px) {
                    .form-grid-3, .form-grid-2 { grid-template-columns: 1fr; }
                    .align-center { align-items: stretch; }
                }
            </style>
        `;
    }

    function setupDateFormatter(input) {
        input.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '').slice(0, 8);
            if (v.length >= 5) {
                v = v.slice(0, 2) + '.' + v.slice(2, 4) + '.' + v.slice(4);
            } else if (v.length >= 3) {
                v = v.slice(0, 2) + '.' + v.slice(2);
            }
            e.target.value = v;
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace') {
                const val = e.target.value;
                if (val.endsWith('.')) {
                    e.target.value = val.slice(0, -1);
                }
            }
        });
    }

    async function handleAddSubmit(e, form, container) {
        e.preventDefault();
        const msgEl = container.querySelector("#addMessage");
        const submitBtn = form.querySelector('button[type="submit"]');

        msgEl.textContent = "";
        
        const dateVal = form.data_nasterii.value;
        if (dateVal.length < 10) {
            msgEl.textContent = "Data nașterii incompletă.";
            msgEl.className = "form-message error";
            return;
        }

        const payload = {
            idnp: form.idnp.value.trim(),
            nume: form.nume.value.trim().toUpperCase(),
            prenume: form.prenume.value.trim().toUpperCase(),
            patronimic: form.patronimic.value.trim().toUpperCase() || "-",
            data_nasterii: dateVal
        };

        submitBtn.disabled = true;
        msgEl.textContent = "⏳ Salvare...";
        msgEl.className = "form-message";

        try {
            const resp = await api.post("/detinuti/add", payload);
            if (resp.success) {
                msgEl.textContent = "✅ Salvare reușită!";
                msgEl.className = "form-message success";
                if (confirm("Deținut adăugat! Deschidem dosarul?")) {
                    window.location.href = `/app/index.html?module=detinut&id=${resp.id}`;
                } else {
                    form.reset();
                }
            } else {
                throw new Error(resp.error || "Eroare la salvare.");
            }
        } catch (err) {
            msgEl.textContent = "❌ " + err.message;
            msgEl.className = "form-message error";
        } finally {
            submitBtn.disabled = false;
        }
    }

    window.prisonModules = window.prisonModules || {};
    window.prisonModules.adaugaDetinut = {
        init: function ({ container }) {
            buildLayout(container);
            const form = container.querySelector('#addDetinutForm');
            const dateInput = container.querySelector('#f-birth');
            
            setupDateFormatter(dateInput);

            if (form) {
                form.addEventListener('submit', (e) => handleAddSubmit(e, form, container));
            }
        }
    };
})();