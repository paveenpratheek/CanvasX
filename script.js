// Application State
let state = {
    mode: 'select', // select, pan, draw, delete, line, rect, circle, book, arrow, text, notepad, place-progress-bar, place-clock, place-totem
    selectMode: 'normal', // normal, lasso
    lassoPolygon: [],
    lassoSelection: { areas: new Set(), drawings: new Set(), files: new Set(), totems: new Set() },
    isPanning: false,
    eraserMode: 'normal', // 'normal' or 'lines'
    fabricColor: '#1a1a1a',
    gridSize: 40,
    snapToGrid: true,
    graphicsPreset: 'performance', // performance, efficient
    areaColor: '#4f46e5',
    tables: [],
    sidebarWidgets: [],
    calendarSync: { viewMonth: new Date().getMonth(), viewYear: new Date().getFullYear(), schedules: {} },
    editingDashboardId: null,
    camera: {
        x: 0,
        y: 0,
        zoom: 1
    },
    panStart: { x: 0, y: 0 },
    isConstellationMode: false,
    preConstellationZoom: 1,
    
    // Drawing state
    isDrawing: false,
    currentPolygon: [], // array of {x, y} in world coordinates
    selectedText: null,
    selectedDrawings: new Set(),
    
    // Saved regions: array of { name, color, points: [{x,y}, ...] }
    areas: [],
    totems: [],
    
    // Open strokes
    drawings: [],
    
    // Dragging Area state
    draggingArea: null,
    draggingText: null,
    draggingTotem: null,
    dragStartWorld: { x: 0, y: 0 },
    dragSetAreas: [],
    dragSetDrawings: [],
    
    // Dropped files: array of { id, name, areaName, x, y }
    files: [],
    
    // Selected area for marching ants
    selectedAreaId: null,
    marchingAntsOffset: 0,

    // Area-to-area link lines
    links: [],           // [{ id, fromAreaId, fromCorner, toAreaId, toCorner, color }]
    linkDraftStart: null, // { areaId, corner, worldPos } — set when line starts snapped to a hole
    linkAnimOffset: 0     // animated dash offset for link curves
};

let spacePressed = false;

// Tablet Mode: a DEVICE setting (persisted in localStorage), not a fabric property — it
// describes the physical input the user has (touch + stylus), not something specific to any
// one fabric, so it must survive switching between fabrics/reloading the page.
let tabletMode = localStorage.getItem('spatial-tablet-mode') === '1';

function setTabletMode(on) {
    tabletMode = !!on;
    localStorage.setItem('spatial-tablet-mode', tabletMode ? '1' : '0');
    const toggle = document.getElementById('tablet-mode-toggle');
    if (toggle) toggle.checked = tabletMode;
    resetTouchGesture();
}

// DOM Elements
const workspace = document.getElementById('workspace');
const canvas = document.getElementById('fabric-canvas');
const ctx = canvas.getContext('2d');
const inkCanvas = document.getElementById('ink-canvas');
const inkCtx = inkCanvas.getContext('2d', { desynchronized: true });
const bgCanvas = document.createElement('canvas');
// NOTE: no willReadFrequently here — this canvas is only ever a drawImage source/target
// (never getImageData), and that flag forces a slow CPU-backed canvas, killing GPU acceleration.
const bgCtx = bgCanvas.getContext('2d');
const filesLayer = document.getElementById('files-layer');
const totemIndicatorsLayer = document.getElementById('totem-indicators');

const btnSelect = document.getElementById('btn-select');
const btnPan = document.getElementById('btn-pan');
const btnDraw = document.getElementById('btn-draw');

const btnText = document.getElementById('btn-text');
const btnNotepad = document.getElementById('btn-notepad');
const btnLine = document.getElementById('btn-line');
const btnArrow = document.getElementById('btn-arrow');
const btnRect = document.getElementById('btn-rect');
const btnCircle = document.getElementById('btn-circle');
const btnDelete = document.getElementById('btn-delete');
const btnBook = document.getElementById('btn-book');
const btnTotem = document.getElementById('btn-totem');
const btnFolder = document.getElementById('btn-folder');
const btnElements = document.getElementById('btn-elements');

const btnHome = document.getElementById('btn-home');


/**
 * SmoothPen - High performance, pressure-sensitive drawing tool.
 */


// File System Access API state
let targetWorkspaceHandle = null;
let currentFabricHandle = null;
let currentSourcesHandle = null;
let currentFabricName = null;

// Home Screen Elements
const homeScreen = document.getElementById('home-screen');
const btnOpenWorkspace = document.getElementById('btn-open-workspace');
const workspaceContent = document.getElementById('workspace-content');
const workspacePathLabel = document.getElementById('workspace-path-label');
const btnNewFabric = document.getElementById('btn-new-fabric');
const fabricsGrid = document.getElementById('fabrics-grid');

// ===== UPLOAD PROGRESS RIBBON =====
const uploadProgress = {
    ribbon: null,
    bar: null,
    text: null,
    countText: null,
    total: 0,
    current: 0,
    
    init() {
        this.ribbon = document.getElementById('upload-progress-ribbon');
        this.bar = document.getElementById('progress-bar-fill');
        this.text = document.getElementById('progress-text');
        this.countText = document.getElementById('progress-count');
    },
    
    start(totalFiles) {
        if (!this.ribbon) this.init();
        if (!this.ribbon) return; // Not in DOM yet
        this.total = totalFiles;
        this.current = 0;
        this.bar.style.width = '0%';
        this.countText.textContent = `0 / ${this.total}`;
        this.ribbon.classList.remove('hidden');
        requestAnimationFrame(() => this.ribbon.classList.add('active'));
    },
    
    update(filename) {
        if (!this.ribbon) return;
        this.current++;
        let percentage = this.total > 0 ? Math.round((this.current / this.total) * 100) : 100;
        this.bar.style.width = percentage + '%';
        
        let displayname = filename;
        if (displayname.length > 25) displayname = displayname.substring(0, 22) + '...';
        this.text.textContent = `Importing ${displayname}`;
        this.countText.textContent = `${this.current} / ${this.total}`;
    },
    
    finish() {
        if (!this.ribbon) return;
        this.text.textContent = `Completed!`;
        this.bar.style.width = '100%';
        this.countText.textContent = `${this.total} / ${this.total}`;
        
        setTimeout(() => {
            if (this.ribbon) {
                this.ribbon.classList.remove('active');
                setTimeout(() => this.ribbon.classList.add('hidden'), 400);
            }
        }, 2000);
    }
};

// Modal Elements
const newFabricModal = document.getElementById('new-fabric-modal');
const newFabricName = document.getElementById('new-fabric-name');
const newFabricBg = document.getElementById('new-fabric-bg');
const importFabricFile = document.getElementById('import-fabric-file');
const btnCancelFabric = document.getElementById('btn-cancel-fabric');
const btnCreateFabric = document.getElementById('btn-create-fabric');
// Elements Ribbon Elements
const elementsRibbonPanel = document.getElementById('elements-ribbon-panel');
const btnToolProgressBar = document.getElementById('btn-tool-progress-bar');
const btnToolClock = document.getElementById('btn-tool-clock');
const btnToolCalendar = document.getElementById('btn-tool-calendar');
const btnToolDashboardBox = document.getElementById('btn-tool-dashboard-box');
const btnToolBox = document.getElementById('btn-tool-box');
const btnToolTable = document.getElementById('btn-tool-table');
const btnToolScrollBox = document.getElementById('btn-tool-scroll-box');
const btnCancelElements = document.getElementById('btn-cancel-elements');

const tableConfigRibbonPanel = document.getElementById('table-config-ribbon-panel');

const tableRowsInput = document.getElementById('table-rows-input');
const tableColsInput = document.getElementById('table-cols-input');
const btnCancelTable = document.getElementById('btn-cancel-table');

// Eraser Ribbon
const eraserRibbonPanel = document.getElementById('eraser-ribbon-panel');
const btnEraserNormal = document.getElementById('btn-eraser-normal');
const btnEraserLines = document.getElementById('btn-eraser-lines');
const btnCancelEraser = document.getElementById('btn-cancel-eraser');

const palettePopup = document.getElementById('color-palette-popup');
const indicatorFabric = document.getElementById('indicator-fabric');
const indicatorArea = document.getElementById('indicator-area');
const instructionText = document.getElementById('instruction-text');

const PRESET_COLORS = [
    'transparent',
    '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635',
    '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8',
    '#60a5fa', '#4f46e5', '#a78bfa', '#c084fc', '#e879f9',
    '#f472b6', '#fb7185', '#94a3b8', '#1a1a1a', '#f8f9fa'
];

let activeColorTarget = null;

let globalBookFiles = [];

function loadGlobalShelves() {
    try {
        const data = localStorage.getItem('spatial-global-shelf-files');
        globalBookFiles = data ? JSON.parse(data) : [];
    } catch(e) { console.error('Error loading global shelves', e); globalBookFiles = []; }
}

function saveGlobalShelves() {
    try {
        localStorage.setItem('spatial-global-shelf-files', JSON.stringify(globalBookFiles));
    } catch(e) { console.error('Error saving global shelves', e); }
}

function assignFileToStorage(fileData, assignedArea) {
    // Remove from both first to prevent duplicates
    state.files = state.files.filter(f => f.id !== fileData.id);
    globalBookFiles = globalBookFiles.filter(f => f.id !== fileData.id);
    
    if (assignedArea && assignedArea.isFolder) {
        if (!assignedArea.containedFiles) assignedArea.containedFiles = [];
        if (!assignedArea.containedFiles.includes(fileData.id)) {
            assignedArea.containedFiles.push(fileData.id);
        }
        fileData.isHidden = true;
        fileData.areaId = null; // Detach from canvas area
        state.files.push(fileData);
        if (typeof window.activeEdgeFolderId !== 'undefined' && window.activeEdgeFolderId === assignedArea.id && typeof renderEdgeSidebar === 'function') {
            renderEdgeSidebar(assignedArea.id);
        }
        if (typeof refreshFolderWidgets === 'function') refreshFolderWidgets(assignedArea.id);
        if (typeof syncFilesVisibility === 'function') {
            syncFilesVisibility();
        }
    } else if (assignedArea && assignedArea.isBook) {
        fileData.bookName = assignedArea.name;
        
        // Add check to populate Book ID based on area if it is a book
        if (assignedArea && assignedArea.isBook) {
            fileData.bookTitleId = assignedArea.activeTitleId;
            fileData.bookPageId = assignedArea.activePageId;
        }
        
        globalBookFiles.push(fileData);
    } else {
        if (assignedArea && assignedArea.isScrollBox) {
            const currentPage = assignedArea.pages[assignedArea.currentPageIndex];
            if (currentPage) {
                fileData.scrollBoxPageId = currentPage.id;
            }
        }
        delete fileData.bookName;
        state.files.push(fileData);
    }
    
    saveGlobalShelves();
    return fileData;
}


loadGlobalShelves();

// Initialize Pen Ribbon Palette
const penPalette = document.getElementById('pen-color-palette');
if (penPalette) {
    PRESET_COLORS.forEach(hex => {
        if (hex === 'transparent') return; // Skip transparent for pen
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = hex;
        // Keep track of active style
        if (state.areaColor === hex) {
            swatch.classList.add('active'); // Optional: Add some active styling in CSS
            swatch.style.border = '2px solid #fff';
        } else {
            swatch.style.border = '2px solid transparent';
        }
        
        swatch.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            state.areaColor = hex;
            if (indicatorArea) indicatorArea.style.background = hex;
            // Update UI
            Array.from(penPalette.children).forEach(child => {
                child.style.border = '2px solid transparent';
            });
            swatch.style.border = '2px solid #fff';
            // Update SmoothPen color if drawing
            if (smoothPen) smoothPen.color = hex;
            saveCurrentFabric();
        });
        penPalette.appendChild(swatch);
    });
}

// Initialize palette
PRESET_COLORS.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    if (hex === 'transparent') {
        swatch.classList.add('transparent-pattern');
        swatch.style.background = 'transparent';
    } else {
        swatch.style.background = hex;
    }
    
    swatch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeColorTarget === 'fabric') {
            if (hex === 'transparent') return;
            state.fabricColor = hex;
            indicatorFabric.style.background = hex;
            document.documentElement.style.setProperty('--fabric-bg', hex);
            scheduleRender();
            saveCurrentFabric();
        } else if (activeColorTarget === 'area') {
            if (hex === 'transparent') return;
            state.areaColor = hex;
            indicatorArea.style.background = hex;
            scheduleRender();
            saveCurrentFabric();
        } else if (activeColorTarget === 'text' && state.selectedText) {
            if (hex === 'transparent') return;
            if (document.querySelector('.inline-text-input')) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('foreColor', false, hex);
            } else {
                state.selectedText.color = hex;
                indicatorTextColor.style.background = hex;
                updateInlineEditorStyle();
                scheduleRender();
            }
        } else if (activeColorTarget === 'highlight' && state.selectedText) {
            if (document.querySelector('.inline-text-input')) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('hiliteColor', false, hex === 'transparent' ? 'transparent' : hex);
            } else {
                state.selectedText.highlightColor = hex;
                if (hex === 'transparent') {
                    indicatorHighlightColor.style.background = 'transparent';
                    indicatorHighlightColor.classList.add('transparent-pattern');
                } else {
                    indicatorHighlightColor.style.background = hex;
                    indicatorHighlightColor.classList.remove('transparent-pattern');
                }
                scheduleRender();
            }
        } else if (activeColorTarget === 'clock' && state.selectedClock) {
            if (hex === 'transparent') return;
            state.selectedClock.textColor = hex;
            scheduleRender();
        }
        
        palettePopup.classList.remove('active');
        activeColorTarget = null;
        palettePopup.style.top = ''; // Reset positioning
    });
    palettePopup.appendChild(swatch);
});

const propPanel = document.getElementById('properties-panel');
const selectRibbon = document.getElementById('select-ribbon');
const btnSelectNormal = document.getElementById('btn-select-normal');
const btnSelectLasso = document.getElementById('btn-select-lasso');

const propFontSize = document.getElementById('prop-font-size');
const propFontSizeVal = document.getElementById('prop-font-size-val');
const propFontFamily = document.getElementById('prop-font-family');
const indicatorTextColor = document.getElementById('indicator-text-color');
const indicatorHighlightColor = document.getElementById('indicator-highlight-color');

// Formatting buttons
const btnBold = document.getElementById('prop-text-bold');
const btnItalic = document.getElementById('prop-text-italic');
const btnAlignLeft = document.getElementById('prop-text-align-left');
const btnAlignCenter = document.getElementById('prop-text-align-center');
const btnAlignRight = document.getElementById('prop-text-align-right');
const btnBorder = document.getElementById('prop-text-border');

function showPropertiesPanel(textDrawing) {
    if (!textDrawing) return;
    propPanel.classList.remove('hidden');
    
    // Populate
    propFontSize.value = textDrawing.fontSize || 24;
    propFontSizeVal.textContent = `${propFontSize.value}px`;
    propFontFamily.value = textDrawing.fontFamily || 'Inter, sans-serif';
    
    btnBold.classList.toggle('active', !!textDrawing.isBold);
    btnItalic.classList.toggle('active', !!textDrawing.isItalic);
    btnBorder.classList.toggle('active', !!textDrawing.hasBorder);
    
    btnAlignLeft.classList.toggle('active', textDrawing.textAlign === 'left' || !textDrawing.textAlign);
    btnAlignCenter.classList.toggle('active', textDrawing.textAlign === 'center');
    btnAlignRight.classList.toggle('active', textDrawing.textAlign === 'right');
    
    indicatorTextColor.style.background = textDrawing.color || state.areaColor;
    if (textDrawing.highlightColor && textDrawing.highlightColor !== 'transparent') {
        indicatorHighlightColor.style.background = textDrawing.highlightColor;
        indicatorHighlightColor.classList.remove('transparent-pattern');
    } else {
        indicatorHighlightColor.style.background = 'transparent';
        indicatorHighlightColor.classList.add('transparent-pattern');
    }
}

function hidePropertiesPanel(mode) {
    state.lassoPolygon = [];
    state.lassoSelection = { areas: new Set(), drawings: new Set(), files: new Set(), totems: new Set() };
    
    // Hide panels
    propPanel.classList.add('hidden');
    if (selectRibbon) {
        if (mode === 'select') {
            selectRibbon.classList.remove('hidden');
        } else {
            selectRibbon.classList.add('hidden');
        }
    }
    
    // Deactivate all
    document.querySelectorAll('#toolbar .tool-btn').forEach(b => b.classList.remove('active'));
}

function updateInlineEditorStyle() {
    const input = document.querySelector('.inline-text-input');
    if (input && state.selectedText) {
        const fw = state.selectedText.isBold ? 'bold ' : '600 ';
        const fs = state.selectedText.isItalic ? 'italic ' : '';
        input.style.font = `${fs}${fw}${state.selectedText.fontSize * state.camera.zoom}px ${state.selectedText.fontFamily}`;
        input.style.color = state.selectedText.color;
        if (state.selectedText.textAlign) input.style.textAlign = state.selectedText.textAlign;
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
    }
}

let savedSelectionRange = null;
document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#properties-panel')) {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList.contains('inline-text-input')) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                savedSelectionRange = sel.getRangeAt(0);
            }
        }
    }
}, true);

// Reflect the actual formatting at the current cursor/selection in the ribbon,
// instead of always showing the whole text box's stored fontSize/fontFamily.
function matchFontFamilyOption(computedFamily) {
    const firstName = (computedFamily.split(',')[0] || '').replace(/['"]/g, '').trim().toLowerCase();
    for (const opt of propFontFamily.options) {
        const optFirst = opt.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
        if (optFirst === firstName) return opt.value;
    }
    return null;
}

function syncPropertiesPanelToSelection() {
    const input = document.querySelector('.inline-text-input');
    if (!input || !state.selectedText) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!input.contains(range.startContainer)) return;

    let el = range.startContainer;
    if (el.nodeType === 3) el = el.parentElement; // text node -> element
    if (!el) return;

    const cs = window.getComputedStyle(el);

    const sizePx = parseFloat(cs.fontSize) / (state.camera.zoom || 1);
    if (!isNaN(sizePx)) {
        const rounded = Math.round(sizePx);
        propFontSize.value = rounded;
        propFontSizeVal.textContent = `${rounded}px`;
    }

    const matchedFamily = matchFontFamilyOption(cs.fontFamily);
    if (matchedFamily) propFontFamily.value = matchedFamily;

    btnBold.classList.toggle('active', document.queryCommandState('bold'));
    btnItalic.classList.toggle('active', document.queryCommandState('italic'));
}

document.addEventListener('selectionchange', () => {
    if (document.querySelector('.inline-text-input')) {
        syncPropertiesPanelToSelection();
    }
});

propFontSize.addEventListener('change', (e) => {
    if (!state.selectedText) return;
    const size = parseInt(e.target.value);
    
    if (document.querySelector('.inline-text-input')) {
        if (savedSelectionRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
        }
        
        // Force the browser to use <font size="7"> so we can reliably find it
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('fontSize', false, '7');
        
        const fonts = document.querySelectorAll('.inline-text-input font[size="7"]');
        fonts.forEach(f => {
            f.removeAttribute('size');
            f.style.fontSize = `${size * state.camera.zoom}px`;
        });
        
        // Save the new selection range after formatting
        const sel = window.getSelection();
        if (sel.rangeCount > 0) savedSelectionRange = sel.getRangeAt(0);
        
        propFontSizeVal.textContent = `${size}px`;
        
        // Return focus to the text editor so the selection is visually restored
        const editor = document.querySelector('.inline-text-input');
        if (editor) editor.focus();
    } else {
        state.selectedText.fontSize = size;
        propFontSizeVal.textContent = `${state.selectedText.fontSize}px`;
        updateInlineEditorStyle();
        scheduleRender();
        uploadProgress.finish();
    }
});

propFontFamily.addEventListener('change', (e) => {
    if (!state.selectedText) return;
    const family = e.target.value;

    if (document.querySelector('.inline-text-input')) {
        if (savedSelectionRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
        }

        document.execCommand('styleWithCSS', false, true);
        document.execCommand('fontName', false, family);

        // Save the new selection range after formatting
        const sel = window.getSelection();
        if (sel.rangeCount > 0) savedSelectionRange = sel.getRangeAt(0);

        // Return focus to the text editor so the selection is visually restored
        const editor = document.querySelector('.inline-text-input');
        if (editor) editor.focus();
    } else {
        state.selectedText.fontFamily = family;
        updateInlineEditorStyle();
        scheduleRender();
        uploadProgress.finish();
    }
});

btnBold.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (document.querySelector('.inline-text-input')) {
        document.execCommand('bold', false, null);
    } else if (state.selectedText) {
        state.selectedText.isBold = !state.selectedText.isBold;
        btnBold.classList.toggle('active', state.selectedText.isBold);
        updateInlineEditorStyle();
        scheduleRender();
        uploadProgress.finish();
    }
});

btnItalic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (document.querySelector('.inline-text-input')) {
        document.execCommand('italic', false, null);
    } else if (state.selectedText) {
        state.selectedText.isItalic = !state.selectedText.isItalic;
        btnItalic.classList.toggle('active', state.selectedText.isItalic);
        updateInlineEditorStyle();
        scheduleRender();
        uploadProgress.finish();
    }
});

btnBorder.addEventListener('click', () => {
    if (!state.selectedText) return;
    state.selectedText.hasBorder = !state.selectedText.hasBorder;
    btnBorder.classList.toggle('active', state.selectedText.hasBorder);
    scheduleRender();
    uploadProgress.finish();
});

function updateAlignBtn(align) {
    btnAlignLeft.classList.toggle('active', align === 'left');
    btnAlignCenter.classList.toggle('active', align === 'center');
    btnAlignRight.classList.toggle('active', align === 'right');
}

btnAlignLeft.addEventListener('click', () => {
    if (!state.selectedText) return;
    state.selectedText.textAlign = 'left';
    updateAlignBtn('left');
    updateInlineEditorStyle();
    scheduleRender();
    uploadProgress.finish();
});

btnAlignCenter.addEventListener('click', () => {
    if (!state.selectedText) return;
    state.selectedText.textAlign = 'center';
    updateAlignBtn('center');
    updateInlineEditorStyle();
    scheduleRender();
    uploadProgress.finish();
});

btnAlignRight.addEventListener('click', () => {
    if (!state.selectedText) return;
    state.selectedText.textAlign = 'right';
    updateAlignBtn('right');
    updateInlineEditorStyle();
    scheduleRender();
    uploadProgress.finish();
});

document.getElementById('dropdown-text-color').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.selectedText) return;
    const rect = e.currentTarget.getBoundingClientRect();
    palettePopup.style.left = `${rect.left + rect.width/2}px`; 
    palettePopup.style.top = `${rect.bottom + 10}px`;
    palettePopup.classList.add('active');
    activeColorTarget = 'text';
});

document.getElementById('dropdown-highlight-color').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.selectedText) return;
    const rect = e.currentTarget.getBoundingClientRect();
    palettePopup.style.left = `${rect.left + rect.width/2}px`;
    palettePopup.style.top = `${rect.bottom + 10}px`;
    palettePopup.classList.add('active');
    activeColorTarget = 'highlight';
});
const dropOverlay = document.getElementById('drop-overlay');

// Initialization
function getPolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        area += (polygon[j].x * polygon[i].y) - (polygon[i].x * polygon[j].y);
    }
    return Math.abs(area / 2);
}

function getAreaSize(areaObj) {
    let total = 0;
    if (areaObj.polygons) {
        for (let p of areaObj.polygons) total += getPolygonArea(p);
    } else if (areaObj.points) {
        total += getPolygonArea(areaObj.points);
    }
    return total;
}

// ===== AREA CORNER HOLE HELPERS =====
function getAreaBBox(area) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polys = area.polygons || (area.points ? [area.points] : []);
    for (const poly of polys) {
        for (const pt of poly) {
            if (pt.x < minX) minX = pt.x; if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x; if (pt.y > maxY) maxY = pt.y;
        }
    }
    return { minX, minY, maxX, maxY };
}

function getBezierBBox(p0, p1, p2, p3) {
    const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);
    return { minX, minY, maxX, maxY };
}

function bboxOverlap(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function getAreaCorners(area) {
    const { minX, minY, maxX, maxY } = getAreaBBox(area);
    return {
        tl: { x: minX, y: minY },
        tr: { x: maxX, y: minY },
        bl: { x: minX, y: maxY },
        br: { x: maxX, y: maxY }
    };
}

// Returns { areaId, corner, worldPos } if within snap radius (in screen pixels), else null
function getNearestHole(worldPos, snapRadiusPx) {
    const snapWorld = snapRadiusPx / state.camera.zoom;
    let best = null;
    let bestDist = Infinity;
    for (const area of state.areas) {
        if (area.isBook) continue;
        const corners = getAreaCorners(area);
        for (const [cornerKey, cornerPos] of Object.entries(corners)) {
            const dx = worldPos.x - cornerPos.x;
            const dy = worldPos.y - cornerPos.y;
            const dist = Math.hypot(dx, dy);
            if (dist < snapWorld && dist < bestDist) {
                bestDist = dist;
                best = { areaId: area.id, corner: cornerKey, worldPos: { ...cornerPos } };
            }
        }
    }
    return best;
}

function getLineFontSize(line, baseFontSize) {
    const match = line.match(/^(#{1,6})\s*/);
    if (match) {
        const level = match[1].length;
        if (level === 1) return baseFontSize * 2.0;
        if (level === 2) return baseFontSize * 1.5;
        if (level === 3) return baseFontSize * 1.25;
        if (level === 4) return baseFontSize * 1.1;
        if (level === 5) return baseFontSize * 1.0;
        if (level === 6) return baseFontSize * 0.9;
    }
    return baseFontSize;
}

function getDraggableDrawingAt(worldPos) {
    for (let i = state.drawings.length - 1; i >= 0; i--) {
        const d = state.drawings[i];
        if (!isItemVisibleInContainer(d)) continue;
        if (d.type === 'text') {
            let maxWidth, totalHeight;
            const textEl = document.getElementById(d.id);
            if (textEl) {
                // Use the real rendered DOM box (handles HTML content, word-wrap, etc.)
                maxWidth = textEl.offsetWidth;
                totalHeight = textEl.offsetHeight;
            } else {
                // Fallback for the first frame, before syncTextsDOM() has created the element
                const baseFontSize = d.fontSize || 24;
                const lines = d.text.split('\n');
                totalHeight = 0;
                maxWidth = 0;
                for (const line of lines) {
                    const fs = getLineFontSize(line, baseFontSize);
                    const fontStyle = d.isItalic ? 'italic ' : '';
                    const fontWeight = d.isBold ? 'bold ' : '600 ';
                    ctx.font = `${fontStyle}${fontWeight}${fs}px ${d.fontFamily || 'Inter, sans-serif'}`;
                    const mt = ctx.measureText(line.replace(/^#+\s/, ''));
                    if (mt.width > maxWidth) maxWidth = mt.width;
                    totalHeight += fs * 1.2;
                }
            }

            const pad = 12 / state.camera.zoom;
            if (worldPos.x >= d.x - pad && worldPos.x <= d.x + maxWidth + pad &&
                worldPos.y >= d.y - pad && worldPos.y <= d.y + totalHeight + pad) {
                return d;
            }
        } else if (d.type === 'progress_bar' || d.type === 'clock' || d.type === 'calendar') {
            const pad = 12 / state.camera.zoom;
            if (worldPos.x >= d.x - pad && worldPos.x <= d.x + d.width + pad &&
                worldPos.y >= d.y - pad && worldPos.y <= d.y + d.height + pad) {
                return d;
            }
        }
    }
    return null;
}

// Per-selection custom font-size spans are stored in world-space px (matching d.fontSize),
// but the live editor is unscaled screen-space, so they need *zoom on the way in and /zoom on the way out.
function scaleInlineFontSizes(container, factor) {
    if (factor === 1) return;
    container.querySelectorAll('[style*="font-size"]').forEach(el => {
        const current = parseFloat(el.style.fontSize);
        if (!isNaN(current)) {
            el.style.fontSize = `${current * factor}px`;
        }
    });
}

function openTextEditor(e, existingDrawing = null, definedWidth = null) {
    if (document.querySelector('.inline-text-input')) return;
    
    const worldPos = screenToWorld(e.clientX, e.clientY);

    const input = document.createElement('div');
    input.contentEditable = "true";
    input.className = 'inline-text-input';
    
    // Position physically on screen
    input.style.position = 'absolute';
    input.style.left = `${e.clientX}px`;
    input.style.top = `${e.clientY}px`;
    input.style.zIndex = 1000;
    
    const baseFontSize = existingDrawing ? (existingDrawing.fontSize || 24) : 24;
    const baseWidth = definedWidth || (existingDrawing ? existingDrawing.width : null);
    
    const fontStyle = existingDrawing && existingDrawing.isItalic ? 'italic ' : '';
    const fontWeight = existingDrawing && existingDrawing.isBold ? 'bold ' : '600 ';
    const fontFamily = existingDrawing && existingDrawing.fontFamily ? existingDrawing.fontFamily : 'Inter, sans-serif';
    input.style.font = `${fontStyle}${fontWeight}${baseFontSize * state.camera.zoom}px ${fontFamily}`;
    input.style.color = existingDrawing ? (existingDrawing.color || state.areaColor) : state.areaColor;
    if (existingDrawing && existingDrawing.textAlign) {
        input.style.textAlign = existingDrawing.textAlign;
    }
    
    input.style.background = 'rgba(0,0,0,0.8)';
    input.style.border = `1px dashed ${input.style.color}`;
    input.style.borderRadius = '4px';
    input.style.padding = '0px';
    input.style.outline = 'none';
    input.style.resize = 'none';
    input.style.minHeight = '40px';
    input.style.lineHeight = '1.2';
    input.style.overflow = 'hidden';
    input.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    
    if (baseWidth) {
        input.style.whiteSpace = 'pre-wrap';
        input.style.wordBreak = 'break-word';
        input.style.width = `${baseWidth * state.camera.zoom}px`;
    } else {
        input.style.whiteSpace = 'pre';
        input.style.minWidth = '200px';
    }
    
    let isNewTemp = false;
    if (existingDrawing) {
        // If it's old plain text with newlines, convert to br
        let t = existingDrawing.text || "";
        if (!t.includes('<') && !t.includes('>')) {
            t = t.replace(/\n/g, '<br>');
        }
        input.innerHTML = t;
        scaleInlineFontSizes(input, state.camera.zoom);
        // Fix position to the drawing's screen position
        const screenPos = worldToScreen(existingDrawing.x, existingDrawing.y);
        input.style.left = `${screenPos.x}px`;
        input.style.top = `${screenPos.y}px`;
        state.selectedText = existingDrawing;
    } else {
        isNewTemp = true;
        state.selectedText = {
            id: 'temp_' + Date.now(),
            type: 'text',
            text: '',
            color: state.areaColor,
            fontFamily: 'Inter, sans-serif',
            fontSize: baseFontSize,
            width: baseWidth,
            highlightColor: 'transparent',
            isBold: false,
            isItalic: false,
            textAlign: 'left',
            hasBorder: false,
            x: worldPos.x,
            y: worldPos.y
        };
    }
    
    showPropertiesPanel(state.selectedText);

    // Auto-resize
    const autoSize = () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        if (!baseWidth) {
            input.style.width = 'auto';
            input.style.width = (Math.max(200, input.scrollWidth + 20)) + 'px';
        }
    };
    input.addEventListener('input', autoSize);
    setTimeout(autoSize, 0);

    const finalizeText = () => {
        if (input.isFinalizing || !input.parentNode) return;
        input.isFinalizing = true;
        scaleInlineFontSizes(input, 1 / state.camera.zoom);
        const text = input.innerHTML;
        input.remove();
        if (text && text.trim() && text !== '<br>') {
            if (existingDrawing) {
                existingDrawing.text = text;
            } else {
                    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
                    const ytMatch = text.trim().match(ytRegex);
                    if (ytMatch) {
                        let assignedArea = null;
                        let hitAreas = [];
                        for (let i = state.areas.length - 1; i >= 0; i--) {
                            let hit = false;
                            if (state.areas[i].polygons) {
                                for (let p of state.areas[i].polygons) {
                                    if (isPointInPolygon(worldPos, p)) { hit = true; break; }
                                }
                            } else if (state.areas[i].points) {
                                if (isPointInPolygon(worldPos, state.areas[i].points)) hit = true;
                            }
                            if (hit) hitAreas.push(state.areas[i]);
                        }
                        if (hitAreas.length > 0) {
                            hitAreas.sort((a, b) => {
                                if (a.isBook && !b.isBook) return -1;
                                if (!a.isBook && b.isBook) return 1;
                                return getAreaSize(a) - getAreaSize(b);
                            });
                            assignedArea = hitAreas[0];
                        }

                        const obj = {
                            id: Date.now().toString(),
                            name: 'YouTube Video',
                            isImage: true,
                            isPdf: false,
                            isYoutube: true,
                            youtubeUrl: text.trim(),
                            imageDataUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
                            imageWidth: 200,
                            imageHeight: 150,
                            pdfBlobUrl: null,
                            areaId: assignedArea ? assignedArea.id : null,
                            areaName: assignedArea ? assignedArea.name : 'Unassigned',
                            x: worldPos.x,
                            y: worldPos.y
                        };
                        state.files.push(obj);
                        recalculateItemLinks();
                        renderFileItem(obj);
                    } else {
                        if (isNewTemp && state.selectedText) {
                            state.selectedText.text = text.trim();
                            state.selectedText.id = Date.now().toString();
                            state.drawings.push(state.selectedText);
                            recalculateItemLinks();
                        }
                    }
                }
                state.selectedText = null;
                hidePropertiesPanel();
                scheduleRender();
            } else if (existingDrawing) {
                state.drawings = state.drawings.filter(d => d.id !== existingDrawing.id);
                scheduleRender();
            } else {
                state.selectedText = null;
                hidePropertiesPanel();
            }
            if (!existingDrawing) setMode('select');
            saveCurrentFabric();
    };

    input.addEventListener('focusout', (e) => {
        if (e.relatedTarget && (e.relatedTarget.closest('#toolbar') || e.relatedTarget.closest('#properties-panel'))) {
            return;
        }
        finalizeText();
    });
    state.finalizeInlineText = finalizeText;
    input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
            ke.preventDefault();
            input.blur();
        } else if (ke.key === 'Escape') {
            input.innerHTML = existingDrawing ? existingDrawing.text : '';
            input.blur();
        }
    });
    
    input.addEventListener('pointerdown', (pe) => pe.stopPropagation());
    workspace.appendChild(input);
    setTimeout(() => input.focus(), 10);
}

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupToolbarListeners();
    setupWorkspaceListeners();
    setupDragAndDrop();
    
    scheduleRender();
    uploadProgress.finish();
}

function resizeCanvas() {
    // To support high DPI displays, scale the canvas internal resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = workspace.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) return;
    
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale all operations by dpr so we don't have to manually multiply everywhere
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    inkCanvas.width = rect.width * dpr;
    inkCanvas.height = rect.height * dpr;
    inkCanvas.style.width = `${rect.width}px`;
    inkCanvas.style.height = `${rect.height}px`;
    
    render();
}

function setupToolbarListeners() {
    btnSelect.addEventListener('click', () => setMode('select'));
    btnPan.addEventListener('click', () => setMode('pan'));
    btnDraw.addEventListener('click', () => setMode('draw'));

    btnText.addEventListener('click', () => setMode('text'));
    btnNotepad.addEventListener('click', () => setMode('notepad'));

    if (btnSelectNormal) {
        btnSelectNormal.addEventListener('click', () => {
            state.selectMode = 'normal';
            btnSelectNormal.classList.add('active');
            btnSelectLasso.classList.remove('active');
        });
    }
    if (btnSelectLasso) {
        btnSelectLasso.addEventListener('click', () => {
            state.selectMode = 'lasso';
            btnSelectLasso.classList.add('active');
            btnSelectNormal.classList.remove('active');
        });
    }

    btnLine.addEventListener('click', () => setMode('line'));
    btnArrow.addEventListener('click', () => setMode('arrow'));
    btnRect.addEventListener('click', () => setMode('rect'));
    btnCircle.addEventListener('click', () => setMode('circle'));
    btnBook.addEventListener('click', () => setMode('book'));
    btnTotem.addEventListener('click', () => setMode('totem'));
    btnFolder.addEventListener('click', () => setMode('folder'));
    btnElements.addEventListener('click', () => {
        setMode('elements');
        elementsRibbonPanel.classList.remove('hidden');
    });


    btnCancelElements.addEventListener('click', () => {
        closeElementsRibbon();
    });
    
    btnToolProgressBar.addEventListener('click', () => {
        setMode('place-progress-bar');
    });
    btnToolClock.addEventListener('click', () => {
        setMode('place-clock');
    });
    btnToolCalendar.addEventListener('click', () => {
        setMode('place-calendar');
    });
    btnToolDashboardBox.addEventListener('click', () => {
        setMode('place-dashboard-box');
    });
    btnToolBox.addEventListener('click', () => {
        setMode('draw-box');
    });
    btnToolTable.addEventListener('click', () => {
        elementsRibbonPanel.classList.add('hidden');
        tableConfigRibbonPanel.classList.remove('hidden');
        setMode('place-table');
    });
    btnToolScrollBox.addEventListener('click', () => {
        setMode('place-scroll-box');
    });
    btnCancelTable.addEventListener('click', () => {
        tableConfigRibbonPanel.classList.add('hidden');
        setMode('select');
    });


    btnDelete.addEventListener('click', () => {
        setMode('delete');
        eraserRibbonPanel.classList.remove('hidden');
    });
    
    btnEraserNormal.addEventListener('click', () => {
        state.eraserMode = 'normal';
        btnEraserNormal.classList.add('active');
        btnEraserLines.classList.remove('active');
    });
    
    btnEraserLines.addEventListener('click', () => {
        state.eraserMode = 'lines';
        btnEraserLines.classList.add('active');
        btnEraserNormal.classList.remove('active');
    });
    
    btnCancelEraser.addEventListener('click', () => {
        closeEraserRibbon();
    });
    
    document.getElementById('dropdown-fabric').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        palettePopup.style.left = `${rect.left + rect.width/2}px`;
        palettePopup.style.top = `${rect.bottom + 10}px`;
        palettePopup.classList.add('active');
        activeColorTarget = 'fabric';
    });
    
    document.getElementById('dropdown-area').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        palettePopup.style.left = `${rect.left + rect.width/2}px`;
        palettePopup.style.top = `${rect.bottom + 10}px`;
        palettePopup.classList.add('active');
        activeColorTarget = 'area';
        document.getElementById('settings-popup').style.display = 'none';
    });

    document.getElementById('dropdown-settings').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const popup = document.getElementById('settings-popup');
        const rect = e.currentTarget.getBoundingClientRect();
        if (popup.style.display === 'block') {
            popup.style.display = 'none';
        } else {
            popup.style.display = 'block';
            popup.style.left = `${rect.left + rect.width/2}px`;
            popup.style.top = `${rect.bottom + 10}px`;
            palettePopup.classList.remove('active');
            
            // Sync with current state
            document.getElementById('graphics-preset-select').value = state.graphicsPreset || 'performance';
            document.getElementById('tablet-mode-toggle').checked = tabletMode;
        }
    });

    document.getElementById('graphics-preset-select').addEventListener('change', (e) => {
        state.graphicsPreset = e.target.value;
        saveCurrentFabric();
    });

    document.getElementById('tablet-mode-toggle').addEventListener('change', (e) => {
        setTabletMode(e.target.checked);
    });

    const btnCheckGpu = document.getElementById('btn-check-gpu');
    if (btnCheckGpu) {
        btnCheckGpu.addEventListener('click', () => {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) {
                    alert('WebGL is not supported on your browser/device. Rendering is likely software-based (CPU).');
                    return;
                }
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                const isSoftware = /swiftshader|llvmpipe|software/i.test(renderer);
                if (isSoftware) {
                    alert(`Software Rendering (CPU) Detected!\n\nVendor: ${vendor}\nRenderer: ${renderer}\n\nHardware acceleration is currently disabled or unavailable in this environment.`);
                } else {
                    alert(`Hardware Acceleration (GPU) Active!\n\nVendor: ${vendor}\nRenderer: ${renderer}\n\nYour app is utilizing the GPU for rendering.`);
                }
            } catch (err) {
                alert('Could not determine GPU status: ' + err.message);
            }
        });
    }
    
    document.addEventListener('pointerdown', (e) => {
        if (!palettePopup.contains(e.target)) {
            palettePopup.classList.remove('active');
            activeColorTarget = null;
        }
        const settingsPopup = document.getElementById('settings-popup');
        if (settingsPopup && settingsPopup.style.display === 'block' && !settingsPopup.contains(e.target) && !document.getElementById('dropdown-settings').contains(e.target)) {
            settingsPopup.style.display = 'none';
        }      
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        
        if (e.code === 'Space') {
            spacePressed = true;
            workspace.style.cursor = 'grab';
            e.preventDefault();
            return;
        }

        const k = e.key.toLowerCase();
        
        // Handle shortcuts with modifiers first
        if (e.shiftKey && k === 'r') {
            toggleConstellationMode();
            e.preventDefault();
            return;
        }
        
        if (e.shiftKey && k === 'd') {
            openMissionControl();
            e.preventDefault();
            return;
        }

        if (e.shiftKey && k === 's') {
            toggleWidgetSidebar();
            e.preventDefault();
            return;
        }

        // Prevent single-key tool shortcuts if any modifier is held
        if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Single-key tool shortcuts
        if (k === 'v') setMode('select');
        if (k === 'h') setMode('pan');
        if (k === 'p') setMode('draw');

        if (k === 't') setMode('text');
        if (k === 'n') setMode('notepad');
        if (k === 'l') setMode('line');
        if (k === 'a') setMode('arrow');
        if (k === 'r') setMode('rect');
        if (k === 's') setMode('book');
        if (k === 'm') setMode('totem');
        if (k === 'c') setMode('circle');
        if (k === 'e') setMode('delete');
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spacePressed = false;
            workspace.style.cursor = state.mode === 'select' ? 'grab' : (state.mode === 'pan' ? 'grab' : 'crosshair');
        }
    });
}



function setMode(mode) {
    if (mode !== 'elements' && mode !== 'place-progress-bar' && mode !== 'place-clock' && mode !== 'place-calendar' && mode !== 'place-dashboard-box' && mode !== 'draw-box' && mode !== 'place-table' && mode !== 'place-scroll-box') closeElementsRibbon();
    if (mode !== 'place-table') tableConfigRibbonPanel.classList.add('hidden');
    if (mode !== 'delete') closeEraserRibbon();
    
    const penRibbon = document.getElementById('pen-ribbon-panel');
    if (penRibbon) {
        if (mode !== 'draw') {
            penRibbon.classList.add('hidden');
        } else {
            penRibbon.classList.remove('hidden');
        }
    }

    
    hidePropertiesPanel(mode);
    
    state.mode = mode;
    
    const btns = { 
        'select': btnSelect, 'pan': btnPan, 'draw': btnDraw, 'text': btnText, 'notepad': btnNotepad,
        'line': btnLine, 'arrow': btnArrow, 'rect': btnRect, 'circle': btnCircle, 'delete': btnDelete,
        'book': btnBook, 'totem': btnTotem,
        'folder': btnFolder, 'elements': btnElements
    };
    
    Object.values(btns).forEach(btn => btn.classList.remove('active'));
    btnToolProgressBar.classList.remove('active');
    btnToolClock.classList.remove('active');
    btnToolCalendar.classList.remove('active');
    btnToolDashboardBox.classList.remove('active');
    btnToolBox.classList.remove('active');
    btnToolTable.classList.remove('active');
    if (btnToolScrollBox) btnToolScrollBox.classList.remove('active');
    
    if (btns[mode]) btns[mode].classList.add('active');
    const editBtns = {
        'select': document.getElementById('btn-edit-tool-select'),
        'pan': document.getElementById('btn-edit-tool-pan'),
        'draw': document.getElementById('btn-edit-tool-draw'),
        'text': document.getElementById('btn-edit-tool-text'),
        'place-progress-bar': document.getElementById('btn-edit-tool-progress-bar'),
        'place-clock': document.getElementById('btn-edit-tool-clock'),
        'place-calendar': document.getElementById('btn-edit-tool-calendar'),
        'place-dashboard-box': document.getElementById('btn-edit-tool-dashboard-box'),
        'draw-box': document.getElementById('btn-edit-tool-box'),
        'place-table': document.getElementById('btn-edit-tool-table'),
        'place-scroll-box': document.getElementById('btn-edit-tool-scroll-box')
    };
    Object.values(editBtns).forEach(btn => btn && btn.classList.remove('active'));
    if (editBtns[mode]) editBtns[mode].classList.add('active');
    
    if (mode === 'elements') btnElements.classList.add('active');
    if (mode === 'place-progress-bar') {
        btnElements.classList.add('active');
        btnToolProgressBar.classList.add('active');
    }
    if (mode === 'place-clock') {
        btnElements.classList.add('active');
        btnToolClock.classList.add('active');
    }
    if (mode === 'place-calendar') {
        btnElements.classList.add('active');
        btnToolCalendar.classList.add('active');
    }
    if (mode === 'place-dashboard-box') {
        btnElements.classList.add('active');
        btnToolDashboardBox.classList.add('active');
    }
    if (mode === 'draw-box') {
        btnElements.classList.add('active');
        btnToolBox.classList.add('active');
    }
    if (mode === 'place-table') {
        btnElements.classList.add('active');
        btnToolTable.classList.add('active');
    }
    if (mode === 'place-scroll-box') {
        btnElements.classList.add('active');
        if (btnToolScrollBox) btnToolScrollBox.classList.add('active');
    }
    
    if (mode !== 'select' && mode !== 'pan') workspace.classList.add('draw-mode');
    else workspace.classList.remove('draw-mode');
    
    if (mode === 'select') instructionText.textContent = "Drag to select or move areas. Use Pan tool to navigate.";
    else if (mode === 'pan') instructionText.textContent = "Drag to pan, scroll to zoom.";
    else if (mode === 'draw') instructionText.textContent = "Click and drag to draw an area container or pencil stroke.";
    else if (mode === 'text') instructionText.textContent = "Click on the fabric to add an editable text note.";
    else if (mode === 'notepad') instructionText.textContent = "Click on the fabric to drop a Notepad document.";
    else if (mode === 'delete') instructionText.textContent = "Click on an Area, Shape, or Text to delete it.";
    else if (mode === 'totem') instructionText.textContent = "Click on the fabric to place a Totem Marker.";
    else if (mode === 'elements') instructionText.textContent = "Select an element from the ribbon to place.";
    else if (mode === 'place-progress-bar') instructionText.textContent = "Click inside an Area to place a Progress Bar.";
    else if (mode === 'place-clock') instructionText.textContent = "Click anywhere to place a Clock.";
    else if (mode === 'place-calendar') instructionText.textContent = "Click anywhere to place a Calendar.";
    else if (mode === 'place-dashboard-box') instructionText.textContent = "Click anywhere to place a Dashboard Box.";
    else if (mode === 'draw-box') instructionText.textContent = "Click and drag to draw a Box.";
    else if (mode === 'place-table') instructionText.textContent = "Configure Table and click anywhere to deploy.";
    else instructionText.textContent = "Click and drag on the fabric to draw a shape.";
}
class SmoothPen {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.isDrawing = false;
        this.points = [];
        this.emaPressure = 0.5;
        this.alpha = 0.3; // EMA smoothing factor
        this.minWidth = 2;
        this.maxWidth = 8;
        this.color = state.areaColor || '#000000';
    }

    start(e) {
        this.isDrawing = true;
        this.color = state.areaColor || '#000000';
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const p = e.pressure || 0.5;
        this.emaPressure = p;
        this.points = [{ x: worldPos.x, y: worldPos.y, pressure: this.emaPressure }];
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.clear();
    }

    addPoint(e) {
        if (!this.isDrawing) return;
        const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        const events = coalesced.length > 0 ? coalesced : [e];
        for (let ev of events) {
            // Unconditionally capture all hardware events
            const worldPos = screenToWorld(ev.clientX, ev.clientY);
            const p = ev.pressure || 0.5;
            this.emaPressure = (this.alpha * p) + ((1 - this.alpha) * this.emaPressure);
            this.points.push({ x: worldPos.x, y: worldPos.y, pressure: this.emaPressure });
        }
        
        // Draw once per pointer event batch for maximum performance without tearing
        this.drawOverlay();
    }

    drawOverlay() {
        if (this.points.length < 2) return;
        
        this.clear();
        this.ctx.save();
        
        // Match the camera transform for the overlay canvas
        const dpr = window.devicePixelRatio || 1;
        this.ctx.scale(dpr, dpr);
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        this.ctx.translate(width/2 + state.camera.x, height/2 + state.camera.y);
        this.ctx.scale(state.camera.zoom, state.camera.zoom);

        this.ctx.strokeStyle = this.color;
        
        // Midpoint Bezier interpolation drawn segment by segment for dynamic pressure
        if (this.points.length === 2) {
            this.ctx.lineWidth = this.minWidth + (this.maxWidth - this.minWidth) * this.points[1].pressure;
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);
            this.ctx.lineTo(this.points[1].x, this.points[1].y);
            this.ctx.stroke();
        } else {
            for (let i = 1; i < this.points.length - 1; i++) {
                const p0 = this.points[i];
                const p1 = this.points[i + 1];
                
                const prevP = this.points[i - 1];
                const prevMid = {
                    x: prevP.x + (p0.x - prevP.x) / 2,
                    y: prevP.y + (p0.y - prevP.y) / 2
                };
                
                const mid = {
                    x: p0.x + (p1.x - p0.x) / 2,
                    y: p0.y + (p1.y - p0.y) / 2
                };
                
                this.ctx.beginPath();
                this.ctx.moveTo(prevMid.x, prevMid.y);
                this.ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
                
                this.ctx.lineWidth = this.minWidth + (this.maxWidth - this.minWidth) * p0.pressure;
                this.ctx.stroke();
            }
            
            // Draw the very last segment to the actual point
            const last = this.points[this.points.length - 1];
            const secLast = this.points[this.points.length - 2];
            const finalMid = {
                x: secLast.x + (last.x - secLast.x) / 2,
                y: secLast.y + (last.y - secLast.y) / 2
            };
            this.ctx.beginPath();
            this.ctx.moveTo(finalMid.x, finalMid.y);
            this.ctx.lineTo(last.x, last.y);
            this.ctx.lineWidth = this.minWidth + (this.maxWidth - this.minWidth) * last.pressure;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    end() {
        if (!this.isDrawing) return null;
        this.isDrawing = false;
        const finalPoints = [...this.points];
        this.points = [];
        this.clear();
        return finalPoints;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

const smoothPen = new SmoothPen(inkCanvas, inkCtx);

// ─────────────────────────────────────────────────────────────────────────────
// TABLET MODE — TOUCH GESTURE LAYER
// When `tabletMode` is on, finger touches are reserved ENTIRELY for system gestures (2-finger
// pan, 2-finger tap for the options/context menu, 3-finger swipe up/down/left for Mission
// Control / Constellation / the Widget Sidebar) so a stylus can be used for every click/drag/
// draw interaction, exactly like a mouse, without a resting palm or finger accidentally drawing
// or dragging something. Pointer Events already unify mouse/pen/touch under ONE event stream
// with `e.pointerType` telling them apart, so this layer hooks the SAME pointerdown/move/up
// handlers workspace already has — it just intercepts and fully consumes `pointerType==='touch'`
// events (returning true) BEFORE any of the existing draw/select/drag logic runs, and lets
// everything else (mouse, pen, or touch while tabletMode is off) fall through completely
// unchanged. This is why enabling Tablet Mode cannot alter mouse/pen behavior in any way.
//
// Gesture classification uses the PEAK number of simultaneous fingers seen since the last time
// ALL fingers lifted (`touchGestureMaxCount`), not the live/instantaneous count — so lifting one
// finger early during a 3-finger swipe can't misfire as a 2-finger action, and once a gesture's
// peak is reached, only that finger-count's meaning applies until every finger comes up.
// ─────────────────────────────────────────────────────────────────────────────
const activeTouches = new Map();  // pointerId -> {x, y, downTime}
let touchGestureMaxCount = 0;     // peak simultaneous touch count since the last all-fingers-up reset
let touchGestureStart = null;     // {x, y} average screen position when the current peak count was first reached
let touchGestureFired = false;    // true once a swipe/tap has been dispatched for this finger-down sequence
let touchPanLast = null;          // {x, y} last average position used for continuous 2-finger pan

const TOUCH_SWIPE_THRESHOLD = 70; // screen px the 3-finger average must travel to count as a swipe
const TOUCH_TAP_MAX_MOVEMENT = 12; // screen px — below this, a 2-finger release counts as a tap
const TOUCH_TAP_MAX_DURATION = 350; // ms

function touchesAverage() {
    let sx = 0, sy = 0;
    for (const t of activeTouches.values()) { sx += t.x; sy += t.y; }
    const n = activeTouches.size || 1;
    return { x: sx / n, y: sy / n };
}

function resetTouchGesture() {
    activeTouches.clear();
    touchGestureMaxCount = 0;
    touchGestureStart = null;
    touchGestureFired = false;
    touchPanLast = null;
}

// Each returns true when it fully consumed the event (caller must stop normal handling).
function handleTabletTouchDown(e) {
    if (!tabletMode || e.pointerType !== 'touch') return false;
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY, downTime: performance.now() });
    if (activeTouches.size > touchGestureMaxCount) {
        touchGestureMaxCount = activeTouches.size;
        const avg = touchesAverage();
        touchGestureStart = { x: avg.x, y: avg.y };
        touchGestureFired = false; // a new finger raised the peak count -> re-arm for the new gesture meaning
    }
    if (activeTouches.size === 2) touchPanLast = touchesAverage();
    return true;
}

function handleTabletTouchMove(e) {
    if (!tabletMode || e.pointerType !== 'touch') return false;
    if (!activeTouches.has(e.pointerId)) return false;
    const rec = activeTouches.get(e.pointerId);
    rec.x = e.clientX; rec.y = e.clientY;

    if (touchGestureFired) return true; // already dispatched — ignore further movement until reset

    if (touchGestureMaxCount === 2 && activeTouches.size === 2) {
        // Continuous 2-finger PAN — apply the average position's frame-to-frame delta directly
        // to the camera, same effect as dragging with the pan tool.
        const avg = touchesAverage();
        if (touchPanLast) {
            state.camera.x += avg.x - touchPanLast.x;
            state.camera.y += avg.y - touchPanLast.y;
            scheduleRender();
        }
        touchPanLast = avg;
    } else if (touchGestureMaxCount === 3 && activeTouches.size === 3 && touchGestureStart) {
        const avg = touchesAverage();
        const dx = avg.x - touchGestureStart.x;
        const dy = avg.y - touchGestureStart.y;
        if (Math.hypot(dx, dy) >= TOUCH_SWIPE_THRESHOLD) {
            touchGestureFired = true; // fire once per gesture
            if (Math.abs(dy) > Math.abs(dx)) {
                if (dy < 0) openMissionControl();      // 3-finger swipe UP
                else toggleConstellationMode();         // 3-finger swipe DOWN
            } else if (dx < 0) {
                toggleWidgetSidebar();                  // 3-finger swipe LEFT
            }
        }
    }
    return true;
}

function handleTabletTouchUp(e) {
    if (!tabletMode || e.pointerType !== 'touch') return false;
    const rec = activeTouches.get(e.pointerId);
    activeTouches.delete(e.pointerId);

    // 2-finger TAP -> options/context menu (the touch equivalent of a mouse right-click).
    // Only counts if the gesture's peak never exceeded 2 fingers, no swipe already fired, the
    // release is quick, and the average position barely moved.
    if (!touchGestureFired && touchGestureMaxCount === 2 && rec && touchGestureStart) {
        const heldMs = performance.now() - rec.downTime;
        const moved = touchPanLast ? Math.hypot(touchPanLast.x - touchGestureStart.x, touchPanLast.y - touchGestureStart.y) : 0;
        if (heldMs <= TOUCH_TAP_MAX_DURATION && moved <= TOUCH_TAP_MAX_MOVEMENT) {
            touchGestureFired = true;
            handleWorkspaceContextMenu({
                clientX: touchGestureStart.x, clientY: touchGestureStart.y,
                target: workspace, preventDefault: () => {}
            });
        }
    }

    if (activeTouches.size === 0) resetTouchGesture();
    return true;
}

function setupWorkspaceListeners() {
    workspace.addEventListener('wheel', handleWorkspaceWheel, { passive: false });
    workspace.addEventListener('contextmenu', handleWorkspaceContextMenu);
    workspace.addEventListener('dblclick', handleWorkspaceDoubleClick);
    workspace.addEventListener('pointerdown', handleWorkspacePointerDown);
    workspace.addEventListener('pointermove', handleWorkspacePointerMove);
    workspace.addEventListener('pointerup', handleWorkspacePointerUp);
    workspace.addEventListener('pointercancel', handleWorkspacePointerUp);
    workspace.addEventListener('pointerleave', handleWorkspacePointerUp);
}

function handleWorkspaceWheel(e) {
        e.preventDefault();
        if (state.editingDashboardId) return; // Disable zoom in edit mode
        const zoomDelta = Math.exp(-e.deltaY * 0.005);
        
        const rect = workspace.getBoundingClientRect();
        const mouseX = e.clientX - rect.width/2;
        const mouseY = e.clientY - rect.height/2;

        const newZoom = Math.min(Math.max(state.camera.zoom * zoomDelta, 0.25), 5);
        const actualZoomDelta = newZoom / state.camera.zoom;
        
        state.camera.x = mouseX - (mouseX - state.camera.x) * actualZoomDelta;
        state.camera.y = mouseY - (mouseY - state.camera.y) * actualZoomDelta;
        state.camera.zoom = newZoom;
        
        scheduleRender();
}

function handleWorkspaceContextMenu(e) {
        if (e.target.closest('#toolbar') || e.target.closest('.file-item') || e.target.closest('.properties-panel') || e.target.closest('.inline-text-input') || e.target.closest('[contenteditable="true"]')) return;
        
        if (Date.now() - lastPanEndTime < 100) {
            e.preventDefault();
            return;
        }
        
        const worldPos = screenToWorld(e.clientX, e.clientY);


        // Hit-test totems
        let hitTotem = null;
        ctx.font = `500 ${16 / state.camera.zoom}px Inter, sans-serif`;
        for (let i = state.totems.length - 1; i >= 0; i--) {
            let t = state.totems[i];
            const metrics = ctx.measureText(t.name);
            const padX = 20 / state.camera.zoom;
            const padY = 10 / state.camera.zoom;
            const width = metrics.width + padX * 2;
            const height = (16 / state.camera.zoom) + padY * 2;
            const minX = t.x - width/2;
            const maxX = t.x + width/2;
            const minY = t.y - height/2;
            const maxY = t.y + height/2;
            
            if (worldPos.x >= minX && worldPos.x <= maxX && worldPos.y >= minY && worldPos.y <= maxY) {
                hitTotem = t;
                break;
            }
        }
        if (hitTotem) {
            e.preventDefault();
            showTotemContextMenu(e.clientX, e.clientY, hitTotem);
            return;
        }

        // Hit-test drawings first
        const hitDrawing = getDraggableDrawingAt(worldPos);
        if (hitDrawing && hitDrawing.type === 'text') {
            e.preventDefault();
            showTextContextMenu(e.clientX, e.clientY, hitDrawing);
            return;
        } else if (hitDrawing && hitDrawing.type === 'progress_bar') {
            e.preventDefault();
            showProgressBarContextMenu(e.clientX, e.clientY, hitDrawing);
            return;
        } else if (hitDrawing && hitDrawing.type === 'clock') {
            e.preventDefault();
            showClockContextMenu(e.clientX, e.clientY, hitDrawing);
            return;
        } else if (hitDrawing && hitDrawing.type === 'calendar') {
            e.preventDefault();
            showCalendarContextMenu(e.clientX, e.clientY, hitDrawing);
            return;
        }

        // Hit-test areas (smallest first for nested)
        let hitArea = null;
        let hitAreas = [];
        for (let i = state.areas.length - 1; i >= 0; i--) {
            if (!isItemVisibleInContainer(state.areas[i])) continue;
            let hit = false;
            if (state.areas[i].polygons) {
                for (let p of state.areas[i].polygons) {
                    if (isPointInPolygon(worldPos, p)) { hit = true; break; }
                }
            } else if (state.areas[i].points) {
                if (isPointInPolygon(worldPos, state.areas[i].points)) hit = true;
            }
            if (hit) hitAreas.push(state.areas[i]);
        }
        
        if (hitAreas.length > 0) {
            hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
            hitArea = hitAreas[0]; // smallest (most nested)
        }
        
        if (!hitArea) return; // No area clicked, let browser handle
        
        e.preventDefault();
        showAreaContextMenu(e.clientX, e.clientY, hitArea);
    }

function handleWorkspaceDoubleClick(e) {
        if (e.target.closest('#toolbar') || e.target.closest('.file-item') || e.target.closest('.properties-panel')) return;
        
        const worldPos = screenToWorld(e.clientX, e.clientY);

        
        // Hit-test drawings first (for progress bar)
        const hitDrawing = getDraggableDrawingAt(worldPos);
        if (hitDrawing && hitDrawing.type === 'progress_bar') {
            if (state.selectedDrawings.has(hitDrawing.id)) {
                state.selectedDrawings.delete(hitDrawing.id);
            } else {
                state.selectedDrawings.clear();
                state.selectedAreaId = null;
                state.selectedDrawings.add(hitDrawing.id);
            }
            scheduleRender();
            return;
        }
        
        // Hit-test areas
        let hitArea = null;
        let hitAreas = [];
        for (let i = state.areas.length - 1; i >= 0; i--) {
            if (!isItemVisibleInContainer(state.areas[i])) continue;
            let hit = false;
            if (state.areas[i].polygons) {
                for (let p of state.areas[i].polygons) {
                    if (isPointInPolygon(worldPos, p)) { hit = true; break; }
                }
            } else if (state.areas[i].points) {
                if (isPointInPolygon(worldPos, state.areas[i].points)) hit = true;
            }
            if (hit) hitAreas.push(state.areas[i]);
        }
        
        if (hitAreas.length > 0) {
            hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
            hitArea = hitAreas[0];
        }
        
        if (hitArea && hitArea.isFolder) {
            openEdgeSidebar(hitArea.id);
            return;
        }
        if (hitArea && hitArea.isNote) {
            const el = document.getElementById(`note-${hitArea.id}`);
            if (el) {
                if (el.tagName === 'TEXTAREA') {
                    el.style.pointerEvents = 'auto';
                    el.focus();
                } else {
                    const editor = el.querySelector('.note-editor');
                    if (editor) {
                        editor.style.pointerEvents = 'auto';
                        editor.focus();
                    }
                }
            }
            return;
        }
        
        if (hitArea) {
            // Toggle selection
            state.selectedAreaId = (state.selectedAreaId === hitArea.id) ? null : hitArea.id;
        } else {
            state.selectedAreaId = null;
        }
        state.selectedDrawings.clear();
        state.marchingAntsOffset = 0;
        scheduleRender();
    }

let lastPanEndTime = 0;

function handleWorkspacePointerDown(e) {
        if (handleTabletTouchDown(e)) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);

        let clickedHandle = false;
        if (e.button === 0 && state.selectedText && state.selectedText._handles) {
            for (const handle of state.selectedText._handles) {
                const hx = handle.x;
                const hy = handle.y;
                const hs = (handle.size || 6) * 1.5;
                if (worldPos.x >= hx - hs && worldPos.x <= hx + hs &&
                    worldPos.y >= hy - hs && worldPos.y <= hy + hs) {

                    state.resizingText = {
                        drawing: state.selectedText,
                        handle: handle.id,
                        startX: state.selectedText.x,
                        startWidth: state.selectedText.width || state.selectedText._calculatedWidth || 300,
                        startPointerX: worldPos.x
                    };
                    workspace.style.cursor = handle.cursor;
                    workspace.setPointerCapture(e.pointerId);
                    clickedHandle = true;
                    break;
                }
            }
        }

        // Text boxes: also let the user grab anywhere along the left/right boundary line,
        // not just the small handle dot at its midpoint.
        if (!clickedHandle && e.button === 0 && state.selectedText && state.selectedText._resizeBox) {
            const box = state.selectedText._resizeBox;
            const tol = 10 / state.camera.zoom;
            const withinY = worldPos.y >= box.y - tol && worldPos.y <= box.y + box.h + tol;
            let edgeId = null;
            if (withinY && Math.abs(worldPos.x - box.x) <= tol) edgeId = 'w';
            else if (withinY && Math.abs(worldPos.x - (box.x + box.w)) <= tol) edgeId = 'e';

            if (edgeId) {
                state.resizingText = {
                    drawing: state.selectedText,
                    handle: edgeId,
                    startX: state.selectedText.x,
                    startWidth: state.selectedText.width || state.selectedText._calculatedWidth || 300,
                    startPointerX: worldPos.x
                };
                workspace.style.cursor = 'ew-resize';
                workspace.setPointerCapture(e.pointerId);
                clickedHandle = true;
            }
        }

        if (!clickedHandle) {
            const inlineInput = document.querySelector('.inline-text-input');
            if (inlineInput && state.finalizeInlineText && !e.target.closest('.inline-text-input')) {
                state.finalizeInlineText();
            }
        } else {
            return;
        }
        
        if (state.mode === 'delete' && e.button === 0 && e.target instanceof Element) {
            const hitTable = e.target.closest('.table-container');
            if (hitTable) {
                const tableId = hitTable.id;
                state.tables = state.tables.filter(t => t.id !== tableId);
                hitTable.remove();
                saveCurrentFabric();
                return;
            }
        }
        if (!(e.target instanceof Element)) return;
        
        if (state.mode === 'move-totem') {
            e.preventDefault();
            e.stopPropagation();
            state.mode = 'select';
            state.movingTotemContext = null;
            workspace.style.cursor = 'grab';
            recalculateItemLinks();
            saveCurrentFabric();
            scheduleRender();
            return;
        }
        
        if (e.target.closest('#toolbar') || e.target.closest('.file-item') || e.target.closest('.totem-indicator') || e.target.closest('input[data-note-cb]') || e.target.closest('.table-container')) return;
        
        // worldPos defined above

        if (state.editingDashboardId) {
            const area = state.areas.find(a => a.id === state.editingDashboardId);
            if (area) {
                const polys = area.polygons || (area.points ? [area.points] : []);
                if (polys.length > 0) {
                    if (!isPointInPolygon(worldPos, polys[0])) {
                        return; // Ignore clicks outside the dashboard box in edit mode
                    }
                }
            }
        }

        if (state.isConstellationMode) {
            let hitTotem = null;
            ctx.font = `500 ${16 / state.camera.zoom}px Inter, sans-serif`;
            for (let i = state.totems.length - 1; i >= 0; i--) {
                let t = state.totems[i];
                const metrics = ctx.measureText(t.name);
                const padX = 20 / state.camera.zoom;
                const padY = 10 / state.camera.zoom;
                const width = metrics.width + padX * 2;
                const height = (16 / state.camera.zoom) + padY * 2;
                if (worldPos.x >= t.x - width/2 && worldPos.x <= t.x + width/2 && 
                    worldPos.y >= t.y - height/2 && worldPos.y <= t.y + height/2) {
                    hitTotem = t;
                    break;
                }
            }
            
            if (hitTotem) {
                state.isConstellationMode = false;
                document.body.classList.remove('constellation-mode');
                const tz = 1; // Always zoom in to 100% when jumping to a specific totem
                const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
                startCameraAnimation(-hitTotem.x * tz, 120 - canvasHeight/2 - hitTotem.y * tz, tz);
                return;
            }
            
            if (state.editingDashboardId) return; // Disable pan in edit mode
            state.cameraPanStartX = state.camera.x;
            state.cameraPanStartY = state.camera.y;
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            workspace.style.cursor = 'grabbing';
            workspace.setPointerCapture(e.pointerId);
            return;
        }

        if (state.mode === 'delete' && e.button === 0) {
            let hitDrawingId = null;
            let hitAreaId = null;
            const pad = 15 / state.camera.zoom;

            // ── Check Links first (click near a bezier curve) ──
            const hitLinkId = (() => {
                const hitPad = 25 / state.camera.zoom;
                for (const link of state.links) {
                    const fromArea = state.areas.find(a => a.id === link.fromAreaId);
                    const toArea   = state.areas.find(a => a.id === link.toAreaId);
                    if (!fromArea || !toArea) continue;
                    const from = getAreaCorners(fromArea)[link.fromCorner];
                    const to   = getAreaCorners(toArea)[link.toCorner];
                    if (!from || !to) continue;

                    const dist  = Math.hypot(to.x - from.x, to.y - from.y);
                    const offset = Math.min(dist * 0.45, 120 / state.camera.zoom);
                    const fromIsRight = link.fromCorner.includes('r');
                    const toIsLeft    = link.toCorner.includes('l');
                    const cp1x = from.x + (fromIsRight ? offset : -offset);
                    const cp1y = from.y;
                    const cp2x = to.x + (toIsLeft ? -offset : offset);
                    const cp2y = to.y;

                    // Sample dynamically based on line length to guarantee accurate hit detection
                    const numSteps = Math.max(30, Math.ceil((dist * state.camera.zoom) / 5));
                    for (let s = 0; s <= numSteps; s++) {
                        const t  = s / numSteps;
                        const mt = 1 - t;
                        const bx = mt*mt*mt*from.x + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*to.x;
                        const by = mt*mt*mt*from.y + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*to.y;
                        if (Math.hypot(worldPos.x - bx, worldPos.y - by) < hitPad) {
                            return link.id;
                        }
                    }
                }
                return null;
            })();

            if (hitLinkId) {
                state.links = state.links.filter(l => l.id !== hitLinkId);
                scheduleRender();
                saveCurrentFabric();
                return;
            }

            for (let i = state.drawings.length - 1; i >= 0; i--) {
                const d = state.drawings[i];
                if (!isItemVisibleInContainer(d)) continue;
                if (state.eraserMode === 'lines' && !['path', 'line', 'arrow'].includes(d.type)) {
                    continue;
                }
                if (d.type === 'text') {
                    let w, h;
                    const textEl = document.getElementById(d.id);
                    if (textEl) {
                        w = textEl.offsetWidth;
                        h = textEl.offsetHeight;
                    } else {
                        const fSize = d.fontSize || 24;
                        const lines = d.text.split('\n');
                        const fontStyle = d.isItalic ? 'italic ' : '';
                        const fontWeight = d.isBold ? 'bold ' : '600 ';
                        h = 0;
                        w = 0;
                        for(const line of lines) {
                            const fs = getLineFontSize(line, fSize);
                            ctx.font = `${fontStyle}${fontWeight}${fs}px ${d.fontFamily || 'Inter, sans-serif'}`;
                            const mt = ctx.measureText(line.replace(/^#+\s/, ''));
                            if (mt.width > w) w = mt.width;
                            h += fs * 1.2;
                        }
                    }
                    if (worldPos.x >= d.x - pad && worldPos.x <= d.x + w + pad &&
                        worldPos.y >= d.y - pad && worldPos.y <= d.y + h + pad) {
                        hitDrawingId = d.id; break;
                    }
                } else if (d.type === 'path') {
                    for (const pt of d.points) {
                        if (Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y) < pad * 2.5) {
                            hitDrawingId = d.id; break;
                        }
                    }
                    if (hitDrawingId) break;
                } else if (d.type === 'rect') {
                    const minX = Math.min(d.start.x, d.end.x);
                    const maxX = Math.max(d.start.x, d.end.x);
                    const minY = Math.min(d.start.y, d.end.y);
                    const maxY = Math.max(d.start.y, d.end.y);
                    if (worldPos.x >= minX - pad && worldPos.x <= maxX + pad && 
                        worldPos.y >= minY - pad && worldPos.y <= maxY + pad) {
                        hitDrawingId = d.id; break;
                    }
                } else if (d.type === 'circle') {
                    const r = Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y);
                    if (Math.hypot(worldPos.x - d.start.x, worldPos.y - d.start.y) <= r + pad) {
                        hitDrawingId = d.id; break;
                    }
                } else if (d.type === 'line' || d.type === 'arrow') {
                    const l2 = Math.pow(d.end.x - d.start.x, 2) + Math.pow(d.end.y - d.start.y, 2);
                    if (l2 !== 0) {
                        let t = ((worldPos.x - d.start.x) * (d.end.x - d.start.x) + (worldPos.y - d.start.y) * (d.end.y - d.start.y)) / l2;
                        t = Math.max(0, Math.min(1, t));
                        const projX = d.start.x + t * (d.end.x - d.start.x);
                        const projY = d.start.y + t * (d.end.y - d.start.y);
                        if (Math.hypot(worldPos.x - projX, worldPos.y - projY) < pad * 2.5) {
                            hitDrawingId = d.id; break;
                        }
                    }
                } else if (d.type === 'progress_bar' || d.type === 'calendar') {
                    if (worldPos.x >= d.x - pad && worldPos.x <= d.x + d.width + pad &&
                        worldPos.y >= d.y - pad && worldPos.y <= d.y + d.height + pad) {
                        hitDrawingId = d.id; break;
                    }
                }
            }
            
            if (hitDrawingId) {
                state.drawings = state.drawings.filter(d => d.id !== hitDrawingId);
                if (state.selectedText && state.selectedText.id === hitDrawingId) {
                    state.selectedText = null;
                    hidePropertiesPanel();
                }
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            
            // Check Areas
            if (state.eraserMode !== 'lines') {
                for (let i = state.areas.length - 1; i >= 0; i--) {
                if (!isItemVisibleInContainer(state.areas[i])) continue;
                let hit = false;
                if (state.areas[i].polygons) {
                    for (let p of state.areas[i].polygons) {
                        if (isPointInPolygon(worldPos, p)) { hit = true; break; }
                    }
                } else if (state.areas[i].points) {
                    if (isPointInPolygon(worldPos, state.areas[i].points)) hit = true;
                }
                
                if (hit) {
                    hitAreaId = state.areas[i].id;
                    break;
                }
            }
            
            if (hitAreaId) {
                state.areas = state.areas.filter(a => a.id !== hitAreaId);
                for (let file of state.files) {
                    if (file.areaId === hitAreaId) {
                        file.areaId = null;
                        file.areaName = 'Unassigned';
                        const el = document.getElementById(`file-${file.id}`);
                        if (el) {
                            const badge = el.querySelector('.file-area');
                            if (badge) {
                                badge.textContent = 'Unassigned';
                                badge.classList.add('unassigned');
                            }
                        }
                    }
                }
                scheduleRender();
                saveCurrentFabric();
            }
            } // close if (state.eraserMode !== 'lines')
            
            return;
        }

        if ((state.mode === 'pan' || spacePressed) && e.button === 0) {
            if (state.editingDashboardId) return; // Disable panning in edit mode
            state.selectedText = null;
            state.selectedDrawings.clear();
            hidePropertiesPanel();
            state.cameraPanStartX = state.camera.x;
            state.cameraPanStartY = state.camera.y;
            state.isPanning = true;
            state.panStart = { x: e.clientX - state.camera.x, y: e.clientY - state.camera.y };
            workspace.style.cursor = 'grabbing';
            workspace.setPointerCapture(e.pointerId);
            return;
        }

        if (state.mode === 'select' || e.button === 1) { 
            let clickedArea = null;
            let clickedText = null;

            if (state.mode === 'select' && state.selectMode === 'lasso' && e.button === 0) {
                let hitExistingLasso = false;
                if (state.lassoPolygon && state.lassoPolygon.length > 2) {
                    if (isPointInPolygon(worldPos, state.lassoPolygon)) hitExistingLasso = true;
                }
                
                if (hitExistingLasso) {
                    state.draggingLasso = true;
                    state.dragStartWorld = worldPos;
                    
                    // Snapshot everything
                    state.lassoInitialPositions = { areas: {}, drawings: {}, files: {}, totems: {} };
                    state.lassoSelection.areas.forEach(id => {
                        const a = state.areas.find(area => area.id === id);
                        if (a) state.lassoInitialPositions.areas[id] = { polygons: a.polygons ? JSON.parse(JSON.stringify(a.polygons)) : null, points: a.points ? JSON.parse(JSON.stringify(a.points)) : null };
                    });
                    state.lassoSelection.drawings.forEach(id => {
                        const d = state.drawings.find(dr => dr.id === id);
                        if (d) {
                            if (d.type === 'path') {
                                state.lassoInitialPositions.drawings[id] = { points: JSON.parse(JSON.stringify(d.points)) };
                            } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle' || d.type === 'book') {
                                state.lassoInitialPositions.drawings[id] = { start: {...d.start}, end: {...d.end} };
                            } else {
                                state.lassoInitialPositions.drawings[id] = { x: d.x, y: d.y };
                            }
                        }
                    });
                    state.lassoSelection.files.forEach(id => {
                        const f = state.files.find(file => file.id === id);
                        if (f) state.lassoInitialPositions.files[id] = { x: f.x, y: f.y };
                    });
                    state.lassoSelection.totems.forEach(id => {
                        const t = state.totems.find(tot => tot.id === id);
                        if (t) state.lassoInitialPositions.totems[id] = { x: t.x, y: t.y };
                    });
                    state.lassoInitialPolygon = JSON.parse(JSON.stringify(state.lassoPolygon));
                    
                    workspace.style.cursor = 'move';
                    workspace.setPointerCapture(e.pointerId);
                    return;
                } else {
                    state.isDrawingLasso = true;
                    state.lassoPolygon = [worldPos];
                    state.lassoSelection = { areas: new Set(), drawings: new Set(), files: new Set(), totems: new Set() };
                    workspace.setPointerCapture(e.pointerId);
                    scheduleRender();
                    return;
                }
            }

            if (e.button === 0) {
                // Handle check moved to top of function
                
                // Check if clicking on Text or Progress Bar drawing First
                clickedText = getDraggableDrawingAt(worldPos);
                if (clickedText) {
                    if (clickedText.type === 'progress_bar' || clickedText.type === 'clock' || clickedText.type === 'calendar') {
                        state.selectedAreaId = null;
                        state.selectedDrawings.clear();
                        state.selectedDrawings.add(clickedText.id);
                        if (!clickedText.isLocked) {
                            state.draggingText = clickedText;
                            state.dragStartWorld = worldPos;
                            state.textStartPos = {x: clickedText.x, y: clickedText.y};
                            workspace.style.cursor = 'move';
                            workspace.setPointerCapture(e.pointerId);
                        }
                        scheduleRender();
                        return;
                    }
                }

                // Check totems next — they render on top of areas (drawTotems() runs after
                // drawAreas() in render()), so they must take hit-test priority over areas too.
                // BUG: totems previously had NO hit-test in this select-mode click path at all,
                // so clicking one always fell through to "clicked empty space" and started a
                // camera pan instead. This only handles direct single-totem drag; the existing
                // "Move" context-menu action (state.mode='move-totem') still separately handles
                // relocating a totem's whole magnetic-field cluster together.
                let clickedTotem = null;
                if (!clickedText) {
                    ctx.font = `500 ${16 / state.camera.zoom}px Inter, sans-serif`;
                    for (let i = state.totems.length - 1; i >= 0; i--) {
                        const t = state.totems[i];
                        const metrics = ctx.measureText(t.name);
                        const padX = 20 / state.camera.zoom;
                        const padY = 10 / state.camera.zoom;
                        const width = metrics.width + padX * 2;
                        const height = (16 / state.camera.zoom) + padY * 2;
                        if (worldPos.x >= t.x - width/2 && worldPos.x <= t.x + width/2 &&
                            worldPos.y >= t.y - height/2 && worldPos.y <= t.y + height/2) {
                            clickedTotem = t;
                            break;
                        }
                    }
                    if (clickedTotem) {
                        state.selectedText = null;
                        state.selectedDrawings.clear();
                        hidePropertiesPanel();
                        // Direct normal dragging of totems is disabled per user request.
                        // Totems must be moved via the right-click "Move Totem & Field" option.
                        scheduleRender();
                        return;
                    }
                }

                // If not text or a totem, check areas
                if (!clickedText && !clickedTotem) {
                    let hitAreas = [];
                    for (let i = state.areas.length - 1; i >= 0; i--) {
                        if (!isItemVisibleInContainer(state.areas[i])) continue;
                        let innerHit = false;
                        if (state.areas[i].polygons) {
                            for (let p of state.areas[i].polygons) {
                                if (isPointInPolygon(worldPos, p)) {
                                    innerHit = true; break;
                                }
                            }
                        } else if (state.areas[i].points) {
                            if (isPointInPolygon(worldPos, state.areas[i].points)) innerHit = true;
                        }
                        
                        if (innerHit) {
                            hitAreas.push(state.areas[i]);
                        } else if (state.areas[i].isBook) {
                            if (handleBookUIClick(state.areas[i], worldPos)) {
                                scheduleRender();
                                return;
                            }
                        }
                    }
                    if (hitAreas.length > 0) {
                        hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
                        clickedArea = hitAreas[0];
                        
                        if (clickedArea.isBook) {
                            if (handleBookUIClick(clickedArea, worldPos)) {
                                scheduleRender();
                                return;
                            }
                        }
                    }
                }
            }

            if (clickedText) {
                if (state.selectedText !== clickedText) {
                    state.selectedText = clickedText;
                    showPropertiesPanel(clickedText);
                    scheduleRender();
                } else if (!clickedText.isLocked) {
                    state.draggingText = clickedText;
                    state.dragStartWorld = worldPos;
                    workspace.style.cursor = 'move';
                    workspace.setPointerCapture(e.pointerId);
                }
            } else if (clickedArea) {
                state.selectedText = null;
                hidePropertiesPanel();
                if (!clickedArea.isLocked) {
                    state.draggingArea = clickedArea;
                
                // Build Spatially Linked Hierarchy Drag Set
                let dragSet = new Set([clickedArea.id]);
                let added = true;
                while(added) {
                    added = false;
                    for (let a of state.areas) {
                        if (dragSet.has(a.id)) continue;
                        if (a.isLocked) {
                            if (dragSet.has(a.parentAreaId)) {
                                dragSet.add(a.id);
                                added = true;
                            }
                            continue;
                        }
                        
                        let insideAny = false;
                        for (let parentId of dragSet) {
                            const parentArea = state.areas.find(pa => pa.id === parentId);
                            if (!parentArea) continue;
                            
                            // Check if 'a' is strictly inside 'parentArea'
                            const checkPts = [];
                            if (a.polygons) {
                                for (let p of a.polygons) checkPts.push(...p);
                            } else if (a.points) {
                                checkPts.push(...a.points);
                            }
                            
                            let allInside = true;
                            if (checkPts.length === 0) allInside = false;
                            
                            for (let pt of checkPts) {
                                let ptInParent = false;
                                if (parentArea.polygons) {
                                    for (let p of parentArea.polygons) {
                                        if (isPointInPolygon(pt, p)) { ptInParent = true; break; }
                                    }
                                } else if (parentArea.points) {
                                    if (isPointInPolygon(pt, parentArea.points)) ptInParent = true;
                                }
                                if (!ptInParent) { allInside = false; break; }
                            }
                            
                            if (allInside) { insideAny = true; break; }
                        }
                        
                        if (insideAny) {
                            dragSet.add(a.id);
                            added = true;
                        }
                    }
                }
                state.dragSetAreas = Array.from(dragSet).map(id => state.areas.find(a => a.id === id));
                
                // Bring the entire drag set to the front (top of z-index) while preserving their relative order
                const draggedIds = new Set(state.dragSetAreas.map(a => a.id));
                const otherAreas = state.areas.filter(a => !draggedIds.has(a.id));
                const draggedAreasSorted = state.areas.filter(a => draggedIds.has(a.id));
                state.areas = [...otherAreas, ...draggedAreasSorted];
                
                // Collect drawings that spatially exist completely within the moving Area Drag Set
                state.dragSetDrawings = [];
                for (let d of state.drawings) {
                    if (d.isLocked) {
                        if (state.dragSetAreas.some(a => a.id === d.areaId)) {
                            state.dragSetDrawings.push(d);
                        }
                        continue;
                    }
                    let ptsToCheck = [];
                    if (d.type === 'text' || d.type === 'progress_bar' || d.type === 'clock' || d.type === 'calendar') ptsToCheck.push({x: d.x, y: d.y});
                    else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect') ptsToCheck.push(d.start, d.end);
                    else if (d.type === 'circle') ptsToCheck.push(d.start, {x: d.start.x + Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y), y: d.start.y});
                    else if (d.type === 'path') ptsToCheck.push(...d.points);
                    
                    if (ptsToCheck.length === 0) continue;
                    
                    let insideAny = false;
                    for (let area of state.dragSetAreas) {
                        let allInside = true;
                        for (let pt of ptsToCheck) {
                            let inArea = false;
                            if (area.polygons) {
                                for (let p of area.polygons) {
                                    if (isPointInPolygon(pt, p)) { inArea = true; break; }
                                }
                            } else if (area.points) {
                                if (isPointInPolygon(pt, area.points)) inArea = true;
                            }
                            if (!inArea) { allInside = false; break; }
                        }
                        if (allInside) { insideAny = true; break; }
                    }
                    if (insideAny) state.dragSetDrawings.push(d);
                }
                
                state.dragStartWorld = worldPos;
                workspace.style.cursor = 'move';
                workspace.setPointerCapture(e.pointerId);
                }
            } else {
                state.selectedText = null;
                state.selectedDrawings.clear();
                hidePropertiesPanel();
                state.cameraPanStartX = state.camera.x;
                state.cameraPanStartY = state.camera.y;
                state.isPanning = true;
                state.panStart = { x: e.clientX - state.camera.x, y: e.clientY - state.camera.y };
                workspace.style.cursor = 'grabbing';
                workspace.setPointerCapture(e.pointerId);
            }
        } else if (['draw', 'text', 'notepad', 'line', 'arrow', 'rect', 'circle', 'book', 'folder', 'totem', 'place-progress-bar', 'place-clock', 'place-calendar', 'place-dashboard-box', 'draw-box', 'place-table', 'place-scroll-box'].includes(state.mode) && e.button === 0) {
            if (state.mode === 'totem') {
                const name = prompt("Enter Totem Name:");
                if (name && name.trim() !== '') {
                    const newTotem = {
                        id: Date.now() + Math.random().toString(36).substr(2, 5),
                        name: name.trim(),
                        color: '#3b5a76',
                        radius: 0,
                        x: worldPos.x,
                        y: worldPos.y,
                        isLocked: false
                    };
                    newTotem.thumbnail = generateTotemThumbnail(newTotem.x, newTotem.y);
                    state.totems.push(newTotem);
                    saveCurrentFabric();
                    scheduleRender();
                }
                setMode('select');
                return;
            }
            if (state.mode === 'text') {
                state.isDrawingTextBox = true;
                state.textStart = worldPos;
                workspace.setPointerCapture(e.pointerId);
                return;
            }
            if (state.mode === 'notepad') {
                createNotepad(worldPos);
                return;
            }
            
            if (state.mode === 'folder') {
                const w = 120;
                const h = 90;
                let folderName = prompt("Enter Folder Name:");
                if (!folderName) return;
                
                const newArea = {
                    id: Date.now().toString(),
                    name: folderName,
                    color: '#60a5fa', // Default blue folder color
                    type: 'folder',
                    isFolder: true,
                    polygons: [[
                        {x: worldPos.x, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y + h},
                        {x: worldPos.x, y: worldPos.y + h}
                    ]],
                    containedFiles: []
                };
                state.areas.push(newArea);
                state.mode = 'select';
                setMode('select');
                saveCurrentFabric();
                scheduleRender();
                return;
            }

            if (state.mode === 'place-progress-bar') {
                state.drawings.push({
                    type: 'progress_bar',
                    id: Date.now().toString(),
                    x: worldPos.x,
                    y: worldPos.y,
                    width: 300,
                    height: 20,
                    progress: 0.5,
                    color: '#4f46e5',
                    parentAreaId: state.editingDashboardId || null,
                    areaId: state.editingDashboardId || null
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            if (state.mode === 'place-clock') {
                state.drawings.push({
                    type: 'clock',
                    id: Date.now().toString(),
                    x: worldPos.x,
                    y: worldPos.y,
                    width: 200,
                    height: 30,
                    parentAreaId: state.editingDashboardId || null,
                    areaId: state.editingDashboardId || null
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            if (state.mode === 'place-calendar') {
                state.drawings.push({
                    type: 'calendar',
                    id: Date.now().toString(),
                    x: worldPos.x,
                    y: worldPos.y,
                    width: 320,
                    height: 375,
                    parentAreaId: state.editingDashboardId || null,
                    areaId: state.editingDashboardId || null
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            if (state.mode === 'place-dashboard-box') {
                const w = 400;
                const h = 300;
                state.areas.push({
                    id: Date.now().toString(),
                    name: '',
                    type: 'dashboard_box',
                    points: [
                        {x: worldPos.x, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y + h},
                        {x: worldPos.x, y: worldPos.y + h}
                    ]
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            if (state.mode === 'place-table') {
                const rows = parseInt(tableRowsInput.value) || 3;
                const cols = parseInt(tableColsInput.value) || 3;
                state.tables.push({
                    id: 'table-' + Date.now().toString(),
                    x: worldPos.x,
                    y: worldPos.y,
                    rows: rows,
                    cols: cols,
                    cells: {},
                    parentAreaId: state.editingDashboardId || null,
                    areaId: state.editingDashboardId || null,
                    scrollBoxPageId: getActiveScrollBoxPageId(state.editingDashboardId)
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            if (state.mode === 'place-scroll-box') {
                const w = 400;
                const h = 300;
                state.areas.push({
                    id: Date.now().toString(),
                    name: 'Scroll Box',
                    type: 'scroll_box',
                    isScrollBox: true,
                    points: [
                        {x: worldPos.x, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y},
                        {x: worldPos.x + w, y: worldPos.y + h},
                        {x: worldPos.x, y: worldPos.y + h}
                    ],
                    layout: 'horizontal',
                    pages: [{ id: Date.now().toString() }],
                    currentPageIndex: 0
                });
                setMode('select');
                scheduleRender();
                saveCurrentFabric();
                return;
            }
            
            state.isDrawing = true;
            state.currentShapeType = state.mode;
            state.dragStartWorld = worldPos;
            state.shapeStartWorld = worldPos;
            state.shapeEndWorld = worldPos;
            
            // For line tool: check if starting near a corner hole
            if (state.mode === 'line') {
                const hole = getNearestHole(worldPos, 40);
                if (hole) {
                    state.linkDraftStart = hole;
                    state.shapeStartWorld = { ...hole.worldPos };
                } else {
                    state.linkDraftStart = null;
                }
            }
            
            if (state.mode === 'draw') {
                smoothPen.start(e);
                workspace.setPointerCapture(e.pointerId);
                return;
            }

            workspace.setPointerCapture(e.pointerId);
        }
    }

function handleWorkspacePointerMove(e) {
        if (handleTabletTouchMove(e)) return;
        if (state.mode === 'delete' && e.buttons === 1) {
            // Drag-to-erase logic: fire pointerdown at current location
            workspace.dispatchEvent(new PointerEvent('pointerdown', {
                clientX: e.clientX,
                clientY: e.clientY,
                button: 0,
                bubbles: true
            }));
            return;
        }

        if (state.isPanning) {
            state.camera.x = e.clientX - state.panStart.x;
            state.camera.y = e.clientY - state.panStart.y;
            scheduleRender();
        } else if (state.isDrawingLasso) {
            const worldPos = screenToWorld(e.clientX, e.clientY);

            state.lassoPolygon.push(worldPos);
            scheduleRender();
        } else if (state.draggingLasso) {
            const worldPos = screenToWorld(e.clientX, e.clientY);

            const dx = worldPos.x - state.dragStartWorld.x;
            const dy = worldPos.y - state.dragStartWorld.y;
            state.dragStartWorld = worldPos;
            
            // Move lasso polygon
            for (let pt of state.lassoPolygon) { pt.x += dx; pt.y += dy; }
            
            // Move areas
            state.lassoSelection.areas.forEach(id => {
                const a = state.areas.find(area => area.id === id);
                if (a) {
                    if (a.polygons) {
                        for (let p of a.polygons) for (let pt of p) { pt.x += dx; pt.y += dy; }
                    } else if (a.points) {
                        for (let pt of a.points) { pt.x += dx; pt.y += dy; }
                    }
                }
            });
            // Move drawings
            state.lassoSelection.drawings.forEach(id => {
                const d = state.drawings.find(dr => dr.id === id);
                if (d) {
                    if (d.type === 'path') {
                        for(let pt of d.points) { pt.x += dx; pt.y += dy; }
                    } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle' || d.type === 'book') {
                        d.start.x += dx; d.start.y += dy;
                        d.end.x += dx; d.end.y += dy;
                    } else { d.x += dx; d.y += dy; }
                }
            });
            // Move files
            state.lassoSelection.files.forEach(id => {
                const f = state.files.find(file => file.id === id);
                if (f) { f.x += dx; f.y += dy; }
            });
            // Move totems
            state.lassoSelection.totems.forEach(id => {
                const t = state.totems.find(tot => tot.id === id);
                if (t) { t.x += dx; t.y += dy; }
            });
            
            scheduleRender();
        } else if (state.mode === 'move-totem' && state.movingTotemContext) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const dx = worldPos.x - state.movingTotemContext.lastPos.x;
            const dy = worldPos.y - state.movingTotemContext.lastPos.y;
            state.movingTotemContext.lastPos = worldPos;
            
            // Move totem
            const t = state.movingTotemContext.totem;
            if (t) { t.x += dx; t.y += dy; }
            
            // Move areas
            state.movingTotemContext.areas.forEach(a => {
                if (a.polygons) {
                    for (let p of a.polygons) for (let pt of p) { pt.x += dx; pt.y += dy; }
                } else if (a.points) {
                    for (let pt of a.points) { pt.x += dx; pt.y += dy; }
                }
            });
            
            // Move drawings
            state.movingTotemContext.drawings.forEach(d => {
                if (d.type === 'path') {
                    for(let pt of d.points) { pt.x += dx; pt.y += dy; }
                } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle' || d.type === 'book') {
                    d.start.x += dx; d.start.y += dy;
                    d.end.x += dx; d.end.y += dy;
                } else { d.x += dx; d.y += dy; }
            });
            
            // Move files
            state.movingTotemContext.files.forEach(f => {
                f.x += dx; f.y += dy;
                const el = document.getElementById(`file-${f.id}`);
                if (el) {
                    el.style.left = `${f.x}px`;
                    el.style.top = `${f.y}px`;
                }
            });
            
            // Move tables
            if (state.movingTotemContext.tables) {
                state.movingTotemContext.tables.forEach(t => {
                    t.x += dx; t.y += dy;
                });
            }
            
            // Move other totems
            if (state.movingTotemContext.totems) {
                state.movingTotemContext.totems.forEach(t => {
                    t.x += dx; t.y += dy;
                });
            }
            
            scheduleRender();
        } else if (state.resizingText) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const dx = worldPos.x - state.resizingText.startPointerX;
            const handle = state.resizingText.handle;
            const drawing = state.resizingText.drawing;
            
            if (handle.includes('e')) {
                drawing.width = Math.max(30, state.resizingText.startWidth + dx);
            } else if (handle.includes('w')) {
                const newWidth = Math.max(30, state.resizingText.startWidth - dx);
                if (newWidth > 30) {
                    drawing.x = state.resizingText.startX + dx;
                    drawing.width = newWidth;
                }
            }
            
            const inlineInput = document.querySelector('.inline-text-input');
            if (inlineInput) {
                inlineInput.style.width = `${drawing.width * state.camera.zoom}px`;
                if (handle.includes('w')) {
                    const screenPos = worldToScreen(drawing.x, drawing.y);
                    inlineInput.style.left = `${screenPos.x}px`;
                }
            }
            
            scheduleRender();
        } else if (state.draggingText) {
            const worldPos = screenToWorld(e.clientX, e.clientY);

            const dx = worldPos.x - state.dragStartWorld.x;
            const dy = worldPos.y - state.dragStartWorld.y;
            state.draggingText.x += dx;
            state.draggingText.y += dy;
            state.dragStartWorld = worldPos;
            scheduleRender();
        } else if (state.draggingTotem) {
            const worldPos = screenToWorld(e.clientX, e.clientY);

            const dx = worldPos.x - state.dragStartWorld.x;
            const dy = worldPos.y - state.dragStartWorld.y;
            state.draggingTotem.x += dx;
            state.draggingTotem.y += dy;
            state.dragStartWorld = worldPos;
            scheduleRender();
        } else if (state.draggingArea) {
            const worldPos = screenToWorld(e.clientX, e.clientY);

            const dx = worldPos.x - state.dragStartWorld.x;
            const dy = worldPos.y - state.dragStartWorld.y;
            
            if (!state.dragSetAreas || state.dragSetAreas.length === 0) state.dragSetAreas = [state.draggingArea];
            
            for (let targetArea of state.dragSetAreas) {
                if (targetArea.polygons) {
                    for (let p of targetArea.polygons) {
                        for (let pt of p) { pt.x += dx; pt.y += dy; }
                    }
                } else if (targetArea.points) {
                    for (let pt of targetArea.points) { pt.x += dx; pt.y += dy; }
                }
            }
            
            // Move files strictly assigned to any of the dragged areas
            for (let file of state.files) {
                if (file.isLocked) continue;
                if (state.dragSetAreas.some(a => a.id === file.areaId)) {
                    file.x += dx;
                    file.y += dy;
                    const el = document.getElementById(`file-${file.id}`);
                    if (el) {
                        el.style.left = `${file.x}px`;
                        el.style.top = `${file.y}px`;
                    }
                }
            }
            
            // Move internally scoped drawings recursively tracked during pointerdown
            if (state.dragSetDrawings) {
                for (let d of state.dragSetDrawings) {
                    if (d.type === 'text' || d.type === 'progress_bar' || d.type === 'clock' || d.type === 'calendar') {
                        d.x += dx; d.y += dy;
                    } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle' || d.type === 'book') {
                        d.start.x += dx; d.start.y += dy;
                        d.end.x += dx; d.end.y += dy;
                    } else if (d.type === 'path') {
                        for (let pt of d.points) { pt.x += dx; pt.y += dy; }
                    }
                }
            }
            
            state.dragStartWorld = worldPos;
            scheduleRender();
        } else if (smoothPen.isDrawing) {
            smoothPen.addPoint(e);
        } else if (state.isDrawing) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            state.shapeEndWorld = worldPos;
            scheduleRender();
        } else if (state.isDrawingTextBox) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            state.currentPolygon = {
                type: 'text-box',
                startX: state.textStart.x,
                startY: state.textStart.y,
                endX: worldPos.x,
                endY: worldPos.y
            };
            scheduleRender();
            return;
        } else if (state.selectedText && state.selectedText._resizeBox && state.mode === 'select') {
            // Idle hover: hint that the boundary is draggable before the user clicks it.
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const box = state.selectedText._resizeBox;
            const tol = 10 / state.camera.zoom;
            const withinY = worldPos.y >= box.y - tol && worldPos.y <= box.y + box.h + tol;
            const nearEdge = withinY && (Math.abs(worldPos.x - box.x) <= tol || Math.abs(worldPos.x - (box.x + box.w)) <= tol);
            workspace.style.cursor = nearEdge ? 'ew-resize' : '';
        }
    }

function handleWorkspacePointerUp(e) {
        if (handleTabletTouchUp(e)) return;
        if (state.isDrawingTextBox) {
            state.isDrawingTextBox = false;
            state.currentPolygon = null;
            workspace.releasePointerCapture(e.pointerId);
            const worldPos = screenToWorld(e.clientX, e.clientY);
            let width = Math.abs(worldPos.x - state.textStart.x);
            if (width < 30) width = 300;
            const startX = Math.min(state.textStart.x, worldPos.x);
            const startY = Math.min(state.textStart.y, worldPos.y);
            const screenStart = worldToScreen(startX, startY);
            const mockEvent = { clientX: screenStart.x, clientY: screenStart.y };
            openTextEditor(mockEvent, null, width);
            scheduleRender();
            return;
        }

        if (state.isPanning) {
            if (Math.hypot(state.camera.x - (state.cameraPanStartX || state.camera.x), state.camera.y - (state.cameraPanStartY || state.camera.y)) > 5) {
                lastPanEndTime = Date.now();
            }
            document.documentElement.style.cursor = '';
            workspace.style.cursor = 'grab';
            state.isPanning = false;
            workspace.releasePointerCapture(e.pointerId);
            saveCurrentFabric(); // the view is part of the saved canvas
        } else if (state.isDrawingLasso) {
            state.isDrawingLasso = false;
            // Calculate what is fully inside state.lassoPolygon
            // areas
            state.areas.forEach(a => {
                if (!a.isLocked && isItemVisibleInContainer(a) && isAreaFullyInsidePolygon(a, state.lassoPolygon)) state.lassoSelection.areas.add(a.id);
            });
            // drawings
            state.drawings.forEach(d => {
                if (!d.isLocked && isItemVisibleInContainer(d) && isDrawingFullyInsidePolygon(d, state.lassoPolygon)) state.lassoSelection.drawings.add(d.id);
            });
            // files
            state.files.forEach(f => {
                if (!f.isLocked && isItemVisibleInContainer(f) && isFileFullyInsidePolygon(f, state.lassoPolygon)) state.lassoSelection.files.add(f.id);
            });
            // totems
            state.totems.forEach(t => {
                if (!t.isLocked && isItemVisibleInContainer(t) && isTotemFullyInsidePolygon(t, state.lassoPolygon)) state.lassoSelection.totems.add(t.id);
            });
            workspace.releasePointerCapture(e.pointerId);
            scheduleRender();
        } else if (state.draggingLasso) {
            state.draggingLasso = false;
            workspace.style.cursor = 'grab';
            workspace.releasePointerCapture(e.pointerId);
            recalculateItemLinks();
            scheduleRender();
            saveCurrentFabric();
        } else if (state.resizingText) {
            state.resizingText = null;
            workspace.style.cursor = 'grab';
            workspace.releasePointerCapture(e.pointerId);
            scheduleRender();
            saveCurrentFabric();
        } else if (state.draggingText) {
            state.draggingText = null;
            workspace.style.cursor = 'grab';
            workspace.releasePointerCapture(e.pointerId);
            saveCurrentFabric();
        } else if (state.draggingTotem) {
            state.draggingTotem = null;
            workspace.style.cursor = 'grab';
            workspace.releasePointerCapture(e.pointerId);
            recalculateItemLinks(); // areas/files may now be spatially over/off the moved totem's old or new position
            saveCurrentFabric();
        } else if (state.draggingArea) {
            state.draggingArea = null;
            state.dragSetAreas = []; // Clear current nested linking memory
            state.dragSetDrawings = []; // Clear current annotation linking memory
            workspace.style.cursor = 'grab';
            workspace.releasePointerCapture(e.pointerId);
            recalculateItemLinks(); // Re-bind files that might have been scooped up or left behind
            saveCurrentFabric();
        } else if (smoothPen.isDrawing) {
            const pathPoints = smoothPen.end();
            workspace.releasePointerCapture(e.pointerId);
            if (pathPoints && pathPoints.length > 2) {
                state.drawings.push({
                    id: Date.now().toString(),
                    type: 'path',
                    color: state.areaColor,
                    points: pathPoints
                });
                recalculateItemLinks();
                scheduleRender();
                saveCurrentFabric();
            }
        } else if (state.isDrawing) {
            state.isDrawing = false;
            workspace.releasePointerCapture(e.pointerId);
            
            if (['rect', 'circle', 'book', 'draw-box'].includes(state.mode)) {
                const dist = Math.hypot(state.shapeStartWorld.x - state.shapeEndWorld.x, state.shapeStartWorld.y - state.shapeEndWorld.y);
                if (dist > 2 / state.camera.zoom) {
                    if (state.mode === 'draw-box') {
                        // Create 4 independent lines for a box (like drawing 4 lines manually)
                        const t = Date.now();
                        const p1 = {x: state.shapeStartWorld.x, y: state.shapeStartWorld.y};
                        const p2 = {x: state.shapeEndWorld.x, y: state.shapeStartWorld.y};
                        const p3 = {x: state.shapeEndWorld.x, y: state.shapeEndWorld.y};
                        const p4 = {x: state.shapeStartWorld.x, y: state.shapeEndWorld.y};
                        
                        state.drawings.push({ id: t + '-1', type: 'line', color: state.areaColor, start: p1, end: p2 });
                        state.drawings.push({ id: t + '-2', type: 'line', color: state.areaColor, start: p2, end: p3 });
                        state.drawings.push({ id: t + '-3', type: 'line', color: state.areaColor, start: p3, end: p4 });
                        state.drawings.push({ id: t + '-4', type: 'line', color: state.areaColor, start: p4, end: p1 });

                        state.currentPolygon = [];
                        scheduleRender();
                        saveCurrentFabric();
                        return; // Done
                    }

                    let newPolygon = [];
                    if (state.mode === 'rect' || state.mode === 'book') {
                        newPolygon = [
                            {x: state.shapeStartWorld.x, y: state.shapeStartWorld.y},
                            {x: state.shapeEndWorld.x, y: state.shapeStartWorld.y},
                            {x: state.shapeEndWorld.x, y: state.shapeEndWorld.y},
                            {x: state.shapeStartWorld.x, y: state.shapeEndWorld.y}
                        ];
                    } else if (state.mode === 'circle') {
                        const r = dist;
                        const steps = 64;
                        for (let i = 0; i < steps; i++) {
                            const theta = (Math.PI * 2 * i) / steps;
                            newPolygon.push({
                                x: state.shapeStartWorld.x + r * Math.cos(theta),
                                y: state.shapeStartWorld.y + r * Math.sin(theta)
                            });
                        }
                    }
                    
                    state.currentPolygon = newPolygon;
                    let activeArea = null;
                    if (state.mode !== 'book') {
                        for (let area of state.areas) {
                            if (area.color === state.areaColor && area.polygons && !area.isBook) {
                                for (let p of area.polygons) {
                                    if (doPolygonsOverlap(newPolygon, p)) {
                                        activeArea = area;
                                        break;
                                    }
                                }
                                if (activeArea) break;
                            }
                        }
                    }
                    
                    if (activeArea) {
                        activeArea.polygons.push(newPolygon);
                        const newFiles = getFilesInPolygon(newPolygon);
                        for (let fid of newFiles) {
                            if (!activeArea.containedFiles.includes(fid)) {
                                activeArea.containedFiles.push(fid);
                                const f = state.files.find(fi => fi.id === fid);
                                if (f) { f.areaId = activeArea.id; f.areaName = activeArea.name; }
                                const el = document.getElementById(`file-${fid}`);
                                if (el) {
                                    el.querySelector('.file-area').textContent = activeArea.name;
                                    el.querySelector('.file-area').classList.remove('unassigned');
                                }
                            }
                        }
                        if (typeof refreshFolderWidgets === 'function') refreshFolderWidgets(activeArea.id);
                        state.currentPolygon = [];
                        scheduleRender();
                        saveCurrentFabric();
                    } else {
                        if (state.mode === 'book') {
                            openNamePrompt('book');
                        } else {
                            openNamePrompt('area');
                        }
                    }
                } else {
                    state.currentPolygon = [];
                    scheduleRender();
                }
            } else {
                // Determine geometric shape validity for arrows and lines
                const dist = Math.hypot(state.shapeStartWorld.x - state.shapeEndWorld.x, state.shapeEndWorld.y - state.shapeEndWorld.y);
                if (dist > 2 / state.camera.zoom) {
                    // Check if this is a hole-to-hole link (line tool only)
                    if (state.mode === 'line' && state.linkDraftStart) {
                        const endHole = getNearestHole(state.shapeEndWorld, 40);
                        if (endHole && endHole.areaId !== state.linkDraftStart.areaId) {
                            // Create an area link instead of a plain line
                            const fromArea = state.areas.find(a => a.id === state.linkDraftStart.areaId);
                            state.links.push({
                                id: Date.now().toString(),
                                fromAreaId: state.linkDraftStart.areaId,
                                fromCorner: state.linkDraftStart.corner,
                                toAreaId: endHole.areaId,
                                toCorner: endHole.corner,
                                color: fromArea ? fromArea.color : state.areaColor
                            });
                            state.linkDraftStart = null;
                            saveCurrentFabric();
                            scheduleRender();
                            return;
                        }
                    }
                    // Fall back to regular drawing
                    state.drawings.push({
                        id: Date.now().toString(),
                        type: state.mode,
                        color: state.areaColor,
                        start: { ...state.shapeStartWorld },
                        end: { ...state.shapeEndWorld }
                    });
                    saveCurrentFabric();
                }
                state.linkDraftStart = null;
                scheduleRender();
            }
        }
    }


function getFilesInPolygon(polygon) {
    const filesInside = [];
    for (let file of state.files) {
        if (isPointInPolygon({x: file.x, y: file.y}, polygon)) {
            filesInside.push(file.id);
        }
    }
    return filesInside;
}

function getItemCenter(item, isDrawing = false) {
    if (!isDrawing) return { x: item.x, y: item.y };
    if (item.x !== undefined && item.y !== undefined) return { x: item.x, y: item.y };
    if (item.start && item.end) return { x: (item.start.x + item.end.x) / 2, y: (item.start.y + item.end.y) / 2 };
    if (item.points && item.points.length > 0) return { x: item.points[0].x, y: item.points[0].y };
    return { x: 0, y: 0 };
}

function recalculateItemLinks() {
    // Precompute every area's bounding box ONCE for this pass (stateless — computed fresh each
    // call, so there is no cache to invalidate). The nested loops below use these boxes to
    // cheaply reject the vast majority of candidates before running the expensive point-in-polygon
    // ray-casts, turning the practical cost of the O(areas²) / O(items×areas) scans way down.
    const areaBBoxes = new Map();
    for (const a of state.areas) areaBBoxes.set(a, getAreaBBox(a));

    // Process areas to assign parentAreaId
    for (let a of state.areas) {
        if (a.isLocked) continue;

        let hitAreas = [];
        const checkPts = [];
        if (a.polygons) {
            for (let p of a.polygons) checkPts.push(...p);
        } else if (a.points) {
            checkPts.push(...a.points);
        }

        if (checkPts.length > 0) {
            const aBB = areaBBoxes.get(a);
            for (let other of state.areas) {
                if (a.id === other.id) continue;
                if (other.type === 'dashboard_box') {
                    if (state.editingDashboardId !== other.id && a.parentAreaId !== other.id) {
                        continue;
                    }
                }
                // AABB reject: `a` can only be FULLY inside `other` if a's bbox ⊆ other's bbox.
                // a's bbox extremes are real checkpoints, so if any extreme lies outside other's
                // bbox that checkpoint is outside other's polygon → not fully inside. Safe skip.
                const oBB = areaBBoxes.get(other);
                if (aBB && oBB && (aBB.minX < oBB.minX || aBB.maxX > oBB.maxX ||
                                   aBB.minY < oBB.minY || aBB.maxY > oBB.maxY)) {
                    continue;
                }
                let allInside = true;
                for (let pt of checkPts) {
                    let ptInParent = false;
                    if (other.polygons) {
                        for (let p of other.polygons) {
                            if (isPointInPolygon(pt, p)) { ptInParent = true; break; }
                        }
                    } else if (other.points) {
                        if (isPointInPolygon(pt, other.points)) ptInParent = true;
                    }
                    if (!ptInParent) { allInside = false; break; }
                }
                if (allInside) hitAreas.push(other);
            }
            if (hitAreas.length > 0) {
                hitAreas.sort((x, y) => getAreaSize(x) - getAreaSize(y));
                const prevParentId = a.parentAreaId;
                const newParent = hitAreas[0];
                a.parentAreaId = newParent.id;
                
                if (newParent.isScrollBox) {
                    if (prevParentId !== newParent.id || !a.scrollBoxPageId) {
                        const currentPage = newParent.pages[newParent.currentPageIndex];
                        if (currentPage) a.scrollBoxPageId = currentPage.id;
                    }
                }
            } else {
                a.parentAreaId = null;
            }
        } else {
            a.parentAreaId = null;
        }
    }

    // Process files
    for (let file of state.files) {
        if (file.isLocked) continue;
        let assignedArea = findAssignedArea(getItemCenter(file, false), file, areaBBoxes);
        
        if (assignedArea && assignedArea.isBook) {
            if (file.areaId !== assignedArea.id || !file.bookTitleId) {
                file.bookTitleId = assignedArea.activeTitleId;
                file.bookPageId = assignedArea.activePageId;
            }
        }
        
        if (assignedArea && assignedArea.isScrollBox) {
            if (file.areaId !== assignedArea.id || !file.scrollBoxPageId) {
                file.scrollBoxPageId = assignedArea.pages[assignedArea.currentPageIndex].id;
            }
        }
        
        file.areaId = assignedArea ? assignedArea.id : null;
        file.areaName = assignedArea ? assignedArea.name : 'Unassigned';
        
        const fileEl = document.getElementById(`file-${file.id}`);
        if (fileEl) {
            const badge = fileEl.querySelector('.file-area');
            if (badge) {
                badge.textContent = file.areaName;
                if (!assignedArea) badge.classList.add('unassigned');
                else badge.classList.remove('unassigned');
            }
        }
    }
    
    // Process drawings
    for (let drawing of state.drawings) {
        if (drawing.isLocked) continue;
        let assignedArea = findAssignedArea(getItemCenter(drawing, true), drawing, areaBBoxes);
        
        if (assignedArea && assignedArea.isBook) {
            if (drawing.areaId !== assignedArea.id || !drawing.bookTitleId) {
                drawing.bookTitleId = assignedArea.activeTitleId;
                drawing.bookPageId = assignedArea.activePageId;
            }
        }
        
        if (assignedArea && assignedArea.isScrollBox) {
            if (drawing.areaId !== assignedArea.id || !drawing.scrollBoxPageId) {
                drawing.scrollBoxPageId = assignedArea.pages[assignedArea.currentPageIndex].id;
            }
        }
        
        drawing.areaId = assignedArea ? assignedArea.id : null;
    }
}

function findAssignedArea(point, currentItem = null, bboxMap = null) {
    let hitAreas = [];
    for (let area of state.areas) {
        if (area.type === 'dashboard_box') {
            if (state.editingDashboardId !== area.id && (!currentItem || currentItem.areaId !== area.id)) {
                continue;
            }
        }
        // AABB reject: a point outside the area's bounding box can't be inside its polygon.
        // Uses the caller's precomputed bbox map when available (recalculateItemLinks), else
        // computes one inline — either way replaces the per-polygon ray-cast with an O(1) test.
        const bb = bboxMap ? bboxMap.get(area) : getAreaBBox(area);
        if (bb && (point.x < bb.minX || point.x > bb.maxX || point.y < bb.minY || point.y > bb.maxY)) {
            continue;
        }
        let inArea = false;
        if (area.polygons) {
            for (let p of area.polygons) {
                if (isPointInPolygon(point, p)) { inArea = true; break; }
            }
        } else if (area.points) {
            if (isPointInPolygon(point, area.points)) inArea = true;
        }
        if (inArea) hitAreas.push(area);
    }
    if (hitAreas.length > 0) {
        hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
        return hitAreas[0];
    }
    return null;
}

function openNamePrompt(type = 'area') {
    if (document.querySelector('.area-name-input')) return;
    
    // Position input based on the center of the drawn shape (or just top-left)
    let minX = Infinity, minY = Infinity;
    if (state.currentPolygon && state.currentPolygon.length) {
        for(let pt of state.currentPolygon) {
            if(pt.x < minX) minX = pt.x;
            if(pt.y < minY) minY = pt.y;
        }
    }
    
    // Fallback to center screen if no bounds found
    let px = window.innerWidth / 2;
    let py = window.innerHeight / 2;
    
    if (minX !== Infinity) {
        px = window.innerWidth / 2 + state.camera.x + minX * state.camera.zoom;
        py = window.innerHeight / 2 + state.camera.y + minY * state.camera.zoom;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'area-name-input';
    const numExisting = type === 'book' ? state.areas.filter(a => a.isBook).length : state.areas.filter(a => !a.isBook).length;
    const defaultName = type === 'book' ? `Book ${numExisting + 1}` : `Area ${numExisting + 1}`;
    input.value = defaultName;
    
    input.style.position = 'absolute';
    input.style.left = `${px}px`;
    input.style.top = `${py}px`;
    input.style.zIndex = 2000;
    input.style.font = `600 16px Inter, sans-serif`;
    input.style.color = '#fff';
    input.style.background = 'rgba(0,0,0,0.8)';
    input.style.border = `1px solid ${state.areaColor}`;
    input.style.borderRadius = '6px';
    input.style.padding = '8px 12px';
    input.style.outline = 'none';
    input.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    input.style.transform = 'translate(-50%, -100%) translateY(-10px)';
    
    document.body.appendChild(input);
    input.select();
    
    const finalizeArea = () => {
        if (!input.parentNode) return;
        const name = input.value.trim() || defaultName;
        input.remove();
        const newId = Date.now().toString();
        const filesInside = getFilesInPolygon(state.currentPolygon);
        
        const newArea = {
            id: newId,
            name: name,
            color: state.areaColor,
            polygons: [[...state.currentPolygon]],
            containedFiles: filesInside,
            isBook: type === 'book'
        };
        
        if (newArea.isBook) {
            const defaultPageId = 'page_' + Date.now();
            const defaultTitleId = 'title_' + Date.now();
            newArea.titles = [{
                id: defaultTitleId,
                name: 'TITLE 1',
                pages: [defaultPageId]
            }];
            newArea.activeTitleId = defaultTitleId;
            newArea.activePageId = defaultPageId;
        }
        
        state.areas.push(newArea);
        
        // Ensure DOM container exists first if it's a shelf, so files can render into it
        
        
        for (const fileId of filesInside) {
            let fileData = state.files.find(f => f.id === fileId);
            if (!fileData) fileData = globalBookFiles.find(f => f.id === fileId);
            if (fileData) {
                fileData.areaId = newId;
                fileData.areaName = name;
                assignFileToStorage(fileData, newArea);
                renderFileItem(fileData); // re-renders and attaches correctly
            }
        }
        
        // Auto-populate existing global shelf items with this badge name
        if (newArea.isBook) {
            const matchingGlobals = globalBookFiles.filter(f => f.bookName === name && !filesInside.includes(f.id));
            for (const gf of matchingGlobals) {
                // HOT-Link the global file to the local physical shelf!
                gf.areaId = newArea.id;
                gf.areaName = newArea.name;
                renderFileItem(gf);
            }
        }

        state.currentPolygon = [];
        setMode('select');
        scheduleRender();
        saveCurrentFabric();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finalizeArea();
        if (e.key === 'Escape') {
            input.remove();
            state.currentPolygon = [];
            setMode('select');
            scheduleRender();
        }
    });

    // Finalize if they click absolutely anywhere else
    const blurHandler = (e) => {
        if (e.target !== input) {
            document.removeEventListener('pointerdown', blurHandler);
            finalizeArea();
        }
    };
    // Delay adding to prevent instant triggering from the pointerup that created it
    setTimeout(() => document.addEventListener('pointerdown', blurHandler), 50);
}

function setupDragAndDrop() {
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (window.isInternalDrag) return;
        dropOverlay.classList.add('active');
    });
    
    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // If it left the window boundary
        if (e.clientX === 0 || e.clientY === 0 || e.relatedTarget === null) {
            dropOverlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('active');
        
        const worldPos = screenToWorld(e.clientX, e.clientY);

    // Handle drop from Folder Sidebar
    const folderFileId = e.dataTransfer.getData('application/x-folder-file-id');
    if (folderFileId) {
        const sourceFile = state.files.find(f => f.id === folderFileId);
        if (sourceFile) {
            // Move the file OUT of the folder back onto the canvas
            moveFileOutOfFolder(sourceFile, worldPos);
            return;
        }
    }


        
        let dropCount = 0;
        if (e.dataTransfer.items) dropCount = e.dataTransfer.items.length;
        else if (e.dataTransfer.files) dropCount = e.dataTransfer.files.length;
        if (dropCount > 0) uploadProgress.start(dropCount);
        
        if (e.dataTransfer.items) {
            let offsetIdx = 0;
            const droppedItems = [];
            // Extract items synchronously first before the first await destroys the dataTransfer context in Chromium
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                const item = e.dataTransfer.items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    let handlePromise = null;
                    if (item.getAsFileSystemHandle) {
                        handlePromise = item.getAsFileSystemHandle();
                    }
                    if (file || handlePromise) {
                        droppedItems.push({ file, handlePromise });
                    }
                }
            }
            
            for (const { file, handlePromise } of droppedItems) {
                const offset = offsetIdx * (30 / state.camera.zoom);
                let handledAsFolder = false;
                try {
                    if (handlePromise) {
                        const handle = await handlePromise;
                        if (handle && handle.kind === 'directory') {
                            handledAsFolder = true;
                            await handleFolderDrop(handle, { x: worldPos.x + offset, y: worldPos.y + offset });
                        }
                    }
                } catch (err) {}
                
                if (!handledAsFolder && file) {
                    uploadProgress.update(file.name);
                    await handleFileDrop(file, { x: worldPos.x + offset, y: worldPos.y + offset }, e.clientX, e.clientY);
                }
                offsetIdx++;
            }
        } else if (e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            for (let index = 0; index < filesArray.length; index++) {
                const file = filesArray[index];
                uploadProgress.update(file.name);
                const offset = index * (30 / state.camera.zoom);
                await handleFileDrop(file, { x: worldPos.x + offset, y: worldPos.y + offset }, e.clientX, e.clientY);
            }
        }
        uploadProgress.finish();
    });
}

// Ray-casting algorithm to determine if point is inside a polygon
function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isAreaFullyInsidePolygon(area, lasso) {
    if (area.isNote && area.polygons) {
        // Crossing selection for notes: if any corner is inside, it's selected
        for (let p of area.polygons) {
            for (let pt of p) {
                if (isPointInPolygon(pt, lasso)) return true;
            }
        }
        return false;
    }

    if (area.polygons) {
        for (let p of area.polygons) {
            for (let pt of p) {
                if (!isPointInPolygon(pt, lasso)) return false;
            }
        }
        return true;
    } else if (area.points) {
        for (let pt of area.points) {
            if (!isPointInPolygon(pt, lasso)) return false;
        }
        return true;
    }
    return false;
}
function isDrawingFullyInsidePolygon(d, lasso) {
    if (d.type === 'path') {
        for (let pt of d.points) {
            if (!isPointInPolygon(pt, lasso)) return false;
        }
        return true;
    } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle' || d.type === 'book') {
        return isPointInPolygon(d.start, lasso) && isPointInPolygon(d.end, lasso);
    } else if (d.type === 'text') {
        const fSize = d.fontSize || 24;
        const lines = (d.text || '').split('\n');
        const fontStyle = d.isItalic ? 'italic ' : '';
        const fontWeight = d.isBold ? 'bold ' : '600 ';
        let h = 0;
        let w = 0;
        ctx.save();
        for(const line of lines) {
            const fs = typeof getLineFontSize === 'function' ? getLineFontSize(line, fSize) : fSize;
            ctx.font = `${fontStyle}${fontWeight}${fs}px ${d.fontFamily || 'Inter, sans-serif'}`;
            const mt = ctx.measureText(line.replace(/^#+\s/, ''));
            w = Math.max(w, mt.width);
            h += fs * 1.2;
        }
        ctx.restore();
        const pts = [
            {x: d.x, y: d.y}, {x: d.x+w, y: d.y}, {x: d.x+w, y: d.y+h}, {x: d.x, y: d.y+h},
            {x: d.x + w/2, y: d.y + h/2}
        ];
        for (let pt of pts) {
            if (isPointInPolygon(pt, lasso)) return true;
        }
        return false;
    } else {
        const w = d.width || 50; const h = d.height || 50;
        const pts = [
            {x: d.x, y: d.y}, {x: d.x+w, y: d.y}, {x: d.x+w, y: d.y+h}, {x: d.x, y: d.y+h}
        ];
        for (let pt of pts) if (!isPointInPolygon(pt, lasso)) return false;
        return true;
    }
}
function isFileFullyInsidePolygon(f, lasso) {
    const pts = [
        {x: f.x-10, y: f.y-10}, {x: f.x+10, y: f.y-10}, {x: f.x+10, y: f.y+10}, {x: f.x-10, y: f.y+10}
    ];
    for (let pt of pts) if (!isPointInPolygon(pt, lasso)) return false;
    return true;
}
function isTotemFullyInsidePolygon(t, lasso) {
    const pts = [
        {x: t.x-20, y: t.y-20}, {x: t.x+20, y: t.y-20}, {x: t.x+20, y: t.y+20}, {x: t.x-20, y: t.y+20}
    ];
    for (let pt of pts) if (!isPointInPolygon(pt, lasso)) return false;
    return true;
}

function doPolygonsOverlap(polyA, polyB) {
    if (polyA.length < 3 || polyB.length < 3) return false;
    
    let aInB = 0;
    for (const pt of polyA) if (isPointInPolygon(pt, polyB)) aInB++;
    
    let bInA = 0;
    for (const pt of polyB) if (isPointInPolygon(pt, polyA)) bInA++;
    
    // If one is COMPLETELY inside the other, DO NOT merge them! 
    // This allows nested hierarchy dragging for same-colored areas.
    if (aInB === polyA.length || bInA === polyB.length) return false;
    
    // Merge if partially overlapping (Venn diagram style)
    return aInB > 0 || bInA > 0;
}

function isImageFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

function isPdfFile(filename) {
    return filename.split('.').pop().toLowerCase() === 'pdf';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📄';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) return '🎥';
    if (['js', 'html', 'css', 'ts', 'jsx', 'tsx', 'py'].includes(ext)) return '💻';
    if (['doc', 'docx', 'txt', 'md'].includes(ext)) return '📝';
    return '📁';
}


async function handleFolderDrop(dirHandle, worldPos) {
    const w = 120;
    const h = 90;
    const newArea = {
        id: Date.now().toString() + Math.random().toString(36).substring(2,5),
        name: dirHandle.name,
        color: '#60a5fa',
        type: 'folder',
        isFolder: true,
        polygons: [[
            {x: worldPos.x, y: worldPos.y},
            {x: worldPos.x + w, y: worldPos.y},
            {x: worldPos.x + w, y: worldPos.y + h},
            {x: worldPos.x, y: worldPos.y + h}
        ]],
        containedFiles: []
    };
    state.areas.push(newArea);
    
    // Import files from the directory
    let totalFiles = 0;
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') totalFiles++;
    }
    uploadProgress.start(totalFiles);
    
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            try {
                const file = await entry.getFile();
                uploadProgress.update(file.name);
                // Assign explicitly to the newly created folder area
                const fileId = Date.now() + Math.random().toString(36).substr(2, 5);
                const fileData = {
                    id: fileId,
                    name: file.name,
                    isImage: isImageFile(file.name),
                    isPdf: isPdfFile(file.name),
                    imageDataUrl: null,
                    imageWidth: 200,
                    imageHeight: null,
                    pdfBlobUrl: null,
                    areaId: newArea.id,
                    areaName: newArea.name,
                    x: worldPos.x + 10,
                    y: worldPos.y + 10
                };
                
                if (fileData.isImage) {
                    if (currentSourcesHandle) {
                        await copyFileToFolder(file, fileData);
                        let sourceFileHandle = null;
                        try { sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name); } catch(e){}
                        if (sourceFileHandle) fileData.handle = sourceFileHandle;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                            let w = img.naturalWidth;
                            let h = img.naturalHeight;
                            const MAX_DIM = 4096;
                            if (w > MAX_DIM || h > MAX_DIM || ev.target.result.length > 2000000) {
                                const scale = Math.min(1, Math.min(MAX_DIM / w, MAX_DIM / h));
                                w = Math.round(w * scale);
                                h = Math.round(h * scale);
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = w;
                                tempCanvas.height = h;
                                const ctx = tempCanvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, w, h);
                                fileData.imageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
                            } else {
                                fileData.imageDataUrl = ev.target.result;
                            }
                            fileData.imageHeight = Math.round(fileData.imageWidth * (h/w));
                            assignFileToStorage(fileData, newArea);
                            renderFileItem(fileData);
                            saveCurrentFabric();
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                } else if (fileData.isPdf) {
                    if (currentSourcesHandle) {
                        await copyFileToFolder(file, fileData);
                        let sourceFileHandle = null;
                        try { sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name); } catch(e){}
                        if (sourceFileHandle) fileData.handle = sourceFileHandle;
                    }
                    fileData.pdfBlobUrl = URL.createObjectURL(file);
                    assignFileToStorage(fileData, newArea);
                    renderFileItem(fileData);
                    saveCurrentFabric();
                } else {
                    if (currentSourcesHandle) await copyFileToFolder(file, fileData);
                    assignFileToStorage(fileData, newArea);
                    renderFileItem(fileData);
                    saveCurrentFabric();
                }
            } catch(e) {
                console.warn("Failed to import file from folder:", entry.name, e);
            }
        }
    }
    
    saveCurrentFabric();
    scheduleRender();
    uploadProgress.finish();
}

async function handleFileDrop(file, worldPos) {
    let assignedArea = null;
    let hitAreas = [];
    for (let i = state.areas.length - 1; i >= 0; i--) {
        const area = state.areas[i];
        if (area.type === 'dashboard_box' || area.isScrollBox) {
            if (state.editingDashboardId !== area.id) {
                continue;
            }
        }
        let hit = false;
        if (area.polygons) {
            for (let p of area.polygons) {
                if (isPointInPolygon(worldPos, p)) { hit = true; break; }
            }
        } else if (area.points) {
            if (isPointInPolygon(worldPos, area.points)) hit = true;
        }
        
        if (hit) hitAreas.push(area);
    }
    
    if (hitAreas.length > 0) {
        hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
        assignedArea = hitAreas[0];
    }
    
    // Check if dropped into the edge sidebar
    if (arguments.length >= 4) {
        const clientX = arguments[2];
        const clientY = arguments[3];
        const sidebar = document.getElementById('edge-sidebar');
        if (sidebar && sidebar.classList.contains('active') && window.activeEdgeFolderId) {
            const rect = sidebar.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
                const activeFolder = state.areas.find(a => a.id === window.activeEdgeFolderId);
                if (activeFolder) assignedArea = activeFolder;
            }
        }
    }
    
    const fileId = Date.now() + Math.random().toString(36).substr(2, 5);
    const fileData = {
        id: fileId,
        name: file.name,
        isImage: isImageFile(file.name),
        isPdf: isPdfFile(file.name),
        imageDataUrl: null,
        imageWidth: 200,
        imageHeight: null,
        pdfBlobUrl: null,
        areaId: assignedArea ? assignedArea.id : null,
        areaName: assignedArea ? assignedArea.name : 'Unassigned',
        x: worldPos.x,
        y: worldPos.y
    };
    
    if (fileData.isImage) {
        if (currentSourcesHandle) {
            await copyFileToFolder(file, fileData);
            // Re-read file to ensure we use the stored version
            let sourceFileHandle;
            if (fileData.areaId) {
                const area = state.areas.find(a => a.id === fileData.areaId);
                /* Flat storage: removed area subdirectories */
            }
            if (!sourceFileHandle) {
                sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
            }
            file = await sourceFileHandle.getFile();
        }
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                
                const MAX_DIM = 4096;
                if (w > MAX_DIM || h > MAX_DIM || ev.target.result.length > 2000000) {
                    const scale = Math.min(1, Math.min(MAX_DIM / w, MAX_DIM / h));
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                    
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = w;
                    tempCanvas.height = h;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    fileData.imageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
                } else {
                    fileData.imageDataUrl = ev.target.result;
                }
                
                const aspect = h / w;
                fileData.imageHeight = Math.round(fileData.imageWidth * aspect);
                assignFileToStorage(fileData, assignedArea);
                renderFileItem(fileData);
                saveCurrentFabric();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    } else if (fileData.isPdf) {
        if (currentSourcesHandle) {
            await copyFileToFolder(file, fileData);
            let sourceFileHandle;
            if (fileData.areaId) {
                const area = state.areas.find(a => a.id === fileData.areaId);
                /* Flat storage: removed area subdirectories */
            }
            if (!sourceFileHandle) {
                sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
            }
            file = await sourceFileHandle.getFile();
        }
        fileData.pdfBlobUrl = URL.createObjectURL(file);
        assignFileToStorage(fileData, assignedArea);
        renderFileItem(fileData);
        saveCurrentFabric();
    } else if (file.name.toLowerCase().endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const w = 250, h = 250;
            const newArea = {
                id: fileId,
                name: 'Note',
                color: '#fff3c4',
                polygons: [[
                    {x: worldPos.x, y: worldPos.y},
                    {x: worldPos.x + w, y: worldPos.y},
                    {x: worldPos.x + w, y: worldPos.y + h},
                    {x: worldPos.x, y: worldPos.y + h}
                ]],
                containedFiles: [],
                isBook: false,
                isNote: true,
                textContent: ev.target.result
            };
            state.areas.push(newArea);
            scheduleRender();
            saveCurrentFabric();
        };
        reader.readAsText(file);
    } else {
        if (currentSourcesHandle) {
            await copyFileToFolder(file, fileData);
        }
        assignFileToStorage(fileData, assignedArea);
        renderFileItem(fileData);
        saveCurrentFabric();
    }
}

function renderFileItem(fileData) {
    if (fileData.isHidden) return;
    
    // Remove existing element if re-rendering
    const existing = document.getElementById(`file-${fileData.id}`);
    if (existing) existing.remove();
    

    
    const el = document.createElement('div');
    el.className = fileData.isImage && fileData.imageDataUrl ? 'file-item image-item' : 'file-item';
    el.id = `file-${fileData.id}`;
    
    el.style.left = `${fileData.x}px`;
    el.style.top = `${fileData.y}px`;
    
    const safeId = fileData.id.toString().replace(/[^a-z0-9]/gi, '');
    el.style.viewTransitionName = `card-${safeId}`;
    
    if (fileData.isPinnedPdfPage) {
        /* Pinned PDF Page Template */
        el.className = 'file-item pdf-pinned-item';
        el.style.width = `${fileData.imageWidth}px`;
        
        el.innerHTML = `
            <div class="file-options-btn">⋮</div>
            <div class="file-menu hidden">
                <div class="menu-item action-open">Open Source PDF</div>
                <div class="menu-item action-resize">Resize Page</div>
                <div class="menu-item action-unpin">Unpin Page</div>
                <div class="menu-item action-note">${fileData.note ? 'Edit Note' : 'Add Note'}</div>
                ${fileData.note ? `<div class="menu-item action-toggle-note">${fileData.showNote ? 'Hide Note' : 'Show Note'}</div>` : ''}
                <div class="menu-item action-lock">${fileData.isLocked ? 'Unlock' : 'Lock'}</div>
                <div class="menu-item action-copy">Copy</div>
                <div class="menu-item danger action-delete">Delete</div>
            </div>
            <div class="pinned-pdf-content" style="position: relative; background: white; border-top-left-radius: 8px; border-top-right-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 100%;">
                <img src="${fileData.imageDataUrl}" 
                     class="image-preview" 
                     alt="Page ${fileData.pageNum} of ${fileData.name}"
                     style="width: 100%; height: auto; display: block; object-fit: contain;"
                     draggable="false" />
                <div class="image-resize-handle"></div>
            </div>
            <div class="pinned-pdf-footer" style="background: #2b2b36; color: #e5e7eb; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-family: 'Inter', sans-serif; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; border-top: 1px solid #444;">
                <span style="font-weight: 800; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%; color: #fff;">${fileData.name}</span>
                <span style="font-weight: 600; font-size: 12px; background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 8px; color: #fff;">
                    Page ${fileData.pageNum} of ${fileData.totalPages}
                    <span style="font-size: 14px;">📌</span>
                </span>
            </div>
            ${(fileData.note && fileData.showNote) ? `<div class="file-note">${fileData.note}</div>` : ''}
            <div class="file-edit-container">
                <textarea class="file-note-textarea" placeholder="Type your notes here..."></textarea>
                <div class="file-full-details">
                    <div class="details-name">${fileData.name} (Page ${fileData.pageNum})</div>
                    <div class="details-type">PINNED PAGE</div>
                </div>
                <button class="file-save-btn">Save Note</button>
            </div>
        `;
        
        // Setup resize handle
        const resizeHandle = el.querySelector('.image-resize-handle');
        const imgEl = el.querySelector('.image-preview');
        let isResizing = false;
        let resizeStart = { x: 0, y: 0 };
        let startWidth = 0;
        let startHeight = 0;
        
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            isResizing = true;
            resizeStart = { x: e.clientX, y: e.clientY };
            startWidth = fileData.imageWidth;
            startHeight = fileData.imageHeight;
            resizeHandle.setPointerCapture(e.pointerId);
            document.body.style.cursor = 'nwse-resize';
        });
        
        resizeHandle.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            const dx = (e.clientX - resizeStart.x) / state.camera.zoom;
            const aspect = startHeight / startWidth;
            const newWidth = Math.max(150, startWidth + dx);
            const newHeight = Math.round(newWidth * aspect);
            fileData.imageWidth = newWidth;
            fileData.imageHeight = newHeight;
            el.style.width = `${newWidth}px`;
        });
        
        const stopResize = (e) => {
            if (!isResizing) return;
            isResizing = false;
            resizeHandle.releasePointerCapture(e.pointerId);
            document.body.style.cursor = '';
        };
        resizeHandle.addEventListener('pointerup', stopResize);
        resizeHandle.addEventListener('pointercancel', stopResize);

    } else if (fileData.isImage && fileData.imageDataUrl) {
        /* Image Preview Template */
        el.innerHTML = `
            <div class="file-options-btn">⋮</div>
            <div class="file-menu hidden">
                ${fileData.isPdf ? '<div class="menu-item action-open">Open</div>' : ''}
                <div class="menu-item action-note">${fileData.note ? 'Edit Note' : 'Add Note'}</div>
                ${fileData.note ? `<div class="menu-item action-toggle-note">${fileData.showNote ? 'Hide Note' : 'Show Note'}</div>` : ''}
                <div class="menu-item action-lock">${fileData.isLocked ? 'Unlock' : 'Lock'}</div>
                <div class="menu-item action-copy">Copy</div>
                <div class="menu-item danger action-delete">Delete</div>
            </div>
            <div class="image-preview-container">
                <img src="${fileData.imageDataUrl}" 
                     class="image-preview" 
                     alt="${fileData.name}"
                     style="width: ${fileData.imageWidth}px; height: ${fileData.imageHeight}px;"
                     draggable="false" />
                ${fileData.isYoutube ? `
                <div class="youtube-play-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; pointer-events:none;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="red"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
                ` : ''}
                <div class="image-resize-handle"></div>
            </div>
            <div class="image-label">
                <span class="file-name" title="${fileData.name}">${fileData.name}</span>
                <span class="file-area ${fileData.areaName === 'Unassigned' ? 'unassigned' : ''}">${fileData.areaName}</span>
            </div>
            ${(fileData.note && fileData.showNote) ? `<div class="file-note">${fileData.note}</div>` : ''}
            <div class="file-edit-container">
                <textarea class="file-note-textarea" placeholder="Type your notes here..."></textarea>
                <div class="file-full-details">
                    <div class="details-name">${fileData.name}</div>
                    <div class="details-type">${fileData.name.split('.').pop().toUpperCase()} IMAGE</div>
                </div>
                <button class="file-save-btn">Save Note</button>
            </div>
        `;
        
        // Setup resize handle
        const resizeHandle = el.querySelector('.image-resize-handle');
        const imgEl = el.querySelector('.image-preview');
        let isResizing = false;
        let resizeStart = { x: 0, y: 0 };
        let startWidth = 0;
        let startHeight = 0;
        
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            isResizing = true;
            resizeStart = { x: e.clientX, y: e.clientY };
            startWidth = fileData.imageWidth;
            startHeight = fileData.imageHeight;
            resizeHandle.setPointerCapture(e.pointerId);
            document.body.style.cursor = 'nwse-resize';
        });
        
        resizeHandle.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            const dx = (e.clientX - resizeStart.x) / state.camera.zoom;
            const aspect = startHeight / startWidth;
            const newWidth = Math.max(60, startWidth + dx);
            const newHeight = Math.round(newWidth * aspect);
            fileData.imageWidth = newWidth;
            fileData.imageHeight = newHeight;
            imgEl.style.width = `${newWidth}px`;
            imgEl.style.height = `${newHeight}px`;
        });
        
        const stopResize = (e) => {
            if (!isResizing) return;
            isResizing = false;
            resizeHandle.releasePointerCapture(e.pointerId);
            document.body.style.cursor = '';
        };
        resizeHandle.addEventListener('pointerup', stopResize);
        resizeHandle.addEventListener('pointercancel', stopResize);
        
    } else {
        const icon = getFileIcon(fileData.name);
        
        /* Standard File Card Template */
        el.innerHTML = `
            <div class="file-options-btn">⋮</div>
            <div class="file-menu hidden">
                ${fileData.isPdf ? '<div class="menu-item action-open">Open</div>' : ''}
                <div class="menu-item action-note">${fileData.note ? 'Edit Note' : 'Add Note'}</div>
                ${fileData.note ? `<div class="menu-item action-toggle-note">${fileData.showNote ? 'Hide Note' : 'Show Note'}</div>` : ''}
                <div class="menu-item action-lock">${fileData.isLocked ? 'Unlock' : 'Lock'}</div>
                <div class="menu-item action-copy">Copy</div>
                <div class="menu-item danger action-delete">Delete</div>
            </div>
            <div class="file-main-content">
                <div class="file-icon">${icon}</div>
                <div class="file-name" title="${fileData.name}">${fileData.name}</div>
                <div class="file-area ${fileData.areaName === 'Unassigned' ? 'unassigned' : ''}">
                    ${fileData.name && fileData.name.includes('.') ? '.' + fileData.name.split('.').pop().toLowerCase() : 'FILE'}
                </div>
            </div>
            ${(fileData.note && fileData.showNote) ? `<div class="file-note">${fileData.note}</div>` : ''}
            
            <div class="file-edit-container">
                <textarea class="file-note-textarea" placeholder="Type your notes here..."></textarea>
                <div class="file-full-details">
                    <div class="details-name">${fileData.name}</div>
                    <div class="details-type">${fileData.name.includes('.') ? '.' + fileData.name.split('.').pop().toLowerCase() : 'FILE'}</div>
                </div>
                <button class="file-save-btn">Save Note</button>
            </div>
        `;
    }
    
    const optionsBtn = el.querySelector('.file-options-btn');
    const menu = el.querySelector('.file-menu');
    
    optionsBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });
    
    const hideMenu = (e) => {
        if (!el.contains(e.target)) menu.classList.add('hidden');
    };
    document.addEventListener('pointerdown', hideMenu);

    // PDF Open handler
    const openBtn = el.querySelector('.action-open');
    if (openBtn) {
        openBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            if (fileData.isPinnedPdfPage) {
                const sourceFile = state.files.find(f => f.id === fileData.sourceFileId);
                if (sourceFile) openPdfPreview(sourceFile);
                else alert('Source PDF file no longer exists in the project.');
            } else {
                openPdfPreview(fileData);
            }
        });
    }

    const unpinBtn = el.querySelector('.action-unpin');
    if (unpinBtn) {
        unpinBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            fileData.isPinnedPdfPage = false;
            delete fileData.imageDataUrl;
            delete fileData.imageWidth;
            delete fileData.imageHeight;
            delete fileData.pageNum;
            delete fileData.totalPages;
            renderFileItem(fileData);
            saveCurrentFabric();
        });
    }

    const resizeBtn = el.querySelector('.action-resize');
    if (resizeBtn) {
        resizeBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            const newWidth = prompt('Enter new width in pixels:', fileData.imageWidth);
            if (newWidth && !isNaN(parseInt(newWidth))) {
                const aspect = fileData.imageHeight / fileData.imageWidth;
                fileData.imageWidth = parseInt(newWidth);
                fileData.imageHeight = Math.round(fileData.imageWidth * aspect);
                renderFileItem(fileData);
                saveCurrentFabric();
            }
        });
    }

    el.querySelector('.action-note').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        document.removeEventListener('pointerdown', hideMenu);
        
        const startEdit = () => {
            el.classList.add('is-editing');
            const textarea = el.querySelector('.file-note-textarea');
            textarea.value = fileData.note || '';
            textarea.focus();
        };

        if (document.startViewTransition) document.startViewTransition(startEdit);
        else startEdit();
    });
    
    el.querySelector('.file-save-btn').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        
        const endEdit = () => {
            fileData.note = el.querySelector('.file-note-textarea').value.trim();
            fileData.showNote = fileData.note !== '';
            el.remove();
            saveGlobalShelves();
            renderFileItem(fileData);
        };

        if (document.startViewTransition) document.startViewTransition(endEdit);
        else endEdit();
    });

    const toggleBtn = el.querySelector('.action-toggle-note');
    if (toggleBtn) {
        toggleBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            const toggleAction = () => {
                fileData.showNote = !fileData.showNote;
                document.removeEventListener('pointerdown', hideMenu);
                el.remove();
                saveGlobalShelves();
                renderFileItem(fileData);
            };
            if (document.startViewTransition) document.startViewTransition(toggleAction);
            else toggleAction();
        });
    }

    const lockBtn = el.querySelector('.action-lock');
    if (lockBtn) {
        lockBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            document.removeEventListener('pointerdown', hideMenu);
            fileData.isLocked = !fileData.isLocked;
            saveCurrentFabric();
            saveGlobalShelves();
            renderFileItem(fileData);
        });
    }

    el.querySelector('.action-copy').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        const newFileData = { ...fileData, id: Date.now().toString(), x: fileData.x + 40, y: fileData.y + 40 };
        const assignedArea = state.areas.find(a => a.id === fileData.areaId);
        assignFileToStorage(newFileData, assignedArea);
        renderFileItem(newFileData);
        saveCurrentFabric();
    });

    el.querySelector('.action-delete').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        document.removeEventListener('pointerdown', hideMenu);
        state.files = state.files.filter(f => f.id !== fileData.id);
        globalBookFiles = globalBookFiles.filter(f => f.id !== fileData.id);
        saveGlobalShelves();
        el.remove();
        saveCurrentFabric();
    });

    menu.addEventListener('pointerdown', (e) => e.stopPropagation());
    
    // Prevent dragging when typing
    el.querySelector('.file-note-textarea').addEventListener('pointerdown', (e) => e.stopPropagation());

    // Allow dragging existing files around on the workspace
    let isDraggingFile = false;
    let dragStart = { x: 0, y: 0 };
    
    el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // prevent panning
        if (el.classList.contains('is-editing')) return; // do not drag if editing
        if (fileData.isLocked) return; // do not drag if locked
        
        isDraggingFile = true;
        
        // If it was inside a shelf, pop it out to the workspace layer so it moves spatially
        if (fileData.areaId) {
            const parentArea = state.areas.find(a => a.id === fileData.areaId);
            if (parentArea && parentArea.isBook) {
                filesLayer.appendChild(el);
                const wp = screenToWorld(e.clientX, e.clientY);
                fileData.x = wp.x - 20 / state.camera.zoom;
                fileData.y = wp.y - 20 / state.camera.zoom;
                el.style.left = `${fileData.x}px`;
                el.style.top = `${fileData.y}px`;
            }
        }
        dragStart = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
        el.style.zIndex = 10001;
        el.style.transition = 'none';
        el.style.willChange = 'transform, left, top';
    });
    
    el.addEventListener('pointermove', (e) => {
        if (!isDraggingFile) return;
        const dx = (e.clientX - dragStart.x) / state.camera.zoom;
        const dy = (e.clientY - dragStart.y) / state.camera.zoom;
        
        fileData.x += dx;
        fileData.y += dy;
        el.style.left = `${fileData.x}px`;
        el.style.top = `${fileData.y}px`;
        
        dragStart = { x: e.clientX, y: e.clientY };
    });
    
    const releaseFile = (e) => {
        if (!isDraggingFile) return;
        isDraggingFile = false;
        el.releasePointerCapture(e.pointerId);
        el.style.zIndex = '';
        el.style.transition = '';
        el.style.willChange = '';
        
        let assignedArea = null;
        let hitAreas = [];
        
        // 1. Check if dropped directly onto the active edge sidebar
        const sidebar = document.getElementById('edge-sidebar');
        if (sidebar && sidebar.classList.contains('active') && window.activeEdgeFolderId) {
            const rect = sidebar.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const activeFolder = state.areas.find(a => a.id === window.activeEdgeFolderId);
                if (activeFolder) {
                    assignedArea = activeFolder;
                }
            }
        }
        
        // Use the pointer's location for accurate canvas drop targeting
        const wp = screenToWorld(e.clientX, e.clientY);
        
        // 2. Only check canvas areas if not dropped onto the sidebar
        if (!assignedArea) {
            for (let i = state.areas.length - 1; i >= 0; i--) {
            let hit = false;
            if (state.areas[i].polygons) {
                for (let p of state.areas[i].polygons) {
                    if (isPointInPolygon(wp, p)) { hit = true; break; }
                }
            } else if (state.areas[i].points) {
                if (isPointInPolygon(wp, state.areas[i].points)) hit = true;
            }
            if (hit) hitAreas.push(state.areas[i]);
        }
        
        if (hitAreas.length > 0) {
            // Prioritize smallest area first (most nested)
            hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
            assignedArea = hitAreas[0];
        }
        } // End if (!assignedArea)
        
        const willBeInShelf = assignedArea && assignedArea.isBook;
        
        fileData.areaId = assignedArea ? assignedArea.id : null;
        fileData.areaName = assignedArea ? assignedArea.name : 'Unassigned';
        
        // Handle Global routing
        assignFileToStorage(fileData, assignedArea);
        
        const areaBadge = el.querySelector('.file-area');
        areaBadge.textContent = fileData.areaName;
        if (fileData.areaName === 'Unassigned') {
            areaBadge.classList.add('unassigned');
        } else {
            areaBadge.classList.remove('unassigned');
        }
        
        if (willBeInShelf) {
            const shelfEl = document.getElementById(`shelf-${fileData.areaId}`);
            if (shelfEl) shelfEl.appendChild(el);
        } else {
            if (el.parentNode !== filesLayer) filesLayer.appendChild(el);
            el.style.left = `${fileData.x}px`;
            el.style.top = `${fileData.y}px`;
        }
        saveCurrentFabric();
    };
    
    el.addEventListener('pointerup', releaseFile);
    el.addEventListener('pointercancel', releaseFile);
    
    // PDF double-click preview
    


    if (fileData.isPdf && !fileData.isPinnedPdfPage) {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            openPdfPreview(fileData);
        });
        el.style.cursor = 'pointer';
        el.title = 'Double-click to preview';
    }
    
    // Pinned PDF double-click preview
    if (fileData.isPinnedPdfPage) {
        const previewImg = el.querySelector('.image-preview');
        if (previewImg) {
            previewImg.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const sourceFile = state.files.find(f => f.id === fileData.sourceFileId);
                if (sourceFile) openPdfPreview(sourceFile);
            });
            previewImg.style.cursor = 'pointer';
            previewImg.title = 'Double-click to open PDF';
        }
    }
    
    // YouTube double-click open
    if (fileData.isYoutube && fileData.youtubeUrl) {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            window.open(fileData.youtubeUrl, '_blank');
        });
        el.style.cursor = 'pointer';
        el.title = 'Double-click to open video';
    }
    
    // Generic file fallback double-click (for docx, pptx, etc)
    if (!fileData.isPdf && !fileData.isPinnedPdfPage && !fileData.isYoutube && !fileData.isNote) {
        el.addEventListener('dblclick', async (e) => {
            e.stopPropagation();
            if (!currentSourcesHandle) {
                alert("Workspace not fully loaded. Try restoring the workspace access.");
                return;
            }
            try {
                let sourceFileHandle = null;
                if (fileData.areaId) {
                    const area = state.areas.find(a => a.id === fileData.areaId);
                    /* Flat storage: removed area subdirectories */
                }
                if (!sourceFileHandle) {
                    sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
                }
                
                const file = await sourceFileHandle.getFile();
                
                const lowerName = file.name.toLowerCase();
                if (lowerName.endsWith('.docx')) {
                    if (typeof openDocxPreview === 'function') openDocxPreview(fileData);
                } else if (['.py', '.ipynb', '.js', '.json', '.html', '.css', '.md', '.csv'].some(ext => lowerName.endsWith(ext))) {
                    if (typeof openCodePreview === 'function') openCodePreview(fileData);
                } else {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            } catch (err) {
                console.error("Failed to open file", err);
                alert("Could not read file from disk. You may need to re-open the workspace.");
            }
        });
        el.style.cursor = 'pointer';
        el.title = 'Double-click to open';
    }
    
    // Legacy text file handling removed (now handled as Note Areas)
    let parentLayer = filesLayer;
    let targetArea = null;
    if (fileData.areaId) targetArea = state.areas.find(a => a.id === fileData.areaId);
    
    if (targetArea && targetArea.isBook) {
        let shelfEl = document.getElementById(`shelf-${fileData.areaId}`);
        if (!shelfEl) {
            // Force sync just in case it missed the render loop
            
            shelfEl = document.getElementById(`shelf-${fileData.areaId}`);
        }
        if (shelfEl) {
            parentLayer = shelfEl;
            console.log("Appending file", fileData.id, "to shelf", shelfEl.id);
        } else {
            console.warn("Shelf element not found even after sync:", fileData.areaId);
        }
    } else {
        console.log("Appending file", fileData.id, "to root filesLayer. Area isBook?", targetArea?.isBook);
    }
    
    parentLayer.appendChild(el);
}

function openPdfPreview(fileData) {
    // Remove any existing preview modal
    const existingModal = document.getElementById('pdf-preview-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'pdf-preview-modal';
    modal.className = 'pdf-modal-overlay';
    
    modal.innerHTML = `
        <div class="pdf-modal">
            <div class="pdf-modal-header">
                <div class="pdf-modal-title">
                    <span class="pdf-modal-icon">📄</span>
                    <span class="pdf-modal-filename">${fileData.name}</span>
                </div>
                <div class="pdf-modal-controls">
                    <button class="pdf-nav-btn" id="pdf-prev-page" title="Previous Page">‹</button>
                    <span class="pdf-page-info">
                        <input type="number" id="pdf-page-input" class="pdf-page-input" min="1" value="1" />
                        <span>/ <span id="pdf-total-pages">–</span></span>
                    </span>
                    <button class="pdf-nav-btn" id="pdf-next-page" title="Next Page">›</button>
                    <div class="pdf-controls-sep"></div>
                    <button class="pdf-action-btn" id="pdf-zoom-out" title="Zoom Out">−</button>
                    <span id="pdf-zoom-level" class="pdf-zoom-label">100%</span>
                    <button class="pdf-action-btn" id="pdf-zoom-in" title="Zoom In">+</button>
                    <div class="pdf-controls-sep"></div>
                    <button class="pdf-action-btn" id="pdf-pin" title="Pin Page to Canvas">📌 Pin</button>
                    <button class="pdf-action-btn pdf-download-btn" id="pdf-download" title="Download PDF">⬇ Download</button>
                    <button class="pdf-action-btn pdf-close-btn" id="pdf-close" title="Close">✕</button>
                </div>
            </div>
            <div class="pdf-modal-body" id="pdf-modal-body">
                <div class="pdf-loading">Loading PDF…</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Apply critical styles inline to bypass any stale CSS cache
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0',
        transition: 'opacity 0.2s ease'
    });
    
    const modalBox = modal.querySelector('.pdf-modal');
    if (modalBox) {
        Object.assign(modalBox.style, {
            width: '80vw',
            maxWidth: '900px',
            height: '85vh',
            background: 'rgba(24, 24, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
            transform: 'scale(0.95) translateY(10px)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        });
    }
    
    // Animate in
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        if (modalBox) modalBox.style.transform = 'scale(1) translateY(0)';
    });
    
    const body = modal.querySelector('#pdf-modal-body');
    const prevBtn = modal.querySelector('#pdf-prev-page');
    const nextBtn = modal.querySelector('#pdf-next-page');
    const pageInput = modal.querySelector('#pdf-page-input');
    const totalPagesEl = modal.querySelector('#pdf-total-pages');
    const zoomInBtn = modal.querySelector('#pdf-zoom-in');
    const zoomOutBtn = modal.querySelector('#pdf-zoom-out');
    const zoomLabel = modal.querySelector('#pdf-zoom-level');
    const pinBtn = modal.querySelector('#pdf-pin');
    const downloadBtn = modal.querySelector('#pdf-download');
    const closeBtn = modal.querySelector('#pdf-close');
    
    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let zoomScale = 1.5;
    
    // Load PDF.js from CDN if not already loaded
    const loadPdfJs = () => {
        return new Promise((resolve) => {
            if (window.pdfjsLib) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            document.head.appendChild(script);
        });
    };
    
    const renderPage = async (pageNum) => {
        if (!pdfDoc) return;
        currentPage = Math.max(1, Math.min(pageNum, totalPages));
        pageInput.value = currentPage;
        
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoomScale });
        
        // Clear body and create canvas
        body.innerHTML = '';
        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'pdf-pages-container';
        body.appendChild(pagesContainer);
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        pagesContainer.appendChild(canvas);
        
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    };
    
    const init = async () => {
        await loadPdfJs();
        try {
            if (!fileData.pdfBlobUrl && currentSourcesHandle && fileData.name) {
                const fileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
                const file = await fileHandle.getFile();
                fileData.pdfBlobUrl = URL.createObjectURL(file);
            }
            if (!fileData.pdfBlobUrl) {
                throw new Error("PDF file is not available in memory and folder access is missing. Please re-drag the file or Set Folder.");
            }
            pdfDoc = await window.pdfjsLib.getDocument(fileData.pdfBlobUrl).promise;
            totalPages = pdfDoc.numPages;
            totalPagesEl.textContent = totalPages;
            pageInput.max = totalPages;
            await renderPage(1);
        } catch (err) {
            body.innerHTML = `<div class="pdf-loading" style="color:#ef4444;">Failed to load PDF: ${err.message}</div>`;
        }
    };
    
    prevBtn.addEventListener('click', () => renderPage(currentPage - 1));
    nextBtn.addEventListener('click', () => renderPage(currentPage + 1));
    
    pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = parseInt(pageInput.value);
            if (!isNaN(target)) renderPage(target);
        }
    });
    pageInput.addEventListener('change', () => {
        const target = parseInt(pageInput.value);
        if (!isNaN(target)) renderPage(target);
    });
    
    zoomInBtn.addEventListener('click', () => {
        zoomScale = Math.min(zoomScale + 0.25, 4);
        zoomLabel.textContent = Math.round(zoomScale / 1.5 * 100) + '%';
        renderPage(currentPage);
    });
    zoomOutBtn.addEventListener('click', () => {
        zoomScale = Math.max(zoomScale - 0.25, 0.5);
        zoomLabel.textContent = Math.round(zoomScale / 1.5 * 100) + '%';
        renderPage(currentPage);
    });
    
    downloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = fileData.pdfBlobUrl;
        a.download = fileData.name;
        a.click();
    });
    
    pinBtn.addEventListener('click', () => {
        const canvas = modal.querySelector('.pdf-page-canvas');
        if (!canvas) return;
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const aspect = canvas.height / canvas.width;
        
        const defaultWidth = 400;
        
        fileData.isPinnedPdfPage = true;
        fileData.sourceFileId = fileData.id;
        fileData.pageNum = currentPage;
        fileData.totalPages = totalPages;
        fileData.imageDataUrl = imageDataUrl;
        fileData.imageWidth = defaultWidth;
        fileData.imageHeight = Math.round(defaultWidth * aspect);
        
        renderFileItem(fileData);
        saveCurrentFabric();
        
        // Provide visual feedback
        const originalText = pinBtn.innerHTML;
        pinBtn.innerHTML = '✓ Pinned';
        setTimeout(() => {
            if (document.body.contains(pinBtn)) {
                pinBtn.innerHTML = originalText;
            }
        }, 1500);
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        }
    });
    
    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Prevent pointer events from leaking to the canvas
    modal.addEventListener('pointerdown', (e) => e.stopPropagation());
    
    init();
}

// ===== PROGRESS BAR CONTEXT MENU =====
function dismissProgressBarContextMenu() {
    const existing = document.getElementById('pb-context-menu');
    if (existing) existing.remove();
}

function showClockContextMenu(screenX, screenY, clockDrawing) {
    dismissTextContextMenu();
    dismissAreaContextMenu();
    dismissProgressBarContextMenu();
    if (typeof dismissClockContextMenu === 'function') dismissClockContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'clock-context-menu';
    menu.className = 'area-ctx-menu';
    
    menu.innerHTML = `
        <div class="area-ctx-header" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Clock</div>
        <div class="area-ctx-item" data-action="resize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            Resize
        </div>
        <div class="area-ctx-item" data-action="color">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Change Text Color
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="lock">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${clockDrawing.isLocked ? 'Unlock Clock' : 'Lock Clock'}
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Clock
        </div>
    `;
    
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        zIndex: '9000'
    });
    
    document.body.appendChild(menu);
    
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${screenX - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${screenY - rect.height}px`;
    });
    
    menu.querySelector('[data-action="resize"]').addEventListener('click', () => {
        dismissClockContextMenu();
        const newSize = prompt("Enter new size (width, height):", `${clockDrawing.width}, ${clockDrawing.height}`);
        if (newSize) {
            const parts = newSize.split(',');
            if (parts.length > 0 && !isNaN(parseInt(parts[0]))) clockDrawing.width = parseInt(parts[0].trim());
            if (parts.length > 1 && !isNaN(parseInt(parts[1]))) clockDrawing.height = parseInt(parts[1].trim());
            scheduleRender();
        }
    });

    menu.querySelector('[data-action="color"]').addEventListener('click', (e) => {
        dismissClockContextMenu();
        state.selectedClock = clockDrawing;
        activeColorTarget = 'clock';
        palettePopup.style.left = `${e.clientX}px`;
        palettePopup.style.top = `${e.clientY + 10}px`;
        palettePopup.classList.add('active');
    });

    menu.querySelector('[data-action="lock"]').addEventListener('click', () => {
        dismissClockContextMenu();
        clockDrawing.isLocked = !clockDrawing.isLocked;
        saveCurrentFabric();
        scheduleRender();
    });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissClockContextMenu();
        state.drawings = state.drawings.filter(d => d.id !== clockDrawing.id);
        scheduleRender();
        saveCurrentFabric();
    });
    
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissClockContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('pointerdown', dismissHandler);
    }, 0);
}

function dismissClockContextMenu() {
    const existing = document.getElementById('clock-context-menu');
    if (existing) existing.remove();
}

function showProgressBarContextMenu(screenX, screenY, pbDrawing) {
    dismissTextContextMenu();
    dismissAreaContextMenu();
    dismissProgressBarContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'pb-context-menu';
    menu.className = 'area-ctx-menu';
    
    const { linkedNotes } = getLinkedNotesForProgressBar(pbDrawing);
    let linkedNoteHTML = '';
    if (linkedNotes.length > 0) {
        let options = linkedNotes.map(n => `<option value="${n.id}" ${pbDrawing.targetNoteId === n.id ? 'selected' : ''}>${n.name || 'Task'}</option>`).join('');
        linkedNoteHTML = `
            <div class="area-ctx-sep"></div>
            <div style="padding: 4px 12px; font-size: 11px; color: #888; text-transform: uppercase;">Linked Note</div>
            <div class="area-ctx-item" style="padding-top: 0; padding-bottom: 8px; hover: none;">
                <select id="pb-linked-note-select" style="width: 100%; background: #1a1a1a; color: white; border: 1px solid #333; border-radius: 4px; padding: 4px; font-size: 12px; cursor: pointer;" onclick="event.stopPropagation()">
                    <option value="">Auto-match by position</option>
                    ${options}
                </select>
            </div>
        `;
    }

    menu.innerHTML = `
        <div class="area-ctx-header" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Progress Bar</div>
        <div class="area-ctx-item" data-action="resize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            Resize
        </div>
        ${linkedNoteHTML}
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="lock">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${pbDrawing.isLocked ? 'Unlock Progress Bar' : 'Lock Progress Bar'}
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Progress Bar
        </div>
    `;
    
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        zIndex: '9000'
    });
    
    document.body.appendChild(menu);
    
    // Adjust if going off-screen
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${screenX - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${screenY - rect.height}px`;
    });
    
    // Resize handler
    menu.querySelector('[data-action="resize"]').addEventListener('click', () => {
        dismissProgressBarContextMenu();
        const newWidth = prompt("Enter new width:", pbDrawing.width);
        if (newWidth && !isNaN(parseInt(newWidth))) {
            pbDrawing.width = parseInt(newWidth);
            scheduleRender();
        }
    });
    
    // Linked note handler
    const selectEl = menu.querySelector('#pb-linked-note-select');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            pbDrawing.targetNoteId = e.target.value || null;
            scheduleRender();
        });
    }
    
    menu.querySelector('[data-action="lock"]').addEventListener('click', () => {
        dismissProgressBarContextMenu();
        pbDrawing.isLocked = !pbDrawing.isLocked;
        saveCurrentFabric();
        scheduleRender();
    });

    // Delete handler
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissProgressBarContextMenu();
        state.drawings = state.drawings.filter(d => d.id !== pbDrawing.id);
        scheduleRender();
        saveCurrentFabric();
    });
    
    // Dismiss on click outside
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissProgressBarContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismissHandler), 0);
}

// ===== TEXT CONTEXT MENU =====
function dismissTextContextMenu() {
    const existing = document.getElementById('text-context-menu');
    if (existing) existing.remove();
}

function showTextContextMenu(screenX, screenY, textDrawing) {
    dismissTextContextMenu();
    dismissAreaContextMenu();
    dismissProgressBarContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'text-context-menu';
    menu.className = 'area-ctx-menu';
    
    // Preview the text (truncated)
    const preview = textDrawing.text.replace(/^#+\s/gm, '').split('\n')[0];
    const truncated = preview.length > 20 ? preview.substring(0, 20) + '…' : preview;
    
    menu.innerHTML = `
        <div class="area-ctx-header" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${truncated}</div>
        <div class="area-ctx-item" data-action="edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Text
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="resize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Resize Text Box
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="lock">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${textDrawing.isLocked ? 'Unlock Text' : 'Lock Text'}
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Text
        </div>
    `;
    
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        zIndex: '9000'
    });
    
    document.body.appendChild(menu);
    
    // Adjust if going off-screen
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${screenX - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${screenY - rect.height}px`;
    });
    
    // Edit handler — open inline editor at the text's screen position
    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        dismissTextContextMenu();
        const screenPos = worldToScreen(textDrawing.x, textDrawing.y);
        // Create a synthetic event-like object for openTextEditor
        openTextEditor({ clientX: screenPos.x, clientY: screenPos.y }, textDrawing);
    });

    menu.querySelector('[data-action="resize"]').addEventListener('click', () => {
        dismissTextContextMenu();
        const currentWidth = textDrawing.width || textDrawing._calculatedWidth || 300;
        const newWidth = prompt("Enter new text box width (in pixels):", currentWidth);
        if (newWidth && !isNaN(parseInt(newWidth))) {
            textDrawing.width = parseInt(newWidth);
            saveCurrentFabric();
            scheduleRender();
        }
    });

    menu.querySelector('[data-action="lock"]').addEventListener('click', () => {
        dismissTextContextMenu();
        textDrawing.isLocked = !textDrawing.isLocked;
        saveCurrentFabric();
        scheduleRender();
    });
    
    // Delete handler
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissTextContextMenu();
        state.drawings = state.drawings.filter(d => d.id !== textDrawing.id);
        if (state.selectedText && state.selectedText.id === textDrawing.id) {
            state.selectedText = null;
            hidePropertiesPanel();
        }
        scheduleRender();
        saveCurrentFabric();
    });
    
    // Dismiss on click outside
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissTextContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismissHandler), 0);
}

// ===== AREA CONTEXT MENU =====
function dismissAreaContextMenu() {
    const existing = document.getElementById('area-context-menu');
    if (existing) existing.remove();
}

function showAreaContextMenu(screenX, screenY, area) {
    dismissAreaContextMenu();
    dismissTextContextMenu();
    dismissProgressBarContextMenu();
    if(typeof dismissTotemContextMenu !== 'undefined') dismissTotemContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'area-context-menu';
    menu.className = 'area-ctx-menu';
    
    menu.innerHTML = `
        <div class="area-ctx-header">${area.name}</div>
        ${(area.type === 'dashboard_box' || area.isScrollBox) ? `
        <div class="area-ctx-item" data-action="edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Edit
        </div>
        <div class="area-ctx-sep"></div>` : ''}
        <div class="area-ctx-item" data-action="rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
        </div>
        ${area.isFolder ? '' : `
        <div class="area-ctx-item" data-action="resize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Resize
        </div>
        `}
        ${area.isScrollBox ? `
        <div class="area-ctx-item" data-action="toggle-layout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4"/><path d="M21 19v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4"/><path d="M12 9v6"/></svg>
            Toggle Orientation
        </div>` : ''}
        ${(area.isDashboard || area.type === 'dashboard_box') ? '' : `
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item-nover" style="padding: 8px 16px; cursor: default;">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Color</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; width: 150px;">
                ${PRESET_COLORS.filter(c => c !== 'transparent').map(c => 
                    `<div class="area-ctx-color-btn" data-color="${c}" style="width: 20px; height: 20px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid ${area.color === c ? '#fff' : 'transparent'}; box-shadow: 0 0 0 1px ${area.color === c ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; transition: transform 0.1s;"></div>`
                ).join('')}
            </div>
        </div>
        `}
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="lock">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${area.isLocked ? 'Unlock Area' : 'Lock Area'}
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
        </div>
    `;
    
    // Position with boundary checks
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        zIndex: '9000'
    });
    
    document.body.appendChild(menu);
    
    // Adjust if going off-screen
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${screenX - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${screenY - rect.height}px`;
    });
    
    // Action handlers
    if (area.type === 'dashboard_box' || area.isScrollBox) {
        const editBtn = menu.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                dismissAreaContextMenu();
                enterDashboardEditMode(area);
            });
        }
    }

    menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
        dismissAreaContextMenu();
        startAreaRename(area);
    });
    
    const resizeBtn = menu.querySelector('[data-action="resize"]');
    if (resizeBtn) {
        resizeBtn.addEventListener('click', () => {
            dismissAreaContextMenu();
            startAreaResize(area);
        });
    }
    
    if (area.isScrollBox) {
        menu.querySelector('[data-action="toggle-layout"]').addEventListener('click', () => {
            dismissAreaContextMenu();
            area.layout = area.layout === 'vertical' ? 'horizontal' : 'vertical';
            saveCurrentFabric();
            syncScrollBoxes();
            scheduleRender();
        });
    }
    
    menu.querySelector('[data-action="lock"]').addEventListener('click', () => {
        dismissAreaContextMenu();
        area.isLocked = !area.isLocked;
        saveCurrentFabric();
        scheduleRender();
    });
    
    menu.querySelectorAll('.area-ctx-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newColor = e.target.getAttribute('data-color');
            area.color = newColor;
            state.areaColor = newColor;
            document.getElementById('indicator-area').style.background = newColor;
            saveCurrentFabric();
            scheduleRender();
            dismissAreaContextMenu();
        });
        
        btn.addEventListener('mouseenter', (e) => {
            e.target.style.transform = 'scale(1.2)';
        });
        
        btn.addEventListener('mouseleave', (e) => {
            e.target.style.transform = 'scale(1)';
        });
    });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissAreaContextMenu();
        deleteArea(area);
    });
    
    // Dismiss on click outside
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissAreaContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismissHandler), 0);
}

// ===== TOTEM CONTEXT MENU =====
function dismissTotemContextMenu() {
    const existing = document.getElementById('totem-context-menu');
    if (existing) existing.remove();
}

function generateTotemThumbnail(tx, ty) {
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const originalCam = { ...state.camera };
    const originalDisplay = filesLayer.style.display;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 250 * dpr;
    
    state.camera.x = -tx * 0.15;
    state.camera.y = -ty * 0.15;
    state.camera.zoom = 0.15;
    
    filesLayer.style.display = 'none';
    
    render();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    state.camera = originalCam;
    filesLayer.style.display = originalDisplay;
    render();
    
    return dataUrl;
}

function showTotemContextMenu(screenX, screenY, totem) {
    dismissAreaContextMenu();
    dismissTextContextMenu();
    dismissProgressBarContextMenu();
    dismissTotemContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'totem-context-menu';
    menu.className = 'area-ctx-menu';
    
    // Default radius to 0 if not set
    const currentRadius = totem.radius || 0;
    
    menu.innerHTML = `
        <div class="area-ctx-header">${totem.name}</div>
        <div class="area-ctx-item" data-action="rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
        </div>
        <div class="area-ctx-item" data-action="move-totem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="19 9 22 12 19 15"/><polyline points="9 19 12 22 15 19"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
            Move Totem & Field
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item-nover" style="padding: 8px 16px; cursor: default;">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Color</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; width: 150px;">
                ${PRESET_COLORS.filter(c => c !== 'transparent').map(c => 
                    `<div class="area-ctx-color-btn" data-color="${c}" style="width: 20px; height: 20px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid ${(totem.color || '#3b5a76') === c ? '#fff' : 'transparent'}; box-shadow: 0 0 0 1px ${(totem.color || '#3b5a76') === c ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; transition: transform 0.1s;"></div>`
                ).join('')}
            </div>
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item" data-action="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Thumbnail
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
        </div>
    `;
    
    // Position with boundary checks
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        zIndex: '9000'
    });
    
    document.body.appendChild(menu);
    
    // Adjust if going off-screen
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${screenX - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${screenY - rect.height}px`;
    });
    
    // Action handlers
    menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
        dismissTotemContextMenu();
        const newName = prompt("Rename Totem:", totem.name);
        if (newName && newName.trim() !== '') {
            totem.name = newName.trim();
            saveCurrentFabric();
            scheduleRender();
        }
    });

    menu.querySelector('[data-action="move-totem"]').addEventListener('click', () => {
        dismissTotemContextMenu();
        
        // Field radius is 500 (hardcoded in magnetic fields logic)
        const radius = 500;
        
        // Include both logically linked items AND physically nearby items, including tables and other totems
        const linkedDrawings = state.drawings.filter(d => {
            if (d.linkedTotemId === totem.id) return true;
            const bbox = getItemBBox(d);
            return bbox && distToBBox(totem.x, totem.y, bbox) <= radius;
        });
        
        const linkedAreas = state.areas.filter(a => {
            if (a.linkedTotemId === totem.id) return true;
            const bbox = getItemBBox(a);
            return bbox && distToBBox(totem.x, totem.y, bbox) <= radius;
        });
        
        const linkedFiles = state.files.filter(f => {
            if (f.isHidden) return false;
            if (f.linkedTotemId === totem.id) return true;
            const bbox = getItemBBox(f);
            return bbox && distToBBox(totem.x, totem.y, bbox) <= radius;
        });
        
        const linkedTables = state.tables.filter(t => {
            const bbox = getItemBBox(t);
            return bbox && distToBBox(totem.x, totem.y, bbox) <= radius;
        });
        
        const linkedTotems = state.totems.filter(t => {
            if (t.id === totem.id) return false;
            const bbox = getItemBBox(t);
            return bbox && distToBBox(totem.x, totem.y, bbox) <= radius;
        });
        
        state.mode = 'move-totem';
        state.movingTotemContext = {
            totem: totem,
            drawings: linkedDrawings,
            areas: linkedAreas,
            files: linkedFiles,
            tables: linkedTables,
            totems: linkedTotems,
            lastPos: { x: totem.x, y: totem.y }
        };
        
        workspace.style.cursor = 'move';
    });
    
    menu.querySelectorAll('.area-ctx-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newColor = e.target.getAttribute('data-color');
            totem.color = newColor;
            saveCurrentFabric();
            scheduleRender();
            dismissTotemContextMenu();
        });
        
        btn.addEventListener('mouseenter', (e) => {
            e.target.style.transform = 'scale(1.2)';
        });
        
        btn.addEventListener('mouseleave', (e) => {
            e.target.style.transform = 'scale(1)';
        });
    });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissTotemContextMenu();
        state.totems = state.totems.filter(t => t.id !== totem.id);
        saveCurrentFabric();
        scheduleRender();
    });
    
    menu.querySelector('[data-action="refresh"]').addEventListener('click', () => {
        dismissTotemContextMenu();
        totem.thumbnail = generateTotemThumbnail(totem.x, totem.y);
        saveCurrentFabric();
    });
    
    // Dismiss on click outside
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissTotemContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismissHandler), 0);
}

function dismissCalendarContextMenu() {
    const existing = document.getElementById('cal-context-menu');
    if (existing) existing.remove();
}

function showCalendarContextMenu(screenX, screenY, calendar) {
    console.log('showCalendarContextMenu called at', screenX, screenY);
    dismissAreaContextMenu();
    if(typeof dismissTextContextMenu === 'function') dismissTextContextMenu();
    if(typeof dismissProgressBarContextMenu === 'function') dismissProgressBarContextMenu();
    if(typeof dismissTotemContextMenu === 'function') dismissTotemContextMenu();
    if(typeof dismissClockContextMenu === 'function') dismissClockContextMenu();
    dismissCalendarContextMenu();
    
    const menu = document.createElement('div');
    menu.id = 'cal-context-menu';
    menu.className = 'area-ctx-menu';
    
    const isFixed = calendar.fixedMonth !== undefined;
    
    menu.innerHTML = `
        <div class="area-ctx-header">Calendar</div>
        <div class="area-ctx-item-nover" style="padding: 8px 16px; cursor: default;">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Display Mode</div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; user-select: none;">
                <input type="checkbox" id="cal-fixed-cb" ${isFixed ? 'checked' : ''} style="cursor: pointer;">
                Fixed Month
            </label>
        </div>
        <div class="area-ctx-sep"></div>
        <div class="area-ctx-item area-ctx-danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Calendar
        </div>
    `;
    
    menu.style.position = 'absolute';
    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    menu.style.zIndex = '10000';
    document.body.appendChild(menu);
    
    menu.querySelector('#cal-fixed-cb').addEventListener('change', (e) => {
        if (e.target.checked) {
            calendar.fixedMonth = state.calendarSync.viewMonth;
            calendar.fixedYear = state.calendarSync.viewYear;
        } else {
            delete calendar.fixedMonth;
            delete calendar.fixedYear;
        }
        updateAllCalendarsHTML();
        saveCurrentFabric();
    });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        dismissCalendarContextMenu();
        state.drawings = state.drawings.filter(d => d.id !== calendar.id);
        const container = document.getElementById(`cal-${calendar.id}`);
        if(container) container.remove();
        saveCurrentFabric();
        scheduleRender();
    });
    
    const dismissHandler = (e) => {
        if (!menu.contains(e.target)) {
            dismissCalendarContextMenu();
            document.removeEventListener('pointerdown', dismissHandler);
        }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismissHandler), 0);
}


function deleteArea(area) {
    state.areas = state.areas.filter(a => a.id !== area.id);
    
    // Unassign files from this area
    for (let file of state.files) {
        if (file.areaId === area.id) {
            file.areaId = null;
            file.areaName = 'Unassigned';
            const el = document.getElementById(`file-${file.id}`);
            if (el) {
                const badge = el.querySelector('.file-area');
                if (badge) {
                    badge.textContent = 'Unassigned';
                    badge.classList.add('unassigned');
                }
            }
        }
    }
    // Remove any links connected to this area
    state.links = state.links.filter(l => l.fromAreaId !== area.id && l.toAreaId !== area.id);
    saveCurrentFabric();
    scheduleRender();
    uploadProgress.finish();
}

function startAreaRename(area) {
    // Get area center in screen coordinates for input positioning
    let cx = 0, cy = 0, count = 0;
    const allPolys = area.polygons || [area.points];
    for (const poly of allPolys) {
        if (!poly) continue;
        for (const pt of poly) {
            cx += pt.x; cy += pt.y; count++;
        }
    }
    if (count > 0) { cx /= count; cy /= count; }
    
    // Convert world to screen
    const rect = workspace.getBoundingClientRect();
    const sx = rect.width / 2 + state.camera.x + cx * state.camera.zoom;
    const sy = rect.height / 2 + state.camera.y + cy * state.camera.zoom;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'area-name-input';
    input.value = area.name;
    
    Object.assign(input.style, {
        position: 'absolute',
        left: `${sx}px`,
        top: `${sy}px`,
        zIndex: '2000',
        font: '600 16px Inter, sans-serif',
        color: '#fff',
        background: 'rgba(0,0,0,0.8)',
        border: `1px solid ${area.color}`,
        borderRadius: '6px',
        padding: '8px 12px',
        outline: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        transform: 'translate(-50%, -50%)'
    });
    
    document.body.appendChild(input);
    input.select();
    
    let isFinalized = false;
    const finalize = () => {
        if (isFinalized) return;
        isFinalized = true;
        if (!input.parentNode) return;
        const oldName = area.name;
        const newName = input.value.trim() || area.name;
        input.remove();
        
        area.name = newName;
        
        // Update local file badges
        for (let file of state.files) {
            if (file.areaId === area.id) {
                file.areaName = newName;
                const el = document.getElementById(`file-${file.id}`);
                if (el) {
                    const badge = el.querySelector('.file-area');
                    if (badge) badge.textContent = newName;
                }
            }
        }
        
        // Update global shelf files if it's a shelf
        if (area.isBook && oldName !== newName) {
            let changedGlobal = false;
            for (let file of globalBookFiles) {
                if (file.areaId === area.id) {
                    file.bookName = newName;
                    file.areaName = newName;
                    changedGlobal = true;
                    const el = document.getElementById(`file-${file.id}`);
                    if (el) {
                        const badge = el.querySelector('.file-area');
                        if (badge) badge.textContent = newName;
                    }
                }
            }
            if (changedGlobal) saveGlobalShelves();
        }
        
        saveCurrentFabric();
        scheduleRender();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finalize();
        if (e.key === 'Escape') {
            isFinalized = true;
            if (input.parentNode) input.remove();
        }
    });
    input.addEventListener('blur', finalize);
}

function startAreaResize(area) {
    // Compute bounding box
    const allPolys = area.polygons || [area.points];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of allPolys) {
        if (!poly) continue;
        for (const pt of poly) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
    }
    
    const origBBox = { minX, minY, maxX, maxY };
    const origPolys = allPolys.map(poly => poly ? poly.map(pt => ({ x: pt.x, y: pt.y })) : null);
    
    // Select this area for visual feedback
    state.selectedAreaId = area.id;
    
    // Create 8 handle positions (4 corners + 4 edges)
    const handles = [
        { id: 'tl', cursor: 'nwse-resize' },
        { id: 'tc', cursor: 'ns-resize' },
        { id: 'tr', cursor: 'nesw-resize' },
        { id: 'ml', cursor: 'ew-resize' },
        { id: 'mr', cursor: 'ew-resize' },
        { id: 'bl', cursor: 'nesw-resize' },
        { id: 'bc', cursor: 'ns-resize' },
        { id: 'br', cursor: 'nwse-resize' },
    ];
    
    const handleSize = 8;
    const handleContainer = document.createElement('div');
    handleContainer.id = 'area-resize-handles';
    handleContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:8000;pointer-events:none;';
    
    function getHandleScreenPos(hid) {
        const rect = workspace.getBoundingClientRect();
        const ap = allPolys;
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
        for (const poly of ap) {
            if (!poly) continue;
            for (const pt of poly) {
                if (pt.x < bMinX) bMinX = pt.x;
                if (pt.y < bMinY) bMinY = pt.y;
                if (pt.x > bMaxX) bMaxX = pt.x;
                if (pt.y > bMaxY) bMaxY = pt.y;
            }
        }
        const toScreen = (wx, wy) => ({
            sx: rect.width / 2 + state.camera.x + wx * state.camera.zoom,
            sy: rect.height / 2 + state.camera.y + wy * state.camera.zoom
        });
        const positions = {
            tl: toScreen(bMinX, bMinY), tc: toScreen((bMinX + bMaxX) / 2, bMinY), tr: toScreen(bMaxX, bMinY),
            ml: toScreen(bMinX, (bMinY + bMaxY) / 2), mr: toScreen(bMaxX, (bMinY + bMaxY) / 2),
            bl: toScreen(bMinX, bMaxY), bc: toScreen((bMinX + bMaxX) / 2, bMaxY), br: toScreen(bMaxX, bMaxY)
        };
        return positions[hid];
    }
    
    function updateHandlePositions() {
        for (const h of handles) {
            const el = handleContainer.querySelector(`[data-handle="${h.id}"]`);
            if (!el) continue;
            const pos = getHandleScreenPos(h.id);
            el.style.left = `${pos.sx}px`;
            el.style.top = `${pos.sy}px`;
            el.style.transform = 'translate(-50%, -50%)';
        }
    }
    
    for (const h of handles) {
        const hEl = document.createElement('div');
        hEl.dataset.handle = h.id;
        hEl.style.cssText = `position:absolute;width:${handleSize}px;height:${handleSize}px;background:white;border:1.5px solid ${area.color};border-radius:2px;cursor:${h.cursor};pointer-events:all;box-shadow:0 1px 4px rgba(0,0,0,0.4);transform:translate(-50%, -50%);`;
        const pos = getHandleScreenPos(h.id);
        hEl.style.left = `${pos.sx}px`;
        hEl.style.top = `${pos.sy}px`;
        handleContainer.appendChild(hEl);
    }
    
    document.body.appendChild(handleContainer);
    
    // Show overlay hint
    const overlay = document.createElement('div');
    overlay.className = 'area-resize-overlay';
    overlay.innerHTML = '<span>Drag handles to resize \u2022 Esc to cancel</span>';
    document.body.appendChild(overlay);
    
    let activeHandle = null;
    let dragStartScreen = null;
    let dragStartBBox = null;
    
    const onHandleDown = (e) => {
        const hid = e.target.dataset?.handle;
        if (!hid) return;
        e.preventDefault();
        e.stopPropagation();
        activeHandle = hid;
        dragStartScreen = { x: e.clientX, y: e.clientY };
        // Capture current bbox
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
        for (const poly of allPolys) {
            if (!poly) continue;
            for (const pt of poly) {
                if (pt.x < bMinX) bMinX = pt.x;
                if (pt.y < bMinY) bMinY = pt.y;
                if (pt.x > bMaxX) bMaxX = pt.x;
                if (pt.y > bMaxY) bMaxY = pt.y;
            }
        }
        dragStartBBox = { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY };
        document.addEventListener('pointermove', onHandleMove);
        document.addEventListener('pointerup', onHandleUp);
    };
    
    const onHandleMove = (e) => {
        if (!activeHandle || !dragStartScreen || !dragStartBBox) return;
        const dx = (e.clientX - dragStartScreen.x) / state.camera.zoom;
        const dy = (e.clientY - dragStartScreen.y) / state.camera.zoom;
        
        const ob = dragStartBBox;
        let newMinX = ob.minX, newMinY = ob.minY, newMaxX = ob.maxX, newMaxY = ob.maxY;
        
        // Apply delta based on handle
        if (activeHandle.includes('l')) newMinX = ob.minX + dx;
        if (activeHandle.includes('r')) newMaxX = ob.maxX + dx;
        if (activeHandle.startsWith('t')) newMinY = ob.minY + dy;
        if (activeHandle.startsWith('b')) newMaxY = ob.maxY + dy;
        // Middle handles
        if (activeHandle === 'tc') { newMinY = ob.minY + dy; }
        if (activeHandle === 'bc') { newMaxY = ob.maxY + dy; }
        if (activeHandle === 'ml') { newMinX = ob.minX + dx; }
        if (activeHandle === 'mr') { newMaxX = ob.maxX + dx; }
        
        // Prevent inversion (minimum size)
        if (newMaxX - newMinX < 20) return;
        if (newMaxY - newMinY < 20) return;
        
        const oldW = origBBox.maxX - origBBox.minX;
        const oldH = origBBox.maxY - origBBox.minY;
        const newW = newMaxX - newMinX;
        const newH = newMaxY - newMinY;
        
        // Remap all original points to new bbox
        for (let pi = 0; pi < allPolys.length; pi++) {
            const poly = allPolys[pi];
            const origPoly = origPolys[pi];
            if (!poly || !origPoly) continue;
            for (let i = 0; i < poly.length; i++) {
                const tx = (origPoly[i].x - origBBox.minX) / oldW;
                const ty = (origPoly[i].y - origBBox.minY) / oldH;
                poly[i].x = newMinX + tx * newW;
                poly[i].y = newMinY + ty * newH;
            }
        }
        updateHandlePositions();
        scheduleRender();
    };
    
    const onHandleUp = () => {
        activeHandle = null;
        dragStartScreen = null;
        dragStartBBox = null;
        document.removeEventListener('pointermove', onHandleMove);
        document.removeEventListener('pointerup', onHandleUp);
    };
    
    handleContainer.addEventListener('pointerdown', onHandleDown);
    
    // Click outside handles to confirm
    const confirmHandler = (e) => {
        if (e.target.dataset?.handle) return;
        cleanup();
    };
    setTimeout(() => document.addEventListener('pointerdown', confirmHandler), 50);
    
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            // Restore original points
            for (let pi = 0; pi < allPolys.length; pi++) {
                const poly = allPolys[pi];
                const origPoly = origPolys[pi];
                if (!poly || !origPoly) continue;
                for (let i = 0; i < poly.length; i++) {
                    poly[i].x = origPoly[i].x;
                    poly[i].y = origPoly[i].y;
                }
            }
            scheduleRender();
            cleanup();
        }
    };
    document.addEventListener('keydown', onKeyDown);
    
    const cleanup = () => {
        handleContainer.remove();
        overlay.remove();
        state.selectedAreaId = null;
        document.removeEventListener('pointerdown', confirmHandler);
        document.removeEventListener('keydown', onKeyDown);
        scheduleRender();
    };
}

let cameraAnim = null;

function toggleConstellationMode() {
    if (!state.isConstellationMode) {
        state.isConstellationMode = true;
        document.body.classList.add('constellation-mode');
        state.preConstellationZoom = state.camera.zoom;
        
        if (!state.totems || state.totems.length === 0) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let t of state.totems) {
            if (t.x < minX) minX = t.x;
            if (t.y < minY) minY = t.y;
            if (t.x > maxX) maxX = t.x;
            if (t.y > maxY) maxY = t.y;
        }
        
        if (minX === Infinity) return;
        
        // Add generous padding
        minX -= 1000; minY -= 1000; maxX += 1000; maxY += 1000;
        
        const w = maxX - minX;
        const h = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const canvasW = canvas.width / (window.devicePixelRatio || 1);
        const canvasH = canvas.height / (window.devicePixelRatio || 1);
        
        let targetZoom = Math.min(canvasW / w, canvasH / h);
        if (targetZoom > 1) targetZoom = 1;
        
        startCameraAnimation(-centerX * targetZoom, -centerY * targetZoom, targetZoom);
    } else {
        state.isConstellationMode = false;
        document.body.classList.remove('constellation-mode');
        // Keep current pan center but restore original zoom
        const currentCenterX = -state.camera.x / state.camera.zoom;
        const currentCenterY = -state.camera.y / state.camera.zoom;
        const tz = state.preConstellationZoom || 1;
        startCameraAnimation(-currentCenterX * tz, -currentCenterY * tz, tz);
    }
}

function openMissionControl() {
    const overlay = document.getElementById('mission-control-overlay');
    const grid = document.getElementById('mc-grid');
    if (!overlay || !grid) return;
    
    grid.innerHTML = '';
    
    if (!state.totems || state.totems.length === 0) {
        grid.innerHTML = '<div style="color: #9ca3af; grid-column: 1/-1; text-align: center; padding: 40px; font-size: 1.2rem;">No totems found. Create some totems first!</div>';
    } else {
        state.totems.forEach(totem => {
            if (!totem.thumbnail) {
                totem.thumbnail = generateTotemThumbnail(totem.x, totem.y);
            }
            
            const card = document.createElement('div');
            card.className = 'mc-card';
            
            card.innerHTML = `
                <img class="mc-card-img" src="${totem.thumbnail}" alt="${totem.name}" draggable="false" style="pointer-events: none; user-select: none;">
                <div class="mc-card-footer" style="pointer-events: none; user-select: none;">
                    <div class="mc-card-color" style="background-color: ${totem.color || '#3b5a76'}"></div>
                    <div class="mc-card-title">${totem.name}</div>
                </div>
            `;
            
            card.setAttribute('draggable', 'false');
            card.ondragstart = (e) => { e.preventDefault(); return false; };
            
            card.addEventListener('pointerdown', (e) => {
                // Prevent default to stop any native dragging right at the start
                e.preventDefault();
                e.stopPropagation();
                
                const targetZoom = 0.5;
                
                // Calculate camera Y so the totem appears near the top (150px from top)
                const canvas = document.getElementById('fabric-canvas');
                const canvasH = canvas.height / (window.devicePixelRatio || 1);
                const targetScreenY = 150; 
                const targetCamY = targetScreenY - (canvasH / 2) - (totem.y * targetZoom);
                const targetCamX = -(totem.x * targetZoom);
                
                console.log(`[Mission Control] Teleporting to Totem "${totem.name}" at world(x=${totem.x}, y=${totem.y})`);
                closeMissionControl();
                
                setTimeout(() => {
                    startCameraAnimation(targetCamX, targetCamY, targetZoom);
                }, 50);
            });
            
            grid.appendChild(card);
        });
    }
    
    overlay.classList.remove('hidden');
    
    const dismissHandler = (e) => {
        if (e.target === overlay) {
            closeMissionControl();
        }
    };
    const escHandler = (e) => {
        if (e.key === 'Escape') closeMissionControl();
    };
    
    overlay.addEventListener('click', dismissHandler);
    window.addEventListener('keydown', escHandler);
    
    overlay._dismissHandler = dismissHandler;
    overlay._escHandler = escHandler;
}

function closeMissionControl() {
    const overlay = document.getElementById('mission-control-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        if (overlay._dismissHandler) overlay.removeEventListener('click', overlay._dismissHandler);
        if (overlay._escHandler) window.removeEventListener('keydown', overlay._escHandler);
    }
}

// ==========================================
// Side Panel Stack (iOS-style card recede)
// ==========================================
// Both the Edge Sidebar (folder viewer) and the Widget Sidebar live on the same screen
// edge. Rather than one closing the other, an already-open panel "recedes" (scales down,
// dims) behind whichever panel opens on top of it, like an app switcher card stack.
//
// Three states a panel can be in:
//   - frontmost: fully visible (last entry in sidePanelStack)
//   - receded: visible but dimmed/scaled behind the frontmost one (any other entry in
//     sidePanelStack) — this only happens when a DIFFERENT panel is explicitly opened
//     on top of it.
//   - hidden: fully off-screen, but still "available" (its content/state is preserved,
//     not torn down) — this is what Escape/click-outside do, as opposed to the explicit
//     close (×) button which fully closes it (see closeSidePanel vs hideSidePanel).
//
// Whenever 2+ panels are "available" (frontmost + receded + hidden, i.e. not closed), the
// header title of each shows a small tab switcher instead of its plain title, so the user
// can jump straight to either one without having to close it first.
const sidePanelStack = [];    // visible panels (frontmost + receded), front-to-back order
let hiddenSidePanels = [];    // available but currently off-screen panels
const SIDE_PANELS = {
    edge:    { el: () => document.getElementById('edge-sidebar'),   onClose: () => closeEdgeSidebar() },
    widgets: { el: () => document.getElementById('widget-sidebar'), onClose: () => closeWidgetSidebar() }
};
const SIDE_PANEL_LABELS = { edge: 'Folder', widgets: 'Widgets' };

function openSidePanel(name) {
    const hiddenIdx = hiddenSidePanels.indexOf(name);
    if (hiddenIdx !== -1) hiddenSidePanels.splice(hiddenIdx, 1);

    if (sidePanelStack[sidePanelStack.length - 1] !== name) {
        const existingIdx = sidePanelStack.indexOf(name);
        if (existingIdx !== -1) sidePanelStack.splice(existingIdx, 1);
        sidePanelStack.push(name);
    }
    applySidePanelStackVisuals();
}

// Escape / click-outside: send the panel fully off-screen but keep it available (state
// preserved, still listed in the header tab switcher) rather than tearing it down.
function hideSidePanel(name) {
    const idx = sidePanelStack.indexOf(name);
    if (idx === -1) return;
    sidePanelStack.splice(idx, 1);
    if (!hiddenSidePanels.includes(name)) hiddenSidePanels.push(name);
    const cfg = SIDE_PANELS[name];
    const el = cfg ? cfg.el() : null;
    if (el) {
        el.classList.remove('side-panel-open', 'side-panel-receded');
        el.style.zIndex = '';
    }
    applySidePanelStackVisuals();
}

// Explicit close (×) button only: fully tears the panel down (clears its content-specific
// state via onClose) and drops it from the tab switcher entirely.
function closeSidePanel(name) {
    const stackIdx = sidePanelStack.indexOf(name);
    if (stackIdx !== -1) sidePanelStack.splice(stackIdx, 1);
    const hiddenIdx = hiddenSidePanels.indexOf(name);
    if (hiddenIdx !== -1) hiddenSidePanels.splice(hiddenIdx, 1);
    const cfg = SIDE_PANELS[name];
    const el = cfg ? cfg.el() : null;
    if (el) {
        el.classList.remove('side-panel-open', 'side-panel-receded');
        el.style.zIndex = '';
    }
    if (cfg && cfg.onClose) cfg.onClose();
    applySidePanelStackVisuals();
}

function closeTopSidePanel() {
    const top = sidePanelStack[sidePanelStack.length - 1];
    if (top) closeSidePanel(top);
}

function applySidePanelStackVisuals() {
    sidePanelStack.forEach((name, i) => {
        const cfg = SIDE_PANELS[name];
        const el = cfg ? cfg.el() : null;
        if (!el) return;
        const depthFromTop = sidePanelStack.length - 1 - i; // 0 = frontmost
        el.classList.add('side-panel-open');
        el.classList.toggle('side-panel-receded', depthFromTop > 0);
        el.style.zIndex = 9000 + i;
    });
    updateSidePanelSelectors();
}

// Swaps each available panel's header title for a tab switcher once 2+ panels are
// available (visible or hidden, i.e. not closed) — otherwise restores the normal title.
function updateSidePanelSelectors() {
    const available = sidePanelStack.concat(hiddenSidePanels);
    const activeName = sidePanelStack[sidePanelStack.length - 1] || null;

    Object.keys(SIDE_PANELS).forEach(name => {
        const titleId = name === 'edge' ? 'edge-sidebar-title' : 'widget-sidebar-title';
        const titleEl = document.getElementById(titleId);
        if (!titleEl) return;

        if (available.length > 1 && available.includes(name)) {
            titleEl.innerHTML = available.map(n => {
                const cls = n === activeName ? 'side-panel-tab active' : 'side-panel-tab';
                return `<span class="${cls}" data-panel="${n}">${SIDE_PANEL_LABELS[n]}</span>`;
            }).join('');
            titleEl.querySelectorAll('.side-panel-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openSidePanel(tab.dataset.panel);
                });
            });
        } else if (name === 'edge') {
            const folder = window.activeEdgeFolderId ? state.areas.find(a => a.id === window.activeEdgeFolderId) : null;
            titleEl.textContent = folder ? folder.name : 'Folder Name';
        } else {
            titleEl.textContent = 'Widgets';
        }
    });
}

// A single, persistent pair of listeners (rather than one bound per panel) so Escape or
// an outside click always affects only the actual frontmost panel, regardless of how
// many panels happen to be stacked underneath it.
document.addEventListener('click', (e) => {
    const front = sidePanelStack[sidePanelStack.length - 1];
    if (!front) return;
    const cfg = SIDE_PANELS[front];
    const el = cfg ? cfg.el() : null;
    if (el && !el.contains(e.target)) hideSidePanel(front);
});
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const front = sidePanelStack[sidePanelStack.length - 1];
    if (front) hideSidePanel(front);
});

function startCameraAnimation(tx, ty, tz) {
    cameraAnim = {
        startX: state.camera.x,
        startY: state.camera.y,
        startZoom: state.camera.zoom,
        targetX: tx,
        targetY: ty,
        targetZoom: tz,
        startTime: performance.now(),
        duration: 800
    };
    animateCamera();
}

function animateCamera() {
    if (!cameraAnim) return;
    const now = performance.now();
    let progress = (now - cameraAnim.startTime) / cameraAnim.duration;
    if (progress > 1) progress = 1;
    
    // cubic ease in-out
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    state.camera.x = cameraAnim.startX + (cameraAnim.targetX - cameraAnim.startX) * ease;
    state.camera.y = cameraAnim.startY + (cameraAnim.targetY - cameraAnim.startY) * ease;
    state.camera.zoom = cameraAnim.startZoom + (cameraAnim.targetZoom - cameraAnim.startZoom) * ease;
    
    scheduleRender();
    
    if (progress < 1) {
        requestAnimationFrame(animateCamera);
    } else {
        cameraAnim = null;
    }
}

// Render coalescing: many code paths call scheduleRender() (often several within one
// event handler or one frame). Without coalescing, each would queue its own rAF callback
// and render() would run multiple times per frame for the same visual result. This flag
// guarantees at most ONE render per animation frame. The flag is cleared before render()
// runs, so a scheduleRender() issued from *inside* render() (e.g. the scroll-box/glow
// animation self-loop) correctly queues the next frame.
let _renderScheduled = false;
function scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    requestAnimationFrame(() => {
        _renderScheduled = false;
        render();
    });
}

// Rendering Loop
function render() {
    if (canvas.width === 0 || canvas.height === 0) return;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Recompute what's visible this frame so every draw/sync loop can cull off-screen items.
    updateViewBounds(width, height);

    ctx.fillStyle = state.fabricColor;
    ctx.fillRect(0, 0, width, height);
    
    // Apply Camera Transform
    ctx.save();
    ctx.translate(width/2 + state.camera.x, height/2 + state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    
    // Always call drawGrid so magnetic clusters are computed, 
    // but the dots themselves will be hidden inside drawGrid.
    drawGrid(width, height);
    
    if (state.isConstellationMode) {
        drawConstellationLinks();
        drawTotems();
        filesLayer.style.display = 'none';
        // Constellation mode already shows every totem zoomed out — edge arrows for
        // "off-screen" totems make no sense here, so keep the layer empty.
        if (totemIndicatorsLayer) totemIndicatorsLayer.innerHTML = '';

        ctx.restore();
        return;
    } else {
        filesLayer.style.display = 'block';
    }
    
    // Draw locked drawings that have no parent area (or parent deleted)
    drawDrawings('background');
    
    // Draw Areas (which will capture the canvas and blur it)
    if (bgCanvas.width !== canvas.width || bgCanvas.height !== canvas.height) {
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
    }
    
    drawAreas();
    
    // Draw Totems
    drawTotems();
    
    // Draw everything else (unlocked items) on top of all areas
    drawDrawings('foreground');
    
    // Draw Current Polygon (if drawing)
    drawCurrentPolygon();
    
    // Draw Lasso
    drawLasso();
    
    // Dashboard edit popup canvas is rendered separately, no mask needed here
    
    syncNotesDOM();
    syncFilesVisibility();
    
    ctx.restore();
    
    // Update files layer CSS transform
    // The CSS transform also goes from center of the screen
    filesLayer.style.transform = `translate(${width/2 + state.camera.x}px, ${height/2 + state.camera.y}px) scale(${state.camera.zoom})`;
    
    syncTextsDOM();
    syncTables();
    syncCalendars();
    syncScrollBoxes();
    syncTotemIndicators(width, height);
    
    let hasAnimations = false;
    for (let area of state.areas) {
        if (area.isScrollBox && area.animation) {
            if (performance.now() - area.animation.startTime >= area.animation.duration) {
                delete area.animation;
                hasAnimations = true; // request one final frame to settle
            } else {
                hasAnimations = true;
            }
        }
    }
    if (hasAnimations) {
        scheduleRender();
    }
}

function syncTextsDOM() {
    const textDrawings = state.drawings.filter(d => d.type === 'text');
    const textIds = new Set(textDrawings.map(d => d.id)); // Set: O(1) membership vs O(n) Array.includes per orphan

    document.querySelectorAll('.text-item').forEach(el => {
        if (!textIds.has(el.id)) el.remove();
    });

    textDrawings.forEach(d => {
        let el = document.getElementById(d.id);
        if (!el) {
            el = document.createElement('div');
            el.id = d.id;
            el.className = 'text-item';
            filesLayer.appendChild(el);
        }

        const isVisible = isItemVisibleInContainer(d);
        const isEditing = state.selectedText && state.selectedText.id === d.id && document.querySelector('.inline-text-input');
        // Off-screen text boxes are hidden and skip the per-frame innerHTML/style rebuild below.
        const onScreen = isItemOnScreen(d) || el.contains(document.activeElement);

        if (isEditing || !isVisible || !onScreen) {
            el.style.display = 'none';
            return;
        } else {
            el.style.display = 'block';
        }

        const baseFontSize = d.fontSize || 24;
        const fontStyle = d.isItalic ? 'italic ' : '';
        const fontWeight = d.isBold ? 'bold ' : '600 ';
        const fontFamily = d.fontFamily || 'Inter, sans-serif';

        // Wait, for Markdown headers we still want some scaling? 
        // We will just let innerHTML handle it. It's either Markdown or HTML.
        let htmlContent = d.text || "";
        if (!htmlContent.includes('<') && !htmlContent.includes('>')) {
            htmlContent = htmlContent.replace(/\n/g, '<br>');
        }
        
        // Only update innerHTML if changed to prevent reflow/losing selection (if it was editable, but it's not)
        if (el.innerHTML !== htmlContent) {
            el.innerHTML = htmlContent;
        }

        const offset = getAnimationOffset(d);

        el.style.position = 'absolute';
        el.style.left = `${d.x}px`;
        el.style.top = `${d.y}px`;
        
        const newTransform = (offset.dx !== 0 || offset.dy !== 0) ? `translate(${offset.dx}px, ${offset.dy}px)` : '';
        if (el.style.transform !== newTransform) {
            el.style.transform = newTransform;
        }
        
        applyDOMClip(el, d);

        el.style.font = `${fontStyle}${fontWeight}${baseFontSize}px ${fontFamily}`;
        el.style.lineHeight = '1.2';
        el.style.color = d.color || state.areaColor;
        el.style.textAlign = d.textAlign || 'left';
        
        if (d.width) {
            el.style.width = `${d.width}px`;
            el.style.whiteSpace = 'pre-wrap';
            el.style.wordBreak = 'break-word';
        } else {
            el.style.width = 'auto';
            el.style.whiteSpace = 'pre';
        }
        el.style.pointerEvents = 'none'; // Let canvas handle clicks for now, unless we want to select text?
    });
}

function syncTables() {
    const tableIds = new Set(state.tables ? state.tables.map(t => t.id) : []); // Set: O(1) orphan check
    document.querySelectorAll('.table-container').forEach(el => {
        if (!tableIds.has(el.id)) {
            el.remove();
        }
    });

    if (!state.tables) return;
    for (let table of state.tables) {
        if (!table.colWidths) table.colWidths = new Array(table.cols).fill(80);
        if (!table.rowHeights) table.rowHeights = new Array(table.rows).fill(30);

        // Off-screen tables skip the full remove()+rebuild this function does every frame.
        // If a cell in it is being edited, leave the DOM untouched so focus/caret survive.
        const tableOnScreen = isItemVisibleInContainer(table) && isItemOnScreen(table);
        if (!tableOnScreen) {
            const existing = document.getElementById(table.id);
            if (existing && !existing.contains(document.activeElement)) {
                existing.style.display = 'none';
            }
            continue;
        }

        // Structural signature: everything whose change requires a DOM rebuild. Cell CONTENT
        // is deliberately excluded — it lives in the contenteditable DOM and is written back to
        // state on input, so the DOM is always the current source of truth for content and never
        // needs a rebuild. Only row/col count, column/row sizes, or resize-mode toggling do.
        const tableSig = `${table.rows}x${table.cols}|${table.colWidths.join(',')}|${table.rowHeights.join(',')}|${table.isResizing ? 1 : 0}`;

        let container = document.getElementById(table.id);

        // FAST PATH: structure unchanged → update only the cheap per-frame props (position,
        // colors, animation offset, clip, display) and skip the full teardown+rebuild that
        // recreates every cell and re-attaches all their event listeners each frame.
        if (container && container._tableSig === tableSig) {
            container.style.display = '';
            container.style.left = table.x + 'px';
            container.style.top = table.y + 'px';
            container.style.background = state.fabricColor === '#ffffff' ? '#ffffff' : '#222';
            container.style.color = state.fabricColor === '#ffffff' ? '#000' : '#fff';
            const offsetF = getAnimationOffset(table);
            container.style.transform = (offsetF.dx !== 0 || offsetF.dy !== 0)
                ? `translate(${offsetF.dx}px, ${offsetF.dy}px)` : '';
            applyDOMClip(container, table);
            continue;
        }

        if (container) {
            container.remove(); // structure changed → full rebuild
        }

        container = document.createElement('div');
        container.id = table.id;
        container._tableSig = tableSig;
        container.className = 'table-container';
        container.style.position = 'absolute';
        container.style.left = table.x + 'px';
        container.style.top = table.y + 'px';
        container.style.pointerEvents = 'auto';
        container.style.background = state.fabricColor === '#ffffff' ? '#ffffff' : '#222';
        container.style.border = '2px solid #555';
        container.style.color = state.fabricColor === '#ffffff' ? '#000' : '#fff';
        container.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        container.style.borderRadius = '4px';
        container.style.overflow = 'hidden';
        container.style.display = isItemVisibleInContainer(table) ? '' : 'none';
        
        const offset = getAnimationOffset(table);
        if (offset.dx !== 0 || offset.dy !== 0) {
            container.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
        } else {
            container.style.transform = '';
        }
        
        applyDOMClip(container, table);
        
        // Context Menu Event
        container.addEventListener('contextmenu', (e) => {
            const hitCell = e.target.closest('[contenteditable="true"]');
            if (hitCell) return;
            
            e.preventDefault();
            e.stopPropagation();
            const menu = document.getElementById('table-context-menu');
            menu.classList.remove('hidden');
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';
            
            // Format Text option only makes sense if we right clicked a cell
            // (hitCell is already declared above)
            
            // Store active table ID on menu for handlers
            menu.dataset.tableId = table.id;
            if (hitCell) {
                menu.dataset.cellId = hitCell.dataset.cellId;
            } else {
                delete menu.dataset.cellId;
            }
        });
        
        const tableEl = document.createElement('table');
        tableEl.style.borderCollapse = 'collapse';
        
        for (let r = 0; r < table.rows; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < table.cols; c++) {
                const td = document.createElement('td');
                td.style.border = '1px solid #555';
                td.style.minWidth = table.colWidths[c] + 'px';
                td.style.width = table.colWidths[c] + 'px';
                td.style.height = table.rowHeights[r] + 'px';
                td.style.padding = '4px';
                td.style.position = 'relative';
                
                const cellId = `${r}-${c}`;
                const content = table.cells[cellId] || '';
                
                const input = document.createElement('div');
                input.dataset.cellId = cellId;
                input.contentEditable = true;
                input.style.width = '100%';
                input.style.height = '100%';
                input.style.outline = 'none';
                input.style.minHeight = '20px';
                input.innerHTML = content;
                
                input.addEventListener('input', () => {
                    table.cells[cellId] = input.innerHTML;
                    saveCurrentFabric();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                        e.preventDefault();
                        document.execCommand('insertHTML', false, '<input type="checkbox" style="margin-right:4px;">');
                        table.cells[cellId] = input.innerHTML;
                        saveCurrentFabric();
                    }
                });
                
                input.addEventListener('change', (e) => {
                    if (e.target && e.target.type === 'checkbox') {
                        if (e.target.checked) e.target.setAttribute('checked', 'checked');
                        else e.target.removeAttribute('checked');
                        table.cells[cellId] = input.innerHTML;
                        saveCurrentFabric();
                    }
                });
                
                input.addEventListener('pointerdown', e => {
                    e.stopPropagation();
                    // Just focus naturally, Format Text is in context menu
                });
                
                td.appendChild(input);
                
                // Inject resize handles if resizing mode is active
                if (table.isResizing) {
                    const colHandle = document.createElement('div');
                    colHandle.className = 'col-resize-handle';
                    colHandle.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        let startX = e.clientX;
                        let startW = table.colWidths[c];
                        const onMove = (ev) => {
                            const dx = (ev.clientX - startX) / state.camera.zoom;
                            table.colWidths[c] = Math.max(30, startW + dx);
                            td.style.minWidth = table.colWidths[c] + 'px';
                            td.style.width = table.colWidths[c] + 'px';
                        };
                        const onUp = () => {
                            document.removeEventListener('pointermove', onMove);
                            document.removeEventListener('pointerup', onUp);
                            saveCurrentFabric();
                        };
                        document.addEventListener('pointermove', onMove);
                        document.addEventListener('pointerup', onUp);
                    });
                    
                    const rowHandle = document.createElement('div');
                    rowHandle.className = 'row-resize-handle';
                    rowHandle.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        let startY = e.clientY;
                        let startH = table.rowHeights[r];
                        const onMove = (ev) => {
                            const dy = (ev.clientY - startY) / state.camera.zoom;
                            table.rowHeights[r] = Math.max(20, startH + dy);
                            td.style.height = table.rowHeights[r] + 'px';
                        };
                        const onUp = () => {
                            document.removeEventListener('pointermove', onMove);
                            document.removeEventListener('pointerup', onUp);
                            saveCurrentFabric();
                        };
                        document.addEventListener('pointermove', onMove);
                        document.addEventListener('pointerup', onUp);
                    });
                    
                    td.appendChild(colHandle);
                    td.appendChild(rowHandle);
                }
                
                tr.appendChild(td);
            }
            tableEl.appendChild(tr);
        }
        
        container.appendChild(tableEl);
        filesLayer.appendChild(container);
    }
}


let activeMagneticFields = [];

function getItemBBox(item) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (item.polygons || item.points) {
        const polys = item.polygons || [item.points];
        for (const poly of polys) {
            if (!poly) continue;
            for (const pt of poly) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }
        }
        return { minX, minY, maxX, maxY };
    }
    if (item.w !== undefined && item.h !== undefined) {
        return { minX: item.x, minY: item.y, maxX: item.x + item.w, maxY: item.y + item.h };
    }
    if (item.fileName !== undefined || item.isYoutube) {
        const w = item.imageWidth || 150;
        const h = item.imageHeight || 150;
        return { minX: item.x, minY: item.y, maxX: item.x + w, maxY: item.y + h };
    }
    if (item.radius !== undefined) {
        return { minX: item.x - item.radius, minY: item.y - item.radius, maxX: item.x + item.radius, maxY: item.y + item.radius };
    }
    if (item.x !== undefined && item.y !== undefined) {
        return { minX: item.x, minY: item.y, maxX: item.x + 100, maxY: item.y + 50 };
    }
    return null;
}

function distToBBox(px, py, bbox) {
    if (!bbox) return Infinity;
    const dx = Math.max(bbox.minX - px, 0, px - bbox.maxX);
    const dy = Math.max(bbox.minY - py, 0, py - bbox.maxY);
    return Math.hypot(dx, dy);
}

function bboxDistance(b1, b2) {
    if (!b1 || !b2) return Infinity;
    const dx = Math.max(b1.minX - b2.maxX, 0, b2.minX - b1.maxX);
    const dy = Math.max(b1.minY - b2.maxY, 0, b2.minY - b1.maxY);
    return Math.hypot(dx, dy);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWPORT CULLING
// `viewBounds` is the world-space rectangle currently visible on screen, expanded by a
// margin so items just off the edge (and short slide animations) don't visibly pop in/out
// while panning. Recomputed once per frame in render(); every draw/sync loop tests each
// item's bbox against it and skips items that can't be seen. This turns the render cost
// from "proportional to total item count" into "proportional to items near the viewport",
// the key optimization for large fabrics.
// ─────────────────────────────────────────────────────────────────────────────
let viewBounds = null;

// marginRatio 0.125 on EACH side = 25% extra on each axis = the culled region is 1.25x the
// visible viewport's width AND height (treating the on-screen viewport itself as "1"). Scaled
// by /z so it's always a constant fraction of what's actually visible, at any zoom level.
function updateViewBounds(width, height, marginRatio = 0.125) {
    const z = state.camera.zoom || 1;
    const left   = (-width / 2  - state.camera.x) / z;
    const right   = ( width / 2  - state.camera.x) / z;
    const top    = (-height / 2 - state.camera.y) / z;
    const bottom = ( height / 2 - state.camera.y) / z;
    const marginX = (width * marginRatio) / z;
    const marginY = (height * marginRatio) / z;
    viewBounds = { minX: left - marginX, minY: top - marginY, maxX: right + marginX, maxY: bottom + marginY };
}

// World-space bounding box for ANY renderable item, covering every coordinate
// convention this codebase uses. Returns null when geometry is unknown (callers
// treat null as "always draw" — fail safe, never cull something we can't measure).
function getRenderBBox(item) {
    if (!item) return null;
    // Text drawings store NO `.height` in state — their height is intrinsic to the rendered
    // content (word-wrap, font size, line count), computed by the browser, not stored. Reusing
    // the generic "x + width/height" branch below for text would silently read `item.height` as
    // undefined → a ZERO-height bbox, which is a real bug: it made tall/multi-line text boxes
    // flicker in and out during panning, since only their exact top-edge y-coordinate (not their
    // true visible extent) was being tested against the viewport. Mirrors the same DOM-read
    // pattern `getDraggableDrawingAt()` (~L761) and the eraser hit-test already use, so this is
    // the SAME source of truth as hit-testing and the selection outline, not a new convention.
    if (item.type === 'text') {
        const textEl = document.getElementById(item.id);
        if (textEl) {
            return { minX: item.x, minY: item.y, maxX: item.x + textEl.offsetWidth, maxY: item.y + textEl.offsetHeight };
        }
        // Fallback for the first frame, before syncTextsDOM() has created the element yet.
        const baseFontSize = item.fontSize || 24;
        const lines = (item.text || '').split('\n');
        const w = item.width || Math.max(200, lines.reduce((m, l) => Math.max(m, l.length * baseFontSize * 0.6), 0));
        const h = Math.max(baseFontSize * 1.4, lines.length * baseFontSize * 1.2);
        return { minX: item.x, minY: item.y, maxX: item.x + w, maxY: item.y + h };
    }
    // Polygon / freehand-path items (areas, path drawings)
    if (item.polygons || item.points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const polys = item.polygons || [item.points];
        for (const poly of polys) {
            if (!poly) continue;
            for (const pt of poly) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }
        }
        if (minX === Infinity) return null;
        return { minX, minY, maxX, maxY };
    }
    // Two-point shapes: line, arrow, rect, circle, book
    if (item.start && item.end) {
        return {
            minX: Math.min(item.start.x, item.end.x),
            minY: Math.min(item.start.y, item.end.y),
            maxX: Math.max(item.start.x, item.end.x),
            maxY: Math.max(item.start.y, item.end.y)
        };
    }
    // Tables: size derived from column widths / row heights
    if (item.colWidths && item.rowHeights && item.x !== undefined) {
        const w = item.colWidths.reduce((a, b) => a + b, 0);
        const h = item.rowHeights.reduce((a, b) => a + b, 0);
        return { minX: item.x, minY: item.y, maxX: item.x + w, maxY: item.y + h };
    }
    // Explicit-size boxes anchored top-left: progress_bar, clock, calendar
    if (item.x !== undefined && item.y !== undefined &&
        (item.width !== undefined || item.w !== undefined)) {
        const w = item.width !== undefined ? item.width : item.w;
        const h = item.height !== undefined ? item.height : (item.h !== undefined ? item.h : 0);
        return { minX: item.x, minY: item.y, maxX: item.x + w, maxY: item.y + h };
    }
    // File cards / YouTube cards — anchored on their CENTER (CSS translate(-50%,-50%))
    if (item.fileName !== undefined || item.isYoutube) {
        const w = item.imageWidth || 150;
        const h = item.imageHeight || 150;
        return { minX: item.x - w / 2, minY: item.y - h / 2, maxX: item.x + w / 2, maxY: item.y + h / 2 };
    }
    // Bare x/y (totems and misc) — treated as roughly centered
    if (item.x !== undefined && item.y !== undefined) {
        return { minX: item.x - 80, minY: item.y - 50, maxX: item.x + 80, maxY: item.y + 50 };
    }
    return null;
}

function isBBoxOnScreen(bbox) {
    if (!viewBounds || !bbox) return true; // no bounds computed yet, or unmeasurable → draw
    return bboxOverlap(bbox, viewBounds);
}

// Links are rendered from inside drawAreas() by the top-most (highest-index) area they
// connect, so an off-screen area must NOT be culled if it owns a link whose span reaches
// the viewport — otherwise the link would disappear. Cheap over-approx: union of the two
// endpoint areas' bboxes. Short-circuits instantly when there are no links.
function areaOwnsVisibleLink(area) {
    if (!state.links || state.links.length === 0) return false;
    const idx = state.areas.indexOf(area);
    return state.links.some(link => {
        const fi = state.areas.findIndex(a => a.id === link.fromAreaId);
        const ti = state.areas.findIndex(a => a.id === link.toAreaId);
        if (fi === -1 || ti === -1) return false;
        if (Math.max(fi, ti) !== idx) return false; // this area doesn't render the link
        const fb = getRenderBBox(state.areas[fi]);
        const tb = getRenderBBox(state.areas[ti]);
        if (!fb || !tb) return true; // unmeasurable → keep (fail safe)
        return isBBoxOnScreen({
            minX: Math.min(fb.minX, tb.minX), minY: Math.min(fb.minY, tb.minY),
            maxX: Math.max(fb.maxX, tb.maxX), maxY: Math.max(fb.maxY, tb.maxY)
        });
    });
}

// Item-level convenience: measures the item and shifts its bbox by any in-progress
// scroll-box slide animation so items animating INTO view aren't wrongly culled.
function isItemOnScreen(item) {
    const bb = getRenderBBox(item);
    if (!bb) return true;
    const off = getAnimationOffset(item);
    if (off.dx !== 0 || off.dy !== 0) {
        return isBBoxOnScreen({ minX: bb.minX + off.dx, minY: bb.minY + off.dy, maxX: bb.maxX + off.dx, maxY: bb.maxY + off.dy });
    }
    return isBBoxOnScreen(bb);
}

function computeMagneticClusters() {
    activeMagneticFields = [];
    const totems = state.totems || [];
    if (totems.length === 0) return;
    
    const parseHex = (hex) => {
        if (hex === 'transparent') return {r:0, g:0, b:0, a:0};
        if (hex && hex.startsWith('#')) {
            let r = parseInt(hex.slice(1,3), 16) || 0;
            let g = parseInt(hex.slice(3,5), 16) || 0;
            let b = parseInt(hex.slice(5,7), 16) || 0;
            return {r,g,b, a:1};
        }
        return {r:59, g:90, b:118, a:1};
    };
    
    const allItems = [
        ...(state.areas || []),
        ...(state.drawings || []),
        ...(state.files || [])
    ];
    
    for (let item of allItems) {
        item.linkedTotemId = null;
    }
    
    const itemDatas = allItems.map(item => ({
        item: item,
        bbox: getItemBBox(item),
        visited: false,
        linkedTotem: null
    })).filter(d => d.bbox !== null);
    
    const queue = [];
    
    for (let totem of totems) {
        const c = parseHex(totem.color || '#3b5a76');
        activeMagneticFields.push({
            type: 'totem',
            x: totem.x,
            y: totem.y,
            radius: 500,
            parsedColor: c,
            bbox: { minX: totem.x - 500, minY: totem.y - 500, maxX: totem.x + 500, maxY: totem.y + 500 }
        });
        
        for (let d of itemDatas) {
            if (d.visited) continue;
            
            const dist = distToBBox(totem.x, totem.y, d.bbox);
            if (dist <= 500) {
                d.visited = true;
                d.linkedTotem = totem;
                d.item.linkedTotemId = totem.id;
                queue.push(d);
                
                if (!state.isConstellationMode) {
                    activeMagneticFields.push({
                        type: 'item',
                        bbox: d.bbox,
                        radius: 300,
                        parsedColor: c
                    });
                }
            }
        }
    }
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        for (let d of itemDatas) {
            if (d.visited) continue;
            
            const dist = bboxDistance(current.bbox, d.bbox);
            if (dist <= 300) {
                d.visited = true;
                d.linkedTotem = current.linkedTotem;
                d.item.linkedTotemId = current.linkedTotem.id;
                queue.push(d);
                
                const c = parseHex(current.linkedTotem.color || '#3b5a76');
                if (!state.isConstellationMode) {
                    activeMagneticFields.push({
                        type: 'item',
                        bbox: d.bbox,
                        radius: 300,
                        parsedColor: c
                    });
                }
            }
        }
    }
}

function drawGrid(width, height) {
    const gridSize = state.gridSize || 40;
    
    const left = (-width/2 - state.camera.x) / state.camera.zoom;
    const right = (width/2 - state.camera.x) / state.camera.zoom;
    const top = (-height/2 - state.camera.y) / state.camera.zoom;
    const bottom = (height/2 - state.camera.y) / state.camera.zoom;

    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    
    const dotSize = Math.max(1.5 / state.camera.zoom, 0.5);
    
    const isLight = isColorLight(state.fabricColor);
    const baseColor = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
    
    computeMagneticClusters();

    // Do not draw dots in constellation view or if zoomed out too far (to save GPU)
    if (state.isConstellationMode || state.camera.zoom < 0.25) return;

    // In efficient mode, areas render fully opaque and fully cover any dots beneath them, so skip
    // drawing (and computing per-totem color influence for) dots under an area entirely, rather
    // than rendering them just to be painted over a moment later.
    let opaqueAreaBBoxes = null;
    if (state.graphicsPreset === 'efficient' && state.areas && state.areas.length > 0) {
        opaqueAreaBBoxes = [];
        for (const a of state.areas) {
            if (a.isFolder || !isItemVisibleInContainer(a)) continue;
            opaqueAreaBBoxes.push(getAreaBBox(a));
        }
    }

    // Calculate global bbox of all magnetic fields
    let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;
    let fieldBBoxes = [];
    
    if (activeMagneticFields.length > 0) {
        fieldBBoxes = activeMagneticFields.map(f => {
            let minX, maxX, minY, maxY;
            if (f.type === 'totem') {
                minX = f.x - f.radius; maxX = f.x + f.radius;
                minY = f.y - f.radius; maxY = f.y + f.radius;
            } else {
                minX = f.bbox.minX - f.radius; maxX = f.bbox.maxX + f.radius;
                minY = f.bbox.minY - f.radius; maxY = f.bbox.maxY + f.radius;
            }
            if (minX < globalMinX) globalMinX = minX;
            if (maxX > globalMaxX) globalMaxX = maxX;
            if (minY < globalMinY) globalMinY = minY;
            if (maxY > globalMaxY) globalMaxY = maxY;
            
            return { minX, maxX, minY, maxY, field: f };
        });
        
        globalMinX = Math.floor(globalMinX / gridSize) * gridSize;
        globalMaxX = Math.ceil(globalMaxX / gridSize) * gridSize;
        globalMinY = Math.floor(globalMinY / gridSize) * gridSize;
        globalMaxY = Math.ceil(globalMaxY / gridSize) * gridSize;
    }
    
    // Draw base dots, skipping the global bbox of magnetic fields
    if (state.graphicsPreset !== 'efficient') {
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        for (let x = startX; x <= right + gridSize; x += gridSize) {
            for (let y = startY; y <= bottom + gridSize; y += gridSize) {
                if (activeMagneticFields.length > 0 && 
                    x >= globalMinX && x <= globalMaxX && 
                    y >= globalMinY && y <= globalMaxY) {
                    continue;
                }
                ctx.moveTo(x, y);
                ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            }
        }
        ctx.fill();
    }
    
    // Handle dots inside the global bounding box
    if (activeMagneticFields.length > 0) {
        const baseRgb = isLight ? {r:0, g:0, b:0} : {r:255, g:255, b:255};
        const baseA = 0.15;
        
        const loopMinX = Math.max(startX, globalMinX);
        const loopMaxX = Math.min(right + gridSize, globalMaxX);
        const loopMinY = Math.max(startY, globalMinY);
        const loopMaxY = Math.min(bottom + gridSize, globalMaxY);
        
        let baseDotsInBBox = [];
        
        for (let x = loopMinX; x <= loopMaxX; x += gridSize) {
            for (let y = loopMinY; y <= loopMaxY; y += gridSize) {
                if (opaqueAreaBBoxes && opaqueAreaBBoxes.some(b => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY)) {
                    continue;
                }

                let maxInfluence = 0;
                let bestColor = null;
                
                for (let i = 0; i < fieldBBoxes.length; i++) {
                    const b = fieldBBoxes[i];
                    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
                        const field = b.field;
                        let dist = Infinity;
                        if (field.type === 'totem') {
                            dist = Math.hypot(x - field.x, y - field.y);
                        } else {
                            const dx = Math.max(field.bbox.minX - x, 0, x - field.bbox.maxX);
                            const dy = Math.max(field.bbox.minY - y, 0, y - field.bbox.maxY);
                            dist = Math.hypot(dx, dy);
                        }
                        
                        if (dist <= field.radius) {
                            const influence = Math.pow(1 - (dist / field.radius), 1.2);
                            if (influence > maxInfluence) {
                                maxInfluence = influence;
                                bestColor = field.parsedColor;
                            }
                        }
                    }
                }
                
                if (maxInfluence > 0 && bestColor) {
                    const r = Math.round(baseRgb.r + (bestColor.r - baseRgb.r) * maxInfluence);
                    const g = Math.round(baseRgb.g + (bestColor.g - baseRgb.g) * maxInfluence);
                    const b = Math.round(baseRgb.b + (bestColor.b - baseRgb.b) * maxInfluence);
                    const a = baseA + (0.8 - baseA) * maxInfluence;
                    
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
                    ctx.beginPath();
                    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                    ctx.fill();
                } else if (state.graphicsPreset !== 'efficient') {
                    baseDotsInBBox.push({x, y});
                }
            }
        }
        
        if (baseDotsInBBox.length > 0) {
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            for (let dot of baseDotsInBBox) {
                ctx.moveTo(dot.x, dot.y);
                ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
            }
            ctx.fill();
        }
    }
}

function drawConstellationLinks() {
    if (!state.totems || state.totems.length < 2) return;
    
    let totemLinksMap = {};
    for (let link of state.links) {
        const fromArea = state.areas.find(a => a.id === link.fromAreaId);
        const toArea = state.areas.find(a => a.id === link.toAreaId);
        if (!fromArea || !toArea) continue;
        
        const totemA = fromArea.linkedTotemId;
        const totemB = toArea.linkedTotemId;
        
        if (totemA && totemB) {
            const key = totemA < totemB ? `${totemA}-${totemB}` : `${totemB}-${totemA}`;
            if (!totemLinksMap[key]) {
                totemLinksMap[key] = { 
                    a: totemA < totemB ? totemA : totemB, 
                    b: totemA < totemB ? totemB : totemA, 
                    links: [] 
                };
            }
            totemLinksMap[key].links.push(totemA);
        }
    }
    
    const totemLinks = Object.values(totemLinksMap);
    
    for (let tl of totemLinks) {
        const tA = state.totems.find(t => t.id === tl.a);
        const tB = state.totems.find(t => t.id === tl.b);
        if (!tA || !tB) continue;
        
        const from = {x: tA.x, y: tA.y};
        const to = {x: tB.x, y: tB.y};
        const total = tl.links.length;
        ctx.save();
        
        if (tA.id === tB.id) {
            ctx.restore();
            continue; // Do not show links that are entirely inside a single totem
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) { ctx.restore(); continue; }
        
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const nx = -dy / dist;
        const ny = dx / dist;
        
        for (let i = 0; i < total; i++) {
            const linkData = tl.links[i];
            const isFromA = (linkData === tA.id);
            
            const sourceTotem = isFromA ? tA : tB;
            const destTotem = isFromA ? tB : tA;
            
            const linkColor = sourceTotem.color || '#4f46e5';

            // To create a cyclic chain, we want each link to bow outward.
            // When total > 1, we stagger the outward bow distance.
            let factor = 0;
            if (total > 1) {
                // Interleave left and right bows: e.g., 1, -1, 2, -2...
                const sign = (i % 2 === 0) ? 1 : -1;
                const mag = Math.ceil(i / 2) || 0.5; // push the first one out a bit if total is exactly 2
                factor = sign * (mag / Math.ceil((total - 1) / 2));
            }
            
            // maxSpread is how far out the arc bows
            const maxSpread = Math.min(dist * 0.4, 250 / state.camera.zoom);
            const spreadAmt = factor * maxSpread;
            
            // control point for quadratic bezier
            const cpX = midX + nx * spreadAmt;
            const cpY = midY + ny * spreadAmt;
            
            // Determine actual start/end based on direction
            const startPt = isFromA ? from : to;
            const endPt = isFromA ? to : from;
            
            ctx.beginPath();
            ctx.moveTo(startPt.x, startPt.y);
            ctx.quadraticCurveTo(cpX, cpY, endPt.x, endPt.y);
            
            ctx.strokeStyle = linkColor;
            ctx.lineWidth = 6 / state.camera.zoom;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            
            ctx.strokeStyle = linkColor;
            ctx.lineWidth = 2 / state.camera.zoom;
            ctx.globalAlpha = 1.0;
            ctx.stroke();
        }
        
        for (const endPos of [from, to]) {
            const tNode = (endPos === from) ? tA : tB;
            ctx.beginPath();
            ctx.arc(endPos.x, endPos.y, 5 / state.camera.zoom, 0, Math.PI * 2);
            ctx.fillStyle = tNode.color || '#4f46e5';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(endPos.x, endPos.y, 2.5 / state.camera.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        ctx.restore();
    }
}
function drawTotems() {
    for (let t of state.totems) {
        // Viewport culling (but never in constellation mode, which deliberately shows all totems).
        if (!state.isConstellationMode && viewBounds &&
            (t.x < viewBounds.minX || t.x > viewBounds.maxX ||
             t.y < viewBounds.minY || t.y > viewBounds.maxY)) {
            continue;
        }
        ctx.save();
        ctx.translate(t.x, t.y);
        
        ctx.fillStyle = t.color || '#3b5a76';
        ctx.beginPath();
        
        ctx.font = `500 ${16 / state.camera.zoom}px Inter, sans-serif`;
        const metrics = ctx.measureText(t.name);
        const padX = 20 / state.camera.zoom;
        const padY = 10 / state.camera.zoom;
        const width = metrics.width + padX * 2;
        const height = (16 / state.camera.zoom) + padY * 2;
        const radius = 8 / state.camera.zoom;
        
        ctx.roundRect(-width/2, -height/2, width, height, radius);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.name, 0, 0);

        ctx.restore();
    }
}

function getTotemInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

// Clamps a screen-space point to the inset viewport rectangle along the ray from the viewport's
// center through that point — the standard "off-screen waypoint" technique. Returns the clamped
// {x,y} plus which edge it hit (for choosing the arrow direction), or null if the viewport is too
// small for the requested margin.
function getOffscreenIndicatorPosition(screenX, screenY, width, height, margin) {
    const cx = width / 2, cy = height / 2;
    const dx = screenX - cx, dy = screenY - cy;
    const halfW = width / 2 - margin, halfH = height / 2 - margin;
    if (halfW <= 0 || halfH <= 0) return null;
    if (dx === 0 && dy === 0) return null;

    const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);

    const direction = (scaleX < scaleY) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    return { x: cx + dx * scale, y: cy + dy * scale, direction };
}

// Off-screen totem direction indicators [REMOVED on 2026-07-22 per user request].
function syncTotemIndicators(width, height) {
    if (totemIndicatorsLayer) totemIndicatorsLayer.innerHTML = '';
}

function getLinkedNotesForProgressBar(drawing) {
    let hitAreas = [];
    for (let area of state.areas) {
        if (area.polygons) {
            for (let p of area.polygons) {
                if (isPointInPolygon({x: drawing.x, y: drawing.y}, p)) {
                    hitAreas.push(area);
                    break;
                }
            }
        }
    }
    let parentArea = null;
    if (hitAreas.length > 0) {
        hitAreas.sort((a, b) => getAreaSize(a) - getAreaSize(b));
        parentArea = hitAreas[0];
    }
    
    let linkedNotes = [];
    if (parentArea) {
        let visited = new Set();
        let queue = [parentArea.id];
        visited.add(parentArea.id);
        
        while (queue.length > 0) {
            let currentId = queue.shift();
            let currentArea = state.areas.find(a => a.id === currentId);
            if (!currentArea) continue;
            
            if (currentArea.isNote && !linkedNotes.some(n => n.id === currentId)) {
                linkedNotes.push(currentArea);
            }
            
            if (currentArea.polygons) {
                for (let innerArea of state.areas) {
                    if (innerArea.isNote && innerArea.id !== currentId && !visited.has(innerArea.id) && innerArea.polygons) {
                        let isInside = false;
                        for (let p of currentArea.polygons) {
                            if (isPointInPolygon(innerArea.polygons[0][0], p)) {
                                isInside = true;
                                break;
                            }
                        }
                        if (isInside) {
                            visited.add(innerArea.id);
                            queue.push(innerArea.id);
                        }
                    }
                }
            }
            
            for (let d of state.drawings) {
                if (d.type === 'line') {
                    let startInCurrent = false;
                    let endInCurrent = false;
                    if (currentArea.polygons) {
                        for (let p of currentArea.polygons) {
                            if (isPointInPolygon(d.start, p)) startInCurrent = true;
                            if (isPointInPolygon(d.end, p)) endInCurrent = true;
                        }
                    }
                    if (startInCurrent !== endInCurrent) {
                        let otherPoint = startInCurrent ? d.end : d.start;
                        for (let otherArea of state.areas) {
                            if (otherArea.id !== currentId && !visited.has(otherArea.id)) {
                                if (otherArea.polygons) {
                                    for (let p of otherArea.polygons) {
                                        if (isPointInPolygon(otherPoint, p)) {
                                            visited.add(otherArea.id);
                                            queue.push(otherArea.id);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if (state.links) {
                for (let link of state.links) {
                    let otherAreaId = null;
                    if (link.fromAreaId === currentId) {
                        otherAreaId = link.toAreaId;
                    } else if (link.toAreaId === currentId) {
                        otherAreaId = link.fromAreaId;
                    }
                    if (otherAreaId && !visited.has(otherAreaId)) {
                        visited.add(otherAreaId);
                        queue.push(otherAreaId);
                    }
                }
            }
        }
        linkedNotes.sort((a, b) => a.id.localeCompare(b.id));
    }
    return { parentArea, linkedNotes };
}

function drawDrawings(filter) {
    for (const drawing of state.drawings) {
        if (!isItemVisibleInContainer(drawing)) continue;
        
        let shouldDraw = false;
        if (filter === 'background') {
            // Draw if locked AND (no areaId OR area doesn't exist)
            if (drawing.isLocked && (!drawing.areaId || !state.areas.some(a => a.id === drawing.areaId))) {
                shouldDraw = true;
            }
        } else if (filter === 'foreground') {
            // Draw if unlocked
            if (!drawing.isLocked) {
                shouldDraw = true;
            }
        } else if (filter.startsWith('area_')) {
            const areaId = filter.replace('area_', '');
            // Draw if locked AND assigned to this area
            if (drawing.isLocked && drawing.areaId === areaId) {
                shouldDraw = true;
            }
        }
        
        if (!shouldDraw) continue;

        // Viewport culling: skip drawings whose (animation-shifted) bbox is off-screen.
        if (!isItemOnScreen(drawing)) continue;

        ctx.save();

        const clippingBox = getClippingScrollBox(drawing);
        if (clippingBox) {
            const corners = getAreaCorners(clippingBox);
            const w = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
            const h = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
            ctx.beginPath();
            ctx.rect(corners.tl.x, corners.tl.y, w, h);
            ctx.clip();
        }

        const offset = getAnimationOffset(drawing);
        if (offset.dx !== 0 || offset.dy !== 0) {
            ctx.translate(offset.dx, offset.dy);
        }
        
        ctx.strokeStyle = drawing.color;
        ctx.fillStyle = drawing.color;
        ctx.lineWidth = 3 / state.camera.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (!drawing.type || drawing.type === 'path') {
            if (!drawing.points || drawing.points.length < 2) {
                ctx.restore();
                continue;
            }
            const minW = 2;
            const maxW = 8;
            
            if (drawing.points.length === 2) {
                ctx.lineWidth = minW + (maxW - minW) * (drawing.points[1].pressure || 0.5);
                ctx.beginPath();
                ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
                ctx.lineTo(drawing.points[1].x, drawing.points[1].y);
                ctx.stroke();
            } else {
                for (let i = 1; i < drawing.points.length - 1; i++) {
                    const p0 = drawing.points[i];
                    const p1 = drawing.points[i + 1];
                    const prevP = drawing.points[i - 1];
                    
                    const prevMid = {
                        x: prevP.x + (p0.x - prevP.x) / 2,
                        y: prevP.y + (p0.y - prevP.y) / 2
                    };
                    const mid = {
                        x: p0.x + (p1.x - p0.x) / 2,
                        y: p0.y + (p1.y - p0.y) / 2
                    };
                    
                    ctx.beginPath();
                    ctx.moveTo(prevMid.x, prevMid.y);
                    ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
                    ctx.lineWidth = minW + (maxW - minW) * (p0.pressure || 0.5);
                    ctx.stroke();
                }
                
                const last = drawing.points[drawing.points.length - 1];
                const secLast = drawing.points[drawing.points.length - 2];
                const finalMid = {
                    x: secLast.x + (last.x - secLast.x) / 2,
                    y: secLast.y + (last.y - secLast.y) / 2
                };
                
                ctx.beginPath();
                ctx.moveTo(finalMid.x, finalMid.y);
                ctx.lineTo(last.x, last.y);
                ctx.lineWidth = minW + (maxW - minW) * (last.pressure || 0.5);
                ctx.stroke();
            }
        } else if (drawing.type === 'text') {
            const baseFontSize = drawing.fontSize || 24;
            const fontFamily = drawing.fontFamily || 'Inter, sans-serif';
            const lines = drawing.text.split('\n');
            const fontStyle = drawing.isItalic ? 'italic ' : '';
            const fontWeight = drawing.isBold ? 'bold ' : '600 ';
            
            // Set explicit text alignment to prevent bleed from other render steps
            ctx.textAlign = drawing.textAlign || 'left';
            ctx.textBaseline = 'top';
            
            // Calculate total height and max width for highlighting/selection
            let totalHeight = 0;
            let maxWidth = 0;
            const processedLines = [];
            
            for (const line of lines) {
                const fs = getLineFontSize(line, baseFontSize);
                ctx.font = `${fontStyle}${fontWeight}${fs}px ${fontFamily}`;
                const textOnly = line.replace(/^(#{1,6})\s*/, '');
                
                if (drawing.width) {
                    const words = textOnly.split(' ');
                    let currentLine = words[0] || '';
                    
                    for (let i = 1; i < words.length; i++) {
                        const word = words[i];
                        const width = ctx.measureText(currentLine + " " + word).width;
                        if (width < drawing.width) {
                            currentLine += " " + word;
                        } else {
                            const mt = ctx.measureText(currentLine);
                            if (mt.width > maxWidth) maxWidth = mt.width;
                            const h = fs * 1.2;
                            processedLines.push({ text: currentLine, fs, h, yOffset: totalHeight });
                            totalHeight += h;
                            currentLine = word;
                        }
                    }
                    if (currentLine) {
                        const mt = ctx.measureText(currentLine);
                        if (mt.width > maxWidth) maxWidth = mt.width;
                        const h = fs * 1.2;
                        processedLines.push({ text: currentLine, fs, h, yOffset: totalHeight });
                        totalHeight += h;
                    }
                } else {
                    const mt = ctx.measureText(textOnly);
                    if (mt.width > maxWidth) maxWidth = mt.width;
                    const h = fs * 1.2;
                    processedLines.push({ text: textOnly, fs, h, yOffset: totalHeight });
                    totalHeight += h;
                }
            }
            
            if (drawing.width) {
                maxWidth = drawing.width;
            }
            
            const textEl = document.getElementById(drawing.id);
            if (textEl) {
                maxWidth = textEl.offsetWidth || maxWidth;
                totalHeight = textEl.offsetHeight || totalHeight;
            }
            
            drawing._calculatedWidth = maxWidth;
            drawing._calculatedHeight = totalHeight;

            const padding = baseFontSize * 0.2;

            if (drawing.highlightColor && drawing.highlightColor !== 'transparent') {
                ctx.fillStyle = drawing.highlightColor;
                ctx.fillRect(drawing.x - padding, drawing.y - padding, maxWidth + padding * 2, totalHeight + padding * 2);
            }
            
            let effectiveIsBgLight = isColorLight(state.fabricColor);
            if (drawing.areaId) {
                const area = state.areas.find(a => a.id === drawing.areaId);
                if (area && area.color !== 'transparent') {
                    effectiveIsBgLight = isColorLight(area.color || '#4f46e5');
                }
            }
            
            if (state.selectedText && state.selectedText.id === drawing.id) {
                ctx.strokeStyle = effectiveIsBgLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2 / state.camera.zoom;
                ctx.setLineDash([6 / state.camera.zoom, 6 / state.camera.zoom]);
                
                const boxX = drawing.x - padding;
                const boxY = drawing.y - padding;
                const boxW = maxWidth + padding * 2;
                const boxH = totalHeight + padding * 2;
                ctx.strokeRect(boxX, boxY, boxW, boxH);
                ctx.setLineDash([]);
                
                // Draw resize handles
                const hw = 4 / state.camera.zoom; // Handle half-width
                let handles = [
                    { id: 'nw', x: boxX, y: boxY, cursor: 'nwse-resize' },
                    { id: 'n',  x: boxX + boxW/2, y: boxY, cursor: 'ns-resize' },
                    { id: 'ne', x: boxX + boxW, y: boxY, cursor: 'nesw-resize' },
                    { id: 'e',  x: boxX + boxW, y: boxY + boxH/2, cursor: 'ew-resize' },
                    { id: 'se', x: boxX + boxW, y: boxY + boxH, cursor: 'nwse-resize' },
                    { id: 's',  x: boxX + boxW/2, y: boxY + boxH, cursor: 'ns-resize' },
                    { id: 'sw', x: boxX, y: boxY + boxH, cursor: 'nesw-resize' },
                    { id: 'w',  x: boxX, y: boxY + boxH/2, cursor: 'ew-resize' }
                ];
                
                if (drawing.type === 'text') {
                    // Texts only resize horizontally
                    handles = [
                        { id: 'e',  x: boxX + boxW, y: boxY + boxH/2, cursor: 'ew-resize', size: 10 },
                        { id: 'w',  x: boxX, y: boxY + boxH/2, cursor: 'ew-resize', size: 10 }
                    ];
                    // Grabbable region spans the full edge, not just the midpoint dot —
                    // makes "click and drag the boundary" actually work anywhere along the side.
                    drawing._resizeBox = { x: boxX, y: boxY, w: boxW, h: boxH };

                    // Highlight the full-height draggable edges so the affordance is visible,
                    // not just two tiny 8px dots.
                    ctx.fillStyle = '#4f46e5';
                    const edgeBarW = 4 / state.camera.zoom;
                    ctx.globalAlpha = 0.55;
                    ctx.fillRect(boxX - edgeBarW / 2, boxY, edgeBarW, boxH);
                    ctx.fillRect(boxX + boxW - edgeBarW / 2, boxY, edgeBarW, boxH);
                    ctx.globalAlpha = 1;
                } else {
                    drawing._resizeBox = null;
                }

                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#4f46e5';
                ctx.lineWidth = 2 / state.camera.zoom;

                drawing._handles = handles.map(h => {
                    ctx.fillRect(h.x - hw, h.y - hw, hw*2, hw*2);
                    ctx.strokeRect(h.x - hw, h.y - hw, hw*2, hw*2);
                    return { ...h, size: hw*2 };
                });
            } else {
                drawing._handles = null;
                drawing._resizeBox = null;
            }
            
            let currentTextColor = drawing.color || (effectiveIsBgLight ? '#111111' : '#ffffff');
            ctx.fillStyle = currentTextColor;
            
            let drawX = drawing.x;
            if (ctx.textAlign === 'center') {
                drawX = drawing.x + maxWidth / 2;
            } else if (ctx.textAlign === 'right') {
                drawX = drawing.x + maxWidth;
            }
            
            const strokeColor = '#000000';
            
            // Render handled by syncTextsDOM (DOM elements)
            ctx.textBaseline = 'alphabetic'; // reset
            ctx.textAlign = 'left'; // reset
        } else if (drawing.type === 'line' || drawing.type === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(drawing.start.x, drawing.start.y);
            ctx.lineTo(drawing.end.x, drawing.end.y);
            ctx.stroke();
            
            if (drawing.type === 'arrow') {
                const angle = Math.atan2(drawing.end.y - drawing.start.y, drawing.end.x - drawing.start.x);
                const headLen = 15 / state.camera.zoom;
                ctx.beginPath();
                ctx.moveTo(drawing.end.x, drawing.end.y);
                ctx.lineTo(drawing.end.x - headLen * Math.cos(angle - Math.PI / 6), drawing.end.y - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(drawing.end.x, drawing.end.y);
                ctx.lineTo(drawing.end.x - headLen * Math.cos(angle + Math.PI / 6), drawing.end.y - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
        } else if (drawing.type === 'rect') {
            const x = Math.min(drawing.start.x, drawing.end.x);
            const y = Math.min(drawing.start.y, drawing.end.y);
            const w = Math.abs(drawing.end.x - drawing.start.x);
            const h = Math.abs(drawing.end.y - drawing.start.y);
            ctx.strokeRect(x, y, w, h);
        } else if (drawing.type === 'circle') {
            const radius = Math.hypot(drawing.end.x - drawing.start.x, drawing.end.y - drawing.start.y) / 2;
            const cx = (drawing.start.x + drawing.end.x) / 2;
            const cy = (drawing.start.y + drawing.end.y) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (drawing.type === 'progress_bar') {
            const { parentArea, linkedNotes } = getLinkedNotesForProgressBar(drawing);

            let progressPct = 0;
            let noteName = "no progress to show";
            let trackedStr = "";
            let hasProgress = false;

            if (parentArea && linkedNotes.length > 0) {

                    // Find all progress bars in this parent area
                    let peerBars = state.drawings.filter(d => {
                        if (d.type !== 'progress_bar') return false;
                        let inParent = false;
                        if (parentArea.polygons) {
                            for (let p of parentArea.polygons) {
                                if (isPointInPolygon({x: d.x, y: d.y}, p)) inParent = true;
                            }
                        }
                        return inParent;
                    });
                    
                    // Sort peer bars vertically
                    peerBars.sort((a, b) => a.y - b.y);
                    
                    let myIndex = peerBars.findIndex(b => b.id === drawing.id);
                    
                    let targetNotes = [];
                    if (drawing.targetNoteId) {
                        let n = linkedNotes.find(n => n.id === drawing.targetNoteId);
                        if (n) targetNotes.push(n);
                    }
                    if (targetNotes.length === 0) {
                        if (peerBars.length === 1) {
                            targetNotes = linkedNotes;
                        } else {
                            let n = myIndex < linkedNotes.length ? linkedNotes[myIndex] : linkedNotes[linkedNotes.length - 1];
                            if (n) targetNotes.push(n);
                        }
                    }
                    
                    if (targetNotes.length > 0) {
                        let checked = 0;
                        let total = 0;
                        let noteNames = [];
                        for (let n of targetNotes) {
                            let text = n.textContent || "";
                            let checkedMatches = text.match(/-\s*\[x\]/gi) || [];
                            let uncheckedMatches = text.match(/-\s*\[\s\]/gi) || [];
                            checked += checkedMatches.length;
                            total += checkedMatches.length + uncheckedMatches.length;
                            if (n.name) noteNames.push(n.name);
                        }
                        
                        if (total > 0) {
                            progressPct = checked / total;
                            trackedStr = `( Completed ${checked}/${total} )`;
                        }
                        if (targetNotes.length === 1) {
                            noteName = noteNames[0] || "Task";
                        } else {
                            noteName = "Network Progress";
                        }
                        hasProgress = true;
                    }
                }
                
            // Handle smooth animation
            if (hasProgress) {
                if (typeof drawing.animatedProgress === 'undefined') {
                    drawing.animatedProgress = progressPct;
                } else if (Math.abs(drawing.animatedProgress - progressPct) > 0.005) {
                    drawing.animatedProgress += (progressPct - drawing.animatedProgress) * 0.1;
                    // Keep animating
                    scheduleRender();
                } else {
                    drawing.animatedProgress = progressPct;
                }
            } else {
                drawing.animatedProgress = 0;
            }

            // Draw progress bar visually
            let w = drawing.width;
            let h = drawing.height;
            let rx = 10; // corner radius
            
            // Draw background track (blue-gray)
            ctx.fillStyle = '#47637f';
            ctx.beginPath();
            ctx.roundRect(drawing.x, drawing.y, w, h, rx);
            ctx.fill();

            // Draw filled bar (green)
            if (hasProgress && drawing.animatedProgress > 0) {
                ctx.fillStyle = '#78b14e';
                ctx.beginPath();
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(drawing.x, drawing.y, w * Math.max(drawing.animatedProgress, 0.05), h, rx); // ensure minimum visible width
                ctx.clip();
                
                ctx.beginPath();
                ctx.roundRect(drawing.x, drawing.y, w, h, rx);
                ctx.fill();
                ctx.restore();
            }

            // Draw texts
            ctx.fillStyle = '#ffffff';
            ctx.font = `italic 14px "Inter", sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            let titleText = hasProgress ? `${noteName} ${trackedStr}` : noteName;
            ctx.fillText(titleText, drawing.x, drawing.y - 8);

            if (hasProgress) {
                ctx.textAlign = 'right';
                ctx.font = `italic 14px "Inter", sans-serif`;
                ctx.fillText(`${Math.round(drawing.animatedProgress * 100)} %`, drawing.x + w, drawing.y - 8);
            }

            // Draw Selection Outline if selected
            if (state.selectedDrawings.has(drawing.id)) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 / state.camera.zoom;
                ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
                ctx.strokeRect(drawing.x - 5, drawing.y - 25, w + 10, h + 30);
                ctx.setLineDash([]);
            }
        } else if (drawing.type === 'clock') {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const date = String(now.getDate()).padStart(2, '0');
            const month = monthNames[now.getMonth()];
            
            const timeStr = `${hrs} : ${mins} : ${secs} | ${date} ${month}`;
            
            const fontSize = Math.max(10, Math.min(drawing.height * 0.6, drawing.width * 0.15));
            ctx.fillStyle = drawing.textColor || state.areaColor;
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeStr, drawing.x + drawing.width / 2, drawing.y + drawing.height / 2);
        }
        
        ctx.restore();
    }
}

function isColorLight(color) {
    if (!color || color === 'transparent') return false;
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
}

function hexToHSL(H) {
    let hex = H.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return {h:0, s:0, l:0};
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0, s = 0, l = 0;
    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return {h, s, l};
}

function HSLToHex(h,s,l) {
    s /= 100; l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c/2, r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);
    if (r.length == 1) r = "0" + r;
    if (g.length == 1) g = "0" + g;
    if (b.length == 1) b = "0" + b;
    return "#" + r + g + b;
}

function getThemeAdjustedAreaColor(hex, isBgLight) {
    if (!isBgLight || !hex || hex === 'transparent') return hex;
    const hsl = hexToHSL(hex);
    let newS = Math.max(hsl.s, 95);
    let newL = Math.min(Math.max(hsl.l, 60), 80);
    if (hsl.s < 10) { newS = 0; newL = 85; } // Grayscale handling
    return HSLToHex(hsl.h, newS, newL);
}

function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
        return 'rgba(0, 0, 0, 0)'; // fallback for invalid/undefined hex
    }
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Blends fgHex toward bgHex by (1 - ratio), returning an OPAQUE rgb() string. Used to approximate
// what a translucent fgHex-over-bgHex fill would look like, as a single flat color with no actual
// alpha compositing — e.g. for the 'efficient' graphics preset, where areas render fully opaque.
function blendHexColors(bgHex, fgHex, ratio) {
    if (!bgHex || typeof bgHex !== 'string' || !bgHex.startsWith('#') ||
        !fgHex || typeof fgHex !== 'string' || !fgHex.startsWith('#')) {
        return fgHex || '#000000';
    }
    const bgR = parseInt(bgHex.slice(1, 3), 16), bgG = parseInt(bgHex.slice(3, 5), 16), bgB = parseInt(bgHex.slice(5, 7), 16);
    const fgR = parseInt(fgHex.slice(1, 3), 16), fgG = parseInt(fgHex.slice(3, 5), 16), fgB = parseInt(fgHex.slice(5, 7), 16);
    const r = Math.round(bgR + (fgR - bgR) * ratio);
    const g = Math.round(bgG + (fgG - bgG) * ratio);
    const b = Math.round(bgB + (fgB - bgB) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
}

function handleBookUIClick(area, pos) {
    if (!area.titles || area.titles.length === 0) return false;
    
    const bbox = getAreaBBox(area);
    const activeTitle = area.titles.find(t => t.id === area.activeTitleId) || area.titles[0];
    const fontSize = 28;
    const padY = 24;
    
    const titleText = activeTitle.name;
    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(titleText).width;
    ctx.restore();
    
    const midX = (bbox.minX + bbox.maxX) / 2;
    const midY = bbox.minY + padY + fontSize / 2;
    const arrowDist = textWidth / 2 + 24;
    
    // Check < arrow
    if (Math.hypot(pos.x - (midX - arrowDist), pos.y - midY) < 20) {
        // Previous page
        const pIdx = activeTitle.pages.indexOf(area.activePageId);
        if (pIdx > 0) {
            area.activePageId = activeTitle.pages[pIdx - 1];
            recalculateItemLinks();
        }
        area.glowArrow = '<';
        area.glowTime = Date.now();
        setTimeout(() => scheduleRender(), 200);
        return true;
    }
    
    // Check > arrow
    if (Math.hypot(pos.x - (midX + arrowDist), pos.y - midY) < 20) {
        // Next page, or add page
        const pIdx = activeTitle.pages.indexOf(area.activePageId);
        if (pIdx < activeTitle.pages.length - 1) {
            area.activePageId = activeTitle.pages[pIdx + 1];
        } else {
            // Add new page
            const newPageId = 'page_' + Date.now();
            activeTitle.pages.push(newPageId);
            area.activePageId = newPageId;
        }
        recalculateItemLinks();
        area.glowArrow = '>';
        area.glowTime = Date.now();
        setTimeout(() => scheduleRender(), 200);
        return true;
    }
    
    // Check Tabs
    let tabY = bbox.minY + 40;
    const tabWidth = 40;
    const tabHeight = 120;
    const tabSpacing = 4;
    
    for (let i = 0; i < area.titles.length; i++) {
        const title = area.titles[i];
        const isActive = title.id === area.activeTitleId;
        const outdent = isActive ? 12 : 0;
        
        if (pos.x >= bbox.maxX - 5 && pos.x <= bbox.maxX - 5 + tabWidth + outdent &&
            pos.y >= tabY && pos.y <= tabY + tabHeight) {
            area.activeTitleId = title.id;
            area.activePageId = title.pages[0] || ('page_' + Date.now());
            if (!title.pages.length) title.pages.push(area.activePageId);
            recalculateItemLinks();
            return true;
        }
        tabY += tabHeight + tabSpacing;
    }
    
    // Check + button
    const plusBtnSize = 32;
    if (pos.x >= bbox.maxX + 4 && pos.x <= bbox.maxX + 4 + plusBtnSize &&
        pos.y >= tabY && pos.y <= tabY + plusBtnSize) {
        
        const newTitleId = 'title_' + Date.now();
        const newPageId = 'page_' + Date.now();
        area.titles.push({
            id: newTitleId,
            name: `TITLE ${area.titles.length + 1}`,
            pages: [newPageId]
        });
        area.activeTitleId = newTitleId;
        area.activePageId = newPageId;
        recalculateItemLinks();
        return true;
    }
    
    return false;
}

function drawBookUI(area, bbox, isBgLight, adjustedColor) {
    if (!area.titles || area.titles.length === 0) return;
    
    const activeTitle = area.titles.find(t => t.id === area.activeTitleId) || area.titles[0];
    if (!activeTitle) return;
    
    const fontSize = 28;
    const padY = 24;
    
    ctx.save();
    
    // Draw horizontal separator line
    const lineY = bbox.minY + padY + fontSize + 20;
    ctx.beginPath();
    ctx.moveTo(bbox.minX + 24, lineY);
    ctx.lineTo(bbox.maxX - 24, lineY);
    ctx.strokeStyle = isBgLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5 / state.camera.zoom;
    ctx.stroke();
    
    // Draw Title Text
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = isBgLight ? '#111111' : '#ffffff'; 
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    const titleText = activeTitle.name;
    const textWidth = ctx.measureText(titleText).width;
    const midX = (bbox.minX + bbox.maxX) / 2;
    const midY = bbox.minY + padY + fontSize / 2;
    
    ctx.fillText(titleText, midX, midY);
    
    // Draw < and > arrows
    const arrowDist = textWidth / 2 + 24;
    const arrowSize = 14;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const now = Date.now();
    const glowActive = (area.glowTime && (now - area.glowTime) < 200);

    // < (Prev Page)
    ctx.strokeStyle = isBgLight ? '#111111' : '#ffffff';
    ctx.lineWidth = 2.5 / state.camera.zoom;
    if (glowActive && area.glowArrow === '<') {
        ctx.shadowColor = isBgLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 10 / state.camera.zoom;
        ctx.strokeStyle = isBgLight ? '#000000' : '#ffffff';
        ctx.lineWidth = 4 / state.camera.zoom;
    }
    
    ctx.beginPath();
    ctx.moveTo(midX - arrowDist, midY - arrowSize/2);
    ctx.lineTo(midX - arrowDist - arrowSize/2, midY);
    ctx.lineTo(midX - arrowDist, midY + arrowSize/2);
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // > (Next Page)
    ctx.strokeStyle = isBgLight ? '#111111' : '#ffffff';
    ctx.lineWidth = 2.5 / state.camera.zoom;
    if (glowActive && area.glowArrow === '>') {
        ctx.shadowColor = isBgLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 10 / state.camera.zoom;
        ctx.strokeStyle = isBgLight ? '#000000' : '#ffffff';
        ctx.lineWidth = 4 / state.camera.zoom;
    }
    
    ctx.beginPath();
    ctx.moveTo(midX + arrowDist, midY - arrowSize/2);
    ctx.lineTo(midX + arrowDist + arrowSize/2, midY);
    ctx.lineTo(midX + arrowDist, midY + arrowSize/2);
    ctx.stroke();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    if (glowActive) scheduleRender();
    
    // Draw Page Counter
    const pIdx = activeTitle.pages.indexOf(area.activePageId) + 1;
    const pTotal = activeTitle.pages.length;
    const counterText = `${pIdx} / ${pTotal}`;
    
    ctx.font = `500 14px Inter, sans-serif`;
    ctx.fillStyle = isBgLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(counterText, midX + arrowDist + 24, midY);
    
    // Draw Tabs on the right edge
    let tabY = bbox.minY + 40;
    const tabWidth = 40;
    const tabHeight = 120;
    const tabSpacing = 4;
    
    area.titles.forEach((title, idx) => {
        const isActive = title.id === area.activeTitleId;
        const outdent = isActive ? 12 : 0;
        
        // Alternate colors for tabs
        const colors = ['#3b82f6', '#facc15', '#ef4444', '#10b981', '#a855f7'];
        const tabColor = isActive ? adjustedColor : colors[idx % colors.length];
        
        ctx.fillStyle = tabColor;
        
        // Tab shape
        ctx.beginPath();
        ctx.roundRect(bbox.maxX - 5, tabY, tabWidth + outdent, tabHeight, [0, 8, 8, 0]);
        
        // Add shadow for tabs
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 8 / state.camera.zoom;
        ctx.shadowOffsetX = 4 / state.camera.zoom;
        ctx.fill();
        ctx.shadowColor = 'transparent'; // reset
        
        // Draw tab text (rotated)
        ctx.save();
        ctx.translate(bbox.maxX - 5 + (tabWidth + outdent)/2, tabY + tabHeight/2);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = (tabColor === '#facc15') ? '#111111' : '#ffffff';
        ctx.font = `600 14px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title.name, 0, 0);
        ctx.restore();
        
        tabY += tabHeight + tabSpacing;
    });
    
    // Draw + button below tabs
    const plusBtnSize = 32;
    ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bbox.maxX + 4, tabY, plusBtnSize, plusBtnSize, 6);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 / state.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(bbox.maxX + 4 + plusBtnSize/2, tabY + 8);
    ctx.lineTo(bbox.maxX + 4 + plusBtnSize/2, tabY + plusBtnSize - 8);
    ctx.moveTo(bbox.maxX + 4 + 8, tabY + plusBtnSize/2);
    ctx.lineTo(bbox.maxX + 4 + plusBtnSize - 8, tabY + plusBtnSize/2);
    ctx.stroke();
    
    ctx.restore();
}

function drawAreas() {
    const isBgLight = isColorLight(state.fabricColor);
    
    // Ensure bgCanvas is correctly sized
    if (bgCanvas.width !== canvas.width || bgCanvas.height !== canvas.height) {
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
    }
    
    for (const area of state.areas) {
        if (!isItemVisibleInContainer(area)) continue;

        // Viewport culling: skip areas whose (animation-shifted) bbox is off-screen.
        // Folders draw a fixed 120×90 shape from the polygon's top-left, so widen the
        // measured bbox to at least that size before testing.
        {
            let abb = getRenderBBox(area);
            if (abb) {
                if (area.isFolder) {
                    abb = { minX: abb.minX, minY: abb.minY,
                            maxX: Math.max(abb.maxX, abb.minX + 120),
                            maxY: Math.max(abb.maxY, abb.minY + 90) };
                }
                const aoff = getAnimationOffset(area);
                if (aoff.dx !== 0 || aoff.dy !== 0) {
                    abb = { minX: abb.minX + aoff.dx, minY: abb.minY + aoff.dy,
                            maxX: abb.maxX + aoff.dx, maxY: abb.maxY + aoff.dy };
                }
                if (!isBBoxOnScreen(abb) && !areaOwnsVisibleLink(area)) continue;
            }
        }

        const clippingBox = getClippingScrollBox(area);
        if (clippingBox) {
            ctx.save();
            const corners = getAreaCorners(clippingBox);
            const w = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
            const h = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
            ctx.beginPath();
            ctx.rect(corners.tl.x, corners.tl.y, w, h);
            ctx.clip();
        }
        
        const offset = getAnimationOffset(area);
        const hasOffset = offset.dx !== 0 || offset.dy !== 0;
        
        if (hasOffset) {
            ctx.save();
            ctx.translate(offset.dx, offset.dy);
        }

        if (area.isFolder) {
            ctx.save();
            let p = area.polygons[0];
            let minX = p[0].x, minY = p[0].y, maxX = p[2].x, maxY = p[2].y;
            let w = maxX - minX;
            let h = maxY - minY;
            
            // Draw a fixed size folder shape
            let fw = 120;
            let fh = 90;
            let tabW = fw * 0.4;
            let tabH = fh * 0.15;
            let radius = 6;
            
            let cMaxX = minX + fw;
            let cMaxY = minY + fh;
            
            ctx.beginPath();
            ctx.moveTo(minX + radius, minY + tabH);
            ctx.lineTo(minX + tabW - radius, minY + tabH);
            ctx.quadraticCurveTo(minX + tabW, minY + tabH, minX + tabW + 5, minY + tabH - 5);
            ctx.lineTo(minX + tabW + tabH - 5, minY + 5);
            ctx.quadraticCurveTo(minX + tabW + tabH, minY, minX + tabW + tabH + radius, minY);
            ctx.lineTo(cMaxX - radius, minY);
            ctx.quadraticCurveTo(cMaxX, minY, cMaxX, minY + radius);
            ctx.lineTo(cMaxX, cMaxY - radius);
            ctx.quadraticCurveTo(cMaxX, cMaxY, cMaxX - radius, cMaxY);
            ctx.lineTo(minX + radius, cMaxY);
            ctx.quadraticCurveTo(minX, cMaxY, minX, cMaxY - radius);
            ctx.lineTo(minX, minY + tabH + radius);
            ctx.quadraticCurveTo(minX, minY + tabH, minX + radius, minY + tabH);
            
            ctx.fillStyle = area.color || '#60a5fa';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw Folder icon/name
            ctx.fillStyle = isColorLight(area.color || '#60a5fa') ? '#000000' : '#ffffff';
            ctx.font = '500 14px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Ellipsis for long names
            let name = area.name;
            const maxWidth = fw - 16; // 8px padding on both sides
            if (ctx.measureText(name).width > maxWidth) {
                while (name.length > 0 && ctx.measureText(name + '...').width > maxWidth) {
                    name = name.slice(0, -1);
                }
                name += '...';
            }
            
            ctx.fillText(name, minX + fw/2, minY + fh/2);
            
            // Show badge for number of items
            const folderFiles = state.files.filter(f => f.areaId === area.id);
            if (folderFiles.length > 0) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(cMaxX, minY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 11px Inter';
                ctx.fillText(folderFiles.length.toString(), cMaxX, minY);
            }
            ctx.restore();
            if (hasOffset) ctx.restore();
            if (clippingBox) ctx.restore();
            continue;
        }

        // Capture the canvas BEFORE drawing this area so it includes previously drawn areas
        ctx.save();
        ctx.resetTransform();
        if (canvas.width > 0 && canvas.height > 0) {
            bgCtx.drawImage(canvas, 0, 0);
        }
        ctx.restore();

        const isSelected = area.id === state.selectedAreaId;
        const adjustedColor = getThemeAdjustedAreaColor(area.color || '#4f46e5', isBgLight);
        const bbox = getAreaBBox(area);
        
        // Detect if this is a simple rectangle (single polygon with 4 axis-aligned points)
        const polys = area.polygons || (area.points ? [area.points] : []);
        const isRect = polys.length === 1 && polys[0].length === 4;
        const cornerRadius = 24;
        
        if (area.type === 'dashboard_box') {
            ctx.save();
            ctx.beginPath();
            if (isRect) {
                ctx.roundRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 16);
            } else {
                for (const poly of polys) {
                    if (poly.length < 3) continue;
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let pt of poly) ctx.lineTo(pt.x, pt.y);
                    ctx.closePath();
                }
            }
            ctx.fillStyle = area.color || '#2a2a2a'; 
            ctx.fill();
            ctx.strokeStyle = '#3d3d3d';
            ctx.lineWidth = 1 / state.camera.zoom;
            ctx.stroke();
            ctx.restore();

            if (isSelected) {
                ctx.save();
                ctx.beginPath();
                if (isRect) {
                    ctx.roundRect(bbox.minX - 4/state.camera.zoom, bbox.minY - 4/state.camera.zoom, bbox.maxX - bbox.minX + 8/state.camera.zoom, bbox.maxY - bbox.minY + 8/state.camera.zoom, 20);
                }
                ctx.strokeStyle = '#4f46e5';
                ctx.lineWidth = 2 / state.camera.zoom;
                ctx.stroke();
                ctx.restore();
            }
            
            drawDrawings('area_' + area.id);
        } else {
        
        // ── CLIP AND BLUR BACKGROUND ──
        ctx.save();
        ctx.beginPath();
        if (isRect) {
            ctx.roundRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, cornerRadius);
        } else {
            for (const poly of polys) {
                if (poly.length < 3) continue;
                ctx.moveTo(poly[0].x, poly[0].y);
                for (let pt of poly) ctx.lineTo(pt.x, pt.y);
                ctx.closePath();
            }
        }
        
        // Add drop shadow only in light mode before clipping
        if (isBgLight) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
            ctx.shadowBlur = 32 / state.camera.zoom;
            ctx.shadowOffsetY = 12 / state.camera.zoom;
            ctx.fillStyle = '#ffffff'; 
            ctx.fill('nonzero');
            ctx.restore();
        }
        
        // Apply clip to constrain the blur to the area's shape
        ctx.clip('nonzero');
        
        // Draw the background snapshot with a milder blur so dots are still visible.
        // PERF: this runs once PER area, every frame. A canvas blur() processes every pixel
        // of the image it's given, so blurring the FULL canvas per area was the dominant cost
        // (N areas = N full-screen gaussian blurs/frame). We now (a) skip it entirely in the
        // 'efficient' graphics preset, and (b) otherwise blur only the area's on-screen bbox.
        if (state.graphicsPreset !== 'efficient') {
            ctx.save();
            ctx.resetTransform();
            ctx.filter = `blur(8px)`;
            if (bgCanvas.width > 0 && bgCanvas.height > 0) {
                const dpr = window.devicePixelRatio || 1;
                const ox = hasOffset ? offset.dx : 0;
                const oy = hasOffset ? offset.dy : 0;
                const c1 = worldToScreen(bbox.minX + ox, bbox.minY + oy);
                const c2 = worldToScreen(bbox.maxX + ox, bbox.maxY + oy);
                const margin = 24; // CSS px — enough surrounding pixels for the 8px blur at the clip edge
                const sx = Math.max(0, Math.floor((Math.min(c1.x, c2.x) - margin) * dpr));
                const sy = Math.max(0, Math.floor((Math.min(c1.y, c2.y) - margin) * dpr));
                const ex = Math.min(bgCanvas.width, Math.ceil((Math.max(c1.x, c2.x) + margin) * dpr));
                const ey = Math.min(bgCanvas.height, Math.ceil((Math.max(c1.y, c2.y) + margin) * dpr));
                const sw = ex - sx, sh = ey - sy;
                if (sw > 0 && sh > 0) {
                    // The clip (in device space) still masks output to the area shape, so drawing
                    // a superset rectangle is pixel-identical to the old full-screen draw.
                    ctx.drawImage(bgCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
                }
            }
            ctx.restore();
        }
        
        // ── FILL ──
        // blendRatio is what alpha would be for a normal translucent fill over the fabric
        // background. In efficient mode we pre-blend that same ratio into a single flat OPAQUE
        // color instead of using real alpha — this keeps the same muted tone the translucent fill
        // would have produced (rather than the raw, much brighter area color), while still being
        // fully opaque: nothing shows through underneath, and drawGrid() can skip covered dots
        // entirely instead of rendering them just to be painted over.
        let blendRatio = isSelected ? 0.35 : 0.25;
        if (isBgLight) {
            blendRatio = isSelected ? 0.55 : 0.45;
        }

        if (state.graphicsPreset === 'efficient') {
            ctx.fillStyle = blendHexColors(state.fabricColor, adjustedColor, blendRatio);
        } else {
            ctx.fillStyle = hexToRgba(adjustedColor, blendRatio);
        }
        ctx.fill('nonzero');
        ctx.restore(); // remove clip
        
        // Reset shadow for stroke
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        const grad = ctx.createLinearGradient(bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        grad.addColorStop(0.5, hexToRgba(adjustedColor, 0.5));
        grad.addColorStop(1, hexToRgba(adjustedColor, 1.0));
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = (isSelected ? 3 : 2) / state.camera.zoom;
        ctx.setLineDash([]);
        ctx.stroke();
        
        if (area.isScrollBox) {
            ctx.save();
            ctx.strokeStyle = isBgLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1 / state.camera.zoom;
            ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
            ctx.strokeRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
            ctx.restore();
        }
        
        // Draw locked items belonging to this area immediately so subsequent areas can correctly blur them!
        drawDrawings('area_' + area.id);
        }
        
        // ── NAME BADGE OR TITLE ──
        if (bbox.minX !== Infinity) {
            
        if (area.isFolder) return false;

        if (area.isBook) {
                drawBookUI(area, bbox, isBgLight, adjustedColor);
            } else if (area.isNote) {
                const fontSize = 18;
                const padX = 24;
                const padY = 20;
                ctx.font = `500 ${fontSize}px Inter, sans-serif`;
                ctx.fillStyle = isBgLight ? '#111111' : '#ffffff'; 
                ctx.textBaseline = 'top';
                ctx.fillText(area.name, bbox.minX + padX, bbox.minY + padY);
                
                // Draw horizontal separator line
                const lineY = bbox.minY + padY + fontSize + 14;
                ctx.beginPath();
                ctx.moveTo(bbox.minX + padX, lineY);
                ctx.lineTo(bbox.maxX - padX, lineY);
                ctx.strokeStyle = isBgLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1.5 / state.camera.zoom;
                ctx.setLineDash([]);
                ctx.stroke();
                
                ctx.textBaseline = 'alphabetic'; // reset
            } else {
                const fontSize = 14;
                const padX = 12;
                const padY = 6;
                const badgeRadius = 6;
                const badgeH = fontSize + padY * 2;
                
                ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                
                // Position inside top-left with more padding
                const badgeX = bbox.minX + 28;
                const badgeY = bbox.minY + 28;
                
                // Badge background
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, ctx.measureText(area.name).width + padX * 2, badgeH, badgeRadius);
                ctx.fillStyle = isBgLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)';
                ctx.fill();
                
                // Badge text
                ctx.fillStyle = isBgLight ? '#ffffff' : '#111111';
                ctx.textBaseline = 'middle';
                ctx.fillText(area.name, badgeX + padX, badgeY + badgeH / 2);
                ctx.textBaseline = 'alphabetic'; // reset
            }
        }

        // ── CORNER HOLES (only for non-shelf areas) ──
        if (!area.isBook && !area.isScrollBox) {
            const corners = getAreaCorners(area);
            const holeRadius = 5;
            const isLinkMode = state.mode === 'line';
            
            for (const [, pos] of Object.entries(corners)) {
                // Glow ring when in link mode
                if (isLinkMode) {
                    const glowRadius = holeRadius * 2.2;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba(area.color, 0.25);
                    ctx.fill();
                }
                // Outer colored ring
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, holeRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#0d0d0d';
                ctx.fill();
                ctx.strokeStyle = area.color;
                ctx.lineWidth = isLinkMode ? 2 : 1.5;
                ctx.setLineDash([]);
                ctx.stroke();
                // White inner dot
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, holeRadius * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fill();
            }
        }
        
        // ── DYNAMIC LINK DRAWING ──
        // Draw any links where this area is the highest-z-index connected area.
        // This ensures the link is drawn ON TOP of this area (and the other connected area),
        // but BEHIND any areas drawn after this one.
        // Get the index of the current area in state.areas
        const currentIdx = state.areas.indexOf(area);
        const linksForThisLayer = state.links.filter(link => {
            const fromIdx = state.areas.findIndex(a => a.id === link.fromAreaId);
            const toIdx = state.areas.findIndex(a => a.id === link.toAreaId);
            return Math.max(fromIdx, toIdx) === currentIdx;
        });
        
        if (linksForThisLayer.length > 0) {
            drawLinks(linksForThisLayer);
        }
        
        if (hasOffset) {
            ctx.restore();
        }
        
        if (clippingBox) {
            ctx.restore();
        }
    }
}

// ===== LINK LINES =====
function drawLinks(linksToDraw = state.links) {
    if (!linksToDraw || linksToDraw.length === 0) return;

    for (const link of linksToDraw) {
        const fromArea = state.areas.find(a => a.id === link.fromAreaId);
        const toArea   = state.areas.find(a => a.id === link.toAreaId);
        if (!fromArea || !toArea) continue;

        const from = getAreaCorners(fromArea)[link.fromCorner];
        const to   = getAreaCorners(toArea)[link.toCorner];
        if (!from || !to) continue;

        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const offset = Math.min(dist * 0.45, 120 / state.camera.zoom);
        const fromIsRight = link.fromCorner.includes('r');
        const toIsLeft    = link.toCorner.includes('l');
        const cp1x = from.x + (fromIsRight ? offset : -offset);
        const cp1y = from.y;
        const cp2x = to.x + (toIsLeft ? -offset : offset);
        const cp2y = to.y;

        // ── FIND UNLINKED INTERSECTING AREAS ──
        // Three cases for a non-endpoint area X whose bbox overlaps the curve:
        //  1. X contains BOTH endpoints (a shared container/ancestor of the whole link) — don't
        //     occlude at all. Both linked areas are "inside" X, so the connection should read
        //     clearly, not tunnel behind glass. Rule: "two areas inside the same area should be
        //     seen connecting."
        //  2. X contains exactly ONE endpoint (it's that endpoint's own parent/container) — fully
        //     hide the line within X (no blur-peek). The line is genuinely behind that area's own
        //     frame. Rule: "an area on top of the linkage should always be on top, line goes from
        //     behind the area."
        //  3. X contains neither endpoint (an unrelated area the curve incidentally crosses) — keep
        //     the existing soft blurred/dimmed "tunnel" look, since it's not part of the link's own
        //     nesting story.
        const linkBBox = getBezierBBox(from, {x: cp1x, y: cp1y}, {x: cp2x, y: cp2y}, to);

        // Viewport culling: skip links whose entire curve is off-screen.
        if (!isBBoxOnScreen(linkBBox)) continue;

        const hiddenAreas = [];   // case 2: fully occluded, no blur pass
        const tunnelAreas = [];   // case 3: clipped from the sharp line, shown blurred/dimmed instead

        for (const area of state.areas) {
            if (area.id === link.fromAreaId || area.id === link.toAreaId) {
                // EXCEPT if this endpoint is fully inside the other endpoint
                const otherAreaId = (area.id === link.fromAreaId) ? link.toAreaId : link.fromAreaId;
                const otherArea = state.areas.find(a => a.id === otherAreaId);

                if (otherArea) {
                    const areaBBox = getAreaBBox(area);
                    const otherBBox = getAreaBBox(otherArea);
                    if (areaBBox.minX >= otherBBox.minX && areaBBox.maxX <= otherBBox.maxX &&
                        areaBBox.minY >= otherBBox.minY && areaBBox.maxY <= otherBBox.maxY) {
                        const polys = area.polygons || (area.points ? [area.points] : []);
                        if (polys.length > 0) tunnelAreas.push({area, polys, areaBBox});
                    }
                }
                continue;
            }

            const areaBBox = getAreaBBox(area);
            if (!bboxOverlap(areaBBox, linkBBox)) continue;
            const polys = area.polygons || (area.points ? [area.points] : []);
            if (polys.length === 0) continue;

            let containsFrom = false, containsTo = false;
            for (const poly of polys) {
                if (!containsFrom && isPointInPolygon(from, poly)) containsFrom = true;
                if (!containsTo && isPointInPolygon(to, poly)) containsTo = true;
            }

            if (containsFrom && containsTo) continue; // case 1: shared container, don't occlude
            if (containsFrom || containsTo) {
                hiddenAreas.push({area, polys, areaBBox}); // case 2: direct parent of one endpoint
            } else {
                tunnelAreas.push({area, polys, areaBBox}); // case 3: incidental crossing
            }
        }

        const allOccluders = [...hiddenAreas, ...tunnelAreas];

        // ── CLIP OUT OCCLUDING AREAS FOR SOLID LINE ──
        // IMPORTANT: subtract each occluder with its OWN separate clip() call (intersected with
        // the running clip region) rather than combining all of their paths into a single
        // evenodd path. evenodd works by *counting* path crossings — if one occluder (e.g. "asd")
        // is nested inside another (e.g. "ert"), a point inside the inner one is crossed by the
        // outer rect + "ert"'s boundary + "asd"'s boundary = 3 (odd) crossings, which evenodd
        // reads as "inside the visible region" again, undoing the outer exclusion. Chaining
        // individual clip() calls instead performs true set intersection — "not A" AND "not B" —
        // which is correct regardless of whether the occluders are nested or overlapping.
        ctx.save();
        for (const intersection of allOccluders) {
            ctx.beginPath();
            ctx.rect(state.camera.x - 100000, state.camera.y - 100000, 200000, 200000);
            const isRect = intersection.polys.length === 1 && intersection.polys[0].length === 4;
            if (isRect) {
                const cornerRadius = 24;
                ctx.roundRect(intersection.areaBBox.minX, intersection.areaBBox.minY, intersection.areaBBox.maxX - intersection.areaBBox.minX, intersection.areaBBox.maxY - intersection.areaBBox.minY, cornerRadius);
            } else {
                for (const poly of intersection.polys) {
                    if (poly.length < 3) continue;
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let pt of poly) ctx.lineTo(pt.x, pt.y);
                    ctx.closePath();
                }
            }
            ctx.clip('evenodd');
        }

        // Draw regular sharp line only OUTSIDE unlinked areas
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
        
        ctx.strokeStyle = hexToRgba(fromArea.color || link.color, 0.2);
        ctx.lineWidth = 12 / state.camera.zoom;
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(fromArea.color || link.color, 0.4);
        ctx.lineWidth = 6 / state.camera.zoom;
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(fromArea.color || link.color, 0.85);
        ctx.lineWidth = 2 / state.camera.zoom;
        ctx.stroke();
        
        ctx.restore();

        // ── DRAW BLURRED LINE INSIDE INCIDENTALLY-CROSSED AREAS ──
        // (hiddenAreas — direct containers of one endpoint — intentionally get no pass here,
        // so the line is fully invisible behind them, not just dimmed.)
        for (const intersection of tunnelAreas) {
            ctx.save();
            ctx.beginPath();
            
            const isRect = intersection.polys.length === 1 && intersection.polys[0].length === 4;
            if (isRect) {
                const cornerRadius = 24;
                ctx.roundRect(intersection.areaBBox.minX, intersection.areaBBox.minY, intersection.areaBBox.maxX - intersection.areaBBox.minX, intersection.areaBBox.maxY - intersection.areaBBox.minY, cornerRadius);
            } else {
                for (const poly of intersection.polys) {
                    if (poly.length < 3) continue;
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let pt of poly) ctx.lineTo(pt.x, pt.y);
                    ctx.closePath();
                }
            }
            ctx.clip('nonzero');
            
            // Dimmed/blurred line
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = hexToRgba(fromArea.color || link.color, 0.5);
            ctx.lineWidth = 4 / state.camera.zoom; 
            ctx.filter = `blur(${8 / state.camera.zoom}px)`;
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
            ctx.stroke();
            
            ctx.restore();
        }

        // Draw endpoint dots
        for (const endPos of [from, to]) {
            ctx.beginPath();
            ctx.arc(endPos.x, endPos.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = link.color;
            ctx.fill();
        }
    }
}

function drawCurrentPolygon() {
    if (!state.isDrawing) return;
    
    ctx.strokeStyle = state.areaColor;
    ctx.lineWidth = 3 / state.camera.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (state.mode === 'line' || state.mode === 'arrow') {
        if (state.mode === 'line' && state.linkDraftStart) {
            // Draw a curved bezier preview when dragging from a corner hole
            const from = state.shapeStartWorld;
            const toHole = getNearestHole(state.shapeEndWorld, 40);
            const to = toHole ? toHole.worldPos : state.shapeEndWorld;
            const dx = to.x - from.x;
            const dist = Math.hypot(dx, to.y - from.y);
            const offset = Math.min(dist * 0.45, 120 / state.camera.zoom);
            const fromIsRight = state.linkDraftStart.corner.includes('r');
            const toIsLeft = toHole ? toHole.corner.includes('l') : !fromIsRight;
            const cp1x = from.x + (fromIsRight ? offset : -offset);
            const cp2x = to.x + (toIsLeft ? -offset : offset);
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.bezierCurveTo(cp1x, from.y, cp2x, to.y, to.x, to.y);
            ctx.strokeStyle = state.areaColor;
            ctx.lineWidth = 2 / state.camera.zoom;
            ctx.setLineDash([6 / state.camera.zoom, 4 / state.camera.zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            ctx.beginPath();
            ctx.moveTo(state.shapeStartWorld.x, state.shapeStartWorld.y);
            ctx.lineTo(state.shapeEndWorld.x, state.shapeEndWorld.y);
            ctx.stroke();
        }
        if (state.mode === 'arrow') {
            const angle = Math.atan2(state.shapeEndWorld.y - state.shapeStartWorld.y, state.shapeEndWorld.x - state.shapeStartWorld.x);
            const headLen = 15 / state.camera.zoom;
            ctx.beginPath();
            ctx.moveTo(state.shapeEndWorld.x, state.shapeEndWorld.y);
            ctx.lineTo(state.shapeEndWorld.x - headLen * Math.cos(angle - Math.PI / 6), state.shapeEndWorld.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(state.shapeEndWorld.x, state.shapeEndWorld.y);
            ctx.lineTo(state.shapeEndWorld.x - headLen * Math.cos(angle + Math.PI / 6), state.shapeEndWorld.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }
    } else if (state.mode === 'rect' || state.mode === 'book' || state.mode === 'draw-box') {
        const x = Math.min(state.shapeStartWorld.x, state.shapeEndWorld.x);
        const y = Math.min(state.shapeStartWorld.y, state.shapeEndWorld.y);
        const w = Math.abs(state.shapeEndWorld.x - state.shapeStartWorld.x);
        const h = Math.abs(state.shapeEndWorld.y - state.shapeStartWorld.y);
        
        ctx.beginPath();
        if (state.mode === 'draw-box') {
            ctx.rect(x, y, w, h);
            ctx.stroke();
        } else {
            const cr = 12;
            ctx.roundRect(x, y, w, h, cr);
            ctx.stroke();
            ctx.fillStyle = hexToRgba(state.areaColor, 0.15);
            ctx.fill();
        }
    } else if (state.mode === 'circle') {
        const radius = Math.hypot(state.shapeEndWorld.x - state.shapeStartWorld.x, state.shapeEndWorld.y - state.shapeStartWorld.y) / 2;
        const cx = (state.shapeStartWorld.x + state.shapeEndWorld.x) / 2;
        const cy = (state.shapeStartWorld.y + state.shapeEndWorld.y) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawLasso() {
    if ((!state.isDrawingLasso && !state.draggingLasso) || !state.lassoPolygon || state.lassoPolygon.length < 2) return;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(state.lassoPolygon[0].x, state.lassoPolygon[0].y);
    for (let i = 1; i < state.lassoPolygon.length; i++) {
        ctx.lineTo(state.lassoPolygon[i].x, state.lassoPolygon[i].y);
    }
    
    if (state.draggingLasso || (!state.isDrawingLasso && state.lassoPolygon.length > 2)) {
        ctx.closePath();
    }
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / state.camera.zoom;
    ctx.setLineDash([5 / state.camera.zoom, 5 / state.camera.zoom]);
    ctx.stroke();
    
    if (state.draggingLasso || (!state.isDrawingLasso && state.lassoPolygon.length > 2)) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();
    }
    
    ctx.restore();
}

// Coordinate Conversion
function screenToWorld(screenX, screenY) {
    const rect = workspace.getBoundingClientRect();
    // screen relative to center
    const x = screenX - rect.width/2;
    const y = screenY - rect.height/2;
    
    // un-translate then un-scale
    const worldX = (x - state.camera.x) / state.camera.zoom;
    const worldY = (y - state.camera.y) / state.camera.zoom;
    
    return { x: worldX, y: worldY };
}

function worldToScreen(worldX, worldY) {
    const rect = workspace.getBoundingClientRect();
    const screenX = worldX * state.camera.zoom + state.camera.x + rect.width / 2;
    const screenY = worldY * state.camera.zoom + state.camera.y + rect.height / 2;
    return { x: screenX, y: screenY };
}

// ===== SHELF RIBBON MANAGEMENT =====
let pendingBookData = null; // Stores { id, currentPolygon, filesInside, color }





function closeElementsRibbon() {
    elementsRibbonPanel.classList.add('hidden');
    if (['elements', 'place-progress-bar', 'place-clock', 'place-calendar', 'place-dashboard-box', 'place-table', 'place-scroll-box'].includes(state.mode)) {
        state.mode = 'select';
        setMode('select');
    }
}

function closeEraserRibbon() {
    eraserRibbonPanel.classList.add('hidden');
    if (state.mode === 'delete') {
        state.mode = 'select';
        setMode('select');
    }
}




// Obsolete project management removed

// ===== FILE SYSTEM ACCESS API =====
const IDBNAME = 'FileFabricFS';
const IDBSTORE = 'handles';

// IndexedDB helpers to persist directory handles across sessions
function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDBNAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDBSTORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveHandleToDB(handle) {
    const db = await openHandleDB();
    const tx = db.transaction(IDBSTORE, 'readwrite');
    tx.objectStore(IDBSTORE).put(handle, 'targetWorkspace');
    return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
}

async function loadHandleFromDB() {
    const db = await openHandleDB();
    const tx = db.transaction(IDBSTORE, 'readonly');
    const req = tx.objectStore(IDBSTORE).get('targetWorkspace');
    return new Promise((resolve) => { req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null); });
}

// Check if folder is already in use by another session via a lock file
async function isFolderInUse(handle) {
    try {
        const lockFile = await handle.getFileHandle('.fabric_lock', { create: false });
        const file = await lockFile.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        
        // If the lock belongs to this exact tab (preserved across refreshes), it's our lock
        let mySessionId = sessionStorage.getItem('fabric_session_id');
        if (data.pid && data.pid === mySessionId) return false;
        
        // If the lock is stale (older than 30 seconds), it's fine to take over
        if (Date.now() - data.timestamp > 30000) return false;
        
        return true;
    } catch {
        return false; // No lock file means not in use
    }
}

async function writeLockFile(handle) {
    try {
        let mySessionId = sessionStorage.getItem('fabric_session_id');
        if (!mySessionId) {
            mySessionId = Math.random().toString(36).substring(2);
            sessionStorage.setItem('fabric_session_id', mySessionId);
        }
        
        const lockFile = await handle.getFileHandle('.fabric_lock', { create: true });
        const writable = await lockFile.createWritable();
        await writable.write(JSON.stringify({ timestamp: Date.now(), pid: mySessionId }));
        await writable.close();
    } catch (err) {
        console.warn('Could not write lock file:', err);
    }
}

async function removeLockFile(handle) {
    try {
        await handle.removeEntry('.fabric_lock');
    } catch { /* ignore */ }
}

// Keep lock file fresh
let lockInterval = null;
function startLockHeartbeat() {
    if (lockInterval) clearInterval(lockInterval);
    lockInterval = setInterval(() => {
        if (currentFabricHandle) writeLockFile(currentFabricHandle);
    }, 10000); // refresh every 10s
}

// --- Home Screen & Workspace Logic ---

btnOpenWorkspace.onclick = async () => {
    try {
        if (!window.showDirectoryPicker) {
            alert('Your browser does not support the File System Access API. Please use Chrome or Edge on localhost/HTTPS.');
            return;
        }
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (await isFolderInUse(handle)) {
            const override = confirm('Workspace appears to be in use by another session (or a previous crashed session).\n\nTake over anyway?');
            if (!override) return;
        }
        
        targetWorkspaceHandle = handle;
        await saveHandleToDB(handle);
        await writeLockFile(handle);
        startLockHeartbeat();
        
        await initializeWorkspace();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            alert('Error opening workspace: ' + err.message);
        }
    }
};
window.originalBtnOpenWorkspaceClick = btnOpenWorkspace.onclick;

async function initializeWorkspace() {
    workspaceContent.classList.remove('hidden');
    btnOpenWorkspace.classList.add('hidden');
    workspacePathLabel.textContent = `Workspace: ${targetWorkspaceHandle.name}`;
    await loadFabricsGrid();
}

async function loadFabricsGrid() {
    fabricsGrid.innerHTML = '';
    
    // Iterate through all folders in targetWorkspaceHandle
    for await (const entry of targetWorkspaceHandle.values()) {
        if (entry.kind === 'directory') {
            try {
                // Check if it's a valid fabric (contains state.json or fabric.json)
                const dirHandle = await targetWorkspaceHandle.getDirectoryHandle(entry.name);
                let isValid = false;
                try {
                    await dirHandle.getFileHandle('fabric.json');
                    isValid = true;
                } catch (e) {
                    try {
                        await dirHandle.getFileHandle('project.json'); // legacy support
                        isValid = true;
                    } catch (e2) {}
                }
                
                if (isValid) {
                    let thumbUrl = null;
                    try {
                        const thumbHandle = await dirHandle.getFileHandle('thumbnail.jpg');
                        const thumbFile = await thumbHandle.getFile();
                        thumbUrl = URL.createObjectURL(thumbFile);
                    } catch (e) {}

                    const card = document.createElement('div');
                    card.className = 'fabric-card';
                    
                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'fabric-card-icon';
                    iconDiv.innerHTML = thumbUrl ? `<img src="${thumbUrl}" alt="Thumbnail" />` : entry.name.charAt(0).toUpperCase();
                    
                    const optionsBtn = document.createElement('div');
                    optionsBtn.className = 'fabric-card-options-btn';
                    optionsBtn.textContent = '\u22EE';
                    optionsBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        showFabricContextMenu(e.clientX, e.clientY, entry.name);
                    }, true);
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'fabric-card-info';
                    infoDiv.innerHTML = `<h3>${entry.name}</h3><p>Fabric</p>`;
                    
                    card.appendChild(iconDiv);
                    card.appendChild(optionsBtn);
                    card.appendChild(infoDiv);
                    card.addEventListener('click', function(ev) {
                        if (ev.target.closest('.fabric-card-options-btn')) return;
                        openFabric(dirHandle, entry.name);
                    });
                    fabricsGrid.appendChild(card);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }
}

btnNewFabric.addEventListener('click', () => {
    newFabricModal.classList.remove('hidden');
    newFabricName.value = '';
    importFabricFile.value = '';
});

btnCancelFabric.addEventListener('click', () => {
    newFabricModal.classList.add('hidden');
});

btnCreateFabric.addEventListener('click', async () => {
    // Check if importing a file
    if (importFabricFile.files.length > 0) {
        await importOldFabric(importFabricFile.files[0]);
        return;
    }

    const name = newFabricName.value.trim();
    if (!name) {
        alert('Please enter a name for the new project.');
        return;
    }
    
    // Check for conflict
    try {
        await targetWorkspaceHandle.getDirectoryHandle(name);
        alert('A fabric with this name already exists!');
        return;
    } catch (e) {
        // Doesn't exist, which is good
    }
    
    const bgColor = newFabricBg.value;
    await createAndLoadNewFabric(name, bgColor);
});

async function createAndLoadNewFabric(name, bgColor, importState = null) {
    newFabricModal.classList.add('hidden');
    await flushFabricSave(); // a save still waiting is written to its own canvas first
    stateFabricHandle = null;

    // Create folder and sources
    currentFabricHandle = await targetWorkspaceHandle.getDirectoryHandle(name, { create: true });
    currentSourcesHandle = await currentFabricHandle.getDirectoryHandle('sources', { create: true });
    currentFabricName = name;
    
    prepareFabricState(importState, bgColor);
    stateFabricHandle = currentFabricHandle;

    // Save to fabric.json
    await saveCurrentFabric();
    
    // Hide home screen, load canvas
    homeScreen.classList.add('hidden');
    
    render();
}

function prepareFabricState(loadedState = null, bgColor = '#1a1a1a') {
    const s = loadedState || {};
    const d = s.data ? s.data : s;
    
    filesLayer.innerHTML = ''; // clear DOM
    
    state = {
        drawings: d.drawings || [],
        areas: d.areas || [],
        files: d.files || [],
        links: d.links || [],
        totems: d.totems || [],
        tables: d.tables || [],
        sidebarWidgets: d.sidebarWidgets || [],
        calendarSync: d.calendarSync || { viewMonth: new Date().getMonth(), viewYear: new Date().getFullYear(), schedules: {} },
        camera: d.camera || { x: 0, y: 0, zoom: 1 },
        mode: d.mode || 'select',
        toolSettings: d.toolSettings || { color: PRESET_COLORS[11], size: 2 },
        eraserMode: d.eraserMode || 'normal',
        // NOTE: canonical field is `fabricColor` (matches the default state object and every
        // read/write site in the app — drawAreas, drawGrid, render, the color picker, etc).
        // A prior version of this function stored it as `bgColor` instead, which meant
        // state.fabricColor was `undefined` on every loaded fabric (only freshly-created state
        // had it), silently breaking any logic that required a real hex string here.
        fabricColor: d.fabricColor || d.bgColor || bgColor,
        areaColor: d.areaColor || '#4f46e5',
        selectedText: null,
        draggingArea: null,
        dragSetAreas: [],
        dragSetDrawings: [],
        linkDraftStart: null,
        linkAnimOffset: 0,
        selectedDrawings: new Set(),
        selectedAreaId: null,
        isDrawing: false,
        isPanning: false,
        currentPolygon: [],
        shapeStartWorld: {x: 0, y: 0},
        shapeEndWorld: {x: 0, y: 0},
        currentShapeType: null,
        panStart: {x: 0, y: 0},
        dragStartWorld: {x: 0, y: 0},
        marchingAntsOffset: 0,
        draggingText: null,
        draggingTotem: null,
        textStartPos: {x: 0, y: 0}
    };
    
    document.body.style.backgroundColor = state.fabricColor;
    
    // Create DOM elements for files
    for (const fileData of state.files) {
        renderFileItem(fileData);
    }
    
    // Render global shelf files matching active local shelves by name
    const activeBooks = state.areas.filter(a => a.isBook);
    for (const shelf of activeBooks) {
        const bookFiles = globalBookFiles.filter(f => f.bookName === shelf.name);
        for (const fileData of bookFiles) {
            fileData.areaId = shelf.id;
            fileData.areaName = shelf.name;
            renderFileItem(fileData);
        }
    }
}

async function importOldFabric(file) {
    try {
        const text = await file.text();
        const importState = JSON.parse(text);
        
        // Base name
        let baseName = file.name.replace('.json', '');
        let finalName = baseName;
        let counter = 1;
        
        // Conflict resolution
        while (true) {
            try {
                await targetWorkspaceHandle.getDirectoryHandle(finalName);
                finalName = `${baseName} (${counter})`;
                counter++;
            } catch (e) {
                break; // Name is available!
            }
        }
        
        await createAndLoadNewFabric(finalName, importState.bgColor || importState.fabricColor || '#1a1a1a', importState);
    } catch (err) {
        alert('Failed to parse the imported JSON file.');
    }
}

async function openFabric(dirHandle, name) {
    try {
        await flushFabricSave(); // a save still waiting is written to its own canvas before this one opens
        stateFabricHandle = null;
        currentFabricHandle = dirHandle;
        currentFabricName = name;
        currentSourcesHandle = await currentFabricHandle.getDirectoryHandle('sources', { create: true });
        
        // Load state gracefully
        let loadedState = null;
        try {
            let fileHandle;
            try {
                fileHandle = await currentFabricHandle.getFileHandle('fabric.json');
            } catch(e) {
                fileHandle = await currentFabricHandle.getFileHandle('project.json');
            }
            const file = await fileHandle.getFile();
            const text = await file.text();
            loadedState = JSON.parse(text);
        } catch (e) {
            console.warn('Could not read fabric.json, initializing fresh state.', e);
        }
        
        let actualData = loadedState ? (loadedState.data ? loadedState.data : loadedState) : null;
        
        // REHYDRATE FILES
        if (actualData && actualData.files) {
            for (let f of actualData.files) {
                if (f.isImage || f.isPdf) {
                    try {
                        let sourceFileHandle = null;
                        
                        if (f.areaId) {
                            const area = (actualData.areas || []).find(a => a.id === f.areaId);
                            /* Flat storage: removed area subdirectories */
                        }
                        
                        if (!sourceFileHandle) {
                            sourceFileHandle = await currentSourcesHandle.getFileHandle(f.name);
                        }
                        
                        const sourceFile = await sourceFileHandle.getFile();
                        if (f.isPdf) {
                            f.pdfBlobUrl = URL.createObjectURL(sourceFile);
                        } else if (f.isImage) {
                            f.imageDataUrl = await new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = ev => resolve(ev.target.result);
                                reader.readAsDataURL(sourceFile);
                            });
                        }
                    } catch (err) {
                        console.warn('Could not rehydrate media:', f.name);
                    }
                }
            }
        }
        
        prepareFabricState(loadedState);
        stateFabricHandle = dirHandle;

        homeScreen.classList.add('hidden');
        render();
    } catch (err) {
        console.error('Failed to open fabric:', err);
        alert('Failed to open this Fabric: ' + (err.stack || err.message || err));
    }
}

// Saving. saveCurrentFabric() asks for a save; the write happens 500 ms after the last ask.
// The canvas folder and its state are taken when the save is asked for, not when the timer
// fires, so a save asked for just before Home, or before another canvas opens, still lands in
// its own fabric.json (it used to read currentFabricHandle late and find it already cleared).
// Writes run one at a time through saveChain, so an older write can never finish after a
// newer one. flushFabricSave() writes straight away and resolves once the write is done.
let saveFabricTimeout = null;
let pendingSave = null;          // { handle, state } waiting for the timer
let saveChain = Promise.resolve();
let savesWriting = 0;
let lastSavedHandle = null;
let lastSavedJson = null;        // what was last written, so an unchanged canvas is not written again
let thumbnailWarnedFor = null;   // a thumbnail failure is reported once per canvas, not on every save
// The canvas `state` was loaded into. While another canvas is still loading, `state` is the old
// one, and a save then would write the old canvas into the new canvas's fabric.json.
let stateFabricHandle = null;

async function saveCurrentFabric() {
    if (!currentFabricHandle || currentFabricHandle !== stateFabricHandle) return;
    // A save still waiting for another canvas is written now rather than replaced.
    if (pendingSave && pendingSave.handle !== currentFabricHandle) flushFabricSave();
    if (saveFabricTimeout) clearTimeout(saveFabricTimeout);
    pendingSave = { handle: currentFabricHandle, state };
    saveFabricTimeout = setTimeout(flushFabricSave, 500);
}

function flushFabricSave() {
    if (saveFabricTimeout) { clearTimeout(saveFabricTimeout); saveFabricTimeout = null; }
    const job = pendingSave;
    pendingSave = null;
    if (job) saveChain = saveChain.then(() => writeFabric(job.handle, job.state));
    return saveChain;
}

// True when something is being written, or waiting to be written that differs from disk.
function hasUnsavedFabric() {
    if (savesWriting > 0) return true;
    if (!pendingSave) return false;
    return pendingSave.handle !== lastSavedHandle || JSON.stringify(pendingSave.state, null, 2) !== lastSavedJson;
}

async function writeFabric(handle, fabricState) {
    const json = JSON.stringify(fabricState, null, 2);
    if (handle === lastSavedHandle && json === lastSavedJson) return;
    // The thumbnail is taken from the screen, so only while this canvas is still the one shown.
    const thumbCanvas = (fabricState === state && handle === currentFabricHandle) ? drawFabricThumbnail(handle) : null;
    savesWriting++;
    try {
        const fileHandle = await handle.getFileHandle('fabric.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        lastSavedHandle = handle;
        lastSavedJson = json;
        if (thumbCanvas) await writeFabricThumbnail(handle, thumbCanvas);
    } catch (err) {
        console.warn('Could not save fabric:', err);
    } finally {
        savesWriting--;
    }
}

function drawFabricThumbnail(handle) {
    try {
        if (_renderScheduled) render(); // a change made a moment ago is in the picture too
        const thumbSize = 300;
        const aspect = canvas.height / canvas.width;
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize * aspect;
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.fillStyle = state.fabricColor || '#1a1a1a';
        tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        tCtx.drawImage(bgCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        return thumbCanvas;
    } catch (e) {
        warnThumbnailFailed(handle, e);
        return null;
    }
}

async function writeFabricThumbnail(handle, thumbCanvas) {
    try {
        const blob = await new Promise(resolve => thumbCanvas.toBlob(resolve, 'image/jpeg', 0.6));
        if (blob) {
            const thumbHandle = await handle.getFileHandle('thumbnail.jpg', { create: true });
            const thumbWritable = await thumbHandle.createWritable();
            await thumbWritable.write(blob);
            await thumbWritable.close();
        }
    } catch (e) {
        warnThumbnailFailed(handle, e);
    }
}

// [CHANGED on 2026-10-29]: alert('Thumbnail error: ...') on every save → one console warning per canvas.
function warnThumbnailFailed(handle, e) {
    if (thumbnailWarnedFor === handle) return;
    thumbnailWarnedFor = handle;
    console.warn('Could not save thumbnail', e);
}

btnHome.addEventListener('click', async () => {
    await flushFabricSave(); // write the last edits before the canvas is let go
    currentFabricHandle = null;
    currentSourcesHandle = null;
    currentFabricName = null;
    homeScreen.classList.remove('hidden');
    loadFabricsGrid();
});

// Copy a dropped file into the directory
async function copyFileToFolder(file, fileData) {
    if (!currentSourcesHandle) return;
    try {
        let targetDirHandle = currentSourcesHandle;
        
        // Flat Architecture: No physical subdirectory creation based on areaId!
        
        let uniqueName = file.name;
        let skipWrite = false;
        
        while (true) {
            try {
                const existingHandle = await targetDirHandle.getFileHandle(uniqueName);
                const existingFile = await existingHandle.getFile();
                
                if (existingFile.size === file.size) {
                    const newName = prompt(`A file named "${uniqueName}" with the same size already exists.\n\nEnter a new name to save as a separate file, or click Cancel to just link to the existing file:`, uniqueName);
                    if (newName && newName !== uniqueName) {
                        uniqueName = newName;
                        continue; // Re-check the new name
                    } else {
                        // User cancelled or kept same name -> Link to existing, do not overwrite physically
                        skipWrite = true;
                        break;
                    }
                } else {
                    // Different size, auto-append counter
                    const parts = uniqueName.split('.');
                    const ext = parts.length > 1 ? '.' + parts.pop() : '';
                    const base = parts.slice(0, parts.length > 1 ? -1 : 1).join('.');
                    uniqueName = `${base}_${Date.now().toString().slice(-4)}${ext}`;
                    continue;
                }
            } catch (e) {
                // File doesn't exist, we can use this name
                break;
            }
        }
        
        if (fileData) {
            fileData.name = uniqueName;
            const labelEl = document.querySelector(`#file-${fileData.id} .file-name`);
            if (labelEl) {
                labelEl.textContent = uniqueName;
                labelEl.title = uniqueName;
            }
        }
        
        if (!skipWrite) {
            const fileHandle = await targetDirHandle.getFileHandle(uniqueName, { create: true });
            const writable = await fileHandle.createWritable();
            const buffer = await file.arrayBuffer();
            await writable.write(buffer);
            await writable.close();
        }
    } catch (err) {
        console.error('Failed to copy file:', err);
    }
}

// Try to restore directory handle from IndexedDB on startup
async function restoreFolderHandle() {
    try {
        const handle = await loadHandleFromDB();
        if (!handle) return;
        
        // Need to verify permission (browser may have revoked it)
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            targetWorkspaceHandle = handle;
            await writeLockFile(handle);
            startLockHeartbeat();
            await initializeWorkspace();
        } else {
            // Permission needed, wait for user gesture
            btnOpenWorkspace.textContent = "Restore Previous Workspace";
            btnOpenWorkspace.onclick = async () => {
                try {
                    const newPerm = await handle.requestPermission({ mode: 'readwrite' });
                    if (newPerm === 'granted') {
                        targetWorkspaceHandle = handle;
                        await writeLockFile(handle);
                        startLockHeartbeat();
                        await initializeWorkspace();
                    } else {
                        alert('Permission denied by user.');
                    }
                } catch (err) {
                    console.error('Error during workspace restore:', err);
                    alert('Failed to restore workspace: ' + err.message);
                    
                    // Reset the button so they can select a new workspace if restore is hopelessly broken
                    btnOpenWorkspace.textContent = "Open Target Workspace";
                    btnOpenWorkspace.onclick = window.originalBtnOpenWorkspaceClick || btnOpenWorkspace.onclick;
                }
            };
        }
    } catch (err) {
        console.warn('Could not restore folder handle:', err);
    }
}

// Remove lock file on page unload
setInterval(() => {
    if (state.drawings && state.drawings.some(d => d.type === 'clock')) {
        scheduleRender();
    }
}, 1000);

window.addEventListener('beforeunload', (e) => {
    // Checked first and synchronously: the browser asks "Leave site?" only if told before the handler returns.
    const unsaved = hasUnsavedFabric();
    flushFabricSave();
    if (targetWorkspaceHandle) {
        removeLockFile(targetWorkspaceHandle);
    }
    // A write cannot be relied on to finish once the page is gone, so while one is still
    // waiting or running the browser asks first; choosing to stay lets it finish.
    if (unsaved) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Leaving the tab (switching away, minimising, closing) writes at once instead of 500 ms later.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushFabricSave();
});
window.addEventListener('pagehide', () => flushFabricSave());

// Safety net: every input that ends while a canvas is open asks for a save, so a change whose
// own code forgot to ask is still written. writeFabric skips a save that would change nothing.
['pointerup', 'keyup', 'change', 'drop', 'paste', 'wheel'].forEach(type => {
    document.addEventListener(type, () => saveCurrentFabric(), { capture: true, passive: true });
});

// Initialize folder handle restoration
restoreFolderHandle();

// ===== NOTEPAD FEATURE =====
function getActiveScrollBoxPageId(areaId) {
    if (!areaId) return null;
    const area = state.areas.find(a => a.id === areaId);
    if (area && area.isScrollBox && area.pages) {
        const page = area.pages[area.currentPageIndex];
        return page ? page.id : null;
    }
    return null;
}

function createNotepad(worldPos) {
    const w = 250, h = 250;
    const newId = Date.now().toString();
    const newArea = {
        id: newId,
        name: 'Note',
        color: '#fff3c4',
        polygons: [[
            {x: worldPos.x, y: worldPos.y},
            {x: worldPos.x + w, y: worldPos.y},
            {x: worldPos.x + w, y: worldPos.y + h},
            {x: worldPos.x, y: worldPos.y + h}
        ]],
        containedFiles: [],
        isBook: false,
        isNote: true,
        textContent: "",
        parentAreaId: state.editingDashboardId || null,
        scrollBoxPageId: getActiveScrollBoxPageId(state.editingDashboardId)
    };
    state.areas.push(newArea);
    setMode('select');
    scheduleRender();
    
    setTimeout(() => {
        const el = document.getElementById(`note-${newId}`);
        if (el) {
            el.style.pointerEvents = 'auto';
            el.focus();
        }
    }, 50);
    saveCurrentFabric();
}
// --- Checkbox event delegation ---
// Instead of inline onclick, we use a single click listener on filesLayer
filesLayer.addEventListener('click', function(e) {
    const cb = e.target.closest('input[data-note-cb]');
    if (!cb) return;
    
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const noteId = cb.getAttribute('data-note-id');
    const lineIndex = parseInt(cb.getAttribute('data-line-index'), 10);
    const isChecked = cb.checked; // browser already toggled this
    
    const note = state.areas.find(a => String(a.id) === String(noteId));
    if (!note) return;
    
    const lines = (note.textContent || "").split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
        let line = lines[lineIndex];
        const cleaned = line.replace(/\r$/, '');
        const suffix = line.endsWith('\r') ? '\r' : '';
        
        const cbMatch = cleaned.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
        if (cbMatch) {
            lines[lineIndex] = cbMatch[1] + (isChecked ? '- [x] ' : '- [ ] ') + cbMatch[3] + suffix;
            const newText = lines.join('\n');
            note.textContent = newText;
            
            const container = document.getElementById('note-' + note.id);
            if (container) {
                const editor = container.querySelector('.note-editor');
                if (editor) editor.value = newText;
                if (container.updateDisplay) container.updateDisplay();
            }
            
            saveCurrentFabric();
            scheduleRender();
        }
    }
}, true); // use capture phase to get the event first

function getAnimationOffset(item) {
    let dx = 0;
    let dy = 0;
    let current = item;
    let visited = new Set();
    let __loop_cnt=0; while (current) { if(++__loop_cnt>1000) { console.error('Infinite loop detected!'); break; }
        if (visited.has(current.id)) break;
        visited.add(current.id);
        const targetAreaId = current.areaId || current.parentAreaId;
        if (!targetAreaId) break;
        
        const area = state.areas.find(a => a.id === targetAreaId);
        if (!area) break;
        
        if (area.isScrollBox && area.animation) {
            const progress = Math.min(1, (performance.now() - area.animation.startTime) / area.animation.duration);
            const ease = 1 - Math.pow(1 - progress, 3);
            
            const isVertical = area.layout === 'vertical';
            const areaWidth = area.points[1].x - area.points[0].x;
            const areaHeight = area.points[3].y - area.points[0].y;
            
            let shift = 0;
            if (current.scrollBoxPageId === area.animation.fromPageId) {
                shift = -area.animation.direction * (isVertical ? areaHeight : areaWidth) * ease;
            } else if (current.scrollBoxPageId === area.animation.toPageId) {
                shift = area.animation.direction * (isVertical ? areaHeight : areaWidth) * (1 - ease);
            }
            
            if (isVertical) dy += shift;
            else dx += shift;
        }
        current = area;
    }
    return { dx, dy };
}

function getClippingScrollBox(item) {
    let current = item;
    let __loop_cnt=0; while (current) { if(++__loop_cnt>1000) { console.error('Infinite loop detected!'); break; }
        const targetAreaId = current.areaId || current.parentAreaId;
        if (!targetAreaId) break;
        const area = state.areas.find(a => a.id === targetAreaId);
        if (!area) break;
        if (area.isScrollBox || (area.isFolder && area.isOpen)) return area;
        current = area;
    }
    return null;
}

function applyDOMClip(el, item) {
    const sb = getClippingScrollBox(item);
    if (!sb) {
        if (el.style.clipPath !== '') {
            el.style.clipPath = '';
            el.classList.remove('is-clipped');
        }
        return;
    }
    const corners = getAreaCorners(sb);
    const sbW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
    const sbH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
    const sbX = corners.tl.x;
    const sbY = corners.tl.y;
    
    let elX = parseFloat(el.style.left) || 0;
    let elY = parseFloat(el.style.top) || 0;
    if (item.x !== undefined) { elX = item.x; elY = item.y; }
    
    const offset = getAnimationOffset(item);
    const actualX = elX + offset.dx;
    const actualY = elY + offset.dy;
    
    let hw = 0;
    let hh = 0;
    if (item.type !== 'text') {
        hw = el.offsetWidth / 2;
        hh = el.offsetHeight / 2;
    }
    
    const clipLeft = sbX - actualX + hw;
    const clipTop = sbY - actualY + hh;
    const clipRight = clipLeft + sbW;
    const clipBottom = clipTop + sbH;
    
    const newClipPath = `polygon(${clipLeft}px ${clipTop}px, ${clipRight}px ${clipTop}px, ${clipRight}px ${clipBottom}px, ${clipLeft}px ${clipBottom}px)`;
    if (el.style.clipPath !== newClipPath) {
        el.style.clipPath = newClipPath;
        if (newClipPath !== '') {
            el.classList.add('is-clipped');
        }
    }
}

function isItemVisibleInContainer(item, skipAnimationCheck = false) {
    if (item.isHidden) return false;
    let current = item;
    let __loop_cnt=0; while (current) { if(++__loop_cnt>1000) { console.error('Infinite loop detected!'); break; }
        const targetAreaId = current.areaId || current.parentAreaId;
        if (!targetAreaId) return true;
        
        const area = state.areas.find(a => a.id === targetAreaId);
        if (!area) return true;
        
        if (area.isFolder) {
            if (!area.isOpen) return false;
        }
        if (area.isBook) {
            if (current.bookTitleId !== area.activeTitleId || current.bookPageId !== area.activePageId) {
                return false;
            }
        }
        
        if (area.isScrollBox) {
            const currentPage = area.pages[area.currentPageIndex];
            
            if (!skipAnimationCheck && area.animation) {
                if (current.scrollBoxPageId === area.animation.fromPageId || current.scrollBoxPageId === area.animation.toPageId) {
                    current = area;
                    continue;
                }
            }
            
            if (!currentPage || current.scrollBoxPageId !== currentPage.id) {
                return false;
            }
        }
        
        current = area;
    }
    
    return true;
}

function syncFilesVisibility() {
    for (let file of state.files) {
        const el = document.getElementById(`file-${file.id}`);
        if (el) {
            // Off-screen file cards are hidden (display:none) so the browser skips their
            // layout/paint — unless the card holds focus (e.g. an open note being typed in).
            const isVisible = isItemVisibleInContainer(file) &&
                (isItemOnScreen(file) || el.contains(document.activeElement));
            const displayStyle = isVisible ? '' : 'none';
            if (el.style.display !== displayStyle) el.style.display = displayStyle;
            
            if (isVisible) {
                const offset = getAnimationOffset(file);
                const newTransform = (offset.dx !== 0 || offset.dy !== 0) ? `translate(calc(-50% + ${offset.dx}px), calc(-50% + ${offset.dy}px))` : '';
                if (el.style.transform !== newTransform) {
                    el.style.transform = newTransform;
                }
                
                applyDOMClip(el, file);
                
                // Locked files underneath a non-parent area should appear visually beneath
                if (file.isLocked) {
                    const center = getItemCenter(file, false);
                    let underArea = false;
                    for (let area of state.areas) {
                        if (area.id === file.areaId) continue;
                        let inArea = false;
                        if (area.polygons) {
                            for (let p of area.polygons) {
                                if (isPointInPolygon(center, p)) { inArea = true; break; }
                            }
                        } else if (area.points) {
                            if (isPointInPolygon(center, area.points)) inArea = true;
                        }
                        if (inArea) { underArea = true; break; }
                    }
                    el.style.opacity = underArea ? '0.15' : '';
                    el.style.pointerEvents = underArea ? 'none' : '';
                } else {
                    el.style.opacity = '';
                    el.style.pointerEvents = '';
                }
            } else {
                el.style.display = 'none';
            }
        }
    }
}

function syncNotesDOM() {
    const notes = state.areas.filter(a => a.isNote);
    const noteIds = new Set(notes.map(n => `note-${n.id}`));
    
    for (const note of notes) {
        let container = document.getElementById(`note-${note.id}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `note-${note.id}`;
            container.className = 'sticky-note-container';
            container.style.position = 'absolute';
            container.style.pointerEvents = 'none'; // Let canvas handle drags/clicks
            
            const display = document.createElement('div');
            display.className = 'note-display';
            display.style.position = 'absolute';
            display.style.top = '0';
            display.style.left = '0';
            display.style.width = '100%';
            display.style.height = '100%';
            display.style.padding = '60px 24px 20px 24px';
            display.style.color = state.fabricColor === '#ffffff' ? '#111111' : '#ffffff';
            display.style.fontFamily = "'Consolas', 'Courier New', monospace";
            display.style.whiteSpace = "pre-wrap";
            display.style.wordWrap = "break-word";
            display.style.overflow = "hidden";
            display.style.pointerEvents = 'none';
            display.style.boxSizing = 'border-box';
            
            const editor = document.createElement('textarea');
            editor.className = 'note-editor';
            editor.value = note.textContent || "";
            editor.placeholder = "Double-click to edit...";
            
            editor.style.position = 'absolute';
            editor.style.top = '0';
            editor.style.left = '0';
            editor.style.width = '100%';
            editor.style.height = '100%';
            editor.style.background = 'transparent';
            editor.style.border = 'none';
            editor.style.outline = 'none';
            editor.style.resize = 'none';
            editor.style.padding = '60px 24px 20px 24px';
            editor.style.color = state.fabricColor === '#ffffff' ? '#111111' : '#ffffff';
            editor.style.fontFamily = "'Consolas', 'Courier New', monospace";
            editor.style.fontSize = "14px";
            editor.style.lineHeight = "1.4";
            editor.style.whiteSpace = "pre-wrap";
            editor.style.wordWrap = "break-word";
            editor.style.pointerEvents = 'none'; 
            editor.style.opacity = '0'; // Hidden by default
            editor.style.boxSizing = 'border-box';
            
            const updateDisplay = () => {
                const lines = editor.value.split('\n');
                display.innerHTML = lines.map((line, index) => {
                    const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
                    if (headingMatch) {
                        const level = headingMatch[1].length;
                        const sizes = { 1: 32, 2: 24, 3: 20, 4: 18, 5: 16, 6: 14 };
                        const fs = sizes[level] || 14;
                        return `<div style="font-size: ${fs}px; font-weight: 600; font-family: Inter, sans-serif; margin-top: ${fs*0.2}px; margin-bottom: ${fs*0.2}px; line-height: 1.2;">${headingMatch[2]}</div>`;
                    }
                    
                    const cbMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
                    if (cbMatch) {
                        const isChecked = cbMatch[2].toLowerCase() === 'x';
                        const textDecoration = isChecked ? 'line-through; opacity: 0.7;' : '';
                        return `<div style="font-size: 14px; line-height: 1.4; min-height: 19.6px; display: flex;">
                            <span style="white-space: pre;">${cbMatch[1]}</span>
                            <input type="checkbox" data-note-cb
                                   data-note-id="${note.id}"
                                   data-line-index="${index}"
                                   style="margin-top: 2px; margin-right: 6px; pointer-events: auto; cursor: pointer;" 
                                   ${isChecked ? 'checked' : ''}>
                            <span style="flex: 1; word-break: break-word; ${textDecoration}">${cbMatch[3]}</span>
                        </div>`;
                    }
                    
                    // Keep text height even if empty
                    return `<div style="font-size: 14px; line-height: 1.4; min-height: 19.6px;">${line}</div>`;
                }).join('');
                scheduleRender();
            };
            
            editor.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
                    e.preventDefault();
                    
                    const startPos = editor.selectionStart;
                    const text = editor.value;
                    
                    let lineStart = text.lastIndexOf('\n', startPos - 1) + 1;
                    let lineEnd = text.indexOf('\n', startPos);
                    if (lineEnd === -1) lineEnd = text.length;
                    
                    let lineText = text.substring(lineStart, lineEnd);
                    const hasReturn = lineText.endsWith('\r');
                    if (hasReturn) lineText = lineText.slice(0, -1);
                    
                    let newLineText = lineText;
                    
                    const uncheckedRegex = /^(\s*)-\s*\[\s*\]\s*(.*)/;
                    const checkedRegex = /^(\s*)-\s*\[[xX]\]\s*(.*)/;
                    
                    if (uncheckedRegex.test(lineText)) {
                        newLineText = lineText.replace(uncheckedRegex, '$1- [x] $2');
                    } else if (checkedRegex.test(lineText)) {
                        newLineText = lineText.replace(checkedRegex, '$1- [ ] $2');
                    } else {
                        newLineText = '- [ ] ' + lineText;
                    }
                    
                    if (hasReturn) newLineText += '\r';
                    
                    editor.value = text.substring(0, lineStart) + newLineText + text.substring(lineEnd);
                    
                    const newPos = startPos + (newLineText.length - lineText.length);
                    editor.selectionStart = editor.selectionEnd = newPos;
                    
                    note.textContent = editor.value;
                    saveCurrentFabric();
                    updateDisplay();
                }
            });
            
            editor.addEventListener('input', () => {
                note.textContent = editor.value;
                updateDisplay();
            });
            
            editor.addEventListener('blur', () => {
                editor.style.pointerEvents = 'none';
                editor.style.opacity = '0';
                display.style.opacity = '1';
                saveCurrentFabric();
            });
            
            editor.addEventListener('focus', () => {
                editor.style.opacity = '1';
                display.style.opacity = '0';
            });
            
            container.updateDisplay = updateDisplay;
            
            container.appendChild(display);
            container.appendChild(editor);
            filesLayer.appendChild(container);
            
            updateDisplay();
        } else {
            const editor = container.querySelector('.note-editor');
            if (editor && editor.value !== note.textContent) {
                editor.value = note.textContent || "";
                if (container.updateDisplay) container.updateDisplay();
            }
        }
        
        // Hide off-screen notes unless the note's editor currently holds focus.
        container.style.display = (isItemVisibleInContainer(note) &&
            (isItemOnScreen(note) || container.contains(document.activeElement))) ? '' : 'none';

        const offset = getAnimationOffset(note);
        if (offset.dx !== 0 || offset.dy !== 0) {
            container.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
        } else {
            container.style.transform = '';
        }
        
        // Match Area bounds precisely
        const pts = note.polygons[0];
        const minX = Math.min(...pts.map(p=>p.x));
        const minY = Math.min(...pts.map(p=>p.y));
        const maxX = Math.max(...pts.map(p=>p.x));
        const maxY = Math.max(...pts.map(p=>p.y));
        
        container.style.left = `${minX}px`;
        container.style.top = `${minY}px`;
        container.style.width = `${maxX - minX}px`;
        container.style.height = `${maxY - minY}px`;
        
        applyDOMClip(container, note);
        
        const isBgLight = isColorLight(state.fabricColor || '#1a1a1a');
        const textColor = isBgLight ? '#111111' : '#ffffff';
        const displayEl = container.querySelector('.note-display');
        const editorEl = container.querySelector('.note-editor');
        if (displayEl) displayEl.style.color = textColor;
        if (editorEl) editorEl.style.color = textColor;
    }
    
    // Cleanup removed notes
    const existing = filesLayer.querySelectorAll('.sticky-note-container, .sticky-note-textarea');
    existing.forEach(el => {
        const id = el.id.replace('note-', '');
        if (!noteIds.has(`note-${id}`)) el.remove();
    });
}

// Start app
init();
let activeContextFabric = null;

function showFabricContextMenu(x, y, fabricName) {
    activeContextFabric = fabricName;
    // Remove any existing dynamic menu
    const old = document.getElementById('dynamic-fabric-menu');
    if (old) old.remove();
    
    const menu = document.createElement('div');
    menu.id = 'dynamic-fabric-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: #2a2a2a;
        border: 1px solid #3a3a3a;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        padding: 4px;
        z-index: 99999;
        min-width: 140px;
    `;
    
    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.style.cssText = 'background:transparent;border:none;color:#fff;padding:10px 16px;text-align:left;cursor:pointer;border-radius:4px;font-family:inherit;font-size:14px;';
    renameBtn.onmouseenter = () => renameBtn.style.background = 'rgba(255,255,255,0.1)';
    renameBtn.onmouseleave = () => renameBtn.style.background = 'transparent';
    renameBtn.onclick = async (e) => {
        e.stopPropagation();
        menu.remove();
        const oldName = activeContextFabric;
        const newName = prompt(`Rename fabric '${oldName}' to:`, oldName);
        if (!newName || newName === oldName) return;
        try {
            try { await targetWorkspaceHandle.getDirectoryHandle(newName); alert('A fabric with this name already exists.'); return; } catch(ex) {}
            const oldH = await targetWorkspaceHandle.getDirectoryHandle(oldName);
            const newH = await targetWorkspaceHandle.getDirectoryHandle(newName, { create: true });
            await copyDirectory(oldH, newH);
            await targetWorkspaceHandle.removeEntry(oldName, { recursive: true });
            loadFabricsGrid();
        } catch (err) { console.error(err); alert('Failed to rename fabric.'); }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = 'background:transparent;border:none;color:#ef4444;padding:10px 16px;text-align:left;cursor:pointer;border-radius:4px;font-family:inherit;font-size:14px;';
    deleteBtn.onmouseenter = () => deleteBtn.style.background = 'rgba(239,68,68,0.1)';
    deleteBtn.onmouseleave = () => deleteBtn.style.background = 'transparent';
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        menu.remove();
        if (!confirm(`Are you sure you want to delete '${activeContextFabric}'? This cannot be undone.`)) return;
        try {
            await targetWorkspaceHandle.removeEntry(activeContextFabric, { recursive: true });
            loadFabricsGrid();
        } catch (err) { console.error(err); alert('Failed to delete fabric.'); }
    };
    
    menu.appendChild(renameBtn);
    menu.appendChild(deleteBtn);
    document.body.appendChild(menu);
    
    // Dismiss when clicking outside
    setTimeout(() => {
        function dismiss(ev) {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('pointerdown', dismiss, true);
            }
        }
        document.addEventListener('pointerdown', dismiss, true);
    }, 10);
}

document.getElementById('btn-rename-fabric')?.addEventListener('click', async () => {
    if (!activeContextFabric) return;
    const oldName = activeContextFabric;
    
    const newName = prompt(`Rename fabric '${oldName}' to:`, oldName);
    if (!newName || newName === oldName) return;
    
    try {
        // Check if new name exists
        try {
            await targetWorkspaceHandle.getDirectoryHandle(newName);
            alert('A fabric with this name already exists.');
            return;
        } catch (e) {} // doesn't exist, we can proceed
        
        const oldFabricHandle = await targetWorkspaceHandle.getDirectoryHandle(oldName);
        const newFabricHandle = await targetWorkspaceHandle.getDirectoryHandle(newName, { create: true });
        
        await copyDirectory(oldFabricHandle, newFabricHandle);
        await targetWorkspaceHandle.removeEntry(oldName, { recursive: true });
        
        loadFabricsGrid();
    } catch (err) {
        console.error('Failed to rename fabric:', err);
        alert('Failed to rename fabric. Make sure it is not open elsewhere.');
    }
});

document.getElementById('btn-delete-fabric')?.addEventListener('click', async () => {
    if (!activeContextFabric) return;
    const name = activeContextFabric;
    
    if (!confirm(`Are you sure you want to delete the fabric '${name}'? This cannot be undone.`)) return;
    
    try {
        await targetWorkspaceHandle.removeEntry(name, { recursive: true });
        loadFabricsGrid();
    } catch (err) {
        console.error('Failed to delete fabric:', err);
        alert('Failed to delete fabric.');
    }
});

async function copyDirectory(srcDir, destDir) {
    for await (const entry of srcDir.values()) {
        if (entry.kind === 'file') {
            const srcFileHandle = await srcDir.getFileHandle(entry.name);
            const file = await srcFileHandle.getFile();
            const destFileHandle = await destDir.getFileHandle(entry.name, {create: true});
            const writable = await destFileHandle.createWritable();
            await writable.write(await file.arrayBuffer());
            await writable.close();
        } else if (entry.kind === 'directory') {
            const srcSubDir = await srcDir.getDirectoryHandle(entry.name);
            const destSubDir = await destDir.getDirectoryHandle(entry.name, {create: true});
            await copyDirectory(srcSubDir, destSubDir);
        }
    }
}






// Table Context Menu and Text Format Logic
document.addEventListener('pointerdown', (e) => {
    const menu = document.getElementById('table-context-menu');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#table-context-menu')) {
        menu.classList.add('hidden');
        if (menu.dataset.tableId) {
            const table = state.tables.find(t => t.id === menu.dataset.tableId);
            if (table && table.isResizing) {
                table.isResizing = false;
                syncTables();
            }
        }
    }
});

document.getElementById('menu-delete-table')?.addEventListener('click', () => {
    const menu = document.getElementById('table-context-menu');
    const tableId = menu.dataset.tableId;
    if (tableId) {
        state.tables = state.tables.filter(t => t.id !== tableId);
        saveCurrentFabric();
        syncTables();
    }
    menu.classList.add('hidden');
});

document.getElementById('menu-resize-table')?.addEventListener('click', () => {
    const menu = document.getElementById('table-context-menu');
    const tableId = menu.dataset.tableId;
    if (tableId) {
        const table = state.tables.find(t => t.id === tableId);
        if (table) {
            table.isResizing = true;
            syncTables();
        }
    }
    menu.classList.add('hidden');
});

const tableTextProxy = {
    isTableText: true,
    cellId: null,
    tableId: null,
    
    _save() {
        if (!this.cellId || !this.tableId) return;
        const table = state.tables.find(t => t.id === this.tableId);
        if (!table) return;
        const cellEl = document.querySelector(`.table-container#${this.tableId} [data-cell-id="${this.cellId}"]`);
        if (cellEl) {
            table.cells[this.cellId] = cellEl.innerHTML;
            saveCurrentFabric();
        }
    },
    
    set fontSize(val) {
        document.execCommand('styleWithCSS', false, true);
        let span = document.createElement("span");
        span.style.fontSize = val + "px";
        if (window.getSelection && window.getSelection().rangeCount > 0) {
            let range = window.getSelection().getRangeAt(0);
            span.appendChild(range.extractContents());
            range.insertNode(span);
        }
        this._save();
    },
    get fontSize() { return 24; },
    
    set isBold(val) { document.execCommand('bold', false, null); this._save(); },
    get isBold() { return document.queryCommandState('bold'); },
    
    set isItalic(val) { document.execCommand('italic', false, null); this._save(); },
    get isItalic() { return document.queryCommandState('italic'); },
    
    set fontFamily(val) { document.execCommand('fontName', false, val); this._save(); },
    get fontFamily() { return document.queryCommandValue('fontName') || 'Inter, sans-serif'; },

    set color(val) { document.execCommand('foreColor', false, val); this._save(); },
    get color() { return document.queryCommandValue('foreColor') || state.areaColor; },
    
    set highlightColor(val) { document.execCommand('hiliteColor', false, val); this._save(); },
    get highlightColor() { return 'transparent'; },

    set textAlign(val) { 
        document.execCommand('justify' + (val==='left'?'Left':val==='right'?'Right':'Center'), false, null); 
        this._save(); 
    },
    get textAlign() { return 'left'; },
    
    set hasBorder(val) {},
    get hasBorder() { return false; }
};


// Prevent ribbon buttons from stealing focus so contenteditable selection is preserved
document.querySelectorAll('.properties-panel button, .properties-panel select, .properties-panel input').forEach(el => {
    el.addEventListener('mousedown', (e) => {
        if (state.selectedText && state.selectedText.isTableText) {
            // e.preventDefault() prevents the button from taking focus, 
            // keeping the table cell focused
            if (el.tagName !== 'INPUT' || el.type === 'button') {
                e.preventDefault();
            }
        }
    });
});

function syncCalendars() {
    const calendarDrawings = state.drawings.filter(d => d.type === 'calendar');
    const calendarIds = new Set(calendarDrawings.map(d => `cal-${d.id}`)); // Set: O(1) orphan check

    document.querySelectorAll('.calendar-container').forEach(el => {
        if (!calendarIds.has(el.id)) {
            el.remove();
        }
    });

    for (let d of calendarDrawings) {
        let container = document.getElementById(`cal-${d.id}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `cal-${d.id}`;
            container.className = 'calendar-container';
            
            // Context menu listener removed, using 3-dots button now
            filesLayer.appendChild(container);
            renderCalendarHTML(container, d.id);
        }
        
        d.width = Math.max(d.width || 0, 320);
        d.height = Math.max(d.height || 0, 375);
        container.style.position = 'absolute';
        container.style.left = d.x + 'px';
        container.style.top = d.y + 'px';
        container.style.width = d.width + 'px';
        container.style.height = d.height + 'px';
        // Hide off-screen calendars (skips their paint/compositing) unless one holds focus.
        container.style.display = (isItemVisibleInContainer(d) &&
            (isItemOnScreen(d) || container.contains(document.activeElement))) ? '' : 'none';
        
        const offset = getAnimationOffset(d);
        if (offset.dx !== 0 || offset.dy !== 0) {
            container.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
        } else {
            container.style.transform = '';
        }
        
        applyDOMClip(container, d);
        
        container.style.pointerEvents = 'auto'; // allow clicking inside
    }
}

function updateAllCalendarsHTML() {
    const calendarDrawings = state.drawings.filter(d => d.type === 'calendar');
    for (let d of calendarDrawings) {
        let container = document.getElementById(`cal-${d.id}`);
        if (container) {
            renderCalendarHTML(container, d.id);
        }
    }
}

function renderCalendarHTML(container, id) {
    const drawing = state.drawings.find(d => d.id === id);
    if (!drawing) return;
    
    const sync = state.calendarSync;
    
    let viewMonth = sync.viewMonth;
    let viewYear = sync.viewYear;
    if (drawing.fixedMonth !== undefined && drawing.fixedYear !== undefined) {
        viewMonth = drawing.fixedMonth;
        viewYear = drawing.fixedYear;
    }
    
    const date = new Date(viewYear, viewMonth, 1);
    const monthName = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    
    const today = new Date();
    const isCurrentMonth = today.getMonth() === viewMonth && today.getFullYear() === viewYear;
    const currentDay = today.getDate();
    
    let firstDay = date.getDay(); 
    firstDay = firstDay === 0 ? 6 : firstDay - 1; 
    
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    
    let html = `
        <div class="cal-header">
            <div class="cal-title-nav">
                <div class="cal-nav-btn cal-prev" data-id="${id}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></div>
                <div class="cal-title">${monthName} ${year}</div>
                <div class="cal-nav-btn cal-next" data-id="${id}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>
            </div>
            <div class="cal-options-btn" data-id="${id}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></div>
        </div>
        <div class="cal-days-header">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
        </div>
        <div class="cal-grid">
    `;
    
    for (let i = 0; i < firstDay; i++) {
        const dayNum = daysInPrevMonth - firstDay + i + 1;
        html += `<div class="cal-day prev-month">${dayNum}</div>`;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(sync.viewMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const scheduleColor = sync.schedules[dateStr];
        let classes = 'cal-day current-month';
        let style = '';
        if (isCurrentMonth && i === currentDay) {
            classes += ' today';
        }
        if (scheduleColor) {
            classes += ' scheduled';
            style = `background-color: ${scheduleColor}; border-color: ${scheduleColor}; color: #fff;`;
        }
        
        html += `<div class="${classes}" data-date="${dateStr}" style="${style}"><span>${i}</span></div>`;
    }
    
    const totalCells = 42;
    const filledCells = firstDay + daysInMonth;
    for (let i = 1; i <= totalCells - filledCells; i++) {
        html += `<div class="cal-day next-month">${i}</div>`;
    }
    
    html += `</div>`;
    html += `<div class="cal-resize-handle"></div>`;
    container.innerHTML = html;
    
    const resizeHandle = container.querySelector('.cal-resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const drawing = state.drawings.find(d => d.id === id);
            if (!drawing) return;
            
            let startX = e.clientX;
            let startY = e.clientY;
            let startW = drawing.width;
            let startH = drawing.height;
            
            const onMove = (ev) => {
                const dx = (ev.clientX - startX) / state.camera.zoom;
                const dy = (ev.clientY - startY) / state.camera.zoom;
                drawing.width = Math.max(200, startW + dx);
                drawing.height = Math.max(250, startH + dy);
                container.style.width = drawing.width + 'px';
                container.style.height = drawing.height + 'px';
            };
            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                saveCurrentFabric();
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }
    
    const prevBtn = container.querySelector('.cal-prev');
    prevBtn.onpointerdown = (e) => e.stopPropagation();
    prevBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (drawing.fixedMonth !== undefined) {
            drawing.fixedMonth--;
            if (drawing.fixedMonth < 0) {
                drawing.fixedMonth = 11;
                drawing.fixedYear--;
            }
        } else {
            state.calendarSync.viewMonth--;
            if (state.calendarSync.viewMonth < 0) {
                state.calendarSync.viewMonth = 11;
                state.calendarSync.viewYear--;
            }
        }
        updateAllCalendarsHTML();
        saveCurrentFabric();
    };
    
    const nextBtn = container.querySelector('.cal-next');
    nextBtn.onpointerdown = (e) => e.stopPropagation();
    nextBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (drawing.fixedMonth !== undefined) {
            drawing.fixedMonth++;
            if (drawing.fixedMonth > 11) {
                drawing.fixedMonth = 0;
                drawing.fixedYear++;
            }
        } else {
            state.calendarSync.viewMonth++;
            if (state.calendarSync.viewMonth > 11) {
                state.calendarSync.viewMonth = 0;
                state.calendarSync.viewYear++;
            }
        }
        updateAllCalendarsHTML();
        saveCurrentFabric();
    };
    
    const optBtn = container.querySelector('.cal-options-btn');
    optBtn.onpointerdown = (e) => { e.stopPropagation(); };
    optBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('3 dots left-clicked! Showing context menu for calendar:', drawing.id);
        showCalendarContextMenu(e.clientX, e.clientY, drawing);
    };
    optBtn.oncontextmenu = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('3 dots right-clicked! Showing context menu for calendar:', drawing.id);
        showCalendarContextMenu(e.clientX, e.clientY, drawing);
    };
    
    container.querySelectorAll('.cal-day.current-month').forEach(day => {
        day.onpointerdown = (e) => {
            e.stopPropagation();
        };
        day.onclick = (e) => {
            e.stopPropagation();
            const dStr = day.dataset.date;
            if (state.calendarSync.schedules[dStr]) {
                const choice = confirm("Clear schedule for this date? (Click Cancel to keep/change color)");
                if (choice) {
                    delete state.calendarSync.schedules[dStr];
                    updateAllCalendarsHTML();
                    saveCurrentFabric();
                    return;
                }
            }
            
            const color = prompt("Enter a color for this schedule (e.g., #10b981, red, etc.):", state.calendarSync.schedules[dStr] || "#10b981");
            if (color) {
                state.calendarSync.schedules[dStr] = color;
                updateAllCalendarsHTML();
                saveCurrentFabric();
            }
        };
    });
}

function syncScrollBoxes() {
    const scrollBoxes = state.areas.filter(a => a.isScrollBox);
    const scrollBoxIds = new Set(scrollBoxes.map(b => `sb-${b.id}`)); // Set: O(1) orphan check

    document.querySelectorAll('.scroll-box-container').forEach(el => {
        if (!scrollBoxIds.has(el.id)) {
            el.remove();
        }
    });

    for (let sb of scrollBoxes) {
        let container = document.getElementById(`sb-${sb.id}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `sb-${sb.id}`;
            filesLayer.appendChild(container);
        }
        
        // Ensure pages structure
        if (!sb.pages || sb.pages.length === 0) {
            sb.pages = [{ id: Date.now().toString() }];
            sb.currentPageIndex = 0;
        }
        
        container.className = `scroll-box-container ${sb.layout || 'horizontal'}`;
        container.style.backgroundColor = 'transparent';
        
        const corners = getAreaCorners(sb);
        const w = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
        const h = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
        
        container.style.position = 'absolute';
        container.style.left = corners.tl.x + 'px';
        container.style.top = corners.tl.y + 'px';
        container.style.width = w + 'px';
        container.style.height = h + 'px';
        container.style.pointerEvents = 'none';

        container.style.display = (isItemVisibleInContainer(sb) && isItemOnScreen(sb)) ? '' : 'none';
        
        const offset = getAnimationOffset(sb);
        if (offset.dx !== 0 || offset.dy !== 0) {
            container.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
        } else {
            container.style.transform = '';
        }
        
        applyDOMClip(container, sb);
        
        renderScrollBoxHTML(container, sb);
    }
}

function startScrollBoxAnimation(sb, newIndex) {
    if (newIndex === sb.currentPageIndex) return;
    const oldPageId = sb.pages[sb.currentPageIndex].id;
    const newPageId = sb.pages[newIndex].id;
    
    sb.animation = {
        fromPageId: oldPageId,
        toPageId: newPageId,
        direction: newIndex > sb.currentPageIndex ? 1 : -1,
        startTime: performance.now(),
        duration: 300
    };
    
    sb.currentPageIndex = newIndex;
    if (state.editingDashboardId === sb.id && typeof renderPagesList === 'function') {
        renderPagesList(sb);
    }
    saveCurrentFabric();
    scheduleRender();
    uploadProgress.finish();
}

function renderScrollBoxHTML(container, sb) {
    let html = `<div class="scroll-box-viewport">`;
    html += `<div class="scroll-box-page active"></div>`;
    html += `</div>`;
        
        html += `<div class="scroll-box-controls">`;
        html += `<div class="scroll-box-nav prev" title="Previous Page"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></div>`;
        html += `<div class="scroll-box-page-label">Page ${sb.currentPageIndex + 1} of ${sb.pages.length}</div>`;
        html += `<div class="scroll-box-nav next" title="Next Page"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>`;
        html += `<div style="width: 1px; height: 12px; background: rgba(255,255,255,0.2); margin: 0 4px;"></div>`;
        html += `<div class="scroll-box-dots">`;
        for (let i = 0; i < sb.pages.length; i++) {
            html += `<div class="scroll-box-dot ${i === sb.currentPageIndex ? 'active' : ''}" data-index="${i}"></div>`;
        }
        html += `</div>`;
        html += `<div class="scroll-box-add-page" title="Add Page">+</div>`;
        html += `</div>`;
        
        html += `<div class="scroll-box-resize"></div>`;
        
        container.innerHTML = html;
        
        container.querySelectorAll('.scroll-box-dot').forEach(dot => {
            dot.onpointerdown = (e) => {
                e.stopPropagation();
                startScrollBoxAnimation(sb, parseInt(dot.dataset.index));
            };
        });
        
        const addBtn = container.querySelector('.scroll-box-add-page');
        if (addBtn) {
            addBtn.onpointerdown = (e) => {
                e.stopPropagation();
                sb.pages.push({ id: Date.now().toString() });
                startScrollBoxAnimation(sb, sb.pages.length - 1);
            };
        }
        
        const prevBtn = container.querySelector('.scroll-box-nav.prev');
        if (prevBtn) {
            prevBtn.onpointerdown = (e) => {
                e.stopPropagation();
                if (sb.currentPageIndex > 0) {
                    startScrollBoxAnimation(sb, sb.currentPageIndex - 1);
                }
            };
        }
        
        const nextBtn = container.querySelector('.scroll-box-nav.next');
        if (nextBtn) {
            nextBtn.onpointerdown = (e) => {
                e.stopPropagation();
                if (sb.currentPageIndex < sb.pages.length - 1) {
                    startScrollBoxAnimation(sb, sb.currentPageIndex + 1);
                }
            };
        }
    
    const resizeHandle = container.querySelector('.scroll-box-resize');
    if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            let startX = e.clientX;
            let startY = e.clientY;
            
            const corners = getAreaCorners(sb);
            let startW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
            let startH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);
            
            const onMove = (ev) => {
                const dx = (ev.clientX - startX) / state.camera.zoom;
                const dy = (ev.clientY - startY) / state.camera.zoom;
                
                const newW = Math.max(200, startW + dx);
                const newH = Math.max(200, startH + dy);
                
                sb.points[1].x = sb.points[0].x + newW;
                sb.points[2].x = sb.points[0].x + newW;
                sb.points[2].y = sb.points[0].y + newH;
                sb.points[3].y = sb.points[0].y + newH;
                
                container.style.width = newW + 'px';
                container.style.height = newH + 'px';
            };
            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                saveCurrentFabric();
                scheduleRender();
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }
}

function renderPagesList(area) {
    const section = document.getElementById('pages-section');
    const container = document.getElementById('pages-list-container');
    if (!area.isScrollBox) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    container.innerHTML = '';

    if (!area.pages || area.pages.length === 0) return;

    let draggedItem = null;

    area.pages.forEach((page, index) => {
        const row = document.createElement('div');
        row.className = 'page-row';
        if (index === area.currentPageIndex) {
            row.classList.add('active');
        }
        row.draggable = true;
        row.dataset.index = index;

        const handle = document.createElement('div');
        handle.className = 'page-drag-handle';
        handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
        
        const label = document.createElement('div');
        label.textContent = `Page ${index + 1}`;
        label.style.flex = '1';

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'page-delete-btn';
        deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.padding = '4px';
        deleteBtn.style.color = '#ef4444';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.opacity = '0.6';
        deleteBtn.onmouseenter = () => deleteBtn.style.opacity = '1';
        deleteBtn.onmouseleave = () => deleteBtn.style.opacity = '0.6';
        deleteBtn.onpointerdown = (e) => e.stopPropagation();

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (area.pages.length <= 1) {
                alert("Cannot delete the last page.");
                return;
            }
            if (confirm(`Are you sure you want to delete Page ${index + 1}?`)) {
                area.pages.splice(index, 1);
                if (area.currentPageIndex >= area.pages.length) {
                    area.currentPageIndex = Math.max(0, area.pages.length - 1);
                }
                saveCurrentFabric();
                scheduleRender();
                renderPagesList(area);
            }
        });

        row.appendChild(handle);
        row.appendChild(label);
        row.appendChild(deleteBtn);

        row.addEventListener('click', () => {
            startScrollBoxAnimation(area, index);
            renderPagesList(area);
        });

        row.addEventListener('dragstart', (e) => {
            window.isInternalDrag = true;
            draggedItem = row;
            setTimeout(() => row.classList.add('dragging'), 0);
        });

        row.addEventListener('dragend', (e) => {
            window.isInternalDrag = false;
            row.classList.remove('dragging');
            draggedItem = null;
            document.querySelectorAll('.page-row').forEach(r => r.classList.remove('drag-over'));
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.classList.add('drag-over');
        });

        row.addEventListener('dragleave', (e) => {
            row.classList.remove('drag-over');
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('drag-over');
            if (!draggedItem || draggedItem === row) return;
            
            const fromIndex = parseInt(draggedItem.dataset.index);
            const toIndex = parseInt(row.dataset.index);
            
            const [movedPage] = area.pages.splice(fromIndex, 1);
            area.pages.splice(toIndex, 0, movedPage);
            
            if (area.currentPageIndex === fromIndex) {
                area.currentPageIndex = toIndex;
            } else if (fromIndex < area.currentPageIndex && toIndex >= area.currentPageIndex) {
                area.currentPageIndex--;
            } else if (fromIndex > area.currentPageIndex && toIndex <= area.currentPageIndex) {
                area.currentPageIndex++;
            }
            
            saveCurrentFabric();
            scheduleRender();
            renderPagesList(area);
        });

        container.appendChild(row);
    });
}

// ===== DASHBOARD EDIT MODE (Popup) =====
function enterDashboardEditMode(area) {
    state.editingDashboardId = area.id;
    
    // Save current camera so we can restore on exit
    state._savedCamera = {
        x: state.camera.x,
        y: state.camera.y,
        zoom: state.camera.zoom
    };
    
    // Show modal
    const modal = document.getElementById('dashboard-edit-modal');
    modal.style.display = 'flex';
    
    // Initialize extra options UI
    const deBg = document.getElementById('de-opt-bg');
    const deGrid = document.getElementById('de-opt-grid');
    const deSnap = document.getElementById('de-opt-snap');
    if (deBg) deBg.value = area.color || '#1e1e1e';
    if (deGrid) deGrid.value = state.gridSize || 40;
    if (deSnap) deSnap.checked = state.snapToGrid !== false;
    
    renderPagesList(area);
    
    // Hide the main toolbar so it doesn't show behind the popup
    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.style.display = 'none';
    
    // Calculate the bounding box of the dashboard area
    const polys = area.polygons || (area.points ? [area.points] : []);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let p of polys) {
        for (let pt of p) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
        }
    }
    const w = maxX - minX;
    const h = maxY - minY;
    
    // Get the canvas area rect (the transparent hole in the popup)
    const canvasArea = document.getElementById('dashboard-edit-canvas-area');
    if (!canvasArea) return;
    
    // Wait a frame for layout to settle, then zoom
    requestAnimationFrame(() => {
        const areaRect = canvasArea.getBoundingClientRect();
        const workspaceRect = workspace.getBoundingClientRect();
        
        // Calculate zoom to fit the dashboard content in the visible canvas area
        const padding = 40;
        const scaleX = (areaRect.width - padding * 2) / w;
        const scaleY = (areaRect.height - padding * 2) / h;
        const targetZoom = Math.min(scaleX, scaleY, 2.5);
        
        // We need the dashboard center to appear at the center of the canvas area hole.
        const dashCenterX = minX + w / 2;
        const dashCenterY = minY + h / 2;
        const holeCenterX = areaRect.left + areaRect.width / 2;
        const holeCenterY = areaRect.top + areaRect.height / 2;
        
        const targetCamX = holeCenterX - dashCenterX * targetZoom - workspaceRect.width / 2;
        const targetCamY = holeCenterY - dashCenterY * targetZoom - workspaceRect.height / 2;
        
        startCameraAnimation(targetCamX, targetCamY, targetZoom);
    });
}

function exitDashboardEditMode() {
    state.editingDashboardId = null;
    
    const modal = document.getElementById('dashboard-edit-modal');
    modal.style.display = 'none';
    
    // Show the main toolbar again
    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.style.display = 'flex';
    
    // Restore camera
    if (state._savedCamera) {
        startCameraAnimation(state._savedCamera.x, state._savedCamera.y, state._savedCamera.zoom);
        state._savedCamera = null;
    }
}

// Done button
document.getElementById("btn-exit-dashboard-edit")?.addEventListener("click", exitDashboardEditMode);

// Dashboard edit tool buttons - update active state and set mode


document.getElementById("de-opt-apply")?.addEventListener("click", () => {
    const deBg = document.getElementById('de-opt-bg');
    const deGrid = document.getElementById('de-opt-grid');
    const deSnap = document.getElementById('de-opt-snap');
    
    if (deBg && state.editingDashboardId) {
        const area = state.areas.find(a => a.id === state.editingDashboardId);
        if (area) area.color = deBg.value;
    }
    if (deGrid) state.gridSize = parseInt(deGrid.value, 10) || 40;
    if (deSnap) state.snapToGrid = deSnap.checked;
    
    saveCurrentFabric();
    syncScrollBoxes();
    scheduleRender();
    uploadProgress.finish();
});

// ===== MISSION CONTROL REMOVED =====




// ===== DOCX PREVIEW =====
function loadDocxJs() {
    return new Promise((resolve) => {
        if (window.docx) return resolve();
        
        const scriptJszip = document.createElement('script');
        scriptJszip.src = 'https://unpkg.com/jszip/dist/jszip.min.js';
        
        scriptJszip.onload = () => {
            const scriptDocx = document.createElement('script');
            scriptDocx.src = 'https://unpkg.com/docx-preview/dist/docx-preview.min.js';
            scriptDocx.onload = resolve;
            document.head.appendChild(scriptDocx);
        };
        
        document.head.appendChild(scriptJszip);
    });
}

async function openDocxPreview(fileData) {
    const existingModal = document.getElementById('pdf-preview-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'pdf-preview-modal';
    modal.className = 'pdf-modal-overlay';
    
    modal.innerHTML = `
        <div class="pdf-modal">
            <div class="pdf-modal-header">
                <div class="pdf-modal-title">
                    <span class="pdf-modal-icon">📄</span>
                    <span class="pdf-modal-filename">${fileData.name}</span>
                </div>
                <div class="pdf-modal-controls">
                    <button class="pdf-action-btn pdf-download-btn" id="docx-download" title="Download">💾 Download</button>
                    <button class="pdf-action-btn pdf-close-btn" id="docx-close" title="Close">✖</button>
                </div>
            </div>
            <div class="pdf-modal-body" id="docx-viewer-container" style="background: #f0f0f0; overflow-y: auto; padding: 20px; flex: 1;">
                <div class="pdf-loading">Loading Word Document...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Apply critical styles inline
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0',
        transition: 'opacity 0.2s ease'
    });
    
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
    
    const closeBtn = modal.querySelector('#docx-close');
    const downloadBtn = modal.querySelector('#docx-download');
    const container = modal.querySelector('#docx-viewer-container');
    
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    });
    
    await loadDocxJs();
    
    try {
        if (!currentSourcesHandle) throw new Error("Workspace not connected");
        
        let sourceFileHandle = null;
        if (fileData.areaId) {
            const area = state.areas.find(a => a.id === fileData.areaId);
            /* Flat storage: removed area subdirectories */
        }
        if (!sourceFileHandle) {
            sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
        }
        
        const file = await sourceFileHandle.getFile();
        
        downloadBtn.addEventListener('click', () => {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileData.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        container.innerHTML = '';
        await docx.renderAsync(file, container);
    } catch (err) {
        console.error("DOCX load error", err);
        container.innerHTML = `<div class="pdf-loading" style="color:#ef4444;">Failed to load DOCX: ${err.message}</div>`;
    }
}

async function openCodePreview(fileData) {
    const existingModal = document.getElementById('pdf-preview-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'pdf-preview-modal';
    modal.className = 'pdf-modal-overlay';
    
    modal.innerHTML = `
        <div class="pdf-modal">
            <div class="pdf-modal-header">
                <div class="pdf-modal-title">
                    <span class="pdf-modal-icon">📄</span>
                    <span class="pdf-modal-filename">${fileData.name}</span>
                </div>
                <div class="pdf-modal-controls">
                    <button class="pdf-action-btn pdf-download-btn" id="code-download" title="Download">⬇️ Download</button>
                    <button class="pdf-action-btn pdf-close-btn" id="code-close" title="Close">❌</button>
                </div>
            </div>
            <div class="pdf-modal-body" id="code-viewer-container" style="background: #1e1e1e; color: #d4d4d4; overflow-y: auto; padding: 20px; flex: 1; font-family: monospace; font-size: 14px; text-align: left; white-space: pre-wrap; word-wrap: break-word;">
                <div class="pdf-loading">Loading File...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.8)', zIndex: '10000', display: 'flex',
        justifyContent: 'center', alignItems: 'center', opacity: '1'
    });
    
    const modalBox = modal.querySelector('.pdf-modal');
    if (modalBox) {
        Object.assign(modalBox.style, {
            background: '#fff', width: '80%', height: '80%', display: 'flex',
            flexDirection: 'column', borderRadius: '8px', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        });
    }
    
    const header = modal.querySelector('.pdf-modal-header');
    if (header) {
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', background: '#333', color: '#fff'
        });
    }
    
    document.getElementById('code-close').addEventListener('click', () => modal.remove());
    
    try {
        if (typeof currentSourcesHandle === 'undefined' || !currentSourcesHandle) {
            throw new Error("Workspace not fully loaded. Try restoring the workspace access.");
        }
        let sourceFileHandle = null;
        if (fileData.sourceFileId) {
             const srcFile = state.files.find(f => f.id === fileData.sourceFileId);
             if (srcFile) sourceFileHandle = await currentSourcesHandle.getFileHandle(srcFile.name);
        }
        if (!sourceFileHandle) {
             sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
        }
        const file = await sourceFileHandle.getFile();
        
        document.getElementById('code-download').addEventListener('click', () => {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        const text = await file.text();
        const container = document.getElementById('code-viewer-container');
        
        if (file.name.toLowerCase().endsWith('.ipynb')) {
            try {
                const notebook = JSON.parse(text);
                let html = '<div style="max-width: 800px; margin: 0 auto; color: #333; background: #fff; padding: 20px; border-radius: 8px;">';
                for (const cell of (notebook.cells || [])) {
                    let source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                    source = String(source);
                    
                    if (cell.cell_type === 'markdown') {
                        const parsedMarkdown = typeof marked !== 'undefined' ? marked.parse(source) : source.replace(/\n/g, '<br>');
                        html += `<div class="notebook-markdown" style="margin-bottom: 15px; font-family: 'Inter', sans-serif;">${parsedMarkdown}</div>`;
                    } else if (cell.cell_type === 'code') {
                        html += `<pre style="background: #f5f5f5; border: 1px solid #ccc; padding: 10px; border-radius: 4px; overflow-x: auto; color: #333; margin-bottom: 5px;"><code>${source.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
                        if (cell.outputs && cell.outputs.length > 0) {
                            for (const out of cell.outputs) {
                                if (out.output_type === 'stream') {
                                    let outText = Array.isArray(out.text) ? out.text.join('') : (out.text || '');
                                    outText = String(outText);
                                    html += `<pre style="background: #fff; border-left: 3px solid #007bff; padding: 5px 10px; margin-bottom: 15px; font-size: 12px; color: #555; overflow-x: auto;">${outText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                                } else if (out.data) {
                                    if (out.data['text/html']) {
                                        const outHtml = Array.isArray(out.data['text/html']) ? out.data['text/html'].join('') : (out.data['text/html'] || '');
                                        html += `<div style="margin-bottom: 15px; overflow-x: auto;">${outHtml}</div>`;
                                    } else if (out.data['image/png']) {
                                        const b64 = Array.isArray(out.data['image/png']) ? out.data['image/png'].join('').replace(/\n/g, '') : (out.data['image/png'] || '').replace(/\n/g, '');
                                        html += `<img src="data:image/png;base64,${b64}" style="max-width: 100%; margin-bottom: 15px;">`;
                                    } else if (out.data['text/plain']) {
                                        let outText = Array.isArray(out.data['text/plain']) ? out.data['text/plain'].join('') : (out.data['text/plain'] || '');
                                        outText = String(outText);
                                        html += `<pre style="background: #fff; padding: 5px 10px; margin-bottom: 15px; font-size: 12px; color: #555; overflow-x: auto;">${outText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                                    }
                                }
                            }
                        }
                    }
                }
                html += '</div>';
                container.innerHTML = html;
                container.style.background = '#e5e7eb';
            } catch (e) {
                container.textContent = "Error parsing notebook JSON: " + e.message + "\\n\\n" + text;
            }
        } else {
            container.innerHTML = `<pre style="margin: 0; padding: 0;"><code>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        }
        
    } catch (err) {
        document.getElementById('code-viewer-container').textContent = "Failed to load file content: " + err.message;
        console.error(err);
    }
}


// Upload Progress definition moved to top of file

// ==========================================
// Edge Screen Sidebar Logic
// ==========================================

window.activeEdgeFolderId = null;

function openEdgeSidebar(folderId) {
    const folder = state.areas.find(a => a.id === folderId);
    if (!folder) return;

    window.activeEdgeFolderId = folderId;
    const sidebar = document.getElementById('edge-sidebar');

    if (sidebar) sidebar.classList.add('active');
    openSidePanel('edge'); // also updates the header title/tab-switcher via applySidePanelStackVisuals()

    renderEdgeSidebar(folderId);
}

function closeEdgeSidebar() {
    window.activeEdgeFolderId = null;
    const sidebar = document.getElementById('edge-sidebar');
    if (sidebar) sidebar.classList.remove('active');
    isEdgeSidebarEditMode = false;
    const editBtn = document.getElementById('edge-sidebar-edit-mode');
    if (editBtn) {
        editBtn.textContent = 'Edit';
        editBtn.classList.remove('active');
    }
}

var isEdgeSidebarEditMode = false;

// Builds one file-list row: icon/name/meta, optional delete button, drag-out-to-canvas
// (clones the file at the drop position rather than moving it), and double-click-to-open
// (PDF/pinned-page/YouTube/docx/code preview, or download fallback). Shared by the Edge
// Sidebar and the Folder widget so this ~150-line block of logic isn't duplicated.
//   editable        — show the delete button and edit-mode cursor/border styling
//   allowDragOut     — wire up the pointerdown drag-past-threshold clone gesture
//   onDeleteConfirmed(fileData) — called after the user confirms deletion; the caller is
//                       responsible for mutating its own containedFiles/state.files/DOM and
//                       re-rendering (different callers own different lists)
function buildFileListItemEl(fileData, { editable = false, allowDragOut = false, onDeleteConfirmed = null } = {}) {
    const itemEl = document.createElement('div');
    itemEl.className = 'edge-sidebar-item';

    let iconHtml = '📄';
    if (fileData.type && fileData.type.startsWith('image/')) {
        iconHtml = `<img src="${fileData.data}" alt="${fileData.name}">`;
    } else if (fileData.type === 'link') {
        iconHtml = '🔗';
    } else if (fileData.type === 'youtube') {
        iconHtml = '▶️';
    } else if (fileData.type === 'text') {
        iconHtml = '📝';
    }

    const sizeStr = fileData.size ? (fileData.size / 1024).toFixed(1) + ' KB' : '';
    let typeStr = 'file';
    if (fileData.name && fileData.name.includes('.')) {
        typeStr = '.' + fileData.name.split('.').pop().toLowerCase();
    } else if (fileData.type) {
        typeStr = fileData.type.split('/')[0];
    }

    const deleteBtnHtml = editable
        ? `<div class="edge-item-delete" title="Delete file">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
           </div>`
        : '';

    itemEl.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%;">
            <div class="edge-item-icon">${iconHtml}</div>
            <div class="edge-item-details" style="flex: 1; overflow: hidden; white-space: nowrap;">
                <div class="edge-item-name" title="${fileData.name}">${fileData.name}</div>
                <div class="edge-item-meta">
                    <span>${typeStr}</span>
                    ${sizeStr ? `<span>•</span><span>${sizeStr}</span>` : ''}
                </div>
            </div>
            ${deleteBtnHtml}
        </div>
    `;

    // Delete + drag-out logic
    itemEl.addEventListener('pointerdown', (e) => {
        if (editable && e.target.closest('.edge-item-delete')) {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Delete this file permanently?') && onDeleteConfirmed) {
                onDeleteConfirmed(fileData);
            }
            return;
        }

        if (!allowDragOut) return;

        e.preventDefault();
        e.stopPropagation();

        let startX = e.clientX;
        let startY = e.clientY;
        let hasDragged = false;

        const onMove = (moveEv) => {
            if (!hasDragged && Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY) > 5) {
                hasDragged = true;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                // Copy file to fabric instead of moving
                const newFileId = Date.now() + Math.random().toString(36).substr(2, 5);
                const newFileData = { ...fileData };
                newFileData.id = newFileId;
                newFileData.isHidden = false;
                newFileData.areaId = null;
                newFileData.areaName = 'Unassigned';

                const worldPos = screenToWorld(startX, startY);
                newFileData.x = worldPos.x;
                newFileData.y = worldPos.y;

                state.files.push(newFileData);
                renderFileItem(newFileData);

                saveCurrentFabric();

                // Trigger native drag on the cloned canvas element
                requestAnimationFrame(() => {
                    const actualFileEl = document.getElementById('file-' + newFileId);
                    if (actualFileEl) {
                        const newEvent = new PointerEvent('pointerdown', {
                            clientX: moveEv.clientX,
                            clientY: moveEv.clientY,
                            pointerId: moveEv.pointerId,
                            bubbles: true,
                            cancelable: true
                        });
                        actualFileEl.dispatchEvent(newEvent);
                    }
                });
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    });

    // Open logic (disabled while the caller is in its own edit mode, matching the original
    // Edge Sidebar behavior — avoids accidental opens while rearranging/deleting)
    itemEl.addEventListener('dblclick', async (e) => {
        if (editable) return;
        e.stopPropagation();

        if (fileData.isPdf) {
            if (typeof openPdfPreview === 'function') openPdfPreview(fileData);
        } else if (fileData.isPinnedPdfPage) {
            const sourceFile = state.files.find(f => f.id === fileData.sourceFileId);
            if (sourceFile && typeof openPdfPreview === 'function') openPdfPreview(sourceFile);
        } else if (fileData.isYoutube) {
            window.open(fileData.youtubeUrl, '_blank');
        } else {
            if (typeof currentSourcesHandle === 'undefined' || !currentSourcesHandle) {
                alert("Workspace not fully loaded. Try restoring the workspace access.");
                return;
            }
            try {
                const sourceFileHandle = await currentSourcesHandle.getFileHandle(fileData.name);
                const file = await sourceFileHandle.getFile();
                const lowerName = file.name.toLowerCase();
                if (lowerName.endsWith('.docx') && typeof openDocxPreview === 'function') {
                    openDocxPreview(fileData);
                } else if (['.py', '.ipynb', '.js', '.json', '.html', '.css', '.md', '.csv'].some(ext => lowerName.endsWith(ext)) && typeof openCodePreview === 'function') {
                    openCodePreview(fileData);
                } else {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            } catch (err) {
                console.warn(err);
            }
        }
    });

    if (editable) {
        itemEl.style.cursor = 'grab';
        itemEl.title = 'Drag to move out of folder';
        itemEl.style.border = '1px dashed rgba(255,255,255,0.3)';
    } else {
        itemEl.style.cursor = allowDragOut ? 'grab' : 'pointer';
        itemEl.title = allowDragOut ? 'Drag out, or double-click to open' : 'Double-click to open';
        itemEl.style.border = '';
    }

    return itemEl;
}

function renderEdgeSidebar(folderId) {
    const content = document.getElementById('edge-sidebar-content');
    if (!content) return;

    content.innerHTML = '';

    const folder = state.areas.find(a => a.id === folderId);
    if (!folder || !folder.containedFiles || folder.containedFiles.length === 0) {
        content.innerHTML = '<div class="edge-empty-state">Folder is empty.<br>Drag files onto the folder icon to add them.</div>';
        return;
    }

    // Get actual file objects
    const folderFiles = folder.containedFiles.map(id => state.files.find(f => f.id === id)).filter(Boolean);

    folderFiles.forEach(fileData => {
        const itemEl = buildFileListItemEl(fileData, {
            editable: isEdgeSidebarEditMode,
            allowDragOut: isEdgeSidebarEditMode,
            onDeleteConfirmed: (fd) => {
                folder.containedFiles = folder.containedFiles.filter(id => id !== fd.id);
                state.files = state.files.filter(f => f.id !== fd.id);
                const domEl = document.getElementById('file-' + fd.id);
                if (domEl) domEl.remove();
                saveCurrentFabric();
                renderEdgeSidebar(folderId);
                refreshFolderWidgets(folderId);
            }
        });
        content.appendChild(itemEl);
    });
}

function toggleEdgeSidebarEditMode() {
    isEdgeSidebarEditMode = !isEdgeSidebarEditMode;
    const editBtn = document.getElementById('edge-sidebar-edit-mode');
    if (editBtn) {
        editBtn.textContent = isEdgeSidebarEditMode ? 'Done' : 'Edit';
        editBtn.classList.toggle('active', isEdgeSidebarEditMode);
    }
    if (window.activeEdgeFolderId) {
        renderEdgeSidebar(window.activeEdgeFolderId);
    }
}

// ==========================================
// Widget Sidebar Logic (Shift+S)
// ==========================================
// A customizable, screen-fixed panel independent of canvas position/zoom — the user adds
// widget "cards" (calendar, clock, notes, progress bar, folder, text, rect) that stack
// vertically and persist with the fabric via state.sidebarWidgets.
let isWidgetSidebarEditMode = false;

function openWidgetSidebar() {
    const sidebar = document.getElementById('widget-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('active');
    openSidePanel('widgets');
    renderWidgetSidebar();
}

function closeWidgetSidebar() {
    const sidebar = document.getElementById('widget-sidebar');
    if (sidebar) sidebar.classList.remove('active');
    isWidgetSidebarEditMode = false;
    closeWidgetAddMenu();
}

// Shift+S toggles visibility, not a full close — consistent with Escape/click-outside,
// so the widget sidebar stays selectable via the header tab switcher either way. Only the
// explicit close (×) button fully closes it (see closeSidePanel).
function toggleWidgetSidebar() {
    if (sidePanelStack.includes('widgets')) hideSidePanel('widgets');
    else openWidgetSidebar();
}

function toggleWidgetSidebarEditMode() {
    isWidgetSidebarEditMode = !isWidgetSidebarEditMode;
    const editBtn = document.getElementById('widget-sidebar-edit-mode');
    if (editBtn) editBtn.classList.toggle('active', isWidgetSidebarEditMode);
    renderWidgetSidebar();
}

// ---- Widget type registry ----
// Each type has: a label + icon for the add-menu, a factory for default field values on
// creation, and a renderer(bodyEl, widget) that fills in a card's content. Renderers are
// added incrementally as each widget type is built; WIDGET_RENDERERS_PENDING covers any
// type not implemented yet so the sidebar never crashes on an unfinished type.
const WIDGET_LABELS = {
    calendar: 'Calendar', clock: 'Clock', notes: 'Notes',
    progress_bar: 'Progress Bar', folder: 'Folder', text: 'Text', rect: 'Rectangle'
};

const WIDGET_ICONS = {
    calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    notes: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    progress_bar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10" width="20" height="6" rx="3" ry="3"></rect><rect x="2" y="10" width="12" height="6" rx="3" ry="3" fill="currentColor"></rect></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    text: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    rect: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>'
};

function createDefaultWidget(type) {
    const id = 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const base = { id, type };
    switch (type) {
        case 'calendar': {
            const now = new Date();
            return Object.assign(base, { viewMonth: now.getMonth(), viewYear: now.getFullYear(), schedules: {} });
        }
        case 'clock': return base;
        case 'notes': return Object.assign(base, { textContent: '' });
        case 'progress_bar': return Object.assign(base, { label: 'My Task', value: 50 });
        case 'folder': return Object.assign(base, { areaId: null });
        case 'text': return Object.assign(base, { content: 'My Tasks', size: 'heading' });
        case 'rect': return Object.assign(base, { color: '#4f46e5', height: 80 });
        default: return base;
    }
}

function renderPendingWidget(body, widget) {
    body.innerHTML = `<div class="widget-pending">${WIDGET_LABELS[widget.type] || widget.type} widget coming soon.</div>`;
}

// Populated incrementally as each widget type's renderer is implemented.
const WIDGET_RENDERERS = {
    calendar: renderCalendarWidget,
    clock: renderClockWidget,
    notes: renderNotesWidget,
    progress_bar: renderProgressBarWidget,
    folder: renderFolderWidget,
    text: renderTextWidget,
    rect: renderRectWidget
};

function renderWidgetSidebar() {
    const content = document.getElementById('widget-sidebar-content');
    if (!content) return;
    content.innerHTML = '';

    const widgets = state.sidebarWidgets || [];
    if (widgets.length === 0) {
        content.innerHTML = '<div class="widget-sidebar-empty">No widgets yet.<br>Tap + above to add one.</div>';
        return;
    }

    widgets.forEach((widget) => {
        const card = document.createElement('div');
        card.className = 'widget-card widget-card-' + widget.type;
        card.dataset.widgetId = widget.id;

        if (isWidgetSidebarEditMode) {
            card.classList.add('widget-card-edit');
            const chrome = document.createElement('div');
            chrome.className = 'widget-card-chrome';
            chrome.innerHTML = `
                <div class="widget-drag-handle" title="Drag to reorder">⠿</div>
                <span class="widget-card-type-label">${WIDGET_LABELS[widget.type] || widget.type}</span>
                <button class="widget-remove-btn" title="Remove widget">&times;</button>
            `;
            chrome.querySelector('.widget-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = state.sidebarWidgets.findIndex(w => w.id === widget.id);
                if (idx !== -1) state.sidebarWidgets.splice(idx, 1);
                saveCurrentFabric();
                renderWidgetSidebar();
            });
            card.appendChild(chrome);
            setupWidgetDrag(card, chrome.querySelector('.widget-drag-handle'));
        }

        const body = document.createElement('div');
        body.className = 'widget-card-body';
        const renderer = WIDGET_RENDERERS[widget.type] || renderPendingWidget;
        renderer(body, widget);
        card.appendChild(body);

        content.appendChild(card);
    });
}

// Manual pointer-based reorder: dragging the handle swaps the card's DOM position against
// whichever sibling's vertical midpoint the cursor crosses, then commits the new order into
// state.sidebarWidgets on release (same hand-rolled approach the app already uses elsewhere,
// e.g. the Edge Sidebar's file drag-out — no drag-and-drop library in this codebase).
function setupWidgetDrag(card, handle) {
    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const content = document.getElementById('widget-sidebar-content');
        if (!content) return;
        card.classList.add('widget-card-dragging');
        handle.setPointerCapture(e.pointerId);

        const onMove = (me) => {
            const siblings = Array.from(content.children).filter(el => el !== card);
            for (const sib of siblings) {
                const rect = sib.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                if (me.clientY < mid && sib.previousElementSibling !== card) {
                    content.insertBefore(card, sib);
                    break;
                } else if (me.clientY >= mid && sib.nextElementSibling !== card) {
                    content.insertBefore(card, sib.nextElementSibling);
                    break;
                }
            }
        };
        const onUp = () => {
            card.classList.remove('widget-card-dragging');
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            const newOrder = Array.from(content.children).map(el => el.dataset.widgetId);
            state.sidebarWidgets.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            saveCurrentFabric();
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
    });
}

function openWidgetAddMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('widget-add-menu');
    if (!menu) return;

    const isOpen = !menu.classList.contains('hidden');
    if (isOpen) { closeWidgetAddMenu(); return; }

    menu.innerHTML = Object.keys(WIDGET_LABELS).map(type => `
        <div class="widget-add-menu-item" data-type="${type}">
            ${WIDGET_ICONS[type]}
            <span>${WIDGET_LABELS[type]}</span>
        </div>
    `).join('');

    menu.querySelectorAll('.widget-add-menu-item').forEach(item => {
        item.addEventListener('click', (ie) => {
            ie.stopPropagation();
            const type = item.dataset.type;
            state.sidebarWidgets = state.sidebarWidgets || [];
            state.sidebarWidgets.push(createDefaultWidget(type));
            saveCurrentFabric();
            renderWidgetSidebar();
            closeWidgetAddMenu();
        });
    });

    menu.classList.remove('hidden');
    setTimeout(() => document.addEventListener('click', closeWidgetAddMenuOnOutsideClick), 0);
}

function closeWidgetAddMenuOnOutsideClick(e) {
    const menu = document.getElementById('widget-add-menu');
    const addBtn = document.getElementById('widget-sidebar-add');
    if (menu && !menu.contains(e.target) && e.target !== addBtn) closeWidgetAddMenu();
}

function closeWidgetAddMenu() {
    const menu = document.getElementById('widget-add-menu');
    if (menu) menu.classList.add('hidden');
    document.removeEventListener('click', closeWidgetAddMenuOnOutsideClick);
}

// ---- Text widget ----
function renderTextWidget(body, widget) {
    body.innerHTML = `<div class="text-widget text-widget-${widget.size || 'heading'}" contenteditable="true">${widget.content || ''}</div>`;
    const el = body.querySelector('.text-widget');
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('blur', () => {
        widget.content = el.textContent;
        saveCurrentFabric();
    });
}

// ---- Rectangle widget ----
function renderRectWidget(body, widget) {
    const swatches = PRESET_COLORS.filter(c => c !== 'transparent').slice(0, 8);
    body.innerHTML = `
        <div class="rect-widget" style="background:${widget.color}; height:${widget.height}px"></div>
        <div class="rect-widget-controls">
            <div class="rect-widget-swatches">
                ${swatches.map(c => `<div class="rect-widget-swatch" data-color="${c}" style="background:${c}"></div>`).join('')}
            </div>
            <div class="rect-widget-height-stepper">
                <button class="rect-widget-step" data-dir="-1">&minus;</button>
                <span>${widget.height}px</span>
                <button class="rect-widget-step" data-dir="1">+</button>
            </div>
        </div>
    `;
    const block = body.querySelector('.rect-widget');
    body.querySelectorAll('.rect-widget-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            widget.color = sw.dataset.color;
            block.style.background = widget.color;
            saveCurrentFabric();
        });
    });
    body.querySelectorAll('.rect-widget-step').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dir = parseInt(btn.dataset.dir, 10);
            widget.height = Math.max(20, Math.min(300, widget.height + dir * 20));
            saveCurrentFabric();
            renderRectWidget(body, widget);
        });
    });
}

// ---- Clock widget ----
// Progress bar / clock have no DOM representation elsewhere in the app (canvas-only there),
// so these are new implementations from scratch, not adapted from existing code.
let clockWidgetTickerStarted = false;
function startClockWidgetTicker() {
    if (clockWidgetTickerStarted) return;
    clockWidgetTickerStarted = true;
    // One shared interval updates every clock widget currently in the DOM, instead of a
    // setInterval per widget instance — avoids per-widget cleanup/leak bookkeeping entirely.
    setInterval(updateAllClockWidgets, 1000);
}
function updateAllClockWidgets() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
    document.querySelectorAll('.clock-widget .clock-time').forEach(el => { el.textContent = timeStr; });
    document.querySelectorAll('.clock-widget .clock-date').forEach(el => { el.textContent = dateStr; });
}
function renderClockWidget(body, widget) {
    body.innerHTML = `<div class="clock-widget"><div class="clock-time"></div><div class="clock-date"></div></div>`;
    startClockWidgetTicker();
    updateAllClockWidgets(); // paint immediately instead of waiting up to 1s for the first tick
}

// ---- Progress bar widget ----
function renderProgressBarWidget(body, widget) {
    body.innerHTML = `
        <div class="progress-widget">
            <div class="progress-widget-label" contenteditable="true">${widget.label || ''}</div>
            <div class="progress-widget-track">
                <div class="progress-widget-fill" style="width:${widget.value}%"></div>
            </div>
            <div class="progress-widget-value">${widget.value}%</div>
        </div>
    `;
    const label = body.querySelector('.progress-widget-label');
    const track = body.querySelector('.progress-widget-track');
    const fill = body.querySelector('.progress-widget-fill');
    const valueEl = body.querySelector('.progress-widget-value');

    label.addEventListener('pointerdown', (e) => e.stopPropagation());
    label.addEventListener('blur', () => {
        widget.label = label.textContent;
        saveCurrentFabric();
    });

    track.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const setFromEvent = (pe) => {
            const rect = track.getBoundingClientRect();
            const pct = Math.round(Math.max(0, Math.min(1, (pe.clientX - rect.left) / rect.width)) * 100);
            widget.value = pct;
            fill.style.width = pct + '%';
            valueEl.textContent = pct + '%';
        };
        setFromEvent(e);
        track.setPointerCapture(e.pointerId);
        const onMove = (me) => setFromEvent(me);
        const onUp = () => {
            track.removeEventListener('pointermove', onMove);
            track.removeEventListener('pointerup', onUp);
            saveCurrentFabric();
        };
        track.addEventListener('pointermove', onMove);
        track.addEventListener('pointerup', onUp);
    });
}

// ---- Notes widget ----
// A new, self-contained implementation (not the canvas notepad's syncNotesDOM/polygon-based
// version) — same markdown-lite syntax (# headings, - [ ]/- [x] checkboxes) for familiarity,
// but keyed off widget.textContent directly instead of a polygon bounding box.
function renderNotesWidgetDisplay(display, editor) {
    const lines = editor.value.split('\n');
    display.innerHTML = lines.map((line, index) => {
        const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
        if (headingMatch) {
            const sizes = { 1: 18, 2: 16, 3: 15, 4: 14, 5: 13, 6: 13 };
            const fs = sizes[headingMatch[1].length] || 13;
            return `<div class="notes-widget-heading" style="font-size:${fs}px">${headingMatch[2]}</div>`;
        }
        const cbMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
        if (cbMatch) {
            const isChecked = cbMatch[2].toLowerCase() === 'x';
            return `<div class="notes-widget-line notes-widget-checkbox-line">
                <input type="checkbox" data-line-index="${index}" ${isChecked ? 'checked' : ''}>
                <span class="${isChecked ? 'notes-widget-checked-text' : ''}">${cbMatch[3]}</span>
            </div>`;
        }
        return `<div class="notes-widget-line">${line || '&nbsp;'}</div>`;
    }).join('');
}

function renderNotesWidget(body, widget) {
    body.innerHTML = `
        <div class="notes-widget">
            <div class="notes-widget-display"></div>
            <textarea class="notes-widget-editor" spellcheck="false" placeholder="Type here...">${widget.textContent || ''}</textarea>
        </div>
    `;
    const wrapper = body.querySelector('.notes-widget');
    const display = body.querySelector('.notes-widget-display');
    const editor = body.querySelector('.notes-widget-editor');

    renderNotesWidgetDisplay(display, editor);
    if (!widget.textContent) wrapper.classList.add('notes-widget-editing'); // start empty notes in edit mode

    display.addEventListener('click', (e) => {
        if (e.target.matches('input[type=checkbox]')) return;
        wrapper.classList.add('notes-widget-editing');
        editor.focus();
    });
    display.addEventListener('pointerdown', (e) => e.stopPropagation());

    display.addEventListener('change', (e) => {
        if (!e.target.matches('input[type=checkbox]')) return;
        const idx = parseInt(e.target.dataset.lineIndex, 10);
        const lines = editor.value.split('\n');
        const cbMatch = lines[idx] && lines[idx].match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
        if (cbMatch) {
            lines[idx] = cbMatch[1] + (e.target.checked ? '- [x] ' : '- [ ] ') + cbMatch[3];
            editor.value = lines.join('\n');
            widget.textContent = editor.value;
            saveCurrentFabric();
            renderNotesWidgetDisplay(display, editor);
        }
    });

    editor.addEventListener('pointerdown', (e) => e.stopPropagation());
    editor.addEventListener('blur', () => {
        wrapper.classList.remove('notes-widget-editing');
        widget.textContent = editor.value;
        saveCurrentFabric();
        renderNotesWidgetDisplay(display, editor);
    });
}

// ---- Calendar widget ----
// A new, standalone implementation reusing the .cal-header/.cal-days-header/.cal-grid CSS
// classes for visual consistency with canvas calendars, but reading/writing widget.viewMonth/
// widget.viewYear/widget.schedules directly — deliberately NOT the shared state.calendarSync
// canvas calendars use, so each sidebar calendar widget navigates independently.
function renderCalendarWidget(body, widget) {
    if (widget.viewMonth === undefined || widget.viewYear === undefined) {
        const now = new Date();
        widget.viewMonth = now.getMonth();
        widget.viewYear = now.getFullYear();
    }
    if (!widget.schedules) widget.schedules = {};

    const date = new Date(widget.viewYear, widget.viewMonth, 1);
    const monthName = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();

    const today = new Date();
    const isCurrentMonth = today.getMonth() === widget.viewMonth && today.getFullYear() === widget.viewYear;
    const currentDay = today.getDate();

    let firstDay = date.getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysInMonth = new Date(widget.viewYear, widget.viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(widget.viewYear, widget.viewMonth, 0).getDate();

    let html = `
        <div class="cal-header">
            <div class="cal-title-nav">
                <div class="cal-nav-btn cal-prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></div>
                <div class="cal-title">${monthName} ${year}</div>
                <div class="cal-nav-btn cal-next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>
            </div>
        </div>
        <div class="cal-days-header">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <div class="cal-grid">
    `;

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-day prev-month">${daysInPrevMonth - firstDay + i + 1}</div>`;
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(widget.viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const scheduled = widget.schedules[dateStr];
        let classes = 'cal-day current-month';
        let style = '';
        if (isCurrentMonth && i === currentDay) classes += ' today';
        if (scheduled) { classes += ' scheduled'; style = `background-color:${scheduled}; border-color:${scheduled}; color:#fff;`; }
        html += `<div class="${classes}" data-date="${dateStr}" style="${style}"><span>${i}</span></div>`;
    }
    const totalCells = 42;
    const filledCells = firstDay + daysInMonth;
    for (let i = 1; i <= totalCells - filledCells; i++) {
        html += `<div class="cal-day next-month">${i}</div>`;
    }
    html += `</div>`;

    body.innerHTML = html;

    body.querySelector('.cal-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        widget.viewMonth--;
        if (widget.viewMonth < 0) { widget.viewMonth = 11; widget.viewYear--; }
        saveCurrentFabric();
        renderCalendarWidget(body, widget);
    });
    body.querySelector('.cal-next').addEventListener('click', (e) => {
        e.stopPropagation();
        widget.viewMonth++;
        if (widget.viewMonth > 11) { widget.viewMonth = 0; widget.viewYear++; }
        saveCurrentFabric();
        renderCalendarWidget(body, widget);
    });
    body.querySelectorAll('.cal-day.current-month').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateStr = dayEl.dataset.date;
            if (widget.schedules[dateStr]) {
                delete widget.schedules[dateStr];
            } else {
                const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f46e5';
                widget.schedules[dateStr] = accent;
            }
            saveCurrentFabric();
            renderCalendarWidget(body, widget);
        });
    });
    body.addEventListener('pointerdown', (e) => e.stopPropagation());
}

// ---- Folder widget ----
// Links to an EXISTING canvas folder area (user picks which one) and shows a live mini
// file-list of its contents, built on the same buildFileListItemEl() helper the Edge
// Sidebar uses. Read + drag-out only — no separate delete UI here, since deleting is
// already available by opening the same folder via the Edge Sidebar.
function renderFolderWidget(body, widget) {
    const folderAreas = state.areas.filter(a => a.isFolder);

    const options = folderAreas.map(a =>
        `<option value="${a.id}" ${a.id === widget.areaId ? 'selected' : ''}>${a.name}</option>`
    ).join('');

    body.innerHTML = `
        <select class="folder-widget-select">
            <option value="">Choose a folder…</option>
            ${options}
        </select>
        <div class="folder-widget-list"></div>
    `;

    const select = body.querySelector('.folder-widget-select');
    const list = body.querySelector('.folder-widget-list');
    select.addEventListener('pointerdown', (e) => e.stopPropagation());
    select.addEventListener('change', () => {
        widget.areaId = select.value || null;
        saveCurrentFabric();
        renderFolderWidgetList(list, widget);
    });

    renderFolderWidgetList(list, widget);
}

function renderFolderWidgetList(list, widget) {
    list.innerHTML = '';
    if (!widget.areaId) {
        list.innerHTML = '<div class="edge-empty-state">Pick a folder above.</div>';
        return;
    }
    const folder = state.areas.find(a => a.id === widget.areaId && a.isFolder);
    if (!folder) {
        list.innerHTML = '<div class="edge-empty-state">Folder not found — pick another.</div>';
        return;
    }
    if (!folder.containedFiles || folder.containedFiles.length === 0) {
        list.innerHTML = '<div class="edge-empty-state">Folder is empty.</div>';
        return;
    }
    const folderFiles = folder.containedFiles.map(id => state.files.find(f => f.id === id)).filter(Boolean);
    folderFiles.forEach(fileData => {
        const itemEl = buildFileListItemEl(fileData, { editable: false, allowDragOut: true });
        list.appendChild(itemEl);
    });
}

// Re-renders any currently-open Folder widget pointed at folderId — there's no pub/sub in
// this codebase, so mutation sites that change a folder's containedFiles call this
// explicitly, the same way renderEdgeSidebar() is already invoked imperatively elsewhere.
function refreshFolderWidgets(folderId) {
    const content = document.getElementById('widget-sidebar-content');
    if (!content) return;
    content.querySelectorAll('.widget-card-folder').forEach(card => {
        const widget = (state.sidebarWidgets || []).find(w => w.id === card.dataset.widgetId);
        if (widget && widget.areaId === folderId) {
            const list = card.querySelector('.folder-widget-list');
            if (list) renderFolderWidgetList(list, widget);
        }
    });
}

