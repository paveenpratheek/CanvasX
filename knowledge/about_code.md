# ABOUT THE CODE — Spatial File Manager (File Fabric)

---

## 📜 GUIDELINES FOR MAINTAINING THIS FILE

> **APPEND-ONLY** — Same rules as `project_progress.md`. Never delete entries.
> If code moves, add: `[MOVED on YYYY-MM-DD]: L_old → L_new`
> If a section is deleted, add: `[REMOVED on YYYY-MM-DD]`
> Line numbers are approximate — always verify before editing.
> After major edits (adding/removing 50+ lines), update affected line ranges below.

---

## 📂 FILES OVERVIEW

| File | Lines | Size | Purpose |
|---|---|---|---|
| `script.js` | ~9,658 | ~408 KB | All application logic — state, rendering, events, features |
| `style.css` | ~2,049 | ~41 KB | All CSS styles, animations, component styling |
| `index.html` | ~576 | ~39 KB | HTML structure, toolbars, ribbons, modals, templates |
| `manifest.json` | ~23 | ~516 B | PWA manifest |
| `sw.js` | small | ~454 B | Service worker (currently disabled on load) |
| `.agents/agents/scroll_box_implementer/agent.json` | small | | Scroll Box subagent configuration (Created 2026-07-04 to modularize feature development) |

**[UPDATED on 2026-07-21]** — current sizes after this session's optimization + bugfix work:

| File | Lines | Size |
|---|---|---|
| `script.js` | ~11,426 | ~491 KB |
| `style.css` | ~3,017 | ~67 KB |
| `index.html` | ~620 | ~43 KB |
| `manifest.json` | 22 | ~516 B |
| `sw.js` | 72 | ~2.1 KB |

Note: `sw.js` is no longer "disabled on load" (that row is stale from before the 2026-07-17 Network-First rebuild, see Changelog) — it's an active, working service worker.

---

## 🗺️ script.js — CODE MAP

### Global State & Initialization

| Section | Lines | Description |
|---|---|---|
| Application State (`state` object) | L1–L57 | Central state: mode, camera, areas, drawings, files, totems, tables, links, calendarSync |
| `spacePressed` flag | L59 | Tracks Space key for temp-pan |
| DOM Element References | L61–L98 | `workspace`, `canvas`, `ctx`, toolbar buttons, home screen elements |
| Upload Progress Ribbon | L99–L151 | `uploadProgress` object: `init()`, `start()`, `update()`, `finish()` |
| Modal Elements | L153–L174 | New fabric modal, elements ribbon, table config elements |
| Eraser Ribbon Elements | L176–L181 | Eraser mode buttons |
| Color Palette Setup | L182–L311 | `PRESET_COLORS[]`, palette popup, swatch click handlers for fabric/area/text/highlight/clock colors |
| Text Properties Panel Refs | L313–L330 | Font size, font family, bold/italic/align button references |

### Text Properties & Formatting

| Section | Lines | Description |
|---|---|---|
| `showPropertiesPanel()` | L332–L357 | Populates text properties ribbon from a text drawing |
| `hidePropertiesPanel()` | L359–L375 | Hides text/select ribbons, clears lasso |
| Font Size Handler | L377–L383 | Input range → updates `selectedText.fontSize` |
| Font Family Handler | L385–L390 | Select → updates `selectedText.fontFamily` |
| Bold/Italic/Border Toggles | L392–L414 | Click handlers for text style buttons |
| Text Alignment Handlers | L416–L444 | Left/center/right alignment buttons |
| Text/Highlight Color Dropdowns | L446–L464 | Pointer handlers to open color palette for text/highlight |

### Geometry & Hit-Testing Utilities

| Section | Lines | Description |
|---|---|---|
| `getPolygonArea()` | L468–L475 | Shoelace formula for polygon area |
| `getAreaSize()` | L477–L485 | Total area of all polygons in an area |
| Area Corner Hole Helpers | L487–L541 | `getAreaBBox()`, `getBezierBBox()`, `bboxOverlap()`, `getAreaCorners()`, `getNearestHole()` |
| `getLineFontSize()` | L543–L555 | Markdown heading → font size mapping |
| `getDraggableDrawingAt()` | L557–L591 | Hit-test drawings at a world position (text, progress bar, clock, calendar) |

### Text Editor

| Section | Lines | Description |
|---|---|---|
| `openTextEditor()` | L593–L740 | Inline textarea for creating/editing text drawings. YouTube URL detection and auto-creation. |

### Core Initialization

| Section | Lines | Description |
|---|---|---|
| `init()` | L742–L752 | Entry point: resizeCanvas, setup listeners, first render |
| `resizeCanvas()` | L754–L770 | High DPI canvas sizing via `devicePixelRatio` |

### Toolbar & Keyboard Shortcuts

| Section | Lines | Description |
|---|---|---|
| `setupToolbarListeners()` | L772–L955 | All toolbar button click handlers, color dropdowns, settings popup, graphics preset |
| Keyboard Shortcuts (keydown) | L910–L947 | `Space`=temp-pan, `Shift+R`=constellation, `V/H/T/N/L/A/R/S/C/E`=tools |
| Keyboard Shortcuts (keyup) | L949–L954 | Space release |
| **⚠️ Shift+D (Mission Control)** | **NOT PRESENT** | Was deleted. Should be added at ~L924-L928 (before modifier guard) |

### Mode Switching

| Section | Lines | Description |
|---|---|---|
| `updateColorIndicators()` | L957–L962 | Syncs color indicator dots |
| `setMode()` | L964–L1053 | Master mode switcher. Updates active buttons, instruction text, cursor, ribbons. |

### Workspace Event Listeners

| Section | Lines | Description |
|---|---|---|
| `setupWorkspaceListeners()` | L1055–L2310 | **LARGE BLOCK** — contains: |
| → Zoom (wheel) | L1056–L1074 | Mouse wheel zoom with focal-point preservation |
| → Right-click context menus | L1076–L1154 | Hit-test totems, drawings, areas → show appropriate context menu |
| → Double-click handlers | L1156–L1230 | Select area (marching ants), open folder sidebar, enter dashboard edit mode |
| → Pointer events (down/move/up) | L1230–L2310 | Drawing, panning, dragging areas/files/drawings, placing widgets, lasso selection, eraser, line/arrow/rect/circle drawing, box drawing, scroll box placement |

### File & Area Assignment

| Section | Lines | Description |
|---|---|---|
| `getFilesInPolygon()` | L2312–L2320 | Returns files within a polygon |
| `getItemCenter()` | L2322–L2328 | Gets center point of an item |
| `recalculateItemLinks()` | L2330–L2437 | Recalculates which files belong to which areas based on position |
| `findAssignedArea()` | L2439–L2462 | Finds the smallest area containing a point |
| `openNamePrompt()` | L2464–L2588 | Modal for naming new areas/folders with color picker |

### Drag & Drop (OS Files)

| Section | Lines | Description |
|---|---|---|
| `setupDragAndDrop()` | L2590–L2678 | Drag enter/over/leave/drop handlers for importing files from OS |

### Polygon & Collision Utilities

| Section | Lines | Description |
|---|---|---|
| `isPointInPolygon()` | L2680–L2691 | Ray-casting point-in-polygon test |
| `isAreaFullyInsidePolygon()` | L2693–L2717 | Check if an area is fully inside a lasso polygon |
| `isDrawingFullyInsidePolygon()` | L2719–L2758 | Check if a drawing is fully inside a lasso |
| `isFileFullyInsidePolygon()` | L2760–L2765 | File-in-polygon check |
| `isTotemFullyInsidePolygon()` | L2767–L2773 | Totem-in-polygon check |
| `doPolygonsOverlap()` | L2775–L2790 | Polygon overlap detection |

### File Type Detection & Icons

| Section | Lines | Description |
|---|---|---|
| `isImageFile()` | L2792–L2795 | Extension check for images |
| `isPdfFile()` | L2797–L2799 | Extension check for PDFs |
| `getFileIcon()` | L2801–L2812 | Returns SVG icon based on file extension |

### File Import Handlers

| Section | Lines | Description |
|---|---|---|
| `handleFolderDrop()` | L2814–L2923 | Processes folder drops: creates area, imports all files recursively |
| `handleFileDrop()` | L2925–L3079 | Processes single file drops: reads as blob/image/PDF, creates file data object |

### File Rendering

| Section | Lines | Description |
|---|---|---|
| `renderFileItem()` | L3081–L3662 | **LARGE** — Creates DOM for a file card. Handles: images, PDFs, pinned pages, YouTube, generic files. Includes options menu, note editing, drag handling, area badge. |

### PDF Preview

