/**
 * Hack to attempt to prevent callback recursion.
 * In practice this seems to not work.
 * Either JavaScript itself or Firefox seems to really love tracking the stack and refusing to let go.
 * TODO: Guarantee it actually works so we can't stack overflow from file browsing ffs.
 */
class BrowserCallHelper {
    constructor(path, loadCaller, delay = 300) {
        this.path = path;
        this.loadCaller = loadCaller;
        this.delay = delay;
        this.timeout = null;
    }

    call() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.loadCaller(this.path);
            this.timeout = null;
        }, this.delay);
    }
}

/**
 * Part of a browser tree.
 */
class BrowserTreePart {
    constructor(
        name,
        children,
        hasOpened,
        isOpen,
        fileData = null,
        fullPath = ""
    ) {
        this.name = name;
        this.children = children;
        this.hasOpened = hasOpened;
        this.isOpen = isOpen;
        this.fileData = fileData;
        this.fullPath = fullPath.startsWith("/")
            ? fullPath.substring(1)
            : fullPath;
    }
}

/**
 * Class that handles browsable content sections (eg models list, presets list, etc).
 */
class GenPageBrowserClass {
    constructor(
        container,
        listFoldersAndFiles,
        id,
        defaultFormat,
        describe,
        select,
        extraHeader = "",
        defaultDepth = 3
    ) {
        this.container = getRequiredElementById(container);
        this.listFoldersAndFiles = listFoldersAndFiles;
        this.id = id;
        this.format =
            localStorage.getItem(`browser_${this.id}_format`) ||
            getCookie(`${id}_format`) ||
            defaultFormat; // TODO: Remove the old cookie
        this.describe = describe;
        this.select = select;
        this.folder = "";
        this.selected = null;
        this.extraHeader = extraHeader;
        this.navCaller = this.navigate.bind(this);
        this.tree = new BrowserTreePart("", {}, false, true, null, "");
        this.depth =
            localStorage.getItem(`browser_${id}_depth`) || defaultDepth;
        this.filter = localStorage.getItem(`browser_${id}_filter`) || "";
        this.folderTreeVerticalSpacing = "0";
        this.splitterMinWidth = 100;
        this.everLoaded = false;
        this.showDisplayFormat = true;
        this.showDepth = true;
        this.showRefresh = true;
        this.showUpFolder = true;
        this.showFilter = true;
        this.folderTreeShowFiles = false;
        this.folderSelectedEvent = null;
        this.builtEvent = null;
        this.sizeChangedEvent = null;
        this.maxPreBuild = 512;
        this.chunksRendered = 0;
        this.rerenderPlanned = false;
        this.updatePendingSince = null;
        this.wantsReupdate = false;
        this.describe = describe;
        this.items = [];
        this.allItems = [];
        this.filteredItems = [];
        this.itemsPerPage = 10;
        this.currentPage = 1;
        this.totalPages = 0;
        this.initialLoadDone = false;
        this.isNavigating = false;
        this.currentSortMethod = "name";
    }

    /**
     * Navigates the browser to a given folder path.
     */
    navigate(folder, callback = null) {
        this.chunksRendered = 0;
        this.folder = folder;
        this.selected = null;
        this.update(false, callback);
    }

    /**
     * Updates/refreshes the browser view.
     */
    update(isRefresh = false, callback = null) {
        this.updatePendingSince = new Date().getTime();
        if (isRefresh) {
            this.tree = new BrowserTreePart("", {}, false, null, null, "");
            this.contentDiv.scrollTop = 0;
        }
        this.listFoldersAndFiles(
            this.folder,
            isRefresh,
            (folders, files) => {
                this.allItems = files;
                if (this.allItems.length === 0 && folders.length > 0) {
                    this.fetchFilesFromSubfolders(folders, 0);
                } else {
                    this.centralizePaginationAndFiltering();
                    this.build(this.folder, folders, this.filteredItems);
                    this.updatePendingSince = null;
                    if (callback) {
                        setTimeout(() => callback(), 100);
                    }
                    if (this.wantsReupdate) {
                        this.wantsReupdate = false;
                        this.update();
                    }
                }
            },
            this.depth
        );
    }

    /**
     * Refreshes the browser view from source.
     */
    refresh() {
        refreshParameterValues(true, () => {
            this.chunksRendered = 0;
            let path = this.folder;
            this.update(true, () => {
                this.clickPath(path);
            });
        });
    }

    updateWithoutDup() {
        if (
            this.updatePendingSince &&
            new Date().getTime() - this.updatePendingSince < 5000
        ) {
            this.wantsReupdate = true;
            return;
        }
        this.update();
    }

