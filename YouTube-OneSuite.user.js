// ==UserScript==
// @name         YouTube OneSuite
// @namespace    https://github.com/BlackSkuII
// @version      1.1.0
// @description  Six scripts in one: ad skipping + network ad blocking, Premium-style player features, interruption-toast removal, watch-page sidebar/thumbnail sizing, channels open to the Videos tab, and the original video-metadata layout.
// @author       Merged by Arena.ai. Original authors: Aron (YT Ads Skipper), Mysticatten (YT Premium Client Side), BawdyInkSlinger (channels -> Videos), SpoopyTim (metadata layout).
// @license      MIT
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @exclude      https://accounts.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @exclude      https://www.youtube.com/live_chat*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/YouTube-OneSuite.user.js
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/YouTube-OneSuite.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==

/* ==========================================================================
   MODULE MAP  (what came from where)
   --------------------------------------------------------------------------
   §5  netShield   ... "2 YT Premium Client Side"      fetch/XHR ad blocking
   §6  adSweeper   ... "2 YT Premium Client Side"      DOM ad removal
   §7  adSkipper   ... "1 YT Ads Skipper"              .ad-showing skip + stats
       watchTimer  ... "1 YT Ads Skipper"              watch-time counter
   §8  quality     ... "2 YT Premium Client Side"      max quality
   §9  volume      ... "2 YT Premium Client Side"      persist volume/mute
   §10 theater     ... "2 YT Premium Client Side"      auto theater
   §11 endscreen   ... "2 YT Premium Client Side"      skip last 20s
   §12 sponsors    ... "2 YT Premium Client Side"      sponsor chapter skip
   §13 toasts      ... "Remove YouTube Interruption Toast"  (all 4 variants)
   §14 layout      ... "YouTube Sidebar & Thumbnail Width Tweaker"
   §15 channels    ... "Youtube channels open to Videos tab"
   §16 metadata    ... "xiaomimimo YouTube Original Video Metadata"
   §17 hud         ... "1 YT Ads Skipper"              draggable HUD
   §18 hotkeys     ... "1 YT Ads Skipper"              Alt+… shortcuts
   §19 panel       ... both settings panels, unified
   ========================================================================== */

