/* ============================================================
   SiteReady AI — Popup Controller
   ============================================================ */
'use strict';

/* ================================================================
   STATE
================================================================ */
const state = {
  currentTab:    null,
  auditData:     null,
  tagsData:      null,
  speedData:     null,
  compareData:   null,
  screenshotUrl: null,
  mediaRecorder: null,
  recordedChunks:[],
};

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentTab = tab;

  // Display URL
  const urlBadge = document.getElementById('currentUrl');
  if (tab?.url) {
    try {
      urlBadge.textContent = new URL(tab.url).hostname;
      urlBadge.title = tab.url;
    } catch {
      urlBadge.textContent = tab.url.slice(0, 40);
    }
  }

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Audit
  document.getElementById('runAuditBtn').addEventListener('click', runAudit);

  // Tags
  document.getElementById('runTagsBtn').addEventListener('click', runTagDetect);

  // Compare
  document.getElementById('runCompareBtn').addEventListener('click', runCompare);

  // Speed
  document.getElementById('runSpeedBtn').addEventListener('click', runSpeed);

  // Capture
  document.getElementById('captureVisibleBtn').addEventListener('click', captureVisible);
  document.getElementById('captureFullBtn').addEventListener('click', captureFullPage);
  document.getElementById('captureRecordBtn').addEventListener('click', startRecording);
  document.getElementById('stopRecordBtn').addEventListener('click', stopRecording);
  document.getElementById('downloadScreenshotBtn').addEventListener('click', downloadScreenshot);
  document.getElementById('copyScreenshotBtn').addEventListener('click', copyScreenshotLink);

  // Share
  document.getElementById('refreshShareBtn').addEventListener('click', buildShareText);
  document.getElementById('shareWhatsApp').addEventListener('click', shareWhatsApp);
  document.getElementById('shareSlack').addEventListener('click', shareSlack);
  document.getElementById('shareTeams').addEventListener('click', shareTeams);
  document.getElementById('shareEmail').addEventListener('click', shareEmail);
  document.getElementById('shareCopy').addEventListener('click', shareCopy);

  // Restore saved data
  loadSavedState();
  setLastRun();
});

/* ================================================================
   TAB SWITCHING
================================================================ */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}

/* ================================================================
   AUDIT
================================================================ */
async function runAudit() {
  const btn = document.getElementById('runAuditBtn');
  showLoading('auditLoading', true);
  hide('auditResults');
  btn.disabled = true;
  btn.textContent = 'Scanning…';

  try {
    await ensureContentScript();
    const resp = await sendToContent({ action: 'AUDIT_PAGE' });
    if (!resp?.ok) throw new Error(resp?.error || 'Scan failed');
    state.auditData = resp.data;
    renderAudit(resp.data);
    chrome.storage.local.set({ auditData: resp.data, auditUrl: state.currentTab?.url });
    buildShareText();
    setLastRun(true);
  } catch (e) {
    alert('Audit failed: ' + e.message);
  } finally {
    showLoading('auditLoading', false);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">▶</span> Run Audit';
  }
}

function renderAudit(data) {
  show('auditResults');

  // Score badge
  const scoreBadge = document.getElementById('auditScore');
  scoreBadge.style.display = '';
  scoreBadge.textContent = `Score: ${data.score}/100`;
  scoreBadge.className = 'score-badge ' + (data.score >= 70 ? 'good' : data.score >= 45 ? 'warn' : 'bad');

  // Verdict
  renderVerdict(data);

  // Summary
  renderSummary(data);

  // Sections
  renderItems('ctaResults',       data.cta);
  renderItems('trustResults',     data.trust);
  renderItems('formResults',      data.forms);
  renderItems('linkResults',      data.links);
  renderItems('contentResults',   data.content);
  renderItems('structureResults', data.structure);
  renderItems('mobileResults',    data.mobile);
}

