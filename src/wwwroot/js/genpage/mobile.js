/**
 * Mobile UI Management Module
 *
 * This module handles the mobile user interface for a web application.
 * It includes functions for detecting mobile devices, managing UI elements,
 * handling user interactions, and optimizing the interface for mobile use.
 */

// Constants
const LONG_PRESS_DURATION = 500; // milliseconds

// Cache frequently accessed DOM elements for better performance
const inputSidebar = document.getElementById("input_sidebar");
const simpleInputSidebar = document.getElementById("simple_input_sidebar");
const bottomBar = document.getElementById("t2i_bottom_bar");
const tabContent = document.querySelector(".tab-content");
const mobileTabSelector = document.getElementById("mobile_tab_selector");
const genButtonMobile = document.getElementById("alt_generate_button_mobile");
const expandIndicator = document.getElementById("mobile_expand_indicator");
const extrasWrapper = document.getElementById("current_image_extras_wrapper");

/**
 * Mobile Detection Functions
 * These functions help determine if the user is on a mobile device.
 */
const isMobile = () =>
    window.matchMedia("(max-width: 768px)").matches &&
    ("ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0);
const isMobileUserAgent = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isLikelyMobile = () => isMobile() || isMobileUserAgent();

/**
 * Utility function to add multiple event listeners to an element
 * @param {HTMLElement} element - The target element
 * @param {string[]} events - Array of event types
 * @param {Function} handler - The event handler function
 */
const addMultipleEventListeners = (element, events, handler) => {
    events.forEach((event) =>
        element.addEventListener(event, handler, { passive: true })
    );
};

/**
 * Toggles the visibility of an element
 * @param {HTMLElement} element - The element to toggle
 */
const toggleElement = (element) => {
    // element.classList.toggle("closed");
    // element.style.display = element.classList.contains("closed")? "none !important" : "block !important";
    // element.style.height = element.classList.contains("closed")? "0 !important" : "100% !important";

    // element.style.cssText = element.classList.contains("closed")
    //     ? "height: 0px !important; display: none !important;"
    //     : "height: 100% !important; display: block !important;";

    element.classList.toggle("closed");
    element.style.height = element.classList.contains("closed")
        ? "0px"
        : "100%";
    element.style.display = element.classList.contains("closed")
        ? "none !important"
        : "block !important";
};

// Convenience functions for toggling specific elements
const toggleBottomBar = () => toggleElement(bottomBar);
const toggleInputSidebar = () => toggleElement(inputSidebar);

/**
 * Debounce function to limit the rate at which a function can fire
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} - The debounced function
 */
const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Scrolls the active element or window to the top
 */
const backToTop = () => {
    (
        document.querySelector(".mobile-flyout:not(.closed)") ||
        tabContent ||
        window
    ).scrollTo({ top: 0, behavior: "smooth" });
};

/**
 * Creates the mobile menu structure
 * @returns {HTMLElement} - The created mobile menu element
 */
const createMobileMenu = () => {
    const menu = document.createElement("div");
    menu.className = "mobile-menu";
    menu.innerHTML = `
        <div class="mobile-menu-buttons">
            <button data-action="toggleInputSidebar">Inputs</button>
            <button data-action="toggleBottomBar">Extras</button>
            <button data-action="showOptions">Options</button>
            <button data-action="interrupt">Interrupt</button>
            <button data-action="backToTop">Top</button>
        </div>
    `;
    menu.querySelectorAll("button").forEach((button) => {
        handleAction(button, () => {
            const action = button.dataset.action;
            if (action) {
                switch (action) {
                    case "toggleInputSidebar":
                        toggleInputSidebar();
                        updateFlyoutZIndex("input_sidebar");
                        break;
                    case "toggleBottomBar":
                        toggleBottomBar();
                        updateFlyoutZIndex("t2i_bottom_bar");
                        break;
                    case "showOptions":
                        doPopover("generate_center");
                        break;
                    case "interrupt":
                        mainGenHandler.doInterrupt();
                        break;
                    case "backToTop":
                        backToTop();
                        break;
                }
            }
            menu.parentElement.removeChild(menu);
        });
    });
    return menu;
};

/**
 * Displays the mobile menu
 */
const showMobileMenu = () => {
    const menu = createMobileMenu();
    const rect = genButtonMobile.getBoundingClientRect();
    Object.assign(menu.style, {
        position: "fixed",
        left: `${rect.left - 70}px`,
        top: `${rect.top - 260}px`,
        zIndex: "1050",
    });

    document.body.appendChild(menu);

    const closeMenu = (e) => {
        if (menu && !menu.contains(e.target) && e.target !== genButtonMobile) {
            if (menu.parentElement) menu.parentElement.removeChild(menu);
            document.removeEventListener("click", closeMenu);
            document.removeEventListener("touchstart", closeMenu);
        }
    };

    setTimeout(
        () =>
            addMultipleEventListeners(
                document,
                ["click", "touchstart"],
                closeMenu
            ),
        0
    );
};

/**
 * Handles user actions on mobile, including long press detection
 * @param {HTMLElement} element - The element to attach the handler to
 * @param {Function} handler - The handler function for the action
 * @param {boolean} isLongPressEnabled - Whether long press should be enabled
 */
const handleAction = (element, handler, isLongPressEnabled = false) => {
    let touchStartTime;
    let hasMoved = false;
    let longPressTimer;

    const touchStart = () => {
        touchStartTime = Date.now();
        hasMoved = false;
        if (isLongPressEnabled) {
            longPressTimer = setTimeout(showMobileMenu, LONG_PRESS_DURATION);
        }
    };

    const touchMove = () => {
        hasMoved = true;
        if (isLongPressEnabled) {
            clearTimeout(longPressTimer);
        }
    };

    const touchEnd = (e) => {
        if (isLongPressEnabled) {
            clearTimeout(longPressTimer);
        }
        if (!hasMoved && Date.now() - touchStartTime < LONG_PRESS_DURATION) {
            handler(e);
        }
    };

    if ("ontouchstart" in window) {
        element.addEventListener("touchstart", touchStart, { passive: true });
        element.addEventListener("touchmove", touchMove, { passive: true });
        element.addEventListener("touchend", touchEnd);
    } else {
        element.addEventListener("click", (e) => !hasMoved && handler(e));
    }
};

/**
 * Disables zoom on text fields for iOS devices
 */
const disableIosTextFieldZoom = () => {
    const viewportMeta = document.querySelector("meta[name=viewport]");
    if (
        viewportMeta &&
        !/maximum\-scale=/i.test(viewportMeta.getAttribute("content"))
    ) {
        viewportMeta.setAttribute(
            "content",
            viewportMeta.getAttribute("content") + ", maximum-scale=1.0"
        );
    }
};

/**
 * Initializes the mobile UI
 */
const initializeMobileUI = () => {
    setupTabSelector();
    if (isLikelyMobile()) {
        setupMobileUI();
    }
};

/**
 * Sets up the mobile tab selector
 */
const setupTabSelector = () => {
    const tabLinks = document.querySelectorAll(
        "#bottombartabcollection .nav-link"
    );
    const fragment = document.createDocumentFragment();
    tabLinks.forEach((tab) => {
        const option = document.createElement("option");
        option.value = tab.getAttribute("href");
        option.textContent = tab.textContent;
        fragment.appendChild(option);
    });
    mobileTabSelector.appendChild(fragment);
    mobileTabSelector.value = window.location.hash.split(",")[0];
};

/**
 * Sets up the mobile UI elements
 */
const setupMobileUI = () => {
    document
        .getElementById("version_display")
        ?.style.setProperty("display", "none");
    document
        .getElementById("popover_generate")
        ?.style.setProperty("display", "none");
    inputSidebar.classList.add("mobile-flyout", "closed");

    setupFlyout(bottomBar, toggleBottomBar);
    setupFlyout(inputSidebar, toggleInputSidebar);
    setupBackToTopButton();
    setupGenButtonMobile();
    // setupMobileCurrentImageExtras();
    setupCopyrightMessage();
};

/**
 * Sets up a flyout element
 * @param {HTMLElement} element - The element to set up as a flyout
 * @param {Function} toggleFunction - The function to toggle the flyout
 */
const setupFlyout = (element, toggleFunction) => {
    element.classList.add("mobile-flyout", "closed");
    const dragArea = document.createElement("div");
    dragArea.innerHTML = "&#9660;";
    Object.assign(dragArea.style, {
        width: "100%",
        height: "30px",
        backgroundColor: "#2a2a2a",
        textAlign: "center",
        lineHeight: "30px",
        color: "var(--emphasis)",
        cursor: "pointer",
        borderBottom: "1px solid #3a3a3a",
        transition: "all 0.3s ease",
    });
    handleAction(dragArea, toggleFunction);
    element.insertBefore(dragArea, element.firstChild);
    styleElement(element);
};

/**
 * Updates the z-index of flyout elements
 * @param {string} selectedFlyoutId - The ID of the selected flyout
 */
const updateFlyoutZIndex = (selectedFlyoutId) => {
    ["t2i_bottom_bar", "input_sidebar"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.style.zIndex = id === selectedFlyoutId ? "1000" : "0";
        }
    });
};

