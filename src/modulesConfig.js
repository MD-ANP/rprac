// src/modulesConfig.js

const modules = [
  // --- VISIBLE IN NAV ---
  {
    key: "cautare",
    label: "Căutare",
    path: "/app/index.html?module=cautare",
    visible: true,
    oracleModuleId: null
  },
  {
    key: "adaugaDetinut", // <--- NEW MODULE
    label: "Adaugă Deținut",
    path: "/app/index.html?module=adaugaDetinut",
    visible: true,
    oracleModuleId: null, 
    requiredRoles: [1, 7, 99] // Only these roles will see it
  },
  {
    key: "interogari",
    label: "Rapoarte & Interogări",
    path: "/app/index.html?module=interogari",
    visible: true,
    oracleModuleId: null, 
    requiredRoles: [7] // Only Role 7 sees this top-level item
  },
  {
    key: "profil",
    label: "Profil utilizator",
    path: "/app/index.html?module=profil",
    visible: true,
    oracleModuleId: null
  },
  {
    key: "admin",
    label: "Pagina admin",
    path: "/app/index.html?module=admin",
    visible: true,
    oracleModuleId: null,
    requiredRoles: [7]
  },

  // --- HIDDEN (PROFILE / SUB-MODULES) ---
  {
    key: "detinut",
    label: "Dosar Deținut",
    path: null,
    visible: false, 
    // IMPORTANT: Ensure no specific role is required to VIEW the base module.
    // The specific 'Edit' permissions are handled inside the module routes.
    oracleModuleId: null,
    requiredRoles: [] 
  },
  // Medical Modules (Permission Check Only)
  { key: "med_greva",   label: "Greva Foamei", visible: false, oracleModuleId: 7,  minPermission: "R" },
  { key: "med_diag",    label: "Diagnoza",     visible: false, oracleModuleId: 8,  minPermission: "R" },
  { key: "med_radio",   label: "Radiografie",  visible: false, oracleModuleId: 10, minPermission: "R" },
  { key: "med_consult", label: "Consultare",   visible: false, oracleModuleId: 11, minPermission: "R" }
];

module.exports = modules;