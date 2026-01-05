(function () {
    const api = window.prisonApi;

    const escapeHtml = (s) => String(s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    const formatDate = (v) => v ? new Date(v).toLocaleString("ro-RO") : "N/A";
    function renderProfile(container, data) {
        const { user, logs, permissions } = data;

        container.innerHTML = `
            <div class="profile-container-modern">
                <div class="profile-card top-info-bar">
                    <div class="info-main">
                        <div class="user-avatar">👤</div>
                        <div class="user-meta">
                            <h1>${escapeHtml(user.username)} <small>(ID: ${user.id})</small></h1>
                            <div class="meta-row">
                                <span><strong>Rol:</strong> ${user.role || 'N/A'}</span>
                                <span><strong>Penitenciar:</strong> ${user.prison || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="info-actions">
                        ${user.hasProof ? 
                            `<a href="/api/profile/proof?userId=${user.id}" target="_blank" class="btn-proof">📄 Vizualizează document acces</a>` : 
                            `<span class="badge-missing">⚠️ Document nesemnat</span>`}
                    </div>
                </div>

                <div class="profile-card">
                    <h3 class="card-label">🔐 Drepturi și Permisiuni Module</h3>
                    <div class="table-responsive">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Nume Modul</th>
                                    <th style="text-align:center">Nivel Acces</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${permissions.map(p => `
                                    <tr>
                                        <td><strong>${escapeHtml(p.NAME)}</strong></td>
                                        <td style="text-align:center">
                                            <span class="p-badge b-${(p.DREPT||'N').toLowerCase()}">
                                                ${p.DREPT === 'W' ? 'Scriere (W)' : (p.DREPT === 'R' ? 'Citire (R)' : 'Fără Acces')}
                                            </span>
                                        </td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="profile-card">
                    <h3 class="card-label">🕒 Activitate Recentă (Ultimele 15 acțiuni)</h3>
                    <div class="table-responsive">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Acțiune</th>
                                    <th>Data și Ora</th>
                                    <th>Detalii</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${logs.map(l => `
                                    <tr>
                                        <td class="action-cell">${escapeHtml(l.ACTION)}</td>
                                        <td class="date-cell">${formatDate(l.E_DATE)}</td>
                                        <td class="text-muted">${escapeHtml(l.DETINUT || '—')}</td>
                                    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center">Nu există activitate recentă.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>
                .profile-container-modern { max-width: 1000px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; }
                
                .profile-card { 
                    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; 
                    padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
                }

                /* Header bar styling */
                .top-info-bar { display: flex; justify-content: space-between; align-items: center; background: #fff; }
                .info-main { display: flex; align-items: center; gap: 20px; }
                .user-avatar { font-size: 40px; background: #f1f5f9; padding: 15px; border-radius: 50%; }
                .user-meta h1 { margin: 0; font-size: 1.5rem; color: #0f172a; }
                .user-meta h1 small { font-weight: normal; color: #64748b; font-size: 1rem; }
                .meta-row { display: flex; gap: 20px; margin-top: 5px; color: #475569; font-size: 0.9rem; }

                .card-label { margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }

                /* Button & Badges */
                .btn-proof { background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; transition: 0.2s; }
                .btn-proof:hover { background: #1d4ed8; }
                .badge-missing { color: #dc2626; font-weight: 600; font-size: 0.9rem; padding: 8px 16px; background: #fef2f2; border-radius: 8px; }

                .p-badge { padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; }
                .b-w { background: #dcfce7; color: #166534; }
                .b-r { background: #e0f2fe; color: #075985; }
                .b-n { background: #f1f5f9; color: #475569; }

                /* Table Styling */
                .modern-table { width: 100%; border-collapse: collapse; }
                .modern-table th { text-align: left; padding: 12px; background: #f8fafc; color: #64748b; font-size: 0.8rem; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
                .modern-table td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; }
                
                .action-cell { font-weight: 600; color: #2563eb; }
                .date-cell { color: #64748b; font-size: 0.85rem; }
                .text-muted { color: #94a3b8; }

                @media (max-width: 768px) {
                    .top-info-bar { flex-direction: column; text-align: center; gap: 20px; }
                    .info-main { flex-direction: column; }
                }
            </style>
        `;
    }

    window.prisonModules = window.prisonModules || {};
    window.prisonModules.profil = {
        async init({ userId, container }) {
            try {
                const data = await api.get(`/profile?userId=${userId}`);
                if (data.success) {
                    renderProfile(container, data);
                } else {
                    throw new Error(data.error || "Eroare la încărcare.");
                }
            } catch (err) {
                container.innerHTML = `<div style="padding:50px; text-align:center; color:red;">${err.message}</div>`;
            }
        }
    };
})();