    /**
     * Updates tree tracker for the given path.
     */
    refillTree(path, folders, isFile = false) {
        if (path.endsWith("/")) {
            path = path.substring(0, path.length - 1);
        }
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        let otherFolders = folders.filter((f) => f.includes("/"));
        if (otherFolders.length > 0) {
            let baseFolders = folders.filter((f) => !f.includes("/"));
            this.refillTree(path, baseFolders, isFile);
            while (otherFolders.length > 0) {
                let folder = otherFolders[0];
                let slash = folder.indexOf("/");
                let base = folder.substring(0, slash + 1);
                let same = otherFolders
                    .filter((f) => f.startsWith(base))
                    .map((f) => f.substring(base.length));
                this.refillTree(`${path}/${base}`, same, isFile);
                otherFolders = otherFolders.filter((f) => !f.startsWith(base));
            }
            return;
        }
        if (path == "") {
            let copy = Object.assign({}, this.tree.children);
            this.tree.children = {};
            for (let folder of folders) {
                this.tree.children[folder] =
                    copy[folder] ||
                    new BrowserTreePart(
                        folder,
                        {},
                        isFile,
                        false,
                        isFile ? this.getFileFor(folder) : null,
                        folder
                    );
            }
            this.tree.hasOpened = true;
            return;
        }
        let tree = this.tree,
            parent = this.tree;
        let parts = path.split("/");
        for (let part of parts) {
            parent = tree;
            if (!(part in parent.children)) {
                parent.children[part] = new BrowserTreePart(
                    part,
                    {},
                    false,
                    false,
                    null,
                    parent.fullPath + "/" + part
                );
            }
            tree = parent.children[part];
        }
        let lastName = parts[parts.length - 1];
        let copy = Object.assign({}, tree.children);
        tree = new BrowserTreePart(
            lastName,
            {},
            true,
            tree.isOpen,
            null,
            tree.fullPath
        );
        parent.children[lastName] = tree;
        for (let folder of folders) {
            tree.children[folder] =
                copy[folder] ||
                new BrowserTreePart(
                    folder,
                    {},
                    isFile,
                    false,
                    isFile
                        ? this.getFileFor(tree.fullPath + "/" + folder)
                        : null,
                    tree.fullPath + "/" + folder
                );
        }
    }

    fetchFilesFromSubfolders(folders, currentDepth) {
        if (currentDepth >= this.depth || folders.length === 0) {
            this.centralizePaginationAndFiltering();
            this.build(this.folder, folders, this.filteredItems);
            this.updatePendingSince = null;
            return;
        }

        let filesFromSubfolders = [];
        let foldersToCheck = [];
        let foldersChecked = 0;

        for (let folder of folders) {
            let subfolderPath = this.path ? `${this.path}/${folder}` : folder;
            this.listFoldersAndFiles(
                subfolderPath,
                false,
                (subFolders, subFiles) => {
                    filesFromSubfolders = filesFromSubfolders.concat(subFiles);
                    foldersToCheck = foldersToCheck.concat(
                        subFolders.map((sf) => `${folder}/${sf}`)
                    );
                    foldersChecked++;

                    if (foldersChecked === folders.length) {
                        this.allItems =
                            this.allItems.concat(filesFromSubfolders);
                        if (
                            this.allItems.length === 0 &&
                            foldersToCheck.length > 0
                        ) {
                            this.fetchFilesFromSubfolders(
                                foldersToCheck,
                                currentDepth + 1
                            );
                        } else {
                            this.centralizePaginationAndFiltering();
                            this.build(this.path, folders, this.filteredItems);
                            this.updatePendingSince = null;
                        }
                    }
                },
                this.depth - currentDepth
            );
        }
    }

    getFolderFromPath(tree, path) {
        let parts = path.split("/").filter(Boolean);
        let currentFolder = tree;
        for (let part of parts) {
            if (currentFolder.children && currentFolder.children[part]) {
                currentFolder = currentFolder.children[part];
            } else {
                return null;
            }
        }
        return currentFolder;
    }

    /**
     * Clicks repeatedly into a path to fully open it.
     */
    clickPath(path) {
        let tree = this.tree;
        if (!tree.isOpen) {
            tree.clickme(() => {
                this.clickPath(path, tree);
            });
            return;
        }
        if (path.length == 0) {
            return;
        }
        let split = path.split("/");
        for (let part of split) {
            if (part == "") {
                continue;
            }
            if (!(part in tree.children)) {
                return;
            }
            tree = tree.children[part];
            if (!tree.isOpen) {
                tree.clickme(() => {
                    this.clickPath(path);
                });
                return;
            }
        }
    }

    /**
     * Generates the path list span for the current path view, and returns it.
     */
    genPath(path, upButton) {
        let pathGen = createSpan(`${this.id}-path`, "browser-path");
        if (path == "") {
            upButton.disabled = true;
            return pathGen;
        }
        let rootPathPrefix = "Root/";
        let partial = "";
        for (let part of (rootPathPrefix + path).split("/")) {
            partial += part + "/";
            let span = document.createElement("span");
            span.className = "path-list-part";
            span.innerText = part;
            let route = partial.substring(rootPathPrefix.length);
            let helper = new BrowserCallHelper(route, this.navCaller);
            span.onclick = helper.call.bind(helper);
            pathGen.appendChild(span);
            pathGen.appendChild(document.createTextNode("/"));
        }
        upButton.disabled = false;
        let above = path.split("/").slice(0, -1).join("/");
        let helper = new BrowserCallHelper(above, this.navCaller);
        upButton.onclick = helper.call.bind(helper);
        return pathGen;
    }

