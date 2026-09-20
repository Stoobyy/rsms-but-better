// Toolbar button: toggle between the remake and the original portal, then reload the tab.
const setBadge = (disabled) => chrome.action.setBadgeText({ text: disabled ? 'OFF' : '' });

chrome.runtime.onInstalled.addListener(async () => {
  const { disabled } = await chrome.storage.local.get('disabled');
  setBadge(!!disabled);
  chrome.action.setBadgeBackgroundColor({ color: '#8e8e98' });
});

chrome.action.onClicked.addListener(async (tab) => {
  const { disabled } = await chrome.storage.local.get('disabled');
  await chrome.storage.local.set({ disabled: !disabled });
  setBadge(!disabled);
  if (tab?.id && /rajagiritech\.ac\.in/i.test(tab.url || '')) chrome.tabs.reload(tab.id);
});
