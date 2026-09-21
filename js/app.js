import * as api from './api.js';
import { html, raw, mount, icon, skeleton, errorBox, empty, select, seg, stat, pill, bar, fmt, gradeTone, pctTone, parsePortalDate } from './ui.js';

/* ============================================================
   State, cache, router
   ============================================================ */
const app = document.getElementById('app');
const state = { me: null, classCodes: null };

const cache = new Map();
const cached = (key, fn, { ttl = 5 * 60 * 1000 } = {}) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { t: Date.now(), p });
  return p;
};
const invalidate = () => cache.clear();

const routes = {
  '': overview, attendance, marks, splitup, results, calendar, activity, notices, fees, profile,
};
const NAV = [
  { group: 'Academics' },
  { id: '', label: 'Overview', icon: 'home' },
  { id: 'attendance', label: 'Attendance', icon: 'attendance' },
  { id: 'marks', label: 'Internal marks', icon: 'marks' },
  { id: 'splitup', label: 'Mark split-up', icon: 'split' },
  { id: 'results', label: 'Results', icon: 'results' },
  { group: 'Campus' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'activity', label: 'Activity points', icon: 'activity' },
  { id: 'notices', label: 'Notices', icon: 'notices' },
  { id: 'fees', label: 'Fees & certificates', icon: 'fees' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
];
const TABS = ['', 'attendance', 'marks', 'results', 'calendar'];

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = hash.split('/');
  return { name: routes[name] ? name : '', params: rest.map(decodeURIComponent) };
}
window.addEventListener('hashchange', () => renderRoute());

/* ============================================================
   Boot / auth
   ============================================================ */
async function boot() {
  mount(app, html`<div class="login"><div class="card" style="text-align:center;color:var(--text-3)">Checking session…</div></div>`);
  try {
    const me = await api.home();
    if (me.name) { state.me = { ...me, uid: localStorage.getItem('rsms.uid') }; return renderRoute(); }
  } catch { /* not logged in */ }
  renderLogin();
}

function renderLogin(err) {
  const remembered = localStorage.getItem('rsms.uid') || '';
  mount(app, html`
    <div class="login">
      <form class="card fade-in" id="loginForm">
        <div class="brand"><span class="mark">R</span>rsms <em>but better</em></div>
        <h1>Sign in</h1>
        <p>Use your college UID — the part before <b>@rajagiri.edu.in</b>.</p>
        ${err ? html`<div class="error" style="margin-bottom:14px">${err}</div>` : ''}
        <div class="field">
          <input id="uid" name="uid" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="u2xxxxxx" value="${remembered}" autofocus />
          <span class="suffix">@rajagiri.edu.in</span>
        </div>
        <button class="btn primary" type="submit" id="loginBtn">Continue</button>
      </form>
    </div>`);
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const me = await api.login(form.uid.value);
      localStorage.setItem('rsms.uid', me.uid);
      state.me = me; invalidate();
      location.hash = '#/';
      renderRoute();
    } catch (e2) {
      renderLogin(e2.message);
    }
  });
}

async function doLogout() {
  await api.logout();
  state.me = null; invalidate();
  renderLogin();
}

/* ============================================================
   Shell
   ============================================================ */
function shell(active, content) {
  const me = state.me;
  const navLink = (n, cls = '') => html`<a href="#/${n.id}" class="${n.id === active ? 'active' : ''} ${cls}">${icon[n.icon]}<span>${n.label}</span></a>`;
  return html`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="mark">R</span>rsms <em>but better</em></div>
        <nav class="nav">${NAV.map((n) => (n.group ? html`<div class="group">${n.group}</div>` : navLink(n)))}</nav>
        <div class="spacer"></div>
        <a class="btn ghost sm" style="justify-content:flex-start;margin-bottom:8px" href="Home.asp?original=1">Original portal ↗</a>
        <div class="userchip">
          ${me?.photo ? html`<img class="avatar" src="${me.photo}" alt="" />` : html`<div class="avatar"></div>`}
          <div class="who"><div class="name">${titleCase(me?.name)}</div><div class="sub">${me?.uid || 'Student'}</div></div>
          <button id="logout" title="Sign out">${icon.logout}</button>
        </div>
      </aside>
      <main class="main"><div class="page fade-in" id="page">
        <div class="mobile-top"><div class="brand" style="padding:0"><span class="mark">R</span>rsms <em>but better</em></div><button class="btn ghost sm" id="logoutM">Sign out</button></div>
        ${content}
      </div></main>
      <nav class="tabbar">
        ${TABS.map((t) => navLink(NAV.find((n) => n.id === t)))}
      </nav>
    </div>`;
}

async function renderRoute() {
  if (!state.me) return renderLogin();
  const { name, params } = route();
  mount(app, shell(name, skeleton(3)));
  document.getElementById('logout')?.addEventListener('click', doLogout);
  document.getElementById('logoutM')?.addEventListener('click', doLogout);
  const page = document.getElementById('page');
  try {
    await routes[name](page, ...params);
  } catch (e) {
    if (e instanceof api.SessionError) return renderLogin(e.message);
    console.error(e);
    setPage(page, 'Something went wrong', errorBox(e));
  }
  window.scrollTo({ top: 0 });
}

