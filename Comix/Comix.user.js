// ==UserScript==
// @name         Comix.to Custom CSS ++
// @namespace    https://github.com/BlackSkuII
// @version      6.2
// @description  Override :root CSS variables and inject custom CSS rules
// @author       BlackSkuII + arena.ai
// @match        https://comix.to/*
// @grant        none
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix/Comix.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix/Comix.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==

// v6 changes vs v5.6 (aimed at the "third-party apps or extensions" block):
//  1. Removed the unused @grant GM_addStyle/GM_getValue/GM_setValue.
//     They were declared but never called. With grants, Tampermonkey runs
//     the script in its sandbox and exposes a GM_* bridge; with
//     `@grant none` this plain DOM script just runs as page JS.
//  2. ONE shared, throttled MutationObserver instead of FIVE observers
//     all watching documentElement+subtree and firing on every mutation
//     (including the script's own edits -> constant churn).
//  3. CSS is injected ONCE into <head> (v5 appended a <style> to <html>
//     on window `load`, i.e. a stray <style> child of <html> that sits
//     there permanently). Still a <style> element - see notes in chat.
//  4. History "button" is now a normal <a href="/user?tab=titles&page=1">
//     instead of a <button> + history.pushState() + a synthetic
//     PopStateEvent. Tampering with history/popstate is both fragile
//     (React Router may not pick it up) and a classic tamper signal.
//  5. No invented global-looking ids/classes where avoidable, no
//     inline `style.color` painting on every .card__ch scan unless the
//     value actually changed, and observers ignore our own nodes.
//  6. Fixed `event` (global) -> `e` bug in the chapter key handler.
//
// NOTE: nothing here spoofs fingerprints or hides from a detector on
// purpose. If the site checks computed styles / extra DOM at all, ANY
// version of these features can trip it. Test feature-by-feature
// with the FEATURES switches below.

