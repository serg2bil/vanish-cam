// Toolbar badge: "OFF" while the main switch is off, so it is visible without opening the popup.
const badge = s => chrome.action.setBadgeText({ text: s?.enabled === false ? 'OFF' : '' });
chrome.action.setBadgeBackgroundColor({ color: '#6b6b7b' });
chrome.storage.local.get('settings', r => badge(r.settings));
chrome.storage.onChanged.addListener(ch => { if (ch.settings) badge(ch.settings.newValue); });
chrome.runtime.onStartup.addListener(() => {}); // wakes this worker at browser start, so the badge is set