function setPage(page, title, body, { subtitle, controls } = {}) {
  const top = page.querySelector('.mobile-top')?.outerHTML || '';
  page.innerHTML = raw(top).__raw + html`
    <div class="page-head">
      <div><h1>${title}</h1>${subtitle ? html`<p>${subtitle}</p>` : ''}</div>
      ${controls ? html`<div class="controls">${controls}</div>` : ''}
    </div>
    <div id="body">${body}</div>`.__raw;
  page.querySelector('#logoutM')?.addEventListener('click', doLogout);
  return page.querySelector('#body');
}

/* ============================================================
   Shared data
   ============================================================ */
const getClassCodes = () => cached('classCodes', api.classCodes, { ttl: 60 * 60 * 1000 });
const getResults = () => cached('results', api.results);
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const semLabel = (c) => (c.sem ? `Semester ${c.sem}` : c.value);
const codeOptions = (codes) => codes.map((c) => ({ value: c.value, label: `${semLabel(c)} · ${c.value}` }));
const pref = (k, v) => (v === undefined ? sessionStorage.getItem('rsms.' + k) : sessionStorage.setItem('rsms.' + k, v));
// Short subject code (e.g. CO300A) → course name, taken from the legend on the internal-marks pages.
const subjectNames = (code) => cached(`names:${code}`, async () => {
  const pick = (d) => Object.fromEntries(d.subjects.filter((s) => s.name).map((s) => [s.code.replace(/^.*?\//, ''), s.name]));
  let names = pick(await cached(`sess:${code}`, () => api.sessional(code)));
  if (!Object.keys(names).length) {
    const types = await cached(`exams:${code}`, () => api.examTypes(code));
    if (types[0]) names = pick(await cached(`marks:${code}:${types[0].value}`, () => api.marks(code, types[0].value)));
  }
  return names;
});

/* ============================================================
   Overview
   ============================================================ */
async function overview(page) {
  const me = state.me;
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = titleCase(me.name).split(' ')[0];

  const body = setPage(page, '', html`
    <div class="hero">
      ${me.photo ? html`<img class="avatar" src="${me.photo}" alt="" />` : html`<div class="avatar"></div>`}
      <div><h1>${greet}, ${first}</h1><p>${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
    </div>
    <div id="stats" class="grid c4">${skeleton()}</div>
    <div class="grid c2 section">
      <div id="sgpa"></div>
      <div id="upcoming"></div>
    </div>
    <div class="grid c2 section">
      <div id="att"></div>
      <div id="notice"></div>
    </div>`);
  page.querySelector('.page-head').remove();

  const [codes, res] = await Promise.all([getClassCodes(), getResults().catch((e) => ({ error: e }))]);
  const current = codes[0];
  const stats = body.querySelector('#stats');
  if (res.error) stats.innerHTML = errorBox(res.error).__raw;
  else {
    const last = res.semesters[res.semesters.length - 1];
    stats.innerHTML = html`
      ${stat('CGPA', fmt.n(res.cgpa), `${res.totalCredits ?? '—'} credits earned`)}
      ${stat('Latest SGPA', fmt.n(last?.sgpa), last ? `Semester ${last.sem.slice(1)}` : '')}
      ${stat('Current semester', current?.sem ?? '—', current?.value)}
      ${stat('Semesters cleared', res.semesters.length, `of 8`)}`.__raw;

    body.querySelector('#sgpa').innerHTML = html`
      <div class="card pad">
        <div class="section-title"><h2>SGPA by semester</h2><a href="#/results" class="hint">All results</a></div>
        <div class="sgpa-row">${res.semesters.map((s) => html`<div class="sgpa-tile"><div class="s">${s.sem}</div><div class="v">${fmt.n(s.sgpa)}</div><div class="c">${s.credits ?? '—'} cr</div></div>`)}</div>
      </div>`.__raw;
  }

  // Upcoming events (this month + next)
  const up = body.querySelector('#upcoming');
  up.innerHTML = skeleton().__raw;
  try {
    const m = now.getMonth() + 1, y = now.getFullYear();
    const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
    const [c1, c2] = await Promise.all([cached(`cal:${m}-${y}`, () => api.calendar(m, y)), cached(`cal:${nm}-${ny}`, () => api.calendar(nm, ny))]);
    const today = now.getDate();
    const items = [
      ...c1.days.filter((d) => d.events.length && d.day >= today).map((d) => ({ ...d, m, y })),
      ...c2.days.filter((d) => d.events.length).map((d) => ({ ...d, m: nm, y: ny })),
    ].slice(0, 5);
    up.innerHTML = html`
      <div class="card">
        <div class="section-title" style="padding:18px 20px 0"><h2>Coming up</h2><a href="#/calendar" class="hint">Calendar</a></div>
        ${items.length ? html`<ul class="list agenda">${items.map((d) => html`
          <li><div class="dayn">${d.day}<small>${new Date(d.y, d.m - 1, 1).toLocaleString('en', { month: 'short' }).toUpperCase()}</small></div>
          <div class="grow"><div class="title">${d.events.join(' · ')}</div>${d.academicDay ? html`<div class="meta">Working day ${d.academicDay}</div>` : ''}</div>
          ${d.isHoliday ? pill('Holiday', 'red') : ''}</li>`)}</ul>` : html`<div class="empty">Nothing scheduled</div>`}
      </div>`.__raw;
  } catch (e) { up.innerHTML = errorBox(e).__raw; }

  // Attendance exceptions for the current semester
  const att = body.querySelector('#att');
  att.innerHTML = skeleton().__raw;
  try {
    const a = await cached(`att:${current.value}`, () => api.attendance(current.value));
    const counts = {};
    for (const d of a.days) for (const p of d.periods) counts[p.category] = (counts[p.category] || 0) + 1;
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    att.innerHTML = html`
      <div class="card pad">
        <div class="section-title"><h2>Attendance · ${semLabel(current)}</h2><a href="#/attendance" class="hint">Details</a></div>
        <div style="font-size:30px;font-weight:700;letter-spacing:-.03em">${total}<small style="font-size:14px;color:var(--text-3);font-weight:500;margin-left:6px">periods marked</small></div>
        <div class="periods" style="margin-top:12px">
          ${Object.entries(counts).map(([k, v]) => html`<span class="period ${attClass(k)}">${k} <i>${v}</i></span>`)}
          ${!total ? html`<span class="dim">No leave or duty entries yet.</span>` : ''}
        </div>
      </div>`.__raw;
  } catch (e) { att.innerHTML = errorBox(e).__raw; }

  // Latest notice
  const nt = body.querySelector('#notice');
  nt.innerHTML = skeleton().__raw;
  try {
    const n = await cached('notices', () => api.notices());
    nt.innerHTML = html`
      <div class="card">
        <div class="section-title" style="padding:18px 20px 0"><h2>Latest notices</h2><a href="#/notices" class="hint">All notices</a></div>
        <ul class="list">${n.previous.slice(0, 4).map((x) => html`<li class="link" onclick="location.hash='#/notices/${x.id}'"><div class="grow"><div class="title">${x.title}</div><div class="meta">${x.date}</div></div></li>`)}</ul>
      </div>`.__raw;
  } catch (e) { nt.innerHTML = errorBox(e).__raw; }
}

/* ============================================================
   Attendance
   ============================================================ */
const attClass = (cat) => ({ 'Leave': 'leave', 'Approved Leave': 'approved', 'Duty Leave': 'duty', 'Duty Attendance': 'dutyatt' }[cat] || '');

async function attendance(page) {
  const codes = await getClassCodes();
  let code = pref('att.code') || codes[0].value;

  const draw = async () => {
    const body = setPage(page, 'Attendance', skeleton(2), {
      subtitle: 'Leave and duty entries by date and subject.',
      controls: select('code', codeOptions(codes), code),
    });
    page.querySelector('#code').addEventListener('change', (e) => { code = e.target.value; pref('att.code', code); draw(); });
    try {
      const [a, names] = await Promise.all([cached(`att:${code}`, () => api.attendance(code)), subjectNames(code).catch(() => ({}))]);
      const counts = {}, bySubject = {};
      for (const d of a.days) for (const p of d.periods) {
        counts[p.category] = (counts[p.category] || 0) + 1;
        bySubject[p.shortCode] ??= { total: 0 };
        bySubject[p.shortCode][p.category] = (bySubject[p.shortCode][p.category] || 0) + 1;
        bySubject[p.shortCode].total++;
      }
      const total = a.days.reduce((n, d) => n + d.periods.length, 0);
      const cats = ['Leave', 'Approved Leave', 'Duty Leave', 'Duty Attendance'];
      body.innerHTML = html`
        <div class="grid c4">
          ${cats.map((c) => stat(c, counts[c] || 0, 'periods'))}
        </div>
        ${total ? html`
        <div class="section grid c2" style="align-items:start">
          <div class="card">
            <div class="section-title" style="padding:18px 20px 0"><h2>By date</h2><span class="hint">${a.days.length} days</span></div>
            ${[...a.days].reverse().map((d) => { const f = fmt.date(d.date); return html`
              <div class="att-day">
                <div class="date">${f.day} ${f.month}<small>${f.dow}</small></div>
                <div class="periods">${d.periods.map((p) => html`<span class="period ${attClass(p.category)}" title="${p.category} · ${names[p.shortCode] || p.subject}"><i>${p.period}</i>${p.shortCode}</span>`)}</div>
              </div>`; })}
          </div>
          <div class="card">
            <div class="section-title" style="padding:18px 20px 0"><h2>By subject</h2></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Subject</th><th class="num">Leave</th><th class="num">Approved</th><th class="num">Duty</th><th class="num">Total</th></tr></thead>
              <tbody>${Object.entries(bySubject).sort((x, y) => y[1].total - x[1].total).map(([s, v]) => html`
                <tr><td>${names[s] ? html`<div class="strong">${names[s]}</div><div class="dim small">${s}</div>` : html`<span class="strong">${s}</span>`}</td><td class="num">${v['Leave'] || 0}</td><td class="num">${v['Approved Leave'] || 0}</td><td class="num">${(v['Duty Leave'] || 0) + (v['Duty Attendance'] || 0)}</td><td class="num strong">${v.total}</td></tr>`)}
              </tbody></table></div>
            <div style="padding:14px 20px" class="legend">
              <span style="--c:var(--red)">Leave</span><span style="--c:var(--green)">Approved leave</span><span style="--c:var(--amber)">Duty leave</span><span style="--c:var(--blue)">Duty attendance</span>
            </div>
          </div>
        </div>` : html`<div class="section">${empty('Clean record', 'No leave or duty entries for this semester.')}</div>`}`.__raw;
    } catch (e) { if (e instanceof api.SessionError) throw e; body.innerHTML = errorBox(e).__raw; }
  };
  await draw();
}

/* ============================================================
   Internal marks (exam-wise + sessional)
   ============================================================ */
async function marks(page) {
  const codes = await getClassCodes();
  let code = pref('marks.code') || codes[0].value;
  let mode = pref('marks.mode') || 'exam';
  let examId = pref('marks.exam') || null;
  let examTypes = [];

  const draw = async () => {
    const body = setPage(page, 'Internal marks', skeleton(2), {
      subtitle: mode === 'exam' ? 'Marks for one assessment component.' : 'Aggregated internal marks for the semester.',
      controls: html`${seg('mode', [{ value: 'exam', label: 'By exam' }, { value: 'sessional', label: 'Sessional' }], mode)}
        ${select('code', codeOptions(codes), code)}
        ${mode === 'exam' && examTypes.length ? select('exam', examTypes, examId) : ''}`,
    });
    page.querySelector('#mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v; pref('marks.mode', mode); draw(); });
    page.querySelector('#code').addEventListener('change', (e) => { code = e.target.value; pref('marks.code', code); examTypes = []; draw(); });
    page.querySelector('#exam')?.addEventListener('change', (e) => { examId = e.target.value; pref('marks.exam', examId); draw(); });

    try {
      let data;
      if (mode === 'sessional') data = await cached(`sess:${code}`, () => api.sessional(code));
      else {
        if (!examTypes.length || !examId) {
          examTypes = await cached(`exams:${code}`, () => api.examTypes(code));
          if (!examTypes.some((t) => t.value === examId)) examId = examTypes[0]?.value ?? null;
          if (!examId) { body.innerHTML = empty('No exam types listed', 'No assessment components for this class code.').__raw; return; }
          return draw();
        }
        data = await cached(`marks:${code}:${examId}`, () => api.marks(code, examId));
      }
      const rows = data.subjects.filter((s) => s.mark != null || s.max != null);
      if (!rows.length) { body.innerHTML = empty('Nothing published yet', 'No marks entered for this selection.').__raw; return; }
      const withMax = rows.filter((s) => s.max && s.mark != null);
      const totalMark = withMax.reduce((n, s) => n + s.mark, 0), totalMax = withMax.reduce((n, s) => n + s.max, 0);
      body.innerHTML = html`
        ${withMax.length ? html`<div class="grid c3">
          ${stat('Overall', `${fmt.n(totalMark)} / ${totalMax}`, `${withMax.length} subjects`)}
          ${stat('Average', `${fmt.n((totalMark / totalMax) * 100, 1)}`, 'across subjects with a max', '%')}
          ${stat('Best', fmt.n(Math.max(...withMax.map((s) => (s.mark / s.max) * 100)), 1), withMax.reduce((b, s) => (s.mark / s.max > (b.mark / b.max) ? s : b)).code, '%')}
        </div>` : ''}
        <div class="card section">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Subject</th><th>Code</th><th class="num">Marks</th>${withMax.length ? html`<th style="width:180px"></th>` : ''}</tr></thead>
            <tbody>${rows.map((s) => { const p = s.max ? (s.mark / s.max) * 100 : null; return html`
              <tr>
                <td class="strong">${s.name ? titleCase(s.name) : s.code}</td>
                <td class="mono dim">${s.code}</td>
                <td class="num strong">${s.mark == null ? html`<span class="dim">—</span>` : fmt.n(s.mark)}${s.max ? html`<span class="dim"> / ${s.max}</span>` : ''}</td>
                ${withMax.length ? html`<td>${p != null ? bar(p, pctTone(p)) : ''}</td>` : ''}
              </tr>`; })}
            </tbody></table></div>
        </div>`.__raw;
    } catch (e) { if (e instanceof api.SessionError) throw e; body.innerHTML = errorBox(e).__raw; }
  };
  await draw();
}

/* ============================================================
   Internal mark split-up (question-wise; current semester only)
   ============================================================ */
async function splitup(page) {
  let opts = null, subject = pref('split.subject'), comp = pref('split.comp'), code = null, data = null;

  const draw = async () => {
    const body = setPage(page, 'Mark split-up', skeleton(1), {
      subtitle: 'Question-wise marks for each internal assessment.',
      controls: opts ? select('subject', opts.subjects, subject) : '',
    });
    page.querySelector('#subject')?.addEventListener('change', (e) => { subject = e.target.value; pref('split.subject', subject); data = null; comp = null; draw(); });
    try {
      if (!opts) {
        const codes = await getClassCodes();
        code = codes[0].value;
        opts = await cached('split:opts', () => api.splitupOptions(code));
        code = opts.classCodes[0]?.value || code;
        if (!opts.subjects.length) { body.innerHTML = empty('Nothing to show yet', 'No subjects with internal marks yet this semester.').__raw; return; }
        if (!opts.subjects.some((s) => s.value === subject)) subject = opts.subjects[0].value;
        return draw();
      }
      if (!data) {
        // One request per component, in parallel — so we can show all of them as tabs.
        data = await cached(`split:${subject}`, async () => {
          const components = await api.splitupComponents(code, subject);
          const results = await Promise.all(components.map((c) => api.splitup(code, subject, c.value).then((r) => ({ ...c, ...r }))));
          return results;
        });
      }
      const withData = data.filter((d) => !d.empty && d.questions.length);
      if (!data.length) {
        // Nothing for this subject: if the user didn't pick it, move on to the next subject that has something.
        const next = !pref('split.subject') && opts.subjects[opts.subjects.findIndex((x) => x.value === subject) + 1];
        if (next) { subject = next.value; data = null; return draw(); }
        body.innerHTML = empty('No assessments yet', 'No internal components have been published for this subject.').__raw; return;
      }
      if (!data.some((d) => d.value === comp)) comp = (withData[0] || data[0]).value;
      const d = data.find((x) => x.value === comp);
      const subj = opts.subjects.find((s) => s.value === subject);
      body.innerHTML = html`
        <div style="margin-bottom:16px">${seg('comp', data.map((c) => ({ value: c.value, label: shortComp(c.label) + (c.empty ? ' ·' : '') })), comp)}</div>
        <div class="card pad">
          <div class="section-title"><div><h2>${subj?.label}</h2><div class="dim small">${d.label} · ${subject}</div></div>
            ${!d.empty ? html`<div style="text-align:right"><div style="font-size:26px;font-weight:700;letter-spacing:-.03em">${fmt.n(d.total)}</div><div class="small dim">total</div></div>` : ''}</div>
          ${d.empty || !d.questions.length ? html`<div class="empty" style="padding:28px 0 8px"><b>Not published</b>Marks for this component haven’t been entered yet.</div>` : html`
          <div class="qgrid" style="margin-top:14px">${d.questions.map((q) => { const p = q.max ? ((q.mark ?? 0) / q.max) * 100 : 0; return html`
            <div class="q"><div class="l">Q${q.q}</div><div class="v">${q.mark == null ? html`<span class="dim">—</span>` : fmt.n(q.mark)}<small> / ${q.max}</small></div>${bar(p, q.mark == null ? '' : pctTone(p))}</div>`; })}
          </div>`}
        </div>
        ${withData.length > 1 ? html`
        <div class="card section">
          <div class="table-wrap"><table class="table"><thead><tr><th>Component</th><th class="num">Total</th></tr></thead>
          <tbody>${withData.map((c) => html`<tr><td class="strong">${c.label}</td><td class="num strong">${fmt.n(c.total)}</td></tr>`)}</tbody></table></div>
        </div>` : ''}`.__raw;
      body.querySelector('#comp').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; comp = b.dataset.v; pref('split.comp', comp); draw(); });
    } catch (e) { if (e instanceof api.SessionError) throw e; body.innerHTML = errorBox(e).__raw; }
  };
  await draw();
}
const shortComp = (l) => l.replace(/Assignment\/ Assignment Test\/ Seminar Presentations/i, 'Assignment').replace(/Internal Exam/i, 'Exam').trim();

/* ============================================================
   Results (end-semester, all semesters)
   ============================================================ */
async function results(page) {
  const body = setPage(page, 'Results', skeleton(3), { subtitle: 'End-semester marklists for every semester published so far.' });
  const r = await getResults();
  if (!r.semesters.length) { body.innerHTML = empty('No results published', '').__raw; return; }
  const allCourses = r.semesters.flatMap((s) => s.courses);
  const gradeCount = {};
  for (const c of allCourses) if (c.grade) gradeCount[c.grade] = (gradeCount[c.grade] || 0) + 1;
  const best = r.semesters.reduce((b, s) => (s.sgpa > (b?.sgpa ?? -1) ? s : b), null);
  body.innerHTML = html`
    <div class="grid c4">
      ${stat('CGPA', fmt.n(r.cgpa), `${r.student?.registerNo || ''}`)}
      ${stat('Credits earned', r.totalCredits ?? '—', `across ${r.semesters.length} semesters`)}
      ${stat('Best semester', fmt.n(best?.sgpa), best ? `Semester ${best.sem.slice(1)}` : '')}
      ${stat('Courses', allCourses.length, Object.entries(gradeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => `${n}× ${g}`).join(' · '))}
    </div>
    <div class="section stack" id="sems">
      ${[...r.semesters].reverse().map((s, i) => html`
        <div class="card sem ${i === 0 ? 'open' : ''}" data-sem="${s.sem}">
          <div class="sem-head">
            <div class="t"><b>Semester ${s.sem.slice(1)}</b><span>${s.courses.length} courses · ${s.credits ?? '—'} credits</span></div>
            <div class="n"><b>${fmt.n(s.sgpa)}</b><span>SGPA</span></div>
            ${icon.chev}
          </div>
          <div class="sem-body"><div class="table-wrap"><table class="table">
            <thead><tr><th>Course</th><th>Code</th><th class="num">Credit</th><th class="num">Internal</th><th class="num">External</th><th class="num">Total</th><th>Grade</th></tr></thead>
            <tbody>${s.courses.map((c) => html`
              <tr><td class="strong">${c.name}</td><td class="mono dim">${c.code}</td><td class="num">${c.credit ?? '—'}</td><td class="num">${fmt.int(c.internal)}</td><td class="num">${fmt.int(c.external)}</td><td class="num strong">${fmt.int(c.total)}</td><td>${pill(c.grade || '—', gradeTone(c.grade))}${c.gradePoint != null ? html`<span class="dim small"> ${c.gradePoint}</span>` : ''}</td></tr>`)}
            </tbody></table></div></div>
        </div>`)}
    </div>
    ${r.gradeScale.length ? html`
    <div class="card section sem" id="scale">
      <div class="sem-head"><div class="t"><b>Grade scale</b><span>How marks map to grade points</span></div>${icon.chev}</div>
      <div class="sem-body"><div class="table-wrap"><table class="table"><thead><tr><th>Grade</th><th class="num">Point</th><th>Marks</th></tr></thead>
        <tbody>${r.gradeScale.map((g) => html`<tr><td>${pill(g.grade, gradeTone(g.grade))}</td><td class="num">${fmt.n(g.point)}</td><td class="muted">${g.range}</td></tr>`)}</tbody></table></div></div>
    </div>` : ''}`.__raw;
  body.querySelectorAll('.sem-head').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
}

/* ============================================================
   Calendar
   ============================================================ */
async function calendar(page, ym) {
  const now = new Date();
  let [y, m] = ym ? ym.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const draw = async () => {
    const title = new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
    const body = setPage(page, 'Academic calendar', skeleton(1), {
      subtitle: 'Holidays, events and the running working-day count.',
      controls: html`<button class="btn sm" id="prev">${icon.left}</button><span style="font-weight:600;min-width:150px;text-align:center">${title}</span><button class="btn sm" id="next">${icon.right}</button><button class="btn sm ghost" id="today">Today</button>`,
    });
    const go = (dm) => { m += dm; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } location.hash = `#/calendar/${y}-${m}`; };
    page.querySelector('#prev').onclick = () => go(-1);
    page.querySelector('#next').onclick = () => go(1);
    page.querySelector('#today').onclick = () => { y = now.getFullYear(); m = now.getMonth() + 1; if (location.hash.replace(/^#\/?/, '') === 'calendar') draw(); else location.hash = '#/calendar'; };
    try {
      const c = await cached(`cal:${m}-${y}`, () => api.calendar(m, y));
      const byDay = new Map(c.days.map((d) => [d.day, d]));
      const first = new Date(y, m - 1, 1).getDay();
      const dim = new Date(y, m, 0).getDate();
      const isToday = (d) => now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
      const cells = [];
      for (let i = 0; i < first; i++) cells.push(html`<div class="day blank"></div>`);
      for (let d = 1; d <= dim; d++) {
        const info = byDay.get(d);
        cells.push(html`<div class="day ${info?.isHoliday ? 'holiday' : ''} ${info?.events.length ? 'has' : ''} ${isToday(d) ? 'today' : ''}">
          <span class="d">${d}</span>${info?.academicDay ? html`<span class="ad" title="Working day of the semester">${info.academicDay}</span>` : ''}
          ${(info?.events || []).map((e) => html`<div class="ev">${e}</div>`)}
        </div>`);
      }
      const events = c.days.filter((d) => d.events.length);
      const working = c.days.filter((d) => d.academicDay).length;
      body.innerHTML = html`
        <div class="card" style="overflow:hidden">
          <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => html`<div class="dow">${d}</div>`)}${cells}</div>
        </div>
        <div class="section">
          <div class="card">
            <div class="section-title" style="padding:18px 20px 0"><h2>This month</h2><span class="hint">${working} working days</span></div>
            ${events.length ? html`<ul class="list agenda">${events.map((d) => html`<li><div class="dayn">${d.day}<small>${new Date(y, m - 1, d.day).toLocaleString('en', { weekday: 'short' }).toUpperCase()}</small></div><div class="grow"><div class="title">${d.events.join(' · ')}</div>${d.academicDay ? html`<div class="meta">Working day ${d.academicDay}</div>` : ''}</div>${d.isHoliday ? pill('Holiday', 'red') : ''}</li>`)}</ul>` : html`<div class="empty">No events this month</div>`}
          </div>
        </div>`.__raw;
    } catch (e) { if (e instanceof api.SessionError) throw e; body.innerHTML = errorBox(e).__raw; }
  };
  await draw();
}

/* ============================================================
   Activity points
   ============================================================ */
async function activity(page) {
  const codes = await getClassCodes();
  let code = pref('act.code') || codes[0].value;
  let cat = Number(pref('act.cat')) || 14;
  let all = false;

  const card = (e) => html`
    <div class="card act">
      <div><h3>${e.event || e.activity}</h3><div class="sub">${[e.activity, e.fest, e.institution].filter((x) => x && x !== '-').join(' · ')}</div></div>
      <div class="pts"><b>${e.points ?? '—'}</b><span>points</span></div>
      <div class="tags">
        ${pill(e.status || 'Pending', /approved/i.test(e.status) ? 'green' : /reject/i.test(e.status) ? 'red' : 'amber')}
        ${e.level ? pill(e.level) : ''}${e.prize ? pill(e.prize) : ''}
        ${e.start ? pill(e.start === e.end || !e.end ? e.start : `${e.start} → ${e.end}`) : ''}
        ${e.sem ? pill(e.sem) : ''}${e.category ? pill(e.category, 'accent') : ''}
        ${e.certificate ? html`<a class="pill blue" href="${e.certificate}" target="_blank" rel="noopener">Certificate ↗</a>` : ''}
      </div>
    </div>`;

  const draw = async () => {
    const body = setPage(page, 'Activity points', skeleton(2), {
      subtitle: 'Submissions and faculty-approved points, by semester and category.',
      controls: html`${select('code', codeOptions(codes), code)}
        ${select('cat', api.ACTIVITY_CATEGORIES.map((c) => ({ value: String(c.id), label: c.label })), String(cat))}
        <button class="btn sm ${all ? 'primary' : ''}" id="all">${all ? 'Showing all points' : 'Display all points'}</button>`,
    });
    page.querySelector('#code').addEventListener('change', (e) => { code = e.target.value; pref('act.code', code); draw(); });
    page.querySelector('#cat').addEventListener('change', (e) => { cat = Number(e.target.value); pref('act.cat', cat); all = false; draw(); });
    page.querySelector('#all').addEventListener('click', () => { all = !all; draw(); });
    try {
      if (all) {
        // Every semester × every category, a few requests at a time so the portal isn't hammered.
        const jobs = codes.flatMap((c) => api.ACTIVITY_CATEGORIES.map((cat) => ({ c, cat })));
        const entries = [];
        await Promise.all(Array.from({ length: 6 }, async () => {
          for (let j; (j = jobs.shift());) {
            const r = await cached(`act:${j.c.value}:${j.cat.id}`, () => api.activity(j.c.value, j.cat.id));
            entries.push(...r.entries.map((e) => ({ ...e, sem: semLabel(j.c), catLabel: j.cat.label })));
          }
        }));
        const approvedPts = (list) => list.filter((e) => /approved/i.test(e.status)).reduce((n, e) => n + (e.points || 0), 0);
        const groups = new Map();
        for (const e of entries) { const k = e.category || 'Uncategorised'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
        const approved = entries.filter((e) => /approved/i.test(e.status));
        // Summary grid: one row per semester, one column per category, cells are approved points.
        const cats = [...groups.keys()].sort((x, y) => x.localeCompare(y));
        const sems = codes.map(semLabel);
        const cell = (sem, k) => approvedPts(entries.filter((e) => e.sem === sem && (k == null || (e.category || 'Uncategorised') === k)));
        body.innerHTML = html`
          ${entries.length ? html`
          <div class="card" style="margin-bottom:18px">
            <div class="section-title" style="padding:18px 20px 0"><h2>Points by semester</h2><span class="hint">approved points only</span></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Semester</th>${cats.map((k) => html`<th class="num">${k}</th>`)}<th class="num">Total</th></tr></thead>
              <tbody>
                ${sems.map((sem) => html`<tr><td class="strong">${sem}</td>${cats.map((k) => html`<td class="num">${cell(sem, k) || '—'}</td>`)}<td class="num strong">${cell(sem) || '—'}</td></tr>`)}
                <tr><td class="strong">Total</td>${cats.map((k) => html`<td class="num strong">${approvedPts(groups.get(k))}</td>`)}<td class="num strong">${approvedPts(entries)}</td></tr>
              </tbody></table></div>
          </div>` : ''}
          <div class="grid c3">${stat('Approved points', approvedPts(entries), `${approved.length} approved · all semesters`)}${stat('Submissions', entries.length, `${entries.length - approved.length} pending / other`)}${stat('Categories', groups.size, 'with submissions')}</div>
          ${entries.length ? [...groups.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([k, list]) => html`
            <div class="section">
              <div class="section-title"><h2>${k}</h2><span class="hint">${approvedPts(list)} approved points · ${list.length} submission${list.length === 1 ? '' : 's'}</span></div>
              <div class="grid c2">${list.map(card)}</div>
            </div>`) : html`<div class="section">${empty('No submissions', 'Nothing has been submitted in any category across any semester.')}</div>`}`.__raw;
      } else {
        const r = await cached(`act:${code}:${cat}`, () => api.activity(code, cat));
        const pts = r.entries.filter((e) => /approved/i.test(e.status)).reduce((n, e) => n + (e.points || 0), 0);
        body.innerHTML = html`
          ${r.entries.length ? html`<div class="grid c3">${stat('Approved points', pts, api.ACTIVITY_CATEGORIES.find((c) => c.id === cat)?.label)}${stat('Submissions', r.entries.length)}</div>` : ''}
          <div class="section grid c2">${r.entries.length ? r.entries.map(card) : empty('No submissions here', 'Nothing has been submitted in this category.')}</div>
`.__raw;
      }
    } catch (e) { if (e instanceof api.SessionError) throw e; body.innerHTML = errorBox(e).__raw; }
  };
  await draw();
}

/* ============================================================
   Notices
   ============================================================ */
async function notices(page, nid) {
  const body = setPage(page, 'Notices', skeleton(2), { subtitle: 'Circulars from the Principal’s office.' });
  const data = await cached(`notices:${nid || ''}`, () => api.notices(nid));
  const cur = data.current;
  body.innerHTML = html`
    <div class="notice-layout">
      <div class="card"><ul class="list">${data.previous.map((n) => html`
        <li class="link ${n.id === nid ? 'selected' : ''}" onclick="location.hash='#/notices/${n.id}'"><div class="grow"><div class="title">${n.title}</div><div class="meta">${n.date}</div></div></li>`)}</ul></div>
      <div class="card">
        ${cur ? html`
          <div class="notice-body">
            <div class="dim small" style="margin-bottom:14px">${cur.number || ''}${cur.date ? ` · ${cur.date}` : ''}</div>
            ${raw(cur.html)}
          </div>` : html`<div class="empty">Select a notice</div>`}
      </div>
    </div>`.__raw;
}

/* ============================================================
   Fees & certificates
   ============================================================ */
async function fees(page) {
  const body = setPage(page, 'Fees & certificates', skeleton(2), { subtitle: 'Online fee receipts and RSET event certificates.' });
  const [f, c] = await Promise.all([cached('fees', api.fees), cached('certs', api.certificates)]);
  body.innerHTML = html`
    <div class="section-title"><h2>Fee receipts</h2></div>
    ${f.length ? html`<div class="card"><ul class="list">${f.map((x) => html`
      <li><div class="grow"><div class="title">${x.title}</div><div class="meta">${x.amount}</div></div>
      ${x.receipt ? html`<a class="btn sm" href="${x.receipt}" target="_blank" rel="noopener">Receipt ${icon.external}</a>` : ''}</li>`)}</ul></div>` : empty('No fee records', '')}
    <div class="section-title section"><h2>Certificates</h2></div>
    ${c.empty ? empty('No certificates yet', 'RSET event certificates will show up here once issued.') : html`<div class="card"><ul class="list">${c.rows.map((r) => html`<li><div class="grow"><div class="title">${r.text}</div></div>${r.link ? html`<a class="btn sm" href="${r.link}" target="_blank" rel="noopener">Open ${icon.external}</a>` : ''}</li>`)}</ul></div>`}`.__raw;
}

/* ============================================================
   Profile
   ============================================================ */
async function profile(page) {
  const body = setPage(page, 'Profile', skeleton(1));
  const p = await cached('profile', api.profile);
  const f = p.fields;
  body.innerHTML = html`
    <div class="hero">${p.photo ? html`<img class="avatar" src="${p.photo}" alt="" />` : ''}<div><h1 style="font-size:22px">${titleCase(f['Name'])}</h1><p>${f['Student Id'] || ''}${f['Class'] ? ` · ${f['Class']}` : ''}</p></div></div>
    <div class="card"><div class="kv">${Object.entries(f).map(([k, v]) => html`<div>${k}</div><div>${v || '—'}</div>`)}</div></div>`.__raw;
}

boot();
