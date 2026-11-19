// ==UserScript==
// @name         Dunkin' Survey: Auto-Fill Code + Answers via Keypresses
// @namespace    http://tampermonkey.net/
// @version      9.0.0
// @description  (1) Reads the ?code= parameter from the URL, clicks the survey code container, types the code key-by-key, then clicks Begin Survey. (2) ONLY on the first survey question page ("Survey 10% complete", progress bar aria-valuenow="10") selects the owner's genuine answers: onf_q_inrest_recommend_ltr_11 (10 – Extremely Likely) and onf_q_inrest_recent_experience_osat_5 (5 – Extremely Satisfied), then automatically presses Next. (3) ONLY on the second survey question page ("Survey 20% complete", progress bar aria-valuenow="20") selects the owner's genuine answers (taste 4, speed 4, friendliness 5, appearance 5, warm greeting Yes, eye contact Yes, feel valued Yes, sincere goodbye "can't remember", order accurate Yes, problem during visit No), then automatically presses Next. (4) ONLY on the coupon page ("Survey 80% complete", progress bar aria-valuenow="80") fills the owner's own email address for the free-donut coupon, selects onf_q_inrest_rcpt_additional_questions_alt_2 ("No, I would like to submit the survey"), then automatically presses Next to submit. Never touches anything on other pages. Works on iOS Safari with Tampermonkey or Stay.
// @author       Agent
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
    const PAGE3_EMAIL_VALUE = 'hazim.a.khan2005@gmail.com';


    const TARGET_URL_PREFIX = 'https://dunkinrunsonyou.com/?dunkin-dd-live/&code=';
    const QUESTION_PAGE_MARKER = 'feedless-dunkin-dd-live';
    const RECOMMEND_INPUT_ID = 'onf_q_inrest_recommend_ltr_' + randomInt(8, 11);            // recommend — random 8-11
    const SATISFACTION_INPUT_ID = 'onf_q_inrest_recent_experience_osat_' + randomInt(4, 5); // satisfaction — random 4 or 5
    const CONTAINER_CLASS_1 = 'textField_textfieldContainer';
    const CONTAINER_CLASS_2 = 'layout_answer';
    const INPUT_ID = 'spl_q_inrest_rcpt_code_txt';
    const BEGIN_BUTTON_ID = 'buttonBegin';
    const NEXT_BUTTON_ID = 'buttonNext';   // Next button on the survey question page
    const AUTO_ADVANCE_DELAY_MS = 150;     // pause after selecting answers before pressing Next
    // ONLY on the second page ("Survey 20% complete."): randomized ratings + fixed answers.
    // The four osat ratings below are picked at random (4 or 5) once per page load.
    // IMPORTANT: answering "Yes" to order-accurate and "No" to problem-during-visit
    // keeps the conditional inaccuracy cascade hidden, so no follow-ups are required.
    const PAGE2_ANSWER_IDS = [
        'onf_q_inrest_taste_of_food_osat_' + randomInt(4, 5),                 // Taste of products purchased — random 4 or 5
        'onf_q_inrest_speed_of_service_osat_' + randomInt(4, 5),              // Speed of service — random 4 or 5
        'onf_q_inrest_friendliness_of_staff_osat_' + randomInt(4, 5),         // Friendliness of restaurant team — random 4 or 5
        'onf_q_inrest_appearence_of_the_restraunt_osat_' + randomInt(4, 5),   // Appearance of the restaurant — random 4 or 5
        'onf_q_inrest_warm_greeting_yn_1',                    // Greet you warmly — Yes
        'onf_q_inrest_eye_contact_yn_1',                      // Make eye contact with you — Yes
        'onf_q_inrest_appreciation_yn_1',                     // Make you feel valued — Yes
        'onf_q_inrest_sincere_goodbye_yn_3',                  // Provide a sincere goodbye — I can't remember
        'onf_q_inrest_order_fulffiled_yn_1',                  // Was your order accurate? — Yes
        'onf_q_inrest_visit_experience_yn_2'                  // Did you experience a problem during your visit? — No
    ];
    // ONLY on the coupon page ("Survey 80% complete."): the owner's own email + chosen radio.
    const PAGE3_EMAIL_INPUT_ID = 'spl_q_inrest_email_address_txt';
    const PAGE3_SUBMIT_INPUT_ID = 'onf_q_inrest_rcpt_additional_questions_alt_2'; // "No, I would like to submit the survey"
    const KEY_DELAY_MS = 10;        // delay between simulated keystrokes
    const POST_TYPE_DELAY_MS = 250;  // wait after typing before clicking Begin
    const MAX_WAIT_MS = 60000;       // stop polling after 60 seconds
    const POLL_MS = 300;             // check every 300 ms

    // ------------------------------------------------------------------
    // Random integer in [min, max] inclusive — used to randomize ratings.
    // ------------------------------------------------------------------
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ------------------------------------------------------------------
    // Guard: only run when the URL contains the Dunkin survey code pattern.
    // This is a runtime check (not in @match metadata) so more site
    // functions can be added later under the same broad @match.
    // ------------------------------------------------------------------
    function isTargetUrl() {
        return window.location.href.includes(TARGET_URL_PREFIX);
    }

    // ------------------------------------------------------------------
    // Guard: only run the answer-filling part on the survey question page.
    // ------------------------------------------------------------------
    function isQuestionPage() {
        return window.location.href.includes(QUESTION_PAGE_MARKER);
    }

    // ------------------------------------------------------------------
    // Guard: ONLY the first question page ("Survey 10% complete."), never later steps.
    // Primary check: document.title. Fallback: the progress bar's aria-valuenow="10".
    // Medallia updates both as each step completes ("Survey 20% complete.", etc.).
    // ------------------------------------------------------------------
    function isFirstQuestionPage() {
        const title = document.title || '';
        if (/10\s*%\s*complete/i.test(title)) return true;
        if (/\d+\s*%\s*complete/i.test(title)) return false; // explicitly on a different step
        const bar = document.querySelector('[aria-label="Survey completion indicator"]');
        if (bar) return bar.getAttribute('aria-valuenow') === '10';
        return 'unknown'; // nothing to check against yet — caller decides
    }

    // ------------------------------------------------------------------
    // Guard: ONLY the coupon page ("Survey 80% complete."), never other steps.
    // Same pattern: title first, progress bar as fallback.
    // ------------------------------------------------------------------
    function isThirdQuestionPage() {
        const title = document.title || '';
        if (/80\s*%\s*complete/i.test(title)) return true;
        if (/\d+\s*%\s*complete/i.test(title)) return false; // explicitly on a different step
        const bar = document.querySelector('[aria-label="Survey completion indicator"]');
        if (bar) return bar.getAttribute('aria-valuenow') === '80';
        return 'unknown'; // nothing to check against yet — caller decides
    }

    // ------------------------------------------------------------------
    // Guard: ONLY the second question page ("Survey 20% complete."), never other steps.
    // Same pattern as the first-page guard: title first, progress bar as fallback.
    // ------------------------------------------------------------------
    function isSecondQuestionPage() {
        const title = document.title || '';
        if (/20\s*%\s*complete/i.test(title)) return true;
        if (/\d+\s*%\s*complete/i.test(title)) return false; // explicitly on a different step
        const bar = document.querySelector('[aria-label="Survey completion indicator"]');
        if (bar) return bar.getAttribute('aria-valuenow') === '20';
        return 'unknown'; // nothing to check against yet — caller decides
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
    // Click the Next button on the question page.
    // On iOS, a plain .click() can be unreliable, so we also dispatch
    // mouse events manually as a fallback.
    // ------------------------------------------------------------------
    function clickNextButton(button) {
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
    // Wait for the Next button to exist, then press it exactly once.
    // Called ONLY after both chosen answers are confirmed selected.
    // ------------------------------------------------------------------
    async function clickNextWhenReady() {
        console.log('[DunkinAutoFill] Both answers selected. Waiting %dms, then pressing Next...', AUTO_ADVANCE_DELAY_MS);
        await sleep(AUTO_ADVANCE_DELAY_MS);

        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const button = document.getElementById(NEXT_BUTTON_ID);
            if (button) {
                clickNextButton(button);
                console.log('[DunkinAutoFill] Next button clicked.');
                return true;
            }
            await sleep(POLL_MS);
        }
        console.warn('[DunkinAutoFill] Next button not found — leaving navigation to you.');
        return false;
    }

    // ------------------------------------------------------------------
    // Select a hidden Medallia radio option by its input id.
    // The inputs (cellOption_input) are visually hidden; the real click
    // target is the wrapping cellOption_cellOptionContainer div, so we
    // click both and verify the radio ends up checked.
    // ------------------------------------------------------------------
    function selectRadioById(id) {
        const input = document.getElementById(id);
        if (!input) return false;
        if (input.checked) {
            console.log('[DunkinAutoFill] Already selected:', id);
            return true;
        }

        // 1) Try clicking the input itself
        try { input.click(); } catch (err) { console.warn('[DunkinAutoFill] input.click() failed for', id, err); }

        // 2) If the visible UI didn't register it, click the container div (+ iOS fallback events)
        if (!input.checked) {
            const container = input.closest('.cellOption_cellOptionContainer') ||
                              input.closest('.selectionBar_selectionUnit') ||
                              input.closest('.option_optionContainer') ||
                              input.parentElement;
            if (container) {
                container.click();
                setTimeout(function() {
                    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    container.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true, view: window }));
                    container.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true, view: window }));
                }, 50);
            }
        }

        // 3) Last resort: set checked directly and fire input/change so the survey engine sees it
        if (!input.checked) {
            input.checked = true;
            input.dispatchEvent(new Event('input',  { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        console.log('[DunkinAutoFill] Selected radio', id, '-> checked:', input.checked);
        return input.checked;
    }

    // ------------------------------------------------------------------
    // Answer the two required questions on the survey question page with
    // this run's randomly chosen answers (caller then auto-presses Next).
    // Returns true once both answers are selected.
    // ------------------------------------------------------------------
    let answersFilled = false;
    function tryFillAnswers() {
        if (answersFilled) return true;

        const q1 = selectRadioById(RECOMMEND_INPUT_ID);
        const q2 = selectRadioById(SATISFACTION_INPUT_ID);

        if (q1 && q2) {
            answersFilled = true;
            console.log('[DunkinAutoFill] Answers selected: %s and %s.', RECOMMEND_INPUT_ID, SATISFACTION_INPUT_ID);
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Poll until the FIRST page's radios render, then fill them.
    // If we're explicitly on a later step, do nothing at all.
    // ------------------------------------------------------------------
    async function startAnswers() {
        console.log('[DunkinAutoFill] Question page detected. Waiting for first-page (10%) answer options...');
        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const onFirstPage = isFirstQuestionPage();

            if (onFirstPage === false) {
                console.log('[DunkinAutoFill] Not the first survey page (title: "%s") — leaving everything untouched.', document.title);
                return;
            }

            if (onFirstPage === true) {
                if (tryFillAnswers()) {
                    await clickNextWhenReady();
                    return;
                }
            }
            // 'unknown' — the page has not rendered its title/progress bar yet; keep waiting
            await sleep(POLL_MS);
        }
        console.error('[DunkinAutoFill] Timed out waiting for the first-page answer options.');
    }

    // ------------------------------------------------------------------
    // SECOND page ("Survey 20% complete.") — select this run's (randomized) answers.
    // Note: "order accurate = Yes" + "problem during visit = No" keep the
    // conditional inaccuracy cascade hidden, so no follow-ups are needed.
    // ------------------------------------------------------------------
    let page2Filled = false;
    function tryFillPage2Answers() {
        if (page2Filled) return true;

        let allFound = true;
        const results = PAGE2_ANSWER_IDS.map(function(id) {
            const ok = selectRadioById(id);
            if (!ok) allFound = false;
            return { id: id, ok: ok };
        });

        if (allFound) {
            page2Filled = true;
            console.log('[DunkinAutoFill] Page 2 answers selected: %s.', PAGE2_ANSWER_IDS.join(', '));
            return true;
        }
        console.log('[DunkinAutoFill] Page 2 waiting on inputs:', results.filter(function(r) { return !r.ok; }).map(function(r) { return r.id; }).join(', ') || '(none)');
        return false;
    }

    // ------------------------------------------------------------------
    // Poll until the SECOND page's radios render, then fill them.
    // If we're explicitly on a different step, do nothing at all.
    // ------------------------------------------------------------------
    async function startPage2() {
        console.log('[DunkinAutoFill] Second survey page detected. Waiting for (20%) answer options...');
        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const onSecondPage = isSecondQuestionPage();

            if (onSecondPage === false) {
                console.log('[DunkinAutoFill] Not the second survey page (title: "%s") — leaving everything untouched.', document.title);
                return;
            }

            if (onSecondPage === true) {
                if (tryFillPage2Answers()) {
                    await clickNextWhenReady();
                    return;
                }
            }
            // 'unknown' — the page has not rendered its title/progress bar yet; keep waiting
            await sleep(POLL_MS);
        }
        console.error('[DunkinAutoFill] Timed out waiting for the second-page answer options.');
    }

    // ------------------------------------------------------------------
    // THIRD page ("Survey 80% complete.") — coupon page.
    // Fills the owner's own email address (React-safe native value setter) and
    // selects "No, I would like to submit the survey" (alt_2).
    // After both are confirmed, presses Next to submit.
    // ------------------------------------------------------------------
    let page3Filled = false;

    function fillEmailInput(el, value) {
        if (!el) return false;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (descriptor && descriptor.set) {
                descriptor.set.call(el, value);
            } else {
                el.value = value;
            }
        } catch (err) {
            el.value = value;
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try {
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        } catch (err) {
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        return el.value === value;
    }

    function tryFillPage3() {
        if (page3Filled) return true;

        const emailEl = document.getElementById(PAGE3_EMAIL_INPUT_ID);
        const emailSet = emailEl
            ? (emailEl.value === PAGE3_EMAIL_VALUE || fillEmailInput(emailEl, PAGE3_EMAIL_VALUE))
            : false;
        const radioSet = selectRadioById(PAGE3_SUBMIT_INPUT_ID);

        if (emailSet && radioSet) {
            page3Filled = true;
            console.log('[DunkinAutoFill] Coupon page filled: email set and "No, I would like to submit the survey" selected.');
            return true;
        }
        const pending = [ !emailSet ? 'email field (' + PAGE3_EMAIL_INPUT_ID + ')' : null,
                          !radioSet ? 'radio (' + PAGE3_SUBMIT_INPUT_ID + ')' : null ].filter(Boolean).join(', ');
        console.log('[DunkinAutoFill] Coupon page waiting on: %s', pending);
        return false;
    }

    // ------------------------------------------------------------------
    // Poll until the THIRD page's fields render, then fill them.
    // If we're explicitly on a different step, do nothing at all.
    // ------------------------------------------------------------------
    async function startPage3() {
        console.log('[DunkinAutoFill] Coupon page detected. Waiting for (80%) fields...');
        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const onThirdPage = isThirdQuestionPage();

            if (onThirdPage === false) {
                console.log('[DunkinAutoFill] Not the coupon page (title: "%s") — leaving everything untouched.', document.title);
                return;
            }

            if (onThirdPage === true) {
                if (tryFillPage3()) {
                    await clickNextWhenReady();
                    return;
                }
            }
            await sleep(POLL_MS);
        }
        console.error('[DunkinAutoFill] Timed out waiting for the coupon-page fields.');
    }

    // ------------------------------------------------------------------
    // Route the survey question page by its step (title / progress bar).
    // Page 1 -> select + auto-Next. Page 2 -> select + auto-Next.
    // Page 3 (coupon) -> fill email + submit choice, then auto-Next to submit.
    // Any other step -> do nothing.
    // ------------------------------------------------------------------
    async function startQuestionPage() {
        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const title = document.title || '';

            if (/10\s*%\s*complete/i.test(title)) { await startAnswers(); return; }
            if (/20\s*%\s*complete/i.test(title)) { await startPage2(); return; }
            if (/80\s*%\s*complete/i.test(title)) { await startPage3(); return; }
            if (/\d+\s*%\s*complete/i.test(title)) {
                console.log('[DunkinAutoFill] Survey step "%s" has no auto-fill — leaving everything untouched.', title);
                return;
            }

            // Title missing/unreadable — check the progress bar once available
            const bar = document.querySelector('[aria-label="Survey completion indicator"]');
            if (bar) {
                const now = bar.getAttribute('aria-valuenow');
                if (now === '10') { await startAnswers(); return; }
                if (now === '20') { await startPage2(); return; }
                if (now === '80') { await startPage3(); return; }
                console.log('[DunkinAutoFill] Survey progress at %s%% — no auto-fill for this step. Leaving untouched.', now);
                return;
            }

            await sleep(POLL_MS);
        }
        console.error('[DunkinAutoFill] Could not determine survey step — doing nothing.');
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

    console.log('[DunkinAutoFill] Random picks for this run: %s | %s | %s',
        RECOMMEND_INPUT_ID, SATISFACTION_INPUT_ID, PAGE2_ANSWER_IDS.slice(0, 4).join(', '));

    // Launch — code entry page and question page are handled separately
    if (isTargetUrl()) {
        start(getCodeFromUrl());
    } else if (isQuestionPage()) {
        startQuestionPage();
    } else {
        console.log('[DunkinAutoFill] URL does not match a known Dunkin auto-fill pattern. Script not running.');
    }
})();
