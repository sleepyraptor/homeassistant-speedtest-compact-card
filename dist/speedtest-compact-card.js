/**
 * SpeedTest Compact Card
 * A compact Home Assistant dashboard card for internet speed sensors.
 * https://github.com/sleepyraptor/homeassistant-speedtest-compact-card
 */
const VERSION = "1.0.0";
const TXT = {
  label_down: "Download", label_up: "Upload", label_ping: "Ping",
  unit: "Mbit/s", unit_ping: "ms"
};
/**
 * The footer is a technical string and stays in English; only the numbers inside
 * it follow the locale. Write your own `footer` to say it any other way.
 */
const FOOTER = "{pct}% of {max} {unit}";
/** One word is all that needs a dictionary; the rest comes from Intl. */
const I18N = {
  en: { never: "never" }, it: { never: "mai" }, de: { never: "nie" },
  fr: { never: "jamais" }, es: { never: "nunca" }, nl: { never: "nooit" },
  pt: { never: "nunca" }, ca: { never: "mai" }, pl: { never: "nigdy" }
};
const C = `
:host{display:block;height:100%}
ha-card{padding:16px;overflow:hidden;cursor:pointer;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.top{flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.lbl{font-size:11px;letter-spacing:.14em;color:var(--secondary-text-color);text-transform:uppercase;margin-bottom:2px}
.big{font-size:46px;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--primary-text-color);display:flex;align-items:baseline;gap:6px;transition:font-size .2s}
.unit{font-size:13px;font-weight:400;color:var(--secondary-text-color);letter-spacing:0}
.side{display:flex;gap:18px;padding-bottom:4px}
.s{text-align:right}
.sv{font-size:17px;font-weight:600;color:var(--primary-text-color);white-space:nowrap}
.sk{font-size:10px;letter-spacing:.12em;color:var(--secondary-text-color);text-transform:uppercase;margin-top:1px}
.hide{display:none!important}
svg.spark{display:block;flex:1 1 0;min-height:0;width:100%;margin:10px 0 0}
.bar{flex:0 0 auto;height:6px;border-radius:99px;background:var(--divider-color);overflow:hidden;margin-top:auto}
.gap{margin-top:12px}
.fill{height:100%;border-radius:99px;transition:width .6s ease,background-color .3s}
.foot{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--secondary-text-color)}
.pct{font-weight:600;color:var(--primary-text-color)}
.stale{color:var(--error-color);font-weight:600}
ha-card.sm{padding:12px 14px}
ha-card.sm .big{font-size:32px}
ha-card.sm .sv{font-size:15px}
ha-card.xs{padding:8px 12px}
ha-card.xs .big{font-size:22px}
ha-card.xs .lbl{display:none}
ha-card.xs .sk{display:none}
ha-card.xs .sv{font-size:14px}
ha-card.xs .foot{display:none}
ha-card.xs svg.spark{display:none}
`;
const num = v => { const n = Number(v); return isFinite(n) ? n : null };
const fmt = (lang, v, digits = 0) => {
  try { return new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v) }
  catch (e) { return String(digits ? v.toFixed(digits) : Math.round(v)) }
};
/** "12 minutes ago" / "12 minuti fa", straight from the browser. */
const ago = (lang, minutes) => {
  const unit = minutes < 60 ? "minute" : "hour";
  const v = unit === "minute" ? Math.round(minutes) : Math.round(minutes / 6) / 10;
  try { return new Intl.RelativeTimeFormat(lang, { numeric: "always" }).format(-v, unit) }
  catch (e) { return v + (unit === "minute" ? " min ago" : " h ago") }
};
class SpeedtestCompact extends HTMLElement {
  static getConfigElement() { return document.createElement("speedtest-compact-card-editor") }
  static getStubConfig() {
    return {
      type: "custom:speedtest-compact-card",
      down: "", up: "", ping: "", last: "",
      max_down: 1000, ok_pct: 80, warn_pct: 60,
      days: 7, sparkline: true, stale_hours: 2.2
    };
  }
  setConfig(c) {
    if (!c || !c.down) throw new Error("Missing download entity: set 'down'");
    this._c = Object.assign({}, TXT, c);
    this._k = null;
    if (this.shadowRoot && this._h) { this._paint(); this._hist() }
  }
  getCardSize() { return this._c && this._c.sparkline === true ? 3 : 2 }
  getGridOptions() {
    const g = this._c && this._c.sparkline === true;
    return { rows: g ? 3 : 2, columns: 12, min_rows: 1, min_columns: 6 };
  }
  set hass(h) {
    const prev = this._h;
    this._h = h;
    if (!this._c) return;
    if (!this.shadowRoot) this._build();
    // HA assigns hass on every state change in the house: repaint only when
    // something we actually display has changed, or the card will thrash.
    if (this._touched(prev, h)) this._paint();
    const s = this._c.last ? h.states[this._c.last] : null;
    const k = s ? s.state : "";
    if (k !== this._k) { this._k = k; this._hist() }
  }
  _touched(a, b) {
    if (!a) return true;
    const c = this._c;
    for (const id of [c.down, c.up, c.ping, c.last]) {
      if (id && a.states[id] !== b.states[id]) return true;
    }
    return (a.locale && a.locale.language) !== (b.locale && b.locale.language) || a.language !== b.language;
  }
  connectedCallback() {
    if (this._ro) this._ro.observe(this);
    // The age is the only thing that changes on its own.
    if (!this._tick) this._tick = setInterval(() => { if (this._c && this._h) this._paint() }, 60000);
  }
  disconnectedCallback() {
    if (this._ro) this._ro.disconnect();
    if (this._tick) { clearInterval(this._tick); this._tick = null }
  }
  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>${C}</style><ha-card>
      <div class="top">
        <div><div class="lbl" id="ld"></div><div class="big"><span id="d">-</span><span class="unit" id="un"></span></div></div>
        <div class="side">
          <div class="s" id="bu"><div class="sv" id="u">-</div><div class="sk" id="lu"></div></div>
          <div class="s" id="bp"><div class="sv" id="p">-</div><div class="sk" id="lp"></div></div>
        </div>
      </div>
      <svg class="spark" id="sp" viewBox="0 0 320 44" preserveAspectRatio="none"></svg>
      <div class="bar" id="ba"><div class="fill" id="f" style="width:0%"></div></div>
      <div class="foot" id="fo"><span class="pct" id="pc"></span><span id="ag"></span></div>
    </ha-card>`;
    this._card = this.shadowRoot.querySelector("ha-card");
    this._card.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this._c.down }, bubbles: true, composed: true }));
    });
    if (window.ResizeObserver) { this._ro = new window.ResizeObserver(() => this._fit()); this._ro.observe(this) }
  }
  _fit() {
    const h = this.clientHeight;
    if (!this._card || !h) return;
    this._card.classList.toggle("xs", h < 96);
    this._card.classList.toggle("sm", h >= 96 && h < 140);
  }
  _n(id) { if (!id) return null; const s = this._h.states[id]; if (!s) return null; const v = parseFloat(s.state); return isNaN(v) ? null : v }
  _show(id, on) { this.shadowRoot.getElementById(id).classList.toggle("hide", !on) }
  _col(pct) {
    const ok = num(this._c.ok_pct), wa = num(this._c.warn_pct);
    if (ok !== null && pct >= ok) return "var(--success-color,#43a047)";
    if (wa !== null && pct >= wa) return "var(--warning-color,#ffa726)";
    return "var(--error-color,#e53935)";
  }
  _lang() {
    const h = this._h;
    return (h && ((h.locale && h.locale.language) || h.language)) || "en";
  }
  _dict() {
    const l = this._lang();
    return I18N[l] || I18N[String(l).split("-")[0]] || I18N.en;
  }
  _paint() {
    const q = x => this.shadowRoot.getElementById(x), c = this._c;
    const lang = this._lang(), dict = this._dict();
    q("ld").textContent = c.label_down; q("lu").textContent = c.label_up;
    q("lp").textContent = c.label_ping; q("un").textContent = c.unit;
    const d = this._n(c.down), u = this._n(c.up), p = this._n(c.ping);
    q("d").textContent = d === null ? "-" : fmt(lang, d);
    q("u").textContent = u === null ? "-" : fmt(lang, u);
    q("p").textContent = p === null ? "-" : fmt(lang, p, 1) + " " + c.unit_ping;
    this._show("bu", !!c.up); this._show("bp", !!c.ping);
    const graph = c.sparkline === true && num(c.days) !== null;
    this._show("sp", graph);
    const md = num(c.max_down);
    const hasBar = md !== null && md > 0 && d !== null;
    this._show("ba", hasBar);
    q("ba").classList.toggle("gap", graph);
    if (hasBar) {
      const pct = Math.min(d / md * 100, 100);
      const f = q("f"); f.style.width = pct.toFixed(1) + "%"; f.style.background = this._col(pct);
      q("pc").textContent = String(c.footer || FOOTER)
        .replace("{pct}", fmt(lang, pct)).replace("{max}", fmt(lang, md)).replace("{unit}", c.unit);
    } else { q("pc").textContent = "" }
    const s = c.last ? this._h.states[c.last] : null;
    const t = s ? new Date(s.state) : null;
    const ag = q("ag");
    if (!c.last) { ag.textContent = ""; ag.className = "" }
    else if (!t || isNaN(t.getTime())) { ag.textContent = dict.never; ag.className = "stale" }
    else {
      const m = (Date.now() - t.getTime()) / 60000, sh = num(c.stale_hours);
      ag.textContent = ago(lang, m);
      ag.className = (sh !== null && m > sh * 60) ? "stale" : "";
    }
    this._show("fo", !!(q("pc").textContent || ag.textContent));
    this._fit();
  }
  async _hist() {
    const c = this._c, dd = num(c.days);
    if (c.sparkline !== true || dd === null || !this._h) return;
    try {
      const e = new Date(), s = new Date(e.getTime() - dd * 864e5);
      const r = await this._h.callApi("GET", "history/period/" + s.toISOString() + "?filter_entity_id=" + c.down + "&minimal_response&no_attributes&end_time=" + e.toISOString());
      const a = (r && r[0]) || [];
      this._draw(a.map(x => parseFloat(x.state)).filter(x => !isNaN(x)));
    } catch (err) { }
  }
  _draw(v) {
    const sp = this.shadowRoot.getElementById("sp");
    if (!sp) return;
    if (v.length < 2) { sp.innerHTML = ""; return }
    const W = 320, H = 44, md = num(this._c.max_down);
    let mn = v[0], mx = v[0];
    for (const y of v) { if (y < mn) mn = y; if (y > mx) mx = y }
    const rng = (mx - mn) || 1;
    const pts = v.map((y, i) => [i * (W / (v.length - 1)), H - 2 - ((y - mn) / rng) * (H - 6)]);
    const line = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const c = md ? this._col(Math.min(v[v.length - 1] / md * 100, 100)) : "var(--primary-color)";
    sp.innerHTML = '<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".35"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>'
      + '<polygon points="0,' + H + ' ' + line + ' ' + W + ',' + H + '" fill="url(#g)"/>'
      + '<polyline points="' + line + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }
}
const ENT = { entity: { domain: "sensor" } };
const TEXT = { text: {} };
const PCT = { number: { min: 1, max: 100, mode: "box", unit_of_measurement: "%" } };
const SCHEMA = [
  { name: "", type: "expandable", title: "Entities", icon: "mdi:database-search", expanded: true, schema: [
    { name: "", type: "grid", schema: [
      { name: "down", required: true, selector: ENT }, { name: "up", selector: ENT }
    ]},
    { name: "", type: "grid", schema: [
      { name: "ping", selector: ENT }, { name: "last", selector: ENT }
    ]}
  ]},
  { name: "", type: "expandable", title: "Labels", icon: "mdi:format-text", schema: [
    { name: "", type: "grid", schema: [
      { name: "label_down", selector: TEXT }, { name: "label_up", selector: TEXT }, { name: "label_ping", selector: TEXT }
    ]},
    { name: "", type: "grid", schema: [
      { name: "unit", selector: TEXT }, { name: "unit_ping", selector: TEXT }
    ]}
  ]},
  { name: "", type: "expandable", title: "Bar", icon: "mdi:gauge", schema: [
    { name: "max_down", selector: { number: { min: 1, max: 10000, mode: "box", unit_of_measurement: "Mbit/s" } } },
    { name: "", type: "grid", schema: [
      { name: "ok_pct", selector: PCT }, { name: "warn_pct", selector: PCT }
    ]},
    { name: "footer", selector: TEXT }
  ]},
  { name: "", type: "expandable", title: "Graph", icon: "mdi:chart-areaspline", schema: [
    { name: "sparkline", selector: { boolean: {} } },
    { name: "days", selector: { number: { min: 1, max: 365, mode: "box", unit_of_measurement: "days" } } }
  ]},
  { name: "", type: "expandable", title: "Freshness", icon: "mdi:clock-alert-outline", schema: [
    { name: "stale_hours", selector: { number: { min: 0.5, max: 72, step: 0.1, mode: "box", unit_of_measurement: "h" } } }
  ]}
];
const LAB = {
  down: "Download", up: "Upload", ping: "Ping", last: "Last test",
  label_down: "Download label", label_up: "Upload label", label_ping: "Ping label",
  unit: "Speed unit", unit_ping: "Latency unit",
  max_down: "Line speed", ok_pct: "Green above", warn_pct: "Amber above",
  footer: "Footer", days: "Range", stale_hours: "Stale after", sparkline: "Show graph"
};
const HELP = { footer: "{pct}, {max}, {unit}" };
class SpeedtestCompactEditor extends HTMLElement {
  setConfig(c) {
    this._c = Object.assign({}, c || {});
    delete this._c.type;
    this._render();
  }
  set hass(h) { this._h = h; if (this._f) this._f.hass = h }
  _render() {
    if (!this._f) {
      this._f = document.createElement("ha-form");
      this._f.schema = SCHEMA;
      this._f.computeLabel = s => LAB[s.name] || s.name;
      this._f.computeHelper = s => HELP[s.name] || "";
      if (this._h) this._f.hass = this._h;
      this._f.addEventListener("value-changed", e => {
        e.stopPropagation();
        const v = Object.assign({ type: "custom:speedtest-compact-card" }, e.detail.value);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: v }, bubbles: true, composed: true }));
      });
      this.appendChild(this._f);
    }
    this._f.data = this._c;
  }
}
if (!customElements.get("speedtest-compact-card")) customElements.define("speedtest-compact-card", SpeedtestCompact);
if (!customElements.get("speedtest-compact-card-editor")) customElements.define("speedtest-compact-card-editor", SpeedtestCompactEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "speedtest-compact-card",
  name: "SpeedTest Compact",
  description: "Compact card for internet speed sensors, with a share-of-line bar",
  preview: true,
  documentationURL: "https://github.com/sleepyraptor/homeassistant-speedtest-compact-card"
});
console.info(
  `%c SPEEDTEST-COMPACT-CARD %c v${VERSION} `,
  "color:#fff;background:#43a047;font-weight:700",
  "color:#43a047;background:#e8f5e9;font-weight:700"
);