function renderVerdict(data) {
  const el = document.getElementById('verdictContent');
  const score = data.score;
  let emoji, text, sub;

  if (score >= 80) {
    emoji = '🟢'; text = 'Ready to Launch'; sub = 'Page looks strong. A few minor items to polish.';
  } else if (score >= 60) {
    emoji = '🟡'; text = 'Almost Ready'; sub = 'Fix the medium-priority issues before going live.';
  } else if (score >= 40) {
    emoji = '🟠'; text = 'Needs Work'; sub = 'Several important elements are missing. Review the findings.';
  } else {
    emoji = '🔴'; text = 'Not Launch Ready'; sub = 'Critical issues found. Do not launch without addressing these.';
  }

  el.innerHTML = `
    <div class="verdict-block">
      <span class="verdict-emoji">${emoji}</span>
      <div>
        <div class="verdict-text">${text}</div>
        <div class="verdict-sub">${sub}</div>
      </div>
    </div>`;
}

function renderSummary(data) {
  const el = document.getElementById('summaryContent');

  // Count issues by severity
  const allItems = [...data.cta, ...data.trust, ...data.forms, ...data.links, ...data.content, ...data.structure, ...data.mobile];
  const highIssues = allItems.filter(i => i.status === 'high');
  const medIssues  = allItems.filter(i => i.status === 'med');
  const okItems    = allItems.filter(i => i.status === 'ok');

  // Build page-specific dynamic summary
  const strengths = okItems.slice(0, 3).map(i => `✅ ${i.label}`).join('\n') || '✅ Scan complete';
  const critical  = highIssues.length ? highIssues.slice(0, 3).map(i => `🔴 ${i.label}`).join('\n') : '✅ No critical issues';
  const warnings  = medIssues.length  ? medIssues.slice(0, 3).map(i => `🟡 ${i.label}`).join('\n')  : '';
  const quickWin  = medIssues[0] ? `⚡ Quick win: ${medIssues[0].action}` : (highIssues[0] ? `⚡ Fix first: ${highIssues[0].action}` : '');

  const url = state.currentTab?.url || 'this page';
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  el.textContent = [
    `Page: ${hostname}`,
    `Score: ${data.score}/100 · ${highIssues.length} critical · ${medIssues.length} warnings`,
    '',
    'Strengths:',
    strengths,
    '',
    highIssues.length ? 'Critical issues:' : '',
    critical,
    warnings ? '\nWarnings:\n' + warnings : '',
    quickWin ? '\n' + quickWin : '',
  ].filter(l => l !== undefined).join('\n').trim();
}

function renderItems(containerId, items) {
  const el = document.getElementById(containerId);
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="empty-state">No data available.</div>';
    return;
  }
  el.innerHTML = items.map(item => {
    const dotClass = item.status === 'ok' ? 'dot-green' : item.status === 'high' ? 'dot-red' : item.status === 'med' ? 'dot-amber' : 'dot-gray';
    const badge    = item.status === 'high' ? '<span class="badge badge-high">HIGH</span>' :
                     item.status === 'med'  ? '<span class="badge badge-med">MED</span>'  :
                     item.status === 'low'  ? '<span class="badge badge-low">LOW</span>'  :
                                              '<span class="badge badge-ok">OK</span>';
    return `
      <div class="result-item">
        <div class="result-label">
          <span class="dot ${dotClass}"></span>
          ${escHtml(item.label)} ${badge}
        </div>
        ${item.detail ? `<div class="result-detail">${escHtml(item.detail)}</div>` : ''}
        ${item.action ? `<div class="result-action">→ ${escHtml(item.action)}</div>` : ''}
      </div>`;
  }).join('');
}

/* ================================================================
   TAG DETECTION
================================================================ */
async function runTagDetect() {
  const btn = document.getElementById('runTagsBtn');
  showLoading('tagsLoading', true);
  hide('tagsResults');
  btn.disabled = true;

  try {
    await ensureContentScript();
    const resp = await sendToContent({ action: 'DETECT_TAGS' });
    if (!resp?.ok) throw new Error(resp?.error || 'Tag scan failed');
    state.tagsData = resp.data;
    renderTags(resp.data);
    chrome.storage.local.set({ tagsData: resp.data });
  } catch (e) {
    alert('Tag detection failed: ' + e.message);
  } finally {
    showLoading('tagsLoading', false);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span> Detect Tags';
  }
}

