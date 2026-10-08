// ==UserScript==
// @name         iOSGods App – Grid View + VIP Toggle
// @namespace    https://app.iosgods.com/
// @version      1.4.0
// @author       BlackSkuII + Arena.ai
// @description  Shows app lists as a grid (4 columns on laptops, 2 on phones) and hides/shows VIP apps with the "T" key (hidden by default). Works with the SPA navigation and infinite scrolling.
// @match        *://app.iosgods.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     *  Settings
     * ------------------------------------------------------------------ */
    const TOGGLE_KEY            = 't';     // keyboard shortcut
    const SHOW_FLOATING_BUTTON  = true;    // on-screen toggle for phones (no keyboard)
    // Button position (top-right). 'below-navbar' sits just under the site's top bar so it never
    // covers the site's own top-right icons; 'corner' puts it in the very top-right corner.
    const BUTTON_POSITION       = 'below-navbar'; // 'below-navbar' | 'corner'
    const ICON_SIZE_LAPTOP      = 140;     // app icon size in px on laptops/desktops (was 72)(104)
    const ICON_SIZE_PHONE       = 140;      // app icon size in px on phones (was 72)(84)
    const PHONE_MAX_WIDTH       = 767;     // <= this width -> 2 columns, otherwise 4 (site uses 768px too)
    const MAX_EMPTY_AUTOLOADS   = 4;       // stop auto-loading after N loads in a row that added no visible app
    const STORAGE_KEY           = 'igx-hide-vip';

    /* ------------------------------------------------------------------ *
     *  State (default = VIP hidden)
     * ------------------------------------------------------------------ */
    function readState() {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            return v === null ? true : v === '1';
        } catch (e) { return true; }
    }
    function saveState(v) {
        try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ }
    }

    let hideVip = readState();
    const root = document.documentElement;
    root.classList.add('igx-grid');
    root.classList.toggle('igx-hide-vip', hideVip);

    /* ------------------------------------------------------------------ *
     *  CSS
     *  - Grid only applies to app lists that are NOT inside a swiper
     *    (the home-page carousels are built by the site's own JS).
     *  - VIP hiding uses :has() (no flash, works on cloned cards) plus a
     *    JS-assigned .igx-vip class as a fallback for older browsers.
     * ------------------------------------------------------------------ */
    const supportsHas = (function () {
        try { return CSS.supports('selector(li:has(a))'); } catch (e) { return false; }
    })();

    const VIP_MARK = '.vip-download-btn, .app-badge-vip';
    const LIST = 'html.igx-grid .content ul.app-list:not(.swiper ul)';

    const css = `
/* ---------- Grid layout ---------- */
${LIST} {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    padding: 6px 20px 14px !important;
    box-sizing: border-box;
}
@media (max-width: ${PHONE_MAX_WIDTH}px) {
    ${LIST} {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 6px 12px 12px !important;
    }
}
${LIST} > li {
    display: flex;   /* no !important: lets the site's skeleton rules and VIP hiding win */
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: auto !important;
    min-width: 0;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 14px 10px 12px !important;
    box-sizing: border-box;
    text-align: center;
    border-radius: 16px;
    border: 1px solid rgba(127,127,127,.18) !important;
    background: rgba(127,127,127,.06);
}
${LIST} > li .app-icon {
    width: ${ICON_SIZE_LAPTOP}px !important;
    max-width: 100% !important;          /* never wider than the card */
    min-width: 0 !important;
    height: auto !important;
    margin: 2px 0 10px 0 !important;
    padding: 0 !important;
    flex: none;
    border-radius: 22.5% !important;     /* iOS-style rounded square at any size */
}
${LIST} > li .app-icon img {
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    aspect-ratio: 1 / 1;
    border-radius: 22.5% !important;
    box-shadow: 0 4px 14px rgba(0,0,0,.18);
}
@media (max-width: ${PHONE_MAX_WIDTH}px) {
    ${LIST} > li .app-icon { width: ${ICON_SIZE_PHONE}px !important; margin-bottom: 8px !important; }
}
${LIST} > li .app-meta {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    gap: 10px;
    padding: 0 !important;
    border-bottom: 0 !important;
}
${LIST} > li .app-meta .app-title {
    width: 100%;
    min-width: 0;
    flex: none;
    padding: 0 !important;
}
${LIST} > li .app-meta .app-title strong {
    font-size: 15px !important;
    white-space: normal !important;
    display: -webkit-box !important;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
}
${LIST} > li .app-meta .app-title:hover strong,
${LIST} > li .app-meta .app-title:hover span { transform: none !important; }
${LIST} > li .app-meta > .download-btn { margin-top: auto; flex: none; }
/* Message when every app in a list is VIP and VIPs are hidden */
html.igx-hide-vip ${LIST}.igx-all-vip::before {
    content: "All apps here are VIP \u2014 press T (or the VIP button) to show them";
    grid-column: 1 / -1;
    padding: 24px 8px;
    text-align: center;
    opacity: .6;
    font-size: 14px;
}

/* ---------- VIP hiding (all app lists, incl. carousels) ---------- */
html.igx-hide-vip ul.app-list > li.igx-vip${supportsHas ? `,
html.igx-hide-vip ul.app-list > li:has(${VIP_MARK})` : ''} {
    display: none !important;
}

/* ---------- Toast + floating button ---------- */
#igx-toast {
    position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%) translateY(10px);
    background: rgba(20,20,20,.88); color: #fff;
    padding: 9px 16px; border-radius: 20px; font: 600 14px/1.2 -apple-system, system-ui, sans-serif;
    z-index: 2147483646; opacity: 0; pointer-events: none;
    transition: opacity .2s ease, transform .2s ease;
}
#igx-toast.igx-show { opacity: 1; transform: translateX(-50%) translateY(0); }
/* Modern glass pill, fixed top-right: animated gradient ring when VIP apps are shown,
   bolt icon gets a slash when they are hidden, plus an iOS-style switch. */
@property --igx-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes igx-spin { to { --igx-angle: 360deg; } }
@keyframes igx-pop  { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
#igx-vip-btn {
    --igx-accent: #ff8a00;
    position: fixed !important;
    right: calc(12px + env(safe-area-inset-right, 0px)) !important;
    left: auto !important;
    bottom: auto !important;
    /* Size to content only - never stretch (Framework7 has a global button{width:100%}) */
    width: auto !important;
    min-width: 0 !important;
    max-width: max-content !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    top: ${BUTTON_POSITION === 'corner'
        ? 'calc(8px + env(safe-area-inset-top, 0px))'
        : 'calc(var(--f7-navbar-height, 44px) + env(safe-area-inset-top, 0px) + 10px)'};
    z-index: 2147483645;
    display: inline-flex; align-items: center; gap: 9px;
    height: 38px; padding: 0 6px 0 6px; margin: 0;
    border-radius: 999px; cursor: pointer;
    font: 600 13px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
    letter-spacing: -.1px;
    color: #1c1c1e;
    background: rgba(255,255,255,.66);
    border: 1px solid rgba(255,255,255,.55);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    box-shadow: 0 8px 28px rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.6);
    -webkit-tap-highlight-color: transparent;
    user-select: none; -webkit-user-select: none;
    transition: transform .2s cubic-bezier(.3,.7,.4,1.4), box-shadow .25s ease, background-color .25s ease;
}
/* Animated gradient ring (only while VIP apps are shown) */
#igx-vip-btn::before {
    content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1.5px;
    background: conic-gradient(from var(--igx-angle), #ffd166, #ff8a00, #ff3d71, #ffd166);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
    animation: igx-spin 4s linear infinite;
    opacity: 1; transition: opacity .3s ease; pointer-events: none;
}
#igx-vip-btn.igx-off::before { opacity: 0; animation-play-state: paused; }
html.dark #igx-vip-btn {
    color: #f2f2f7;
    background: rgba(36,36,38,.66);
    border-color: rgba(255,255,255,.08);
    box-shadow: 0 8px 28px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.06);
}
#igx-vip-btn:not(.igx-off) { box-shadow: 0 8px 28px rgba(255,120,0,.28), 0 1px 2px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.6); }
#igx-vip-btn:hover  { transform: translateY(-1px); }
#igx-vip-btn:active { transform: scale(.95); }
#igx-vip-btn:focus { outline: none; }
#igx-vip-btn:focus-visible { outline: 2px solid var(--igx-accent); outline-offset: 3px; }

/* Bolt badge with a slash that draws in when VIP apps are hidden */
#igx-vip-btn .igx-bolt {
    width: 28px; height: 28px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #ffc247 0%, #ff6b00 100%);
    box-shadow: 0 3px 10px rgba(255,120,0,.45), inset 0 1px 0 rgba(255,255,255,.35);
    transition: background .3s ease, box-shadow .3s ease;
}
#igx-vip-btn .igx-bolt svg { width: 16px; height: 16px; overflow: visible; }
#igx-vip-btn .igx-bolt .igx-bolt-shape { fill: #fff; transition: opacity .3s ease; }
#igx-vip-btn .igx-bolt .igx-slash {
    fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round;
    stroke-dasharray: 26; stroke-dashoffset: 26;
    transition: stroke-dashoffset .3s cubic-bezier(.4,0,.2,1);
}
#igx-vip-btn.igx-off .igx-bolt { background: linear-gradient(135deg, #a1a1aa 0%, #71717a 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
#igx-vip-btn.igx-off .igx-bolt .igx-bolt-shape { opacity: .75; }
#igx-vip-btn.igx-off .igx-bolt .igx-slash { stroke-dashoffset: 0; }
#igx-vip-btn.igx-pop .igx-bolt { animation: igx-pop .35s ease; }

/* Text: "VIP" + small state line */
#igx-vip-btn .igx-text { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
#igx-vip-btn .igx-label { font-weight: 700; letter-spacing: .2px; }
#igx-vip-btn .igx-state { font-size: 10px; font-weight: 600; opacity: .55; text-transform: uppercase; letter-spacing: .5px; }

/* Mini switch */
#igx-vip-btn .igx-switch {
    position: relative; width: 36px; height: 22px; border-radius: 999px; flex: none; margin-left: 1px;
    background: linear-gradient(135deg, #ffb020, #ff6b00);
    box-shadow: inset 0 1px 2px rgba(0,0,0,.15);
    transition: background .25s ease;
}
#igx-vip-btn .igx-switch::after {
    content: ""; position: absolute; top: 2px; left: 16px;
    width: 18px; height: 18px; border-radius: 50%; background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,.25);
    transition: left .28s cubic-bezier(.3,.7,.4,1.3);
}
#igx-vip-btn.igx-off .igx-switch { background: rgba(120,120,128,.32); }
#igx-vip-btn.igx-off .igx-switch::after { left: 2px; }

/* Phones: hide the state line so the pill stays compact */
@media (max-width: ${PHONE_MAX_WIDTH}px) {
    #igx-vip-btn { height: 36px; gap: 8px; }
    #igx-vip-btn .igx-state { display: none; }
}
@media (prefers-reduced-motion: reduce) {
    #igx-vip-btn, #igx-vip-btn *, #igx-vip-btn::before { transition: none !important; animation: none !important; }
}
`;

    function injectStyle() {
        if (document.getElementById('igx-style')) return;
        const style = document.createElement('style');
        style.id = 'igx-style';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
    injectStyle(); // as early as possible -> no flash of list view / VIP apps

    /* ------------------------------------------------------------------ *
     *  VIP marking (fallback + used for counting)
     *  Always recomputed from the card's *current* content, so a card that
     *  was cloned from a VIP template and refilled as non-VIP is corrected.
     * ------------------------------------------------------------------ */
    function isVipCard(li) { return !!li.querySelector(VIP_MARK); }
    function markCard(li) { li.classList.toggle('igx-vip', isVipCard(li)); }

    function markWithin(node) {
        if (node.nodeType !== 1) return;
        if (node.matches('ul.app-list > li')) markCard(node);
        node.querySelectorAll('ul.app-list > li').forEach(markCard);
    }

    /* ------------------------------------------------------------------ *
     *  "All VIP" notice per list
     * ------------------------------------------------------------------ */
    function updateListNotices() {
        document.querySelectorAll('ul.app-list').forEach(function (ul) {
            const items = ul.querySelectorAll(':scope > li');
            let visible = 0;
            items.forEach(function (li) { if (!isVipCard(li)) visible++; });
            ul.classList.toggle('igx-all-vip', items.length > 0 && visible === 0);
        });
    }

    /* ------------------------------------------------------------------ *
     *  Infinite-scroll support
     *  Framework7 only checks "near the bottom?" on a scroll event. When VIP
     *  cards are hidden the list can become too short to scroll, so we send
     *  a synthetic scroll event to let the site load the next page itself
     *  (the site's own "activated"/page-count guards still apply).
     * ------------------------------------------------------------------ */
    const fillState = new WeakMap(); // scroller -> { total, visible, strikes, pending }

    function countCards(scroller) {
        const items = scroller.querySelectorAll('ul.app-list > li');
        let visible = 0;
        items.forEach(function (li) { if (!isVipCard(li)) visible++; });
        return { total: items.length, visible: visible };
    }

    function maybeFill() {
        if (!hideVip) return;
        document.querySelectorAll('.page-current .infinite-scroll-content').forEach(function (sc) {
            if (!sc.offsetParent && sc.getClientRects().length === 0) return; // not displayed
            const pre = sc.querySelector('.infinite-scroll-preloader');
            if (pre && pre.classList.contains('hidden')) return;               // site says: no more pages

            const st = fillState.get(sc) || { total: -1, visible: -1, strikes: 0, pending: false };
            const now = countCards(sc);

            if (st.pending && now.total > st.total) {         // a load we triggered has finished
                st.strikes = now.visible > st.visible ? 0 : st.strikes + 1;
                st.pending = false;
            }
            if (st.strikes >= MAX_EMPTY_AUTOLOADS) { fillState.set(sc, st); return; }

            const distance = parseInt(sc.getAttribute('data-infinite-distance'), 10) || 50;
            const remaining = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
            if (remaining <= distance + 150) {
                st.total = now.total;
                st.visible = now.visible;
                st.pending = true;
                sc.dispatchEvent(new Event('scroll'));
            }
            fillState.set(sc, st);
        });
    }

    // A real user scroll resets the "empty auto-load" counter.
    document.addEventListener('scroll', function (e) {
        if (!e.isTrusted || !(e.target instanceof Element)) return;
        const st = fillState.get(e.target);
        if (st) st.strikes = 0;
    }, true);

    /* ------------------------------------------------------------------ *
     *  Debounced post-processing (notices + infinite fill)
     * ------------------------------------------------------------------ */
    let refreshTimer = null;
    function scheduleRefresh(delay) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
            updateListNotices();
            maybeFill();
        }, delay == null ? 200 : delay);
    }

    /* ------------------------------------------------------------------ *
     *  Toggle
     * ------------------------------------------------------------------ */
    let toastTimer = null;
    function toast(msg) {
        if (!document.body) return;
        let el = document.getElementById('igx-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'igx-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        void el.offsetWidth; // restart transition
        el.classList.add('igx-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('igx-show'); }, 1600);
    }

    function updateButton() {
        const b = document.getElementById('igx-vip-btn');
        if (!b) return;
        b.classList.toggle('igx-off', hideVip);
        b.setAttribute('aria-pressed', String(!hideVip)); // pressed = VIP apps shown
        const state = b.querySelector('.igx-state');
        if (state) state.textContent = hideVip ? 'Hidden' : 'Shown';
        const label = hideVip ? 'Show VIP apps (T)' : 'Hide VIP apps (T)';
        b.title = label;
        b.setAttribute('aria-label', label);
    }

    function setHideVip(v, showToast) {
        hideVip = v;
        saveState(v);
        root.classList.toggle('igx-hide-vip', v);
        updateButton();
        const btn = document.getElementById('igx-vip-btn');
        if (btn) { btn.classList.remove('igx-pop'); void btn.offsetWidth; btn.classList.add('igx-pop'); }
        if (showToast) toast(v ? 'VIP apps hidden' : 'VIP apps shown');
        // Reset auto-load counters so a fresh fill can happen.
        document.querySelectorAll('.infinite-scroll-content').forEach(function (sc) { fillState.delete(sc); });
        scheduleRefresh(50);
    }

    function isTypingTarget(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    document.addEventListener('keydown', function (e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!e.key || e.key.toLowerCase() !== TOGGLE_KEY) return;
        if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        setHideVip(!hideVip, true);
    }, true);

    // Keep tabs in sync if the setting is changed in another tab.
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            const v = e.newValue === null ? true : e.newValue === '1';
            if (v !== hideVip) setHideVip(v, false);
        }
    });

    /* ------------------------------------------------------------------ *
     *  SPA + infinite scroll: watch the DOM
     *  Framework7 swaps pages and the site appends cards without reloads;
     *  a single MutationObserver catches both.
     * ------------------------------------------------------------------ */
    const observer = new MutationObserver(function (mutations) {
        let relevant = false;
        for (let i = 0; i < mutations.length; i++) {
            const added = mutations[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
                const n = added[j];
                if (n.nodeType !== 1) continue;
                markWithin(n);   // synchronous -> fallback hides before paint
                relevant = true;
            }
            if (mutations[i].removedNodes.length) relevant = true;
        }
        if (!document.getElementById('igx-style')) injectStyle(); // in case <head> was rebuilt
        if (relevant) scheduleRefresh();
    });

    function start() {
        injectStyle();
        markWithin(document.body);
        observer.observe(document.body, { childList: true, subtree: true });

        if (SHOW_FLOATING_BUTTON && !document.getElementById('igx-vip-btn')) {
            // A <div role="button"> instead of <button>: Framework7 styles every <button>
            // (e.g. width:100%), which stretched the pill across the whole screen.
            const b = document.createElement('div');
            b.id = 'igx-vip-btn';
            b.setAttribute('role', 'button');
            b.tabIndex = 0;
            b.innerHTML =
                '<span class="igx-bolt" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24">' +
                        '<path class="igx-bolt-shape" d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6z"/>' +
                        '<path class="igx-slash" d="M4 4 20 20"/>' +
                    '</svg>' +
                '</span>' +
                '<span class="igx-text"><span class="igx-label">VIP</span><span class="igx-state"></span></span>' +
                '<span class="igx-switch" aria-hidden="true"></span>';
            b.addEventListener('keydown', function (e) {   // keyboard support like a real button
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHideVip(!hideVip, true);
                }
            });
            b.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setHideVip(!hideVip, true);
            });
            document.body.appendChild(b);
            updateButton();
        }

        // Framework7 page lifecycle events bubble on the document – extra safety for SPA navigation.
        ['page:afterin', 'page:init', 'tab:show'].forEach(function (ev) {
            document.addEventListener(ev, function () { scheduleRefresh(100); });
        });
        window.addEventListener('resize', function () { scheduleRefresh(250); });

        scheduleRefresh(300);
    }

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
