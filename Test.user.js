// ==UserScript==
// @name         Comix - Show Zoom Controls on Mobile
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Forces the zoom control bar to be visible on mobile devices on Comix
// @author       You
// @match        https://comix.to/*
// @match        https://*.comix.to/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // This CSS overrides the media query that hides the buttons on touch devices
    var css = `
        .zoom-ctrl {
            display: flex !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        }
    `;

    // Inject the CSS into the page
    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(css);
    } else {
        var style = document.createElement("style");
        style.type = "text/css";
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

})();
