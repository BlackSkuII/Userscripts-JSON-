// ==UserScript==
// @name         Comix - Force Show Zoom Controls (iOS Fix)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Uses JS and high-specificity CSS to force zoom controls to show on iPhone Safari.
// @author       You
// @match        https://comix.to/*
// @match        https://*.comix.to/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT CSS (Highest Specificity)
    // We target the element by ID or Class nested inside body to beat the site's CSS.
    var css = `
        html body .zoom-ctrl,
        html body .viewer-wrapper .zoom-ctrl {
            display: flex !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
            z-index: 9999 !important;
            /* Fix positioning if it's off-screen */
            bottom: 60px !important;
            right: 20px !important;
        }
    `;

    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(css);
    } else {
        var style = document.createElement("style");
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    // 2. JAVASCRIPT FALLBACK (Runs after page loads)
    // This forces the style attribute directly on the element, which overrides almost all CSS.
    function forceShowZoom() {
        var zoomCtrl = document.querySelector('.zoom-ctrl');
        if (zoomCtrl) {
            zoomCtrl.style.setProperty('display', 'flex', 'important');
            zoomCtrl.style.setProperty('opacity', '1', 'important');
            zoomCtrl.style.setProperty('visibility', 'visible', 'important');
            zoomCtrl.style.setProperty('pointer-events', 'auto', 'important');
            zoomCtrl.style.setProperty('z-index', '9999', 'important');
        }
    }

    // Run when the page loads
    window.addEventListener('load', forceShowZoom);

    // Run periodically in case the site's JS hides it dynamically
    setInterval(forceShowZoom, 1000);

})();
