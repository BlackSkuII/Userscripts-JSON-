// ==UserScript==
// @name         Comix.to Custom CSS ++
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Override :root CSS variables and inject custom CSS rules
// @author       You
// @match        https://comix.to/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
// @run-at       document-start
// ==/UserScript==



    // =========================
    // CUSTOM PAGE CSS
    // =========================

(function () {
    'use strict';

    const customCSS = `
        /* Override CSS variables */
        :root {
            --bg: #000 !important;
            --bg-rgb: 0 0 0 !important;
            --surface: #000 !important;
            --surface-rgb: 0 0 0 !important;
            --bg-2: #000 !important;
            --bg-2-rgb: 0 0 0 !important;
            --surface-2: #000 !important;
            --surface-2-rgb: 0 0 0 !important;
        }

        .rpage-page{
            /* aspect-ratio: 1920 / 1080; */
            /* --rpage-page-w: 940px; */
        }

        /* ===== Desktop / Computer only ===== */
        @media (hover: hover) and (pointer: fine) {
            .ugrid {
                grid-template-columns: repeat(auto-fill,minmax(213px,1fr));
            }
        }

        /* ===== Mobile / Phone only ===== */
        @media (max-width: 768px),
       (hover: none) and (pointer: coarse) {
            .settings,
            .browse,
            .notifbell,
            .announce.announce--accent {
                display: none !important;
            }
        }
    
    `;

    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = customCSS;
        document.documentElement.appendChild(style);
    }

    // Wait until the entire page is fully loaded
    window.addEventListener('load', injectCSS);

})();

/*
    // =========================
    // CUSTOM PAGE ZOOM
    // =========================

(function () {
    'use strict';

    // --- CONFIG ---
    const urlRegex = /https?:\/\/comix\.to\/(title|comic)\/.+\/.+/;
    const step = 5;
    const min = 25;
    const max = 100;

    let currentWidth = GM_getValue("comix-zoom-level", 100);

    // --- CSS ---
    const style = document.createElement("style");
    style.textContent = `
        :root {
            --comix-zoom-width: 100%;
        }

        .read-viewer .page {
            max-width: var(--comix-zoom-width) !important;
        }

        #custom-zoom-panel {
            letter-spacing: -.02rem;
            background-color: rgba(var(--bs-body-bg-r-rgb), .3);
            user-select: none;
            border-radius: 2rem;
            align-items: center;
            font-family: JetBrains Mono;
            transition: all .15s ease-in-out;
            display: none;
            position: fixed;
            bottom: 1rem;
            left: 1rem;
            z-index: 999999;
        }

        #custom-zoom-panel.visible {
            display: flex !important;
        }

        .cz-btn {
            width: 2.5rem;
            height: 2.5rem;
            color: var(--bs-primary);
            background-color: var(--bs-body-bg);
            opacity: .6;
            border: 0;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.4rem;
            transition: all .15s ease-in-out;
        }

        .cz-btn:hover {
            background-color: var(--bs-primary);
            color: var(--bs-body-bg);
            opacity: 1;
            font-size: 2rem;
        }

        #cz-percent {
            opacity: .6;
            padding: 0 .5rem;
            font-size: .8rem;
        }
    `;
    document.head.appendChild(style);

    // --- UI ---
    const panel = document.createElement('div');
    panel.id = 'custom-zoom-panel';
    panel.innerHTML = `
        <button id="cz-minus" class="cz-btn">−</button>
        <div id="cz-percent">100%</div>
        <button id="cz-plus" class="cz-btn">+</button>
    `;
    document.body.appendChild(panel);

    const percentDisplay = document.getElementById('cz-percent');
    const btnMinus = document.getElementById('cz-minus');
    const btnPlus = document.getElementById('cz-plus');

    // --- CORE ---
    function applyZoom() {
        percentDisplay.innerText = currentWidth + '%';

        GM_setValue("comix-zoom-level", currentWidth);

        const screenWidth = window.innerWidth;
        const px = Math.floor(screenWidth * (currentWidth / 100));

        document.documentElement.style.setProperty(
            '--rpage-max-w',
            px + 'px'
        );
    }

    function showIfReader() {
        if (urlRegex.test(location.href)) {
            panel.classList.add('visible');
            applyZoom();
        } else {
            panel.classList.remove('visible');
        }
    }

    // --- EVENTS ---
    btnPlus.addEventListener('click', () => {
        if (currentWidth < max) {
            currentWidth += step;
            applyZoom();
        }
    });

    btnMinus.addEventListener('click', () => {
        if (currentWidth > min) {
            currentWidth -= step;
            applyZoom();
        }
    });

    window.addEventListener('resize', applyZoom);

    // SPA support
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            showIfReader();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Keyboard shortcuts (only zoom-related ones)
    document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

        if (e.key === '-' || e.code === 'Minus') {
            btnMinus.click();
        }

        if (e.key === '+' || e.code === 'Equal') {
            btnPlus.click();
        }

        if (e.key === '0') {
            currentWidth = 80;
            applyZoom();
        }

        if (e.key === '.') {
            currentWidth = 35;
            applyZoom();
        }
    });

    // init
    showIfReader();

    // optional global API
    window.setComixZoomLevel = function (val) {
        currentWidth = val;
        applyZoom();
    };
})();
*/

    // =========================
    // CUSTOM HISTORY BUTTON
    // =========================

