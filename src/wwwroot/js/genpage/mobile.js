/**
 * Mobile UI Management Module
 *
 * This module handles the mobile user interface for a web application.
 * It includes functions for detecting mobile devices, managing UI elements,
 * handling user interactions, and optimizing the interface for mobile use.
 */

// Constants
const LONG_PRESS_DURATION = 500; // milliseconds

let vh = window.innerHeight * 0.01;

// Cache frequently accessed DOM elements for better performance
const inputSidebar = document.getElementById("input_sidebar");
const simpleInputSidebar = document.getElementById("simple_input_sidebar");
const bottomBar = document.getElementById("t2i_bottom_bar");
const tabContent = document.querySelector(".tab-content");
const mobileTabSelector = document.getElementById("mobile_tab_selector");
const genButtonMobile = document.getElementById("alt_generate_button_mobile");
const expandIndicator = document.getElementById("mobile_expand_indicator");

// Error handling wrapper
const safeExecute = (func, fallback = () => {}) => {
    try {
        return func();
    } catch (error) {
        console.error('Error in execution:', error);
        return fallback();
    }
};

/**
 * Mobile Detection Functions
 * These functions help determine if the user is on a mobile device.
 */
function isMobile () {
    return window.matchMedia("(max-width: 768px)").matches &&
        ("ontouchstart" in window ||
            navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0);
}
function isMobileUserAgent () {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}
function isIOS () {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isLikelyMobile () {
    return isMobile() || isMobileUserAgent();
}

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

// /**
//  * Toggles the visibility of an element
//  * @param {HTMLElement} element - The element to toggle
//  */
// function toggleElement (element) {
//     element.classList.toggle("closed");
//     element.style.height = element.classList.contains("closed")
//         ? "0px"
//         : "100%";
//     element.style.display = element.classList.contains("closed")
//         ? "none !important"
//         : "block !important";
//     element.style.paddingBottom = element.classList.contains("closed")
//         ? "0px"
//         : "150px";
// };

/**
 * Opens a specific flyout.
 * @param {HTMLElement} flyout - The flyout element to open.
 */
function openFlyout(flyout) {
    // First, close all other flyouts
    closeAllFlyouts();

    // Open the desired flyout if it's not already open
    if (flyout.classList.contains('closed')) {
        flyout.classList.remove('closed');
        flyout.style.height = "100%";
        flyout.style.display = "block";
        flyout.style.paddingBottom = "150px";
    }
}

/**
 * Closes a specific flyout.
 * @param {HTMLElement} flyout - The flyout element to close.
 */
function closeFlyout(flyout) {
    if (!flyout.classList.contains('closed')) {
        flyout.classList.add('closed');
        flyout.style.height = "0px";
        flyout.style.display = "none";
        flyout.style.paddingBottom = "0px";
    }
}

/**
 * Toggles the Input Sidebar flyout.
 */
function toggleInputSidebar() {
    if (inputSidebar.classList.contains('closed')) {
        openFlyout(inputSidebar);
    } else {
        closeFlyout(inputSidebar);
    }
}

/**
 * Toggles the Bottom Bar flyout.
 */
function toggleBottomBar() {
    if (bottomBar.classList.contains('closed')) {
        openFlyout(bottomBar);
    } else {
        closeFlyout(bottomBar);
    }
}

/**
 * Closes all open flyouts.
 */
function closeAllFlyouts() {
    const flyouts = document.querySelectorAll('.mobile-flyout');
    flyouts.forEach(flyout => {
        closeFlyout(flyout);
    });
}

/**
 * Scrolls the active element or window to the top
 */
function backToTop () {
    const element = document.querySelector(".mobile-flyout:not(.closed)") || tabContent || window;
    smoothScrollTo(element, 0, 300);
};

/**
 * Smooth scroll function using requestAnimationFrame
 * @param {HTMLElement} element - The element to scroll
 * @param {number} to - The target scroll position
 * @param {number} duration - The duration of the scroll animation
 */
function smoothScrollTo (element, to, duration) {
    const start = element.scrollTop;
    const change = to - start;
    let currentTime = 0;
    const increment = 20;

    const animateScroll = () => {
        currentTime += increment;
        const val = easeInOutQuad(currentTime, start, change, duration);
        element.scrollTop = val;
        if (currentTime < duration) {
            requestAnimationFrame(animateScroll);
        }
    };
    animateScroll();
};

/**
 * Easing function for smooth scrolling
 */
function easeInOutQuad (t, b, c, d) {
    t /= d/2;
    if (t < 1) return c/2*t*t + b;
    t--;
    return -c/2 * (t*(t-2) - 1) + b;
};

/**
 * Handles user actions on mobile, including long press detection
 * @param {HTMLElement} element - The element to attach the handler to
 * @param {Function} handler - The handler function for the action
 * @param {boolean} isLongPressEnabled - Whether long press should be enabled
 */
function handleAction (element, handler, isLongPressEnabled = false) {
    let touchStartTime;
    let hasMoved = false;
    let longPressTimer;

    const touchStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        touchStartTime = Date.now();
        hasMoved = false;
        if (isLongPressEnabled) {
            longPressTimer = setTimeout(() => {
                // Long press action (if needed)
            }, LONG_PRESS_DURATION);
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
        element.addEventListener("touchstart", touchStart);
        element.addEventListener("touchmove", touchMove, { passive: true });
        element.addEventListener("touchend", touchEnd);
    } else {
        element.addEventListener("click", (e) => !hasMoved && handler(e));
    }
};

/**
 * Disables zoom on text fields for iOS devices
 */
function disableIosTextFieldZoom () {
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
function initializeMobileUI () {
    console.log("Initializing mobile UI...");
    if (isLikelyMobile()) {
        safeExecute(setupTabSelector);
        safeExecute(watchForClassAndHideModalTags);
        safeExecute(setupMobileUI);
    }
};

/**
 * Sets up the mobile tab selector
 */
function setupTabSelector () {
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
function setupMobileUI () {
    safeExecute(() => {
        // Use MutationObserver to watch for version_display
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const versionDisplay = document.getElementById("version_display");
                    if (versionDisplay) {
                        versionDisplay.style.display = "none";
                        observer.disconnect(); // Stop observing once we've hidden the element
                    }
                }
            });
        });

        // Start observing the document body for changes
        observer.observe(document.body, { childList: true, subtree: true });

        document.getElementById("popover_generate")?.style.setProperty("display", "none");
        inputSidebar?.classList.add("mobile-flyout", "closed");

        setupFlyout(bottomBar, toggleBottomBar);
        setupFlyout(inputSidebar, toggleInputSidebar);
        setupBackToTopButton();
        setupGenButtonMobile();
        setupMobileViewHeight();
        setupBottomNavigationBar();
        setupFab();
        setupCopyrightMessage();
    });
};

