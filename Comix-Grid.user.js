// ==UserScript==
// @name         Comix.to Grid
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bookmark grid with stable SPA handling
// @author       You
// @match        *://comix.to/*
// @match        *://www.comix.to/*
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix-Grid.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix-Grid.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════
    const DEBUG = false;

    const log = (...a) => {
        if (DEBUG) {
            console.log('%c[BM-GRID]', 'color:#e0a548;font-weight:bold', ...a);
        }
    };

    // ═══════════════════════════════════════════════════
    // CSS
    // ═══════════════════════════════════════════════════
    GM_addStyle(`
        #bm-gw {
            --c-on: #4ade80;
            --c-done: #60a5fa;
            --c-hiat: #f87171;
            --c-drop: #f472b6;

            padding:20px;
            border-radius:10px;
            margin-bottom:20px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        }

        #bm-grid {
            display:grid;
            gap:16px;
        }

        @media(min-width:769px){
            #bm-grid {
                grid-template-columns:var(--bm-cols);
            }
        }

        @media(max-width:768px){
            #bm-gw{
                padding:14px 10px;
            }

            #bm-grid{
                grid-template-columns:repeat(auto-fill,minmax(145px,1fr));
                gap:12px;
            }

            .bc-b{
                padding:8px 10px 10px;
            }

            .bc-n{
                font-size:15px;
                min-height:33px;
            }
        }

        .bc{
            background:var(--bs-body-bg);
            border:1px solid var(--bs-body-tertiary-bg);
            border-radius:10px;
            overflow:hidden;
            transition:transform .25s,border-color .25s,box-shadow .25s;
        }

        .bc:hover{
            transform:translateY(-4px);
            border-color:rgba(224,165,72,.3);
            box-shadow:0 12px 32px rgba(0,0,0,.3);
        }

        .bc-i{
            position:relative;
            width:100%;
            aspect-ratio:3/4;
            overflow:hidden;
            background:#181b23;
        }

        .bc-i a{
            display:block;
            height:100%;
        }

        .bc-i img{
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
        }

        .bc-b{
            padding:10px 12px 12px;
        }

        .bc-n{
            font-size:13px;
            font-weight:600;
            line-height:1.35;
            margin-bottom:8px;

            display:-webkit-box;
            -webkit-line-clamp:2;
            -webkit-box-orient:vertical;
            overflow:hidden;
            min-height:35px;
        }

        .bc-n a{
            color:var(--bs-link-color-rgb);
            text-decoration:none;
        }

        .bc:hover .bc-n a{
            color:var(--bs-secondary);
        }

        .bc-f{
            display:flex;
            flex-direction:column;
            gap:5px;
        }

        .bc-r{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:6px;
        }

        .bc-ch{
            color:var(--bs-secondary);
            font-size:13px;
            font-weight:600;
            text-decoration:none;
            white-space:nowrap;
        }

        .bc-s{
            display:inline-flex;
            align-items:center;
            gap:4px;
            font-size:11.5px;
            font-weight:600;
            text-transform:uppercase;
        }

        .bc-sd{
            width:6px;
            height:6px;
            border-radius:50%;
        }

        .s-on{color:var(--c-on)}
        .s-on .bc-sd{background:var(--c-on)}

        .s-co{color:var(--c-done)}
        .s-co .bc-sd{background:var(--c-done)}

        .s-hi{color:var(--c-hiat)}
        .s-hi .bc-sd{background:var(--c-hiat)}

        .s-dr{color:var(--c-drop)}
        .s-dr .bc-sd{background:var(--c-drop)}

        .bc-m{
            font-size:15px;
            color:var(--bs-link-color-rgb);
            margin-left: auto;
            gap: 2px;
        }

        #bm-tog{
            position:fixed;
            bottom:20px;
            right:20px;
            z-index:99999;

            background:#1e2130;
            border:1px solid #2a2d3e;
            color:#e0a548;

            font-size:13px;
            font-weight:600;

            padding:10px 16px;
            border-radius:6px;

            cursor:pointer;
        }
    `);

    // ═══════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════
    let origUl = null;
    let wrapper = null;
    let isGrid = true;

    let rebuildTimer = null;
    let lastSignature = '';
    let lastUrl = location.href;

    // ═══════════════════════════════════════════════════
    // UTIL
    // ═══════════════════════════════════════════════════
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function perfectCols(n) {
        if (n <= 0) return 1;

        const sqrt = Math.sqrt(n);
        let best = n;

        for (let c = Math.ceil(sqrt); c <= n; c++) {
            if (n % c === 0) {
                best = c;
                break;
            }
        }

        const avail = window.innerWidth - 80;
        const maxFit = Math.max(1, Math.floor(avail / 216));

        return Math.min(best, maxFit);
    }

    function normPubStatus(raw) {
        const t = (raw || '').toLowerCase().trim();

        if (/releasing|ongoing|publishing/.test(t)) return 'on';
        if (/complet|finish/.test(t)) return 'co';
        if (/hiatus|pause|hold/.test(t)) return 'hi';
        if (/cancel|drop/.test(t)) return 'dr';

        return 'uk';
    }

    const PUB_LABELS = {
        on:'Releasing',
        co:'Completed',
        hi:'Hiatus',
        dr:'Dropped',
        uk:''
    };

    // ═══════════════════════════════════════════════════
    // FIND BOOKMARK LIST
    // ═══════════════════════════════════════════════════
    function findBookmarkList() {

        if (!location.href.includes('/user/bookmarks')) {
            return null;
        }

        const lists = document.querySelectorAll('ul, ol');

        for (const ul of lists) {

            const items = ul.querySelectorAll('li');

            if (
                items.length >= 1 &&
                ul.querySelector('.poster img')
            ) {
                return ul;
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════
    // SIGNATURE
    // ═══════════════════════════════════════════════════
    function getListSignature(ul) {

        return [...ul.querySelectorAll('li')]
            .map(li => li.textContent.trim())
            .join('|');
    }

    // ═══════════════════════════════════════════════════
    // PARSE
    // ═══════════════════════════════════════════════════
    function parseLi(li) {

        const anchor = li.querySelector('a[href*="/title/"]');

        if (!anchor) return null;

        const img = anchor.querySelector('.poster img');

        const nameEl = anchor.querySelector(':scope > span');

        const name = nameEl
            ? nameEl.textContent.trim()
            : '';

        if (!name) return null;

        const spans = [...li.children]
            .filter(c => c.tagName === 'SPAN' && c !== nameEl);

        const chapterRaw = spans[0]?.textContent?.trim() || '';
        const pubStatus = spans[2]?.textContent?.trim() || '';
        const updated = spans[3]?.textContent?.trim() || '';
        const lastRead = spans[5]?.textContent?.trim() || '';

        return {
            imgSrc: img?.src || '',
            name,
            href: anchor.getAttribute('href'),
            chapterRaw,
            pubKey: normPubStatus(pubStatus),
            pubLabel: pubStatus,
            updated,
            lastRead,
            origAnchor: anchor
        };
    }

    // ═══════════════════════════════════════════════════
    // CARD
    // ═══════════════════════════════════════════════════
    function card(d) {

        const el = document.createElement('div');

        el.className = 'bc';
        el._origAnchor = d.origAnchor;

        const pubL = PUB_LABELS[d.pubKey] || d.pubLabel || '';

        const chMatch = d.chapterRaw.match(/(\d+)\s*\/\s*(\d+)/);

        const chDisplay = chMatch
            ? `Ch. ${chMatch[1]}/${chMatch[2]}`
            : d.chapterRaw;

        el.innerHTML = `
            <div class="bc-i">
                <a href="${esc(d.href)}">
                    <img src="${esc(d.imgSrc)}" loading="lazy">
                </a>
            </div>

            <div class="bc-b">

                <div class="bc-n">
                    <a href="${esc(d.href)}">${esc(d.name)}</a>
                </div>

                <div class="bc-f">

                    <div class="bc-r">

                        <a href="${esc(d.href)}" class="bc-ch">
                            ${esc(chDisplay)}
                        </a>

                        ${
                            pubL
                                ? `
                                    <span class="bc-s s-${d.pubKey}">
                                        <span class="bc-sd"></span>
                                        ${esc(pubL)}
                                    </span>
                                `
                                : ''
                        }

                    </div>

                    <div class="bc-r">
                        <span class="bc-m">${esc(d.updated)}</span>
                    </div>

                </div>

            </div>
        `;

        return el;
    }

    // ═══════════════════════════════════════════════════
    // TOGGLE
    // ═══════════════════════════════════════════════════
    function toggle() {

        if (!origUl || !wrapper) return;

        isGrid = !isGrid;

        origUl.style.display = isGrid ? 'none' : '';
        wrapper.style.display = isGrid ? '' : 'none';

        syncToggle();
    }

    function syncToggle() {

        const b = document.getElementById('bm-tog');

        if (!b) return;

        b.innerHTML = isGrid
            ? '&#9776; List View'
            : '&#9638; Grid View';
    }

    function ensureToggle() {

        if (document.getElementById('bm-tog')) return;

        const b = document.createElement('button');

        b.id = 'bm-tog';

        b.onclick = toggle;

        document.body.appendChild(b);

        syncToggle();
    }

    // ═══════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════
    function cleanup() {

        if (wrapper) {
            wrapper.remove();
        }

        if (origUl && document.contains(origUl)) {
            origUl.style.display = '';
        }

        wrapper = null;
        origUl = null;
        lastSignature = '';
    }

    // ═══════════════════════════════════════════════════
    // REBUILD
    // ═══════════════════════════════════════════════════
    function rebuild() {

        const ul = findBookmarkList();

        // Left bookmarks page
        if (!ul) {
            cleanup();
            return;
        }

        const sig = getListSignature(ul);

        // No content changes
        if (sig === lastSignature && wrapper) {
            return;
        }

        lastSignature = sig;

        const lis = [...ul.querySelectorAll('li')];

        const data = [];

        for (const li of lis) {

            const d = parseLi(li);

            if (d) data.push(d);
        }

        if (!data.length) return;

        log('Rebuilding grid:', data.length);

        // FIRST BUILD
        if (!wrapper || !document.contains(wrapper)) {

            wrapper = document.createElement('div');
            wrapper.id = 'bm-gw';

            const grid = document.createElement('div');
            grid.id = 'bm-grid';

            wrapper.appendChild(grid);

            ul.parentNode.insertBefore(wrapper, ul.nextSibling);

            ensureToggle();
        }

        origUl = ul;

        // Hide original list ONCE
        if (isGrid) {
            ul.style.display = 'none';
            wrapper.style.display = '';
        } else {
            ul.style.display = '';
            wrapper.style.display = 'none';
        }

        const grid = wrapper.querySelector('#bm-grid');

        if (!grid) return;

        // Replace contents only
        grid.innerHTML = '';

        const cols = perfectCols(data.length);

        grid.style.setProperty(
            '--bm-cols',
            `repeat(${cols},1fr)`
        );

        data.forEach(d => {
            grid.appendChild(card(d));
        });

        // Intercept clicks → delegate to original SPA anchor
        grid.onclick = function (e) {

            const a = e.target.closest('.bc a[href]');

            if (!a) return;

            e.preventDefault();

            const cardEl = a.closest('.bc');

            if (cardEl?._origAnchor) {
                cardEl._origAnchor.click();
            }
        };
    }

    // ═══════════════════════════════════════════════════
    // DEBOUNCED REBUILD
    // ═══════════════════════════════════════════════════
    function queueRebuild() {

        clearTimeout(rebuildTimer);

        rebuildTimer = setTimeout(() => {

            const urlChanged = location.href !== lastUrl;

            if (urlChanged) {

                log('URL changed:', lastUrl, '→', location.href);

                lastUrl = location.href;

                // Only cleanup when LEAVING bookmarks
                if (!location.href.includes('/user/bookmarks')) {
                    cleanup();
                }
            }

            rebuild();

        }, 150);
    }

    // ═══════════════════════════════════════════════════
    // OBSERVER
    // ═══════════════════════════════════════════════════
    const observer = new MutationObserver((mutations) => {

        for (const m of mutations) {

            if (
                m.type === 'childList' &&
                (m.addedNodes.length || m.removedNodes.length)
            ) {
                queueRebuild();
                return;
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // ═══════════════════════════════════════════════════
    // HISTORY API
    // ═══════════════════════════════════════════════════
    const origPush = history.pushState;

    history.pushState = function () {

        const ret = origPush.apply(this, arguments);

        queueRebuild();

        return ret;
    };

    const origReplace = history.replaceState;

    history.replaceState = function () {

        const ret = origReplace.apply(this, arguments);

        queueRebuild();

        return ret;
    };

    window.addEventListener('popstate', queueRebuild);

    // ═══════════════════════════════════════════════════
    // RESIZE
    // ═══════════════════════════════════════════════════
    window.addEventListener('resize', queueRebuild);

    // ═══════════════════════════════════════════════════
    // INITIAL
    // ═══════════════════════════════════════════════════
    queueRebuild();

})();
