// src/modulesConfig.js

const modules = [
  {
    key: "cautare",
    label: "Căutare",
    path: "/app/index.html?module=cautare",
    oracleModuleId: null,
    requiredRoles: null,
    minPermission: null
  },
  {
    key: "interogari",
    label: "Rapoarte & Interogări",
    path: "/app/index.html?module=interogari",
    oracleModuleId: null, 
    requiredRoles: [7],
    minPermission: null
  },
  {
    key: "profil",
    label: "Profil utilizator",
    path: "/app/index.html?module=profil",
    oracleModuleId: null,
    requiredRoles: null,
    minPermission: null
  },
  {
    key: "admin",
    label: "Pagina admin",
    path: "/app/index.html?module=admin",
    oracleModuleId: null,
    requiredRoles: [7],
    minPermission: "W"
  }
];

module.exports = modules;