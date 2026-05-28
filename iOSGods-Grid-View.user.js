// ==UserScript==
// @name         iOSGods Grid View
// @namespace    iosgods-grid
// @version      1.5
// @description  Replaces the iOSGods store list with a card grid layout + infinite scroll
// @match        https://app.iosgods.com/store/games/new-and-updates*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    .page-content.infinite-scroll-content > *:not(#ig-grid-wrap) {
      display: none !important;
    }

    #ig-grid-wrap {
      padding: 20px 14px 40px;
      margin: 0 auto;
      box-sizing: border-box;
    }

    #ig-grid-wrap h2 {
      font-family: 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: 1.3rem;
      color: #e0d8f0;
      margin: 0 0 18px 4px;
      letter-spacing: .3px;
    }

    #ig-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 18px;
    }

    .ig-card {
      background: var(--f7-page-bg-color);
      border: 1px solid #2d2347;
      border-radius: 14px;
      padding: 20px 12px 16px;
      text-align: center;
      transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      animation: igFadeUp .45s ease both;
    }
    .ig-card:nth-child(2)  { animation-delay: .04s; }
    .ig-card:nth-child(3)  { animation-delay: .08s; }
    .ig-card:nth-child(4)  { animation-delay: .12s; }
    .ig-card:nth-child(5)  { animation-delay: .16s; }
    .ig-card:nth-child(6)  { animation-delay: .20s; }
    .ig-card:nth-child(7)  { animation-delay: .24s; }
    .ig-card:nth-child(8)  { animation-delay: .28s; }
    .ig-card:nth-child(9)  { animation-delay: .32s; }
    .ig-card:nth-child(10) { animation-delay: .36s; }

    .ig-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 28px rgba(110, 60, 255, .22);
      border-color: #6e3cff;
    }

    .ig-card img {
      width: 140px;
      height: 140px;
      border-radius: 18px;
      object-fit: cover;
      margin-bottom: 12px;
      box-shadow: 0 4px 14px rgba(0,0,0,.45);
    }

    .ig-card .ig-title {
      font-family: 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: .84rem;
      color: #f0ecf8;
      line-height: 1.3;
      margin-bottom: 7px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ig-card .ig-desc {
      font-size: .73rem;
      color: #9e95b3;
      line-height: 1.35;
      margin-bottom: 10px;
      flex-grow: 1;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ig-card .ig-date {
      font-size: .66rem;
      color: #6e6484;
      background: rgba(110, 60, 255, .1);
      padding: 3px 10px;
      border-radius: 20px;
      letter-spacing: .2px;
    }

    .ig-tag {
      position: absolute;
      top: 9px;
      right: 9px;
      font-size: .58rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      padding: 2px 7px;
      border-radius: 6px;
    }
    .ig-tag.free    { background: #1a6b35; color: #9cffbe; }
    .ig-tag.premium { background: #6b3a1a; color: #ffc89c; }

    #ig-scroll-sentinel {
      text-align: center;
      padding: 28px 0 8px;
      color: #6e6484;
      font-size: .82rem;
    }

    #ig-scroll-sentinel .ig-dots {
      display: inline-flex;
      gap: 5px;
    }
    #ig-scroll-sentinel .ig-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6e3cff;
      animation: igDotPulse 1.2s ease-in-out infinite;
    }
    #ig-scroll-sentinel .ig-dots span:nth-child(2) { animation-delay: .15s; }
    #ig-scroll-sentinel .ig-dots span:nth-child(3) { animation-delay: .3s; }

    #ig-end-msg {
      text-align: center;
      padding: 28px 0;
      color: #4a4360;
      font-size: .8rem;
    }

    @keyframes igFadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes igDotPulse {
      0%, 80%, 100% { opacity: .25; transform: scale(.8); }
      40%           { opacity: 1;   transform: scale(1.1); }
    }
  `);

  const API_BASE = 'https://app.iosgods.com/store/api/games/new-and-updates';
  const BLOCKED_GROUPS = new Set(['vip']);

  function timeAgo(iso) {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60)    return 'just now';
    if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch { return iso; }
  }

  function stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent.trim();
  }

  function buildCard(item) {
    // ── FIX: use <div> instead of <a> to avoid Framework7 interception ──
    const card = document.createElement('div');
    card.className = 'ig-card';
    card.title = stripHTML(item.description);

    const tagClass = (item.group || '').toLowerCase() === 'free' ? 'free' : 'premium';

    card.innerHTML = `
      <img src="${item.icon_100}" alt="" loading="lazy" />
      <span class="ig-tag ${tagClass}">${item.group || ''}</span>
      <div class="ig-title">${item.title}</div>
      <div class="ig-desc">${item.short_description || stripHTML(item.description)}</div>
      <div class="ig-date">${timeAgo(item.updated_at)}</div>
    `;

    // ── FIX: hard navigate on click, bypassing Framework7 router ──
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = `/store/appdetails/${item.slug}`;
      window.location.href = url;
    });

    return card;
  }

  function init() {
    const pageContent = document.querySelector('.page-content.infinite-scroll-content');
    if (!pageContent) {
      console.warn('[iOSGods Grid] .page-content not found, retrying…');
      setTimeout(init, 800);
      return;
    }

    pageContent.style.overflowY = 'auto';
    pageContent.style.webkitOverflowScrolling = 'touch';

    const wrap = document.createElement('div');
    wrap.id = 'ig-grid-wrap';
    wrap.innerHTML = `
      <h2>New &amp; Updated</h2>
      <div id="ig-grid"></div>
      <div id="ig-scroll-sentinel">
        <div class="ig-dots"><span></span><span></span><span></span></div>
      </div>
      <div id="ig-end-msg" style="display:none;">— end of results —</div>
    `;
    pageContent.prepend(wrap);

    const grid     = wrap.querySelector('#ig-grid');
    const sentinel = wrap.querySelector('#ig-scroll-sentinel');
    const endMsg   = wrap.querySelector('#ig-end-msg');
    let page       = 1;
    let loading    = false;
    let exhausted  = false;

    async function loadPage(p) {
      if (loading || exhausted) return;
      loading = true;
      sentinel.style.display = 'block';

      try {
        const resp = await fetch(`${API_BASE}?page=${p}&platform=ios`);
        const json = await resp.json();
        const items = (json.data || []).filter(
          item => !BLOCKED_GROUPS.has((item.group || '').toLowerCase())
        );

        items.forEach(item => grid.appendChild(buildCard(item)));

        if (items.length === 0) {
          exhausted = true;
          sentinel.style.display = 'none';
          endMsg.style.display = 'block';
        }
      } catch (err) {
        console.error('[iOSGods Grid]', err);
        sentinel.innerHTML = '<span style="color:#c44;">Failed to load — scroll to retry</span>';
      }

      loading = false;
    }

    const SCROLL_THRESHOLD = 300;

    function onScroll() {
      if (loading || exhausted) return;
      const { scrollTop, scrollHeight, clientHeight } = pageContent;
      if (scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD) {
        page++;
        loadPage(page);
      }
    }

    pageContent.addEventListener('scroll', onScroll, { passive: true });
    loadPage(1);
  }

  setTimeout(init, 700);
})();