(function () {
    'use strict';

    function navigateToHistory() {
        const url = '/user?tab=titles&page=1';
        if (window.location.pathname + window.location.search === url) return;
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }

    function injectHistoryButton() {
        if (document.getElementById('custom-history-btn')) return;

        const userMenu = document.querySelector('.usermenu');
        if (!userMenu) return;

        const btn = document.createElement('button');
        btn.id = 'custom-history-btn';
        btn.className = 'icon-btn';
        btn.title = 'History';
        btn.textContent = '𖤘';
        btn.style.cssText = `
            font-size: 1.2rem;
            line-height: 1;
        `;

        btn.addEventListener('click', navigateToHistory);

        userMenu.parentNode.insertBefore(btn, userMenu);
    }

    const observer = new MutationObserver(() => {
        injectHistoryButton();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();

     // =========================
    // CUSTOM BOOKMARK NAV
    // =========================

    (function () {
        'use strict';

        let currentPage = 1;
        let totalPages = 1;
        let lastUrl = location.href;

        function isValidPage() {
            const url = new URL(window.location.href);

            const isTitlesPage =
                url.pathname === '/user' &&
                url.searchParams.get('tab') === 'titles';

            const hasQuery = url.searchParams.get('q');

            return isTitlesPage && !hasQuery;
        }

        function createPageLink(page, label = page) {
            const a = document.createElement('a');

            const url = new URL(window.location.href);
            url.searchParams.set('page', page);

            a.href = url.toString();
            a.textContent = label;

            a.style.display = 'inline-flex';
            a.style.alignItems = 'center';
            a.style.justifyContent = 'center';

            a.style.minWidth = '32px';
            a.style.height = '32px';
            a.style.margin = '0 2px';

            a.style.borderRadius = '6px';
            a.style.textDecoration = 'none';
            a.style.fontSize = '14px';
            a.style.transition = '0.2s';

            if (page === currentPage) {
                a.style.color = '#fff';
                a.style.fontWeight = 'bold';
            }

            return a;
        }

        function buildPagination() {
            if (!isValidPage()) {
                // If we navigated AWAY from the valid page, clean up our injected elements
                const existingTopNav = document.getElementById('custom-top-nav');
                if (existingTopNav) existingTopNav.remove();
                
                const footer = document.querySelector('.ulist-foot');
                if (footer) {
                    const existingFooterNav = footer.querySelector('.custom-nav');
                    if (existingFooterNav) existingFooterNav.remove();
                    // Restore original footer elements
                    Array.from(footer.children).forEach(c => c.style.display = '');
                }
                return;
            }

            const footer = document.querySelector('.ulist-foot');
            if (!footer) return;

            const match = footer.textContent.match(/(\d+)\s*\/\s*(\d+)/);
            if (!match) return;

            const newCurrentPage = parseInt(match[1], 10);
            const newTotalPages = parseInt(match[2], 10);
            
            if (isNaN(newCurrentPage) || isNaN(newTotalPages)) return;

            const existingFooterNav = footer.querySelector('.custom-nav');
            
            // If page didn't change and we already built it, do nothing to prevent infinite loops
            if (existingFooterNav && newCurrentPage === currentPage && newTotalPages === totalPages) {
                return;
            }
            
            currentPage = newCurrentPage;
            totalPages = newTotalPages;

            // Hide original footer content instead of destroying it (prevents breaking React's virtual DOM)
            Array.from(footer.children).forEach(child => {
                if (!child.classList.contains('custom-nav')) {
                    child.style.display = 'none';
                }
            });

            const nav = document.createElement('div');
            nav.className = 'custom-nav'; // Add class for easy querying
            nav.style.display = 'flex';
            nav.style.justifyContent = 'center';
            nav.style.alignItems = 'center';
            nav.style.flexWrap = 'wrap';
            nav.style.width = '100%';

            const url = new URL(window.location.href);

            // Prev
            if (currentPage > 1) {
                const prev = document.createElement('a');

                url.searchParams.set('page', currentPage - 1);

                prev.href = url.toString();
                prev.textContent = '<';

                prev.style.padding = '4px 8px';
                prev.style.borderRadius = '6px';
                prev.style.color = '#fff';
                prev.style.textDecoration = 'none';

                prev.setAttribute('data-nav', 'prev');

                nav.appendChild(prev);
            }

            // Smart pagination
            const visible = new Set();

            visible.add(1);

            for (let i = currentPage - 4; i <= currentPage + 4; i++) {
                if (i > 1 && i < totalPages) {
                    visible.add(i);
                }
            }

            visible.add(totalPages);

            const sorted = [...visible].sort((a, b) => a - b);

            let last = 0;

            sorted.forEach(page => {
                if (page - last > 1) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.style.margin = '0 6px';
                    dots.style.color = '#aaa';
                    nav.appendChild(dots);
                }

                nav.appendChild(createPageLink(page));
                last = page;
            });

            // Next
            if (currentPage < totalPages) {
                const next = document.createElement('a');

                url.searchParams.set('page', currentPage + 1);

                next.href = url.toString();
                next.textContent = '>';

                next.style.padding = '4px 8px';
                next.style.borderRadius = '6px';
                next.style.color = '#fff';
                next.style.textDecoration = 'none';

                next.setAttribute('data-nav', 'next');

                nav.appendChild(next);
            }

            // Replace old footer nav if it exists
            if (existingFooterNav) existingFooterNav.remove();
            footer.appendChild(nav);

            // TOP NAV ABOVE GRID
            const grid = document.querySelector('.ugrid');

            if (grid) {
                // Check if top nav already exists to prevent duplication
                let topNav = document.getElementById('custom-top-nav');
                if (!topNav) {
                    topNav = document.createElement('div');
                    topNav.id = 'custom-top-nav';
                    grid.parentNode.insertBefore(topNav, grid);
                }
                // Always replace contents to ensure links match current page
                topNav.innerHTML = '';
                topNav.appendChild(nav.cloneNode(true));
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {

            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) {
                return;
            }

            if (e.key === 'ArrowRight' || e.key === ' ') {
                if (isValidPage()) {
                    e.preventDefault();
                    const next = document.querySelector('[data-nav="next"]');
                    if (next) next.click();
                }
            }

            if (e.key === 'ArrowLeft') {
                if (isValidPage()) {
                    e.preventDefault();
                    const prev = document.querySelector('[data-nav="prev"]');
                    if (prev) prev.click();
                }
            }
        });

        // SPA support: reset state when URL changes
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                // Force currentPage/totalPages to reset so buildPagination fully recalculates on new page
                currentPage = -1; 
                totalPages = -1;
            }
            buildPagination();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Initial build
        buildPagination();

    })();

    // =========================
    // CUSTOM CARD TIME UPDATE
    // =========================

(function () {
    'use strict';

    let isUpdating = false;
    let currentUrl = location.href;

    function isTitlesPage() {
        const params = new URLSearchParams(window.location.search);
        return window.location.pathname === '/user' && params.get('tab') === 'titles';
    }

    function getPage() {
        const params = new URLSearchParams(window.location.search);
        return params.get('page') || '1';
    }

    async function fetchTitleUpdates(page) {
        try {
            const res = await fetch(`/api/v1/user/following-titles?sort=chapter_updated_desc&page=${page}&limit=28`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (data.status === 'ok' && data.result && data.result.items) {
                return data.result.items;
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    function applyUpdates(items) {
        if (!items || items.length === 0) return;

        const urlMap = new Map();
        items.forEach(item => {
            try {
                const url = new URL(item.url);
                urlMap.set(url.pathname, item);
            } catch (e) {
                urlMap.set(item.url, item);
            }
        });

        const cards = document.querySelectorAll('.card__title');
        cards.forEach(titleEl => {
            const cardEl = titleEl.closest('.card');
            if (!cardEl) return;

            const linkEl = cardEl.closest('a[href*="/title/"]') || cardEl.querySelector('a[href*="/title/"]');
            if (!linkEl) return;

            const linkPath = new URL(linkEl.href, window.location.origin).pathname;
            const item = urlMap.get(linkPath);

            if (item) {
                const timeEl = cardEl.querySelector('.card__time');
                if (timeEl && item.chapterUpdatedAtFormatted) {
                    if (timeEl.textContent !== item.chapterUpdatedAtFormatted) {
                        timeEl.textContent = item.chapterUpdatedAtFormatted;
                    }
                }
            }
        });
    }

    async function updateCards() {
        if (isUpdating || !isTitlesPage()) return;
        
        const cards = document.querySelectorAll('.card__time');
        if (cards.length === 0) return;

        isUpdating = true;
        const page = getPage();
        const items = await fetchTitleUpdates(page);
        applyUpdates(items);
        isUpdating = false;
    }

    const observer = new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            isUpdating = false;
        }
        updateCards();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    updateCards();
})();

    // =========================
    // CUSTOM CARD LAYOUT
    // =========================

(function () {
    'use strict';

    function reorderCardMeta() {
        document.querySelectorAll('.card__title').forEach(titleEl => {
            const parent = titleEl.parentNode;
            if (!parent) return;

            const metaEl = parent.querySelector('.card__meta');
            if (metaEl && titleEl.nextElementSibling !== metaEl) {
                titleEl.after(metaEl);
            }
        });
    }

    const observer = new MutationObserver(() => {
        reorderCardMeta();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    reorderCardMeta();
})();

    // =========================
    // CUSTOM CHAPTER NAV
    // =========================

(function () {
    'use strict';

    const readerUrlRegex = /https?:\/\/comix\.to\/title\/.+\/.+-chapter-.+/;

    document.addEventListener('keydown', (e) => {
        if (!readerUrlRegex.test(location.href)) return;

        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) return;

        if (e.key === 'ArrowRight' || e.code === 'Space') {
            event.preventDefault();
            event.stopImmediatePropagation();
            e.preventDefault();
            const nextBtn = document.querySelector('.rpage-chapnav__btn.rpage-chapnav__btn--next');
            if (nextBtn) nextBtn.click();
        }

        if (e.key === 'ArrowLeft') {
            event.preventDefault();
            event.stopImmediatePropagation();
            e.preventDefault();
            const prevBtn = document.querySelector('.rpage-chapnav__btn:not(.rpage-chapnav__btn--next)');
            if (prevBtn) prevBtn.click();
        }
    });
})();

