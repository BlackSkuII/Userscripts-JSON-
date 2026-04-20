// ==UserScript==
// @name         Comix.to Custom CSS
// @namespace    https://github.com/BlackSkuII
// @author       BlackSkuII
// @version      3.6
// @description  Inject custom CSS into comix.to
// @match        https://comix.to/*
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. STYLES ---
    var css = `
        .zoom-ctrl{
            display: none !important;
        }
        
        /* Define the default value for the zoom variable */
        :root {
            --comix-zoom-width: 100%;
        }

        /* Apply the variable to images. !important ensures it overrides site defaults */
        .read-viewer .page {
            max-width: var(--comix-zoom-width) !important;
        }

        #custom-zoom-panel {
            letter-spacing: -.02rem;
            background-color: rgba(var(--bs-body-bg-r-rgb), .3);
            -webkit-user-select: none;
            user-select: none;
            border-radius: 2rem;
            align-items: center;
            font-family: JetBrains Mono;
            transition: all .15s ease-in-out;
            display: none; /* Hidden by default */
            position: fixed;
            bottom: 1rem;
            left: 1rem;
            z-index: 999999; /* Ensure it sits on top */
        }
        #custom-zoom-panel.visible {
            display: flex !important; /* Show only when URL matches */
        }
        #custom-zoom-panel:hover {
            background-color: rgba(var(--bs-body-bg-r-rgb),.6)
        }

        .cz-btn {
            width: 2.5rem;
            height: 2.5rem;
            color: var(--bs-primary);
            background-color: var(--bs-body-bg);
            z-index: 90;
            opacity: .6;
            border: 0;
            border-radius: 50%;
            justify-content: center;
            align-items: center;
            padding: 0;
            font-size: 1.4rem;
            transition: all .15s ease-in-out;
            display: flex;
        }
        .cz-btn:hover {
            background-color: var(--bs-primary);
            color: var(--bs-body-bg);
            opacity: 1;
            font-size: 2rem
        }

        #cz-percent {
            opacity: .6;
            color: var(--bs-body-emphasis-color);
            padding: 0 .5rem;
            font-size: .8rem;
            transition: all .1s ease-in-out;
        }
        #cz-percent:hover{
            opacity: 1
        }
    `;

    // Inject styles
    var style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);


    // --- 2. HTML INJECTION ---
    var panel = document.createElement('div');
    panel.id = 'custom-zoom-panel';
    panel.innerHTML = `
        <button id="cz-minus" class="cz-btn">−</button>
        <div id="cz-percent">100%</div>
        <button id="cz-plus" class="cz-btn">+</button>
    `;
    document.body.appendChild(panel);


    // --- 3. LOGIC ---
    var currentWidth = GM_getValue("comix-zoom-level", 100);
    var step = 5; // Step changed to 5 for finer control with pixels
    var min = 25; // Minimum 25% as requested
    var max = 100;

    // Regex for reading pages
    var urlRegex = /https?:\/\/comix\.to\/(title|comic)\/.+\/.+/;

    var percentDisplay = document.getElementById('cz-percent');
    var btnMinus = document.getElementById('cz-minus');
    var btnPlus = document.getElementById('cz-plus');

    function applyZoom() {
        // 1. Update the display text (Percentage)
        percentDisplay.innerText = currentWidth + '%';
        
        // 2. Save percentage to storage
        GM_setValue("comix-zoom-level", currentWidth);

        // 3. Calculate Pixel Value based on current window width
        // Formula: Screen Width * (Percentage / 100)
        var screenWidth = window.innerWidth;
        var calculatedPixelWidth = Math.floor(screenWidth * (currentWidth / 100));

        // 4. Apply the calculated pixel width to the CSS variable
        // This automatically updates ALL .page elements
        document.documentElement.style.setProperty('--comix-zoom-width', calculatedPixelWidth + 'px');
    }

    // Event Listeners
    btnPlus.addEventListener('click', function() {
        if (currentWidth < max) {
            currentWidth += step;
            applyZoom();
        }
    });

    btnMinus.addEventListener('click', function() {
        if (currentWidth > min) {
            currentWidth -= step;
            applyZoom();
        }
    });

    // --- 4. RESPONSIVE & SPA HANDLING ---

    // Update zoom if window is resized (orientation change or desktop resize)
    window.addEventListener('resize', applyZoom);

    function checkUrlAndToggle() {
        if (urlRegex.test(window.location.href)) {
            panel.classList.add('visible');
            applyZoom();
        } else {
            panel.classList.remove('visible');
        }
    }

    // Hook into History API to detect navigation without full page reload
    var originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        checkUrlAndToggle();
    };
    
    window.addEventListener('popstate', checkUrlAndToggle);

    // Initial check on load
    checkUrlAndToggle();

    // --- GLOBAL BRIDGE ---
    // Expose function to set zoom from other parts of the script
    window.setComixZoomLevel = function(level) {
        currentWidth = level;
        applyZoom();
    };

})();

