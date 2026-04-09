// ==UserScript==
// @name         Comix.to Custom CSS
// @namespace    https://github.com/BlackSkuII
// @author       BlackSkuII
// @version      2.3.5
// @description  Inject custom CSS into comix.to
// @match        https://comix.to/*
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix.user.js
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