| Section | Lines | Description |
|---|---|---|
| `openPdfPreview()` | L3664–L3916 | Full PDF viewer modal with page navigation, zoom, page pinning, close handler |

### Context Menus

| Section | Lines | Description |
|---|---|---|
| **Progress Bar Context Menu** | L3917–L4017 | `dismissProgressBarContextMenu()`, `showClockContextMenu()`, `dismissClockContextMenu()` |
| **Progress Bar Edit Menu** | L4019–L4121 | `showProgressBarContextMenu()` — edit value, change color, delete |
| **Text Context Menu** | L4122–L4210 | `dismissTextContextMenu()`, `showTextContextMenu()` — edit, change color, duplicate, delete |
| **Area Context Menu** | L4211–L4365 | `dismissAreaContextMenu()`, `showAreaContextMenu()` — rename, resize, change color, mark as folder, convert to scroll box, enter dashboard edit, delete |
| **Totem Context Menu** | L4366–L4570 | `dismissTotemContextMenu()`, `generateTotemThumbnail()`, `showTotemContextMenu()` — rename, change color, jump to, delete |
| **Calendar Context Menu** | L4571–L4640 | `dismissCalendarContextMenu()`, `showCalendarContextMenu()` — fix month, delete |

### Area Management

| Section | Lines | Description |
|---|---|---|
| `deleteArea()` | L4641–L4664 | Removes area, unlinks files, removes links |
| `startAreaRename()` | L4666–L4760 | Inline rename input for area names |
| `startAreaResize()` | L4762–L4966 | Interactive handle-based polygon resizing with escape-to-cancel |

### Camera & Navigation

| Section | Lines | Description |
|---|---|---|
| `toggleConstellationMode()` | L4970–L5012 | Zoom to show all totems overview |
| `startCameraAnimation()` | L5014–L5026 | Initiate smooth camera transition |
| `animateCamera()` | L5028–L5049 | Animation loop for camera transitions (ease-out) |

### Main Render Loop

| Section | Lines | Description |
|---|---|---|
| `render()` | L5051–L5136 | **Main render function** — clears canvas, calls: `drawGrid()`, `drawAreas()`, `drawDrawings('under')`, `drawLinks()`, `drawCurrentPolygon()`, `drawLasso()`, `drawDrawings('over')`, `drawTotems()`, syncs DOM (files, notes, calendars, scroll boxes, tables, totem indicators) |

### Tables

| Section | Lines | Description |
|---|---|---|
| `syncTables()` | L5138–L5315 | Creates/updates table DOM elements, handles cell editing, checkbox support, resize handles |
| `getItemBBox()` | L5317–L5347 | Bounding box for any item type |
| `distToBBox()` | L5349–L5354 | Point-to-bbox distance |
| `bboxDistance()` | L5356–L5361 | Distance between two bboxes |
| `computeMagneticClusters()` | L5363–L5456 | Groups nearby items into clusters for visual effects |

### Canvas Drawing Functions

| Section | Lines | Description |
|---|---|---|
| `drawGrid()` | L5458–L5591 | Renders dot grid pattern |
| `drawConstellationLinks()` | L5593–L5704 | Draws connection lines between totems in constellation mode |
| `drawTotems()` | L5706–L5732 | Renders totem markers as colored rounded-rect pills |
| `syncTotemIndicators()` | L5734–L5840 | Off-screen totem direction indicators (floating buttons at screen edges) |

### Progress Bar Notes

| Section | Lines | Description |
|---|---|---|
| `getLinkedNotesForProgressBar()` | L5841–L5939 | Finds notepads linked to a progress bar for auto-progress calculation |

### Drawing Renderer

| Section | Lines | Description |
|---|---|---|
| `drawDrawings()` | L5941–L6270 | **LARGE** — Renders drawing types on canvas: lines, arrows, rectangles, circles, progress bars (with linked notes), clocks (live time), dashboard boxes. *Note: Text objects (`type === 'text'`) were migrated out of the canvas layer on 2026-07-16.* Handles selection highlighting (marching ants). |

### Color Utility Functions

| Section | Lines | Description |
|---|---|---|
| `isColorLight()` | L6272–L6282 | Determines if a hex color is light or dark |
| `hexToHSL()` | L6284–L6303 | Hex → HSL conversion |
| `HSLToHex()` | L6305–L6321 | HSL → Hex conversion |
| `getThemeAdjustedAreaColor()` | L6323–L6330 | Adjusts area color for light/dark backgrounds |
| `hexToRgba()` | L6332–L6340 | Hex → RGBA string |

### Book System

| Section | Lines | Description |
|---|---|---|
| `handleBookUIClick()` | L6342–L6434 | Handles clicks on book navigation (titles, pages, arrows) |
| `drawBookUI()` | L6436–L6588 | Renders book title tabs and page dots overlay on book areas |

### Area Rendering

| Section | Lines | Description |
|---|---|---|
| `drawAreas()` | L6590–L6926 | **LARGE** — Renders all areas: polygons with fill/stroke, area names, corner holes for linking, marching ants selection, book UI overlay, folder badge. Handles scroll box clipping and page animation. |

### Link Lines

| Section | Lines | Description |
|---|---|---|
| `drawLinks()` | L6928–L7063 | Renders curved bezier links between area corners with animated dashes |

### Drawing Overlays

| Section | Lines | Description |
|---|---|---|
| `drawCurrentPolygon()` | L7065–L7161 | Renders the shape being actively drawn (rect, circle, box) |
| `drawLasso()` | L7163–L7189 | Renders lasso selection overlay |

### Coordinate Transforms

| Section | Lines | Description |
|---|---|---|
| `screenToWorld()` | L7191–L7202 | Screen pixel → world coordinate |
| `worldToScreen()` | L7204–L7209 | World coordinate → screen pixel |

### High-Performance Drawing Engine

| Section | Lines | Description |
|---|---|---|
| `SmoothPen` class | ~L1083–L1199 | Dual-canvas drawing engine using `#ink-canvas` with `desynchronized: true`. Handles high-frequency hardware events via `getCoalescedEvents()`, Exponential Moving Average (EMA) for pressure, and O(1) Bezier curve segment rendering to prevent lag and buffer tearing. |

### Shelf/Ribbon Management

| Section | Lines | Description |
|---|---|---|
| `getUniqueGlobalBookNames()` | L7214–L7227 | Gets unique book names from global shelves |
| `closeElementsRibbon()` | L7229–L7235 | Closes dashboard elements ribbon |
| `closeEraserRibbon()` | L7237–L7248 | Closes eraser mode ribbon |

### File System Access API

| Section | Lines | Description |
|---|---|---|
| `openHandleDB()` | L7255–L7262 | Opens IndexedDB for handle persistence |
| `saveHandleToDB()` | L7264–L7269 | Saves workspace directory handle to IndexedDB |
| `loadHandleFromDB()` | L7271–L7277 | Loads workspace handle from IndexedDB |
| `isFolderInUse()` | L7279–L7297 | Checks lock file to prevent multi-tab editing |
| `writeLockFile()` | L7299–L7314 | Creates lock file with tab ID |
| `removeLockFile()` | L7316–L7322 | Removes lock file on tab close |
| `startLockHeartbeat()` | L7324–L7359 | Periodic lock file refresh |

### Workspace & Fabric Management

| Section | Lines | Description |
|---|---|---|
| `initializeWorkspace()` | L7361–L7366 | Opens directory picker, starts workspace |
| `loadFabricsGrid()` | L7368–L7467 | Scans workspace directory, renders fabric cards on home screen |
| `createAndLoadNewFabric()` | L7469–L7486 | Creates new fabric directory with `fabric.json` and `sources/` |
| `prepareFabricState()` | L7488–L7546 | Resets state for a new or loaded fabric |
| `importOldFabric()` | L7548–L7573 | Imports legacy JSON fabric file |
| `openFabric()` | L7575–L7641 | Opens existing fabric: reads `fabric.json`, restores state, renders |
| `saveCurrentFabric()` | L7643–L7690 | Serializes state to `fabric.json` (debounced) |
| `copyFileToFolder()` | L7692–L7751 | Copies imported file to fabric's `sources/` directory |
| `restoreFolderHandle()` | L7753–L7811 | Restores workspace handle from IndexedDB on page load |

### Notepad Feature

| Section | Lines | Description |
|---|---|---|
| `getActiveScrollBoxPageId()` | L7814–L7822 | Gets current page ID if inside a scroll box |
| `createNotepad()` | L7824–L7896 | Creates a notepad widget at world position |

### Scroll Box / Animation Utilities