(function () {
    'use strict';

    function injectCSS() {
        // Avoid duplicating the style tag
        if (document.getElementById('custom-comix-css')) return;

        const style = document.createElement('style');
        style.id = 'custom-comix-css';

        style.textContent = `

            /* ===== Shared (applies to everything) ===== */
            :root{
                --bs-body-bg: #000 !important;
                --bs-body-tertiary-bg: #000 !important;
                --bs-body-bg-l1: #000 !important;
           }
           :root, [data-bs-theme=default] {
                --bs-primary: #440aaa !important;
                --bs-primary-rgb: 68, 10, 170 !important;
                --bs-body-secondary-bg: #000 !important;

           }
           .comic.sm .item .poster {
                width: 10.4rem !important;
           }
            #cloned-bookmarks {
                align-items: center;
                padding: .5rem 0.9rem;
                font-size: 1.15rem !important;
                display: flex;
            }
            .head-dropdown .dropdown-menu, .dropdown-menu{
            box-shadow:0 .125rem .25rem #ffffff99;
            }


        /* ===== Desktop / Computer only ===== */
        @media (hover: hover) and (pointer: fine) {
            .poster {
                width: 10rem !important;
            }
            #cloned-bookmarks:hover {
            color:var(--bs-primary);
            }
            .comic-info .poster {
                width: 18rem !important;
            }       
        }

        /* ===== Mobile / Phone only ===== */
        @media (hover: none) and (pointer: coarse) {

                
        }
        `;

        document.head.appendChild(style);
    }

    function duplicateBookmarks() {
        const original = document.querySelector('.dropdown-item[href="/user/bookmarks"]');
        const target = document.querySelector('.dropdown.user-menu.head-dropdown');

        if (!original || !target) return;

        // Prevent duplicating multiple times
        if (document.getElementById('cloned-bookmarks')) return;

        const clone = original.cloneNode(true);
        clone.id = 'cloned-bookmarks';

        // Remove span inside clone
        const span = clone.querySelector('span');
        if (span) span.remove();

        // Insert above target
        target.parentNode.insertBefore(clone, target);
    }

    function duplicatePagination() {
        const originalNav = document.querySelector('nav.navigation.d-none.d-md-block');
        const targetLi = document.querySelector('li.head');
        const cloneId = 'cloned-pagination-nav';

        const existingClone = document.getElementById(cloneId);

        // 1. If the original navigation is gone (e.g. user left /bookmarks), remove clone and stop
        if (!originalNav) {
            if (existingClone) existingClone.remove();
            return;
        }

        // 2. If target insertion point is missing, stop
        if (!targetLi) return;

        // 3. If clone exists, check if it needs updating
        if (existingClone) {
            // If content is identical, we don't need to do anything
            if (existingClone.innerHTML === originalNav.innerHTML) {
                return;
            }
            // Content changed (page number updated), remove old clone to rebuild
            existingClone.remove();
        }

        // 4. Create the clone
        const clone = originalNav.cloneNode(true);
        clone.id = cloneId;

        // 5. Force the links to work by clicking the corresponding original button
        const clonedLinks = clone.querySelectorAll('a');
        const originalLinks = originalNav.querySelectorAll('a');

        clonedLinks.forEach((link, index) => {
            if (originalLinks[index]) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    originalLinks[index].click();
                });
            }
        });

        // 6. Insert the clone above the li.head element
        targetLi.parentNode.insertBefore(clone, targetLi);
    }

    function runAll() {
        injectCSS();
        duplicateBookmarks();
        duplicatePagination();
    }

    // Run once on load
    runAll();

    // Re-run if SPA updates the DOM
    let lastUrl = location.href; 

    const observer = new MutationObserver(() => {
        // Specific check for URL changes (SPA Navigation)
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // Force removal of the pagination clone so it can be rebuilt with new data
            const navClone = document.getElementById('cloned-pagination-nav');
            if (navClone) navClone.remove();
        }
        
        runAll();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
    
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input/textarea
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            return;
        }

        const onBookmarks = window.location.href.includes('/user/bookmarks');

        // ===== Bookmarks Page Navigation =====
        if (onBookmarks) {
            // Right Arrow or Space -> Next Page
            if (e.code === 'ArrowRight' || e.code === 'Space') {
                const nextBtn = document.querySelector('.fa-sharp.fa-solid.fa-angle-right');
                if (nextBtn) {
                    e.preventDefault();
                    nextBtn.click();
                }
                return; // Stop execution here to prevent default Space behavior below
            }
            
            // Left Arrow -> Previous Page
            if (e.code === 'ArrowLeft') {
                const prevBtn = document.querySelector('.fa-sharp.fa-solid.fa-angle-left');
                if (prevBtn) {
                    e.preventDefault();
                    prevBtn.click();
                }
                return;
            }
        }

        // ===== Global / Other Pages =====
        if (e.code === 'Space') {
            const nextButton = document.querySelector('.fa-sharp.fa-solid.fa-chevron-right');
            if (nextButton) {
                e.preventDefault(); // prevent page scroll
                nextButton.click();
            }
        }

        // Decrease ( - key )
        if (e.key === '-' || e.code === 'Minus') {
            const decreaseBtn = document.querySelector('#cz-minus');
            if (decreaseBtn) {
                e.preventDefault();
                decreaseBtn.click();
            }
        }

        // Increase ( + key )
        if (e.key === '+' || e.code === 'Equal') {
            const increaseBtn = document.querySelector('#cz-plus');
            if (increaseBtn) {
                e.preventDefault();
                increaseBtn.click();
            }
        }

        // Reset to 80% (0 key)
        if (e.key === '0') {
            if (window.setComixZoomLevel) {
                window.setComixZoomLevel(80);
            }
        }

        // Set to 30% (. key)
        if (e.key === '.') {
            if (window.setComixZoomLevel) {
                window.setComixZoomLevel(35);
            }
        }
    });
})();