(function () {
  'use strict';

  const VERSION = '1.1.0';
  const CONFIG_KEY = 'ytOneSuite.config.v1';
  const LOG_PREFIX = '[OneSuite]';

  /* ======================================================================
     §1  CORE HELPERS
     ====================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const video = () => document.querySelector('video');
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // Page context matters: with @grant present, a userscript manager may run us
  // in a sandbox, so window.fetch / XMLHttpRequest must be patched on the REAL
  // page objects or the interception silently does nothing.
  const pageWindow = (() => {
    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
    } catch (e) { /* ignore */ }
    return window;
  })();

  // --- storage (GM_* with a localStorage fallback) ---------------------------
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

  const readStore = (key, fallback) => {
    try {
      if (hasGM) {
        const v = GM_getValue(key, undefined);
        return v === undefined ? fallback : v;
      }
      const raw = localStorage.getItem('onesuite.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  const writeStore = (key, value) => {
    try {
      if (hasGM) { GM_setValue(key, value); return; }
      localStorage.setItem('onesuite.' + key, JSON.stringify(value));
    } catch (e) { /* quota / disabled storage */ }
  };

  // --- style registry (so toggles can add AND remove CSS) --------------------
  const styles = new Map();

  function addStyle(key, css) {
    removeStyle(key);
    let el = null;
    try {
      if (typeof GM_addStyle === 'function') el = GM_addStyle(css);
    } catch (e) { /* fall through */ }
    if (!el || !el.nodeType) {
      el = document.createElement('style');
      el.textContent = css;
      (document.head || document.documentElement).appendChild(el);
    }
    styles.set(key, el);
    return el;
  }

  function removeStyle(key) {
    const el = styles.get(key);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    styles.delete(key);
  }

  // --- logging -------------------------------------------------------------
  function log(...args) {
    if (CFG && CFG.debug) console.log(LOG_PREFIX, ...args);
  }
  function warn(...args) { console.warn(LOG_PREFIX, ...args); }

  // --- DOM-ready helper ----------------------------------------------------
  function whenBodyReady(fn) {
    if (document.body) { fn(); return; }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => fn(), { once: true });
    } else {
      fn();
    }
  }

  // --- single SPA navigation hook -----------------------------------------
  // Every original script added its own yt-navigate-finish listener; one list
  // keeps ordering predictable and avoids six listeners doing the same work.
  const navHooks = [];
  let navBound = false;

  function onNavigate(fn) { navHooks.push(fn); }

  function bindNavigation() {
    if (navBound) return;
    navBound = true;
    document.addEventListener('yt-navigate-finish', () => {
      for (const fn of navHooks) {
        try { fn(); } catch (e) { log('nav hook failed', e); }
      }
    }, { passive: true });
  }

  const isWatchPage = () => location.pathname === '/watch';

  /* ======================================================================
     §2  CONFIG
     ====================================================================== */

  const DEFAULTS = {
    // --- "2 YT Premium Client Side" -------------------------------------
    blockAds: true,
    skipSponsors: true,
    autoMaxQuality: true,
    hideUpsells: true,
    persistVolume: true,
    autoSkipEndscreen: false,
    autoTheaterMode: false,

    // --- "1 YT Ads Skipper" ---------------------------------------------
    skipperEnabled: true,
    hudVisible: false,
    drag: false,
    volumePopup: true,
    pos: { x: 20, y: 100 },
    stats: { ads: 0, sponsors: 0, watch: 0 },

    // --- "Remove YouTube Interruption Toast" ----------------------------
    removeToasts: true,
    toastMode: 'all', // 'all' = every paper toast (original behaviour) | 'interruption' = only the nag

    // --- layout ---------------------------------------------------------
    sidebarTweak: true,
    metadataFix: true,

    // --- navigation -----------------------------------------------------
    channelsToVideos: true,

    // --- diagnostics ----------------------------------------------------
    debug: false,
  };

  let CFG = null;

  function loadConfig() {
    const saved = readStore(CONFIG_KEY, null);
    const cfg = Object.assign({}, DEFAULTS, saved || {});
    cfg.stats = Object.assign({}, DEFAULTS.stats, (saved && saved.stats) || {});
    cfg.pos = Object.assign({}, DEFAULTS.pos, (saved && saved.pos) || {});
    if (!saved) migrateLegacySettings(cfg);
    CFG = cfg;
    return cfg;
  }

  // First run of the merged script: adopt settings the standalone scripts left
  // behind, so nothing resets. Runs once (guarded by the absence of a saved
  // OneSuite config).
  function migrateLegacySettings(cfg) {
    let touched = false;

    // 1 YT Ads Skipper kept everything in a page-localStorage blob.
    try {
      const raw = localStorage.getItem('yt_ads_skipper_state');
      if (raw) {
        const old = JSON.parse(raw);
        if (typeof old.enabled === 'boolean') cfg.skipperEnabled = old.enabled;
        if (typeof old.hudVisible === 'boolean') cfg.hudVisible = old.hudVisible;
        if (typeof old.drag === 'boolean') cfg.drag = old.drag;
        if (typeof old.volumePopup === 'boolean') cfg.volumePopup = old.volumePopup;
        if (old.pos && typeof old.pos.x === 'number') cfg.pos = { x: old.pos.x, y: old.pos.y };
        if (old.stats) {
          cfg.stats = {
            ads: old.stats.ads | 0,
            sponsors: old.stats.sponsors | 0,
            watch: old.stats.watch | 0,
          };
        }
        touched = true;
        log('migrated yt_ads_skipper_state');
      }
    } catch (e) { log('legacy skipper state unreadable', e); }

    // 2 YT Premium Client Side stored one GM key per feature.
    if (hasGM) {
      const keyMap = [
        ['blockAds', 'blockAds'],
        ['skipSponsors', 'skipSponsors'],
        ['autoMaxQuality', 'autoMaxQuality'],
        ['hideUpsells', 'hideUpsells'],
        ['persistVolume', 'persistVolume'],
        ['autoSkipEndscreen', 'autoSkipEndscreen'],
        ['autoTheaterMode', 'autoTheaterMode'],
      ];
      for (const [gmKey, cfgKey] of keyMap) {
        try {
          const v = GM_getValue(gmKey, undefined);
          if (typeof v === 'boolean') { cfg[cfgKey] = v; touched = true; }
        } catch (e) { /* ignore */ }
      }
      // "Youtube channels open to Videos" debug preference.
      try {
        const dbg = GM_getValue('debugMode', undefined);
        if (typeof dbg === 'boolean') { cfg.debug = dbg; touched = true; }
      } catch (e) { /* ignore */ }
    }

    if (touched) log('legacy settings adopted');
  }

  let saveTimer = null;

  function scheduleSave() {
    if (saveTimer) return;
    // 3 s: the watch-time counter renders once a second, and GM storage does
    // not need to be written that often.
    saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 3000);
  }

  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    writeStore(CONFIG_KEY, CFG);
  }

  /* ======================================================================
     §3  SHARED TOAST (used by the sponsor skipper)
     ====================================================================== */

  function flashToast(text) {
    if (!document.body) return;
    const old = document.getElementById('os-flash-toast');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'os-flash-toast';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', bottom: '80px', right: '24px',
      background: 'rgba(0,0,0,0.82)', color: '#fff',
      padding: '8px 16px', borderRadius: '4px',
      fontFamily: 'Roboto, sans-serif', fontSize: '13px',
      zIndex: '99999', pointerEvents: 'none',
      animation: 'osFadeIn .2s ease',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  /* ======================================================================
     §4  QUALITY PREFERENCE
     ("2 YT Premium Client Side" shipped 2160/1440 commented out; keep the
      original effective list, edit here if you want 4K.)
     ====================================================================== */

  const QUALITY_PREFERENCE = ['hd1080', 'hd720', 'large', 'medium'];

  /* ======================================================================
     §5  NET SHIELD  --  fetch / XHR ad-request blocking
     ====================================================================== */

  const AD_URL_PATTERNS = [
    /doubleclick\.net/,
    /googlesyndication\.com/,
    /googleadservices\.com/,
    /\/pagead\//,
    /\/ads\//,
    /adformat/,
  ];

  const isAdUrl = (url) => typeof url === 'string' && AD_URL_PATTERNS.some((p) => p.test(url));

  // Engine A of the Premium ad blocker: request-level blocking.
  // The originals are kept so the engine can be switched off at runtime
  // without a page reload.
  let netShield = null;

  function installNetShield() {
    const w = pageWindow;
    if (netShield) return;

    const saved = { fetch: null, open: null, send: null };

    // --- patch fetch -------------------------------------------------------
    try {
      const originalFetch = w.fetch;
      if (typeof originalFetch === 'function' && !originalFetch.__osPatched) {
        const patched = function (input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (isAdUrl(url)) {
            log('fetch blocked', url);
            // Prefer a real Response; fall back to a minimal stub on engines
            // that do not expose one so blocking still works.
            let ResponseCtor = null;
            try { ResponseCtor = w.Response || (typeof Response === 'function' ? Response : null); }
            catch (e) { ResponseCtor = w.Response || null; }

            if (ResponseCtor) return Promise.resolve(new ResponseCtor('', { status: 200 }));
            return Promise.resolve({
              ok: true, status: 200, statusText: 'OK', url: '', headers: null,
              text: () => Promise.resolve(''),
              json: () => Promise.resolve({}),
            });
          }
          return originalFetch.apply(this, arguments);
        };
        patched.__osPatched = true;
        saved.fetch = originalFetch;
        w.fetch = patched;
      }
    } catch (e) { warn('fetch patch failed', e); }

    // --- patch XHR ---------------------------------------------------------
    // The original Premium script rewrote ad URLs to 'about:blank'. Chrome then
    // logged a CORS error plus net::ERR_FAILED for every blocked beacon. Instead,
    // let open() run normally (so setRequestHeader and the XHR state machine
    // behave) and neutralise send() — no request is ever made, and the caller
    // still gets an empty 200 via its own event handlers.
    try {
      const XHR = w.XMLHttpRequest;
      const proto = XHR && XHR.prototype;
      if (proto && typeof proto.open === 'function' && !proto.open.__osPatched) {
        const originalOpen = proto.open;
        const originalSend = proto.send;
        const EventCtor = w.Event || Event;
        saved.open = originalOpen;
        saved.send = originalSend;

        const patchedOpen = function (method, url) {
          this.__osBlocked = isAdUrl(url);
          if (this.__osBlocked) log('xhr blocked', url);
          return originalOpen.apply(this, arguments);
        };
        patchedOpen.__osPatched = true;
        proto.open = patchedOpen;

        proto.send = function () {
          if (!this.__osBlocked) return originalSend.apply(this, arguments);

          const xhr = this;
          xhr.__osBlocked = false;

          setTimeout(() => {
            try {
              const props = [['readyState', 4], ['status', 200], ['statusText', 'OK'], ['responseText', ''], ['response', '']];
              for (const [prop, value] of props) {
                Object.defineProperty(xhr, prop, { value, configurable: true });
              }
            } catch (e) { /* leave whatever the platform exposes */ }
            for (const type of ['readystatechange', 'load', 'loadend']) {
              try { xhr.dispatchEvent(new EventCtor(type)); } catch (e) { /* ignore */ }
            }
          }, 0);
          return undefined;
        };
      }
    } catch (e) { warn('xhr patch failed', e); }

    netShield = saved;
    log('net shield installed');
  }

  function uninstallNetShield() {
    if (!netShield) return;
    const w = pageWindow;
    try {
      if (netShield.fetch && w.fetch && w.fetch.__osPatched) w.fetch = netShield.fetch;
    } catch (e) { /* ignore */ }
    try {
      const proto = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
      if (proto) {
        if (netShield.open && proto.open && proto.open.__osPatched) proto.open = netShield.open;
        if (netShield.send) proto.send = netShield.send;
      }
    } catch (e) { /* ignore */ }
    netShield = null;
    log('net shield removed');
  }

  /* ======================================================================
     §5b  SHARED AD MUTE
     ----------------------------------------------------------------------
     Both engines mute the player while an ad is on screen. A two-counter
     "who muted it" scheme means either engine can be switched off (or both
     can run together) without one of them un-muting over the other. The
     user's own mute state is restored when the last holder releases.
     ====================================================================== */

  const adMute = {
    holders: new Set(),
    previous: null,

    begin(holder) {
      const v = video();
      if (this.holders.size === 0) this.previous = v ? v.muted : null;
      this.holders.add(holder);
      if (v) v.muted = true;
    },

    end(holder) {
      if (!this.holders.has(holder)) return;
      this.holders.delete(holder);
      if (this.holders.size === 0) {
        const v = video();
        if (v) v.muted = this.previous === null ? false : this.previous;
        this.previous = null;
      }
    },

    releaseAll() {
      if (this.holders.size === 0) return;
      this.holders.clear();
      const v = video();
      if (v) v.muted = this.previous === null ? false : this.previous;
      this.previous = null;
    },
  };

  /* ======================================================================
     §6  AD SWEEPER  --  DOM-level ad removal + skip-button clicking
     (Premium script's MutationObserver, throttled to one pass per frame)
     ====================================================================== */

  const AD_ELEMENT_SELECTORS = [
    '#player-ads',
    '#masthead-ad',
    'ytd-banner-promo-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-ad-slot-renderer',
    'ytd-statement-banner-renderer',
    '.ytd-promoted-sparkles-web-renderer',
    '#offer-module',
    'tp-yt-paper-dialog.ytd-mealbar-promo-renderer',
  ];
  // NOTE: the original list also included '.ad-showing' and '.ad-interrupting'.
  // Those are STATE classes shared with the player container, not ad elements,
  // so removing them can tear down the player itself. They are no longer
  // removed here; the skip logic in §7 handles those states.

  let sweepQueued = false;

  function sweepAds() {
    for (const sel of AD_ELEMENT_SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) el.remove();
    }

    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
    if (skipBtn) skipBtn.click();

    // Premium's own in-player handling (kept as in the original): mute and
    // jump to the end of the ad while `.ad-showing` is present.
    const v = video();
    if (document.querySelector('.ad-showing') && v) {
      adMute.begin('premium');
      if (isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration;
    } else {
      adMute.end('premium');
    }
  }

  function scheduleSweep() {
    if (sweepQueued || !adObserver) return;
    sweepQueued = true;
    requestAnimationFrame(() => {
      sweepQueued = false;
      if (!adObserver) return;
      try { sweepAds(); } catch (e) { log('sweep failed', e); }
    });
  }

  let adObserver = null;

  function startAdSweeper() {
    if (adObserver) return;
    adObserver = new MutationObserver(scheduleSweep);
    adObserver.observe(document.body, { childList: true, subtree: true });
    sweepAds();
    log('premium ad engine on');
  }

  function stopAdSweeper() {
    if (adObserver) {
      adObserver.disconnect();
      adObserver = null;
    }
    adMute.end('premium');
    log('premium ad engine off');
  }

  /* ======================================================================
     §7  AD SKIPPER  +  WATCH-TIME COUNTER
     ("1 YT Ads Skipper": 700ms poll, mute + seek + skip-button click)
     ====================================================================== */

  let adActive = false;          // ad pod currently on screen
  let adTickTimer = null;
  let watchTimerId = null;

  function adTick() {
    if (!CFG.skipperEnabled) return;
    const v = video();
    if (!v) return;

    const showing = document.querySelector('.ad-showing');

    if (!showing) {
      if (adActive) {
        adActive = false;
        adMute.end('skipper');
      }
      return;
    }

    // One count per ad pod. (The original incremented on every 700ms tick,
    // which inflated "Ads Skipped" by ~10x per ad.)
    if (!adActive) {
      adActive = true;
      CFG.stats.ads++;
      render();
    }

    adMute.begin('skipper');
    if (isFinite(v.duration) && v.duration > 0) {
      v.currentTime = v.duration;
    } else {
      v.currentTime = 9999;
    }
    const skip = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
    if (skip) skip.click();
  }

  function startAdSkipper() {
    if (adTickTimer) return;
    adTickTimer = setInterval(adTick, 700);
    log('ads skipper engine on');
  }

  function stopAdSkipper() {
    if (adTickTimer) {
      clearInterval(adTickTimer);
      adTickTimer = null;
    }
    adActive = false;
    adMute.end('skipper');
    log('ads skipper engine off');
  }

  function startWatchTimer() {
    if (watchTimerId) return;
    watchTimerId = setInterval(() => {
      const v = video();
      if (v && !v.paused && !v.ended) {
        CFG.stats.watch++;
        render();
      }
    }, 1000);
  }

  /* ======================================================================
     §8  MAX QUALITY
     ====================================================================== */

  function setMaxQuality() {
    if (!CFG.autoMaxQuality) return;
    try {
      const player = document.getElementById('movie_player');
      if (!player || typeof player.getAvailableQualityLevels !== 'function') return;

      const levels = player.getAvailableQualityLevels();
      if (!levels || levels.length === 0) return;

      const best = QUALITY_PREFERENCE.find((q) => levels.includes(q)) || levels[0];

      if (typeof player.getPlaybackQuality === 'function' && player.getPlaybackQuality() !== best) {
        player.setPlaybackQualityRange(best, best);
        log('quality set to', best);
      }
    } catch (e) { /* player not ready */ }
  }

  function startQuality() {
    if (!CFG.autoMaxQuality) return;
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (document.getElementById('movie_player')) {
        setMaxQuality();
        clearInterval(iv);
      } else if (tries > 60) {
        clearInterval(iv);
      }
    }, 500);
    onNavigate(() => setTimeout(setMaxQuality, 1500));
  }

  /* ======================================================================
     §9  PERSIST VOLUME
     ====================================================================== */

  const VOLUME_KEY = 'ytOneSuite.volume';
  const MUTED_KEY = 'ytOneSuite.muted';

  let savedVolume = 1;
  let savedMuted = false;
  let volumeSaveTimer = null;
  let volumeBound = false;

  function loadVolume() {
    let vol = readStore(VOLUME_KEY, undefined);
    let muted = readStore(MUTED_KEY, undefined);

    // First run: adopt the keys the standalone Premium script used
    // ('ytVolume' / 'ytMuted'), then write them under our own names.
    if (vol === undefined && hasGM) {
      try {
        const legacy = GM_getValue('ytVolume', undefined);
        if (legacy !== undefined) vol = legacy;
      } catch (e) { /* ignore */ }
    }
    if (muted === undefined && hasGM) {
      try {
        const legacy = GM_getValue('ytMuted', undefined);
        if (legacy !== undefined) muted = legacy;
      } catch (e) { /* ignore */ }
    }

    const parsed = parseFloat(vol);
    savedVolume = isFinite(parsed) ? clamp(parsed, 0, 1) : 1;
    savedMuted = !!muted;

    if (vol !== undefined) writeStore(VOLUME_KEY, savedVolume);
    if (muted !== undefined) writeStore(MUTED_KEY, savedMuted);
  }

  function applyVolume() {
    if (!CFG.persistVolume) return;
    const v = video();
    if (!v) return;
    v.volume = savedVolume;
    v.muted = savedMuted;

    const player = document.getElementById('movie_player');
    if (player && typeof player.setVolume === 'function') {
      try {
        player.setVolume(savedVolume * 100);
        if (savedMuted) player.mute(); else player.unMute();
      } catch (e) { /* ignore */ }
    }
  }

  function onVolumeChange(e) {
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (v.__osSuppressSave) return;
    savedVolume = v.volume;
    savedMuted = v.muted;
    if (volumeSaveTimer) return;
    volumeSaveTimer = setTimeout(() => {
      volumeSaveTimer = null;
      writeStore(VOLUME_KEY, savedVolume);
      writeStore(MUTED_KEY, savedMuted);
    }, 400);
  }

  function startVolumePersistence() {
    if (!CFG.persistVolume) return;
    loadVolume();
    // single capture-phase listener instead of re-adding one per navigation
    if (!volumeBound) {
      volumeBound = true;
      document.addEventListener('volumechange', onVolumeChange, true);
    }
    // The player element usually does not exist yet on first load, so retry
    // briefly instead of relying only on yt-navigate-finish.
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const v = video();
      if (v) { applyVolume(); clearInterval(iv); }
      else if (tries > 40) clearInterval(iv);
    }, 500);
    applyVolume();
    onNavigate(() => setTimeout(applyVolume, 1000));
  }

  /* ======================================================================
     §10  AUTO THEATER
     ====================================================================== */

  function enableTheater() {
    if (!CFG.autoTheaterMode) return;
    if (!isWatchPage()) return;
    if (document.querySelector('ytd-watch-flexy[theater]')) return;
    const btn = document.querySelector('.ytp-size-button');
    if (btn) btn.click();
  }

  function startTheater() {
    if (!CFG.autoTheaterMode) return;
    onNavigate(() => setTimeout(enableTheater, 800));
    setTimeout(enableTheater, 1200);
  }

  /* ======================================================================
     §11  AUTO SKIP END SCREEN
     ====================================================================== */

  let lastEndscreenClick = 0;
  let endscreenBound = false;

  function onEndscreenTimeupdate(e) {
    if (!CFG.autoSkipEndscreen) return;
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (!isFinite(v.duration) || v.duration <= 25) return;
    if (v.currentTime < v.duration - 20) return;
    if (Date.now() - lastEndscreenClick < 6000) return;

    const next = document.querySelector('.ytp-next-button');
    if (next) {
      lastEndscreenClick = Date.now();
      next.click();
      log('end screen skipped');
    }
  }

  function startEndscreenSkip() {
    if (!CFG.autoSkipEndscreen || endscreenBound) return;
    endscreenBound = true;
    document.addEventListener('timeupdate', onEndscreenTimeupdate, true);
  }

  /* ======================================================================
     §12  SPONSOR CHAPTER SKIP
     ("2 YT Premium Client Side" heuristic against in-page chapter markers)
     ====================================================================== */

  const SPONSOR_KEYWORDS = /sponsor|promo|promotion|advertis|merch|affiliate/i;

  let chapters = [];
  let sponsorBound = false;
  let lastSkippedChapter = null;

  function parseTimestamp(text) {
    const parts = String(text || '').trim().split(':').map((n) => parseInt(n, 10));
    if (parts.some((n) => isNaN(n))) return NaN;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
  }

  function collectChapters() {
    chapters = [];
    try {
      for (const panel of document.querySelectorAll('ytd-macro-markers-list-item-renderer')) {
        // Attribute selectors instead of "#title" / "#time": YouTube repeats
        // those ids on every chapter item, and a scoped `#id` lookup can then
        // resolve against the wrong element.
        const label = panel.querySelector('[id="title"]')?.textContent?.trim() || '';
        const timeText =
          panel.querySelector('[id="time"]')?.textContent?.trim() ||
          panel.querySelector('.ytp-time-duration')?.textContent?.trim() ||
          '';
        const start = parseTimestamp(timeText);
        if (isFinite(start)) chapters.push({ label, start });
      }
      chapters.sort((a, b) => a.start - b.start);
    } catch (e) {
      chapters = [];
    }
    return chapters;
  }

  function onSponsorTimeupdate(e) {
    if (!CFG.skipSponsors) return;
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (!chapters.length) return;

    const ct = v.currentTime;
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const next = chapters[i + 1];
      const end = next ? next.start : v.duration;
      if (ct >= ch.start && ct < end && SPONSOR_KEYWORDS.test(ch.label)) {
        if (lastSkippedChapter === ch.start) return;
        lastSkippedChapter = ch.start;
        log('skipping sponsor chapter', ch.label);
        if (isFinite(end)) v.currentTime = Math.min(end, v.duration || end);
        flashToast(`Skipped: ${ch.label}`);
        return;
      }
    }
  }

  function startSponsorSkip() {
    if (!CFG.skipSponsors) return;
    if (!sponsorBound) {
      sponsorBound = true;
      document.addEventListener('timeupdate', onSponsorTimeupdate, true);
    }
    onNavigate(() => {
      lastSkippedChapter = null;
      setTimeout(collectChapters, 2000);
    });
    setTimeout(collectChapters, 2500);
  }

  /* ======================================================================
     §13  INTERRUPTION TOAST REMOVAL
     (file contained four variants; this keeps variant #1's behaviour as the
      default and folds in the dialog/text matching from #2-#3)
     ====================================================================== */

  const INTERRUPTION_TEXT = /experiencing interruptions|interruptions\?/i;
  let toastQueued = false;

  function nukeToasts() {
    if (!CFG.removeToasts) return;

    const toasts = document.querySelectorAll('tp-yt-paper-toast');
    for (const t of toasts) {
      if (CFG.toastMode === 'all' || INTERRUPTION_TEXT.test(t.textContent || '')) t.remove();
    }

    // The nag can also arrive as a dialog or an inline promo rather than a
    // toast. Deliberately NOT matching ytd-popup-container: that node hosts
    // every menu and dialog on the page, so removing it would take the UI with it.
    for (const el of document.querySelectorAll('tp-yt-paper-dialog, ytd-mealbar-promo-renderer')) {
      if (INTERRUPTION_TEXT.test(el.textContent || '')) el.remove();
    }
  }

  function scheduleToastSweep() {
    if (toastQueued) return;
    toastQueued = true;
    requestAnimationFrame(() => {
      toastQueued = false;
      try { nukeToasts(); } catch (e) { log('toast sweep failed', e); }
    });
  }

  let toastObserver = null;

  function startToastNuker() {
    if (toastObserver) return;
    toastObserver = new MutationObserver(scheduleToastSweep);
    toastObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopToastNuker() {
    if (toastObserver) { toastObserver.disconnect(); toastObserver = null; }
  }

  /* ======================================================================
     §14  SIDEBAR & THUMBNAIL WIDTH TWEAKER
     ====================================================================== */

  const LAYOUT_CSS = `
    ytd-watch-flexy {
      --ytd-watch-flexy-sidebar-width: 600px !important;
    }
    .ytLockupViewModelContentImage {
      width: 35rem !important;
    }
    #thumbnail-container.ytd-playlist-panel-video-renderer {
      width: 180px !important;
      height: 100px !important;
    }
    #thumbnail-container.ytd-playlist-panel-video-renderer > ytd-thumbnail.ytd-playlist-panel-video-renderer {
      height: 100% !important;
    }
  `;

  function applyLayout() {
    if (!CFG.sidebarTweak || !isWatchPage()) {
      removeStyle('layout');
      return;
    }
    if (!styles.has('layout')) addStyle('layout', LAYOUT_CSS);
  }

  function startLayout() {
    applyLayout();
    onNavigate(applyLayout);
  }

  /* ======================================================================
     §15  CHANNELS OPEN TO "VIDEOS" TAB
     ====================================================================== */

  // Browse params for a channel's Videos tab. See the original author's notes:
  // if YouTube changes its UI, re-derive this from a channel's Videos link.
  const VIDEOS_TAB_PARAMS = 'EgZ2aWRlb3MYAyAAcALyBg0KCzoEIgIIBKIBAggB';

  const CHANNEL_HOME_RE =
    /^(https?:\/\/www\.youtube\.com)((\/(user|channel|c)\/[^/]+)|(\/@(?!.*\/)[^/]+))(\/?$|\/featured[^/])/;

  let channelBound = false;

  function rewriteChannelAnchor(event) {
    if (!CFG.channelsToVideos) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!anchor || !anchor.href) return;
    if (!CHANNEL_HOME_RE.test(anchor.href)) return;

    const match = anchor.href.match(CHANNEL_HOME_RE);
    if (!match) return;
    const channelPath = match[2];
    const videosUrl = channelPath + '/videos';
    log('channel link rewritten', anchor.href, '->', videosUrl);

    // 1) plain href — covers middle-click / "open in new tab" / modified clicks
    try { anchor.href = videosUrl; } catch (e) { /* read-only */ }

    // 2) YouTube's SPA router navigates from the attached endpoint object, not
    //    the href. Older components expose `data`, newer ones `_data`.
    const endpoint = anchor.data ?? anchor._data;
    if (endpoint && endpoint.browseEndpoint) {
      // commandMetadata normally sits beside browseEndpoint...
      endpoint.commandMetadata ??= {};
      endpoint.commandMetadata.webCommandMetadata ??= {};
      endpoint.commandMetadata.webCommandMetadata.url = videosUrl;
      // ...but some renderers nest it inside the endpoint, so cover that too.
      if (endpoint.browseEndpoint.commandMetadata?.webCommandMetadata) {
        endpoint.browseEndpoint.commandMetadata.webCommandMetadata.url = videosUrl;
      }
      endpoint.browseEndpoint.params = VIDEOS_TAB_PARAMS;
    } else {
      log('no browseEndpoint on anchor; href rewrite only', anchor);
    }
  }

  function startChannelsToVideos() {
    if (!CFG.channelsToVideos) return;

    // Landing directly on a channel home page from outside YouTube: redirect.
    // (The original script returned here and stopped working until reload;
    // this version just redirects and still binds the click handler.)
    // /featured is the "Home" tab, so it is redirected too; only real sub-tabs
    // are left alone.
    if (CHANNEL_HOME_RE.test(location.href) &&
        !/\/(videos|shorts|streams|playlists|community|about|podcasts|releases)/.test(location.pathname)) {
      const match = location.href.match(CHANNEL_HOME_RE);
      if (match && match[2]) {
        location.replace(match[2] + '/videos');
        return;
      }
    }

    if (channelBound) return;
    channelBound = true;
    window.addEventListener('mousedown', rewriteChannelAnchor, true);
    log('channel -> videos handler bound');
  }

  /* ======================================================================
     §16  ORIGINAL VIDEO METADATA LAYOUT  (xiaomimimo)
     ====================================================================== */

  const metadata = (() => {
    function hideJunk(meta, includeIcon = false) {
      let selector = '.yt-content-metadata-view-model__delimiter, .yt-content-metadata-view-model__leading-icon';
      if (includeIcon) selector += ', .yt-content-metadata-view-model__icon';
      meta.querySelectorAll(selector).forEach((el) => { el.style.display = 'none'; });
    }

    function createLine(text, options = {}) {
      const el = document.createElement('div');
      el.textContent = text;
      el.className = options.className || 'spoofed-metadata-line';
      return el;
    }

    function fixTime(timeContent) {
      const map = {
        sec: 'second', min: 'minute', h: 'hour', hr: 'hour', d: 'day',
        w: 'week', wk: 'week', mo: 'month', y: 'year', yr: 'year',
      };
      return timeContent.replace(
        /(\d+)\s*(sec|min|h|hr|d|w|wk|mo|y|yr)\b/g,
        (match, num, unit) => {
          const full = map[unit] || unit;
          return `${num} ${full}${num === '1' ? '' : 's'}`;
        }
      );
    }

    function formatViewsAndTime(viewsEl, timeEl) {
      let viewsText = viewsEl.textContent;
      if (!viewsText.includes('view')) viewsText = `${viewsText} views`;
      return `${viewsText} • ${fixTime(timeEl.textContent)}`;
    }

    function updateCustomLine(meta, text) {
      let customLine = meta.querySelector('.spoofed-metadata-line');
      if (!customLine) {
        customLine = createLine(text, { className: 'spoofed-metadata-line' });
        meta.appendChild(customLine);
      } else if (customLine.textContent !== text) {
        customLine.textContent = text;
      }
    }

    function handleRecommendationsMetadata(meta, spans) {
      if (spans.length === 2) {
        const watchingEl = spans[1];
        if (!watchingEl) return;
        hideJunk(meta, true);
        updateCustomLine(meta, watchingEl.textContent);
        watchingEl.style.display = 'none';
        return;
      }
      if (spans.length >= 3) {
        const viewsEl = spans[1];
        const timeEl = spans[2];
        if (!viewsEl || !timeEl) return;
        hideJunk(meta);
        updateCustomLine(meta, formatViewsAndTime(viewsEl, timeEl));
        viewsEl.style.display = 'none';
        timeEl.style.display = 'none';
      }
    }

    function handleLivestreamMetadata(meta, watchingEl) {
      if (!watchingEl) return;
      hideJunk(meta, true);
      updateCustomLine(meta, watchingEl.textContent);
      watchingEl.style.display = 'none';
    }

    function handleNormalMetadata(meta, texts) {
      const viewsEl = texts[0];
      const timeEl = texts[1];
      if (!viewsEl || !timeEl) return;
      hideJunk(meta);
      updateCustomLine(meta, formatViewsAndTime(viewsEl, timeEl));
      viewsEl.style.display = 'none';
      timeEl.style.display = 'none';
    }

    function handleRecommendations(meta) {
      const rowContainers = meta.querySelectorAll('.ytContentMetadataViewModelMetadataRow');
      if (!rowContainers || !rowContainers.length) return;

      // Sidebar recommendations can have a second row (e.g. a "NEW" badge):
      // 0 = channel, 1 = views/time, 2 = badge.
      const isSidenavVideos = rowContainers.length >= 2;
      const inner = isSidenavVideos ? rowContainers[1] : rowContainers[0];
      if (!inner) return;

      const spans = [...inner.querySelectorAll('span.ytAttributedStringHost')]
        .filter((el) => el.textContent.trim());

      if (isSidenavVideos) {
        const nameSpan = rowContainers[0].querySelector('span.ytAttributedStringHost');
        if (nameSpan) nameSpan.style.fontSize = '14px';
        return handleNormalMetadata(inner, spans);
      }

      if (spans.length >= 2 && !spans[1]?.textContent?.includes('waiting')) {
        return handleRecommendationsMetadata(meta, spans);
      }
      return handleLivestreamMetadata(meta, spans[1]);
    }

    function handleChannel(meta) {
      const inner = meta.querySelector('yt-content-metadata-view-model');
      if (!inner) return;
      const spans = [...inner.querySelectorAll('span.ytd-grid-video-renderer, span.ytAttributedStringHost')]
        .filter((el) => el.textContent.trim());
      if (spans.length === 2) return handleNormalMetadata(inner, spans);
    }

    function handleSearch(meta) {
      const inner = meta.querySelector('#metadata-line');
      if (!inner) return;
      const spans = [...inner.querySelectorAll('span.inline-metadata-item')]
        .filter((el) => el.textContent.trim());
      if (spans.length === 2) return handleNormalMetadata(inner, spans);
      if (spans.length === 1) return handleLivestreamMetadata(inner, spans[0]);
    }

    // Kept from the metadata script: it cooperated with "YouTube Search: Sort
    // by Date" (which is NOT part of this merge) by fixing its time strings.
    function handleChronoResults() {
      document.querySelectorAll('.chrono-meta').forEach((meta) => {
        const firstSpan = meta.querySelector('span:not(.chrono-exact-date)');
        if (!firstSpan) return;
        const original = firstSpan.textContent;
        const fixed = fixTime(original);
        if (fixed !== original) firstSpan.textContent = fixed;
      });
    }

    function scan() {
      if (!CFG.metadataFix) return;
      const channelRe = /^\/@([^/]+)(?:\/(.*))?$/;

      if (channelRe.test(window.location.pathname)) {
        document.querySelectorAll('.ytLockupMetadataViewModelMetadata').forEach(handleChannel);
      } else {
        document.querySelectorAll('.ytLockupMetadataViewModelMetadata').forEach(handleRecommendations);
        document.querySelectorAll('ytd-video-meta-block.style-scope.ytd-video-renderer').forEach(handleSearch);
      }
      handleChronoResults();
    }

    const BASE_CSS = `
      ytd-grid-video-renderer h3.ytd-grid-video-renderer {
        margin: 8px 0 2px !important;
      }
      .spoofed-metadata-line {
        font-size: 14px;
        color: #aaa;
        margin-top: 2px;
      }
      .ytContentMetadataViewModelLeadingIcon {
        display: none;
      }
    `;

    // Watch-page only: this breaks scheduled-stream cards on the homepage.
    const WATCH_CSS = `
      .ytContentMetadataViewModelDelimiter {
        margin: 0 0;
      }
    `;

    function applyStyles() {
      if (!CFG.metadataFix) {
        removeStyle('meta-base');
        removeStyle('meta-watch');
        return;
      }
      if (!styles.has('meta-base')) addStyle('meta-base', BASE_CSS);
      if (location.pathname.includes('/watch')) {
        if (!styles.has('meta-watch')) addStyle('meta-watch', WATCH_CSS);
      } else {
        removeStyle('meta-watch');
      }
    }

    let observer = null;
    let pending = false;

    function scheduleScan() {
      if (pending || !CFG.metadataFix) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        try { scan(); } catch (e) { log('metadata scan failed', e); }
      });
    }

    function start() {
      applyStyles();
      if (!CFG.metadataFix) return;
      if (!observer) {
        observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, { childList: true, subtree: true });
      }
      scheduleScan();
      onNavigate(() => { applyStyles(); scheduleScan(); });
    }

    function apply() {
      applyStyles();
      scheduleScan();
    }

    return { start, apply };
  })();

  /* ======================================================================
     §17  HUD  ("1 YT Ads Skipper", unchanged look)
     ====================================================================== */

  const HUD_CSS = `
    #ytas-hud {
      position: fixed;
      top: ${DEFAULTS.pos.y}px;
      right: ${DEFAULTS.pos.x}px;
      z-index: 2147483647;
      padding: 14px 16px;
      min-width: 220px;
      border-radius: 18px;
      background: rgba(28,28,32,.65);
      backdrop-filter: blur(22px) saturate(180%);
      -webkit-backdrop-filter: blur(22px) saturate(180%);
      box-shadow: 0 20px 50px rgba(0,0,0,.45);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 13px;
      transition: opacity .25s ease, transform .25s ease;
    }
    #ytas-hud.hidden { opacity: 0; pointer-events: none; transform: scale(.96); }
    #ytas-title { font-weight: 600; margin-bottom: 6px; cursor: move; }
    .ytas-row { opacity: .9; line-height: 1.6; }
    .ytas-accent { color: #ff5da2; font-weight: 600; }
    #ytas-footer { opacity: .6; margin-top: 6px; font-size: 11px; }
    #ytas-vol {
      position: fixed;
      bottom: 120px;
      right: 30px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(30,30,30,.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
    }
    @keyframes osFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  `;

  let hud = null;
  let hudBound = false;

  function buildHud() {
    if (hud) return;
    addStyle('hud', HUD_CSS);

    hud = document.createElement('div');
    hud.id = 'ytas-hud';
    hud.classList.add('hidden');

    // Built node by node: innerHTML throws on pages that enforce Trusted Types,
    // and a throw here used to abort the rest of the boot sequence.
    const titleEl = document.createElement('div');
    titleEl.id = 'ytas-title';
    titleEl.textContent = 'YT Ads Skipper';
    hud.appendChild(titleEl);

    const addRow = (labelText, spanId, suffix) => {
      const row = document.createElement('div');
      row.className = 'ytas-row';
      row.appendChild(document.createTextNode(labelText));
      const span = document.createElement('span');
      span.id = spanId;
      span.className = 'ytas-accent';
      row.appendChild(span);
      if (suffix) row.appendChild(document.createTextNode(suffix));
      hud.appendChild(row);
    };

    addRow('Ad Skipper: ', 's-enabled');
    addRow('Premium block: ', 's-premium');
    addRow('Ads Skipped: ', 's-ads');
    addRow('Sponsor Skips: ', 's-sp');
    addRow('Watch Time: ', 's-wt', 's');

    const footerEl = document.createElement('div');
    footerEl.id = 'ytas-footer';
    footerEl.textContent = 'Made with ❤️ by Aron · OneSuite';
    hud.appendChild(footerEl);

    hud.style.top = CFG.pos.y + 'px';
    hud.style.right = CFG.pos.x + 'px';
    document.body.appendChild(hud);

    if (!hudBound) {
      hudBound = true;
      bindHudDrag();
    }
    render();
  }

  function render() {
    if (!hud) return;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('s-enabled', CFG.skipperEnabled ? 'ON' : 'OFF');
    set('s-premium', CFG.blockAds ? 'ON' : 'OFF');
    set('s-ads', CFG.stats.ads);
    set('s-sp', CFG.stats.sponsors);
    set('s-wt', CFG.stats.watch);
    hud.classList.toggle('hidden', !CFG.hudVisible);
    scheduleSave();
  }

  // --- drag + snap (only active in "drag" mode, as in the original) --------
  let dragOffset = null;

  function bindHudDrag() {
    document.addEventListener('mousedown', (e) => {
      if (!CFG.drag || !hud) return;
      const title = e.target.closest && e.target.closest('#ytas-title');
      if (!title) return;
      dragOffset = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragOffset || !hud) return;
      const dx = dragOffset.x - e.clientX;
      const dy = dragOffset.y - e.clientY;
      CFG.pos.x = clamp(CFG.pos.x + dx, 10, window.innerWidth - 240);
      CFG.pos.y = clamp(CFG.pos.y + dy, 10, window.innerHeight - 100);
      hud.style.right = CFG.pos.x + 'px';
      hud.style.top = CFG.pos.y + 'px';
      dragOffset = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
      if (!dragOffset) return;
      dragOffset = null;
      saveNow();
    });
  }

  // --- volume OSD ---------------------------------------------------------
  let volBox = null;

  function showVolume() {
    const v = video();
    if (!v || !CFG.volumePopup || !document.body) return;
    if (volBox) volBox.remove();
    volBox = document.createElement('div');
    volBox.id = 'ytas-vol';
    volBox.textContent = `Volume: ${Math.round(v.volume * 100)}%`;
    document.body.appendChild(volBox);
    setTimeout(() => { if (volBox) volBox.remove(); }, 1200);
  }

  /* ======================================================================
     §18  HOTKEYS  (same set as "1 YT Ads Skipper")
     ====================================================================== */

  function bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      // Alt+1 / Alt+2 open the panel. Some keyboard layouts report no code for
      // Alt+digit, so fall back to e.key (which is how the Premium script did it).
      const panelKey =
        e.code === 'Digit1' || e.key === '1' ? '1' :
        e.code === 'Digit2' || e.key === '2' ? '2' : null;

      if (panelKey) {
        e.preventDefault();
        togglePanel();
        return;
      }

      // Don't hijack playback shortcuts while typing in search / comments.
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;

      const v = video();

      switch (e.code) {
        case 'KeyF': CFG.hudVisible = !CFG.hudVisible; break;
        case 'KeyD': CFG.drag = !CFG.drag; break;
        case 'KeyA': CFG.skipperEnabled = !CFG.skipperEnabled; break;
        case 'KeyM': if (v) v.muted = !v.muted; break;
        case 'KeyR':
          if (v) { const t2 = v.currentTime; v.src = v.src; v.currentTime = t2; }
          break;
        case 'KeyS':
          if (v) { v.currentTime += 60; CFG.stats.sponsors++; }
          break;
        case 'Equal':
          if (v) { v.volume = clamp(v.volume + 0.05, 0, 1); showVolume(); }
          break;
        case 'Minus':
          if (v) { v.volume = clamp(v.volume - 0.05, 0, 1); showVolume(); }
          break;
        case 'KeyV': showVolume(); break;
        default: return;
      }

      render();
      saveNow();
    }, true);
  }

  /* ======================================================================
     §19  UNIFIED SETTINGS PANEL  (Alt+2, or Alt+1)
     ====================================================================== */

  const PANEL_CSS = `
    #os-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      background: #0f0f0f; color: #fff; border: 1px solid #333;
      border-radius: 12px; padding: 20px 24px; width: 400px;
      max-height: 82vh; overflow-y: auto;
      font-family: Roboto, sans-serif; font-size: 14px;
      z-index: 2147483646; box-shadow: 0 8px 40px rgba(0,0,0,.7);
      display: none;
    }
    #os-panel.visible { display: block; }
    #os-panel h2 {
      margin: 0 0 4px; font-size: 16px; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
    }
    #os-panel h2 span { color: #ff0000; }
    #os-sub { color: #888; font-size: 11px; margin-bottom: 14px; }
    .os-section {
      font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
      color: #777; margin: 16px 0 2px;
    }
    .os-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid #1e1e1e;
    }
    .os-row:last-of-type { border-bottom: none; }
    .os-label { line-height: 1.3; padding-right: 12px; }
    .os-label small { color: #aaa; font-size: 11px; display: block; }
    .os-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
    .os-toggle input { opacity: 0; width: 0; height: 0; }
    .os-slider {
      position: absolute; cursor: pointer; inset: 0;
      background: #333; border-radius: 22px; transition: .25s;
    }
    .os-slider:before {
      content: ''; position: absolute; height: 16px; width: 16px;
      left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .25s;
    }
    .os-toggle input:checked + .os-slider { background: #ff0000; }
    .os-toggle input:checked + .os-slider:before { transform: translateX(18px); }
    select.os-select {
      background: #222; color: #fff; border: 1px solid #333;
      border-radius: 6px; padding: 4px 8px; font-size: 12px;
    }
    .os-actions { display: flex; gap: 8px; margin-top: 18px; }
    .os-actions button {
      flex: 1; padding: 8px; background: #222; color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 12px;
    }
    .os-actions button:hover { background: #333; }
    #os-close { width: 100%; padding: 9px; margin-top: 8px;
      background: #272727; color: #fff; border: none; border-radius: 6px;
      cursor: pointer; font-size: 13px; }
    #os-close:hover { background: #383838; }
    #os-hint {
      position: fixed; bottom: 12px; right: 16px;
      background: rgba(0,0,0,.6); color: #aaa;
      font-family: Roboto, sans-serif; font-size: 11px;
      padding: 4px 10px; border-radius: 4px; z-index: 99990;
      pointer-events: none;
    }
  `;

  // type: 'toggle' | 'select'
  const CONTROLS = [
    // The two ad blockers are deliberately independent: they work in different
    // places (request/DOM vs. player polling) and can be used alone or together.
    { section: 'Ad blocking', key: 'skipperEnabled', label: 'YT Ads Skipper', desc: 'Polls the player every 700 ms: mute, jump to the end, click skip. Drives the HUD counters.' },
    { section: 'Ad blocking', key: 'blockAds', label: 'YT Premium — ad blocking', desc: 'Blocks ad requests (fetch/XHR) and deletes ad units from the page. Toggles live, no reload.' },
    { section: 'Ad blocking', key: 'hideUpsells', label: 'YT Premium — hide upsells', desc: 'Premium promo banners and dialogs' },
    { section: 'Ad blocking', key: 'skipSponsors', label: 'YT Premium — sponsor chapters', desc: 'Jumps labelled sponsor segments' },
    { section: 'Player', key: 'autoMaxQuality', label: 'Max quality', desc: 'Always pick the highest available' },
    { section: 'Player', key: 'persistVolume', label: 'Persist volume', desc: 'Remember volume + mute across videos' },
    { section: 'Player', key: 'autoSkipEndscreen', label: 'Skip end screen', desc: 'Skip the last 20 seconds' },
    { section: 'Player', key: 'autoTheaterMode', label: 'Theater mode', desc: 'Auto-enable theater on watch pages' },
    { section: 'Interface', key: 'sidebarTweak', label: 'Sidebar & thumbs', desc: '600px watch sidebar, larger thumbnails' },
    { section: 'Interface', key: 'metadataFix', label: 'Original metadata', desc: 'Restore views • date spacing and sizing' },
    { section: 'Interface', key: 'hudVisible', label: 'Show HUD', desc: 'Ads Skipper stats panel' },
    { section: 'Interface', key: 'drag', label: 'Allow HUD drag', desc: 'Drag the HUD by its title' },
    { section: 'Interface', key: 'volumePopup', label: 'Volume popup', desc: 'On-screen volume readout' },
    { section: 'Toasts', key: 'removeToasts', label: 'Remove toasts', desc: '"Experiencing interruptions?" nag' },
    { section: 'Toasts', key: 'toastMode', label: 'Toast mode', desc: 'All toasts, or only the interruption nag', type: 'select',
      options: [['all', 'All toasts (original)'], ['interruption', 'Interruption only']] },
    { section: 'Navigation', key: 'channelsToVideos', label: 'Channels open Videos', desc: 'Skip channel home, go straight to Videos' },
    { section: 'Diagnostics', key: 'debug', label: 'Debug logging', desc: 'Console output for every module' },
  ];

  let panel = null;

  function applyControl(key) {
    switch (key) {
      case 'sidebarTweak': applyLayout(); break;
      case 'metadataFix': metadata.apply(); break;
      case 'blockAds':           // engine B: YT Premium (requests + DOM)
        if (CFG.blockAds) {
          safe('network shield', installNetShield);
          safe('ad sweeper', startAdSweeper);
        } else {
          safe('ad sweeper', stopAdSweeper);
          safe('network shield', uninstallNetShield);
          // sweep once more so nothing is left half-removed
          safe('ad sweeper', () => { adMute.releaseAll(); });
        }
        break;
      case 'skipperEnabled':     // engine A: YT Ads Skipper (player polling)
        if (CFG.skipperEnabled) safe('ad skipper', startAdSkipper);
        else safe('ad skipper', stopAdSkipper);
        render();
        break;
      case 'removeToasts':
        if (CFG.removeToasts) startToastNuker(); else stopToastNuker();
        break;
      case 'hudVisible':
        render();
        break;
      case 'hideUpsells':
        if (CFG.hideUpsells) addStyle('upsell', UPSELL_CSS); else removeStyle('upsell');
        break;
      default: break;
    }
  }

  function buildPanel() {
    if (panel) return panel;

    addStyle('panel', PANEL_CSS);

    panel = document.createElement('section');
    panel.id = 'os-panel';

    const h2 = document.createElement('h2');
    h2.appendChild(document.createTextNode('▶ '));
    const brand = document.createElement('span');
    brand.textContent = 'YouTube';
    h2.appendChild(brand);
    h2.appendChild(document.createTextNode(' OneSuite'));
    panel.appendChild(h2);

    const sub = document.createElement('div');
    sub.id = 'os-sub';
    sub.textContent = `v${VERSION} · six scripts in one · Alt+2 or Alt+1 to toggle`;
    panel.appendChild(sub);

    let lastSection = null;
    for (const def of CONTROLS) {
      if (def.section !== lastSection) {
        const header = document.createElement('div');
        header.className = 'os-section';
        header.textContent = def.section;
        panel.appendChild(header);
        lastSection = def.section;
      }

      const row = document.createElement('div');
      row.className = 'os-row';

      const label = document.createElement('div');
      label.className = 'os-label';
      label.appendChild(document.createTextNode(def.label));
      const hint = document.createElement('small');
      hint.textContent = def.desc;
      label.appendChild(hint);
      row.appendChild(label);

      if (def.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'os-select';
        sel.dataset.key = def.key;
        for (const [value, text] of def.options) {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = text;
          if (CFG[def.key] === value) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('change', () => {
          CFG[def.key] = sel.value;
          saveNow();
          applyControl(def.key);
        });
        row.appendChild(sel);
      } else {
        const wrap = document.createElement('label');
        wrap.className = 'os-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.key = def.key;
        input.checked = !!CFG[def.key];
        const slider = document.createElement('span');
        slider.className = 'os-slider';
        wrap.appendChild(input);
        wrap.appendChild(slider);
        input.addEventListener('change', () => {
          CFG[def.key] = input.checked;
          saveNow();
          applyControl(def.key);
        });
        row.appendChild(wrap);
      }

      panel.appendChild(row);
    }

    // --- footer actions ---------------------------------------------------
    const actions = document.createElement('div');
    actions.className = 'os-actions';

    const resetStats = document.createElement('button');
    resetStats.textContent = 'Reset stats';
    resetStats.onclick = () => {
      CFG.stats = { ads: 0, sponsors: 0, watch: 0 };
      render();
      saveNow();
    };

    const resetAll = document.createElement('button');
    resetAll.textContent = 'Reset all settings';
    resetAll.onclick = () => {
      if (!confirm('Reset every OneSuite setting to its default?')) return;
      const keep = { stats: CFG.stats };
      CFG = Object.assign({}, DEFAULTS, keep);
      saveNow();
      syncPanelControls();
      applyLayout();
      metadata.apply();
      applyControl('hideUpsells');
      applyControl('removeToasts');
      applyControl('blockAds');
      applyControl('skipperEnabled');
      render();
    };

    actions.appendChild(resetStats);
    actions.appendChild(resetAll);
    panel.appendChild(actions);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'os-close';
    closeBtn.textContent = 'Close  (Alt+2)';
    closeBtn.onclick = () => panel.classList.remove('visible');
    panel.appendChild(closeBtn);

    // close on outside click / Escape
    document.addEventListener('mousedown', (e) => {
      if (panel && panel.classList.contains('visible') && !panel.contains(e.target)) {
        panel.classList.remove('visible');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel && panel.classList.contains('visible')) {
        panel.classList.remove('visible');
      }
    });

    document.body.appendChild(panel);
    return panel;
  }

  function syncPanelControls() {
    if (!panel) return;
    panel.querySelectorAll('input[data-key]').forEach((input) => {
      input.checked = !!CFG[input.dataset.key];
    });
    panel.querySelectorAll('select[data-key]').forEach((sel) => {
      sel.value = CFG[sel.dataset.key];
    });
  }

  function togglePanel() {
    makeSureBody(() => {
      try {
        if (!buildPanel() || !panel) throw new Error('panel could not be created');
        const wasVisible = panel.classList.contains('visible');
        panel.classList.toggle('visible', !wasVisible);
        syncPanelControls();
      } catch (e) {
        warn('panel failed to open', e);
        showFallbackPanel();
      }
    });
  }

  // Last resort: a plain-text panel, so the settings are still reachable even
  // if the styled one cannot be built.
  function showFallbackPanel() {
    const existing = document.getElementById('os-fallback');
    if (existing) { existing.remove(); return; }

    const box = document.createElement('section');
    box.id = 'os-fallback';
    Object.assign(box.style, {
      position: 'fixed', top: '80px', left: '24px', zIndex: '2147483647',
      background: '#0f0f0f', color: '#fff', border: '1px solid #444',
      borderRadius: '10px', padding: '16px 18px', width: '320px',
      fontFamily: 'Roboto, sans-serif', fontSize: '13px',
    });

    const heading = document.createElement('div');
    heading.textContent = 'OneSuite — fallback panel (styled panel failed)';
    heading.style.cssText = 'font-weight:600;margin-bottom:10px;';
    box.appendChild(heading);

    for (const def of CONTROLS) {
      if (def.type === 'select') continue;
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;cursor:pointer;';
      const text = document.createElement('span');
      text.textContent = def.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!CFG[def.key];
      input.addEventListener('change', () => {
        CFG[def.key] = input.checked;
        saveNow();
        safe('apply ' + def.key, () => applyControl(def.key));
      });
      row.appendChild(text);
      row.appendChild(input);
      box.appendChild(row);
    }

    const note = document.createElement('div');
    note.textContent = 'Check the console for the error. Press Alt+2 or click here to close.';
    note.style.cssText = 'margin-top:10px;color:#999;font-size:11px;';
    box.appendChild(note);
    box.addEventListener('click', (e) => { if (e.target === box) box.remove(); });

    document.body.appendChild(box);
  }

  function makeSureBody(fn) {
    if (document.body) fn();
    else whenBodyReady(fn);
  }

  function showHint() {
    if (document.getElementById('os-hint')) return;
    const hint = document.createElement('div');
    hint.id = 'os-hint';
    hint.textContent = 'Alt+2  OneSuite';
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 5000);
  }

  /* ======================================================================
     §20  HIDE UPSELLS CSS
     ====================================================================== */

  const UPSELL_CSS = `
    ytd-mealbar-promo-renderer,
    ytd-banner-promo-renderer,
    #offer-module,
    .ytd-premium-yva-upsell-renderer,
    ytd-primetime-promo-renderer,
    .ytd-ypc-shelf-renderer,
    tp-yt-paper-dialog.ytd-mealbar-promo-renderer,
    #yt-masthead-premium,
    ytd-statement-banner-renderer { display: none !important; }

    ytd-rich-section-renderer:has(ytd-statement-banner-renderer) { display: none !important; }
    #secondary ytd-compact-promoted-item-renderer { display: none !important; }
    yt-upsell-dialog-renderer { display: none !important; }

    .ytd-sponsorships-tier-renderer .yt-icon[aria-label*="lock"],
    .badge-style-type-members-only { opacity: .4; }
  `;

  /* ======================================================================
     §21  MENU COMMANDS
     ====================================================================== */

  function registerMenus() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    try {
      GM_registerMenuCommand('OneSuite settings (Alt+2)', () => togglePanel());
      GM_registerMenuCommand('Show / hide HUD', () => {
        CFG.hudVisible = !CFG.hudVisible;
        render();
        saveNow();
      });
      GM_registerMenuCommand('Toggle debug logging', () => {
        CFG.debug = !CFG.debug;
        saveNow();
        console.log(LOG_PREFIX, 'debug', CFG.debug ? 'enabled' : 'disabled');
      });
    } catch (e) { log('menu registration failed', e); }
  }

  /* ======================================================================
     §22  BOOTSTRAP  (staged)
     ----------------------------------------------------------------------
     Stage 1 — document-start, synchronous: everything that must exist before
               YouTube's own code runs (fetch/XHR patch, style injection,
               link interception, toast observer).
     Stage 2 — body available: DOM observers, HUD, intervals, panel.
     ====================================================================== */

  // Every module is started through safe() so that one broken module can never
  // take the rest down with it — in particular the HUD, hotkeys and settings
  // panel, which used to be last in line and therefore died whenever anything
  // above them threw.
  const failures = [];

  function safe(label, fn) {
    try {
      fn();
      return true;
    } catch (e) {
      failures.push(label);
      warn('module failed: ' + label, e);
      return false;
    }
  }

  function stageOne() {
    safe('config', () => {
      loadConfig();
      log('v' + VERSION, 'config', CFG);
    });

    // Hotkeys are bound at document-start: they only touch CFG and the DOM on
    // demand, so they cannot be lost to a later module failing.
    safe('hotkeys', bindHotkeys);

    safe('navigation hook', bindNavigation);

    // Engine B (YT Premium) part 1: must be installed before any network activity
    if (CFG.blockAds) safe('network shield', installNetShield);

    if (CFG.hideUpsells) safe('upsell css', () => addStyle('upsell', UPSELL_CSS));
    if (CFG.removeToasts) safe('toast nuker', startToastNuker);

    // CSS-only modules can inject immediately (they fall back to <html> when
    // <head> does not exist yet)
    safe('layout', startLayout);
    safe('metadata styles', () => metadata.apply());

    // click-level interception, plus redirect when landing on a channel home
    safe('channels -> videos', startChannelsToVideos);

    safe('menu commands', registerMenus);

    safe('initial save', saveNow);
  }

  function stageTwo() {
    // Engine B (YT Premium) part 2: DOM-level ad removal
    if (CFG.blockAds) safe('ad sweeper', startAdSweeper);

    // Engine A (YT Ads Skipper): HUD + counters + player polling
    safe('hud', buildHud);
    if (CFG.skipperEnabled) safe('ad skipper', startAdSkipper);
    safe('watch timer', startWatchTimer);

    // Premium player features
    safe('quality', startQuality);
    safe('volume', startVolumePersistence);
    safe('theater', startTheater);
    safe('end screen', startEndscreenSkip);
    safe('sponsors', startSponsorSkip);

    // Metadata layout observer (needs body)
    safe('metadata observer', () => metadata.start());

    // Panel is built lazily on first Alt+2; the hint is just a reminder.
    safe('hint', () => makeSureBody(showHint));

    // persist counters/stats when the page goes away
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });

    if (failures.length) {
      warn('boot finished with failures: ' + failures.join(', '));
    } else {
      console.info(LOG_PREFIX, 'ready v' + VERSION + ' — all modules started');
    }
  }

  // Run stage one immediately (we are at document-start).
  safe('stage one', stageOne);

  whenBodyReady(() => safe('stage two', stageTwo));

  // Escape hatch for debugging: `__oneSuite.failures` in the console.
  try {
    Object.defineProperty(window, '__oneSuite', {
      value: { version: VERSION, get config() { return CFG; }, failures, openPanel: () => togglePanel() },
      configurable: true,
    });
  } catch (e) { /* ignore */ }
})();