function renderTags(data) {
  show('tagsResults');

  // Detected tags
  const detectedEl = document.getElementById('tagsList');
  if (data.detected.length === 0) {
    detectedEl.innerHTML = '<div class="empty-state">No marketing tags detected on this page.</div>';
  } else {
    detectedEl.innerHTML = data.detected.map(t => `
      <div class="tag-row">
        <div>
          <div class="tag-name">${escHtml(t.name)}</div>
          ${t.fullId ? `<div class="tag-id">${escHtml(t.fullId)}</div>` : ''}
        </div>
        <span class="tag-status tag-active">✓ Active</span>
      </div>`).join('');
  }

  // Missing tags
  const missingEl = document.getElementById('missingTagsList');
  const missing = data.missing.filter(t => ['ga4','gtm','meta','gads'].includes(t.key)); // core ones only
  if (missing.length === 0) {
    missingEl.innerHTML = '<div class="empty-state">All core tracking tags detected. ✅</div>';
  } else {
    missingEl.innerHTML = missing.map(t => `
      <div class="tag-row">
        <div class="tag-name">${escHtml(t.name)}</div>
        <span class="tag-status tag-missing">✗ Missing</span>
      </div>`).join('');
  }
}

/* ================================================================
   COMPARE MODE
================================================================ */
async function runCompare() {
  const competitorUrl = document.getElementById('competitorUrl').value.trim();
  if (!competitorUrl) {
    alert('Please enter a competitor URL to compare.');
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(competitorUrl);
  } catch {
    alert('Invalid URL. Please include https://');
    return;
  }

  const btn = document.getElementById('runCompareBtn');
  showLoading('compareLoading', true);
  hide('compareResults');
  btn.disabled = true;
  btn.textContent = 'Comparing…';

  try {
    // 1. Audit current page if not already done
    if (!state.auditData) {
      await ensureContentScript();
      const myResp = await sendToContent({ action: 'AUDIT_PAGE' });
      if (!myResp?.ok) throw new Error('Current page audit failed');
      state.auditData = myResp.data;
    }

    // 2. Fetch competitor HTML via background
    const fetchResp = await chrome.runtime.sendMessage({ action: 'FETCH_PAGE', url: competitorUrl });

    let competitorData;
    if (fetchResp?.ok && fetchResp.html) {
      competitorData = parseCompetitorHtml(fetchResp.html, competitorUrl);
    } else {
      // Fallback: open competitor in a new tab and inject script
      competitorData = await fetchCompetitorViaTab(competitorUrl);
    }

    const comparison = buildComparison(state.auditData, competitorData);
    state.compareData = comparison;
    renderComparison(comparison, competitorUrl);
    buildShareText();
  } catch (e) {
    alert('Comparison failed: ' + e.message + '\n\nTip: Some sites block cross-origin requests. Try opening the competitor page in a tab first.');
  } finally {
    showLoading('compareLoading', false);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span> Compare Pages';
  }
}

