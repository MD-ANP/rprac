(function () {
  window.DetinutTabs = window.DetinutTabs || {};

  // --- STATE ---
  let meta = {};
  let currentIdnp = null;
  let canWrite = false;
  let currentList = [];

  // --- COLOR MAP FOR MOVEMENT TYPES (fallbacks if unknown IDs) ---
  const TYPE_COLOR_MAP = {
    "1": "#22c55e", // e.g. transfer / admission
    "2": "#ef4444", // e.g. escort / police
    "3": "#eab308", // e.g. court
    "4": "#0ea5e9",
    "5": "#8b5cf6",
    default: "#3b82f6"
  };

  // --- STYLES ---
  const STYLES = `
  <style>
    :root {
      --m-primary: #2563eb;
      --m-primary-soft: #eff6ff;
      --m-primary-dark: #1d4ed8;
      --m-bg: #f3f4f6;
      --m-surface: #ffffff;
      --m-border: #e5e7eb;
      --m-border-strong: #d4d4d8;
      --m-text-main: #111827;
      --m-text-sub: #6b7280;
      --m-text-soft: #9ca3af;
      --m-danger: #ef4444;
      --m-danger-soft: #fee2e2;
      --m-success: #22c55e;
      --m-warning: #eab308;
      --m-radius-lg: 18px;
      --m-radius-md: 12px;
      --m-radius-sm: 8px;
      --m-shadow-soft: 0 18px 40px rgba(15, 23, 42, 0.06);
      --m-shadow-chip: 0 1px 3px rgba(15, 23, 42, 0.1);
      --m-chip-bg: #f9fafb;
    }

    .miscari-root {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      padding: 24px 26px 32px;
      background: radial-gradient(circle at top left, #e0f2fe 0, transparent 45%),
                  radial-gradient(circle at bottom right, #fee2e2 0, transparent 45%),
                  var(--m-bg);
      color: var(--m-text-main);
    }

    /* STACKED LAYOUT (VERTICAL) */
    .miscari-layout {
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: stretch;
    }

    /* --- HEADER BAR --- */
    .miscari-header {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .miscari-title-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .miscari-title {
      font-size: 1.3rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--m-text-main);
    }
    .miscari-title span.emoji {
      font-size: 1.5rem;
    }
    .miscari-subtitle {
      font-size: 0.85rem;
      color: var(--m-text-sub);
    }
    .miscari-pills {
      margin-left: auto;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .miscari-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--m-chip-bg);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 0.75rem;
      color: var(--m-text-sub);
      box-shadow: var(--m-shadow-chip);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .miscari-pill span.icon {
      font-size: 0.9rem;
    }

    /* --- CARDS --- */
    .miscari-card {
      background: var(--m-surface);
      border-radius: var(--m-radius-lg);
      border: 1px solid rgba(148, 163, 184, 0.4);
      box-shadow: var(--m-shadow-soft);
      padding: 18px 20px 20px;
      position: relative;
      overflow: hidden;
    }
    .miscari-card::before {
      content: "";
      position: absolute;
      inset: -60%;
      opacity: 0.07;
      background: radial-gradient(circle at top left, #bfdbfe 0, transparent 50%),
                  radial-gradient(circle at bottom right, #fecaca 0, transparent 55%);
      pointer-events: none;
    }
    .miscari-card-inner {
      position: relative;
      z-index: 1;
    }

    .miscari-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .miscari-card-header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .miscari-card-title {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--m-text-main);
    }
    .miscari-card-subtitle {
      font-size: 0.8rem;
      color: var(--m-text-sub);
    }

    /* --- BUTTONS --- */
    .btn-ghost-pill {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      background: rgba(248, 250, 252, 0.85);
      color: var(--m-text-main);
      font-size: 0.8rem;
      padding: 7px 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.10);
      transition: background 0.15s, transform 0.15s, box-shadow 0.15s, border-color 0.15s;
      backdrop-filter: blur(4px);
    }
    .btn-ghost-pill:hover {
      background: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
      border-color: var(--m-primary);
    }

    .btn-primary {
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, var(--m-primary), var(--m-primary-dark));
      color: #ffffff;
      font-size: 0.82rem;
      padding: 8px 16px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
      font-weight: 600;
      letter-spacing: 0.02em;
      box-shadow: 0 12px 25px rgba(37, 99, 235, 0.35);
      transition: transform 0.12s ease-out, box-shadow 0.12s ease-out, filter 0.12s;
    }
    .btn-primary:hover {
      transform: translateY(-1px) translateZ(0);
      box-shadow: 0 18px 30px rgba(37, 99, 235, 0.4);
      filter: brightness(1.03);
    }
    .btn-primary:active {
      transform: translateY(0);
      box-shadow: 0 8px 16px rgba(37, 99, 235, 0.28);
    }

    .btn-icon {
      border-radius: 999px;
      border: 1px solid var(--m-border);
      background: rgba(255, 255, 255, 0.9);
      color: var(--m-text-main);
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.15s, transform 0.12s, box-shadow 0.12s, border-color 0.12s;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
      backdrop-filter: blur(3px);
    }
    .btn-icon:hover {
      background: #f9fafb;
      transform: translateY(-1px);
      border-color: var(--m-primary);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
    }

    .btn-compact {
      border-radius: 999px;
      border: 1px solid var(--m-border);
      background: #ffffff;
      padding: 5px 8px;
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: var(--m-text-sub);
      transition: background 0.12s, transform 0.12s, border-color 0.12s, color 0.12s;
    }
    .btn-compact:hover {
      background: var(--m-primary-soft);
      border-color: var(--m-primary);
      color: var(--m-primary-dark);
      transform: translateY(-1px);
    }
    .btn-compact-danger {
      border-color: rgba(248, 113, 113, 0.45);
      color: #b91c1c;
      background: #fef2f2;
    }
    .btn-compact-danger:hover {
      background: #fee2e2;
      border-color: #ef4444;
      color: #991b1b;
    }

    /* --- LOADER --- */
    .miscari-loader-wrap {
      padding: 60px 20px;
      text-align: center;
      color: var(--m-text-sub);
    }
    .miscari-loader {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 3px solid #d1d5db;
      border-top-color: var(--m-primary);
      margin: 0 auto 14px;
      animation: miscari-spin 0.9s linear infinite;
    }
    @keyframes miscari-spin {
      to { transform: rotate(360deg); }
    }

    /* --- TRANSIT MAP --- */
        /* --- TRANSIT MAP --- */
    .miscari-map-shell {
      position: relative;
      border-radius: 16px;
      background: linear-gradient(180deg, #f9fafb, #f3f4f6);
      border: 1px solid rgba(148, 163, 184, 0.45);
      padding: 18px 18px 14px;
      overflow-x: auto;
    }
    .miscari-map-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .miscari-map-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--m-text-sub);
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
      margin-right: 4px;
    }
    .miscari-map-meta {
      font-size: 0.8rem;
      color: var(--m-text-soft);
    }

    /* BIGGER MAP CANVAS */
    svg.miscari-map-svg {
      width: 100%;
      height: 580px;           /* ~40% taller than before */
      display: block;
    }

    .m-line {
      fill: none;
      stroke-width: 10;        /* thicker tracks */
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.95;
    }

    .m-line-active {
      stroke-dasharray: 10 6;
      animation: dash-move 18s linear infinite;
    }
    @keyframes dash-move {
      to { stroke-dashoffset: -420; }
    }

    .m-station {
      cursor: pointer;
      transform-origin: center center;
      transition: transform 0.1s;
    }

    /* wobble / jump on hover */
    .m-station:hover {
      animation: station-wobble 0.45s ease-out;
    }
    @keyframes station-wobble {
      0%   { transform: translateY(0) scale(1); }
      30%  { transform: translateY(-12px) scale(1.12) rotate(-1.5deg); }
      60%  { transform: translateY(-7px)  scale(1.06) rotate(1.5deg); }
      100% { transform: translateY(0) scale(1); }
    }

    .m-station-core {
      stroke-width: 3;
    }
    .m-station-outline {
      fill: #ffffff;
    }

    .m-current-glow {
      filter: drop-shadow(0 0 14px rgba(34, 197, 94, 0.9));
    }

    /* bigger, more readable labels */
    .m-station-date {
      font-size: 13px;
      font-weight: 600;
      fill: #4b5563;
    }
    .m-station-label {
      font-size: 14px;
      font-weight: 700;
      fill: #111827;
    }
    .m-station-chip {
      font-size: 12px;
      font-weight: 600;
      fill: #4b5563;
    }


    /* --- TABLE --- */
    .miscari-table-wrap {
      border-radius: var(--m-radius-lg);
      border: 1px solid var(--m-border-strong);
      background: rgba(255,255,255,0.96);
      overflow: hidden;
    }

    .miscari-table-header-row {
      display: grid;
      grid-template-columns: 40px 120px 1.6fr 1.1fr 1.1fr 1.2fr 150px;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: linear-gradient(90deg, #f9fafb, #eef2ff);
      color: #6b7280;
      padding: 10px 14px;
      border-bottom: 1px solid var(--m-border-strong);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .miscari-table-body {
      max-height: 520px;
      overflow-y: auto;
    }

    .miscari-row {
      display: grid;
      grid-template-columns: 40px 120px 1.6fr 1.1fr 1.1fr 1.2fr 150px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--m-border);
      font-size: 0.83rem;
      align-items: center;
      background: #ffffff;
      transition: background 0.12s, box-shadow 0.12s, transform 0.12s;
    }
    .miscari-row:hover {
      background: #f9fafb;
      box-shadow: 0 8px 18px rgba(15,23,42,0.06);
      transform: translateY(-1px);
    }

    .miscari-row-main {
      font-weight: 600;
      color: var(--m-text-main);
    }
    .miscari-row-sub {
      font-size: 0.75rem;
      color: var(--m-text-sub);
      margin-top: 2px;
    }

    .miscari-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid transparent;
      background: #f3f4f6;
      color: #4b5563;
    }
    .miscari-badge-pen {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .miscari-badge-court {
      background: #f3e8ff;
      color: #7c3aed;
      border-color: #e9d5ff;
    }
    .miscari-badge-pol {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .miscari-doc-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 0.73rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      color: #4b5563;
      margin: 1px 3px 1px 0;
    }
    .miscari-doc-chip span.icon {
      font-size: 0.85rem;
    }

    /* Expand */
    .btn-expand-round {
      border-radius: 999px;
      border: 1px solid #d4d4d8;
      background: #ffffff;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.12s, background 0.12s, border-color 0.12s;
    }
    .btn-expand-round:hover {
      background: #eef2ff;
      border-color: var(--m-primary);
      transform: translateY(-1px);
    }
    .btn-expand-round.rotated {
      transform: rotate(90deg);
      background: #e0f2fe;
      border-color: var(--m-primary);
    }

    .miscari-nested {
      display: none;
      background: #f9fafb;
      border-left: 3px solid var(--m-primary);
      border-bottom: 1px solid var(--m-border);
      padding: 12px 20px 16px;
      animation: slideDownNested 0.18s ease-out;
      font-size: 0.8rem;
    }
    .miscari-nested.open {
      display: block;
    }

    @keyframes slideDownNested {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .miscari-nested-section-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4b5563;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .miscari-nested-section-title span.icon {
      font-size: 0.95rem;
    }

    .miscari-cells-table {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .miscari-cells-row {
      display: grid;
      grid-template-columns: 80px 130px 1.2fr 1.2fr 1.2fr 80px;
      padding: 7px 10px;
      border-bottom: 1px solid #e5e7eb;
      align-items: center;
    }
    .miscari-cells-row:last-child {
      border-bottom: none;
    }

    .miscari-up-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 0.76rem;
      border: 1px solid #fecaca;
      background: #fef2f2;
      color: #b91c1c;
      margin: 2px 4px 2px 0;
    }
    .miscari-up-chip button {
      border: none;
      background: transparent;
      cursor: pointer;
      color: #b91c1c;
      font-size: 0.8rem;
      padding: 0;
    }

    /* --- MODALS --- */
    .miscari-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.18s ease-out;
      backdrop-filter: blur(3px);
    }
    .miscari-modal-backdrop.visible {
      opacity: 1;
    }
    .miscari-modal-window {
      background: #ffffff;
      border-radius: 20px;
      width: 96%;
      max-width: 720px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(15, 23, 42, 0.45);
      transform: scale(0.96) translateY(8px);
      transition: transform 0.18s ease-out;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.6);
    }
    .miscari-modal-backdrop.visible .miscari-modal-window {
      transform: scale(1) translateY(0);
    }

    .miscari-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--m-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(90deg, #eff6ff, #f5f3ff);
    }
    .miscari-modal-title {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .miscari-modal-title span.icon {
      font-size: 1.1rem;
    }

    .miscari-modal-body {
      padding: 18px 20px 12px;
      overflow-y: auto;
    }

    .miscari-modal-footer {
      padding: 13px 20px;
      border-top: 1px solid var(--m-border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #f9fafb;
    }

    /* --- FORM --- */
    .miscari-form-grid-2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px 16px;
      margin-bottom: 10px;
    }
    @media (max-width: 700px) {
      .miscari-form-grid-2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .miscari-form-group {
      margin-bottom: 10px;
    }
    .miscari-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .miscari-label span.hint {
      font-size: 0.7rem;
      color: #9ca3af;
      text-transform: none;
      letter-spacing: 0.02em;
    }

    .miscari-input,
    .miscari-select,
    .miscari-textarea {
      width: 100%;
      border-radius: 10px;
      border: 1px solid #d4d4d8;
      padding: 9px 10px;
      font-size: 0.85rem;
      font-family: inherit;
      background: #f9fafb;
      transition: border-color 0.12s, box-shadow 0.12s, background 0.12s;
      box-sizing: border-box;
    }
    .miscari-input:focus,
    .miscari-select:focus,
    .miscari-textarea:focus {
      outline: none;
      border-color: var(--m-primary);
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.45), 0 0 0 4px rgba(191, 219, 254, 0.7);
      background: #ffffff;
    }
    .miscari-textarea {
      resize: vertical;
      min-height: 70px;
    }

    /* --- EMPTY STATES --- */
    .miscari-empty {
      padding: 42px 20px;
      text-align: center;
      color: var(--m-text-sub);
    }
    .miscari-empty-title {
      font-weight: 700;
      margin-bottom: 4px;
      font-size: 0.95rem;
    }

    .miscari-empty-icon {
      font-size: 2rem;
      margin-bottom: 10px;
      opacity: 0.75;
    }
  </style>
  `;

  // --- MODAL HTML (same as before) ---
  const MODALS = `
    <!-- Mișcare -->
    <div class="miscari-modal-backdrop" id="modalMiscare">
      <div class="miscari-modal-window">
        <div class="miscari-modal-header">
          <div class="miscari-modal-title">
            <span class="icon">📍</span>
            <span>Mișcare Detenție</span>
          </div>
          <button type="button" class="btn-icon" data-close-modal="modalMiscare">✕</button>
        </div>
        <div class="miscari-modal-body">
          <form id="formMiscare">
            <input type="hidden" name="id">
            <div class="miscari-form-group">
              <label class="miscari-label">
                <span>Data & Ora Mișcării</span>
                <span class="hint">format: DD.MM.YYYY HH:MM:SS</span>
              </label>
              <input type="text" name="adate" class="miscari-input js-date-time">
            </div>

            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Tip Mișcare</span></label>
                <select name="id_type" class="miscari-select"></select>
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Motiv Legal</span></label>
                <select name="id_motiv" class="miscari-select"></select>
              </div>
            </div>

            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Penitenciar</span></label>
                <select name="id_penitenciar" class="miscari-select"></select>
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Instanță (dacă e cazul)</span></label>
                <select name="id_instante" class="miscari-select"></select>
              </div>
            </div>
          </form>
        </div>
        <div class="miscari-modal-footer">
          <button type="button" class="btn-compact" data-close-modal="modalMiscare">Anulează</button>
          <button type="button" class="btn-primary" id="btnSaveMiscare">
            <span>💾</span><span>Salvează Mișcare</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Document -->
    <div class="miscari-modal-backdrop" id="modalDoc">
      <div class="miscari-modal-window">
        <div class="miscari-modal-header">
          <div class="miscari-modal-title">
            <span class="icon">📄</span>
            <span>Document Juridic</span>
          </div>
          <button type="button" class="btn-icon" data-close-modal="modalDoc">✕</button>
        </div>
        <div class="miscari-modal-body">
          <form id="formDoc">
            <input type="hidden" name="parentId">
            <input type="hidden" name="tipDecizie">
            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Tip Document</span></label>
                <select name="idTipDoc" class="miscari-select"></select>
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Număr Document</span></label>
                <input type="text" name="nrDoc" class="miscari-input">
              </div>
            </div>

            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label">
                  <span>Data Emiterii</span>
                  <span class="hint">DD.MM.YYYY</span>
                </label>
                <input type="text" name="dataDoc" class="miscari-input js-date-only">
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Instanță / Emitent</span></label>
                <select name="idEmitentInst" class="miscari-select"></select>
              </div>
            </div>

            <div class="miscari-form-group">
              <label class="miscari-label"><span>Executor</span></label>
              <input type="text" name="emitent" class="miscari-input">
            </div>
            <div class="miscari-form-group">
              <label class="miscari-label"><span>Temei (Descriere)</span></label>
              <textarea name="temei" class="miscari-textarea" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="miscari-modal-footer">
          <button type="button" class="btn-compact" data-close-modal="modalDoc">Anulează</button>
          <button type="button" class="btn-primary" id="btnSaveDoc">
            <span>💾</span><span>Adaugă Document</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Celulă -->
    <div class="miscari-modal-backdrop" id="modalCell">
      <div class="miscari-modal-window">
        <div class="miscari-modal-header">
          <div class="miscari-modal-title">
            <span class="icon">🚪</span>
            <span>Mutare Internă (Celulă)</span>
          </div>
          <button type="button" class="btn-icon" data-close-modal="modalCell">✕</button>
        </div>
        <div class="miscari-modal-body">
          <form id="formCell">
            <input type="hidden" name="id_miscare">
            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Număr Celulă</span></label>
                <input type="text" name="room" class="miscari-input" style="font-weight:700; font-size:1rem;">
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label">
                  <span>Data Mutării</span>
                  <span class="hint">DD.MM.YYYY HH:MM:SS</span>
                </label>
                <input type="text" name="adate" class="miscari-input js-date-time">
              </div>
            </div>
            <div class="miscari-form-group">
              <label class="miscari-label"><span>Motiv</span></label>
              <select name="id_motiv" class="miscari-select"></select>
            </div>
            <div class="miscari-form-grid-2">
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Sector</span></label>
                <select name="id_sector" class="miscari-select"></select>
              </div>
              <div class="miscari-form-group">
                <label class="miscari-label"><span>Regim Detenție</span></label>
                <select name="id_regim" class="miscari-select"></select>
              </div>
            </div>
          </form>
        </div>
        <div class="miscari-modal-footer">
          <button type="button" class="btn-compact" data-close-modal="modalCell">Anulează</button>
          <button type="button" class="btn-primary" id="btnSaveCell">
            <span>💾</span><span>Confirmă Mutarea</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Urmărire Penală -->
    <div class="miscari-modal-backdrop" id="modalUp">
      <div class="miscari-modal-window">
        <div class="miscari-modal-header">
          <div class="miscari-modal-title">
            <span class="icon">⚖️</span>
            <span>Urmărire Penală</span>
          </div>
          <button type="button" class="btn-icon" data-close-modal="modalUp">✕</button>
        </div>
        <div class="miscari-modal-body">
          <form id="formUp">
            <input type="hidden" name="id_miscare">
            <div class="miscari-form-group">
              <label class="miscari-label">
                <span>Data Procedurii</span>
                <span class="hint">DD.MM.YYYY</span>
              </label>
              <input type="text" name="adate" class="miscari-input js-date-only">
            </div>
            <div class="miscari-form-group">
              <label class="miscari-label"><span>Autoritate Solicitantă</span></label>
              <select name="id_emitent" class="miscari-select">
                <option value="1">Ofițer de Urmărire Penală</option>
                <option value="2">Procuratura</option>
              </select>
            </div>
          </form>
        </div>
        <div class="miscari-modal-footer">
          <button type="button" class="btn-compact" data-close-modal="modalUp">Anulează</button>
          <button type="button" class="btn-primary" id="btnSaveUp">
            <span>💾</span><span>Adaugă</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // --- INIT ENTRYPOINT ---
  async function init(container) {
    if (!window.currentDetinutData || !window.currentDetinutData.IDNP) {
      container.innerHTML = STYLES +
        `<div class="miscari-root">
           <div class="miscari-header">
             <div class="miscari-title-block">
               <div class="miscari-title"><span class="emoji">🚫</span><span>Mișcări Detenție</span></div>
               <div class="miscari-subtitle">Nu este selectat niciun deținut. Alegeți un dosar din lista principală.</div>
             </div>
           </div>
           <div class="miscari-card">
             <div class="miscari-card-inner">
               <div class="miscari-empty">
                 <div class="miscari-empty-icon">📂</div>
                 <div class="miscari-empty-title">Nu există date de afișat</div>
                 <div>Vă rugăm să selectați un deținut pentru a vedea istoricul de mișcări.</div>
               </div>
             </div>
           </div>
         </div>`;
      return;
    }

    currentIdnp = window.currentDetinutData.IDNP;

    container.innerHTML =
      STYLES +
      `<div class="miscari-root">
        <div class="miscari-header">
          <div class="miscari-title-block">
            <div class="miscari-title">
              <span class="emoji">🚇</span>
              <span>Harta Tranzitului & Registru Mișcări</span>
            </div>
            <div class="miscari-subtitle">
              IDNP: <strong>${currentIdnp}</strong> – vizualizare stil „metrou” a traseului de detenție + evidență cronologică detaliată.
            </div>
          </div>
          <div class="miscari-pills">
            <div class="miscari-pill"><span class="icon">🧭</span><span>Live map</span></div>
            <div class="miscari-pill"><span class="icon">📑</span><span>Grid juridic</span></div>
          </div>
        </div>

        <div class="miscari-card">
          <div class="miscari-card-inner">
            <div class="miscari-loader-wrap">
              <div class="miscari-loader"></div>
              <div>Se încarcă tranzitul și registrul mișcărilor...</div>
            </div>
          </div>
        </div>
      </div>`;

    try {
      const [metaRes, dataRes] = await Promise.all([
        window.prisonApi.get("/detinut/meta/miscari"),
        window.prisonApi.get(`/detinut/${currentIdnp}/miscari`)
      ]);

      if (!metaRes.success || !dataRes.success) {
        throw new Error("Eroare la comunicarea cu serverul.");
      }

      meta = metaRes;
      canWrite = dataRes.canWrite;
      currentList = dataRes.data || [];

      renderPage(container);
      bindGlobalEventHandlers();
      fillDropdowns();

    } catch (e) {
      container.innerHTML =
        STYLES +
        `<div class="miscari-root">
           <div class="miscari-card">
             <div class="miscari-card-inner">
               <div class="miscari-empty">
                 <div class="miscari-empty-icon">⚠️</div>
                 <div class="miscari-empty-title">Eroare la încărcarea datelor</div>
                 <div>${e.message}</div>
               </div>
             </div>
           </div>
         </div>`;
    }
  }

  // --- RENDER PAGE ---
  function renderPage(container) {
    const total = currentList.length;
    const first = total ? currentList[total - 1].ADATE_STR.split(" ")[0] : "-";
    const last = total ? currentList[0].ADATE_STR.split(" ")[0] : "-";

    const chronoList = [...currentList].reverse();
    const mapHtml = renderTransitMap(chronoList);
    const tableHtml = renderTable(currentList);

    const addBtn = canWrite
      ? `<button class="btn-primary" id="btnAddMiscare"><span>＋</span><span>Înregistrează Mișcare</span></button>`
      : "";

    container.innerHTML =
      STYLES +
      `<div class="miscari-root">
         <div class="miscari-header">
           <div class="miscari-title-block">
             <div class="miscari-title">
               <span class="emoji">🚇</span>
               <span>Harta Tranzitului & Registru Mișcări</span>
             </div>
             <div class="miscari-subtitle">
               IDNP: <strong>${currentIdnp}</strong> – traseu vizual + detalii juridice și logistice.
             </div>
           </div>
           <div class="miscari-pills">
             <div class="miscari-pill">
               <span class="icon">🧮</span>
               <span>${total || 0} mișcări</span>
             </div>
             <div class="miscari-pill">
               <span class="icon">📅</span>
               <span>${first} → ${last}</span>
             </div>
           </div>
         </div>

         <div class="miscari-layout">
           <!-- MAP (TOP) -->
           <div class="miscari-card">
             <div class="miscari-card-inner">
               <div class="miscari-card-header">
                 <div class="miscari-card-header-left">
                   <div class="miscari-card-title">
                     <span>🗺️ Traseu Detenție</span>
                   </div>
                   <div class="miscari-card-subtitle">
                     Linie cronologică. Click pe o oprire pentru a edita mișcarea asociată.
                   </div>
                 </div>
                 <button class="btn-ghost-pill" id="btnFocusCurrent">
                   <span>🎯</span><span>Focalizează ultima mișcare</span>
                 </button>
               </div>
               <div class="miscari-map-shell">
                 <div class="miscari-map-header">
                   <div class="miscari-map-legend">
                     <div><span class="legend-dot" style="background:#22c55e;"></span>Transfer / Penitenciar</div>
                     <div><span class="legend-dot" style="background:#8b5cf6;"></span>Instanță</div>
                     <div><span class="legend-dot" style="background:#ef4444;"></span>Poliție / Escortă</div>
                     <div><span class="legend-dot" style="background:#3b82f6;"></span>Altele</div>
                   </div>
                   <div class="miscari-map-meta">
                     ${total ? "Traseu compus din " + total + " noduri." : "Nu există mișcări înregistrate."}
                   </div>
                 </div>
                 ${mapHtml}
               </div>
             </div>
           </div>

           <!-- TABLE (BOTTOM) -->
           <div class="miscari-card">
             <div class="miscari-card-inner">
               <div class="miscari-card-header">
                 <div class="miscari-card-header-left">
                   <div class="miscari-card-title">
                     <span>📋 Registru Detaliat</span>
                   </div>
                   <div class="miscari-card-subtitle">
                     Mișcări, documente atașate, mutări de celulă și proceduri de urmărire penală.
                   </div>
                 </div>
                 ${addBtn}
               </div>
               ${tableHtml}
             </div>
           </div>
         </div>

         ${MODALS}
       </div>`;

    // Flatpickr init
    if (window.flatpickr) {
      window.flatpickr(".js-date-time", {
        dateFormat: "d.m.Y H:i:S",
        enableTime: true,
        time_24hr: true
      });
      window.flatpickr(".js-date-only", {
        dateFormat: "d.m.Y",
        enableTime: false
      });
    }
  }

  // --- TRANSIT MAP (SVG) ---
  // --- TRANSIT MAP (SVG) ---
  function renderTransitMap(list) {
    if (!list.length) {
      return `<div class="miscari-empty">
                <div class="miscari-empty-icon">🧵</div>
                <div class="miscari-empty-title">Fără mișcări înregistrate</div>
                <div>Harta va apărea automat după ce adăugați cel puțin o mișcare.</div>
              </div>`;
    }

    const perRow = 6;      // max stations per row
    const spacingX = 220;  // horizontal distance
    const spacingY = 220;  // increased vertical distance to avoid overlap

    // 1) First pass: calculate coordinates
    const nodes = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const reversed = row % 2 === 1;

      let rx = col * spacingX;
      if (reversed) {
        rx = (perRow - 1 - col) * spacingX;
      }
      const ry = row * spacingY;

      nodes.push({ m, rx, ry, row, col });

      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    const padX = 140;
    const padY = 120;
    const width = ((maxX - minX) || 0) + padX * 2;
    const height = ((maxY - minY) || 0) + padY * 2;

    let lines = "";
    let stations = "";

    // 2) Draw Lines and Stations
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const x = padX + (node.rx - minX);
      const y = padY + (node.ry - minY);

      // ---- LINE DRAWING WITH BREAK LOGIC ----
      if (i < nodes.length - 1) {
        const nextNode = nodes[i + 1];
        const nx = padX + (nextNode.rx - minX);
        const ny = padY + (nextNode.ry - minY);

        // Logic: End the line if this station is a release/eliberare
        const currentType = (node.m.TYPE_NAME || "").toUpperCase();
        const isRelease = currentType.includes("ELIBER");

        if (!isRelease) {
          const color = getTypeColor(node.m);
          const isLastSegment = i === nodes.length - 2;
          
          // If moving to a new row, use a slightly curved or dashed line to signify transition
          lines += `<path d="M ${x} ${y} L ${nx} ${ny}" 
                         class="m-line ${isLastSegment ? "m-line-active" : ""}" 
                         stroke="${color}" 
                         style="opacity: 0.6; stroke-width: 8;" />`;
        }
      }

      // ---- STATION DESIGN ----
      const m = node.m;
      const date = (m.ADATE_STR || "").split(" ")[0] || "";
      const typeLabel = (m.TYPE_NAME || "").toUpperCase().substring(0, 18);
      const placeLabel = (m.PENITENCIAR_NAME || m.INSTANTA_NAME || "Extern").substring(0, 28);
      
      const isCurrent = i === nodes.length - 1;
      const typeColor = getTypeColor(m);
      const outlineColor = isCurrent ? "#22c55e" : "#ffffff";

      stations += `
        <g class="m-station ${isCurrent ? "m-current-glow" : ""}" transform="translate(${x},${y})"
           onclick="window.miscariOps && window.miscariOps.editMiscare && miscariOps.editMiscare(${m.ID})">
          
          <circle r="28" fill="${typeColor}" class="m-station-core"></circle>
          <circle r="16" fill="${outlineColor}" class="m-station-outline"></circle>

          <g style="paint-order: stroke; stroke: #ffffff; stroke-width: 5px; stroke-linecap: round; stroke-linejoin: round;">
            <text x="0" y="-45" text-anchor="middle" class="m-station-date" style="stroke: #ffffff;">${date}</text>
            <text x="0" y="50" text-anchor="middle" class="m-station-label" style="stroke: #ffffff;">${typeLabel}</text>
            <text x="0" y="72" text-anchor="middle" class="m-station-chip" style="stroke: #ffffff; font-style: italic; fill: #6b7280;">${placeLabel}</text>
          </g>
        </g>
      `;
    }

    return `
      <svg class="miscari-map-svg" 
           viewBox="0 0 ${width} ${height}" 
           style="background: #fdfdfd; border-radius: 8px;">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" />
            <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${lines}
        ${stations}
      </svg>
    `;
  }


  function getTypeColor(m) {
    const t = (m.TYPE_NAME || "").toUpperCase();

    // Arrival / incoming
    if (t.includes("SOSIT") || t.includes("INTRARE") || t.includes("ADUS")) {
      return "#22c55e"; // green
    }

    // Departure / transfer
    if (
      t.includes("PLECAT") ||
      t.includes("TRANSFER") ||
      t.includes("TRIMIS") ||
      t.includes("PREDAT")
    ) {
      return "#3b82f6"; // blue
    }

    // Release
    if (t.includes("ELIBER")) {
      return "#8b5cf6"; // purple
    }

    // Fallback / other
    return "#f97316"; // orange
  }


  // --- TABLE (unchanged logic) ---
  function renderTable(list) {
    if (!list.length) {
      return `<div class="miscari-empty">
                <div class="miscari-empty-icon">📭</div>
                <div class="miscari-empty-title">Nu există mișcări înregistrate</div>
                <div>Folosiți butonul „Înregistrează Mișcare” pentru a începe evidența.</div>
              </div>`;
    }

    let rowsHtml = "";

    list.forEach((m) => {
      const dateSplit = (m.ADATE_STR || "").split(" ");
      const date = dateSplit[0] || "";
      const time = dateSplit[1] || "";
      const docs = (m.docs || []).map(d => {
        const tip = d.TIPDOC_NAME || "Doc";
        const nr = d.NRDOC || "";
        return `<span class="miscari-doc-chip" title="${tip} ${nr}">
                  <span class="icon">📄</span><span>${tip}</span>
                </span>`;
      }).join("");

      let badgeClass = "miscari-badge-pen";
      let badgeIcon = "🏛️";
      if (m.ID_INSTANTE) {
        badgeClass = "miscari-badge-court";
        badgeIcon = "⚖️";
      }
      if (m.ID_TYPE_MISCARI == 2) {
        badgeClass = "miscari-badge-pol";
        badgeIcon = "🚓";
      }

      const hasNested = (m.cells && m.cells.length) || (m.up && m.up.length);

      // Nested rows
      let nestedHtml = "";
      if (hasNested) {
        let cellsHtml = "";
        (m.cells || []).forEach((c) => {
          const docsCell = (c.docs || []).map(d =>
            `<span class="miscari-doc-chip" title="${d.TIPDOC_NAME || ""} ${d.NRDOC || ""}">
               <span class="icon">📄</span><span>${d.NRDOC || ""}</span>
             </span>`
          ).join("");

          cellsHtml += `
            <div class="miscari-cells-row">
              <div><strong>🚪 ${c.ROOM || "-"}</strong></div>
              <div>${c.ADATE_STR || ""}</div>
              <div>${c.MOTIV_NAME || "-"}</div>
              <div>${c.SECTOR_NAME || "-"}</div>
              <div>${c.REGIM_NAME || "-"}</div>
              <div style="text-align:right;">
                ${canWrite
                  ? `<button type="button" class="btn-compact" onclick="miscariOps.addDoc(4, ${c.ID})">+ Doc</button>`
                  : ""}
              </div>
            </div>`;
        });

        let upHtml = "";
        (m.up || []).forEach((u) => {
          const label = u.ID_EMITENT == 1 ? "Ofițer UP" : "Procuratură";
          upHtml += `
            <div class="miscari-up-chip">
              <span>📅 ${u.ADATE_STR || ""}</span>
              <span>•</span>
              <span>${label}</span>
              ${canWrite
                ? `<button type="button" onclick="miscariOps.deleteUp(${u.ID})">✕</button>`
                : ""}
            </div>`;
        });

        nestedHtml = `
          <div class="miscari-nested" id="nest-${m.ID}">
            ${m.cells && m.cells.length
              ? `<div class="miscari-nested-section-title">
                   <span class="icon">⛓️</span><span>Mutări pe celule</span>
                 </div>
                 <div class="miscari-cells-table">${cellsHtml}</div>`
              : ""}

            ${m.up && m.up.length
              ? `<div class="miscari-nested-section-title" style="margin-top:8px;">
                   <span class="icon">⚖️</span><span>Proceduri de urmărire penală</span>
                 </div>
                 <div>${upHtml}</div>`
              : ""}
          </div>`;
      }

      const expandCol = hasNested
        ? `<button type="button" class="btn-expand-round" data-expand="${m.ID}">▶</button>`
        : `<span style="opacity:0.15; font-size:0.7rem;">●</span>`;

      const actionButtons = canWrite
        ? `
          <button type="button" class="btn-compact" data-doc-misc="${m.ID}" title="Adaugă document">📄</button>
          <button type="button" class="btn-compact" data-cell-misc="${m.ID}" title="Mutare celulă">🚪</button>
          <button type="button" class="btn-compact" data-up-misc="${m.ID}" title="Urmărire penală">⚖️</button>
          <button type="button" class="btn-compact" data-edit-misc="${m.ID}" title="Editează">✏️</button>
          <button type="button" class="btn-compact btn-compact-danger" data-del-misc="${m.ID}" title="Șterge">🗑️</button>
        `
        : `<span style="color:#cbd5e1;">🔒 doar vizualizare</span>`;

      rowsHtml += `
        <div class="miscari-row">
          <div>${expandCol}</div>
          <div>
            <div class="miscari-row-main">${date}</div>
            <div class="miscari-row-sub">${time}</div>
          </div>
          <div>
            <div class="miscari-row-main">${m.PENITENCIAR_NAME || "Extern"}</div>
            <div class="miscari-row-sub">${m.INSTANTA_NAME || ""}</div>
          </div>
          <div>
            <span class="miscari-badge ${badgeClass}">
              <span>${badgeIcon}</span><span>${m.TYPE_NAME || "-"}</span>
            </span>
          </div>
          <div>
            <div class="miscari-row-main" style="font-size:0.8rem;">${m.MOTIV_NAME || "-"}</div>
          </div>
          <div>${docs || `<span class="miscari-row-sub">Fără documente</span>`}</div>
          <div style="text-align:right;">
            ${actionButtons}
          </div>
        </div>
        ${nestedHtml}
      `;
    });

    return `
      <div class="miscari-table-wrap">
        <div class="miscari-table-header-row">
          <div></div>
          <div>Data</div>
          <div>Locație</div>
          <div>Tip</div>
          <div>Motiv</div>
          <div>Documente</div>
          <div style="text-align:right;">Acțiuni</div>
        </div>
        <div class="miscari-table-body">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  // --- DROPDOWNS ---
  function fillDropdowns() {
    const fill = (selector, data) => {
      const el = document.querySelector(selector);
      if (!el || !data) return;
      el.innerHTML =
        `<option value="">— Selectați —</option>` +
        data
          .map((i) => `<option value="${i.ID}">${i.NAME}</option>`)
          .join("");
    };

    fill('#formMiscare select[name="id_penitenciar"]', meta.penitenciars);
    fill('#formMiscare select[name="id_type"]', meta.types);
    fill('#formMiscare select[name="id_motiv"]', meta.motives);
    fill('#formMiscare select[name="id_instante"]', meta.instante);

    fill('#formDoc select[name="idTipDoc"]', meta.docTypes);
    fill('#formDoc select[name="idEmitentInst"]', meta.instante);

    fill('#formCell select[name="id_sector"]', meta.sectors);
    fill('#formCell select[name="id_regim"]', meta.regims);
    fill('#formCell select[name="id_motiv"]', meta.cellMotives);
  }

  // --- MODAL HELPERS ---
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "flex";
    setTimeout(() => el.classList.add("visible"), 10);
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("visible");
    setTimeout(() => {
      el.style.display = "none";
    }, 180);
  }

  // --- GLOBAL OPS ---
  window.miscariOps = {
    addMiscare() {
      const form = document.getElementById("formMiscare");
      if (form) form.reset();
      if (form) form.querySelector('[name="id"]').value = "";
      openModal("modalMiscare");
    },
    editMiscare(id) {
      const item = currentList.find((i) => i.ID == id);
      if (!item) return;
      const form = document.getElementById("formMiscare");
      if (!form) return;
      form.reset();
      form.querySelector('[name="id"]').value = item.ID;
      form.querySelector('[name="adate"]').value = item.ADATE_STR || "";
      if (item.ID_PENETENCIAR)
        form.querySelector('[name="id_penitenciar"]').value = item.ID_PENETENCIAR;
      if (item.ID_INSTANTE)
        form.querySelector('[name="id_instante"]').value = item.ID_INSTANTE;
      if (item.ID_TYPE_MISCARI)
        form.querySelector('[name="id_type"]').value = item.ID_TYPE_MISCARI;
      if (item.ID_MOTIV)
        form.querySelector('[name="id_motiv"]').value = item.ID_MOTIV;
      openModal("modalMiscare");
    },
    async saveMiscare() {
      const form = document.getElementById("formMiscare");
      if (!form) return;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const id = payload.id;
      const url = id ? `/detinut/miscari/${id}` : `/detinut/${currentIdnp}/miscari`;
      try {
        let res;
        if (id) {
          res = await fetch("/api" + url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": sessionStorage.getItem("prison.userId") || ""
            },
            body: JSON.stringify(payload)
          }).then(r => r.json());
        } else {
          res = await window.prisonApi.post(url, payload);
        }
        if (res && res.success) {
          closeModal("modalMiscare");
          init(document.getElementById("profileContent"));
        } else {
          alert((res && res.error) || "Eroare la salvarea mișcării.");
        }
      } catch (e) {
        alert(e.message);
      }
    },
    async deleteMiscare(id) {
      if (!confirm("⚠️ Această acțiune este ireversibilă. Sigur ștergeți mișcarea?")) return;
      try {
        const res = await window.prisonApi.del(`/detinut/miscari/${id}`);
        if (!res || !res.success) {
          alert((res && res.error) || "Eroare la ștergere.");
          return;
        }
        init(document.getElementById("profileContent"));
      } catch (e) {
        alert(e.message);
      }
    },

    addDoc(tip, parentId) {
      const form = document.getElementById("formDoc");
      if (!form) return;
      form.reset();
      form.querySelector('[name="parentId"]').value = parentId;
      form.querySelector('[name="tipDecizie"]').value = tip;
      openModal("modalDoc");
    },
    async saveDoc() {
      const form = document.getElementById("formDoc");
      if (!form) return;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        const res = await window.prisonApi.post(`/detinut/miscari/docs`, payload);
        if (res && res.success) {
          closeModal("modalDoc");
          init(document.getElementById("profileContent"));
        } else {
          alert((res && res.error) || "Eroare la salvarea documentului.");
        }
      } catch (e) {
        alert(e.message);
      }
    },

    addCell(idMiscare) {
      const form = document.getElementById("formCell");
      if (!form) return;
      form.reset();
      form.querySelector('[name="id_miscare"]').value = idMiscare;
      openModal("modalCell");
    },
    async saveCell() {
      const form = document.getElementById("formCell");
      if (!form) return;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const mid = payload.id_miscare;
      try {
        const res = await window.prisonApi.post(`/detinut/miscari/${mid}/cells`, payload);
        if (res && res.success) {
          closeModal("modalCell");
          init(document.getElementById("profileContent"));
        } else {
          alert((res && res.error) || "Eroare la salvarea mutării pe celulă.");
        }
      } catch (e) {
        alert(e.message);
      }
    },

    addUp(idMiscare) {
      const form = document.getElementById("formUp");
      if (!form) return;
      form.reset();
      form.querySelector('[name="id_miscare"]').value = idMiscare;
      openModal("modalUp");
    },
    async saveUp() {
      const form = document.getElementById("formUp");
      if (!form) return;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const mid = payload.id_miscare;
      payload.idnp = currentIdnp;
      try {
        const res = await window.prisonApi.post(`/detinut/miscari/${mid}/up`, payload);
        if (res && res.success) {
          closeModal("modalUp");
          init(document.getElementById("profileContent"));
        } else {
          alert((res && res.error) || "Eroare la salvarea procedurii UP.");
        }
      } catch (e) {
        alert(e.message);
      }
    },
    async deleteUp(id) {
      if (!confirm("Ștergeți înregistrarea de urmărire penală?")) return;
      try {
        const res = await window.prisonApi.del(`/detinut/up/${id}`);
        if (!res || !res.success) {
          alert((res && res.error) || "Eroare la ștergere.");
          return;
        }
        init(document.getElementById("profileContent"));
      } catch (e) {
        alert(e.message);
      }
    },
    toggleNested(id, btnEl) {
      const row = document.getElementById(`nest-${id}`);
      if (!row) return;
      if (row.classList.contains("open")) {
        row.classList.remove("open");
        if (btnEl) btnEl.classList.remove("rotated");
      } else {
        row.classList.add("open");
        if (btnEl) btnEl.classList.add("rotated");
      }
    }
  };

  // --- BIND EVENTS AFTER RENDER ---
  function bindGlobalEventHandlers() {
    const root = document.querySelector(".miscari-root");
    if (!root) return;

    // Add miscari
    const addBtn = document.getElementById("btnAddMiscare");
    if (addBtn && canWrite) {
      addBtn.onclick = () => window.miscariOps.addMiscare();
    }

    // Focus current on map (scroll to end of svg)
    const btnFocusCurrent = document.getElementById("btnFocusCurrent");
    if (btnFocusCurrent) {
      btnFocusCurrent.onclick = () => {
        const shell = document.querySelector(".miscari-map-shell");
        if (!shell) return;
        shell.scrollLeft = shell.scrollWidth;
      };
    }

    // Expand toggles
    root.querySelectorAll("[data-expand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-expand");
        window.miscariOps.toggleNested(id, btn);
      });
    });

    // Row action buttons
    root.querySelectorAll("[data-doc-misc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-doc-misc");
        miscariOps.addDoc(3, id);
      });
    });
    root.querySelectorAll("[data-cell-misc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-cell-misc");
        miscariOps.addCell(id);
      });
    });
    root.querySelectorAll("[data-up-misc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-up-misc");
        miscariOps.addUp(id);
      });
    });
    root.querySelectorAll("[data-edit-misc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-misc");
        miscariOps.editMiscare(id);
      });
    });
    root.querySelectorAll("[data-del-misc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-misc");
        miscariOps.deleteMiscare(id);
      });
    });

    // Modal close buttons (data-close-modal)
    root.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close-modal");
        closeModal(id);
      });
    });

    // Backdrop click closes modal
    ["modalMiscare", "modalDoc", "modalCell", "modalUp"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", (ev) => {
        if (ev.target === el) {
          closeModal(id);
        }
      });
    });

    // Save buttons in modals
    const btnSaveMiscare = document.getElementById("btnSaveMiscare");
    if (btnSaveMiscare) btnSaveMiscare.onclick = () => miscariOps.saveMiscare();

    const btnSaveDoc = document.getElementById("btnSaveDoc");
    if (btnSaveDoc) btnSaveDoc.onclick = () => miscariOps.saveDoc();

    const btnSaveCell = document.getElementById("btnSaveCell");
    if (btnSaveCell) btnSaveCell.onclick = () => miscariOps.saveCell();

    const btnSaveUp = document.getElementById("btnSaveUp");
    if (btnSaveUp) btnSaveUp.onclick = () => miscariOps.saveUp();
  }

  // REGISTER TAB
  window.DetinutTabs["miscari"] = { render: init };
})();
