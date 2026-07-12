/* ============================================================
   SiteReady AI — Content Script
   Runs in the context of the target page.
   ============================================================ */

(function () {
  'use strict';

  /* ---- Message listener ---- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'AUDIT_PAGE') {
      try {
        const data = auditPage();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
    if (msg.action === 'DETECT_TAGS') {
      try {
        const data = detectTags();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
    if (msg.action === 'GET_SPEED') {
      try {
        const data = getSpeedData();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
  });

  /* ================================================================
     AUDIT PAGE
  ================================================================ */
  function auditPage() {
    const url  = location.href;
    const html = document.documentElement.outerHTML;
    const text = document.body ? document.body.innerText : '';

    return {
      url,
      title:       document.title,
      cta:         auditCTAs(),
      trust:       auditTrustSignals(),
      forms:       auditForms(),
      links:       auditLinks(),
      content:     auditContent(text),
      structure:   auditStructure(),
      mobile:      auditMobile(),
      score:       computeScore(),
    };
  }

  /* ---- CTA Audit ---- */
  function auditCTAs() {
    const results = [];
    const ctaKeywords = [
      'get started', 'buy now', 'sign up', 'start free', 'try free',
      'book a demo', 'request demo', 'contact us', 'learn more', 'download',
      'subscribe', 'register', 'join', 'order now', 'shop now', 'schedule',
      'get quote', 'free trial', 'start now', 'claim', 'apply now',
    ];
    const weakKeywords = ['click here', 'submit', 'go', 'send', 'next', 'read more'];

    const buttons = [...document.querySelectorAll('button, a, input[type="submit"], [role="button"]')];
    const ctaButtons = [];
    const weakButtons = [];

    buttons.forEach(el => {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
      if (!txt || txt.length > 80) return;
      const isStrong = ctaKeywords.some(k => txt.includes(k));
      const isWeak   = weakKeywords.some(k => txt === k || txt.startsWith(k + ' '));
      if (isStrong) ctaButtons.push(txt);
      else if (isWeak) weakButtons.push(txt);
    });

    const uniqueStrong = [...new Set(ctaButtons)];
    const uniqueWeak   = [...new Set(weakButtons)];

    if (uniqueStrong.length === 0) {
      results.push({ status: 'high', label: 'No clear CTA found', detail: 'Page has no strong action buttons (Buy Now, Get Started, Book Demo, etc.)', action: 'Add a prominent CTA above the fold immediately.' });
    } else {
      results.push({ status: 'ok', label: `${uniqueStrong.length} clear CTA(s) found`, detail: uniqueStrong.slice(0, 3).map(t => `"${t}"`).join(', '), action: 'Good. Make sure the primary CTA stands out visually.' });
    }
    if (uniqueWeak.length > 0) {
      results.push({ status: 'med', label: 'Weak CTA text detected', detail: `Found: ${uniqueWeak.slice(0,3).map(t=>`"${t}"`).join(', ')}`, action: 'Replace vague labels with benefit-driven language.' });
    }

    // Above-the-fold CTA check (rough)
    const aboveFold = [...document.querySelectorAll('button, a')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.top > 0;
    });
    const aboveFoldCTA = aboveFold.filter(el => {
      const t = (el.innerText||'').toLowerCase();
      return ctaKeywords.some(k => t.includes(k));
    });
    if (aboveFoldCTA.length === 0 && uniqueStrong.length > 0) {
      results.push({ status: 'med', label: 'No CTA above the fold', detail: 'Visitors may miss the call-to-action without scrolling.', action: 'Move or duplicate the primary CTA to the hero section.' });
    }

    return results;
  }

  /* ---- Trust Signals ---- */
  function auditTrustSignals() {
    const results = [];
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const html     = document.documentElement.innerHTML.toLowerCase();

    const checks = [
      { label: 'Testimonials / Reviews', patterns: ['testimonial','review','what our','what clients','customer say','said about','star rating','"we use','⭐'], key: 'testimonials' },
      { label: 'Trust Badges / Certifications', patterns: ['ssl','secure','certified','iso ','gdpr','money-back','guaranteed','verified','badge'], key: 'badges' },
      { label: 'Client Logos / Social Proof', patterns: ['our clients','trusted by','used by','as seen in','logo','brand partners'], key: 'logos' },
      { label: 'Guarantees / Risk Reversal', patterns: ['guarantee','money back','refund','no risk','cancel anytime','risk-free'], key: 'guarantee' },
      { label: 'FAQs', patterns: ['frequently asked','faq','questions and answers','q:','q&a'], key: 'faq' },
      { label: 'Case Studies / Results', patterns: ['case study','result','we helped','success story','before and after','increased by','reduced by'], key: 'casestudy' },
      { label: 'Social Media Links', patterns: ['twitter.com','linkedin.com','facebook.com','instagram.com','youtube.com'], key: 'social' },
    ];

    checks.forEach(c => {
      const found = c.patterns.some(p => bodyText.includes(p) || html.includes(p));
      results.push({
        status: found ? 'ok' : 'med',
        label: c.label,
        detail: found ? 'Detected on page' : 'Not found — may reduce trust',
        action: found ? '' : `Add ${c.label.toLowerCase()} to improve credibility and conversion.`,
      });
    });

    return results;
  }

  /* ---- Forms ---- */
  function auditForms() {
    const results = [];
    const forms = [...document.querySelectorAll('form')];
    const inputs = [...document.querySelectorAll('input[type="email"], input[type="tel"], input[type="text"]')];

    if (forms.length === 0 && inputs.length === 0) {
      results.push({ status: 'high', label: 'No lead capture form found', detail: 'Page has no forms to capture leads or data.', action: 'Add a contact form, email opt-in, or booking form.' });
      return results;
    }

    results.push({ status: 'ok', label: `${forms.length} form(s) found`, detail: `${inputs.length} input field(s) detected`, action: '' });

    // Check for email field
    const emailInput = document.querySelector('input[type="email"]');
    if (!emailInput) {
      results.push({ status: 'med', label: 'No email field detected', detail: 'Forms found but no email capture field.', action: 'Add an email field to build your mailing list.' });
    } else {
      results.push({ status: 'ok', label: 'Email capture field present', detail: '', action: '' });
    }

    // Check for privacy / GDPR note near form
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const hasPrivacy = bodyText.includes('privacy') || bodyText.includes('gdpr') || bodyText.includes('we respect') || bodyText.includes('no spam');
    if (!hasPrivacy) {
      results.push({ status: 'low', label: 'No privacy/GDPR note near form', detail: 'Improves trust and compliance.', action: 'Add "We respect your privacy. No spam." near the form.' });
    }

    // Check for thank-you page / success message indication
    const hasThankYou = bodyText.includes('thank you') || bodyText.includes('success') || bodyText.includes('confirmation');
    if (!hasThankYou) {
      results.push({ status: 'med', label: 'No thank-you confirmation visible', detail: 'Users may not know if their form was submitted.', action: 'Add a visible success message or redirect to a thank-you page.' });
    }

    return results;
  }

  /* ---- Links ---- */
  function auditLinks() {
    const results = [];
    const allLinks = [...document.querySelectorAll('a[href]')];
    const currentHost = location.hostname;

    let internal = 0, external = 0, empty = 0, hashOnly = 0, brokenPDF = 0;
    const externalDomains = new Set();

    allLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href || href === '#' || href === 'javascript:void(0)') { empty++; return; }
      if (href.startsWith('#')) { hashOnly++; return; }
      if (href.endsWith('.pdf') || href.includes('.pdf?')) brokenPDF++;
      try {
        const u = new URL(href, location.href);
        if (u.hostname === currentHost || u.hostname === '') internal++;
        else { external++; externalDomains.add(u.hostname); }
      } catch { empty++; }
    });

    results.push({ status: 'ok', label: `${allLinks.length} total links`, detail: `${internal} internal · ${external} external · ${hashOnly} anchor-only · ${empty} empty/void`, action: '' });

    if (empty > 3) {
      results.push({ status: 'med', label: `${empty} empty or placeholder links`, detail: 'Links with # or void href provide no value.', action: 'Remove or fix placeholder links before launch.' });
    }
    if (external > 0) {
      results.push({ status: 'low', label: `${external} external links`, detail: `Domains: ${[...externalDomains].slice(0,3).join(', ')}`, action: 'Ensure external links open in new tabs and use rel="noopener".' });
    }
    if (brokenPDF > 0) {
      results.push({ status: 'med', label: `${brokenPDF} PDF link(s) detected`, detail: 'PDF links cannot be verified from extension. Check manually.', action: 'Click each PDF link to confirm it downloads correctly.' });
    }

    // Check for mailto: links
    const mailtoLinks = allLinks.filter(a => (a.getAttribute('href')||'').startsWith('mailto:'));
    if (mailtoLinks.length > 0) {
      results.push({ status: 'ok', label: `${mailtoLinks.length} mailto link(s)`, detail: 'Email contact option present', action: '' });
    }

    return results;
  }

  /* ---- Content ---- */
  function auditContent(text) {
    const results = [];
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const avgWords = sentences.length ? (wordCount / sentences.length).toFixed(1) : 0;

    // Word count
    if (wordCount < 150) {
      results.push({ status: 'high', label: `Very thin content (${wordCount} words)`, detail: 'Pages with fewer than 150 words rarely convert or rank.', action: 'Add more copy: value proposition, benefits, process, FAQs.' });
    } else if (wordCount < 400) {
      results.push({ status: 'med', label: `Moderate content (${wordCount} words)`, detail: 'Consider adding more detail for SEO and trust.', action: 'Expand with customer outcomes, FAQs, or testimonials.' });
    } else {
      results.push({ status: 'ok', label: `Good content depth (${wordCount} words)`, detail: 'Page has substantial written content.', action: '' });
    }

    // Readability estimate
    if (avgWords > 30) {
      results.push({ status: 'med', label: 'Long sentences detected', detail: `Average ~${avgWords} words per sentence. May reduce readability.`, action: 'Break long sentences into shorter, punchy statements.' });
    }

    // H1 check
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      results.push({ status: 'high', label: 'No H1 heading found', detail: 'Missing H1 hurts SEO and page clarity.', action: 'Add a single, clear H1 headline that states your main offer.' });
    } else if (h1s.length > 1) {
      results.push({ status: 'med', label: `${h1s.length} H1 tags found`, detail: 'Multiple H1s dilute SEO signal.', action: 'Use only one H1 per page.' });
    } else {
      results.push({ status: 'ok', label: 'H1 headline present', detail: `"${h1s[0].innerText.slice(0,60)}${h1s[0].innerText.length > 60 ? '…' : ''}"`, action: '' });
    }

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc || !metaDesc.content) {
      results.push({ status: 'high', label: 'No meta description', detail: 'Missing meta description reduces click-through rate from search.', action: 'Add a compelling 120-160 character meta description.' });
    } else {
      const len = metaDesc.content.length;
      const status = len < 50 ? 'med' : len > 160 ? 'low' : 'ok';
      results.push({ status, label: `Meta description: ${len} chars`, detail: metaDesc.content.slice(0,80) + (metaDesc.content.length > 80 ? '…' : ''), action: status === 'ok' ? '' : 'Aim for 120–160 characters for best search display.' });
    }

    // Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogTitle || !ogImage) {
      results.push({ status: 'med', label: 'Incomplete Open Graph tags', detail: 'Missing og:title or og:image reduces social share appearance.', action: 'Add og:title, og:description, og:image for social sharing.' });
    }

    return results;
  }

  /* ---- Structure ---- */
  function auditStructure() {
    const results = [];

    // Headings hierarchy
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const hasH2 = headings.some(h => h.tagName === 'H2');
    if (!hasH2 && headings.length > 0) {
      results.push({ status: 'med', label: 'No H2 headings', detail: 'Flat structure makes content harder to scan.', action: 'Use H2 for section headings, H3 for subsections.' });
    } else {
      results.push({ status: 'ok', label: `${headings.length} headings found`, detail: `H1:${[...document.querySelectorAll('h1')].length} H2:${[...document.querySelectorAll('h2')].length} H3:${[...document.querySelectorAll('h3')].length}`, action: '' });
    }

    // Images
    const images = [...document.querySelectorAll('img')];
    const noAlt  = images.filter(img => !img.alt || img.alt.trim() === '');
    if (noAlt.length > 0) {
      results.push({ status: 'med', label: `${noAlt.length} image(s) missing alt text`, detail: 'Hurts accessibility and SEO image indexing.', action: 'Add descriptive alt text to all important images.' });
    }

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      results.push({ status: 'low', label: 'No canonical tag', detail: 'May cause duplicate content issues.', action: 'Add <link rel="canonical"> to specify the preferred URL.' });
    }

    // Favicon
    const favicon = document.querySelector('link[rel*="icon"]');
    if (!favicon) {
      results.push({ status: 'low', label: 'No favicon detected', detail: 'Favicon adds professionalism and brand recognition.', action: 'Add a favicon (SVG or 32x32 PNG) to your site.' });
    }

    // Schema markup
    const schema = document.querySelector('script[type="application/ld+json"]');
    if (!schema) {
      results.push({ status: 'low', label: 'No schema markup (JSON-LD)', detail: 'Schema helps search engines understand your content.', action: 'Add Organization or WebPage schema for richer search results.' });
    } else {
      results.push({ status: 'ok', label: 'Schema markup present', detail: '', action: '' });
    }

    return results;
  }

  /* ---- Mobile ---- */
  function auditMobile() {
    const results = [];

    // Viewport meta
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      results.push({ status: 'high', label: 'Missing viewport meta tag', detail: 'Page will not scale correctly on mobile devices.', action: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });
    } else {
      results.push({ status: 'ok', label: 'Viewport meta tag present', detail: vp.content, action: '' });
    }

    // Horizontal scroll check
    if (document.documentElement.scrollWidth > window.innerWidth + 20) {
      results.push({ status: 'high', label: 'Page overflow detected', detail: 'Page content is wider than the viewport — likely broken on mobile.', action: 'Check for fixed-width elements and remove overflow: hidden from body.' });
    }

    // Font size check (rough)
    const bodyStyle = window.getComputedStyle(document.body);
    const fontSize  = parseFloat(bodyStyle.fontSize);
    if (fontSize < 14) {
      results.push({ status: 'med', label: `Small base font size (${fontSize}px)`, detail: 'Text may be too small to read on mobile.', action: 'Use 16px or larger as base font size.' });
    }

    // Touch targets (rough — find very small buttons)
    const smallBtns = [...document.querySelectorAll('button, a')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 30 || r.height < 30);
    });
    if (smallBtns.length > 3) {
      results.push({ status: 'med', label: `${smallBtns.length} small tap targets`, detail: 'Some buttons/links may be too small for mobile tapping.', action: 'Ensure all tap targets are at least 44×44px.' });
    }

    return results;
  }

  /* ---- Score ---- */
  function computeScore() {
    let score = 100;
    const checks = [
      { el: 'h1', weight: 15, present: !!document.querySelector('h1') },
      { el: 'viewport', weight: 10, present: !!document.querySelector('meta[name="viewport"]') },
      { el: 'meta-desc', weight: 10, present: !!document.querySelector('meta[name="description"]')?.content },
      { el: 'form', weight: 10, present: !!document.querySelector('form, input[type="email"]') },
      { el: 'h2', weight: 5, present: !!document.querySelector('h2') },
      { el: 'canonical', weight: 5, present: !!document.querySelector('link[rel="canonical"]') },
    ];
    checks.forEach(c => { if (!c.present) score -= c.weight; });
    return Math.max(0, score);
  }

  /* ================================================================
     DETECT MARKETING TAGS
  ================================================================ */
  function detectTags() {
    const html    = document.documentElement.innerHTML;
    const scripts = [...document.querySelectorAll('script')].map(s => s.src + ' ' + (s.textContent || ''));
    const allText = scripts.join(' ') + html;

    function extract(pattern) {
      const m = allText.match(pattern);
      return m ? m[1] || m[0] : null;
    }

    const tags = [
      {
        name: 'Google Analytics 4 (GA4)',
        key: 'ga4',
        detected: /gtag\s*\(|G-[A-Z0-9]{6,12}|google-analytics\.com\/gtag/.test(allText),
        id: extract(/G-([A-Z0-9]{6,12})/)?? null,
        fullId: extract(/G-[A-Z0-9]{6,12}/) ?? null,
      },
      {
        name: 'Google Tag Manager (GTM)',
        key: 'gtm',
        detected: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(allText),
        id: extract(/GTM-([A-Z0-9]+)/) ?? null,
        fullId: extract(/GTM-[A-Z0-9]+/) ?? null,
      },
      {
        name: 'Google Ads (gAds)',
        key: 'gads',
        detected: /AW-[0-9]+|googleads\.g\.doubleclick|conversion\.js/.test(allText),
        id: extract(/AW-([0-9]+)/) ?? null,
        fullId: extract(/AW-[0-9]+/) ?? null,
      },
      {
        name: 'Meta Pixel (Facebook)',
        key: 'meta',
        detected: /fbq\s*\(|connect\.facebook\.net|facebook\.com\/tr/.test(allText),
        id: extract(/fbq\(['"]init['"],\s*['"]([0-9]+)/) ?? null,
        fullId: null,
      },
      {
        name: 'LinkedIn Insight Tag',
        key: 'linkedin',
        detected: /snap\.licdn\.com|linkedin\.com\/insight|_linkedin_partner_id/.test(allText),
        id: extract(/_linkedin_partner_id\s*=\s*['"]?([0-9]+)/) ?? null,
        fullId: null,
      },
      {
        name: 'TikTok Pixel',
        key: 'tiktok',
        detected: /analytics\.tiktok\.com|ttq\.load|TiktokAnalyticsObject/.test(allText),
        id: extract(/ttq\.load\(['"]([A-Z0-9]+)/) ?? null,
        fullId: null,
      },
      {
        name: 'HubSpot Tracking',
        key: 'hubspot',
        detected: /js\.hs-analytics\.net|js\.hubspot\.com|_hsq/.test(allText),
        id: null,
        fullId: null,
      },
      {
        name: 'Hotjar',
        key: 'hotjar',
        detected: /static\.hotjar\.com|hjid:|hjsv:/.test(allText),
        id: extract(/hjid:\s*([0-9]+)/) ?? null,
        fullId: null,
      },
      {
        name: 'Intercom',
        key: 'intercom',
        detected: /widget\.intercom\.io|Intercom\s*\(/.test(allText),
        id: null,
        fullId: null,
      },
      {
        name: 'Clarity (Microsoft)',
        key: 'clarity',
        detected: /clarity\.ms\/tag|window\.clarity/.test(allText),
        id: null,
        fullId: null,
      },
    ];

    return {
      detected: tags.filter(t => t.detected),
      missing:  tags.filter(t => !t.detected),
      all:      tags,
    };
  }

  /* ================================================================
     SPEED DATA (from Performance API)
  ================================================================ */
  function getSpeedData() {
    const nav    = performance.getEntriesByType('navigation')[0] || {};
    const timing = performance.timing || {};

    const loadTime   = nav.loadEventEnd     ? Math.round(nav.loadEventEnd - nav.startTime)     : (timing.loadEventEnd - timing.navigationStart) || null;
    const domContent = nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null;
    const ttfb       = nav.responseStart    ? Math.round(nav.responseStart - nav.startTime)      : null;

    // Image sizes (from resource timing)
    const resources = performance.getEntriesByType('resource');
    const images    = resources.filter(r => r.initiatorType === 'img' || /\.(jpg|jpeg|png|gif|webp|svg)/.test(r.name));
    const largeImgs = images.filter(r => r.transferSize > 200000); // > 200 KB

    const totalTransfer = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
    const totalKB       = Math.round(totalTransfer / 1024);

    // DOM complexity
    const nodeCount = document.querySelectorAll('*').length;

    return {
      loadTime,
      domContent,
      ttfb,
      totalKB,
      largeImages: largeImgs.map(r => ({
        url:  r.name.split('/').pop().slice(0, 40),
        size: Math.round(r.transferSize / 1024) + ' KB',
      })),
      nodeCount,
      resourceCount: resources.length,
    };
  }

})();
