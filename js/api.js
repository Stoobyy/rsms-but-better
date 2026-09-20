// RSMS data layer — talks straight to the portal (no backend) and parses the
// server-rendered HTML into plain objects. Every page's markup was inspected
// against a live session; selectors below reflect the real structure.

export const BASE = 'https://www.rajagiritech.ac.in/stud/ktu/Student/';

export class SessionError extends Error {
  constructor(msg = 'Your RSMS session has expired. Sign in again.') { super(msg); this.name = 'SessionError'; }
}

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const num = (s) => { const t = clean(s).replace(/,/g, ''); if (!t || t === '-') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const txt = (el) => clean(el?.textContent);

async function request(path, { method = 'GET', params, form } = {}) {
  const url = new URL(path, BASE);
  if (params) for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const init = { method, credentials: 'include', redirect: 'follow', headers: {} };
  if (form) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  }
  const res = await fetch(url, init);
  const buf = await res.arrayBuffer();
  // Most pages are windows-1252; a few (notices) are UTF-8. Try strict UTF-8 first.
  let html;
  try { html = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { html = new TextDecoder('windows-1252').decode(buf); }
  return { res, html, doc: new DOMParser().parseFromString(html, 'text/html') };
}

async function page(path, opts = {}) {
  const { doc } = await request(path, opts);
  if (doc.querySelector('form[action="varify.asp"]') || /Sign in with Google/i.test(doc.body?.textContent || '')) throw new SessionError();
  // <br> carries no whitespace in textContent ("and<br>National" → "andNational"); make it a space.
  if (!opts.keepBreaks) doc.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return doc;
}

/* ---------- generic table helpers (direct children only — pages nest tables deeply) ---------- */
const rowsOf = (table) => [...table.children].flatMap((c) => (c.tagName === 'TBODY' || c.tagName === 'THEAD' ? [...c.children] : [c])).filter((r) => r.tagName === 'TR');
const cellsOf = (tr) => [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
function findTable(doc, pred) {
  for (const t of doc.querySelectorAll('table')) {
    const rows = rowsOf(t);
    const hdrRow = rows.find((r) => cellsOf(r).some((c) => txt(c)));
    if (!hdrRow) continue;
    const headers = cellsOf(hdrRow).map((c) => txt(c).toLowerCase());
    if (pred(headers)) return { table: t, headers, rows: rows.slice(rows.indexOf(hdrRow) + 1) };
  }
  return null;
}
const options = (doc, name) => [...doc.querySelectorAll(`select[name="${name}"] option`)]
  .map((o) => ({ value: clean(o.value || o.textContent), label: txt(o) }))
  .filter((o) => o.value && !/^-?select-?$/i.test(o.label));

/* ---------- auth ---------- */
export async function login(uidRaw) {
  const uid = String(uidRaw || '').trim().replace(/@.*$/, '').toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(uid)) throw new Error('Enter your UID — the part before @rajagiri.edu.in.');
  const { res } = await request('stud_varify.asp', { form: { email: `${uid}@rajagiri.edu.in` } });
  if (/stat=No/i.test(res.url)) throw new Error('RSMS doesn’t recognise that UID.');
  await request('Session_Setter.php', { params: { SVal: uid } });
  const me = await home();
  if (!me.name) throw new Error('RSMS didn’t open a session. Try again.');
  return { uid, ...me };
}
export async function logout() { try { await request('Logout.asp'); } catch { /* ignore */ } }

/* ---------- Home.asp → { name, photo } ---------- */
export async function home() {
  const doc = await page('Home.asp');
  const m = txt(doc.querySelector('.scroller')).match(/Logged In User\s*:\s*(.*)$/i);
  const img = doc.querySelector('img[src*="Photo/"]');
  return { name: m ? clean(m[1]) : '', photo: img ? new URL(img.getAttribute('src'), BASE).href : null };
}

/* ---------- FileUp.php → profile fields ---------- */
export async function profile() {
  const doc = await page('FileUp.php');
  const fields = {};
  for (const t of doc.querySelectorAll('table')) {
    const rows = rowsOf(t);
    if (rows.length !== 1) continue;
    const c = cellsOf(rows[0]);
    if (c.length !== 2) continue;
    const label = txt(c[0]).replace(/\s*:\s*$/, '');
    if (label && !c[1].querySelector('input,form')) fields[label] = txt(c[1]);
  }
  const img = doc.querySelector('img[src*="Photo/"]:not([src*="avathar"])');
  return { fields, photo: img ? new URL(img.getAttribute('src'), BASE).href : null };
}

/* ---------- class codes & exam types (Mark.asp) ---------- */
export async function classCodes() {
  const doc = await page('Mark.asp');
  return options(doc, 'code').map((o) => ({ ...o, ...parseClassCode(o.value) }));
}
export function parseClassCode(code) {
  const m = code.match(/^(\d{4})S(\d)([A-Z]+)-?([A-Z0-9]*)$/i);
  return m ? { year: +m[1], sem: +m[2], branch: m[3], section: m[4] } : { sem: null };
}
export async function examTypes(code) {
  const doc = await page('Mark.asp', { params: { code } });
  return options(doc, 'E_ID');
}

/* ---------- Mark.asp / Mark_Sessional.asp → marks per subject ---------- */
function parseMarksTable(doc) {
  const legend = new Map();
  const leg = findTable(doc, (h) => h[1] === 'code' && h[2]?.startsWith('subject'));
  if (leg) for (const r of leg.rows) { const c = cellsOf(r); if (c[1]) legend.set(txt(c[1]), txt(c[2])); }

  const mt = findTable(doc, (h) => h.includes('roll no') && h.includes('name'));
  if (!mt) return { student: null, subjects: [] };
  const hdrCells = cellsOf(rowsOf(mt.table)[0]);
  const dataRow = mt.rows.find((r) => cellsOf(r).some((c) => txt(c)));
  const vals = dataRow ? cellsOf(dataRow).map(txt) : [];
  // Header cell is `<b>102802/CO300A</b><br>50` (max after the <br>; absent on the sessional page).
  const subjects = hdrCells.slice(3).map((c, i) => {
    const b = c.querySelector('b');
    const code = txt(b || c);
    const rest = b ? clean(c.textContent.replace(b.textContent, '')) : '';
    return { code, name: legend.get(code) ?? null, max: num(rest), mark: num(vals[i + 3]) };
  }).filter((s) => s.code);
  return { student: { rollNo: vals[1] ?? null, name: vals[2] ?? null }, subjects };
}
export async function marks(code, examId) {
  const doc = await page('Mark.asp', { params: { code, E_ID: examId } });
  return { ...parseMarksTable(doc), examTypes: options(doc, 'E_ID') };
}
export async function sessional(code) {
  return parseMarksTable(await page('Mark_Sessional.asp', { params: { code } }));
}

/* ---------- Mark_Internal_Report.asp → question-wise split-up (current semester only) ---------- */
export async function splitupOptions(code) {
  const doc = await page('Mark_Internal_Report.asp', { form: { Class_Code: code } });
  return { classCodes: options(doc, 'Class_Code'), subjects: options(doc, 'Subject_Code') };
}
export async function splitupComponents(code, subject) {
  const doc = await page('Mark_Internal_Report.asp', { form: { Class_Code: code, Subject_Code: subject } });
  return options(doc, 'E_Id');
}
export async function splitup(code, subject, examId) {
  const doc = await page('Mark_Internal_Report.asp', { form: { Class_Code: code, Subject_Code: subject, E_Id: examId } });
  const t = findTable(doc, (h) => h.length > 2 && h.some((x) => /^qn\.?\s*\d/.test(x)));
  if (!t) return { questions: [], total: null, empty: true };
  const hdr = cellsOf(rowsOf(t.table)[0]).map(txt);
  const vals = t.rows.length ? cellsOf(t.rows[0]).map(txt) : [];
  const questions = [];
  let total = null, totalMax = 0;
  hdr.forEach((h, i) => {
    const q = h.match(/Qn\.?\s*(\d+)\s*Max\s*:?\s*([\d.]+)/i);
    if (q) { questions.push({ q: +q[1], max: num(q[2]), mark: num(vals[i]) }); totalMax += num(q[2]) ?? 0; }
    else if (/total/i.test(h)) total = num(vals[i]);
  });
  return { questions, total, totalMax, empty: false };
}

/* ---------- Marks_Rexa.asp → every semester's marklist + SGPAs + CGPA ---------- */
export async function results() {
  const doc = await page('Marks_Rexa.asp');
  const t = findTable(doc, (h) => h.includes('sem') && h.includes('course name'));
  const semesters = new Map();
  if (t) for (const r of t.rows) {
    const c = cellsOf(r).map(txt);
    if (c.length < 10 || !/^S\d/i.test(c[1])) continue;
    const sem = c[1].toUpperCase();
    if (!semesters.has(sem)) semesters.set(sem, { sem, courses: [], sgpa: null, credits: null });
    semesters.get(sem).courses.push({ name: c[2], credit: num(c[3]), code: c[4], internal: num(c[5]), external: num(c[6]), total: num(c[7]), grade: c[8] || null, gradePoint: num(c[9]) });
  }
  const body = clean(doc.body.textContent);
  for (const m of body.matchAll(/SGPA\s*:\s*([\d.]+)\s*Total Earned Credits in (S\d)\s*:\s*(\d+)/gi)) {
    const s = semesters.get(m[2].toUpperCase()); if (s) { s.sgpa = num(m[1]); s.credits = num(m[3]); }
  }
  const cg = body.match(/CGPA\s*:\s*([\d.]+)\s*Total Earned Credits\s*:\s*(\d+)/i);
  const gt = findTable(doc, (h) => h[0] === 'grade' && h[1]?.startsWith('grade point'));
  const gradeScale = gt ? gt.rows.map((r) => cellsOf(r).map(txt)).filter((r) => r[0]).map((r) => ({ grade: r[0], point: num(r[1]), range: r[2] })) : [];
  const student = {
    name: body.match(/Name of Student\s*:\s*(.+?)\s+Register Number/i)?.[1] ?? null,
    registerNo: body.match(/Register Number\s*:\s*([A-Z0-9]+)/i)?.[1] ?? null,
  };
  return { student, semesters: [...semesters.values()].sort((a, b) => a.sem.localeCompare(b.sem)), cgpa: cg ? num(cg[1]) : null, totalCredits: cg ? num(cg[2]) : null, gradeScale };
}

/* ---------- Leave.asp → attendance exceptions grid ---------- */
export const ATT_COLORS = { '#9f0000': 'Leave', '#006600': 'Approved Leave', '#ff9900': 'Duty Leave', '#cccc00': 'Duty Attendance' };
export async function attendance(code) {
  const doc = await page('Leave.asp', { params: { code } });
  const days = [];
  for (const tr of doc.querySelectorAll('tr')) {
    const c = cellsOf(tr);
    if (!/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(txt(c[0]))) continue;
    const periods = c.slice(1).map((cell, i) => {
      const subject = txt(cell);
      if (!subject) return null;
      const color = (cell.getAttribute('bgcolor') || '').toLowerCase();
      return { period: i + 1, subject, shortCode: subject.replace(/^.*?\//, ''), category: ATT_COLORS[color] || 'Marked', color };
    }).filter(Boolean);
    days.push({ date: txt(c[0]), periods });
  }
  return { days, classCodes: options(doc, 'code') };
}

/* ---------- Academic_Calendar.asp → month grid ---------- */
export async function calendar(month, year) {
  const doc = await page('Academic_Calendar.asp', { params: { Dater: `${month}/20/${year}` } });
  const title = clean(doc.body.textContent).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  const days = [];
  const grid = [...doc.querySelectorAll('table')].find((t) => rowsOf(t).some((r) => cellsOf(r).map(txt).join(',').startsWith('Sun,Mon')));
  if (grid) {
    for (const tr of rowsOf(grid)) for (const cell of cellsOf(tr)) {
      const inner = cell.querySelector('table');
      if (!inner) continue;
      const lines = rowsOf(inner).map((r) => txt(r));
      const day = Number(lines[0]);
      if (!day) continue;
      const events = lines.slice(1).filter((l) => l.includes('»')).flatMap((l) => l.split('»').map(clean).filter(Boolean));
      const counter = rowsOf(inner).slice(1).map((r) => cellsOf(r)[0]).find((c) => /working day/i.test(c?.getAttribute('title') || ''));
      const isHoliday = events.some((e) => /holiday/i.test(e));
      days.push({ day, events, academicDay: counter ? num(txt(counter)) : null, isHoliday });
    }
  }
  return { month, year, title: title ? `${title[1]} ${title[2]}` : null, days };
}

/* ---------- Activity.asp → submissions per category ---------- */
export const ACTIVITY_CATEGORIES = [
  [11, 'NCC / NSS'], [12, 'Sports / Games'], [13, 'Music, Performing Arts & Literary'], [14, 'Tech fest / Technical Quiz'],
  [15, 'MOOC / Add-on courses'], [16, 'MOOC with final exam certificate'], [17, 'Professional society competitions'],
  [18, 'Webinars, Conferences, Workshops'], [19, 'Paper / Poster presentation'], [20, 'Industrial training / Internship'],
  [21, 'Industrial exhibition / Visit'], [22, 'Foreign language skills'], [23, 'Startup'], [24, 'Patent'],
  [25, 'Product / Prototype'], [26, 'Society / Association / Club'], [27, 'Elected student representative'],
].map(([id, label]) => ({ id, label }));

export async function activity(code, category) {
  const doc = await page('Activity.asp', { form: { Class_Code: code, ACode: category } });
  const t = findTable(doc, (h) => h.some((x) => x.startsWith('name of event')));
  const entries = [];
  if (t) for (const r of t.rows) {
    const c = cellsOf(r);
    if (c.length < 15 || !/^\d+$/.test(txt(c[0]))) continue;
    const cert = c[11].querySelector('a');
    entries.push({
      activity: txt(c[1]), event: txt(c[2]), fest: txt(c[3]), start: txt(c[4]), end: txt(c[5]), days: num(txt(c[6])),
      institution: txt(c[7]), prize: txt(c[8]), level: txt(c[9]), cash: num(txt(c[10])),
      certificate: cert ? new URL(cert.getAttribute('href'), BASE).href : null,
      category: txt(c[12]), points: num(txt(c[13])), status: txt(c[14]),
    });
  }
  return { entries, classCodes: options(doc, 'Class_Code') };
}

/* ---------- Notice.asp → current notice + previous list ---------- */
const BLOCKED_TAGS = 'script,style,iframe,object,embed,form,input,button,link,meta';
function sanitize(container) {
  container.querySelectorAll(BLOCKED_TAGS).forEach((e) => e.remove());
  for (const el of container.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'id' || n === 'width' || n === 'height' || n === 'align' || n === 'face' || n === 'size' || n === 'color') el.removeAttribute(a.name);
      if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    if (el.tagName === 'IMG' && el.getAttribute('src') && !el.getAttribute('src').startsWith('data:')) el.setAttribute('src', new URL(el.getAttribute('src'), BASE).href);
  }
  return container.innerHTML;
}
function parseNotice(doc) {
  const cell = [...doc.querySelectorAll('td')].filter((e) => /Notice No/i.test(e.textContent) && !e.querySelector('table'))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!cell) return null;
  const t = txt(cell);
  const bodyEl = cell.querySelector('div[style*="width"]') || cell;
  const body = sanitize(bodyEl.cloneNode(true)).replace(/<p>(\s|&nbsp;)*<\/p>/gi, '').trim();
  return {
    number: t.match(/Notice No\s*:\s*(\S+)/i)?.[1] ?? null,
    date: t.match(/Date\s*:\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d{1,2},\s*\d{4})/i)?.[1] ?? null,
    html: body,
  };
}
export async function notices(nid) {
  const doc = await page('Notice.asp', { keepBreaks: true, params: nid ? { NID: nid, NC: '68' } : undefined });
  const list = [];
  for (const tr of doc.querySelectorAll('tr')) {
    const c = cellsOf(tr);
    if (c.length !== 3 || !/^\d+$/.test(txt(c[0]))) continue;
    const a = c[2].querySelector('a');
    const id = (a?.getAttribute('href') || '').match(/NID=([^&]+)/i)?.[1] ?? null;
    list.push({ id, date: txt(c[1]), title: txt(c[2]) });
  }
  return { current: parseNotice(doc), previous: list };
}