/**
 * Applies styles to a flyout element
 * @param {HTMLElement} element - The element to style
 */
const styleElement = (element) => {
    Object.assign(element.style, {
        lineHeight: "1.5",
        display: "block !important",
        transition: "height 0.3s ease 0s",
        backgroundColor: "rgb(26, 26, 26)",
        boxShadow: "rgba(0, 255, 255, 0.1) 0px -5px 15px",
        color: "rgb(255, 255, 255)",
        position: "absolute",
        bottom: "0px",
        overflowY: "auto",
        maxWidth: "100vw",
        overflowX: "hidden",
        width: "100vw",
        zIndex: "1000",
        height: "0",
        left: "0",
    });
};

/**
 * Sets up the back-to-top button
 */
const setupBackToTopButton = () => {
    document
        .getElementById("btn-back-to-top")
        ?.addEventListener("click", backToTop, { passive: true });
};

/**
 * Sets up the mobile generate button
 */
const setupGenButtonMobile = () => {
    handleAction(genButtonMobile, handleGenerateClickMobile, true);
};

/**
 * Handles the generate button click on mobile
 * @param {Event} event - The click event
 */
const handleGenerateClickMobile = (event) => {
    mainGenHandler.doGenerateButton(event);
    bottomBar.classList.add("closed");
    inputSidebar.classList.add("closed");
    backToTop();
};

