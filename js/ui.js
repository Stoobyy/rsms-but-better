// Tiny DOM helpers — no framework, just tagged HTML + a few components.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** html`...` — escapes interpolations unless they're marked raw() or arrays of raw. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += render(vals[i]);
  });
  return raw(out);
}
export const raw = (s) => ({ __raw: String(s ?? '') });
function render(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (v && v.__raw != null) return v.__raw;
  return esc(v);
}
export const el = (node) => (node && node.__raw != null ? node.__raw : String(node ?? ''));

export function mount(container, content) {
  container.innerHTML = el(content);
  return container;
}

/* ---------- formatting ---------- */
export const fmt = {
  n: (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')),
  int: (v) => (v == null ? '—' : String(v)),
  date: (s) => {
    // "6-Jul-2026" → { day: '6', month: 'Jul', dow: 'Mon' }
    const d = parsePortalDate(s);
    return d ? { day: d.getDate(), month: d.toLocaleString('en', { month: 'short' }), dow: d.toLocaleString('en', { weekday: 'short' }), iso: d.toISOString().slice(0, 10) } : { day: s, month: '', dow: '' };
  },
};
export function parsePortalDate(s) {
  const m = String(s || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mi = months.indexOf(m[2].toLowerCase());
  return mi < 0 ? null : new Date(+m[3], mi, +m[1]);
}

export const gradeTone = (g) => {
  g = String(g || '').toUpperCase();
  if (g === 'S' || g === 'A+') return 'green';
  if (g === 'A' || g === 'B+') return 'blue';
  if (g === 'B' || g === 'C+' || g === 'C') return 'amber';
  if (g === 'F' || g === 'FE' || g === 'I') return 'red';
  return '';
};
export const pctTone = (p) => (p == null ? '' : p >= 80 ? 'green' : p >= 50 ? '' : p >= 35 ? 'amber' : 'red');

/* ---------- components ---------- */
export const icon = {
  home: raw('<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'),
  attendance: raw('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 15l2.5 2.5L16 12"/></svg>'),
  marks: raw('<svg viewBox="0 0 24 24"><path d="M4 19V5a1 1 0 0 1 1-1h9l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M14 4v5h5M8 13h8M8 17h5"/></svg>'),
  split: raw('<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'),
  results: raw('<svg viewBox="0 0 24 24"><path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/></svg>'),
  calendar: raw('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>'),
  activity: raw('<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/></svg>'),
  notices: raw('<svg viewBox="0 0 24 24"><path d="M4 11v2a2 2 0 0 0 2 2h2l6 4V5L8 9H6a2 2 0 0 0-2 2z"/><path d="M18 9a4 4 0 0 1 0 6"/></svg>'),
  fees: raw('<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg>'),
  profile: raw('<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'),
  more: raw('<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'),
  logout: raw('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3M21 3v18"/></svg>'),
  chev: raw('<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>'),
  left: raw('<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>'),
  right: raw('<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'),
  external: raw('<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>'),
};

export const skeleton = (n = 1) => raw(Array.from({ length: n }, () => '<div class="card sk-card"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>').join('<div style="height:14px"></div>'));

export const errorBox = (e) => html`<div class="error">${e?.message || String(e)}</div>`;

export const empty = (title, sub) => html`<div class="card"><div class="empty"><b>${title}</b>${sub ? html`<span>${sub}</span>` : ''}</div></div>`;

export const select = (id, opts, value, { label } = {}) => html`
  <label class="select" ${label ? html`title="${label}"` : ''}>
    <select id="${id}">${opts.map((o) => html`<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`)}</select>
  </label>`;

export const seg = (id, opts, value) => html`
  <div class="seg" id="${id}">${opts.map((o) => html`<button data-v="${o.value}" class="${o.value === value ? 'active' : ''}">${o.label}</button>`)}</div>`;

export const stat = (label, value, foot, unit) => html`
  <div class="card stat"><div class="label">${label}</div><div class="value">${value}${unit ? html`<small>${unit}</small>` : ''}</div>${foot ? html`<div class="foot">${foot}</div>` : ''}</div>`;

export const pill = (text, tone = '', extra = '') => html`<span class="pill ${tone} ${extra}">${text}</span>`;

export const bar = (pct, tone = '') => html`<div class="bar ${tone}"><i style="width:${Math.max(0, Math.min(100, pct ?? 0))}%"></i></div>`;
