// ==UserScript==
// @name         YouTube Speed Control++ v10
// @namespace    https://github.com/BlackSkuII
// @version      10.3
// @description  Keeps speed between video/channel routes and resets it on other YouTube pages
// @author       BlackSkuII + Arena.ai
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @match        https://youtube-nocookie.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Youtube/YouTube-Speed-Control.user.js
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Youtube/YouTube-Speed-Control.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* ===================== CONFIG ===================== */
    const CONFIG = {
        // Order is intentional: comma and period move through this list as written.
        speeds: [4, 0.5, 0.75, 1.5, 1.75, 1, 2, 3],
        defaultSpeed: 1,
        checkInterval: 100,
        pageCheckInterval: 1000,
        highlightColor: '#9b59b6',
        leftClickHoldDuration: 500,
        spacebarHoldDuration: 500,
        disableVideoContextMenu: true,
    };

    /* ===================== STATE ===================== */
    const state = {
        storedSpeed: CONFIG.defaultSpeed,
        currentSpeed: CONFIG.defaultSpeed,
        isPlayerPage: false,
        pageKey: '',
        routeKey: '',
        spacebarHeld: false,
        mouseHeld: false,
        activeBoosts: { space: null, mouse: null },
        video: null,
        controlsEnabled: false,
        speedCheckInterval: null,
        pageCheckInterval: null,
        syncTimer: null,
        observer: null,
        leftClickTimer: null,
        spacebarTimer: null,
        speedOptionsContainer: null,
        speedOptionsElements: [],
    };

    /* ===================== HELPERS ===================== */
    function isEditable(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function isEditableTarget(event) {
        return isEditable(event.target) || isEditable(document.activeElement);
    }

    function getRouteType() {
        const host = location.hostname;
        const pathname = location.pathname.replace(/\/+$/, '') || '/';
        const supportedHost = [
            'youtube.com',
            'www.youtube.com',
            'youtube-nocookie.com',
            'www.youtube-nocookie.com',
        ].includes(host);

        if (!supportedHost) return 'other';
        if (pathname === '/watch') return 'watch';
        if (pathname.startsWith('/embed/')) return 'embed';
        if (pathname === '/') return 'home';
        if (pathname === '/results') return 'search';
        if (
            pathname.startsWith('/@') ||
            ['/channel/', '/c/', '/user/'].some(prefix => pathname.startsWith(prefix))
        ) return 'channel';
        return 'other';
    }

    function getNavigationKey(routeType) {
        const url = new URL(location.href);
        const pathname = url.pathname.replace(/\/+$/, '') || '/';

        if (routeType === 'watch' && pathname === '/watch') {
            return `${url.hostname}/watch:${url.searchParams.get('v') || ''}`;
        }
        if (routeType === 'search') {
            return `${url.hostname}/results:${url.searchParams.get('search_query') || ''}`;
        }
        return `${url.hostname}:${pathname}`;
    }

    function getPageKey() {
        const url = new URL(location.href);
        const pathname = url.pathname.replace(/\/+$/, '') || '/';

        if (pathname === '/watch') {
            return `${url.hostname}/watch:${url.searchParams.get('v') || ''}`;
        }
        return `${url.hostname}:${pathname}`;
    }

    function findVideo() {
        const player = document.querySelector('#movie_player');
        return player?.querySelector('video.html5-main-video, video') ||
            document.querySelector('video.html5-main-video') ||
            document.querySelector('video');
    }

    function normalizeSpeed(value) {
        const numeric = Number(value);
        const match = CONFIG.speeds.find(speed => Math.abs(speed - numeric) < 0.001);
        return match ?? CONFIG.defaultSpeed;
    }

    function persistSpeed(speed) {
        try {
            const result = GM.setValue('yt_speed', speed);
            if (result && typeof result.catch === 'function') {
                result.catch(error => console.warn('[YT Speed Control++] Could not save speed:', error));
            }
        } catch (error) {
            console.warn('[YT Speed Control++] Could not save speed:', error);
        }
    }

    /* ================== DURATION DISPLAY ================== */
    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '';
        seconds = Math.round(seconds);

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
        }
        return `${minutes}:${String(remainder).padStart(2, '0')}`;
    }

    function updateAdjustedDuration() {
        const player = document.querySelector('#movie_player');
        const durationEl = player?.querySelector('.ytp-time-duration');
        const video = state.video;
        if (!player) return;

        let adjusted = player.querySelector('.ytp-time-duration-adjusted');
        if (!durationEl || !video || !Number.isFinite(video.duration) || video.duration <= 0) {
            if (adjusted && adjusted.textContent) adjusted.textContent = '';
            return;
        }

        if (!adjusted) {
            adjusted = document.createElement('span');
            adjusted.className = 'ytp-time-duration-adjusted';
            adjusted.style.color = '#ccc';
            adjusted.style.marginLeft = '2px';
        }

        // YouTube can replace its time display during SPA navigation.
        if (adjusted.previousElementSibling !== durationEl) {
            durationEl.insertAdjacentElement('afterend', adjusted);
        }

        const text = Math.abs(state.currentSpeed - 1) < 0.01
            ? ''
            : ` (${formatTime(video.duration / state.currentSpeed)})`;
        if (adjusted.textContent !== text) adjusted.textContent = text;
    }

    function removeAdjustedDuration() {
        document.querySelectorAll('.ytp-time-duration-adjusted').forEach(el => el.remove());
    }

    /* ===================== SPEED LOGIC ===================== */
    function getEffectiveSpeed() {
        const boosts = Object.values(state.activeBoosts).filter(Number.isFinite);
        return boosts.length ? Math.max(...boosts) : state.storedSpeed;
    }

    function updateSpeedmasterOverlay() {
        // Only replace YouTube's built-in "2x" label once our spacebar boost is active.
        if (!state.isPlayerPage || !state.spacebarHeld || state.activeBoosts.space === null) return;

        const label = document.querySelector(
            '#movie_player .ytp-speedmaster-overlay .ytp-speedmaster-label'
        ) || document.querySelector('.ytp-speedmaster-overlay .ytp-speedmaster-label');
        if (!label) return;

        const text = `${getEffectiveSpeed()}x`;
        if (label.textContent.trim() !== text) label.textContent = text;
    }

    function applyEffectiveSpeed() {
        const targetSpeed = getEffectiveSpeed();
        if (state.video && state.isPlayerPage && Math.abs(state.video.playbackRate - targetSpeed) > 0.01) {
            try {
                state.video.playbackRate = targetSpeed;
            } catch (error) {
                console.warn('[YT Speed Control++] Could not set playback rate:', error);
            }
        }

        state.currentSpeed = targetSpeed;
        updateHighlight();
        updateAdjustedDuration();
        updateSpeedmasterOverlay();
    }

    function setSpeed(speed) {
        if (!CONFIG.speeds.some(allowed => Math.abs(allowed - speed) < 0.001)) return;

        state.storedSpeed = speed;
        persistSpeed(speed);
        applyEffectiveSpeed();
    }

    function enforceSpeed() {
        if (!state.isPlayerPage) return;

        const video = findVideo();
        if (video !== state.video) attachVideo(video);
        if (!state.video) return;

        const targetSpeed = getEffectiveSpeed();
        if (Math.abs(state.video.playbackRate - targetSpeed) > 0.01) {
            try {
                state.video.playbackRate = targetSpeed;
            } catch (error) {
                console.warn('[YT Speed Control++] Could not enforce playback rate:', error);
            }
        }

        state.currentSpeed = targetSpeed;
        updateHighlight();
        updateAdjustedDuration();
        updateSpeedmasterOverlay();
    }

    function stepSpeed(direction) {
        const index = CONFIG.speeds.findIndex(speed => Math.abs(speed - state.storedSpeed) < 0.001);
        if (index === -1) return;

        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= CONFIG.speeds.length) return;
        setSpeed(CONFIG.speeds[nextIndex]);
    }

    /* ===================== TEMPORARY BOOSTS ===================== */
    function spacebarBoost() {
        state.spacebarTimer = null;
        if (!state.spacebarHeld || !state.isPlayerPage) return;

        const baseSpeed = getEffectiveSpeed();
        const boost = baseSpeed < 2
            ? 2
            : Math.abs(baseSpeed - 2) < 0.01
                ? 3
                : 4;

        state.activeBoosts.space = boost;
        applyEffectiveSpeed();
    }

    function onKeyDown(event) {
        if (!state.isPlayerPage || isEditableTarget(event)) return;

        if (event.key === ',') {
            event.preventDefault();
            stepSpeed(-1);
            return;
        }

        if (event.key === '.') {
            event.preventDefault();
            stepSpeed(1);
            return;
        }

        const isSpace = event.code === 'Space' || event.key === ' ';
        if (!isSpace || state.spacebarHeld) return;

        state.spacebarHeld = true;
        state.spacebarTimer = setTimeout(spacebarBoost, CONFIG.spacebarHoldDuration);
    }

    function onKeyUp(event) {
        const isSpace = event.code === 'Space' || event.key === ' ';
        if (!isSpace || !state.spacebarHeld) return;

        clearTimeout(state.spacebarTimer);
        state.spacebarTimer = null;
        state.spacebarHeld = false;
        state.activeBoosts.space = null;
        applyEffectiveSpeed();
    }

    function onMouseDown(event) {
        if (!state.isPlayerPage || event.button !== 0 || state.mouseHeld) return;

        state.mouseHeld = true;
        state.leftClickTimer = setTimeout(() => {
            state.leftClickTimer = null;
            if (!state.mouseHeld || !state.isPlayerPage) return;
            state.activeBoosts.mouse = 2;
            applyEffectiveSpeed();
        }, CONFIG.leftClickHoldDuration);
    }

    function onMouseUp(event) {
        if (event.button !== 0 || !state.mouseHeld) return;

        clearTimeout(state.leftClickTimer);
        state.leftClickTimer = null;
        state.mouseHeld = false;
        state.activeBoosts.mouse = null;
        applyEffectiveSpeed();
    }

    function cancelAllHolds() {
        clearTimeout(state.leftClickTimer);
        clearTimeout(state.spacebarTimer);
        state.leftClickTimer = null;
        state.spacebarTimer = null;
        state.mouseHeld = false;
        state.spacebarHeld = false;
        state.activeBoosts.mouse = null;
        state.activeBoosts.space = null;
        applyEffectiveSpeed();
    }

    function onWindowBlur() {
        cancelAllHolds();
    }

    function onContextMenu(event) {
        if (CONFIG.disableVideoContextMenu) event.preventDefault();
    }

    /* ===================== VIDEO / PAGE LIFECYCLE ===================== */
    function attachVideo(video) {
        if (video === state.video) return;

        if (state.video) {
            state.video.removeEventListener('mousedown', onMouseDown);
            state.video.removeEventListener('contextmenu', onContextMenu);
        }

        state.video = video || null;
        if (!state.video) return;

        state.video.addEventListener('mousedown', onMouseDown);
        if (CONFIG.disableVideoContextMenu) {
            state.video.addEventListener('contextmenu', onContextMenu);
        }
        applyEffectiveSpeed();
    }

    function enableControls() {
        if (state.controlsEnabled) return;
        state.controlsEnabled = true;

        // Capture phase ensures comma/period are handled before YouTube's shortcuts.
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keyup', onKeyUp, true);
        // Catch release even if the pointer is no longer over the video.
        window.addEventListener('mouseup', onMouseUp, true);
        window.addEventListener('blur', onWindowBlur);
    }

    function disableControls() {
        if (!state.controlsEnabled) return;
        state.controlsEnabled = false;

        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('mouseup', onMouseUp, true);
        window.removeEventListener('blur', onWindowBlur);
    }

    function resetSpeedToDefault() {
        clearTimeout(state.leftClickTimer);
        clearTimeout(state.spacebarTimer);
        state.leftClickTimer = null;
        state.spacebarTimer = null;
        state.mouseHeld = false;
        state.spacebarHeld = false;
        state.activeBoosts.mouse = null;
        state.activeBoosts.space = null;

        state.storedSpeed = CONFIG.defaultSpeed;
        persistSpeed(CONFIG.defaultSpeed);

        if (state.video) {
            try {
                state.video.playbackRate = CONFIG.defaultSpeed;
            } catch (error) {
                console.warn('[YT Speed Control++] Could not reset playback rate:', error);
            }
        }

        state.currentSpeed = CONFIG.defaultSpeed;
        updateHighlight();
        updateAdjustedDuration();
    }

    function removeSpeedUI() {
        if (state.speedOptionsContainer) state.speedOptionsContainer.remove();
        removeAdjustedDuration();
    }

    function syncPageAndVideo() {
        const routeType = getRouteType();
        const nextRouteKey = getNavigationKey(routeType);
        const routeChanged = nextRouteKey !== state.routeKey;

        if (routeChanged) {
            state.routeKey = nextRouteKey;

            // Retain the speed only on watch-to-watch and watch-to-channel routes.
            // Reset it on the home, search, embed, and other destinations.
            if (routeType !== 'watch' && routeType !== 'channel') {
                resetSpeedToDefault();
            }
        }

        const nextIsPlayerPage = routeType === 'watch' || routeType === 'embed';
        const nextPageKey = nextIsPlayerPage ? getPageKey() : '';
        const pageChanged = nextIsPlayerPage !== state.isPlayerPage ||
            (nextIsPlayerPage && nextPageKey !== state.pageKey);

        if (pageChanged) {
            const wasPlayerPage = state.isPlayerPage;

            if (wasPlayerPage) {
                cancelAllHolds();
                attachVideo(null);

                if (!nextIsPlayerPage) {
                    disableControls();
                    removeSpeedUI();
                }
            }

            state.isPlayerPage = nextIsPlayerPage;
            state.pageKey = nextPageKey;

            if (nextIsPlayerPage) {
                if (!wasPlayerPage) enableControls();
                attachVideo(findVideo());
                applyEffectiveSpeed();
                insertSpeedUI();
            }
        }

        if (!nextIsPlayerPage) return;

        const currentVideo = findVideo();
        if (currentVideo !== state.video) attachVideo(currentVideo);
        insertSpeedUI();
        updateAdjustedDuration();
        updateSpeedmasterOverlay();
    }

    function scheduleSync() {
        if (state.syncTimer !== null) return;
        state.syncTimer = setTimeout(() => {
            state.syncTimer = null;
            syncPageAndVideo();
        }, 100);
    }

    /* ===================== UI ===================== */
    function createSpeedUI() {
        const container = document.createElement('div');
        container.className = 'yt-speed-control-plus';
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', 'Playback speed');
        Object.assign(container.style, {
            display: 'flex',
            gap: '5px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '20px',
            padding: '5px',
            height: '30px',
            marginTop: '8px',
            zIndex: '9999',
            alignItems: 'center',
        });

        CONFIG.speeds.forEach(speed => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${speed}x`;
            button.title = `Set playback speed to ${speed}x`;
            button.setAttribute('aria-pressed', 'false');
            Object.assign(button.style, {
                appearance: 'none',
                border: '0',
                background: 'transparent',
                color: '#888',
                padding: '1px 8px',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: '1.2',
                textShadow: '0 0 4px rgba(255,255,255,0.2)',
            });

            button.addEventListener('click', () => setSpeed(speed));
            container.appendChild(button);
            state.speedOptionsElements.push({ speed, element: button });
        });

        return container;
    }

    function insertSpeedUI() {
        if (!state.isPlayerPage) return;

        const controls = document.querySelector('#movie_player .ytp-right-controls');
        if (!controls || !controls.parentNode) return;

        if (!state.speedOptionsContainer) {
            state.speedOptionsContainer = createSpeedUI();
        }

        if (!controls.parentNode.contains(state.speedOptionsContainer)) {
            controls.parentNode.insertBefore(state.speedOptionsContainer, controls);
        }

        updateHighlight();
        updateAdjustedDuration();
    }

    function updateHighlight() {
        state.speedOptionsElements.forEach(({ speed, element }) => {
            const active = Math.abs(speed - state.currentSpeed) < 0.01;
            element.style.color = active ? CONFIG.highlightColor : 'white';
            element.style.fontWeight = active ? 'bold' : 'normal';
            element.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    /* ===================== INIT ===================== */
    async function init() {
        try {
            const savedSpeed = await GM.getValue('yt_speed', CONFIG.defaultSpeed);
            state.storedSpeed = normalizeSpeed(savedSpeed);
        } catch (error) {
            console.warn('[YT Speed Control++] Could not load saved speed:', error);
            state.storedSpeed = CONFIG.defaultSpeed;
        }
        state.currentSpeed = state.storedSpeed;

        state.observer = new MutationObserver(scheduleSync);
        state.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        document.addEventListener('yt-navigate-finish', scheduleSync);
        document.addEventListener('yt-page-data-updated', scheduleSync);
        window.addEventListener('popstate', scheduleSync);

        syncPageAndVideo();
        state.pageCheckInterval = setInterval(syncPageAndVideo, CONFIG.pageCheckInterval);
        state.speedCheckInterval = setInterval(enforceSpeed, CONFIG.checkInterval);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
