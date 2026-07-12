/* ============================================================
   SiteReady AI — Background Service Worker (Manifest V3)
   ============================================================ */

'use strict';

/* ---- Screenshot capture ---- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 95 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    });
    return true; // async
  }

  if (msg.action === 'DOWNLOAD_FILE') {
    const { url, filename } = msg;
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }

  if (msg.action === 'FETCH_PAGE') {
    // Fetch competitor page HTML for comparison
    const { url } = msg;
    fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(html => sendResponse({ ok: true, html }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

/* ---- Install / update handling ---- */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ installedAt: Date.now(), auditCount: 0 });
  }
});
