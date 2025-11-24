// public/js/detinut-generale.js
(function() {
    window.DetinutTabs = window.DetinutTabs || {};

    let meta = null;
    let currentData = null;

    async function fetchMeta() {
        if(meta) return;
        const res = await window.prisonApi.get('/detinut/meta/general');
        if(res.success) meta = res;
    }

    function renderField(label, value, isEdit, name, type='text', options=[]) {
        if (!isEdit) {
            return `<div class="detail-row"><span class="detail-label">${label}:</span> <span class="detail-value">${value || '-'}</span></div>`;
        }
        if (type === 'select') {
            const opts = options.map(o => `<option value="${o.ID}" ${String(o.ID) === String(value) ? 'selected' : ''}>${o.NAME}</option>`).join('');
            return `<div class="f"><label>${label}</label><select name="${name}" class="full-width">${opts}</select></div>`;
        }
        return `<div class="f"><label>${label}</label><input type="${type}" name="${name}" value="${value||''}" class="full-width"></div>`;
    }

    // --- PHOTO GALLERY ---
    function renderGallery(container, images, canEdit, detId) {
        const grid = document.createElement('div');
        grid.className = 'gallery-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        grid.style.gap = '10px';
        grid.style.marginTop = '15px';

        images.forEach(img => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.style.border = '1px solid #ddd';
            card.style.borderRadius = '8px';
            card.style.overflow = 'hidden';
            card.style.position = 'relative';

            const label = img.type == 1 ? 'Frontal' : (img.type == 2 ? 'Lateral' : 'Altul');
            const badgeColor = img.type == 1 ? '#2563eb' : '#64748b';

            card.innerHTML = `
                <img src="${img.url}" style="width:100%; height:140px; object-fit:cover; display:block;">
                <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 4px; text-align:center;">${label}</span>
                ${canEdit ? `<button class="btn-del-photo" data-id="${img.id}" style="position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:4px; cursor:pointer;">&times;</button>` : ''}
            `;
            grid.appendChild(card);
        });

        if(canEdit) {
            const uploadBox = document.createElement('div');
            uploadBox.style.border = '2px dashed #ccc';
            uploadBox.style.borderRadius = '8px';
            uploadBox.style.display = 'flex';
            uploadBox.style.alignItems = 'center';
            uploadBox.style.justifyContent = 'center';
            uploadBox.style.cursor = 'pointer';
            uploadBox.style.minHeight = '140px';
            uploadBox.innerHTML = `<div style="text-align:center; color:#888;">Is + <br>Adaugă Foto</div>`;
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            
            uploadBox.onclick = () => {
                const type = prompt("Tip fotografie: 1=Frontal, 2=Lateral, 3=Altul", "1");
                if(['1','2','3'].includes(type)) {
                    fileInput.dataset.type = type;
                    fileInput.click();
                }
            };

            fileInput.onchange = async () => {
                if(!fileInput.files.length) return;
                const fd = new FormData();
                fd.append('image', fileInput.files[0]);
                fd.append('type', fileInput.dataset.type);
                
                uploadBox.innerHTML = 'Se încarcă...';
                try {
                    await window.prisonApi.post(`/detinut/${detId}/photos`, fd); // Note: custom handling for FormData needed or use standard fetch
                    // Since api.js wrapper uses JSON, we use raw fetch here for FormData
                    await fetch(`/api/detinut/${detId}/photos`, {
                        method: 'POST',
                        headers: { "x-user-id": sessionStorage.getItem("prison.userId") },
                        body: fd
                    });
                    // Refresh tab
                    document.querySelector('.tab-btn[data-tab="generale"]').click();
                } catch(e) {
                    alert("Eroare upload: " + e.message);
                    uploadBox.innerHTML = 'Eroare';
                }
            };

            grid.appendChild(uploadBox);
            
            // Delete Logic
            grid.addEventListener('click', async (e) => {
                if(e.target.classList.contains('btn-del-photo')) {
                    if(!confirm("Ștergeți fotografia?")) return;
                    const pid = e.target.dataset.id;
                    await window.prisonApi.del(`/detinut/${detId}/photos/${pid}`); // Assuming api.del exists or use raw fetch
                     document.querySelector('.tab-btn[data-tab="generale"]').click();
                }
            });
        }

        container.appendChild(grid);
    }


    window.DetinutTabs['generale'] = {
        render: async (container, detinutId) => {
            container.innerHTML = '<div class="loader-box">Se încarcă profilul complet...</div>';
            
            try {
                await fetchMeta();
                const res = await window.prisonApi.get(`/detinut/${detinutId}/general_full`);
                if(!res.success) throw new Error(res.error);
                
                const { detinut, canEdit, images, address } = res;
                currentData = detinut; // Store for form usage

                // Update Main Header Avatar with the front photo if available
                const frontImg = images.find(i => i.type == 1);
                if(frontImg) {
                    const avatarEl = document.querySelector('.hero-avatar');
                    if(avatarEl) avatarEl.innerHTML = `<img src="${frontImg.url}" style="width:90px; height:90px; border-radius:12px; object-fit:cover; border:2px solid #fff;">`;
                }

                container.innerHTML = `
                  <div class="module-container">
                     <div class="module-content" style="grid-column: 1 / -1;">
                        
                        <div class="admin-grid-2">
                            <div class="card-action">
                                <div class="flex-between">
                                    <h3>Date Personale</h3>
                                    ${canEdit ? '<button id="btnEditMain" class="btn-small">✏️ Editează</button>' : ''}
                                </div>
                                <div id="viewMain" class="profile-details">
                                    ${renderField('Nume', detinut.SURNAME)}
                                    ${renderField('Prenume', detinut.NAME)}
                                    ${renderField('Patronimic', detinut.SEC_NAME)}
                                    ${renderField('IDNP', detinut.IDNP)}
                                    ${renderField('Data Nașterii', detinut.BIRDTH_STR)}
                                    ${renderField('Sex', detinut.SEX)}
                                </div>
                                <form id="formMain" class="hidden admin-form">
                                    ${renderField('Nume', detinut.SURNAME, true, 'surname')}
                                    ${renderField('Prenume', detinut.NAME, true, 'name')}
                                    ${renderField('Patronimic', detinut.SEC_NAME, true, 'sec_name')}
                                    ${renderField('IDNP', detinut.IDNP, true, 'idnp')}
                                    ${renderField('Data Nașterii', detinut.BIRDTH_STR, true, 'birth')}
                                    <div class="f"><label>Sex</label><select name="sex" class="full-width"><option value="M">M</option><option value="F">F</option></select></div>
                                    <div class="search-actions">
                                        <button type="button" class="btn-ghost" onclick="cancelEdit('Main')">Anulează</button>
                                        <button type="submit" class="btn-primary">Salvează</button>
                                    </div>
                                </form>
                            </div>

                            <div class="card-action">
                                <h3>Galerie Foto</h3>
                                <div id="galleryContainer"></div>
                            </div>
                        </div>

                        <div class="admin-grid-2 mt-4">
                             <div class="card-action">
                                <h3>Alte Detalii</h3>
                                <div class="profile-details">
                                    <div class="detail-row"><span class="detail-label">Religie:</span> 
                                        <span class="detail-value">${detinut.RELIGION_NAME || '-'}</span>
                                        ${canEdit ? '<button class="btn-small" style="float:right" id="btnEditRel">✏️</button>' : ''}
                                    </div>
                                    <div class="detail-row"><span class="detail-label">Statut Curent:</span> <span class="badge badge-status">${detinut.STATUT_NAME || 'Indefinit'}</span></div>
                                </div>
                                <div id="editRelBox" class="hidden mt-2">
                                     <select id="selReligion" class="full-width mb-2">${meta.religion.map(r=>`<option value="${r.ID}">${r.NAME}</option>`).join('')}</select>
                                     <button onclick="saveReligion(${detinut.ID})" class="btn-primary btn-small">Ok</button>
                                </div>
                             </div>

                             <div class="card-action">
                                <h3>Domiciliu</h3>
                                <p>${address ? `${address.CITY}, ${address.ADDRESS}` : 'Nu există date.'}</p>
                             </div>
                        </div>

                     </div>
                  </div>
                `;

                // Init Gallery
                renderGallery(document.getElementById('galleryContainer'), images, canEdit, detinut.ID);

                // Event Bindings
                if(canEdit) {
                    document.getElementById('btnEditMain').onclick = () => {
                        document.getElementById('viewMain').classList.add('hidden');
                        document.getElementById('formMain').classList.remove('hidden');
                        document.getElementById('btnEditMain').classList.add('hidden');
                    };
                    window.cancelEdit = (section) => {
                        document.getElementById(`viewMain`).classList.remove('hidden');
                        document.getElementById(`formMain`).classList.add('hidden');
                        document.getElementById(`btnEditMain`).classList.remove('hidden');
                    };
                    document.getElementById('formMain').onsubmit = async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        const payload = Object.fromEntries(fd.entries());
                        try {
                            await window.prisonApi.post(`/detinut/${detinut.ID}/update_main`, payload);
                            // Refresh
                            window.DetinutTabs['generale'].render(container, detinutId);
                        } catch(err) { alert(err.message); }
                    };

                    document.getElementById('btnEditRel').onclick = () => document.getElementById('editRelBox').classList.toggle('hidden');
                    window.saveReligion = async (id) => {
                         const rid = document.getElementById('selReligion').value;
                         await window.prisonApi.post(`/detinut/${id}/update_religion`, {religionId: rid});
                         window.DetinutTabs['generale'].render(container, detinutId);
                    };
                }

            } catch(e) {
                container.innerHTML = `<div class="error-box">${e.message}</div>`;
            }
        }
    };
})();