| Section | Lines | Description |
|---|---|---|
| `getAnimationOffset()` | L7898–L7933 | Calculates animation translation offset for page transitions |
| `getClippingScrollBox()` | L7935–L7946 | Finds the scroll box that clips an item |
| `applyDOMClip()` | L7948–L7989 | Applies CSS clip-path to DOM elements inside scroll boxes |
| `isItemVisibleInContainer()` | L7991–L8029 | Checks if an item should be visible (handles scroll box page filtering) |

### DOM Sync Functions

| Section | Lines | Description |
|---|---|---|
| `syncFilesVisibility()` | L8031–L8075 | Shows/hides file DOM elements based on visibility and animation |
| `syncNotesDOM()` | L8077–L8277 | **LARGE** — Creates/updates/removes notepad DOM elements. Handles: positioning, resizing, word wrap, sticky mode, font sizing, checkbox toggling, close, content persistence. |
| `syncTextsDOM()` | New | Creates/updates/removes text DOM elements for Rich-Text editing capabilities (added 2026-07-16). |

### Fabric Context Menu (Home Screen)

| Section | Lines | Description |
|---|---|---|
| `showFabricContextMenu()` | L8279–L8395 | Right-click menu for fabric cards: rename, duplicate, delete |
| `copyDirectory()` | L8397–L8524 | Recursive directory copy for fabric duplication |

### Calendar System

| Section | Lines | Description |
|---|---|---|
| `syncCalendars()` | L8526–L8568 | Creates/updates calendar DOM containers |
| `updateAllCalendarsHTML()` | L8570–L8578 | Re-renders all calendar HTML |
| `renderCalendarHTML()` | L8580–L8760 | **LARGE** — Full calendar widget: month/year header, navigation, day grid, today highlight, schedule indicators, day click for events, prev/next navigation, fixed-month support. Employs robust `stopPropagation()` on pointer events to avoid canvas bleed. Context menu relies on absolute positioning and high z-index to render properly over canvas. |

### Scroll Box System

| Section | Lines | Description |
|---|---|---|
| `syncScrollBoxes()` | L8762–L8813 | Creates/updates scroll box DOM containers |
| `startScrollBoxAnimation()` | L8815–L8835 | Initiates page transition animation |
| `renderScrollBoxHTML()` | L8837–L8931 | Scroll box DOM: viewport, prev/next nav, page dots, add page button, resize handle. CSS is strictly flexbox-based in `.scroll-box-controls` (legacy absolute positioning rules have been stripped). |
| `renderPagesList()` | L8933–L9053 | Dashboard edit sidepanel: pages list with rename/delete/add |

### Dashboard Edit Mode

| Section | Lines | Description |
|---|---|---|
| `enterDashboardEditMode()` | L9055–L9124 | Opens full-screen dashboard editor popup. Saves camera, hides toolbar, positions view. |
| `exitDashboardEditMode()` | L9126–L9141 | Closes editor, restores camera and toolbar |
| `setDashboardEditTool()` | L9147–L9162 | Sets active tool within dashboard editor |
| Dashboard edit option apply | L9164–L9180 | Apply theme (bg color, grid, snap) from sidepanel |

### Mission Control (REMOVED)

| Section | Lines | Description |
|---|---|---|
| `// ===== MISSION CONTROL REMOVED =====` | L9182 | **⚠️ DELETED BY PREVIOUS AGENT** — Only a comment remains. Full feature code was removed without backup. Shortcut was `Shift+D`. |

### Document Previews

| Section | Lines | Description |
|---|---|---|
| `loadDocxJs()` | L9188–L9204 | Dynamically loads JSZip + docx-preview from CDN |
| `openDocxPreview()` | L9206–L9295 | DOCX file preview modal with scrollable rendered document |
| `openCodePreview()` | L9297–L9425 | Python/ipynb code preview modal with syntax display |

### Edge Sidebar (Folder Viewer)

| Section | Lines | Description |
|---|---|---|
| `openEdgeSidebar()` | L9432–L9444 | Opens folder sidebar panel |
| `closeEdgeSidebar()` | L9446–L9458 | Closes folder sidebar |
| `renderEdgeSidebar()` | L9460–L9644 | **LARGE** — Renders folder contents in sidebar. File list with thumbnails, drag-to-reorder in edit mode, double-click to open, PDF/DOCX/YouTube handling. |
| `toggleEdgeSidebarEditMode()` | L9646–L9656 | Toggle edit mode for rearranging folder contents |

---

## 🗺️ style.css — CODE MAP

| Section | Lines | Description |
|---|---|---|
| CSS Variables (`:root`) | L1–L8 | `--fabric-bg`, `--text-color`, `--panel-bg`, `--panel-border`, `--accent`, `--accent-hover` |
| Reset & Body | L10–L27 | Box-sizing, font, background, overflow, user-select, touch-action |
| Workspace | L29–L50 | `#workspace` positioning, cursor, draw-mode |
| Canvas | L52–L60 | `#fabric-canvas` absolute positioning |
| Files Layer | L62–L71 | `#files-layer` container for DOM file elements |
| File Items | L73–L312 | `.file-item` cards, thumbnails, edit mode, notes, options menu, file details |
| Glassmorphic Toolbar | L316–L339 | `#toolbar` fixed bottom-center, blur, rounded |
| Properties Panel | L340–L370 | `.properties-panel` ribbon styling |
| Ribbon Labels | L369–L376 | `.ribbon-label` styling |
| Dropdowns & Sliders | L378–L430 | Font size slider, font family select |
| Project Panel | L432–L480 | Project action buttons, save/delete styling |
| Project Name Ribbon | L482–L512 | Input field styling for name ribbons |
| Area Context Menu | L514–L580 | `.area-ctx-menu` glassmorphic menu |
| Resize Overlay | L582–L610 | `.area-resize-overlay` overlay with instructions |
| Tool Buttons | L611–L660 | `.tool-btn` interactive states |
| Color System | L660–L745 | `.color-dropdown`, `.color-indicator`, `.color-palette-popup`, swatches |
| Drag Overlay | L745–L782 | `#drop-overlay` file drop zone |
| Image Preview Items | L784–L852 | Image thumbnail styling, editing state |
| Pinned PDF Pages | L853–L867 | Pinned PDF visual style |
| PDF Preview Modal | L869–L1088 | `#pdf-preview-modal` full viewer styling, toolbar, navigation |
| Notepad Overlay | L1089–L1156 | `.notepad-app` textarea, footer, controls |
| Sticky Note Canvas | L1157–L1194 | `.notepad-container` on-canvas notepad styling |
| Totem Indicators | L1196–L1244 | `.totem-indicator` floating direction buttons |
| Home Screen | L1246–L1422 | `.home-screen`, workspace content, fabric cards grid |
| Modal UI | L1424–L1524 | `.modal-overlay`, `.modal-content` generic modal styling |
| Thumbnails & Fabric Options | L1525–L1592 | Fabric card thumbnails, hover options |
| Python Scripting Sidebar | L1593–L1808 | Code editor sidebar (if used) |
| Scroll Box Styles | L1809–L1928 | `.scroll-box-container`, viewport, controls, dots, resize, nav |
| Calendar Styles | L1930–L2049 | `.calendar-container`, `.cal-header`, `.cal-grid`, day cells, schedules, today highlight |
| Dashboard Edit Modal | L2184–L2393 | `#dashboard-edit-modal`, `#dashboard-edit-popup`, topbar, sidepanel |
| Mission Control Overlay | L2623–L2702 | `#mission-control-overlay`, `.mc-grid`, `.mc-card` |
| Edge Sidebar | L2705–L2850 | `#edge-sidebar`, `.edge-sidebar-item`, `.edge-item-icon` (Restored 2026-07-15) |

### Recent Fixes
- **2026-07-15**: Fixed a bug where double-clicking a deployed folder did nothing. The issue was traced to the `#edge-sidebar` element completely missing its CSS definitions in `style.css`. The CSS classes were restored, allowing the sidebar to slide in and display the folder contents as intended.
- **2026-07-15**: Improved folder icon readability by changing the text color to black when the folder's background color is white (or any light color).
- **2026-07-15**: Decreased calendar bezel padding, styled the calendar header more elegantly, and fixed the calendar 3-dot navigation/options buttons not working due to event propagation issues.
- **2026-07-15**: Migrated calendar buttons to use a robust click pattern (stop propagation on `pointerdown`, execute on `click`) to ensure compatibility across all devices and prevent context menus from immediately dismissing themselves.
- **2026-07-15**: Fixed the calendar context menu rendering issue where it was statically placed; it is now absolutely positioned over the calendar with proper z-index and event handling.
- **2026-07-15**: Integrated `marked.js` for Jupyter Notebook markdown rendering. Addressed context menu suppression during right-click panning, and disabled CSS `transform` transitions on `.file-item` elements to fix dragging/scrolling lag.
- **2026-07-16**: Added an explicit "Resize" option to the text context menu that prompts the user for a numeric width value to bypass unreliable DOM dragging logic.
- **2026-07-16**: Migrated Text Tool rendering from Canvas `fillText` to DOM-based `<div class="text-item">` synced via `syncTextsDOM()`. Replaced `<textarea>` inline editor with `<div contenteditable="true">` to support rich-text formatting (bold, italic, colors, sizing) on specific selections using `document.execCommand`. Fixed focus-stealing bugs with the properties ribbon by applying `e.preventDefault()` on color pickers.
- **2026-07-17**: Rebuilt the PWA Service Worker to properly cache assets using a Network-First strategy, enabling full offline standalone capabilities. Replaced the glitchy font size `execCommand('backColor')` logic with a cleaner `change` event system that naturally restores the browser's native text selection highlight. Fixed a rogue duplicate `<script>` tag injection bug that crashed the standalone app by trying to bind events before the DOM was loaded.

