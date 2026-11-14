// Seitenleisten-Eintrag „Dashboard-Vorschau“ für Home Assistant (panel_custom)
// Zeigt /local/dashboard-viewer/index.html innerhalb von HA in voller Höhe an und bietet
// Buttons zum Öffnen in einem neuen Tab oder in einem eigenen Fenster ohne Adressleiste
// (verschiebbar auf einen anderen Monitor, Größe änderbar, maximierbar; Position wird gemerkt).
//
// configuration.yaml:
//   panel_custom:
//     - name: dashboard-viewer-panel
//       url_path: dashboard-vorschau
//       sidebar_title: Dashboard-Vorschau
//       sidebar_icon: mdi:monitor-dashboard
//       module_url: /local/dashboard-viewer/panel.js?v=3   ← Zahl bei jeder Änderung erhöhen (Browser-Cache)
const VIEWER = '/local/dashboard-viewer/index.html';
const TAB = 'dashboard-vorschau';          // benannter Tab → wird beim nächsten Klick wiederverwendet
const WIN = 'dashboard-vorschau-fenster';  // benanntes Fenster, speichert seine Lage selbst (siehe index.html)
const GEO_KEY = 'dashboardViewerWindow';

const P = {
  menu: 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z',
  reload: 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
  tab: 'M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z',
  win: 'M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,8V18H20V8H4M4,5V7H6V5H4M7,5V7H9V5H7M10,5V7H12V5H10Z',
};
const svg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;

// Benanntes Fenster öffnen oder – wenn es schon offen ist – nur nach vorne holen (ohne neu zu laden)
function openNamed(name, features) {
  const w = window.open('', name, features);
  if (!w) return null;
  let blank = true;
  try { blank = w.location.href === 'about:blank'; } catch (e) {}
  if (blank) w.location.href = VIEWER;
  try { w.focus(); } catch (e) {}
  return w;
}

function windowFeatures() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GEO_KEY)); } catch (e) {}
  const s = window.screen;
  const w = g?.w || Math.min(s.availWidth - 40, 1600);
  const h = g?.h || Math.min(s.availHeight - 80, 1000);
  const x = g?.x ?? (s.availLeft || 0) + Math.max(0, (s.availWidth - w) / 2);
  const y = g?.y ?? (s.availTop || 0) + Math.max(0, (s.availHeight - h) / 2);
  return `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(x)},top=${Math.round(y)},resizable=yes,scrollbars=yes`;
}

class DashboardViewerPanel extends HTMLElement {
  set hass(h) { this._hass = h; }
  set narrow(n) { this._narrow = n; this._upd(); }

  connectedCallback() {
    if (this.shadowRoot) return;
    const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: var(--primary-background-color, #111); }
        .bar {
          height: var(--header-height, 56px); flex: none; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 4px;
          background: var(--app-header-background-color, var(--card-background-color, #1c1c1c));
          color: var(--app-header-text-color, var(--primary-text-color, #e1e1e1));
          border-bottom: var(--app-header-border-bottom, 1px solid var(--divider-color, rgba(225,225,225,.12)));
          font-family: var(--ha-font-family-body, Roboto, sans-serif);
        }
        .title { flex: 1; font-size: 20px; padding-left: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib { width: 40px; height: 40px; border: 0; border-radius: 50%; background: none; color: inherit; display: grid; place-items: center; cursor: pointer; }
        .ib:hover { background: rgba(127,127,127,.15); }
        .ib[hidden] { display: none; }
        button.b {
          font: inherit; font-size: 13px; font-weight: 500; color: inherit; height: 34px; padding: 0 12px;
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap;
          background: rgba(225,225,225,.06); border: 1px solid var(--divider-color, rgba(225,225,225,.12)); border-radius: 12px;
        }
        button.b:hover { background: rgba(225,225,225,.11); }
        svg { width: 20px; height: 20px; fill: currentColor; flex: none; }
        button.b svg { width: 18px; height: 18px; color: var(--primary-color, #03a9f4); }
        .hint { flex: none; padding: 8px 16px; font: 13px var(--ha-font-family-body, Roboto, sans-serif); color: #ffa600; background: rgba(255,166,0,.1); border-bottom: 1px solid rgba(255,166,0,.3); }
        .hint[hidden] { display: none; }
        iframe { flex: 1; min-height: 0; width: 100%; border: 0; display: block; }
        @media (max-width: 700px) { button.b span { display: none; } }
      </style>
      <div class="bar">
        <button class="ib" id="menu" title="Seitenleiste" hidden>${svg(P.menu)}</button>
        <div class="title">Dashboard-Vorschau</div>
        <button class="b" id="reload" title="Vorschau neu laden">${svg(P.reload)}<span>Neu laden</span></button>
        <button class="b" id="tab" title="In neuem Browser-Tab öffnen">${svg(P.tab)}<span>Neuer Tab</span></button>
        <button class="b" id="win" title="Eigenes Fenster ohne Adressleiste – verschiebbar, Größe änderbar, maximierbar">${svg(P.win)}<span>Neues Fenster</span></button>
      </div>
      <div class="hint" id="hint" hidden>Der Browser hat das neue Fenster blockiert – bitte Pop-ups für Home Assistant erlauben (Symbol rechts in der Adressleiste).</div>
      <iframe src="${VIEWER}" allow="fullscreen; microphone; camera; autoplay; clipboard-write"></iframe>`;
    const $ = (s) => r.querySelector(s);
    const blocked = (w) => { $('#hint').hidden = !!w; };
    $('#menu').onclick = () => this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true }));
    $('#reload').onclick = () => { $('iframe').src = VIEWER; };
    $('#tab').onclick = () => blocked(openNamed(TAB));
    $('#win').onclick = () => blocked(openNamed(WIN, windowFeatures()));
    this._upd();
  }

  _upd() {
    const m = this.shadowRoot && this.shadowRoot.querySelector('#menu');
    if (m) m.hidden = !this._narrow;
  }
}
customElements.define('dashboard-viewer-panel', DashboardViewerPanel);
