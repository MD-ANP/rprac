(function () {
    const api = window.prisonApi;

    function buildLayout(container) {
        container.innerHTML = `
            <div class="add-detinut-wrapper">
                <header class="module-header">
                    <h1>👤 Înregistrare Deținut Nou</h1>
                    <p>Introduceți datele de identificare pentru crearea dosarului primar.</p>
                </header>

                <section class="modern-card form-card-center">
                    <form id="addDetinutForm" class="add-form-layout">
                        <div class="idnp-section">
                            <label>Cod Personal (IDNP)</label>
                            <input type="text" name="idnp" maxlength="13" placeholder="xxxxxxxxxxxxx" class="input-idnp" required>
                            <p class="input-hint">IDNP-ul trebuie să conțină exact 13 cifre.</p>
                        </div>

                        <div class="form-grid">
                            <div class="f-group">
                                <label>Nume (Familia)</label>
                                <input type="text" name="nume" placeholder="EX: POPESCU" required>
                            </div>
                            <div class="f-group">
                                <label>Prenume</label>
                                <input type="text" name="prenume" placeholder="EX: ION" required>
                            </div>
                            <div class="f-group">
                                <label>Patronimic</label>
                                <input type="text" name="patronimic" placeholder="EX: VASILE">
                            </div>
                            <div class="f-group">
                                <label>Data Nașterii</label>
                                <input type="date" name="data_nasterii_raw" required>
                            </div>
                        </div>

                        <div class="form-actions-footer">
                            <button type="button" class="btn-ghost" onclick="window.history.back()">Anulează</button>
                            <button type="submit" class="btn-primary btn-save-inmate">💾 Salvează în Baza de Date</button>
                        </div>
                    </form>
                    <div id="addMessage" class="form-message"></div>
                </section>
            </div>

            <style>
                .add-detinut-wrapper { max-width: 900px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #1e293b; }
                .module-header { text-align: center; margin-bottom: 30px; }
                .module-header h1 { font-size: 2rem; font-weight: 800; margin: 0; color: #0f172a; }
                .module-header p { color: #64748b; margin-top: 5px; }

                .form-card-center { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                
                /* IDNP Specific Styling */
                .idnp-section { text-align: center; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 1px solid #f1f5f9; }
                .idnp-section label { display: block; font-weight: 700; font-size: 0.95rem; margin-bottom: 10px; color: #475569; }
                .input-idnp { 
                    width: 100%; max-width: 450px; text-align: center; font-size: 1.5rem; letter-spacing: 0.15em; 
                    font-family: 'Roboto Mono', monospace; padding: 15px; border: 2px solid #cbd5e1; border-radius: 10px; 
                    transition: border-color 0.2s; background: #f8fafc;
                }
                .input-idnp:focus { border-color: #2563eb; outline: none; background: #fff; }
                .input-hint { font-size: 0.75rem; color: #94a3b8; margin-top: 8px; }

                /* Grid Layout */
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .f-group { display: flex; flex-direction: column; gap: 8px; }
                .f-group label { font-weight: 700; font-size: 0.85rem; color: #475569; }
                .f-group input { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem; transition: 0.2s; }
                .f-group input:focus { border-color: #2563eb; outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

                /* Footer Actions */
                .form-actions-footer { display: flex; justify-content: center; gap: 15px; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 30px; }
                .btn-primary { background: #2563eb; color: white; border: none; padding: 14px 30px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
                .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }
                .btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 14px 25px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
                .btn-ghost:hover { background: #f1f5f9; color: #1e293b; }

                .form-message { margin-top: 20px; text-align: center; font-weight: 600; font-size: 0.95rem; }
                .form-message.error { color: #dc2626; }
                .form-message.success { color: #16a34a; }

                @media (max-width: 600px) {
                    .form-grid { grid-template-columns: 1fr; }
                    .form-actions-footer { flex-direction: column-reverse; }
                    .btn-primary, .btn-ghost { width: 100%; justify-content: center; }
                }
            </style>
        `;
    }

    async function handleAddSubmit(e, form, container) {
        e.preventDefault();
        const msgEl = container.querySelector("#addMessage");
        const submitBtn = form.querySelector('button[type="submit"]');

        msgEl.textContent = "";
        
        // Formatare dată nasterii (YYYY-MM-DD -> DD.MM.YYYY)
        const rawDate = form.data_nasterii_raw.value;
        if (!rawDate) {
            msgEl.textContent = "Data nașterii este obligatorie.";
            msgEl.className = "form-message error";
            return;
        }
        const [y, m, d] = rawDate.split('-');
        const formattedDate = `${d}.${m}.${y}`;

        const payload = {
            idnp: form.idnp.value.trim(),
            nume: form.nume.value.trim().toUpperCase(),
            prenume: form.prenume.value.trim().toUpperCase(),
            patronimic: form.patronimic.value.trim().toUpperCase() || "-",
            data_nasterii: formattedDate
        };

        submitBtn.disabled = true;
        msgEl.textContent = "Se salvează datele în sistem...";
        msgEl.className = "form-message";

        try {
            const resp = await api.post("/detinuti/add", payload);
            if (resp.success) {
                msgEl.textContent = "Deținutul a fost înregistrat cu succes!";
                msgEl.className = "form-message success";
                
                if (confirm("Deținut adăugat! Doriți să accesați dosarul complet acum?")) {
                    window.location.href = `/app/index.html?module=detinut&id=${resp.id}`;
                } else {
                    form.reset();
                }
            } else {
                throw new Error(resp.error || "Eroare la salvare.");
            }
        } catch (err) {
            msgEl.textContent = "Eroare: " + err.message;
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
            if (form) {
                form.addEventListener('submit', (e) => handleAddSubmit(e, form, container));
            }
        }
    };
})();