function parseCompetitorHtml(html, url) {
  const parser  = new DOMParser();
  const doc     = parser.parseFromString(html, 'text/html');
  const bodyText = doc.body?.innerText || doc.body?.textContent || '';

  const ctaKeywords = ['get started','buy now','sign up','start free','try free','book a demo','contact us','download','subscribe','register','join','order now','shop now','schedule','get quote','free trial','start now'];
  const allBtns = [...doc.querySelectorAll('button, a')].map(el => (el.innerText || el.textContent || '').toLowerCase().trim());
  const hasCTA  = allBtns.some(t => ctaKeywords.some(k => t.includes(k)));

  const h1    = doc.querySelector('h1');
  const words = bodyText.split(/\s+/).filter(Boolean).length;
  const forms = doc.querySelectorAll('form').length;

  // Tags in competitor
  const hasGA4   = /G-[A-Z0-9]{6,12}|gtag\(/.test(html);
  const hasGTM   = /GTM-[A-Z0-9]+/.test(html);
  const hasMeta  = /fbq\(|facebook\.com\/tr/.test(html);

  // Trust
  const textLow = bodyText.toLowerCase();
  const trustSignals = [
    textLow.includes('testimonial') || textLow.includes('review'),
    textLow.includes('guarantee') || textLow.includes('money back'),
    textLow.includes('trusted by') || textLow.includes('client'),
    textLow.includes('faq') || textLow.includes('frequently asked'),
  ].filter(Boolean).length;

  return {
    url,
    title: doc.title || url,
    wordCount: words,
    hasH1: !!h1,
    h1Text: h1?.textContent?.trim().slice(0, 80) || 'N/A',
    hasCTA,
    ctaCount: allBtns.filter(t => ctaKeywords.some(k => t.includes(k))).length,
    formCount: forms,
    trustSignalCount: trustSignals,
    hasGA4,
    hasGTM,
    hasMeta,
    hasViewport: /<meta[^>]+viewport/.test(html),
    hasSchema: /application\/ld\+json/.test(html),
    hasMetaDesc: /<meta[^>]+description/.test(html),
    linkCount: doc.querySelectorAll('a[href]').length,
    imageCount: doc.querySelectorAll('img').length,
  };
}

async function fetchCompetitorViaTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, tab => {
      const tabId = tab.id;
      function onUpdated(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const bodyText = document.body?.innerText || '';
              const ctaKw = ['get started','buy now','sign up','start free','try free','book a demo','contact us','download','subscribe'];
              const allBtns = [...document.querySelectorAll('button,a')].map(el => (el.innerText||'').toLowerCase());
              const html = document.documentElement.innerHTML;
              return {
                url: location.href,
                title: document.title,
                wordCount: bodyText.split(/\s+/).filter(Boolean).length,
                hasH1: !!document.querySelector('h1'),
                h1Text: (document.querySelector('h1')?.innerText || 'N/A').slice(0,80),
                hasCTA: allBtns.some(t => ctaKw.some(k => t.includes(k))),
                ctaCount: allBtns.filter(t => ctaKw.some(k => t.includes(k))).length,
                formCount: document.querySelectorAll('form').length,
                trustSignalCount: [
                  /testimonial|review/i.test(bodyText),
                  /guarantee|money back/i.test(bodyText),
                  /trusted by|client/i.test(bodyText),
                  /faq|frequently asked/i.test(bodyText),
                ].filter(Boolean).length,
                hasGA4: /G-[A-Z0-9]{6,}|gtag\(/.test(html),
                hasGTM: /GTM-[A-Z0-9]+/.test(html),
                hasMeta: /fbq\(|facebook\.com\/tr/.test(html),
                hasViewport: !!document.querySelector('meta[name="viewport"]'),
                hasSchema: !!document.querySelector('script[type="application/ld+json"]'),
                hasMetaDesc: !!document.querySelector('meta[name="description"]')?.content,
                linkCount: document.querySelectorAll('a[href]').length,
                imageCount: document.querySelectorAll('img').length,
              };
            },
          }, results => {
            chrome.tabs.remove(tabId);
            if (chrome.runtime.lastError || !results?.[0]?.result) {
              reject(new Error('Could not scan competitor tab.'));
            } else {
              resolve(results[0].result);
            }
          });
        }
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.remove(tabId).catch(() => {});
        reject(new Error('Competitor page took too long to load.'));
      }, 20000);
    });
  });
}

