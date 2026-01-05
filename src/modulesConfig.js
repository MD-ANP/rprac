/**
 * Configurația centralizată a modulelor sistemului rprac.
 * * Proprietăți:
 * - key: Identificator unic folosit în frontend.
 * - label: Numele afișat în interfață.
 * - path: Ruta către fișierul HTML (null dacă nu are pagină proprie).
 * - visible: Dacă apare în meniul principal de navigare.
 * - oracleModuleId: ID-ul corespunzător din tabelul SPR_MODULES (null dacă nu are restricție DB).
 * - requiredRoles: Array de ID-uri de roluri care au acces (ex: 7 pentru Admin).
 * - minPermission: Nivelul minim de acces cerut ('R' - Citire, 'W' - Scriere).
 */

// 1. Module vizibile în meniul principal de navigare
const navigationModules = [
  {
    key: "cautare",
    label: "Căutare",
    path: "/app/index.html?module=cautare",
    visible: true,
    oracleModuleId: null
  },
  {
    key: "adaugaDetinut",
    label: "Adaugă Deținut",
    path: "/app/index.html?module=adaugaDetinut",
    visible: true,
    oracleModuleId: null,
    requiredRoles: [1, 7, 99]
  },
  {
    key: "comasare",
    label: "Comasare",
    path: "/app/index.html?module=comasare",
    visible: true,
    oracleModuleId: null,
    requiredRoles: [7, 99]
  },
  {
    key: "interogari",
    label: "Rapoarte & Interogări",
    path: "/app/index.html?module=interogari",
    visible: true,
    oracleModuleId: null,
    requiredRoles: [7, 99]
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
  }
];

// 2. Module de bază (Nucleu) - Accesibile dar ascunse din navigația principală
const coreModules = [
  {
    key: "detinut",
    label: "Dosar Deținut",
    path: null,
    visible: false,
    oracleModuleId: null,
    requiredRoles: []
  }
];

// Exportăm toate modulele într-un singur array plat
module.exports = [
  ...navigationModules,
  ...coreModules,
];