/**
 * Switches the mobile tab
 * @param {Event} e - The change event
 */
const switchMobileTab = (e) => {
    document
        .querySelector(
            `#bottombartabcollection .nav-link[href="${e?.target?.value}"]`
        )
        ?.click();
};

// Initialize the mobile UI
initializeMobileUI();

// Apply iOS-specific optimizations if necessary
if (isIOS()) {
    disableIosTextFieldZoom();
}
const setupMobileCurrentImageExtras = () => {
    if (expandIndicator && extrasWrapper) {
        handleAction(expandIndicator, function () {
            extrasWrapper.classList.toggle("expanded");
            expandIndicator.classList.toggle("hidden");
            if (extrasWrapper.classList.contains("expanded")) {
                expandIndicator.textContent = "▲ Less Info";
            } else {
                expandIndicator.textContent = "▼ More Info";
            }
        });
    }
};

function setupCopyrightMessage() {
    const mainImageArea = document.getElementById("main_image_area");
    if (mainImageArea) {
        const cheekyLink = document.createElement("a");
        cheekyLink.href = "https://github.com/mcmonkeyprojects/SwarmUI/";
        cheekyLink.textContent = "© 2024 SwarmUI";
        Object.assign(cheekyLink.style, {
            display: "block",
            textAlign: "center",
            padding: "10px",
            color: "#e0e0e0",
            textDecoration: "none",
            fontSize: "14px",
            position: "relative",
            bottom: 0,
            left: 0,
            right: 0,
        });
        mainImageArea.appendChild(cheekyLink);
    }
}
