// ==UserScript==
// @name         GitHub Raw Button
// @namespace    https://github.com/BlackSkuII
// @author       BlackSkuII
// @version      1.1
// @description  Adds a Raw button on GitHub file view (better anchor)
// @match        https://github.com/*/*/blob/*
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Raw.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Raw.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function addRawButton() {
        // Check if screen width is typical for phones (portrait)
        // 768px is the standard CSS breakpoint for mobile devices
        const isMobile = window.innerWidth <= 768;
        const existingBtn = document.getElementById('tm-raw-button');

        if (!isMobile) {
            // If not on mobile, ensure button is removed (e.g. rotating back to landscape)
            if (existingBtn) existingBtn.remove();
            return;
        }

        // Prevent duplicates
        if (existingBtn) return;

        // Find the target container (your new reference)
        const targetBox = document.querySelector('[class*="BlobViewHeader-module__Box_3"]');
        if (!targetBox) return;

        // Create button
        const btn = document.createElement('button');
        btn.id = 'tm-raw-button';
        btn.textContent = 'Raw';

        // Styling (GitHub-like)
        //btn.style.marginLeft = '135px';
        btn.style.marginLeft = 'auto';
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '12px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid #3d444d';
        btn.style.borderRadius = '6px';
        btn.style.background = 'var(--button-default-bgColor-rest,var(--color-btn-bg))';
        btn.style.color = 'var(--color-fg-default)';

        // Click → open raw file
        btn.onclick = function () {
            let url = window.location.href;

            url = url
                .replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');

            window.open(url, '_blank');
        };

        // Insert BEFORE the target box (left side)
        targetBox.parentNode.insertBefore(btn, targetBox);
    }

    // Observe dynamic page loads (GitHub PJAX)
    const observer = new MutationObserver(addRawButton);
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen for resize events to handle phone rotation
    window.addEventListener('resize', addRawButton);

    // Initial run
    addRawButton();
})();