function buildComparison(my, comp) {
  const myHostname   = (() => { try { return new URL(my.url).hostname; } catch { return 'My Page'; } })();
  const compHostname = (() => { try { return new URL(comp.url).hostname; } catch { return 'Competitor'; } })();

  const rows = [
    { metric: 'Word Count',       my: my.content?.find(i=>i.label.includes('word'))?.label?.match(/\d+/)?.[0] || '?', comp: comp.wordCount, higher: 'better' },
    { metric: 'Has H1',           my: my.content?.some(i=>i.label.includes('H1') && i.status==='ok') ? '✅' : '❌', comp: comp.hasH1 ? '✅' : '❌', winner: null },
    { metric: 'Has CTA',          my: my.cta?.some(i=>i.status==='ok') ? '✅' : '❌', comp: comp.hasCTA ? '✅' : '❌', winner: null },
    { metric: 'CTA Count',        my: my.cta?.filter(i=>i.status==='ok').length || 0, comp: comp.ctaCount, higher: 'better' },
    { metric: 'Forms',            my: my.forms?.filter(i=>i.label.includes('form')).length > 0 ? '✅' : '❌', comp: comp.formCount > 0 ? '✅' : '❌', winner: null },
    { metric: 'Trust Signals',    my: my.trust?.filter(i=>i.status==='ok').length || 0, comp: comp.trustSignalCount, higher: 'better' },
    { metric: 'Meta Description', my: my.content?.some(i=>i.label.includes('meta desc') && i.status==='ok') ? '✅' : '❌', comp: comp.hasMetaDesc ? '✅' : '❌', winner: null },
    { metric: 'Schema Markup',    my: my.structure?.some(i=>i.label.includes('Schema') && i.status==='ok') ? '✅' : '❌', comp: comp.hasSchema ? '✅' : '❌', winner: null },
    { metric: 'Mobile Viewport',  my: my.mobile?.some(i=>i.label.includes('Viewport') && i.status==='ok') ? '✅' : '❌', comp: comp.hasViewport ? '✅' : '❌', winner: null },
    { metric: 'GA4',              my: '?', comp: comp.hasGA4 ? '✅' : '❌', winner: null },
    { metric: 'GTM',              my: '?', comp: comp.hasGTM ? '✅' : '❌', winner: null },
    { metric: 'Meta Pixel',       my: '?', comp: comp.hasMeta ? '✅' : '❌', winner: null },
  ];

  // Determine wins and gaps
  const wins = [];
  const gaps = [];

  // CTA comparison
  const myCTAOk   = my.cta?.some(i => i.status === 'ok');
  const compCTAOk = comp.hasCTA;
  if (myCTAOk && !compCTAOk) wins.push('Your page has stronger CTA presence than the competitor.');
  if (!myCTAOk && compCTAOk) gaps.push('Competitor has clear CTAs. Your page lacks a strong call to action.');

  // Trust
  const myTrust   = my.trust?.filter(i=>i.status==='ok').length || 0;
  const compTrust = comp.trustSignalCount;
  if (myTrust > compTrust)  wins.push(`You have more trust signals (${myTrust} vs ${compTrust}).`);
  if (compTrust > myTrust)  gaps.push(`Competitor has more trust signals (${compTrust} vs ${myTrust}). Add testimonials, guarantees, or logos.`);

  // Content depth
  const myWords = parseInt(my.content?.find(i=>i.label.includes('word'))?.label?.match(/\d+/)?.[0]) || 0;
  if (myWords > comp.wordCount + 100) wins.push(`Your page has more content depth (${myWords} words vs ${comp.wordCount}).`);
  if (comp.wordCount > myWords + 100)  gaps.push(`Competitor has significantly more content (${comp.wordCount} words vs ${myWords}). Add more detail.`);

  // Schema
  const mySchema = my.structure?.some(i=>i.label.includes('Schema') && i.status==='ok');
  if (mySchema && !comp.hasSchema) wins.push('You have schema markup for richer search results. Competitor does not.');
  if (!mySchema && comp.hasSchema) gaps.push('Competitor uses schema markup. Add JSON-LD to improve search appearance.');

  // Default messages if empty
  if (wins.length === 0) wins.push('Run your audit first, then compare for detailed advantage breakdown.');
  if (gaps.length === 0) gaps.push('Your page is competitive! Keep monitoring competitor changes.');

  const actions = [];
  if (gaps.some(g => g.includes('CTA')))         actions.push('Add a prominent above-the-fold CTA with benefit-driven copy.');
  if (gaps.some(g => g.includes('trust')))        actions.push('Add testimonials, client logos, or a money-back guarantee.');
  if (gaps.some(g => g.includes('content')))      actions.push('Expand page copy with benefits, FAQs, and use cases.');
  if (gaps.some(g => g.includes('schema')))       actions.push('Implement JSON-LD schema for Organization or WebPage.');
  if (comp.hasGA4 && !state.tagsData?.detected?.some(t=>t.key==='ga4')) actions.push('Install GA4 to match competitor tracking.');
  if (actions.length === 0) actions.push('Maintain quality and keep content fresh to stay ahead.');

  return { rows, wins, gaps, actions, myHostname, compHostname };
}

