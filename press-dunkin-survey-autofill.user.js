// ==UserScript==
// @name         Dunkin' Survey: Auto-Fill Code via Keypresses
// @namespace    https://github.com/BlackSkuII/Userscripts-JSON-
// @version      3.0.0
// @description  Reads the ?code= parameter from the URL, clicks the survey code container, types the code key-by-key, then clicks the Begin Survey button. Only runs when the URL contains the Dunkin survey code pattern. Works on iOS Safari with Tampermonkey or Stay.
// @author       Me + Agent
// @match        https://dunkinrunsonyou.com/*
// @match        https://survey3.medallia.com/*
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/press-dunkin-survey-autofill.user.js
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/press-dunkin-survey-autofill.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const TARGET_URL_PREFIX = 'https://dunkinrunsonyou.com/?dunkin-dd-live/&code=';
    const CONTAINER_CLASS_1 = 'textField_textfieldContainer';
    const CONTAINER_CLASS_2 = 'layout_answer';
    const INPUT_ID = 'spl_q_inrest_rcpt_code_txt';
    const BEGIN_BUTTON_ID = 'buttonBegin';
    const KEY_DELAY_MS = 10;        // delay between simulated keystrokes
    const POST_TYPE_DELAY_MS = 250;  // wait after typing before clicking Begin
    const MAX_WAIT_MS = 60000;       // stop polling after 60 seconds
    const POLL_MS = 300;             // check every 300 ms

    // ------------------------------------------------------------------
    // Guard: only run when the URL contains the Dunkin survey code pattern.
    // This is a runtime check (not in @match metadata) so more site
    // functions can be added later under the same broad @match.
    // ------------------------------------------------------------------
    function isTargetUrl() {
        return window.location.href.includes(TARGET_URL_PREFIX);
    }

    // ------------------------------------------------------------------
    // Extract the survey code from the ?code= URL parameter
    // Example: https://dunkinrunsonyou.com/?dunkin-dd-live/&code=12345-12345-1234-1234
    // ------------------------------------------------------------------
    function getCodeFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('code');
        } catch (err) {
            console.error('[DunkinAutoFill] Failed to read URL:', err);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // Find the survey-code container by matching both required classes,
    // regardless of any extra classes (like isFocused) that may be present.
    // ------------------------------------------------------------------
    function findContainer() {
        const containers = document.querySelectorAll('div');
        for (let i = 0; i < containers.length; i++) {
            const el = containers[i];
            const cls = el.className || '';
            if (cls.includes(CONTAINER_CLASS_1) && cls.includes(CONTAINER_CLASS_2)) {
                return el;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Find the text input inside the container, or fall back to the known ID.
    // ------------------------------------------------------------------
    function findInput(container) {
        if (container) {
            const input = container.querySelector('input[type="text"]');
            if (input) return input;
        }
        return document.getElementById(INPUT_ID);
    }

    // ------------------------------------------------------------------
    // Find the Begin Survey button.
    // ------------------------------------------------------------------
    function findBeginButton() {
        return document.getElementById(BEGIN_BUTTON_ID);
    }

    // ------------------------------------------------------------------
    // Sleep helper for pacing keystrokes and delays
    // ------------------------------------------------------------------
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ------------------------------------------------------------------
    // Get keyboard event details for a character
    // ------------------------------------------------------------------
    function keyDetails(char) {
        if (char === '-') {
            return { key: '-', code: 'Minus', keyCode: 189, which: 189 };
        }
        const codePoint = char.charCodeAt(0);
        return { key: char, code: 'Digit' + char, keyCode: codePoint, which: codePoint };
    }

    // ------------------------------------------------------------------
    // Simulate typing the code character by character into the input
    // ------------------------------------------------------------------
    async function typeCodeCharacterByCharacter(input, code) {
        // Clear any existing value
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const details = keyDetails(char);

            // keydown
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: details.key,
                code: details.code,
                keyCode: details.keyCode,
                which: details.which,
                bubbles: true,
                cancelable: true
            }));

            // Append the character to the value
            input.value += char;

            // input event (notifies React/Preact and Inputmask)
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // keyup
            input.dispatchEvent(new KeyboardEvent('keyup', {
                key: details.key,
                code: details.code,
                keyCode: details.keyCode,
                which: details.which,
                bubbles: true,
                cancelable: true
            }));

            // Pace the keystrokes so the inputmask / survey engine can keep up
            await sleep(KEY_DELAY_MS);
        }

        // Final change event to commit the value
        input.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[DunkinAutoFill] Finished typing survey code:', code);
    }

    // ------------------------------------------------------------------
    // Click the container div so it gains the isFocused class.
    // On iOS, a plain .click() on a div can be unreliable, so we also
    // dispatch mouse events manually as a fallback.
    // ------------------------------------------------------------------
    function focusContainer(container) {
        if (!container) return;

        container.click();

        setTimeout(function() {
            container.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, cancelable: true, view: window
            }));
            container.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true, view: window
            }));
            container.dispatchEvent(new MouseEvent('click', {
                bubbles: true, cancelable: true, view: window
            }));
        }, 50);
    }

    // ------------------------------------------------------------------
    // Click the Begin Survey button.
    // On iOS, a plain .click() can be unreliable, so we also dispatch
    // mouse events manually as a fallback.
    // ------------------------------------------------------------------
    function clickBeginButton(button) {
        if (!button) return;

        button.click();

        setTimeout(function() {
            button.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, cancelable: true, view: window
            }));
            button.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true, view: window
            }));
            button.dispatchEvent(new MouseEvent('click', {
                bubbles: true, cancelable: true, view: window
            }));
        }, 50);
    }

    // ------------------------------------------------------------------
    // Try to fill the code by typing keys, then click Begin Survey.
    // Returns true if successful.
    // ------------------------------------------------------------------
    async function tryFill(code) {
        const container = findContainer();
        if (!container) return false;

        const input = findInput(container);
        if (!input) return false;

        // Click container to add isFocused class
        focusContainer(container);

        // Click and focus the actual text box
        input.click();
        input.focus();

        // Type the code character by character
        await typeCodeCharacterByCharacter(input, code);

        // Brief pause to let the survey engine register the final value
        await sleep(POST_TYPE_DELAY_MS);

        // Click the Begin Survey button to submit the page
        const beginButton = findBeginButton();
        if (beginButton) {
            clickBeginButton(beginButton);
            console.log('[DunkinAutoFill] Begin Survey button clicked.');
        } else {
            console.warn('[DunkinAutoFill] Begin Survey button not found after typing code.');
        }

        return true;
    }

    // ------------------------------------------------------------------
    // Poll until the survey code container appears, then fill it.
    // ------------------------------------------------------------------
    async function start(code) {
        if (!code) {
            console.log('[DunkinAutoFill] No "code" parameter found in URL.');
            return;
        }

        console.log('[DunkinAutoFill] Code found in URL. Waiting for survey container...');

        const deadline = Date.now() + MAX_WAIT_MS;

        async function poll() {
            const success = await tryFill(code);
            if (success) {
                return; // done
            }
            if (Date.now() < deadline) {
                await sleep(POLL_MS);
                await poll();
            } else {
                console.error('[DunkinAutoFill] Timed out waiting for the survey code container.');
            }
        }

        await poll();
    }

    // Launch — only if the URL matches the Dunkin survey code pattern
    if (isTargetUrl()) {
        start(getCodeFromUrl());
    } else {
        console.log('[DunkinAutoFill] URL does not match the Dunkin survey code pattern. Script not running.');
    }
})();
