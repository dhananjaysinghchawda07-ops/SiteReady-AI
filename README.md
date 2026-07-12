# SiteReady AI — Chrome Extension

A professional website launch audit, competitor comparison, and marketing QA tool for digital marketers, freelancers, and agencies.

---

## 📦 Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `siteready-ai` folder
5. The SiteReady AI icon will appear in your Chrome toolbar

### Generate Icons (Optional — Recommended)
Open `generate_icons.html` in Chrome and click **"Generate & Download All Icons"**. Move the downloaded files into `siteready-ai/icons/` replacing the placeholders.

---

## 🚀 How to Use

### Audit Tab
1. Navigate to any website in Chrome
2. Click the SiteReady AI extension icon
3. Click **"Run Audit"** to scan the current page
4. Results appear in sections: CTA, Trust, Forms, Links, Content, Structure, Mobile

### Tags Tab
- Click **"Detect Tags"** to find GA4, GTM, Meta Pixel, LinkedIn, TikTok, Hotjar, and more

### Compare Tab
1. Enter a competitor URL
2. Click **"Compare Pages"**
3. See side-by-side scorecard, what you do better, and what to fix

### Speed Tab
- Click **"Check Speed"** for load time, TTFB, DOM size, and large asset warnings

### Capture Tab
- **Visible Screenshot** — captures the current viewport
- **Full-Page Screenshot** — captures and downloads the page
- **Screen Recording** — records the tab (requires screen share permission)

### Share Tab
- Audit summary is auto-generated after each scan
- Share via WhatsApp, Slack, Teams, Email, or copy to clipboard

---

## 🏗️ File Structure

```
siteready-ai/
├── manifest.json          # MV3 extension manifest
├── popup.html             # Extension popup UI
├── popup.css              # Styles (dark navy theme)
├── popup.js               # Popup controller & logic
├── contentScript.js       # Page scanner (injected into pages)
├── background.js          # Service worker (screenshots, fetch)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── generate_icons.html    # Icon generator utility
└── README.md
```

---

## 🔮 Future Upgrades (v1.1+)
- PDF report export
- Pre-launch checklist
- Comparison history & swipe file
- Full-page scroll screenshot stitching
- Issue priority labels (High/Med/Low)
- AI-powered grammar checking
- Screenshot annotation
- Cloud screenshot sharing

---

## 🛠️ Technical Notes
- Built with **Manifest V3**
- Uses `chrome.scripting` for content script injection
- Uses `chrome.tabs.captureVisibleTab` for screenshots
- Comparison fetches competitor HTML via background service worker
- All data stored locally via `chrome.storage.local`
- No external API dependencies required for core features

---

*SiteReady AI v1.0 — Built for digital marketers who care about launch quality.*