    updateDisplayedItems(reverse = false) {
        this.centralizePaginationAndFiltering(reverse);
        this.build(this.lastPath, null, this.filteredItems);
    }

    updateTotalPages() {
        this.totalPages = Math.ceil(
            this.filteredItems.length / this.itemsPerPage
        );
    }

    renderPaginationControls() {
        const paginationDiv = document.createElement("div");
        paginationDiv.className = "pagination-controls";

        const createPageButton = (page, isActive = false) => {
            const button = document.createElement("button");
            button.textContent = page;
            button.className = "page-button";
            if (isActive) {
                button.classList.add("active");
                button.addEventListener("click", () => {
                    const newPage = prompt("Enter page number:", this.currentPage);
                    if (newPage && !isNaN(newPage) && newPage > 0 && newPage <= this.totalPages) {
                        this.currentPage = parseInt(newPage);
                        this.centralizePaginationAndFiltering();
                        this.build(this.lastPath, null, this.filteredItems);
                    }
                });
            } else {
                button.addEventListener("click", () => {
                    this.currentPage = page;
                    this.centralizePaginationAndFiltering();
                    this.build(this.lastPath, null, this.filteredItems);
                });
            }
            return button;
        };

        const createEllipsis = () => {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.className = "pagination-ellipsis";
            return ellipsis;
        };

        const prevButton = document.createElement("button");
        prevButton.textContent = "←";
        prevButton.className = "nav-button prev-button";
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener("click", () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.centralizePaginationAndFiltering();
                this.build(this.lastPath, null, this.filteredItems);
            }
        });
        paginationDiv.appendChild(prevButton);

        if (this.currentPage!== 1) {
            paginationDiv.appendChild(createPageButton(1));
        }

        const totalButtons = 5; // Total buttons to display (including ellipsis)
        const sideButtons = 1; // Buttons on each side of the center

        if (this.totalPages <= totalButtons) {
            // If total pages fit within the display, show all pages
            for (let i = 2; i < this.totalPages; i++) {
                paginationDiv.appendChild(createPageButton(i, i === this.currentPage));
            }
        } else {
            const leftMost = Math.max(2, this.currentPage - sideButtons);
            const rightMost = Math.min(this.totalPages - 1, this.currentPage + sideButtons);

            if (leftMost > 2) {
                paginationDiv.appendChild(createEllipsis());
            }
            for (let i = leftMost; i < this.currentPage; i++) {
                paginationDiv.appendChild(createPageButton(i));
            }

            // Current page (always in the center when possible)
            paginationDiv.appendChild(createPageButton(this.currentPage, true));

            for (let i = this.currentPage + 1; i <= rightMost; i++) {
                paginationDiv.appendChild(createPageButton(i));
            }
            if (rightMost < this.totalPages - 1) {
                paginationDiv.appendChild(createEllipsis());
            }
        }

        if (this.totalPages > 1 && this.currentPage!== this.totalPages) {
            paginationDiv.appendChild(createPageButton(this.totalPages));
        }

        const nextButton = document.createElement("button");
        nextButton.textContent = "→";
        nextButton.className = "nav-button next-button";
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.addEventListener("click", () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.centralizePaginationAndFiltering();
                this.build(this.lastPath, null, this.filteredItems);
            }
        });
        paginationDiv.appendChild(nextButton);

        return paginationDiv;
    }

    /**
     * Refreshes the page after a pagination click.
     */
    refreshPagination() {
        this.currentPage = 1;
        this.update();
        this.rerender();
    }

    applyFilter(reverse = false) {
        if (reverse) {
            this.allItems.reverse();
        }
        if (this.filter === "") {
            this.filteredItems = this.allItems;
            return;
        }
        this.filteredItems = this.allItems.filter((item) =>
            item.name.toLowerCase().includes(this.filter.toLowerCase())
        );
    }

    sortFiles() {
        this.filteredItems.sort((a, b) => {
            if (this.currentSortMethod === "name") {
                return b.name.localeCompare(a.name);
            } else if (this.currentSortMethod === "date") {
                return new Date(b.date) - new Date(a.date);
            }
        });
    }

    centralizePaginationAndFiltering(reverse = false) {
        this.applyFilter(reverse);
        this.sortFiles();
        this.updateTotalPages();
        if (this.currentPage > this.totalPages) {
            this.currentPage = 1;
        }
    }

    buildMobileTreeElements(container, path, tree) {
        container.innerHTML = "";

        const header = this.createHeader(path, tree);
        container.appendChild(header);

        const filterInput = this.createMobileHeader();
        // TODO: Continue from here. Fix filter/sort buttons
        // container.appendChild(filterInput);

        const content = createDiv(null, "mobile-file-browser-content");
        container.appendChild(content);

        this.populateMobileContent(content, path, tree);
    }

    createHeader(path, tree) {
        const header = createDiv(null, "mobile-file-browser-header");

        if (path !== "/" && path !== "") {
            const backButton = createSpan(null, "mobile-file-browser-back");
            backButton.innerHTML = "&larr;"; // Left arrow
            backButton.onclick = () => this.navigateUp(path);
            header.appendChild(backButton);
        }

        const folderName = createSpan(null, "mobile-file-browser-folder-name");
        folderName.textContent = tree.name || "Root";
        header.appendChild(folderName);

        return header;
    }

    populateMobileContent(container, path, tree) {
        for (let [name, subTree] of Object.entries(tree.children)) {
            const item = createDiv(null, "mobile-file-browser-item");

            const icon = createSpan(null, "mobile-file-browser-icon");
            icon.innerHTML = subTree.fileData ? "📄" : "📁";
            item.appendChild(icon);

            const itemName = createSpan(null, "mobile-file-browser-item-name");
            itemName.textContent = name;
            item.appendChild(itemName);

            item.onclick = () => {
                if (subTree.fileData) {
                    this.select(subTree.fileData, null);
                } else {
                    const newPath = path ? `${path}/${name}` : name;
                    this.debouncedNavigateMobile(newPath);
                }
            };

            container.appendChild(item);
        }
    }

    navigateUp() {
        const parts = this.path.split("/").filter(Boolean);
        let parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : parts.slice(0, -1).join("");
        this.debouncedNavigateMobile(parentPath);
    }

    navigateMobile(path, callback) {
        this.currentPage = 1;
        this.path = path;
        window.listFolders = this.listFoldersAndFiles.bind(this);
        this.listFoldersAndFiles(
            path,
            true,
            (folders, files) => {
                this.allItems = files;
                this.centralizePaginationAndFiltering();
                if (
                    this.filteredItems.length === 0 &&
                    this.allItems.length > 0
                ) {
                    this.filteredItems = this.allItems;
                }

                this.build(path, folders, this.filteredItems);

                if (callback) {
                    setTimeout(() => callback(), 100);
                }
                if (this.folderSelectedEvent) {
                    this.folderSelectedEvent(path);
                }
            },
            this.depth
        );
    }

    debouncedNavigateMobile = debounce(this.navigateMobile.bind(this), 100);

    createMobileHeader() {
        const mobileHeader = createDiv(
            `${this.id}-mobile-header`,
            "browser-mobile-header"
        );

        const sortSelect = document.createElement("select");
        sortSelect.id = `${this.id}_mobile_sort`;
        sortSelect.innerHTML = `
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date</option>
        `;

        const reverseButton = document.createElement("button");
        reverseButton.id = `${this.id}_mobile_reverse`;
        reverseButton.innerText = "Reverse";
        reverseButton.className = "mobile-reverse-button";

        const filterInput = document.createElement("input");
        filterInput.id = `${this.id}_mobile_filter`;
        filterInput.type = "text";
        filterInput.placeholder = "Filter...";
        filterInput.className = "mobile-filter-input";

        sortSelect.addEventListener("change", () => {
            this.currentSortMethod = sortSelect.value;
            this.updateDisplayedItems();
        });

        reverseButton.addEventListener("click", () => {
            this.updateDisplayedItems(true);
        });

        filterInput.addEventListener(
            "input",
            debounce(() => {
                this.filter = filterInput.value.toLowerCase();
                localStorage.setItem(`browser_${this.id}_filter`, this.filter);
                this.updateDisplayedItems();
            }, 300)
        );

        mobileHeader.appendChild(sortSelect);
        mobileHeader.appendChild(reverseButton);
        mobileHeader.appendChild(filterInput);

        return mobileHeader;
    }

    /**
     * Builds the element view of the folder tree.
     */
    buildTreeElements(container, path, tree, offset = 16, isRoot = true) {
        if (isLikelyMobile()) {
            return this.buildMobileTreeElements(container, path, tree);
        }
        if (isRoot) {
            let spacer = createDiv(null, "browser-folder-tree-spacer");
            spacer.style.height = this.folderTreeVerticalSpacing;
            container.appendChild(spacer);
        }
        let span = createSpan(
            `${this.id}-foldertree-${tree.name}`,
            "browser-folder-tree-part"
        );
        span.style.left = `${offset}px`;
        span.innerHTML = `<span class="browser-folder-tree-part-symbol" data-issymbol="true"></span> ${escapeHtml(
            tree.name || "Root"
        )}`;
        span.dataset.path = path;
        container.appendChild(span);
        if (
            (Object.keys(tree.children).length == 0 && tree.hasOpened) ||
            tree.fileData
        ) {
            // Default: no class
        } else if (tree.isOpen) {
            span.classList.add("browser-folder-tree-part-open");
            let subContainer = createDiv(
                `${this.id}-foldertree-${tree.name}-container`,
                "browser-folder-tree-part-container"
            );
            for (let subTree of Object.values(tree.children)) {
                this.buildTreeElements(
                    subContainer,
                    `${path}${subTree.name}/`,
                    subTree,
                    offset + 16,
                    false
                );
            }
            container.appendChild(subContainer);
        } else {
            span.classList.add("browser-folder-tree-part-closed");
        }
        let matchMe = this.selected || this.folder;
        if (matchMe == path || `${matchMe}/` == path) {
            span.classList.add("browser-folder-tree-part-selected");
        }
        if (tree.fileData) {
            span.onclick = (e) => {
                this.select(tree.fileData, null);
            };
            tree.clickme = (callback) => span.onclick(null);
        } else {
            let clicker = (isSymbol, callback) => {
                if (this.folderSelectedEvent) {
                    this.folderSelectedEvent(path);
                }
                tree.hasOpened = true;
                if (isSymbol) {
                    tree.isOpen = !tree.isOpen;
                } else {
                    tree.isOpen = true;
                }
                this.navigate(path, callback);
            };
            span.onclick = (e) => {
                clicker(e.target.dataset.issymbol, null);
            };
            tree.clickme = (callback) => {
                clicker(false, callback);
            };
        }
        tree.span = span;
    }

    isBottomBarVisible() {
        const bottomBar = document.getElementById("t2i_bottom_bar");
        return bottomBar && !bottomBar.classList.contains("closed");
    }

    /**
     * Schedules a rerender with a small delay.
     */
    planRerender(timeout) {
        if (this.rerenderPlanned) {
            return;
        }
        this.rerenderPlanned = true;
        setTimeout(() => {
            this.rerenderPlanned = false;
            this.rerender();
        }, timeout);
    }

    /**
     * Fills the container with the content list.
     */
    buildContentList(container, files, before = null, startId = 0) {
        if (isLikelyMobile()) container.innerHTML = "";

        if (this.totalPages > 1 && isLikelyMobile()) {
            const paginationControlsTop = this.renderPaginationControls();
            container.appendChild(paginationControlsTop);
        }

        let id = startId;
        let maxBuildNow = this.maxPreBuild;

        if (startId == 0) {
            maxBuildNow +=
                this.chunksRendered * Math.min(this.maxPreBuild / 2, 100);
            this.chunksRendered = 0;
        } else {
            this.chunksRendered++;
        }
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            id++;
            let desc = this.describe(file);
            if (
                this.filter &&
                !desc.searchable.toLowerCase().includes(this.filter)
            ) {
                continue;
            }
            if (i > maxBuildNow) {
                let remainingFiles = files.slice(i);
                while (remainingFiles.length > 0) {
                    let chunkSize = Math.min(
                        this.maxPreBuild / 2,
                        remainingFiles.length,
                        100
                    );
                    let chunk = remainingFiles.splice(0, chunkSize);
                    remainingFiles = remainingFiles.slice(chunkSize);
                    let sectionDiv = createDiv(
                        null,
                        "lazyload browser-section-loader"
                    );
                    sectionDiv.onclick = () => {
                        this.buildContentList(container, chunk, sectionDiv, id);
                    };
                    container.appendChild(sectionDiv);
                }
                break;
            }
            let div = createDiv(null, `${desc.className}`);
            let popoverId = `${this.id}-${id}`;
            if (desc.buttons.length > 0) {
                let menuDiv = createDiv(
                    `popover_${popoverId}`,
                    "sui-popover sui_popover_model"
                );
                for (let button of desc.buttons) {
                    let buttonElem;
                    if (button.href) {
                        buttonElem = document.createElement("a");
                        buttonElem.href = button.href;
                        if (button.is_download) {
                            buttonElem.download = "";
                        }
                    } else {
                        buttonElem = document.createElement("div");
                    }
                    buttonElem.className = "sui_popover_model_button";
                    buttonElem.innerText = button.label;
                    if (button.onclick) {
                        buttonElem.onclick = () => button.onclick(div);
                    }
                    menuDiv.appendChild(buttonElem);
                }
                if (before) {
                    container.insertBefore(menuDiv, before);
                } else {
                    container.appendChild(menuDiv);
                }
            }
            let img = document.createElement("img");
            img.addEventListener("click", () => {
                this.select(file, div);
            });
            div.appendChild(img);
            if (this.format.includes("Cards")) {
                div.className += " model-block model-block-hoverable";
                if (this.format.startsWith("Small")) {
                    div.classList.add("model-block-small");
                } else if (this.format.startsWith("Big")) {
                    div.classList.add("model-block-big");
                }
                let textBlock = createDiv(null, "model-descblock");
                textBlock.tabIndex = 0;
                textBlock.innerHTML = desc.description;
                div.appendChild(textBlock);
            } else if (this.format.includes("Thumbnails")) {
                div.className += " image-block"; // image-block-legacy
                let factor = 8;
                if (this.format.startsWith("Big")) {
                    factor = 15;
                    div.classList.add("image-block-big");
                } else if (this.format.startsWith("Giant")) {
                    factor = 25;
                    div.classList.add("image-block-giant");
                } else if (this.format.startsWith("Small")) {
                    factor = 5;
                    div.classList.add("image-block-small");
                }
                div.style.width = `${factor + 1}rem`;
                img.addEventListener("load", () => {
                    let ratio = img.width / img.height;
                    div.style.width = `${ratio * factor + 1}rem`;
                });
                let textBlock = createDiv(null, "image-preview-text");
                textBlock.innerText = desc.display || desc.name;
                if (this.format == "Small Thumbnails" || textBlock.innerText.length > 40) {
                    textBlock.classList.add('image-preview-text-small');
                }
                else if (textBlock.innerText.length > 20) {
                    textBlock.classList.add('image-preview-text-medium');
                }
                else {
                    textBlock.classList.add('image-preview-text-large');
                }
                div.appendChild(textBlock);
            } else if (this.format == "List") {
                div.className += " browser-list-entry";
                let textBlock = createSpan(null, "browser-list-entry-text");
                textBlock.innerText = desc.display || desc.name;
                textBlock.addEventListener("click", () => {
                    this.select(file);
                });
                div.appendChild(textBlock);
            }
            if (desc.buttons.length > 0) {
                let menu = createDiv(null, "model-block-menu-button");
                menu.innerHTML = "&#x2630;";
                menu.addEventListener("click", () => {
                    doPopover(popoverId);
                });
                div.appendChild(menu);
            }
            div.title = stripHtmlToText(desc.description);
            if (!isLikelyMobile()) img.classList.add("lazyload");
            img.src = desc.image;
            if (desc.dragimage) {
                img.addEventListener("dragstart", (e) => {
                    chromeIsDumbFileHack(
                        e.dataTransfer.files[0],
                        desc.dragimage
                    );
                    e.dataTransfer.clearData();
                    e.dataTransfer.setDragImage(img, 0, 0);
                    e.dataTransfer.setData("text/uri-list", desc.dragimage);
                });
            }
            if (before) {
                container.insertBefore(div, before);
            } else {
                container.appendChild(div);
            }
        }
        if (this.totalPages > 1 && isLikelyMobile()) {
            const paginationControlsBottom = this.renderPaginationControls();
            container.appendChild(paginationControlsBottom);
        }

        setTimeout(() => {
            this.makeVisible(container);
        }, 100);
    }

    /**
     * Make any visible images within a container actually load now.
     */
    makeVisible(elem) {
        for (let subElem of elem.querySelectorAll(".lazyload")) {
            let top = subElem.getBoundingClientRect().top;
            if (
                // !isLikelyMobile() &&
                top >= window.innerHeight + 512 ||
                top == 0
            ) {
                // Note top=0 means not visible
                continue;
            }
            subElem.classList.remove("lazyload");
            if (subElem.tagName == "IMG") {
                if (!subElem.dataset.src) {
                    continue;
                }
                subElem.src = subElem.dataset.src;
                delete subElem.dataset.src;
            } else if (subElem.classList.contains("browser-section-loader")) {
                subElem.click();
                subElem.remove();
            }
        }
    }

    getItemsForCurrentPage() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.items.slice(startIndex, endIndex);
    }

    renderPaginationControls() {
        const paginationDiv = document.createElement("div");
        paginationDiv.className = "pagination-controls";

        const createPageButton = (page) => {
            const button = document.createElement("button");
            button.textContent = page;
            button.className = "page-button";
            if (page === this.currentPage) {
                button.classList.add("active");
            }
            button.addEventListener("click", () => {
                this.currentPage = page;
                this.build(this.lastPath, null, this.lastFiles);
                this.updateWithoutDup();
                this.rerender();
            });
            return button;
        };

        const addEllipsis = () => {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.className = "pagination-ellipsis";
            paginationDiv.appendChild(ellipsis);
        };

        // Previous button
        const prevButton = document.createElement("button");
        prevButton.textContent = "←";
        prevButton.className = "nav-button prev-button";
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener("click", () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.build(this.lastPath, null, this.lastFiles);
                this.updateWithoutDup();
                this.rerender();
            }
        });
        paginationDiv.appendChild(prevButton);

        // First three pages
        for (let i = 1; i <= Math.min(2, this.totalPages); i++) {
            paginationDiv.appendChild(createPageButton(i));
        }

        if (this.totalPages > 6) {
            addEllipsis();

            // Middle button for manual page input
            const middleButton = document.createElement("button");
            middleButton.textContent = "...";
            middleButton.className = "page-button middle-button";
            middleButton.addEventListener("click", () => {
                const page = prompt("Enter page number:", this.currentPage);
                if (page && !isNaN(page) && page > 0 && page <= this.totalPages) {
                    this.currentPage = parseInt(page);
                    this.build(this.lastPath, null, this.lastFiles);
                    this.updateWithoutDup();
                    this.rerender();
                }
            });
            paginationDiv.appendChild(middleButton);

            addEllipsis();
        } else if (this.totalPages > 3) {
            addEllipsis();
        }

        // Last two pages
        for (let i = Math.max(this.totalPages - 1, 3); i <= this.totalPages; i++) {
            paginationDiv.appendChild(createPageButton(i));
        }

        // Next button
        const nextButton = document.createElement("button");
        nextButton.textContent = "→";
        nextButton.className = "nav-button next-button";
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.addEventListener("click", () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.build(this.lastPath, null, this.lastFiles);
                this.updateWithoutDup();
                this.rerender();
            }
        });
        paginationDiv.appendChild(nextButton);

        return paginationDiv;
    }

    /**
     * Triggers an immediate in-place rerender of the current browser view.
     */
    rerender() {
        if (this.lastPath != null) {
            this.build(this.lastPath, null, this.lastFiles);
        }
    }

    /**
     * Returns the file object for a given path.
     */
    getFileFor(path) {
        return this.lastFiles.find((f) => f.name == path);
    }

    /**
     * Central call to build the browser content area.
     */
    build(path, folders, files) {
        if (path !== "" && !path && this.lastPath) {
            path = this.lastPath;
        }
        if (path.endsWith("/")) {
            path = path.substring(0, path.length - 1);
        }
        let scrollOffset = 0;
        this.lastPath = path;
        if (folders) {
            this.refillTree(path, folders, false);
        } else if (folders == null && this.contentDiv) {
            scrollOffset = this.contentDiv.scrollTop;
        }
        if (files == null) {
            files = this.lastFiles;
        }
        this.lastFiles = files;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginatedFiles = this.filteredItems.slice(start, end);
        const filesToRender = isLikelyMobile() ? paginatedFiles : files;
        if (isLikelyMobile()) {
            if (files) {
                this.items = files;
                this.allItems = files;
                this.centralizePaginationAndFiltering();
            }
            if (filesToRender && this.folderTreeShowFiles) {
                this.refillTree(
                    path,
                    filesToRender.map((f) => {
                        let name = f.name.substring(path.length);
                        if (name.startsWith("/")) {
                            name = name.substring(1);
                        }
                        return name;
                    }),
                    true
                );
            }
            if (this.contentDiv) {
                this.contentDiv.innerHTML = "";
            } else {
                this.contentDiv = createDiv(
                    `${this.id}-content`,
                    "browser-content-container"
                );
            }
        } else if (filesToRender && this.folderTreeShowFiles) {
            this.refillTree(
                path,
                filesToRender.map((f) => {
                    let name = f.name.substring(path.length);
                    if (name.startsWith("/")) {
                        name = name.substring(1);
                    }
                    return name;
                }),
                true
            );
        }

        let folderScroll = this.folderTreeDiv
            ? this.folderTreeDiv.scrollTop
            : 0;
        if (!this.hasGenerated) {
            this.hasGenerated = true;
            this.container.innerHTML = "";
            this.folderTreeDiv = createDiv(
                `${this.id}-foldertree`,
                "browser-folder-tree-container"
            );
            this.folderTreeDiv.classList.add("navbarToggler");
            // this.folderTreeDiv.classList.add('collapse');
            let folderTreeSplitter = createDiv(
                `${this.id}-splitter`,
                "browser-folder-tree-splitter splitter-bar"
            );
            this.headerBar = createDiv(
                `${this.id}-header`,
                "browser-header-bar"
            );
            this.fullContentDiv = createDiv(
                `${this.id}-fullcontent`,
                "browser-fullcontent-container"
            );
            this.container.appendChild(this.folderTreeDiv);
            if (!isLikelyMobile()) {
                this.container.appendChild(folderTreeSplitter);
            }
            this.container.appendChild(this.fullContentDiv);
            let formatSelector = document.createElement("select");
            formatSelector.id = `${this.id}-format-selector`;
            formatSelector.title = "Display format";
            formatSelector.className = "browser-format-selector";
            for (let format of [
                "Cards",
                "Small Cards",
                "Big Cards",
                "Thumbnails",
                "Small Thumbnails",
                "Big Thumbnails",
                "Giant Thumbnails",
                "List",
            ]) {
                let option = document.createElement("option");
                option.value = format;
                option.className = "translate";
                option.innerText = translate(format);
                if (format == this.format) {
                    option.selected = true;
                }
                formatSelector.appendChild(option);
            }
            formatSelector.addEventListener("change", () => {
                this.format = formatSelector.value;
                localStorage.setItem(`browser_${this.id}_format`, this.format);
                this.update();
            });
            if (!this.showDisplayFormat || isLikelyMobile()) {
                formatSelector.style.display = "none";
            }
            let buttons = createSpan(`${this.id}-button-container`, 'browser-header-buttons',
                `<button id="${this.id}_refresh_button" title="Refresh" class="refresh-button translate translate-no-text">&#x21BB;</button>\n`
                + `<button id="${this.id}_up_button" class="refresh-button translate translate-no-text" disabled autocomplete="off" title="Go back up 1 folder">&#x21d1;</button>\n`
                + `<span><span class="translate">Depth</span>: <input id="${this.id}_depth_input" class="depth-number-input translate translate-no-text" type="number" min="1" max="10" value="${this.depth}" title="Depth of subfolders to show" autocomplete="false"></span>\n`
                + `<span><input id="${this.id}_filter_input" type="text" value="${this.filter}" title="Text filter, only show items that contain this text." rows="1" autocomplete="false" class="translate translate-no-text" placeholder="${translate('Filter...')}"></span>\n`
                + this.extraHeader);
            let inputArr = buttons.getElementsByTagName('input');
            let depthInput = inputArr[0];
            depthInput.addEventListener("change", () => {
                this.depth = depthInput.value;
                localStorage.setItem(`browser_${this.id}_depth`, this.depth);
                this.update();
            });
            if (!this.showDepth) {
                depthInput.parentElement.style.display = "none";
            }
            let filterInput = inputArr[1];
            filterInput.addEventListener("input", () => {
                this.filter = filterInput.value.toLowerCase();
                localStorage.setItem(`browser_${this.id}_filter`, this.filter);
                this.updateWithoutDup();
            });
            if (!this.showFilter) {
                filterInput.parentElement.style.display = "none";
            }
            let buttonArr = buttons.getElementsByTagName("button");
            let refreshButton = buttonArr[0];
            this.upButton = buttonArr[1];
            if (!this.showRefresh) {
                refreshButton.style.display = "none";
            }
            if (!this.showUpFolder) {
                this.upButton.style.display = "none";
            }
            this.headerBar.appendChild(formatSelector);
            this.headerBar.appendChild(buttons);
            if (isLikelyMobile()) {
                this.headerBar = this.createMobileHeader();
            }
            refreshButton.onclick = this.refresh.bind(this);
            this.fullContentDiv.appendChild(this.headerBar);
            this.contentDiv = createDiv(
                `${this.id}-content`,
                "browser-content-container"
            );
            this.contentDiv.addEventListener("scroll", () => {
                this.makeVisible(this.contentDiv);
            });
            this.fullContentDiv.appendChild(this.contentDiv);
            this.barSpot = 0;
            let setBar = () => {
                this.folderTreeDiv.style.width = `${this.barSpot}px`;
                this.fullContentDiv.style.width = `calc(100vw - ${this.barSpot}px - 0.6rem)`;
                if (this.sizeChangedEvent) {
                    this.sizeChangedEvent();
                }
            };
            this.lastReset = () => {
                this.barSpot = parseInt(
                    localStorage.getItem(`barspot_browser_${this.id}`) ||
                        convertRemToPixels(20)
                );
                setBar();
            };
            this.lastReset();
            let isDrag = false;
            folderTreeSplitter.addEventListener(
                "mousedown",
                (e) => {
                    isDrag = true;
                    e.preventDefault();
                },
                true
            );
            this.lastListen = (e) => {
                let offX =
                    e.pageX - this.container.getBoundingClientRect().left;
                offX = Math.min(
                    Math.max(offX, this.splitterMinWidth),
                    window.innerWidth - 100
                );
                if (isDrag) {
                    this.barSpot = offX - 5;
                    localStorage.setItem(
                        `barspot_browser_${this.id}`,
                        this.barSpot
                    );
                    setBar();
                }
            };
            this.lastListenUp = () => {
                isDrag = false;
            };
            document.addEventListener("mousemove", this.lastListen);
            document.addEventListener("mouseup", this.lastListenUp);
            layoutResets.push(() => {
                localStorage.removeItem(`barspot_browser_${this.id}`);
                this.lastReset();
            });
        } else {
            this.folderTreeDiv.innerHTML = "";
            this.contentDiv.innerHTML = "";
            this.headerPath.remove();
        }
        this.headerPath = this.genPath(path, this.upButton);
        this.headerBar.appendChild(this.headerPath);
        if (isLikelyMobile()) {
            let mobileContainer = document.getElementById(
                `${this.id}-mobile-foldertree`
            );
            if (!mobileContainer) {
                mobileContainer = createDiv(
                    `${this.id}-mobile-foldertree`,
                    "mobile-file-browser-container"
                );
                this.container.prepend(mobileContainer);
            }
            this.buildMobileTreeElements(
                mobileContainer,
                path,
                this.getFolderFromPath(this.tree, path)
            );
        }
        if (!isLikelyMobile())
            this.buildTreeElements(this.folderTreeDiv, "", this.tree);
        this.buildContentList(this.contentDiv, filesToRender);
        this.folderTreeDiv.scrollTop = folderScroll;
        this.makeVisible(this.contentDiv);
        if (scrollOffset) {
            this.contentDiv.scrollTop = scrollOffset;
        }
        applyTranslations(this.headerBar);
        applyTranslations(this.contentDiv);
        this.everLoaded = true;
        if (this.builtEvent) {
            this.builtEvent();
        }
        this.contentDiv.scrollTop = scrollOffset;
    }
}
