// ==UserScript==
// @name         Comix Translator Medal Ranker
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Scans all groups on the page, ranks them based on a priority list, and awards Gold, Silver, and Bronze to the top 3.
// @author       You
// @match        *://*.comix.to/*
// @grant        none
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix-Ranker.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Comix-Ranker.user.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Your priority list (1 to 11)
    const priorityList = [
        "Flame Comics",
        "HiveToons",
        "Asura Scans",
        "QI Scans",
        "DuskScans",
        "StoneScape",
        "Lagoon Scans",
        "Vortex Scans",
        "ThunderScans",
        "Kaynscan",
        "Genz Toons"
    ];

    // Normalize strings: lowercase and remove all spaces
    // This ensures "Dusk Scans" matches "DuskScans", and "Kayn Scan" matches "Kaynscan"
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, '');

    // Create a map of normalized priority names to their rank (0, 1, 2...)
    const priorityMap = {};
    priorityList.forEach((name, index) => {
        priorityMap[normalize(name)] = index;
    });

    function applyMedals() {
        const groupSpans = document.querySelectorAll('.mchap-row__group span');
        if (!groupSpans.length) return; // Exit if no groups found on the page

        const foundGroups = new Set(); // To store unique normalized names found on the page

        // 1. Scan all groups on the page and add them to a set if they are in our priority list
        groupSpans.forEach(span => {
            const normalizedName = normalize(span.textContent.trim());
            // Strip any existing medals first to get the clean group name for scanning
            const cleanName = normalizedName.replace(/🥇|🥈|🥉/g, '').trim();
            
            if (priorityMap.hasOwnProperty(cleanName)) {
                foundGroups.add(cleanName);
            }
        });

        // 2. Sort the found groups based on their priority rank
        const rankedGroups = Array.from(foundGroups).sort((a, b) => {
            return priorityMap[a] - priorityMap[b];
        });

        // 3. Assign medals to the top 3 found on this page
        const medals = {};
        if (rankedGroups[0]) medals[rankedGroups[0]] = '🥇 ';
        if (rankedGroups[1]) medals[rankedGroups[1]] = '🥈 ';
        if (rankedGroups[2]) medals[rankedGroups[2]] = '🥉 ';

        // 4. Apply the medals to the DOM
        groupSpans.forEach(span => {
            let text = span.textContent.trim();
            
            // Strip any existing medals to prevent duplication
            text = text.replace(/🥇 |🥈 |🥉 /g, '').trim();
            
            const normalizedName = normalize(text);

            // If this group is a winner, append the medal
            if (medals[normalizedName]) {
                span.textContent = medals[normalizedName] + text;
            } else {
                // Otherwise, just set it to the clean text
                span.textContent = text;
            }
        });
    }

    // Debounce function to prevent the observer from firing too rapidly
    let debounceTimer;
    function debounce(func, delay) {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }

    const debouncedApplyMedals = debounce(applyMedals, 200);

    // Run once on initial load
    applyMedals();

    // Observe DOM changes to handle dynamic loading (SPAs)
    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldRun = true;
                break;
            }
        }
        if (shouldRun) {
            debouncedApplyMedals();
        }
    });

    // Start observing the document body for injected elements
    observer.observe(document.body, { childList: true, subtree: true });

})();
