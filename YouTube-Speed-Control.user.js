// ==UserScript==
// @name         ✔ YouTube Speed Control++ V7
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Advanced YouTube speed control with persistent settings and custom speed order
// @author       Your Name
// @match        https://www.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @updateURL    
// @downloadURL  
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(function () {
    'use strict';

    /* ===================== CONFIG ===================== */
    const CONFIG = {
        speeds: [0.5, 0.75, 1.5, 1.75, 1, 2, 2.25, 2.5, 2.75, 3], // ANY ORDER SUPPORTED
        defaultSpeed: 1,
        checkInterval: 100,
        highlightColor: '#9b59b6',
        leftClickHoldDuration: 500,
        spacebarHoldDuration: 500,
        resetSpeedOnLeave: true,
    };

    /* ===================== STATE ===================== */
    const state = {
        storedSpeed: CONFIG.defaultSpeed,
        currentSpeed: CONFIG.defaultSpeed,
        isWatchPage: false,
        isSpacebarHeld: false,
        isLeftClickHeld: false,
        player: null,
        speedCheckInterval: null,
        leftClickTimer: null,
        spacebarTimer: null,
        speedOptionsContainer: null,
        speedOptionsElements: [],
    };

    /* ===================== HELPERS ===================== */
    const videoEl = () => document.querySelector('video');
    const playerEl = () =>
        document.querySelector('.html5-main-video') || videoEl();

    const isEditable = el =>
        ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;

    /* ===================== INIT ===================== */
    async function init() {
        state.storedSpeed = await GM.getValue('yt_speed', CONFIG.defaultSpeed);
        state.currentSpeed = state.storedSpeed;

        detectWatchPage();
        setInterval(detectWatchPage, 1000);

        observeDOM();
        insertSpeedUI();
        startSpeedEnforcement();
    }

    /* ===================== PAGE DETECTION ===================== */
    function detectWatchPage() {
        const now = location.href.includes('youtube.com/watch');
        if (now !== state.isWatchPage) {
            state.isWatchPage = now;
            handlePageChange();
        }
    }

    function handlePageChange() {
        if (state.isWatchPage) {
            state.player = playerEl();
            applyStoredSpeed();
            enableControls();
            setTimeout(insertSpeedUI, 1000);
        } else {
            disableControls();
            resetSpeedIfNeeded();
        }
    }

    /* ===================== SPEED LOGIC ===================== */
    function applyStoredSpeed() {
        if (!state.player) return;
        state.player.playbackRate = state.storedSpeed;
        state.currentSpeed = state.storedSpeed;
        updateHighlight();
    }

    function setSpeed(speed) {
        state.storedSpeed = speed;
        GM.setValue('yt_speed', speed);

        if (!state.isSpacebarHeld && !state.isLeftClickHeld && state.player) {
            state.player.playbackRate = speed;
        }

        state.currentSpeed = speed;
        updateHighlight();
    }

    function enforceSpeed() {
        if (
            !state.isWatchPage ||
            state.isSpacebarHeld ||
            state.isLeftClickHeld ||
            !state.player
        ) return;

        const v = videoEl();
        if (!v) return;

        if (Math.abs(v.playbackRate - state.storedSpeed) > 0.01) {
            v.playbackRate = state.storedSpeed;
            state.currentSpeed = state.storedSpeed;
            updateHighlight();
        }
    }

    function startSpeedEnforcement() {
        stopSpeedEnforcement();
        state.speedCheckInterval = setInterval(
            enforceSpeed,
            CONFIG.checkInterval
        );
    }

    function stopSpeedEnforcement() {
        clearInterval(state.speedCheckInterval);
    }

    /* ===================== ORDER-PRESERVING STEP ===================== */
    function stepSpeed(direction) {
        const idx = CONFIG.speeds.indexOf(state.currentSpeed);
        if (idx === -1) return;

        const nextIndex = idx + direction;
        if (nextIndex < 0 || nextIndex >= CONFIG.speeds.length) return;

        setSpeed(CONFIG.speeds[nextIndex]);
    }

    /* ===================== UI ===================== */
    function createSpeedUI() {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            gap: '5px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '20px',
            padding: '5px',
            height: '35px',
            marginTop: '12px',
            zIndex: '9999',
        });

        CONFIG.speeds.forEach(speed => {
            const el = document.createElement('div');
            el.textContent = `${speed}x`;
            Object.assign(el.style, {
                color: '#888',
                padding: '1px 8px',
                cursor: 'pointer',
                fontSize: '14px',
                textShadow: '0 0 4px rgba(255,255,255,0.2)',
                marginTop: '-18px',
            });

            el.addEventListener('click', () => setSpeed(speed));
            container.appendChild(el);
            state.speedOptionsElements.push(el);
        });

        return container;
    }

    function insertSpeedUI() {
        if (!state.isWatchPage) return;

        const controls = document.querySelector(
            '#movie_player .ytp-right-controls'
        );
        if (!controls) return;

        if (!state.speedOptionsContainer) {
            state.speedOptionsContainer = createSpeedUI();
        }

        if (!controls.parentNode.contains(state.speedOptionsContainer)) {
            controls.parentNode.insertBefore(
                state.speedOptionsContainer,
                controls
            );
            updateHighlight();
        }
    }

    function updateHighlight() {
        state.speedOptionsElements.forEach((el, i) => {
            const active =
                Math.abs(CONFIG.speeds[i] - state.currentSpeed) < 0.01;
            el.style.color = active ? CONFIG.highlightColor : 'white';
            el.style.fontWeight = active ? 'bold' : 'normal';
        });
    }

    /* ===================== KEYBOARD ===================== */
    function onKeyDown(e) {
        if (!state.isWatchPage || isEditable(document.activeElement)) return;

        if (e.key === ',') {
            e.preventDefault();
            stepSpeed(-1);
        }

        if (e.key === '.') {
            e.preventDefault();
            stepSpeed(1);
        }

        if (e.key === ' ' && !state.isSpacebarHeld) {
            state.isSpacebarHeld = true;
            state.spacebarTimer = setTimeout(spacebarBoost, CONFIG.spacebarHoldDuration);
        }
    }

    function onKeyUp(e) {
        if (e.key !== ' ') return;
        clearTimeout(state.spacebarTimer);
        state.isSpacebarHeld = false;
        restoreSpeed();
    }

    function spacebarBoost() {
        if (!state.player) return;

        stopSpeedEnforcement();

        let boost =
            state.currentSpeed < 2 ? 2 :
            state.currentSpeed === 2 ? 3 : 4;

        state.player.playbackRate = boost;
        state.currentSpeed = boost;
        updateHighlight();
    }

    /* ===================== MOUSE ===================== */
    function onMouseDown(e) {
        if (e.button !== 0 || !state.player) return;

        state.leftClickTimer = setTimeout(() => {
            state.isLeftClickHeld = true;
            stopSpeedEnforcement();
            state.player.playbackRate = 2;
            state.currentSpeed = 2;
            updateHighlight();
        }, CONFIG.leftClickHoldDuration);
    }

    function onMouseUp(e) {
        if (e.button !== 0) return;

        clearTimeout(state.leftClickTimer);
        if (state.isLeftClickHeld) {
            state.isLeftClickHeld = false;
            restoreSpeed();
        }
    }

    function restoreSpeed() {
        if (!state.player) return;
        state.player.playbackRate = state.storedSpeed;
        state.currentSpeed = state.storedSpeed;
        updateHighlight();
        setTimeout(startSpeedEnforcement, 100);
    }

    /* ===================== CONTROL TOGGLING ===================== */
    function enableControls() {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        const v = videoEl();
        if (v) {
            v.addEventListener('mousedown', onMouseDown);
            v.addEventListener('mouseup', onMouseUp);
            v.addEventListener('contextmenu', e => e.preventDefault());
        }
    }

    function disableControls() {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
    }

    function resetSpeedIfNeeded() {
        if (!CONFIG.resetSpeedOnLeave || !state.player) return;
        state.player.playbackRate = 1;
        state.currentSpeed = 1;
        state.storedSpeed = 1;
        GM.setValue('yt_speed', 1);
    }

    /* ===================== OBSERVER ===================== */
    function observeDOM() {
        new MutationObserver(insertSpeedUI).observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /* ===================== START ===================== */
    document.readyState === 'complete'
        ? init()
        : window.addEventListener('load', init);

})();
