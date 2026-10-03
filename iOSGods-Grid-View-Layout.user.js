// ==UserScript==
// @name         iOSGods App Store - Grid View Layout (No VIP)
// @namespace    https://app.iosgods.com/
// @version      1.3
// @description  Changes the iOSGods App Store list view to a responsive grid view and hides VIP apps.
// @author       You
// @match        https://app.iosgods.com/store/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const css = `
    /* 
       HIDE VIP APPS COMPLETELY
       This prevents VIP apps from showing up in the grid.
    */
    .app-list-item:has(.vip-download-btn) {
        display: none !important;
    }

    /* 
       MAIN GRID CONTAINER 
       Desktop: 4 columns
       Mobile: 2 columns
    */
    .app-list {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 16px !important;
        padding: 10px 15px !important;
        list-style: none !important;
    }

    @media screen and (max-width: 768px) {
        .app-list {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
            padding: 10px 5px !important;
        }
    }

    /* 
       INDIVIDUAL APP CARD 
    */
    .app-list-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
        padding: 15px 10px !important;
        border-radius: 16px !important;
        background-color: rgba(128, 128, 128, 0.08) !important;
        border: 1px solid rgba(128, 128, 128, 0.15) !important;
        transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        min-width: 0 !important; 
    }

    .app-list-item:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    }

    /* App Icon Styling */
    .app-list-item .app-icon {
        width: 100% !important;
        max-width: 120px !important; 
        aspect-ratio: 1 / 1 !important; 
        height: auto !important;
        margin-bottom: 10px !important;
        border-radius: 14px !important;
        overflow: hidden !important;
    }
    
    .app-list-item .app-icon img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 14px !important;
    }

    /* Metadata Container */
    .app-list-item .app-meta {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        width: 100% !important;
        flex-grow: 1 !important;
        min-width: 0 !important; 
    }

    /* Title & Description Text */
    .app-list-item .app-title {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        width: 100% !important;
        margin-bottom: 10px !important;
    }

    .app-list-item .app-title strong {
        display: -webkit-box !important;
        width: 100% !important;
        font-size: 14px !important;
        line-height: 1.3 !important;
        margin-bottom: 4px !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        min-height: 36px; 
        word-wrap: break-word !important; 
    }

    .app-list-item .app-title span {
        display: -webkit-box !important;
        width: 100% !important;
        font-size: 12px !important;
        color: #8e8e93 !important;
        line-height: 1.3 !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        min-height: 31px; 
        word-wrap: break-word !important;
    }

    /* Download Button */
    .app-list-item .download-btn {
        display: flex !important;
        justify-content: center !important;
        width: 100% !important;
        margin-top: auto !important; 
    }

    .app-list-item .download-btn a {
        width: 90% !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        height: 32px !important;
        line-height: 32px !important;
        font-size: 13px !important;
        font-weight: bold !important;
        text-transform: uppercase !important;
    }
    `;

    // Inject the CSS into the page
    GM_addStyle(css);

})();
