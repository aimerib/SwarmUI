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
    element.classList.toggle("closed");
    element.style.height = element.classList.contains("closed")
        ? "0px"
        : "100%";
    element.style.display = element.classList.contains("closed")
        ? "none !important"
        : "block !important";
    element.style.paddingBottom = element.classList.contains("closed")
        ? "0px"
        : "150px";
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

// /**
//  * Creates the mobile menu structure
//  * @returns {HTMLElement} - The created mobile menu element
//  */
// const createMobileMenu = () => {
//     const menu = document.createElement("div");
//     menu.className = "mobile-menu";
//     menu.innerHTML = `
//         <div class="mobile-menu-buttons">
//             <button data-action="toggleInputSidebar">Inputs</button>
//             <button data-action="toggleBottomBar">Extras</button>
//             <button data-action="showOptions">Options</button>
//             <button data-action="interrupt">Interrupt</button>
//             <button data-action="backToTop">Top</button>
//         </div>
//     `;
//     menu.querySelectorAll("button").forEach((button) => {
//         handleAction(button, () => {
//             const action = button.dataset.action;
//             if (action) {
//                 switch (action) {
//                     case "toggleInputSidebar":
//                         toggleInputSidebar();
//                         updateFlyoutZIndex("input_sidebar");
//                         break;
//                     case "toggleBottomBar":
//                         toggleBottomBar();
//                         updateFlyoutZIndex("t2i_bottom_bar");
//                         break;
//                     case "showOptions":
//                         doPopover("generate_center");
//                         break;
//                     case "interrupt":
//                         mainGenHandler.doInterrupt();
//                         break;
//                     case "backToTop":
//                         backToTop();
//                         break;
//                 }
//             }
//             menu.parentElement.removeChild(menu);
//         });
//     });
//     return menu;
// };

// /**
//  * Displays the mobile menu
//  */
// const showMobileMenu = () => {
//     const menu = createMobileMenu();
//     const rect = genButtonMobile.getBoundingClientRect();
//     Object.assign(menu.style, {
//         position: "fixed",
//         left: `${rect.left - 70}px`,
//         top: `${rect.top - 200}px`,
//         zIndex: "1050",
//     });

//     document.body.appendChild(menu);

//     const closeMenu = (e) => {
//         if (menu && !menu.contains(e.target) && e.target !== genButtonMobile) {
//             if (menu.parentElement) menu.parentElement.removeChild(menu);
//             document.removeEventListener("click", closeMenu);
//             document.removeEventListener("touchstart", closeMenu);
//         }
//     };