function renderComparison(cmp, competitorUrl) {
  show('compareResults');

  // Update column labels
  document.querySelectorAll('.compare-col-label')[0].textContent = cmp.myHostname || 'My Page';
  document.querySelectorAll('.compare-col-label')[1].textContent = cmp.compHostname || 'Competitor';

  // Scorecard table
  const tableEl = document.getElementById('compareTable');
  tableEl.innerHTML = `
    <div class="compare-row" style="font-weight:700;color:var(--gray-600);font-size:11px;">
      <div>METRIC</div><div style="text-align:center">MY PAGE</div><div style="text-align:center">COMPETITOR</div>
    </div>
    ${cmp.rows.map(row => {
      const myV   = String(row.my);
      const compV = String(row.comp);
      let myClass = '', compClass = '';
      if (row.higher === 'better') {
        const myN = parseFloat(myV) || 0, compN = parseFloat(compV) || 0;
        if (myN > compN)  { myClass = 'win'; compClass = ''; }
        if (compN > myN)  { compClass = 'win'; myClass = ''; }
      }
      return `
        <div class="compare-row">
          <div class="compare-metric">${escHtml(row.metric)}</div>
          <div class="compare-val ${myClass}">${escHtml(myV)}</div>
          <div class="compare-val ${compClass}">${escHtml(compV)}</div>
        </div>`;
    }).join('')}`;

  // Wins
  document.getElementById('compareWins').innerHTML = cmp.wins.map(w =>
    `<div class="result-item"><div class="result-label"><span class="dot dot-green"></span> ${escHtml(w)}</div></div>`
  ).join('');

  // Gaps
  document.getElementById('compareGaps').innerHTML = cmp.gaps.map(g =>
    `<div class="result-item"><div class="result-label"><span class="dot dot-red"></span> ${escHtml(g)}</div></div>`
  ).join('');

  // Actions
  document.getElementById('compareActions').innerHTML = cmp.actions.map(a =>
    `<div class="result-item"><div class="result-label"><span class="dot dot-amber"></span> ${escHtml(a)}</div></div>`
  ).join('');
}

/* ================================================================
   SPEED CHECK
================================================================ */
async function runSpeed() {
  const btn = document.getElementById('runSpeedBtn');
  showLoading('speedLoading', true);
  hide('speedResults');
  btn.disabled = true;

  try {
    await ensureContentScript();
    const resp = await sendToContent({ action: 'GET_SPEED' });
    if (!resp?.ok) throw new Error(resp?.error || 'Speed check failed');
    state.speedData = resp.data;
    renderSpeed(resp.data);
  } catch (e) {
    alert('Speed check failed: ' + e.message);
  } finally {
    showLoading('speedLoading', false);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span> Check Speed';
  }
}

function renderSpeed(data) {
  show('speedResults');

  const loadMs = data.loadTime || 0;
  const rating = loadMs < 2000 ? 'fast' : loadMs < 4000 ? 'avg' : 'slow';
  const ratingLabel = rating === 'fast' ? '🟢 Fast' : rating === 'avg' ? '🟡 Average' : '🔴 Slow';
  const score   = rating === 'fast' ? 85 : rating === 'avg' ? 55 : 25;

  document.getElementById('speedOverview').innerHTML = `
    <div class="speed-meter">
      <span class="speed-score">${loadMs ? Math.round(loadMs/100)/10 + 's' : 'N/A'}</span>
      <div class="speed-bar-wrap">
        <div class="speed-bar ${rating}" style="width:${Math.min(100,score)}%"></div>
      </div>
      <span class="speed-label">${ratingLabel}</span>
    </div>
    <div style="font-size:11.5px;color:var(--gray-600);margin-top:6px;">
      ${data.ttfb ? `TTFB: ${data.ttfb}ms &nbsp;·&nbsp;` : ''}
      ${data.domContent ? `DOM Ready: ${data.domContent}ms &nbsp;·&nbsp;` : ''}
      Total: ${data.totalKB} KB &nbsp;·&nbsp;
      ${data.resourceCount} resources &nbsp;·&nbsp;
      ${data.nodeCount} DOM nodes
    </div>
    ${loadMs > 3000 ? '<div class="result-action" style="margin-top:6px;">→ Page is slow. Users leave after 3 seconds. Optimize images and minify JS/CSS.</div>' : ''}`;

  // Asset issues
  const assetsEl = document.getElementById('speedAssets');
  if (data.largeImages.length === 0) {
    assetsEl.innerHTML = '<div class="result-item"><div class="result-label"><span class="dot dot-green"></span> No oversized images detected</div></div>';
  } else {
    assetsEl.innerHTML = data.largeImages.map(img => `
      <div class="result-item">
        <div class="result-label"><span class="dot dot-red"></span> Large image: ${escHtml(img.url)} <span class="badge badge-high">${img.size}</span></div>
        <div class="result-action">→ Compress or convert to WebP format.</div>
      </div>`).join('');
  }
  if (data.nodeCount > 1500) {
    assetsEl.innerHTML += `<div class="result-item"><div class="result-label"><span class="dot dot-amber"></span> High DOM complexity (${data.nodeCount} nodes)<span class="badge badge-med">MED</span></div><div class="result-action">→ Simplify HTML structure for faster rendering.</div></div>`;
  }

  // Tips
  document.getElementById('speedTips').innerHTML = [
    { condition: loadMs > 3000,          text: 'Use a CDN to serve assets closer to visitors globally.' },
    { condition: data.totalKB > 3000,    text: 'Total page size exceeds 3MB. Minify CSS, JS, and compress images.' },
    { condition: data.largeImages.length > 0, text: 'Convert large images to WebP — typically 30-50% smaller.' },
    { condition: data.nodeCount > 2000,  text: 'Reduce DOM nodes below 1,500 for smoother rendering.' },
    { condition: data.ttfb > 600,        text: 'High TTFB — consider upgrading your hosting or enabling caching.' },
    { condition: true,                   text: 'Enable Gzip or Brotli compression on your server.' },
  ].filter(t => t.condition).slice(0, 4).map(t =>
    `<div class="result-item"><div class="result-label"><span class="dot dot-amber"></span> ${escHtml(t.text)}</div></div>`
  ).join('');
}

