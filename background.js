// Toolbar button: toggle the remake on/off. Off → the portal's own login page; on → the remake.
const LOGIN = 'https://www.rajagiritech.ac.in/stud/KTU/Student/studentlogin/login.php';
const HOME = 'https://www.rajagiritech.ac.in/stud/KTU/Student/Home.asp';
const setBadge = (disabled) => chrome.action.setBadgeText({ text: disabled ? 'OFF' : '' });

chrome.runtime.onInstalled.addListener(async () => {
  const { disabled } = await chrome.storage.local.get('disabled');
  setBadge(!!disabled);
  chrome.action.setBadgeBackgroundColor({ color: '#8e8e98' });
});

chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === 'badge') setBadge(!!msg.disabled); });

chrome.action.onClicked.addListener(async (tab) => {
  const { disabled } = await chrome.storage.local.get('disabled');
  const now = !disabled;
  await chrome.storage.local.set({ disabled: now });
  setBadge(now);
  if (tab?.id && /rajagiritech\.ac\.in/i.test(tab.url || '')) chrome.tabs.update(tab.id, { url: now ? LOGIN : HOME });
});
