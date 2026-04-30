import { captureTabById } from '../lib/thumbnailCache';

let lastToggleTime = 0;

/**
 * Open the overview in the given mode, or toggle/switch if already open.
 * - If no overview tab exists: open in the requested mode
 * - If an overview tab exists in the SAME mode: close it (toggle off)
 * - If an overview tab exists in a DIFFERENT mode: navigate it to the new mode (switch)
 */
async function openMode(targetMode: 'grid' | 'carousel') {
  const now = Date.now();
  if (now - lastToggleTime < 500) return;
  lastToggleTime = now;

  const overviewUrl = chrome.runtime.getURL("overview/index.html");
  const existingTabs = await chrome.tabs.query({ url: overviewUrl + '*' });

  if (existingTabs.length > 0 && existingTabs[0].id) {
    const existingTab = existingTabs[0];
    const existingUrl = existingTab.url || '';
    const existingMode = existingUrl.includes('mode=carousel') ? 'carousel' : 'grid';

    if (existingMode === targetMode) {
      // Same mode — toggle off (close)
      try {
        await chrome.tabs.remove(existingTab.id!);
      } catch (e) {
        console.error('Failed to close tab:', e);
      }
      return;
    }

    // Different mode — switch by navigating the existing tab
    const fromParam = new URL(existingUrl).searchParams.get('from');
    let newUrl = overviewUrl;
    if (targetMode === 'carousel') {
      newUrl += fromParam ? `?mode=carousel&from=${fromParam}` : '?mode=carousel';
    } else {
      newUrl += fromParam ? `?from=${fromParam}` : '';
    }

    try {
      await chrome.tabs.update(existingTab.id!, { url: newUrl, active: true });
    } catch (e) {
      console.error('Failed to switch mode:', e);
    }
    return;
  }

  // No existing tab — open fresh
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const sourceTabId = activeTab?.id;

  let url = overviewUrl;
  if (targetMode === 'carousel') {
    url += sourceTabId ? `?mode=carousel&from=${sourceTabId}` : '?mode=carousel';
  } else {
    url += sourceTabId ? `?from=${sourceTabId}` : '';
  }

  chrome.tabs.create({ url, active: true });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action' || command === 'open-overview') {
    openMode('grid');
  }
  if (command === 'open-carousel') {
    openMode('carousel');
  }
});

chrome.action.onClicked.addListener(() => {
  openMode('grid');
});

// Capture thumbnail when a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url && tab.windowId) {
    new Promise<void>(resolve => setTimeout(resolve, 500)).then(() => {
      captureTabById(tabId, tab.windowId!, tab.url!);
    });
  }
});

// Capture thumbnail when user switches to a tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId).then(tab => {
    if (!tab?.url || !tab.active) return;
    return new Promise<void>(resolve => setTimeout(resolve, 300)).then(() => {
      captureTabById(activeInfo.tabId, tab.windowId, tab.url!);
    });
  });
});