/* ================================================================
   SCREENSHOT CAPTURE
================================================================ */
async function captureVisible() {
  const btn = document.getElementById('captureVisibleBtn');
  btn.disabled = true;
  btn.textContent = 'Capturing…';
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'CAPTURE_SCREENSHOT' });
    if (!resp?.ok) throw new Error(resp?.error || 'Capture failed');
    state.screenshotUrl = resp.dataUrl;
    showScreenshot(resp.dataUrl);
  } catch (e) {
    alert('Screenshot failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📸 Visible Screenshot';
  }
}

async function captureFullPage() {
  const btn = document.getElementById('captureFullBtn');
  btn.disabled = true;
  btn.textContent = 'Capturing…';
  try {
    // Inject a full-page scroll capture
    await ensureContentScript();
    const resp = await chrome.runtime.sendMessage({ action: 'CAPTURE_SCREENSHOT' });
    if (!resp?.ok) throw new Error(resp?.error || 'Capture failed');
    state.screenshotUrl = resp.dataUrl;
    showScreenshot(resp.dataUrl);
    // Note: true full-page requires canvas stitching (placeholder for v1)
    alert('Note: Full-page capture shows the current viewport. Full scroll-capture will be added in v1.1.');
  } catch (e) {
    alert('Screenshot failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 Full-Page Screenshot';
  }
}

function showScreenshot(dataUrl) {
  const preview = document.getElementById('capturePreview');
  const img = document.getElementById('screenshotImg');
  img.src = dataUrl;
  preview.style.display = '';
}

async function downloadScreenshot() {
  if (!state.screenshotUrl) return;
  const note     = document.getElementById('screenshotNote').value || '';
  const filename = `siteready-${Date.now()}.png`;
  await chrome.runtime.sendMessage({ action: 'DOWNLOAD_FILE', url: state.screenshotUrl, filename });
}

function copyScreenshotLink() {
  if (!state.screenshotUrl) return;
  navigator.clipboard.writeText(state.currentTab?.url || '').then(() => {
    showFeedback('shareFeedback', '✅ Page URL copied! (Full image sharing requires cloud upload)');
  });
}

/* ================================================================
   SCREEN RECORDING
================================================================ */
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'tab' },
      audio: false,
    });
    state.recordedChunks = [];
    state.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
    state.mediaRecorder.onstop = saveRecording;
    state.mediaRecorder.start(1000);

    document.getElementById('captureRecordBtn').style.display = 'none';
    show('recordingState');
  } catch (e) {
    alert('Recording requires screen share permission. ' + e.message);
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
    state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  hide('recordingState');
  document.getElementById('captureRecordBtn').style.display = '';
}

