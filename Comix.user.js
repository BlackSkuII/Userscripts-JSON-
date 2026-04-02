// ==UserScript==
// @name         Comix.to Custom CSS
// @namespace    https://github.com/BlackSkuII
// @author       BlackSkuII
// @version      2.0
// @description  Inject custom CSS into comix.to
// @match        https://comix.to/*
// @updateURL    
// @downloadURL  
// @grant        none
// ==/UserScript==

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
                --bs-primary-rgb: 102,232,250;
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


        /* ===== Desktop / Computer only ===== */
        @media (hover: hover) and (pointer: fine) {
            .poster {
                width: 10rem !important;
            }
            #cloned-bookmarks:hover {
            color:var(--bs-primary);
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
        const target = document.querySelector('.dropdown.user-notify');

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

    function runAll() {
        injectCSS();
        duplicateBookmarks();
    }

    // Run once on load
    runAll();

    // Re-run if SPA updates the DOM
    const observer = new MutationObserver(() => {
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

        if (e.code === 'Space') {
            const nextButton = document.querySelector('.nav.next');

            if (nextButton) {
                e.preventDefault(); // prevent page scroll
                nextButton.click();
            }
        }
        // Decrease ( - key )
    if (e.key === '-' || e.code === 'Minus') {
        const decreaseBtn = document.querySelector('.decrease-btn');
        if (decreaseBtn) {
            e.preventDefault();
            decreaseBtn.click();
        }
    }

    // Increase ( + key )
    if (e.key === '+' || e.code === 'Equal') {
        const increaseBtn = document.querySelector('.increase-btn');
        if (increaseBtn) {
            e.preventDefault();
            increaseBtn.click();
        }
    }
    });


})();