*Last updated: 2026-07-17*

---

## 🗺️ index.html — CODE MAP

| Section | Lines | Description |
|---|---|---|
| Head & PWA Config | L1–L14 | Meta tags, Google Fonts, CSS link, manifest, theme-color |
| Dashboard Edit Popup Modal | L17–L97 | Full-screen editor: topbar tools, sidepanel (bg, grid, snap, pages) |
| Home Screen Overlay | L99–L120 | Workspace selection, fabric grid container |
| New Fabric / Import Modal | L123–L147 | Create fabric form: name, bg color, import JSON |
| Main Toolbar | L149–L223 | All tool buttons: select, pan, eraser, text, notepad, line, arrow, rect, book, folder, circle, totem, dashboard, home, color dropdowns, settings |
| Settings Popup | L225–L232 | Graphics preset select (Performance/Efficient) |
| Color Palette Popup | L234–L235 | Container for 20-color swatches |
| Select Properties Ribbon | L237–L249 | Normal/Lasso mode toggle |
| Text Properties Ribbon | L251–L321 | Font size, family, bold, italic, alignment, border, text color, highlight |
| Book Selection Ribbon | L328–L351 | Book selector dropdown, place/new/delete actions |
| Book Name Input Ribbon | L353–L368 | New book name input |
| Dashboard Creator Ribbon | L369–L431 | Widget placement buttons: progress bar, clock, calendar, dashboard box, box, table, scroll box |
| Table Config Ribbon | L433–L453 | Rows/cols number inputs |
| Eraser Ribbon | L455–L475 | Normal/Lines-only eraser mode |
| Instruction Bar | L476–L478 | Status text at bottom |
| Workspace & Canvas | L480–L488 | `#workspace`, `#fabric-canvas`, `#ink-canvas` (desynchronized overlay), `#files-layer`, `#totem-indicators`, `#drop-overlay` |
| Notepad Template | L490–L511 | `<template id="tpl-notepad">` — textarea, footer, controls |
| Fabric Context Menu | L513–L517 | Rename/Delete buttons for fabric cards |
| Table Context Menu | L519–L523 | Resize/Delete for tables |
| Upload Progress Ribbon | L527–L537 | Progress bar, spinner, count |
| Edge Screen Sidebar | L539–L552 | Folder sidebar: header, edit button, close button, content area |
| Script Tags | L555–L572 | `script.js` include, error handlers, service worker nuke |

---

## 🔑 KEY ARCHITECTURAL PATTERNS

### State → Render → Save Pipeline
```
User Action → Modify `state` → `requestAnimationFrame(render)` → `saveCurrentFabric()`
```

### DOM vs Canvas Split
- **Canvas** (`ctx`): Areas, drawing shapes (lines/rects/progress bars/clocks), grid, totems, links, lasso, marching ants
- **DOM** (`#files-layer`): File cards, text objects (migrated 2026-07-16), notepads, calendars, scroll boxes, tables, totem indicators

### Coordinate Transform
```javascript
// script.js:L7191-L7209
screenToWorld(screenX, screenY)  // viewport → infinite canvas
worldToScreen(worldX, worldY)    // infinite canvas → viewport
```

### Scroll Box Clipping Architecture
Items inside scroll boxes are filtered by `isItemVisibleInContainer()` (L7991) and clipped via `applyDOMClip()` (L7948). Page transitions use `getAnimationOffset()` (L7898).

### Where to Add Shift+Key Shortcuts
Insert between L924 and L928 in `setupToolbarListeners()`:
```javascript
// L924-L928 pattern:
if (e.shiftKey && k === 'r') {
    toggleConstellationMode();
    e.preventDefault();
    return;
}
// ADD NEW SHIFT+KEY SHORTCUTS HERE (before L931 modifier guard)
```

### Where to Add New Drawing Types
1. Add type string to `state.mode` comment (L3)
2. Add placement logic in `setupWorkspaceListeners()` pointer handlers (~L1230-L2310)
3. Add rendering in `drawDrawings()` (L5941-L6270)
4. Add to `setMode()` button mapping (L964-L1053)
5. Add context menu if needed (L3917-L4640 pattern)
6. Add to `render()` sync call if DOM-based (L5051-L5136)

### Hosting Environment & Project Age
- **Project Age**: ~3.5 months (earliest artifacts date to 2026-03-28).
- **Hosting**: Served via local HTTP server (http-server).
- **Port**: 9075
  - **[CHANGED on 2026-07-14]**: Port 5075 → Port 9075 per user request.

---

*Last updated: 2026-07-15*

- **2026-07-17**: Fixed a critical Uncaught SyntaxError: Identifier 'hitCell' has already been declared in script.js which was preventing the entire script from executing and rendering all buttons unclickable in standalone mode. Also updated the Workspace and Table Context Menus to ignore right-clicks originating from [contenteditable=true] elements, thereby unblocking the browser's native copy/paste context menus inside text editors and table cells.
- **2026-07-17**: Fixed a text-box hit-test bug where `getDraggableDrawingAt()` (L685) and the eraser tool's duplicate hit-test (L1731) computed the clickable/draggable box size from `d.text.split('\n')`, which stopped matching reality after the 07-16 migration to HTML/contenteditable text content and word-wrapped `d.width` boxes. Both now read the real `.text-item` DOM element's `offsetWidth`/`offsetHeight` (same source of truth `drawDrawings()` already used for the selection outline at L6570), eliminating the "ghost" clickable area that no longer aligned with the visible text box.

### 2026-07-17 to 2026-07-18 Session — Performance, Link Occlusion, Text Ribbon Sync, Resize UX, Critical Color Bug

**⚠️ Line numbers below and throughout this file have drifted significantly from this session's edits (several hundred lines added, mostly before L7332). The table above is now stale in places — the function list below reflects current positions for everything touched this session; re-verify with grep before editing distant sections.**