function saveRecording() {
  const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `siteready-rec-${Date.now()}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================
   SHARE
================================================================ */
function buildShareText() {
  const tab  = state.currentTab;
  const url  = tab?.url || 'Unknown URL';
  const now  = new Date().toLocaleString();
  const audit = state.auditData;
  const compare = state.compareData;

  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  let text = `🔍 SiteReady AI Audit Report\n`;
  text += `📍 Page: ${hostname}\n`;
  text += `🕐 Time: ${now}\n`;
  text += `🔗 URL: ${url}\n\n`;

  if (audit) {
    const allItems = [...(audit.cta||[]), ...(audit.trust||[]), ...(audit.forms||[]), ...(audit.links||[]), ...(audit.content||[]), ...(audit.structure||[]), ...(audit.mobile||[])];
    const critical = allItems.filter(i => i.status === 'high');
    const warnings = allItems.filter(i => i.status === 'med');
    text += `📊 Score: ${audit.score}/100\n`;
    text += `🔴 Critical Issues: ${critical.length}\n`;
    text += `🟡 Warnings: ${warnings.length}\n`;
    if (critical.length > 0) text += `\nTop Issues:\n${critical.slice(0,3).map(i => `• ${i.label}`).join('\n')}\n`;
  }

  if (compare) {
    text += `\n⚡ vs ${compare.compHostname || 'Competitor'}:\n`;
    if (compare.wins.length > 0) text += `✅ ${compare.wins[0]}\n`;
    if (compare.gaps.length > 0) text += `❌ ${compare.gaps[0]}\n`;
  }

  text += `\n— Generated by SiteReady AI Chrome Extension`;

  document.getElementById('shareText').value = text;
  return text;
}

function shareWhatsApp() {
  const text = getShareText();
  chrome.tabs.create({ url: `https://wa.me/?text=${encodeURIComponent(text)}` });
}

function shareSlack() {
  const text = getShareText();
  const slackUrl = `slack://open?text=${encodeURIComponent(text)}`;
  chrome.tabs.create({ url: `https://slack.com/intl/en-gb/` });
  navigator.clipboard.writeText(text).then(() => {
    showFeedback('shareFeedback', '✅ Copied! Open Slack and paste into any channel.');
  });
}

function shareTeams() {
  const text = getShareText();
  navigator.clipboard.writeText(text).then(() => {
    chrome.tabs.create({ url: `https://teams.microsoft.com/` });
    showFeedback('shareFeedback', '✅ Copied! Open Teams and paste into a channel.');
  });
}

function shareEmail() {
  const text = getShareText();
  const url  = state.currentTab?.url || '';
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const subject  = encodeURIComponent(`SiteReady AI Audit — ${hostname}`);
  const body     = encodeURIComponent(text);
  chrome.tabs.create({ url: `mailto:?subject=${subject}&body=${body}` });
}

function shareCopy() {
  const text = getShareText();
  navigator.clipboard.writeText(text).then(() => {
    showFeedback('shareFeedback', '✅ Copied to clipboard!');
  }).catch(() => {
    // Fallback
    const ta = document.getElementById('shareText');
    ta.select();
    document.execCommand('copy');
    showFeedback('shareFeedback', '✅ Copied!');
  });
}

function getShareText() {
  const ta = document.getElementById('shareText');
  return ta.value || buildShareText();
}

/* ================================================================
   HELPERS
================================================================ */
async function ensureContentScript() {
  if (!state.currentTab?.id) throw new Error('No active tab');
  try {
    await chrome.scripting.executeScript({
      target: { tabId: state.currentTab.id },
      files: ['contentScript.js'],
    });
  } catch {
    // Already injected — ignore
  }
}

function sendToContent(msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(state.currentTab.id, msg, resp => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(resp);
      }
    });
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoading(id, visible) {
  document.getElementById(id).style.display = visible ? 'flex' : 'none';
}
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function showFeedback(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function setLastRun(update = false) {
  const el = document.getElementById('lastRunTime');
  if (update) {
    const now = new Date().toLocaleTimeString();
    chrome.storage.local.set({ lastRun: now });
    el.textContent = `Last scan: ${now}`;
  } else {
    chrome.storage.local.get(['lastRun'], r => {
      if (r.lastRun) el.textContent = `Last scan: ${r.lastRun}`;
    });
  }
}

function loadSavedState() {
  chrome.storage.local.get(['auditData', 'auditUrl', 'tagsData'], r => {
    const currentUrl = state.currentTab?.url;
    if (r.auditData && r.auditUrl === currentUrl) {
      state.auditData = r.auditData;
      renderAudit(r.auditData);
      buildShareText();
    }
    if (r.tagsData) {
      state.tagsData = r.tagsData;
      renderTags(r.tagsData);
    }
  });
}
