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
  await sendMsg(tab.id, {
    action: 'add-selection',
    text: info.selectionText,
    type: type
  });
});

// Handle toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

  await ensureContentScript(tab.id);
  await sendMsg(tab.id, { action: 'toggle' });
});

// Inject content script + CSS if not already present
async function ensureContentScript(tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    if (resp && resp.ok) return;
  } catch (e) {
    // not loaded yet
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
}

// Send message with retries — waits for content script to be ready
async function sendMsg(tabId, msg, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, msg);
      return;
    } catch (e) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 100));
    }
  }
}