- **Font-size ribbon selection sync (new)**: `matchFontFamilyOption()` (L462) and `syncPropertiesPanelToSelection()` (L471), wired to a `document.addEventListener('selectionchange', ...)` listener, keep the text properties ribbon (font size, font family, bold/italic) reflecting the actual formatting at the current cursor/selection instead of always showing the whole box's stored values. `propFontFamily`'s change handler (~L542) now also supports per-selection application via `document.execCommand('fontName', ...)`, mirroring the pattern `propFontSize` already used — two sentences in one text box can now use different fonts.
- **`getDraggableDrawingAt()`** (L753, was L685) — unchanged logic from the prior fix, just shifted down.
- **`scaleInlineFontSizes()`** (new, L799) — normalizes per-selection custom `font-size` inline styles between the unscaled screen-space live editor and the zoom-independent world-space units stored in `d.text`/`d.fontSize` (`*zoom` on editor-open, `/zoom` on finalize). Fixes a bug where a custom size set on a text selection would render at the wrong size once saved, depending on the zoom level at the time it was set.
- **`openTextEditor()`** (L809, was L721) — now calls `scaleInlineFontSizes()` at open and at `finalizeText()`.
- **Text box drag-to-resize UX overhaul** — `handleWorkspacePointerDown()` (L1649) now lets the user grab anywhere along a selected text box's left/right edge (via a new `drawing._resizeBox` computed in `drawAreas()`... actually in the text-rendering branch of `drawDrawings()`, not `drawAreas()` — see below), not just a ~12px dot at the vertical midpoint. `handleWorkspacePointerMove()` (L2411) gained a hover branch that sets `cursor: ew-resize` near a selected text box's edge before the user even clicks. `handleWorkspacePointerUp()`'s (L2642) resize-finalize branch now calls `saveCurrentFabric()`, which it previously never did (resized width could silently fail to persist).
- **`render()`** (L5688, was L5051) — unchanged logic, shifted down.
- **`drawGrid()`** (L6168, was L5458) — in the `'efficient'` graphics preset, precomputes visible areas' bboxes once per frame and skips drawing (or computing per-totem color-influence for) any grid dot that falls under one, since an opaque area will cover it anyway.
- **`hexToRgba()`** (L7058, was L6332) — unchanged.
- **`blendHexColors()`** (new, L7071) — blends a foreground hex color toward a background hex color by a ratio and returns a flat OPAQUE `rgb()` string. Used so the `'efficient'` preset's opaque area fill can approximate the muted tone a translucent alpha-blended fill would have produced, without real alpha compositing (which is what `'efficient'` mode is specifically avoiding for performance).
- **`drawAreas()`** (L7332, was L6590) — the FILL section (~L7546) now uses `blendHexColors(state.fabricColor, adjustedColor, blendRatio)` in efficient mode instead of the raw area color at full opacity, and `hexToRgba(adjustedColor, blendRatio)` (unchanged) in performance mode. The backdrop blur (~L7484) is now clipped to just the area's on-screen bbox instead of the full canvas, and skipped entirely in efficient mode.
- **`drawLinks()`** (L7706, was L6928) — link-line occlusion relative to OTHER (non-endpoint) areas it visually crosses now has three cases instead of one: areas containing BOTH link endpoints (shared container) don't occlude at all; areas containing exactly ONE endpoint (that endpoint's own parent) fully occlude with no blur-peek; areas containing neither (incidental crossing) keep the pre-existing soft blurred/dimmed "tunnel" look. The sharp-line clip also now chains one `ctx.clip('evenodd')` call PER occluder instead of combining all occluders into a single evenodd path — the combined-path version broke when one occluder was geometrically nested inside another (evenodd counts boundary crossings, so a nested "hole punched in a hole" toggles back to visible).
- **`prepareFabricState()`** (L8261, was L7488) — **CRITICAL FIX**: this function rebuilds `state` from scratch on every fabric load and was setting `state.bgColor` instead of `state.fabricColor`, even though `fabricColor` is the field every other part of the app (including this function's own top-level default state object) actually reads/writes. This meant `state.fabricColor` was `undefined` on every loaded (non-freshly-created) fabric — silently masked because `ctx.fillStyle = undefined` is a Canvas no-op (falls back to default black, which happened to look right for the dark theme) and `isColorLight(undefined)` returns `false` (also happened to look right). Now sets `fabricColor: d.fabricColor || d.bgColor || bgColor` (reads either legacy JSON key). Two other `state.bgColor` reads (`document.body.style.backgroundColor` here, and a note text-color check in `syncNotesDOM()` ~L9033) and one in `saveCurrentFabric()`'s thumbnail generator (~L8434 at time of fix) were switched to `state.fabricColor` too.
- **Known gap, not fixed**: `prepareFabricState()`'s rebuilt `state` is also missing `graphicsPreset`, `gridSize`, `snapToGrid`, `selectMode`, `lassoPolygon`, `lassoSelection`, `isConstellationMode`, `preConstellationZoom`, `editingDashboardId` relative to the top-level default state object. Doesn't corrupt rendering the way `fabricColor` did (comparisons against `undefined` just resolve to falsy/default), but means e.g. the graphics preset choice doesn't persist across reopening a fabric.


### 2026-07-18 Session — Widget Sidebar (Shift+S) + Edge Sidebar Redesign

**New/changed script.js sections (line numbers approximate as of this writing, verify before editing):**

| Section | Lines | Description |
|---|---|---|
| Side Panel Stack module | ~L5651-5720 | `sidePanelStack`, `SIDE_PANELS`, `openSidePanel()`, `closeSidePanel()`, `closeTopSidePanel()`, `applySidePanelStackVisuals()`, `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` — shared iOS-style card-recede + Escape/click-outside dismissal for BOTH the Edge Sidebar and Widget Sidebar. Placed right after `closeMissionControl()`, modeled on its `_dismissHandler`/`_escHandler` pattern. |
| `buildFileListItemEl()` | ~L10326-10489 | Shared file-list-row builder (icon/name/meta, delete, drag-out-to-canvas, double-click-to-open) — extracted from `renderEdgeSidebar()`, used by both it and the new Folder widget. |
| `renderEdgeSidebar()` | ~L10491-10522 | Now delegates per-file rendering to `buildFileListItemEl()`. |
| `openEdgeSidebar()`/`closeEdgeSidebar()`/`toggleEdgeSidebarEditMode()` | ~L10289-10315, ~10529+ | Now route through the panel stack (`openSidePanel('edge')`/`closeSidePanel('edge')`) and dismiss binding; edit-button styling moved from inline `style=` to `.classList.toggle('active', ...)`. |
| Widget Sidebar module | ~L10600-11090 (end of file) | `openWidgetSidebar()`/`closeWidgetSidebar()`/`toggleWidgetSidebar()`/`toggleWidgetSidebarEditMode()`/`renderWidgetSidebar()`, `WIDGET_LABELS`/`WIDGET_ICONS`/`createDefaultWidget()`/`WIDGET_RENDERERS` registry, `setupWidgetDrag()` (manual pointer-based reorder), `openWidgetAddMenu()`/`closeWidgetAddMenu()`. |
| Per-type widget renderers | same module | `renderTextWidget()`, `renderRectWidget()`, `renderClockWidget()` (+ shared `updateAllClockWidgets()` ticker), `renderProgressBarWidget()`, `renderNotesWidget()` (+ `renderNotesWidgetDisplay()`), `renderCalendarWidget()`, `renderFolderWidget()` (+ `renderFolderWidgetList()`, `refreshFolderWidgets()`). All 7 are NEW implementations — none of the existing canvas widget systems (calendar/notes/progress_bar/clock in `state.drawings`, all rendered via `drawDrawings()`/`syncCalendars()`/`syncNotesDOM()` and tied to `#files-layer`'s camera transform) could be reused as-is; see the 2026-07-18 entry in `project_progress.md` for the full reasoning. |
| Shift+S keydown handler | ~L1195-1210 area (inside `setupToolbarListeners()`) | Added alongside the existing `Shift+R`/`Shift+D` blocks, same pattern. |
| `prepareFabricState()` | ~L8261+ | Added `sidebarWidgets: d.sidebarWidgets || [],` to the field list. |
| `assignFileToStorage()` / polygon-extend flow | ~L238, ~L2799 | Both `containedFiles` mutation sites now also call `refreshFolderWidgets(folderId)` so an open Folder widget stays live. |

**New style.css sections:** `.side-panel*` (shared base, ~before "Edge Sidebar" section), `.side-panel-header/-title/-icon-btn/-edit-btn/-content` (shared panel chrome), `#widget-sidebar*`, `.widget-card*` (shared widget-card chrome: drag handle, remove button, body), `#widget-add-menu*`, `.text-widget*`, `.rect-widget*`, `.clock-widget*`, `.progress-widget*`, `.notes-widget*`, `.folder-widget*`. New `:root` custom property: `--panel-bg-solid` (used by both sidebar panels' background, replacing separate hardcoded rgba values).

**Edge Sidebar CSS is now much smaller** — most of its old rules (`#edge-sidebar` positioning/animation, header/title/close-button styling) were deleted in favor of the shared `.side-panel*` classes; only what's genuinely unique to it (background/blur/border, `.edge-sidebar-item`/`.edge-item-*` file-row styling) remains under its own selectors.

**Fixed while in this area (unrelated pre-existing issues, not part of the original ask):**
- Deleted a long-standing orphaned/selector-less CSS fragment right after `.edge-item-delete:hover` (previously flagged but not yet fixed as of the 2026-07-17 entries above) — it was the sole cause of a whole-file CSS brace-count imbalance; style.css is now exactly balanced.
- `.hidden` is a per-component compound class in this codebase (e.g. `.modal-overlay.hidden`), NOT a global utility — worth remembering before reusing `class="hidden"` on any new element; it needs its own `#id.hidden { display: none; }` rule or it silently does nothing.


### 2026-07-18 Follow-up — Sidebar Hide-vs-Close Distinction + Header Tab Selector

**[CHANGED on 2026-07-18]**: The "Side Panel Stack module" row above (in the 2026-07-18 Session section) is now out of date — `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` were REMOVED entirely (they had a latent bug: binding a separate Escape/click-outside listener per panel meant both would fire at once when two panels were stacked). Current shape of that module (script.js, same location, ~L5660-5775):

| Function | Lines | Description |
|---|---|---|
| `openSidePanel(name)` | ~L5687 | Makes `name` frontmost — pulls it out of `hiddenSidePanels` if needed, moves it to the top of `sidePanelStack`. |
| `hideSidePanel(name)` | ~L5701 | NEW. Moves `name` from `sidePanelStack` into `hiddenSidePanels` (fully off-screen, but NOT torn down — no `onClose` call). Used by Escape/click-outside and by Shift+S's toggle-off. |
| `closeSidePanel(name)` | ~L5717 | Explicit close (×) button only. Removes `name` from both `sidePanelStack` and `hiddenSidePanels`, calls the panel's `onClose` (full teardown, e.g. `closeEdgeSidebar()` clearing `window.activeEdgeFolderId`). |
| `closeTopSidePanel()` | unchanged | Closes whichever panel is currently frontmost. |
| `applySidePanelStackVisuals()` | unchanged position | Now also calls `updateSidePanelSelectors()` at the end. |
| `updateSidePanelSelectors()` | ~L5752 | NEW. When `sidePanelStack.concat(hiddenSidePanels)` has 2+ entries, replaces `#edge-sidebar-title`/`#widget-sidebar-title`'s content with a `.side-panel-tab` pair ("Folder"/"Widgets"); with only one, restores the normal title text (folder name / "Widgets"). |
| Global dismiss listeners | end of module | Replaced the old per-panel bind/unbind with ONE persistent `document`-level `click` listener and ONE `window`-level `keydown` listener, both always checking `sidePanelStack[sidePanelStack.length - 1]` (whatever is actually frontmost) before calling `hideSidePanel()`. |


### 2026-07-18 Session — Widget Sidebar (Shift+S) + Edge Sidebar Redesign

**New/changed script.js sections (line numbers approximate as of this writing, verify before editing):**

| Section | Lines | Description |
|---|---|---|
| Side Panel Stack module | ~L5651-5720 | `sidePanelStack`, `SIDE_PANELS`, `openSidePanel()`, `closeSidePanel()`, `closeTopSidePanel()`, `applySidePanelStackVisuals()`, `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` — shared iOS-style card-recede + Escape/click-outside dismissal for BOTH the Edge Sidebar and Widget Sidebar. Placed right after `closeMissionControl()`, modeled on its `_dismissHandler`/`_escHandler` pattern. |
| `buildFileListItemEl()` | ~L10326-10489 | Shared file-list-row builder (icon/name/meta, delete, drag-out-to-canvas, double-click-to-open) — extracted from `renderEdgeSidebar()`, used by both it and the new Folder widget. |
| `renderEdgeSidebar()` | ~L10491-10522 | Now delegates per-file rendering to `buildFileListItemEl()`. |
| `openEdgeSidebar()`/`closeEdgeSidebar()`/`toggleEdgeSidebarEditMode()` | ~L10289-10315, ~10529+ | Now route through the panel stack (`openSidePanel('edge')`/`closeSidePanel('edge')`) and dismiss binding; edit-button styling moved from inline `style=` to `.classList.toggle('active', ...)`. |
| Widget Sidebar module | ~L10600-11090 (end of file) | `openWidgetSidebar()`/`closeWidgetSidebar()`/`toggleWidgetSidebar()`/`toggleWidgetSidebarEditMode()`/`renderWidgetSidebar()`, `WIDGET_LABELS`/`WIDGET_ICONS`/`createDefaultWidget()`/`WIDGET_RENDERERS` registry, `setupWidgetDrag()` (manual pointer-based reorder), `openWidgetAddMenu()`/`closeWidgetAddMenu()`. |
| Per-type widget renderers | same module | `renderTextWidget()`, `renderRectWidget()`, `renderClockWidget()` (+ shared `updateAllClockWidgets()` ticker), `renderProgressBarWidget()`, `renderNotesWidget()` (+ `renderNotesWidgetDisplay()`), `renderCalendarWidget()`, `renderFolderWidget()` (+ `renderFolderWidgetList()`, `refreshFolderWidgets()`). All 7 are NEW implementations — none of the existing canvas widget systems (calendar/notes/progress_bar/clock in `state.drawings`, all rendered via `drawDrawings()`/`syncCalendars()`/`syncNotesDOM()` and tied to `#files-layer`'s camera transform) could be reused as-is; see the 2026-07-18 entry in `project_progress.md` for the full reasoning. |
| Shift+S keydown handler | ~L1195-1210 area (inside `setupToolbarListeners()`) | Added alongside the existing `Shift+R`/`Shift+D` blocks, same pattern. |
| `prepareFabricState()` | ~L8261+ | Added `sidebarWidgets: d.sidebarWidgets || [],` to the field list. |
| `assignFileToStorage()` / polygon-extend flow | ~L238, ~L2799 | Both `containedFiles` mutation sites now also call `refreshFolderWidgets(folderId)` so an open Folder widget stays live. |

**New style.css sections:** `.side-panel*` (shared base, ~before "Edge Sidebar" section), `.side-panel-header/-title/-icon-btn/-edit-btn/-content` (shared panel chrome), `#widget-sidebar*`, `.widget-card*` (shared widget-card chrome: drag handle, remove button, body), `#widget-add-menu*`, `.text-widget*`, `.rect-widget*`, `.clock-widget*`, `.progress-widget*`, `.notes-widget*`, `.folder-widget*`. New `:root` custom property: `--panel-bg-solid` (used by both sidebar panels' background, replacing separate hardcoded rgba values).

**Edge Sidebar CSS is now much smaller** — most of its old rules (`#edge-sidebar` positioning/animation, header/title/close-button styling) were deleted in favor of the shared `.side-panel*` classes; only what's genuinely unique to it (background/blur/border, `.edge-sidebar-item`/`.edge-item-*` file-row styling) remains under its own selectors.

**Fixed while in this area (unrelated pre-existing issues, not part of the original ask):**
- Deleted a long-standing orphaned/selector-less CSS fragment right after `.edge-item-delete:hover` (previously flagged but not yet fixed as of the 2026-07-17 entries above) — it was the sole cause of a whole-file CSS brace-count imbalance; style.css is now exactly balanced.
- `.hidden` is a per-component compound class in this codebase (e.g. `.modal-overlay.hidden`), NOT a global utility — worth remembering before reusing `class="hidden"` on any new element; it needs its own `#id.hidden { display: none; }` rule or it silently does nothing.


### 2026-07-18 Follow-up — Sidebar Hide-vs-Close Distinction + Header Tab Selector

**[CHANGED on 2026-07-18]**: The "Side Panel Stack module" row above (in the 2026-07-18 Session section) is now out of date — `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` were REMOVED entirely (they had a latent bug: binding a separate Escape/click-outside listener per panel meant both would fire at once when two panels were stacked). Current shape of that module (script.js, same location, ~L5660-5775):

| Function | Lines | Description |
|---|---|---|
| `openSidePanel(name)` | ~L5687 | Makes `name` frontmost — pulls it out of `hiddenSidePanels` if needed, moves it to the top of `sidePanelStack`. |
| `hideSidePanel(name)` | ~L5701 | NEW. Moves `name` from `sidePanelStack` into `hiddenSidePanels` (fully off-screen, but NOT torn down — no `onClose` call). Used by Escape/click-outside and by Shift+S's toggle-off. |
| `closeSidePanel(name)` | ~L5717 | Explicit close (×) button only. Removes `name` from both `sidePanelStack` and `hiddenSidePanels`, calls the panel's `onClose` (full teardown, e.g. `closeEdgeSidebar()` clearing `window.activeEdgeFolderId`). |
| `closeTopSidePanel()` | unchanged | Closes whichever panel is currently frontmost. |
| `applySidePanelStackVisuals()` | unchanged position | Now also calls `updateSidePanelSelectors()` at the end. |
| `updateSidePanelSelectors()` | ~L5752 | NEW. When `sidePanelStack.concat(hiddenSidePanels)` has 2+ entries, replaces `#edge-sidebar-title`/`#widget-sidebar-title`'s content with a `.side-panel-tab` pair ("Folder"/"Widgets"); with only one, restores the normal title text (folder name / "Widgets"). |
| Global dismiss listeners | end of module | Replaced the old per-panel bind/unbind with ONE persistent `document`-level `click` listener and ONE `window`-level `keydown` listener, both always checking `sidePanelStack[sidePanelStack.length - 1]` (whatever is actually frontmost) before calling `hideSidePanel()`. |

New module-level state: `hiddenSidePanels` (array, alongside the existing `sidePanelStack`), `SIDE_PANEL_LABELS` (`{edge: 'Folder', widgets: 'Widgets'}`, used by the tab selector).

`openEdgeSidebar()`/`closeEdgeSidebar()`/`openWidgetSidebar()`/`closeWidgetSidebar()` (script.js ~L10355, ~L10371, ~L10609, ~L10618) no longer call `bindSidePanelDismiss`/`unbindSidePanelDismiss` (removed) — dismiss handling is now entirely centralized in the module above. `openEdgeSidebar()` also no longer sets `#edge-sidebar-title`'s text directly; `updateSidePanelSelectors()` (triggered via `openSidePanel('edge')`) is now the single source of truth for that title's content.

New style.css: `.side-panel-tab` / `.side-panel-tab.active` (near `.side-panel-title`), styled as small pill buttons using `var(--accent)` for the active one.

---

### GPU Hardware Acceleration Diagnostic Feature (2026-07-19)

| Component | Location | Description |
|---|---|---|
| GPU Button UI | `index.html:L232` | Added `<button id="btn-check-gpu">Check GPU Status</button>` inside `#settings-popup`. |
| WebGL Detection Logic | `script.js:L1173` | Added click listener on `btnCheckGpu`. Creates a transient WebGL canvas context (`webgl` or `experimental-webgl`), queries `WEBGL_debug_renderer_info` for `UNMASKED_VENDOR_WEBGL` and `UNMASKED_RENDERER_WEBGL`, tests for software renderers (`swiftshader`, `llvmpipe`), and alerts the user with their current GPU/CPU rendering status. |
| Cache Buster | `index.html:L597` | Updated `script.js` version tag to `v=1052`. |

---

### Viewport Culling Feature (2026-07-21)

**⚠️ script.js is now ~11,300+ lines — line numbers throughout this whole file are heavily drifted; grep before editing.**

| Component | Location (grep anchor) | Description |
|---|---|---|
| `viewBounds` + `updateViewBounds()` | after `bboxDistance()` (~L6243) | Module-level visible-world rectangle, recomputed once per frame at the top of `render()` (right after `width`/`height`). Screen-px margin (150) converted to world units via `/zoom`. **[CHANGED on 2026-07-21]**: flat 150px margin → proportional `marginRatio=0.125`/side (1.25x viewport at any zoom) — see the text-culling fix entry further down. |
| `getRenderBBox(item)` | same block | Robust world bbox for every coordinate convention (polygons/points, `start`/`end`, tables via `colWidths`/`rowHeights`, `x`+`width`/`height` top-left boxes, CENTER-anchored files, bare `x`/`y`). `null` = unmeasurable = always draw. Superset of the older `getItemBBox()`, which does NOT handle `start`/`end` or `width`/`height` correctly — use `getRenderBBox` for culling. |
| `isBBoxOnScreen()` / `isItemOnScreen()` | same block | Overlap test vs `viewBounds`; item variant also shifts by `getAnimationOffset()`. |
| `areaOwnsVisibleLink(area)` | after `isBBoxOnScreen()` | Keeps an off-screen area un-culled if it renders a link (from inside `drawAreas()`) whose span reaches the viewport. |
| Cull call sites (canvas) | `render()` top; inside `drawAreas()`, `drawDrawings()`, `drawTotems()`, `drawLinks()` | See project_progress.md 2026-07-21 entry for exact placement notes. Totem cull is skipped in constellation mode. |
| Cull call sites (DOM) | `syncFilesVisibility()`, `syncTextsDOM()`, `syncTables()`, `syncCalendars()`, `syncScrollBoxes()`, `syncNotesDOM()` | All AND an on-screen test into their `display` toggle, guarded by `el.contains(document.activeElement)` so active edits aren't interrupted. `syncTables()` additionally skips its per-frame `remove()`+rebuild when off-screen. |
| Cache Buster | `index.html:L597`, `sw.js` | `script.js` version tag → `v=1053`; `sw.js` CACHE_NAME → `v1053`. |

**Render coalescing (2026-07-21)**: `scheduleRender()` + `_renderScheduled` flag sit just before `function render()`. EVERY `requestAnimationFrame(render)` was replaced with `scheduleRender()` — if you add new render triggers, call `scheduleRender()`, not raw `requestAnimationFrame(render)`, or you reintroduce multi-render-per-frame. Direct `render()` (synchronous) is still fine for one-off immediate redraws. Also: the per-frame DOM orphan-cleanup loops in `syncTextsDOM`/`syncTables`/`syncCalendars`/`syncScrollBoxes` now use `Set.has()` instead of `Array.includes()`. Cache-buster → `v=1054`.

**In-place tables + AABB reject (2026-07-21)**: `syncTables()` rebuilds a table's DOM only when its structural signature `container._tableSig` (`rows×cols|colWidths|rowHeights|isResizing`) changes; otherwise a fast path updates only position/color/transform/clip/display and `continue`s. Cell content is NOT in the signature (it's DOM-authoritative, saved to state on `input`). `recalculateItemLinks()` precomputes an area→bbox `Map` (keyed by object) once per call and AABB-rejects before `isPointInPolygon`; `findAssignedArea(point, currentItem, bboxMap=null)` gained the optional map param and its own inline AABB reject for standalone calls. `syncCalendars()` was already in-place (only builds on creation) — do NOT add a rebuild there. Cache-buster → `v=1055`.

**`#workspace` viewport-offset bug fixed (2026-07-21, see project_progress.md BUG-0012)**: `.instructions` (style.css, right before the `#workspace` block) is now `position: fixed` (previously `static` — a normal-flow layout bug that pushed the entire workspace/canvas down by the bar's own height, silently invalidating the "workspace sits flush at viewport (0,0)" assumption baked into `screenToWorld()`/`worldToScreen()` (script.js ~L8375) and `openTextEditor()`'s inline editor). **Rule for future edits**: every direct child of `<body>` that renders BEFORE `#workspace` (script.js:L492 area) MUST be `position: fixed`/`absolute`, or display:none by default — never `static` — or this exact class of bug (workspace offset from (0,0), every mouse→world coordinate off by the offset amount) reoccurs. `#toolbar`/`.properties-panel`/`.home-screen` already follow this; `.instructions` was the sole historical exception. Cache-buster: `style.css?v=1028 → v=1029` (first CSS bump this session — remember CSS has its OWN `?v=` separate from `script.js`'s, and `sw.js`'s precache list must be kept in sync with both or the service worker can serve a stale pre-fix version).

**Text culling bbox fix + proportional margin (2026-07-21, see project_progress.md BUG-0013)**: `getRenderBBox()` (script.js ~L6347) now has a dedicated `item.type === 'text'` branch checked FIRST, before the generic size branches — text drawings never store `.height` in `state` (it's intrinsic to rendered content), so the generic branch silently produced a zero-height bbox for any resized text (`.width` set, `.height` always undefined), causing text to flicker in/out while panning. The new branch reads the live `.text-item` DOM element's real `offsetWidth`/`offsetHeight` when it exists (same source of truth `getDraggableDrawingAt()` ~L761 already uses for hit-testing), with a content-aware fallback estimate for the first frame before the DOM element exists. **If you add a new drawing/item type that goes through DOM sync, check whether `getRenderBBox()` needs its own branch too — don't assume the generic x+width/height branch is safe.** Also: `updateViewBounds()`'s margin changed from a flat `marginPx=150` to a proportional `marginRatio=0.125` (per side) — the culled region is now exactly 1.25x the viewport's width/height at any zoom, rather than a fixed screen-pixel buffer. Cache-buster → `v=1056`.

---

### Tablet Mode — Touch Gesture Layer (2026-07-21, see project_progress.md "NEW FEATURE — Tablet Mode")

| Component | Location | Description |
|---|---|---|
| `#tablet-mode-toggle` checkbox | `index.html`, inside `#settings-popup` | New "Input" section below Graphics Preset. Inline-styled matching the popup's existing convention. |
| `tabletMode` (module-level flag) | script.js ~L60, next to `spacePressed` | Loaded from `localStorage['spatial-tablet-mode']` at script load. **Device-level setting, NOT in `state`/fabric.json** — deliberately outside `prepareFabricState()`'s reach so it survives fabric switches. |
| `setTabletMode(on)` | same area | Sets the flag + persists to localStorage + syncs the checkbox + calls `resetTouchGesture()`. |
| Touch gesture module | new block right before `setupWorkspaceListeners()` | `activeTouches` (Map: pointerId→{x,y,downTime}), `touchGestureMaxCount`/`touchGestureStart`/`touchGestureFired`/`touchPanLast`, `touchesAverage()`, `resetTouchGesture()`, `handleTabletTouchDown/Move/Up(e)`. |
| Pointer-pipeline integration | `handleWorkspacePointerDown/Move/Up()` (script.js ~L1816/2578/2809 as of this writing — verify via grep) | ONE line at the very top of each: `if (handleTabletTouch{Down,Move,Up}(e)) return;`. This is the entire integration surface. |

**Key invariant — do not break this**: `handleTabletTouchDown/Move/Up` each start with `if (!tabletMode || e.pointerType !== 'touch') return false;`. This is what guarantees mouse and pen are UNCONDITIONALLY unaffected by this feature (they always see the exact same pipeline as before Tablet Mode existed), and that touch behaves exactly as it always did when Tablet Mode is off. **Never add tablet-mode logic anywhere else in the pointer pipeline** — keep it confined to these three gate functions, or this invariant becomes unverifiable by inspection.

**Gesture classification uses the PEAK simultaneous touch count** (`touchGestureMaxCount`) since the last time all fingers lifted, not the live count — this is deliberate, so a finger lifting early during a 3-finger gesture can't misfire as a 2-finger action. Reset only happens when `activeTouches.size` returns to `0`.

**2-finger tap reuses `handleWorkspaceContextMenu()` directly** (the same function a mouse right-click calls) via a synthetic event object — so the "options" gesture can never drift out of sync with what right-click actually shows.

**Gesture constants** (tune here if real-device testing shows they're too sensitive/sluggish — not yet tested on real touch hardware): `TOUCH_SWIPE_THRESHOLD = 70` (screen px for 3-finger swipe recognition), `TOUCH_TAP_MAX_MOVEMENT = 12` (screen px), `TOUCH_TAP_MAX_DURATION = 350` (ms).

Cache-buster: `script.js?v=1056 → v=1057`; `sw.js` CACHE_NAME `v1056 → v1057`.

---

### Totem Direct Click-Drag Fix (2026-07-21, see project_progress.md BUG-0014)

**Root cause**: `handleWorkspacePointerDown()`'s select-mode branch hit-tests text/progress-bar drawings (`getDraggableDrawingAt()`) then areas — but had NO totem check at all. A click on a totem matched neither, fell through to the final `else`, and started a camera pan. Totems were ONLY ever hit-tested in `handleWorkspaceContextMenu()` (right-click) and the Constellation Mode click-to-jump branch — never in the plain-click path.

| Component | Location | Description |
|---|---|---|
| Totem hit-test in select-mode click | `handleWorkspacePointerDown()`, right after the text/progress-bar check, before the area check | Same pill-box formula (`ctx.measureText(t.name)` + padding) as the other two existing totem hit-test sites (right-click menu, constellation click) — 3rd copy now exists; not extracted to a shared helper (scoped bug fix, not a refactor — if you touch totem hit-testing again, consider extracting `hitTestTotemAt(worldPos)` at that point). |
| `state.draggingTotem` | default state object + `prepareFabricState()` | New drag-state field, alongside `draggingArea`/`draggingText`. Purely transient UI state — never persisted to fabric.json. |
| Drag lifecycle | `handleWorkspacePointerDown/Move/Up()` | Mirrors `draggingText`'s exact pattern: down sets `draggingTotem`+`dragStartWorld`+cursor `move`+pointer capture (unless `isLocked`, which still consumes the click but doesn't drag); move applies `dx/dy` from `dragStartWorld`; up clears `draggingTotem`, resets cursor, calls `recalculateItemLinks()` + `saveCurrentFabric()`. |

**This is independent of the existing "Move" context-menu action** (`state.mode='move-totem'`/`state.movingTotemContext`, script.js ~L5261), which relocates a totem's whole magnetic-field cluster (nearby areas/files/drawings/tables/totems within its radius) via a separate click-to-arm/move/click-to-drop flow. The new direct click-drag moves ONLY the totem — it does not replicate or interact with the cluster-move logic. Don't conflate the two if extending totem interaction further.

Cache-buster: `script.js?v=1057 → v=1058`; `sw.js` CACHE_NAME `v1057 → v1058`.

---

### Totem Indicators — Restored Feature (2026-07-21, see project_progress.md "RESTORED FEATURE")

Was FULLY dead: CSS existed, but `syncTotemIndicators()` and `#totem-indicators` had no trace anywhere in `script.js`/`index.html` — a silent removal with no `[REMOVED]` note (same failure class as the pre-2026-07-14 Mission Control deletion). Plus a second, independent CSS bug: `.totem-arrow.left/right/top/bottom` had no base `.totem-arrow{width:0;height:0;border-style:solid;}` rule, so even with working JS the arrows would never have rendered (border-style defaulted to `none`).

| Component | Location | Description |
|---|---|---|
| `#totem-indicators` | `index.html`, inside `#workspace`, between `#files-layer`/`#selection-overlay` and `#drop-overlay` | Restored container div. |
| Base `.totem-arrow` rule | `style.css`, right before `.totem-arrow.left` | `width:0; height:0; border-style:solid;` — THE missing piece; without it the 4 directional border-color rules are invisible. |
| `.totem-indicator-label` | `style.css`, after the 4 `.totem-arrow.*` rules | New — 26px circular initials badge, background set inline from JS to match the totem's color. |
| `getTotemInitials(name)` | script.js, right after `drawTotems()` | First 1-2 letters of first word, or first-letter-of-first-two-words if multi-word. |
| `getOffscreenIndicatorPosition(screenX, screenY, width, height, margin)` | same area | Standard off-screen-waypoint clamp: projects the totem's screen position onto the inset viewport rect along the ray from viewport-center, returns `{x,y,direction}`. |
| `syncTotemIndicators(width, height)` | same area | Creates/updates/removes `.totem-indicator` elements for every totem whose `worldToScreen()` result falls outside `[0,width]×[0,height]`. Click handler calls `startCameraAnimation(-t.x*zoom, -t.y*zoom, zoom)` — same pattern as Constellation Mode's jump-to-totem. |
| `totemIndicatorsLayer` (DOM ref) | script.js, alongside `filesLayer` | `document.getElementById('totem-indicators')`. |
| Wiring into `render()` | normal path: alongside `syncTextsDOM/syncTables/syncCalendars/syncScrollBoxes`. Constellation-mode branch: `totemIndicatorsLayer.innerHTML = ''` | Indicators make no sense in Constellation Mode (already shows every totem), so explicitly cleared there. |

**Verification note**: this session's automated browser tab runs with `document.visibilityState:'hidden'`/`hasFocus:false`, which SUSPENDS `requestAnimationFrame` entirely (confirmed with a bare rAF test) — so the click-to-jump camera ANIMATION cannot be watched playing out in this environment. Verified instead by spying on `startCameraAnimation()` to confirm the exact target args are computed correctly; the animation mechanics themselves are pre-existing, shared code already proven elsewhere (Constellation Mode, Mission Control). If you ever see "nothing happens" on an animated camera jump while testing via this browser automation, check `document.visibilityState` before assuming a code bug.

Cache-buster: `script.js?v=1058 → v=1059`; `style.css?v=1029 → v=1030`; `sw.js` CACHE_NAME `v1058 → v1059`.

---

### Totem Ribbon Button Fix & Keyboard Shortcut (2026-07-22)

| Component | Location | Description |
|---|---|---|
| `btnTotem` DOM Reference | `script.js:L101` | Added `const btnTotem = document.getElementById('btn-totem');`. Was missing, breaking click handling. |
| Toolbar Click Handler | `script.js:L1087` | Added `btnTotem.addEventListener('click', () => setMode('totem'));` inside `setupToolbarListeners()`. |
| Active Button State | `script.js:L1315` | Added `'totem': btnTotem` to `btns` map in `setMode()`. Ensures active button highlight toggles correctly. |
| Instruction Bar Text | `script.js:L1385` | Added `else if (mode === 'totem') instructionText.textContent = "Click on the fabric to place a Totem Marker.";`. |
| Keyboard Shortcut | `script.js:L1279` & `index.html:L190` | Added `M` key shortcut (`if (k === 'm') setMode('totem');`) and updated tooltip `title="Totem Marker (M)"`. |
| Cache Buster | `index.html:L605`, `sw.js` | `script.js` version tag `v=1059 → v=1060`; `sw.js` `CACHE_NAME` `v1059 → v1060`. |

---

### Totem Floating Indicator Removal (2026-07-22)

| Component | Location | Description |
|---|---|---|
| `syncTotemIndicators()` | `script.js:L7083` | Updated to clear `totemIndicatorsLayer.innerHTML` and return early, disabling off-screen totem edge indicators (arrow + initials badge) per user request. |
| Cache Buster | `index.html:L605`, `sw.js` | `script.js` version tag `v=1060 → v=1061`; `sw.js` `CACHE_NAME` `v1060 → v1061`. |

---

### Direct Totem Dragging Disabled (2026-07-22)

| Component | Location | Description |
|---|---|---|
| `handleWorkspacePointerDown()` | `script.js:L2242` | Removed `state.draggingTotem = clickedTotem;`. Direct single-totem left-click dragging disabled per user request. Totems must be moved via right-click "Move Totem & Field". |
| Cache Buster | `index.html:L605`, `sw.js` | `script.js` version tag `v=1061 → v=1062`; `sw.js` `CACHE_NAME` `v1061 → v1062`. |

---

*Last updated: 2026-07-22*



