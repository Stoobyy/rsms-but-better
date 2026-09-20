// Content script (document_start). Halts the original RSMS page and mounts the remake in its
// place. Runs on the portal's own origin, so the app's fetch() calls carry the session cookies.
(async () => {
  const path = location.pathname.toLowerCase();
  const file = path.split('/').pop();

  // Pages we redesign. Anything else (receipts, PDFs, Logout.asp, form handlers…) is left alone.
  const PAGES = new Set([
    '', 'home.asp', 'index.asp', 'leave.asp', 'mark.asp', 'mark_sessional.asp', 'mark_internal_report.asp',
    'mark_rexa.asp', 'marks_rexa.asp', 'academic_calendar.asp', 'activity.asp', 'notice.asp',
    'feebook.asp', 'certificate.asp', 'fileup.php', 'announcement_list.php', 'login.php',
  ]);
  if (!PAGES.has(file)) return;
  if (new URLSearchParams(location.search).has('original')) return;
  const { disabled } = await chrome.storage.local.get('disabled');
  if (disabled) return;

  // Where the original page maps to in the remake.
  const ROUTE = {
    'leave.asp': 'attendance', 'mark.asp': 'marks', 'mark_sessional.asp': 'marks', 'mark_internal_report.asp': 'splitup',
    'mark_rexa.asp': 'results', 'marks_rexa.asp': 'results', 'academic_calendar.asp': 'calendar', 'activity.asp': 'activity',
    'notice.asp': 'notices', 'announcement_list.php': 'notices', 'feebook.asp': 'fees', 'certificate.asp': 'fees', 'fileup.php': 'profile',
  };
  if (!location.hash && ROUTE[file]) history.replaceState(null, '', `#/${ROUTE[file]}`);

  window.stop();
  const url = (p) => chrome.runtime.getURL(p);
  document.documentElement.innerHTML = `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <meta name="color-scheme" content="light dark">
      <title>rsms but better</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="${url('styles.css')}">
    </head>
    <body><div id="app" class="app"></div></body>`;

  const s = document.createElement('script');
  s.type = 'module';
  s.src = url('js/app.js');
  document.body.appendChild(s);
})();
