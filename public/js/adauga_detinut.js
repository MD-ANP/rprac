(function() {
    window.prisonModules = window.prisonModules || {};

    window.prisonModules.adaugaDetinut = {
        init: async function({ container }) {
            // Using inline styles to ensure layout ignores potential external CSS conflicts
            container.innerHTML = `
                <div class="admin-page" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <header class="admin-header-main" style="text-align: center; margin-bottom: 30px; width: 100%;">
                        <h1 class="admin-title">Adaugă Deținut Nou</h1>
                        <p class="app-subtitle">Înregistrare primară în baza de date.</p>
                    </header>
                    
                    <div class="admin-panel" style="max-width: 800px; width: 100%; padding: 40px; box-sizing: border-box;">
                        <form id="addDetinutForm" autocomplete="off">
                            
                            <div class="form-group mb-4" style="text-align: center; margin-bottom: 2rem;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 700; color: #374151;">IDNP</label>
                                <input type="text" name="idnp" maxlength="13" 
                                       placeholder="xxxxxxxxxxxxx" 
                                       style="width: 100%; max-width: 400px; text-align: center; font-size: 1.2rem; letter-spacing: 0.15em; font-family: monospace; padding: 12px; margin: 0 auto; display: block; box-sizing: border-box;"
                                       required>
                            </div>

                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                <div style="display: flex; flex-direction: column; text-align: center;">
                                    <label style="margin-bottom: 8px; font-weight: 600; color: #374151;">Nume (Familia)</label>
                                    <input type="text" name="nume" 
                                           style="width: 100%; text-align: center; padding: 10px; box-sizing: border-box;" 
                                           required>
                                </div>
                                <div style="display: flex; flex-direction: column; text-align: center;">
                                    <label style="margin-bottom: 8px; font-weight: 600; color: #374151;">Prenume</label>
                                    <input type="text" name="prenume" 
                                           style="width: 100%; text-align: center; padding: 10px; box-sizing: border-box;" 
                                           required>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                <div style="display: flex; flex-direction: column; text-align: center;">
                                    <label style="margin-bottom: 8px; font-weight: 600; color: #374151;">Patronimic</label>
                                    <input type="text" name="patronimic" placeholder="-"
                                           style="width: 100%; text-align: center; padding: 10px; box-sizing: border-box;">
                                </div>
                                <div style="display: flex; flex-direction: column; text-align: center;">
                                    <label style="margin-bottom: 8px; font-weight: 600; color: #374151;">Data Nașterii</label>
                                    <input type="date" name="data_nasterii_raw" 
                                           style="width: 100%; text-align: center; padding: 10px; box-sizing: border-box;" 
                                           required>
                                </div>
                            </div>

                            <div class="form-actions mt-6" style="display: flex; justify-content: center; gap: 16px; margin-top: 40px;">
                                <button type="button" class="btn-ghost" onclick="window.history.back()" style="min-width: 120px;">Anulează</button>
                                <button type="submit" class="btn-primary" style="min-width: 200px; justify-content: center;">💾 Salvează Deținut</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            const form = document.getElementById('addDetinutForm');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const rawDate = form.data_nasterii_raw.value;
                if(!rawDate) { alert("Data nașterii este obligatorie"); return; }
                const [y, m, d] = rawDate.split('-');
                const formattedDate = `${d}.${m}.${y}`;

                const payload = {
                    idnp: form.idnp.value.trim(),
                    nume: form.nume.value.trim().toUpperCase(),
                    prenume: form.prenume.value.trim().toUpperCase(),
                    patronimic: form.patronimic.value.trim().toUpperCase(),
                    data_nasterii: formattedDate
                };

                try {
                    const resp = await window.prisonApi.post("/detinuti/add", payload);
                    if(resp.success) {
                        if(confirm("Deținut adăugat cu succes! Mergem la dosarul lui?")) {
                            window.location.hash = `#detinut?id=${resp.id}`;
                        } else {
                            form.reset();
                        }
                    } else {
                        alert("Eroare: " + resp.error);
                    }
                } catch(err) {
                    alert("Eroare de conexiune.");
                    console.error(err);
                }
            });
        }
    };
})();