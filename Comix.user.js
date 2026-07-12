// ==UserScript==
// @name         Comix.to Custom CSS ++
// @namespace    http://tampermonkey.net/
// @version      5.5
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
            --bs-primary: #8765eb;
            --bs-primary-rgb: 135, 101, 235;

        }

        .rpage-page{
            /* aspect-ratio: 1920 / 1080; */
            /* --rpage-page-w: 940px; */
        }
        .rpage-zoom__btn{
            border-radius: 45px;
            background: rgb(var(--accent-rgb) / .12); /*accent=#8765eb, accent-rgb= 135 101 235*/
        }
        .rpage-zoom__btn:hover{
            border-radius: 45px;
            background: var(--accent-2) !important;
        }


        /* ===== Desktop / Computer only ===== */
        @media (hover: hover) and (pointer: fine) {
            .ugrid {
                grid-template-columns: repeat(auto-fill,minmax(213px,1fr));
            }
            .rpage-header__title{
                font-size: 1.25rem !important;
                max-width: clamp(140px,40vw,620px) !important;
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


    // =========================
    // CUSTOM HISTORY BUTTON - Main/Menu Page
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
    // CUSTOM CARD LAYOUT - BookMark Page
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
    // CUSTOM CHAPTER NAV - Chapter Page
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
            const nextBtn = document.querySelector(
                'button[aria-label="Next chapter"], button[title="Next chapter"]'
            );  
            //const nextBtn = document.querySelector('.rpage-chapnav__btn.rpage-chapnav__btn--next');
            if (nextBtn) nextBtn.click();
        }

        if (e.key === 'ArrowLeft') {
            event.preventDefault();
            event.stopImmediatePropagation();
            e.preventDefault();
            const prevBtn = document.querySelector(
                'button[aria-label="previous chapter"], button[title="Previous chapter"]'
            );
            //const prevBtn = document.querySelector('.rpage-chapnav__btn:not(.rpage-chapnav__btn--next)');
            if (prevBtn) prevBtn.click();
        }
        
        // Shrink image (-)
        if (e.key === '-') {
            e.preventDefault();
            const shrinkBtn = document.querySelector('.rpage-zoom__btn[aria-label="Shrink image"]');
            if (shrinkBtn) shrinkBtn.click();
        }

         // Enlarge image (+ or =)
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            const enlargeBtn = document.querySelector('.rpage-zoom__btn[aria-label="Enlarge image"]');
            if (enlargeBtn) enlargeBtn.click();
        }
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
        a.style.color = 'var(--text-2)';

        if (page === currentPage) {
            a.style.color = 'var(--text)';
            a.style.fontWeight = 'bold';
        }

        return a;
    }

    function buildPagination() {
        if (!isValidPage()) {
            // If we navigated AWAY from the valid page, clean up our injected elements
            const existingTopNav = document.getElementById('custom-top-nav');
            if (existingTopNav) existingTopNav.remove();
            return;
        }

        const originalPager = document.querySelector('.gpage__pager');
        if (!originalPager) return;

        const activeBtn = originalPager.querySelector('.npager__num.is-active');
        const numBtns = Array.from(originalPager.querySelectorAll('.npager__num'));

        if (!activeBtn || numBtns.length === 0) return;

        const nums = numBtns.map(b => parseInt(b.textContent.trim(), 10)).filter(n => !isNaN(n));
        if (nums.length === 0) return;

        const newCurrentPage = parseInt(activeBtn.textContent.trim(), 10);
        const newTotalPages = Math.max(...nums);

        if (isNaN(newCurrentPage) || isNaN(newTotalPages)) return;

        const existingTopNav = document.getElementById('custom-top-nav');

        // If page didn't change and we already built it, do nothing to prevent infinite loops
        if (existingTopNav && newCurrentPage === currentPage && newTotalPages === totalPages) {
            return;
        }

        currentPage = newCurrentPage;
        totalPages = newTotalPages;

        const nav = document.createElement('div');
        nav.className = 'custom-nav'; // Add class for easy querying
        nav.style.display = 'flex';
        nav.style.justifyContent = 'center';
        nav.style.alignItems = 'center';
        nav.style.flexWrap = 'wrap';
        nav.style.width = '100%';
        nav.style.marginBottom = '10px';

        const url = new URL(window.location.href);

        // Prev
        if (currentPage > 1) {
            const prev = document.createElement('a');

            url.searchParams.set('page', currentPage - 1);

            prev.href = url.toString();
            prev.textContent = '<';

            prev.style.padding = '4px 8px';
            prev.style.borderRadius = '6px';
            prev.style.color = 'var(--text-2)';
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
            next.style.color = 'var(--text-2)';
            next.style.textDecoration = 'none';

            next.setAttribute('data-nav', 'next');

            nav.appendChild(next);
        }

        // TOP NAV ABOVE SORT TABS
        const sortTabs = document.querySelector('.uview__sort-tabs');

        if (sortTabs) {
            let topNav = document.getElementById('custom-top-nav');
            if (!topNav) {
                topNav = document.createElement('div');
                topNav.id = 'custom-top-nav';
                sortTabs.parentNode.insertBefore(topNav, sortTabs);
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
                const next = document.querySelector('#custom-top-nav [data-nav="next"]');
                if (next) next.click();
            }
        }

        if (e.key === 'ArrowLeft') {
            if (isValidPage()) {
                e.preventDefault();
                const prev = document.querySelector('#custom-top-nav [data-nav="prev"]');
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