/**
 * Sets up a flyout element
 * @param {HTMLElement} element - The element to set up as a flyout
 * @param {Function} toggleFunction - The function to toggle the flyout
 */
function setupFlyout (element, toggleFunction) {
    if (element) {
        element.classList.add("mobile-flyout", "closed");
        styleElement(element);
    }
};

/**
 * Updates the z-index of flyout elements
 * @param {string} selectedFlyoutId - The ID of the selected flyout
 */
function updateFlyoutZIndex (selectedFlyoutId) {
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
function styleElement (element) {
    Object.assign(element.style, {
        lineHeight: "1.5",
        display: "block !important",
        transition: "height 0.3s ease 0s",
        backgroundColor: "rgb(26, 26, 26)",
        boxShadow: "rgba(0, 255, 255, 0.1) 0px -5px 15px",
        color: "rgb(255, 255, 255)",
        position: "absolute",
        top: 0,
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
function setupBackToTopButton () {
    document
        .getElementById("btn-back-to-top")
        ?.addEventListener("click", backToTop, { passive: true });
};

/**
 * Sets up the mobile generate button
 */
function setupGenButtonMobile () {
    if (genButtonMobile) {
        handleAction(genButtonMobile, handleGenerateClickMobile, true);
    }
};

/**
 * Handles the generate button click on mobile
 * @param {Event} event - The click event
 */
const handleGenerateClickMobile = (event) => {
    closeAllFlyouts(); // Close all open flyouts
    mainGenHandler.doGenerateButton(event);
    backToTop();
};

let isUpdatingExtras = false;

function setupMobileCurrentImageExtras () {
    if (isUpdatingExtras) return;
    isUpdatingExtras = true;

    const current_image = document.getElementById("current_image");
    if (!current_image) return;

    // Add the extras wrapper
    const extrasWrapper = document.getElementById(
        "current-image-extras-wrapper"
    );

    if (!extrasWrapper) {
        isUpdatingExtras = false;
        return;
    }
    const currentImageData = extrasWrapper.querySelector(".current-image-data");

    // Get all children of the parent element
    if (currentImageData && currentImageData.children.length > 0) {
        let children = currentImageData.querySelectorAll(":scope > *");

        currentImageData.innerHTML = "";
        children.forEach(function (item) {
            currentImageData.appendChild(item);
        });
    }

    if (!extrasWrapper.classList.contains("open")) {
        extrasWrapper.classList.add("closed");
    }

    if (!current_image.querySelector("#mobile_expand_indicator")) {
        let newExpandIndicator = document.createElement("div");
        newExpandIndicator.id = "mobile_expand_indicator";
        newExpandIndicator.className = "mobile-expand-indicator";
        newExpandIndicator.textContent = "▲ More Info";
        handleAction(newExpandIndicator, function () {
            extrasWrapper.classList.toggle("open");
            extrasWrapper.classList.toggle("closed");
            newExpandIndicator.classList.toggle("expanded");
            newExpandIndicator.textContent = extrasWrapper.classList.contains(
                "open"
            )
                ? "▼ Less Info"
                : "▲ More Info";
        });
        current_image.appendChild(newExpandIndicator);
    }

    current_image.appendChild(extrasWrapper);
    // Set up the toggle action
    handleAction(expandIndicator, function () {
        extrasWrapper.classList.toggle("closed");
        expandIndicator.classList.toggle("expanded");
        expandIndicator.textContent = extrasWrapper.classList.contains("closed")
            ? "▼ Less Info"
            : "▲ More Info";
    });

    isUpdatingExtras = false;
};

const currentImage = document.getElementById("current_image");

if (currentImage) {
    let isSettingUp = false;
    const observer = new MutationObserver((mutations) => {
        if (!isSettingUp) {
            isSettingUp = true;
            setupMobileCurrentImageExtras();
            setTimeout(() => {
                isSettingUp = false;
            }, 0);
        }
    });

    observer.observe(currentImage, { childList: true });
}

/**
 * Switches the mobile tab
 * @param {Event} e - The change event
 */
function switchMobileTab (e)  {
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

function watchForClassAndHideModalTags() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
                mutation.addedNodes.forEach((node) => {
                    if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        node.classList.contains("imageview_modal_inner_div")
                    ) {
                        const imageviewModalInnerDiv = document.querySelector(
                            ".imageview_modal_inner_div"
                        );
                        if (imageviewModalInnerDiv) {
                            imageviewModalInnerDiv.lastElementChild.style.display =
                                "none";
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function setupMobileViewHeight() {
    document.documentElement.style.setProperty("--vh", `${vh}px`);

    window.addEventListener("resize", () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    });
}

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

/**
 * Sets up the Bottom Navigation Bar with a central gap for the FAB
 */
function setupBottomNavigationBar() {
    const navBarHTML = `
        <nav id="bottom-navigation-bar" class="bottom-navigation-bar">
            <div class="nav-left">
                <button data-action="toggleInputSidebar" class="nav-button">
                    <i class="bi bi-pencil-square"></i>
                    <span>Inputs</span>
                </button>
                <button data-action="toggleBottomBar" class="nav-button">
                    <i class="bi bi-tools"></i>
                    <span>Extras</span>
                </button>
            </div>
            <div class="nav-center">
                <!-- Central gap for FAB -->
            </div>
            <div class="nav-right">
                <button data-action="showOptions" class="nav-button">
                    <i class="bi bi-gear-wide-connected"></i>
                    <span>Options</span>
                </button>
                <button data-action="interrupt" class="nav-button">
                    <i class="bi bi-stop-circle"></i>
                    <span>Interrupt</span>
                </button>
            </div>
        </nav>
    `;

    document.body.insertAdjacentHTML("beforeend", navBarHTML);

    const navBar = document.getElementById("bottom-navigation-bar");
    if (navBar) {
        Object.assign(navBar.style, {
            position: "fixed",
            bottom: "0",
            left: "0",
            width: "100%",
            height: "60px",
            backgroundColor: "#2a2a2a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 20px",
            boxShadow: "0 -1px 5px rgba(0, 0, 0, 0.3)",
            zIndex: "1001",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
        });

        const navLeft = navBar.querySelector('.nav-left');
        const navRight = navBar.querySelector('.nav-right');
        const navCenter = navBar.querySelector('.nav-center');

        [navLeft, navRight].forEach(section => {
            Object.assign(section.style, {
                display: "flex",
                gap: "20px",
                alignItems: "center",
            });
        });

        Object.assign(navCenter.style, {
            width: "70px",
            position: "relative",
        });

        const buttons = navBar.querySelectorAll('.nav-button');
        buttons.forEach(button => {
            Object.assign(button.style, {
                background: "none",
                border: "none",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: "12px",
                cursor: "pointer",
            });

            const icon = button.querySelector('i');
            if (icon) {
                Object.assign(icon.style, {
                    fontSize: "15px",
                    marginBottom: "4px",
                });
            }
        });

        navBar.addEventListener('click', (e) => {
            if (e.target.closest('.nav-button')) {
                const action = e.target.closest('.nav-button').dataset.action;
                handleNavBarAction(action);
            }
        });
    }
};

/**
 * Handles actions triggered from the Bottom Navigation Bar
 * @param {string} action - The action identifier
 */
function handleNavBarAction (action) {
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
        default:
            console.warn(`Unhandled action: ${action}`);
    }
};

/**
 * Sets up the Floating Action Button (FAB) in the center of the Bottom Navigation Bar
 */
function setupFab() {
    if (genButtonMobile) {
        Object.assign(genButtonMobile.style, {
            position: "fixed",
            bottom: "15px !important", // Half of navbar height to overlap
            left: "47%",
            transform: "translateX(-50%)",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "#6200ee",
            color: "#fff",
            border: "none",
            boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
            zIndex: "1002", // Above the nav bar
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
        });

        // Add FAB icon (using Bootstrap Icons)
        genButtonMobile.innerHTML = '<i class="bi bi-plus-lg"></i>';

        // Handle FAB click
        handleAction(genButtonMobile, handleGenerateClickMobile, true);
    }
};

/**
 * Closes all flyouts when the user clicks or taps outside of them.
 */
document.addEventListener('click', (event) => {
    const isFlyoutButton = event.target.closest('.nav-button');
    const isFab = event.target.closest('#genButtonMobile');
    const isFlyout = event.target.closest('.mobile-flyout');

    if (!isFlyoutButton && !isFab && !isFlyout) {
        closeAllFlyouts();
    }
});