//     setTimeout(
//         () =>
//             addMultipleEventListeners(
//                 document,
//                 ["click", "touchstart"],
//                 closeMenu
//             ),
//         0
//     );
// };

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

    /**
     * Handles user actions on mobile, including long press detection
     * @param {TouchEvent} e - The payload sent by the touch event
     */
    const touchStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    /**
     * Handles user actions on mobile, including long press detection
     * @param {TouchEvent} e - The payload sent by the touch event
     */
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
    watchForClassAndHideModalTags();
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
    // This is a hack needed for iOS to ensure correct viewport sizing accounting for the address bottom bar
    setupMobileViewHeight();
    setupNavigationDrawer();
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
    // const dragArea = document.createElement("div");
    // dragArea.innerHTML = "&#9660;";
    // Object.assign(dragArea.style, {
    //     width: "100%",
    //     height: "30px",
    //     backgroundColor: "#2a2a2a",
    //     textAlign: "center",
    //     lineHeight: "30px",
    //     color: "var(--emphasis)",
    //     cursor: "pointer",
    //     borderBottom: "1px solid #3a3a3a",
    //     transition: "all 0.3s ease",
    // });
    // handleAction(dragArea, toggleFunction);
    // element.insertBefore(dragArea, element.firstChild);
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
        // paddingBottom: "70px",
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
function watchForClassAndHideModalTags() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("imageview_modal_inner_div")) {
                        const imageviewModalInnerDiv = document.querySelector(".imageview_modal_inner_div");
                        if (imageviewModalInnerDiv) {
                            imageviewModalInnerDiv.lastElementChild.style.display = "none";
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
let isUpdatingExtras = false;

const setupMobileCurrentImageExtras = () => {
    console.log("Setting up mobile current image extras");
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
    const currentImageData = extrasWrapper.querySelector(
        ".current-image-data"
    );

    // Get all children of the parent element
    if (currentImageData && currentImageData.children.length > 0) {
        let children = currentImageData.querySelectorAll(':scope > *');

        currentImageData.innerHTML = "";
        children.forEach(function(item) {
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
    currentImage.addEventListener(
        "DOMNodeInserted",
        setupMobileCurrentImageExtras
    );
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

function setupNavigationDrawer() {
    const drawerHTML = `
        <div id="mobile-nav-drawer" class="mobile-nav-drawer">
            <div class="drawer-handle">
                <div class="drawer-icon">
                    <i class="bi bi-chevron-compact-up"></i>
                </div>
            </div>
            <nav class="drawer-content">
                <button data-action="toggleInputSidebar">Inputs</button>
                <button data-action="toggleBottomBar">Extras</button>
                <button data-action="showOptions">Options</button>
                <button data-action="interrupt">Interrupt</button>
                <button data-action="backToTop">Top</button>
            </nav>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", drawerHTML);

    const drawer = document.getElementById("mobile-nav-drawer");
    Object.assign(drawer.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100%",
        backgroundColor: "#2a2a2a",
        transition: "transform 0.3s ease-out",
        transform: "translateY(calc(100% - 50px))",
        zIndex: "1000",
        boxShadow: "0px 8px 10px 1px hsla(0,0%,0%,0.14),0px 3px 14px 2px hsla(0,0%,0%,0.12),0px 5px 5px -3px hsla(0,0%,0%,0.2)",
    });

    drawer.querySelectorAll("button").forEach((button) => {
        handleAction(button, () => {
            const action = button.dataset.action;
            if (action) {
                switch (action) {
                    case "toggleInputSidebar":
                        toggleInputSidebar();
                        updateFlyoutZIndex("input_sidebar");
                        drawer?.classList.toggle("open");
                        drawer?.classList.contains("open")
                            ? (drawer.style.transform =
                                  "translateY(calc(100% + -170px))")
                            : (drawer.style.transform =
                                  "translateY(calc(100% - 50px))");
                        updateDrawerIcon("flyout-open");
                        break;
                    case "toggleBottomBar":
                        toggleBottomBar();
                        updateFlyoutZIndex("t2i_bottom_bar");
                        drawer?.classList.toggle("open");
                        drawer?.classList.contains("open")
                            ? (drawer.style.transform =
                                  "translateY(calc(100% + -170px))")
                            : (drawer.style.transform =
                                  "translateY(calc(100% - 50px))");
                        updateDrawerIcon("flyout-open");
                        break;
                    case "showOptions":
                        doPopover("generate_center");
                        drawer?.classList.toggle("open");
                        drawer?.classList.contains("open")
                            ? (drawer.style.transform =
                                  "translateY(calc(100% + -170px))")
                            : (drawer.style.transform =
                                  "translateY(calc(100% - 50px))");
                        updateDrawerIcon("closed");
                        break;
                    case "interrupt":
                        mainGenHandler.doInterrupt();
                        drawer?.classList.toggle("open");
                        drawer?.classList.contains("open")
                            ? (drawer.style.transform =
                                  "translateY(calc(100% + -170px))")
                            : (drawer.style.transform =
                                  "translateY(calc(100% - 50px))");
                        updateDrawerIcon("closed");
                        break;
                    case "backToTop":
                        backToTop();
                        drawer?.classList.toggle("open");
                        drawer?.classList.contains("open")
                            ? (drawer.style.transform =
                                  "translateY(calc(100% + -170px))")
                            : (drawer.style.transform =
                                  "translateY(calc(100% - 50px))");
                        updateDrawerIcon("closed");
                        break;
                }
            }
            // menu.parentElement.removeChild(menu);
        });
    });

    const handle = drawer.querySelector(".drawer-handle");
    Object.assign(handle.style, {
        height: "50px",
        backgroundColor: "#2a2a2a",
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "20px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
    });

    const icon = handle.querySelector(".drawer-icon");
    Object.assign(icon.style, {
        width: "50px",
        height: "50px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "24px",
        color: "#fff",
        transition: "transform 0.3s ease",
    });

    const content = drawer.querySelector(".drawer-content");
    Object.assign(content.style, {
        padding: "20px",
        maxHeight: "calc(30dvh - 50px)",
        overflowY: "auto",
    });
    document.body.insertAdjacentHTML("beforeend", drawerHTML);
    handleAction(handle, () => {
        console.log("Drawer handle clicked");
        const bottomBar = document.getElementById("t2i_bottom_bar");
        const inputSidebar = document.getElementById("input_sidebar");

        if (
            !bottomBar?.classList.contains("closed") ||
            !inputSidebar?.classList.contains("closed")
        ) {
            console.log("Closing open flyouts");
            if (!bottomBar?.classList.contains("closed")) {
                toggleBottomBar();
            }
            if (!inputSidebar?.classList.contains("closed")) {
                toggleInputSidebar();
            }
            drawer.style.transform = "translateY(calc(100% - 50px))";
            drawer.classList.remove("open");
            updateDrawerIcon("closed");
        } else {
            console.log("Toggling drawer");
            drawer.classList.toggle("open");
            if (drawer.classList.contains("open")) {
                drawer.style.transform = "translateY(calc(100% + -170px))";
                updateDrawerIcon("open");
            } else {
                drawer.style.transform = "translateY(calc(100% - 50px))";
                updateDrawerIcon("closed");
            }
        }
    });
}

const updateDrawerIcon = (currState) => {
    const drawerStates = {
        "flyout-open": "bi bi-x",
        open: "bi bi-chevron-compact-down",
        closed: "bi bi-chevron-compact-up",
    };
    const icon = document.querySelector("#mobile-nav-drawer .drawer-icon i");
    icon.className = drawerStates[currState];
};