/* ---------- FeeBook.asp ---------- */
export async function fees() {
  const doc = await page('FeeBook.asp');
  const items = [];
  for (const tr of doc.querySelectorAll('tr')) {
    const c = cellsOf(tr);
    if (c.length !== 3 || !/^\d+$/.test(txt(c[0])) || !/₹|Fee/i.test(c[1].textContent)) continue;
    const b = c[1].querySelector('b');
    const oid = (c[2].innerHTML.match(/Receipt\.asp\?OId=(\d+)/i) || [])[1];
    items.push({ title: txt(b) || txt(c[1]), amount: clean(c[1].textContent.replace(b?.textContent || '', '')), receipt: oid ? `${BASE}Receipt.asp?OId=${oid}` : null });
  }
  return items;
}

/* ---------- Certificate.asp ---------- */
export async function certificates() {
  const doc = await page('Certificate.asp');
  const t = [...doc.querySelectorAll('table')].find((x) => /RSET Certificate/i.test(x.textContent) && rowsOf(x).length >= 2);
  const rows = t ? rowsOf(t).slice(1).map((r) => ({ text: txt(r), link: r.querySelector('a') ? new URL(r.querySelector('a').getAttribute('href'), BASE).href : null })) : [];
  const empty = rows.length === 0 || rows.every((r) => /no certificates/i.test(r.text));
  return { empty, rows: empty ? [] : rows };
}
