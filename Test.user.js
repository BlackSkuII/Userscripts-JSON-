// ==UserScript==
// @name         Comix - Always Show Zoom Controls
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Forces the zoom control bar (.zoom-ctrl) to be visible on mobile devices and touch screens.
// @author       You
// @match        https://comix.to/*
// @match        https://*.comix.to/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // This CSS overrides the website's default behavior which hides these buttons on mobile.
    // We use '!important' to ensure our rules take precedence over the site's styles.
    var css = `
        .zoom-ctrl {
            display: flex !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        }

        /* Optional: Adjust positioning if it overlaps with other mobile UI elements */
        @media (hover: none) and (pointer: coarse) {
            .zoom-ctrl {
                bottom: 20px !important; /* Example adjustment */
            }
        }
    `;

    // Inject the CSS as early as possible
    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(css);
    } else {
        var style = document.createElement("style");
        style.innerHTML = css;
        document.head.appendChild(style);
    }

})();
