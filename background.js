// Create context menu items on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-assignment',
    title: 'Track Assignment',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'add-exam',
    title: 'Track Exam',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  const type = info.menuItemId === 'add-exam' ? 'exams' : 'assignments';

  await ensureContentScript(tab.id);
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'add-selection',
      text: info.selectionText,
      type: type
    });
  }, 150);
});

// Handle toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
  } catch (e) {
    await ensureContentScript(tab.id);
    setTimeout(() => chrome.tabs.sendMessage(tab.id, { action: 'toggle' }), 150);
  }
});

// Inject content script + CSS if not already present
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
  }
}
