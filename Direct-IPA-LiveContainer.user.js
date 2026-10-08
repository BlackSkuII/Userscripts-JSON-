// ==UserScript==
// @name         iOSGods Direct IPA & LiveContainer Buttons
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds Direct Download and LiveContainer install buttons to iOSGods App Store
// @author       You
// @match        https://app.iosgods.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=iosgods.com
// @updateURL    https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Direct-IPA-LiveContainer.user.js
// @downloadURL  https://github.com/BlackSkuII/Userscripts-JSON-/raw/refs/heads/main/Direct-IPA-LiveContainer.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function injectButtons() {
        const targetDiv = document.querySelector('.app--detail__downloads');
        // If the container doesn't exist or we already injected the buttons, do nothing
        if (!targetDiv || targetDiv.querySelector('#tm-direct-download')) return;

        // Create Direct Download Button
        const btnDirect = document.createElement('a');
        btnDirect.href = '#';
        btnDirect.id = 'tm-direct-download';
        btnDirect.className = 'link col button button-round btn-download-ipa';
        btnDirect.style.cssText = 'background: #34c759; color: white; margin-left: 5px;';
        btnDirect.innerHTML = '<i class="fas fa-download" aria-hidden="true"></i>&nbsp;<span class="phone-hide">Direct IPA</span>';

        // Create LiveContainer Button
        const btnLiveContainer = document.createElement('a');
        btnLiveContainer.href = '#';
        btnLiveContainer.id = 'tm-livecontainer';
        btnLiveContainer.className = 'link col button button-round btn-download-ipa';
        btnLiveContainer.style.cssText = 'background: #5856D6; color: white; margin-left: 5px;';
        btnLiveContainer.innerHTML = '<i class="fas fa-box" aria-hidden="true"></i>&nbsp;<span class="phone-hide">LiveContainer</span>';

        // Append buttons to the downloads div
        targetDiv.appendChild(btnDirect);
        targetDiv.appendChild(btnLiveContainer);

        // Function to fetch the direct .ipa URL using the site's internal API
        async function getDirectDownloadLink() {
            const appDataDiv = document.querySelector('.app--detail__data');
            if (!appDataDiv) throw new Error("App data not found.");
            
            const appId = appDataDiv.dataset.id;
            const baseUrl = window.baseUrl || '/store/';

            // Step 1: Check availability (as the original site does to prevent rate limiting)
            try {
                await fetch(`${baseUrl}api/download-availability?appId=${appId}&installation_method=sideloadly`);
            } catch (e) {
                console.warn('Availability check failed, continuing anyway:', e);
            }

            // Step 2: Fetch the Sideloadly link data
            const res = await fetch(`${baseUrl}api/app/${appId}/download/sideloadly`);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const json = await res.json();
            if (json && json.data) {
                // The API returns a Sideloadly URL containing the actual IPA URL after "&xs="
                const xsIndex = json.data.indexOf("&xs=");
                if (xsIndex !== -1) {
                    return json.data.substring(xsIndex + 4); // Extract the direct .ipa link
                }
                return json.data; // Fallback just in case the format changes
            }
            throw new Error("Download link not found in API response.");
        }

        // Click event for Direct Download
        btnDirect.addEventListener('click', async function(e) {
            e.preventDefault();
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Loading spinner

            try {
                const link = await getDirectDownloadLink();
                window.location.href = link; // Redirect to the direct IPA link
            } catch (err) {
                alert('Failed to get direct download link.\n' + err.message + '\n\nMake sure you are logged in.');
            }
            this.innerHTML = originalHTML; // Restore button text
        });

        // Click event for LiveContainer
        btnLiveContainer.addEventListener('click', async function(e) {
            e.preventDefault();
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Loading spinner

            try {
                const link = await getDirectDownloadLink();
                // Open the LiveContainer URL scheme with the encoded direct link
                window.location.href = 'livecontainer://install?url=' + encodeURIComponent(link);
            } catch (err) {
                alert('Failed to get LiveContainer link.\n' + err.message + '\n\nMake sure you are logged in.');
            }
            this.innerHTML = originalHTML; // Restore button text
        });
    }

    // Use a MutationObserver to watch for page changes (since it's a SPA)
    const observer = new MutationObserver(() => {
        injectButtons();
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, { childList: true, subtree: true });

    // Also try to inject immediately in case the page is already loaded
    injectButtons();
})();
