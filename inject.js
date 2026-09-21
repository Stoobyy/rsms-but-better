// Content script (document_start). Halts the original RSMS page and mounts the remake in its
// place. Runs on the portal's own origin, so the app's fetch() calls carry the session cookies.
const LOGIN = 'https://www.rajagiritech.ac.in/stud/KTU/Student/studentlogin/login.php';

(async () => {
  const file = location.pathname.toLowerCase().split('/').pop();
  // Receipts open in a new tab from the remake's Fees page — leave them as the portal renders them.
  if (file === 'receipt.asp') return;
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

  // "Original portal" in the remake: switch the extension off and go to the portal's login page.
  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.type !== 'rsms:original') return;
    await chrome.storage.local.set({ disabled: true });
    chrome.runtime.sendMessage({ type: 'badge', disabled: true });
    location.href = LOGIN;
  });
})();