(function () {
    'use strict';

    // ---- turn blocks off here first when bisecting the block message ----
    const FEATURES = {
        css: true,
        historyButton: true,
        cardReorder: true,
        chapterKeys: true,
        bookmarkNav: true,
        progressColors: true,
        contentPrefs: true, // CONTENT FILTER=Pornographic + block Boy Love & Tragedy
    };

    // =========================
    // CONTENT FILTER + BLOCKED GENRES
    // =========================
    // How the site stores this (from tn5h4x-ZPSxpfiy.js / tn5h4x-CjZgwTIL.js):
    //   A persisted Zustand store in localStorage["settings_v2"] (version: 2):
    //     { state: { contentFilter: "safe"|"suggestive"|"erotica"|"pornographic",
    //                blockedGenres: [<genreId>, ...], ... }, version: 2 }
    //   "Suggestive" is the default. "pornographic" shows ALL content:
    //     oj() expands it to ["safe","suggestive","erotica","pornographic"],
    //     which is exactly what shows up in the API URLs as
    //     content_rating[]=safe&content_rating[]=suggestive&
    //     content_rating[]=erotica&content_rating[]=pornographic
    //   Blocked genres are stored by numeric id only and are sent as
    //     genres_ex[]=<id>
    //   Confirmed from the site's own network traffic when clicking the
    //   chips in Settings > Content preferences > BLOCKED GENRES:
    //     Boy Love = 8   (genres_ex[]=8)
    //     Tragedy  = 29  (genres_ex[]=8&genres_ex[]=29)
    //
    // Strategy (no fake Settings-UI clicking, no extra API calls):
    //   At document-start, patch localStorage BEFORE the app hydrates its
    //   store from it, so the app simply loads our values as its own.
    //   After load, if the already-running app had old in-memory settings
    //   when we first patched, reload at most once per session so it
    //   picks the change up. Any genres you blocked yourself are kept.
    const DESIRED_CONTENT_FILTER = 'pornographic';
    const DESIRED_BLOCKED_GENRES = [
        { label: 'Boy Love', id: 8 },
        { label: 'Tragedy', id: 29 },
    ];
    const SETTINGS_KEY = 'settings_v2';
    const RELOAD_GUARD_KEY = 'comixpp_settings_reloaded_v2';

    function readSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !parsed.state) return null;
            return parsed;
        } catch { return null; }
    }

    function writeSettings(parsed) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed)); } catch {}
    }

    // Apply contentFilter + blocked genre ids. Returns true if changed.
    function applyContentPrefsToStorage() {
        const parsed = readSettings() || { state: {}, version: 2 };
        const state = parsed.state;
        let changed = false;

        if (state.contentFilter !== DESIRED_CONTENT_FILTER) {
            state.contentFilter = DESIRED_CONTENT_FILTER;
            changed = true;
        }

        const current = Array.isArray(state.blockedGenres) ? state.blockedGenres : [];
        const merged = [...current];
        for (const { id } of DESIRED_BLOCKED_GENRES) {
            // Store holds numbers; compare loosely in case of strings.
            if (!merged.some(x => String(x) === String(id))) merged.push(id);
        }
        if (merged.length !== current.length || !Array.isArray(state.blockedGenres)) {
            state.blockedGenres = merged;
            changed = true;
        }

        if (changed) writeSettings(parsed);
        return changed;
    }

    function settingsAlreadySatisfied() {
        const parsed = readSettings();
        if (!parsed || parsed.state.contentFilter !== DESIRED_CONTENT_FILTER) return false;
        const current = Array.isArray(parsed.state.blockedGenres) ? parsed.state.blockedGenres : [];
        return DESIRED_BLOCKED_GENRES.every(({ id }) => current.some(x => String(x) === String(id)));
    }

    let contentPrefsStarted = false;
    function resolveAndApplyContentPrefs() {
        if (!FEATURES.contentPrefs || contentPrefsStarted) return;
        contentPrefsStarted = true;
        // Storage was already patched at document-start, so normally this
        // is a no-op check. Only if the live app overwrote/re-hydrated old
        // values do we patch again - and reload once so it re-hydrates.
        const changed = applyContentPrefsToStorage();
        if (changed && settingsAlreadySatisfied()) {
            const signature = DESIRED_BLOCKED_GENRES.map(g => g.id).join(',');
            if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== signature) {
                sessionStorage.setItem(RELOAD_GUARD_KEY, signature);
                location.reload();
            }
        }
    }

    // Run at document-start: the app hasn't hydrated settings_v2 yet.
    if (FEATURES.contentPrefs) applyContentPrefsToStorage();

    // =========================
    // CUSTOM PAGE CSS
    // =========================
    const customCSS = `
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
        .rpage-zoom__btn{
            border-radius: 45px;
            background: rgb(var(--accent-rgb) / .12);
        }
        .rpage-zoom__btn:hover{
            border-radius: 45px;
            background: var(--accent-2) !important;
        }
        @media (hover: hover) and (pointer: fine) {
            .ugrid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
            .rpage-header__title{
                font-size: 1.25rem !important;
                max-width: clamp(140px,40vw,620px) !important;
            }
        }
        @media (max-width: 768px), (hover: none) and (pointer: coarse) {
            .settings, .browse, .notifbell, .announce.announce--accent {
                display: none !important;
            }
        }
    `;

    let cssDone = false;
    function injectCSS() {
        if (!FEATURES.css || cssDone) return;
        const parent = document.head || document.documentElement;
        if (!parent) return; // observer will retry once <head> exists
        const style = document.createElement('style');
        style.textContent = customCSS;
        parent.appendChild(style);
        cssDone = true;
    }

    // =========================
    // HISTORY LINK (was: button + pushState)
    // =========================
    function injectHistoryButton() {
        if (!FEATURES.historyButton) return;
        if (document.querySelector('a[href="/user?tab=titles&page=1"][data-cx]')) return;
        const userMenu = document.querySelector('.usermenu');
        if (!userMenu || !userMenu.parentNode) return;
        const a = document.createElement('a');
        a.href = '/user?tab=titles&page=1';
        a.className = 'icon-btn';
        a.title = 'History';
        a.textContent = '𖤘';
        a.setAttribute('data-cx', '');
        a.style.fontSize = '1.2rem';
        a.style.lineHeight = '1';
        userMenu.parentNode.insertBefore(a, userMenu);
    }

    // =========================
    // CARD LAYOUT
    // =========================
    function reorderCardMeta() {
        if (!FEATURES.cardReorder) return;
        document.querySelectorAll('.card__title').forEach(titleEl => {
            const parent = titleEl.parentNode;
            if (!parent) return;
            const metaEl = parent.querySelector('.card__meta');
            if (metaEl && titleEl.nextElementSibling !== metaEl) titleEl.after(metaEl);
        });
    }

    // =========================
    // CHAPTER PROGRESS COLORS (only write when changed)
    // =========================
    function colorChapterProgress() {
        if (!FEATURES.progressColors) return;
        document.querySelectorAll('.card__ch').forEach(span => {
            const parts = span.textContent.trim().split('/');
            if (parts.length !== 2) return;
            const viewedStr = parts[0].trim(), totalStr = parts[1].trim();
            let color = '';
            if (viewedStr === '—') color = 'purple';
            else {
                const viewed = parseInt(viewedStr, 10), total = parseInt(totalStr, 10);
                if (isNaN(viewed) || isNaN(total)) return;
                color = viewed < total ? 'red' : viewed === total ? 'green' : 'gold';
            }
            if (span.style.color !== color) span.style.color = color;
        });
    }

    // =========================
    // BOOKMARK (titles) TOP PAGINATION
    // =========================
    let currentPage = 1, totalPages = 1, lastUrl = location.href;

    function isValidPage() {
        const url = new URL(window.location.href);
        return url.pathname === '/user'
            && url.searchParams.get('tab') === 'titles'
            && !url.searchParams.get('q');
    }

    function createPageLink(page) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page);
        const a = document.createElement('a');
        a.href = url.toString();
        a.textContent = page;
        a.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;'
            + 'min-width:32px;height:32px;margin:0 2px;border-radius:6px;'
            + 'text-decoration:none;font-size:14px;transition:0.2s;color:var(--text-2)';
        if (page === currentPage) { a.style.color = 'var(--text)'; a.style.fontWeight = 'bold'; }
        return a;
    }

    function buildPagination() {
        if (!FEATURES.bookmarkNav) return;
        const topNavExisting = document.querySelector('[data-cx-topnav]');
        if (!isValidPage()) { topNavExisting?.remove(); return; }

        const originalPager = document.querySelector('.gpage__pager');
        if (!originalPager) return;
        const activeBtn = originalPager.querySelector('.npager__num.is-active');
        const numBtns = [...originalPager.querySelectorAll('.npager__num')];
        if (!activeBtn || !numBtns.length) return;
        const nums = numBtns.map(b => parseInt(b.textContent.trim(), 10)).filter(n => !isNaN(n));
        if (!nums.length) return;

        const newCurrentPage = parseInt(activeBtn.textContent.trim(), 10);
        const newTotalPages = Math.max(...nums);
        if (isNaN(newCurrentPage) || isNaN(newTotalPages)) return;
        if (topNavExisting && newCurrentPage === currentPage && newTotalPages === totalPages) return;
        currentPage = newCurrentPage; totalPages = newTotalPages;

        const nav = document.createElement('div');
        nav.style.cssText = 'display:flex;justify-content:center;align-items:center;flex-wrap:wrap;width:100%;margin-bottom:10px';

        const url = new URL(window.location.href);
        const arrow = (page, label, navName) => {
            const u = new URL(window.location.href); u.searchParams.set('page', page);
            const a = document.createElement('a');
            a.href = u.toString(); a.textContent = label;
            a.style.cssText = 'padding:4px 8px;border-radius:6px;color:var(--text-2);text-decoration:none';
            a.setAttribute('data-nav', navName);
            return a;
        };
        if (currentPage > 1) nav.appendChild(arrow(currentPage - 1, '<', 'prev'));

        const visible = new Set([1, totalPages]);
        for (let i = currentPage - 4; i <= currentPage + 4; i++) {
            if (i > 1 && i < totalPages) visible.add(i);
        }
        let last = 0;
        [...visible].sort((a, b) => a - b).forEach(page => {
            if (page - last > 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.cssText = 'margin:0 6px;color:#aaa';
                nav.appendChild(dots);
            }
            nav.appendChild(createPageLink(page));
            last = page;
        });
        if (currentPage < totalPages) nav.appendChild(arrow(currentPage + 1, '>', 'next'));

        const sortTabs = document.querySelector('.uview__sort-tabs');
        if (!sortTabs || !sortTabs.parentNode) return;
        let topNav = topNavExisting;
        if (!topNav) {
            topNav = document.createElement('div');
            topNav.setAttribute('data-cx-topnav', '');
            sortTabs.parentNode.insertBefore(topNav, sortTabs);
        }
        topNav.replaceChildren(nav);
    }

    // =========================
    // ONE shared observer, rAF-throttled, ignoring our own subtrees
    // =========================
    let scheduled = false;
    function runAll() {
        scheduled = false;
        injectCSS();
        injectHistoryButton();
        reorderCardMeta();
        colorChapterProgress();
        buildPagination();
    }
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(runAll);
    }
    const observer = new MutationObserver(mutations => {
        if (location.href !== lastUrl) { lastUrl = location.href; currentPage = -1; totalPages = -1; }
        // Ignore mutation batches that only touch nodes we injected.
        const ours = n => n.nodeType === 1 && (n.hasAttribute?.('data-cx') || n.hasAttribute?.('data-cx-topnav'));
        if (mutations.every(m => ours(m.target) || [...m.addedNodes].every(ours))) return;
        schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    runAll();

    // Content prefs: resolve genre labels -> ids once the app/API is up.
    // (The document-start pass above already handled contentFilter and
    //  any genre ids cached from a previous visit.)
    if (FEATURES.contentPrefs) {
        if (document.readyState === 'complete') setTimeout(resolveAndApplyContentPrefs, 500);
        else window.addEventListener('load', () => setTimeout(resolveAndApplyContentPrefs, 500), { once: true });
    }

    // =========================
    // KEYBOARD (single listener)
    // =========================
    const readerUrlRegex = /^https?:\/\/comix\.to\/title\/.+\/.+-chapter-.+/;
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) return;

        if (FEATURES.chapterKeys && readerUrlRegex.test(location.href)) {
            if (e.key === 'ArrowRight' || e.code === 'Space') {
                e.preventDefault();
                document.querySelector('button[aria-label="Next chapter"], button[title="Next chapter"]')?.click();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                document.querySelector('button[aria-label="previous chapter"], button[title="Previous chapter"]')?.click();
            } else if (e.key === '-') {
                e.preventDefault();
                document.querySelector('.rpage-zoom__btn[aria-label="Shrink image"]')?.click();
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                document.querySelector('.rpage-zoom__btn[aria-label="Enlarge image"]')?.click();
            }
            return;
        }

        if (FEATURES.bookmarkNav && isValidPage()) {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                const next = document.querySelector('[data-cx-topnav] [data-nav="next"]');
                if (next) { e.preventDefault(); next.click(); }
            } else if (e.key === 'ArrowLeft') {
                const prev = document.querySelector('[data-cx-topnav] [data-nav="prev"]');
                if (prev) { e.preventDefault(); prev.click(); }
            }
        }
    });
})();
