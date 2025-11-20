// src/modulesConfig.js

/**
 * minPermission:
 *  - "R" => needs at least read (DREPT = 'R' or 'W')
 *  - "W" => needs write (DREPT = 'W')
 *
 * oracleModuleId:
 *  - numeric ID from SPR_MODULES.ID (you can adjust later)
 *  - null => only role-based access, no SPR_ACCESS check
 *
 * requiredRoles:
 *  - null or [] => any role
 *  - [7]        => only role 7, etc.
 */

const modules = [
  {
    key: "cautare",
    label: "Căutare",
    path: "/app/index.html?module=cautare",
    oracleModuleId: null,       // TODO: set actual ID from SPR_MODULES
    requiredRoles: null,     // everyone with access in SPR_ACCESS
    minPermission: null
  },
  {
    key: "profil",
    label: "Profil utilizator",
    path: "/app/index.html?module=profil",
    oracleModuleId: null,       // TODO: set actual ID from SPR_MODULES
    requiredRoles: null,
    minPermission: null
  },
  {
    key: "admin",
    label: "Pagina admin",
    path: "/app/index.html?module=admin",
    oracleModuleId: null,    // keep it purely role-based for now
    requiredRoles: [7],      // only users with ID_ROLE = 7 see this
    minPermission: "W"
  }
];

module.exports = modules;
