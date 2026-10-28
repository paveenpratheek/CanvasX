<!-- gitx:map -->
> **GitX map** of this repository, written by a setup agent from the code it read - 98% of 15760 code lines, 2026-10-19.
> **Found** = read in the code. **Open lead** = seen only as a name, or not reached. It is where to start, not the answer - the code is. Check what you rely on, and look past its words: they are not all the words there are.
> **Read first:** Goal (lines 26-29), Rules (lines 30-43), Criteria (lines 44-48), Known bugs (lines 49-64). Then only the section your task touches - Read GitX.md with offset and limit:
> - Workspace, fabrics and persistence - lines 67-72
> - Camera, modes, toolbar and shortcuts - lines 73-77
> - Tablet mode (touch gestures) - lines 78-81
> - Ink, shapes, eraser and lasso - lines 82-86
> - Areas, nesting, corner holes and links - lines 87-91
> - Books (paged shelves) - lines 92-96
> - Files: drop import, file cards, previews - lines 97-100
> - Folders and Edge sidebar - lines 101-104
> - Text boxes and rich text - lines 105-109
> - Notes (notepad areas) - lines 110-113
> - Tables - lines 114-117
> - Progress bars, clocks, calendars (dashboard elements) - lines 118-121
> - Dashboard box, scroll box and dashboard edit mode - lines 122-126
> - Totems, magnetic fields, constellation, mission control - lines 127-130
> - Render pipeline and performance - lines 131-134
> - Side panels and Widget sidebar - lines 135-138
> - PWA and service worker - lines 139-142
> - Dev helper scripts and backup files - lines 143-145
> - Open leads - lines 146-152
<!-- /gitx:map -->

## Goal

File Fabric ("Spatial File Manager") is a no-build, Chromium-only PWA: an infinite pan/zoom canvas ("fabric") where the user drops real files, draws areas/shapes/ink, writes text/notes and builds dashboards (progress bars, clocks, calendars, tables, scroll boxes, books, folders, totems). A workspace is a disk folder from `showDirectoryPicker`; each fabric is a sub-folder with `fabric.json` (whole `state`), `thumbnail.jpg`, `sources/` (copies of dropped files). All logic is global-scope `script.js`. Read in full: `script.js`, `index.html`, `sw.js`, helper scripts; `style.css` except 2101-2154 and 2435-2734 (widget rules, grep selector list only).

## Rules

- **One global `state`**, replaced by `prepareFabricState` on open/create. Mutations call `scheduleRender()` and, to persist, `saveCurrentFabric()` (500 ms debounce, `JSON.stringify(state)`). Some paths skip saving (clock/progress-bar delete in `showClockContextMenu`/`showProgressBarContextMenu`).
- **Persisted root fields are re-read only via the list in `prepareFabricState`**; a new field must be added there (see bug 3).
- **World coords**: camera origin = centre of `#workspace`; `screenToWorld`/`worldToScreen` assume it sits at viewport (0,0) (hence `.instructions` is `position: fixed`). `render()` gives `filesLayer` the same translate/scale as the canvas; DOM items use world px.
- **Geometry differs per item**: areas `polygons` (rings) or `points`; drawings `path` (`points`), `line|arrow|rect|circle|book` (`start`/`end`), `text|progress_bar|clock|calendar` (`x`,`y`,`width`,`height`, top-left); files/YouTube cards `x`,`y` = CENTRE; tables `x`,`y`+`colWidths`/`rowHeights`; totems `x`,`y`. Per-type lists are duplicated in `getRenderBBox`, `getItemBBox`, `getDraggableDrawingAt`, `isDrawingFullyInsidePolygon`, delete-mode hit test and the three move loops in `handleWorkspacePointerDown/Move`, `getItemCenter`. A new drawing type touches all.
- **Containment is recomputed**: call `recalculateItemLinks` after geometry changes; it sets `parentAreaId`/`areaId` by smallest enclosing area (`findAssignedArea`). A `dashboard_box` captures items only while `state.editingDashboardId` is it; scroll boxes (`isScrollBox`) capture items at all times and set `scrollBoxPageId` on them.
- **Visibility chain** `isItemVisibleInContainer` (folders `isOpen`, books `bookTitleId`/`bookPageId` vs `activeTitleId`/`activePageId`, scroll boxes `scrollBoxPageId`) plus `getAnimationOffset`, `getClippingScrollBox`, `applyDOMClip`: every DOM sync (`syncTextsDOM`, `syncTables`, `syncCalendars`, `syncScrollBoxes`, `syncNotesDOM`, `syncFilesVisibility`) must apply all of them and `isItemOnScreen` culling.
- **Link bezier** (`offset = min(dist*0.45, 120/zoom)`) is repeated in `drawLinks`, `drawCurrentPolygon` and the eraser hit test in `handleWorkspacePointerDown`.
- **Magnetic radii**: 500 and 300 are hard-coded in `computeMagneticClusters`, and 500 again in the move-totem action of `showTotemContextMenu` (`const radius = 500`).
- **Checklist syntax** `- [ ]`/`- [x]` is parsed separately in `syncNotesDOM`, the `filesLayer` click listener, `drawDrawings` (progress_bar), `renderNotesWidgetDisplay`, `renderNotesWidget`.
- **Versions move together**: `index.html` (`script.js?v=1062`, `style.css?v=1030`, `sw.js?v=1048`) and `sw.js` (`CACHE_NAME`, `urlsToCache`).
- Folder files: `isHidden:true`, `areaId:null`, id in the folder's `containedFiles` (`assignFileToStorage`). Book files also go to `globalBookFiles` (localStorage), matched to books by NAME.

## Criteria

- No build or tests. Serve over localhost/HTTPS in Chrome/Edge (needs File System Access), open a workspace folder, create/open a fabric, exercise the tool; check console, that `fabric.json`/`thumbnail.jpg` update ~0.5 s after an edit, and that it reloads identically.
- Ad hoc syntax checks: `check_braces.js <file>`, `check_braces.py`, `find_braces.py`, `check_syntax.py`. `test_regex.js` tests a YouTube regex that differs from `ytRegex` in `openTextEditor`. `test.js` and `fix.py` are shell-escape-corrupted and will not run; `check.js` is well-formed Windows Script Host JScript (`ActiveXObject`) that evals `script.js` as a syntax check - it runs only under WSH, not Node.

## Known bugs

1. `index.html` global error handler writes to `getElementById('instruction-bar')`, which does not exist (the element is `instruction-text`), so a script load error throws inside the handler instead of showing.
2. `handleWorkspacePointerUp`, line/arrow branch (`script.js` ~3042): `Math.hypot(start.x - end.x, end.y - end.y)` - second term is always 0, so perfectly vertical lines/arrows are discarded as too short.
3. `prepareFabricState` does not restore `graphicsPreset`, `gridSize`, `snapToGrid` (also `selectMode`, `lassoSelection`); settings are saved but reset to defaults after reopening.
4. The `drop` listener in `setupDragAndDrop` calls `moveFileOutOfFolder`, which is not defined anywhere; the `application/x-folder-file-id` drag type is also never set, so the branch is dead and would throw if reached.
5. `area.isOpen` is read in `isItemVisibleInContainer`/`getClippingScrollBox` but never set true; the folder badge in `drawAreas` counts `f.areaId === area.id` while `assignFileToStorage` sets folder files' `areaId` null (and `recalculateItemLinks` does not skip `isHidden` files), so the count depends on stale x/y.
6. `renderCalendarHTML`: day keys use shared `sync.viewMonth` with the drawing's own year, so a `fixedMonth` calendar reads/writes the wrong month.
7. `generateTotemThumbnail` assigns `canvas.width/height` (resets the context transform incl. `ctx.scale(dpr, dpr)` from `resizeCanvas`) then calls `render()`; on dpr != 1 probably mis-scaled until the next resize (inferred, not run).
8. `renderFileItem` adds a `document` `pointerdown` listener (`hideMenu`) per render, removed only on some paths (leak).
9. `openPdfPreview.loadPdfJs` skips loading 3.11.174 (and setting `GlobalWorkerOptions.workerSrc`) because `index.html` already loads pdf.js 2.16.105, so the worker source is never configured.
10. Static `#fabric-context-menu` buttons (`btn-rename-fabric`, `btn-delete-fabric`) are never shown; `showFabricContextMenu` builds its own. Rename = `copyDirectory` then delete (non-atomic).
11. `buildFileListItemEl` reads legacy `fileData.type/data/size`, absent on current file objects (`isImage`, `imageDataUrl`).
12. `saveCurrentFabric` alerts on thumbnail failure and serialises transient state (`_handles`, `_resizeBox`, `_savedCamera`, `movingTotemContext`, image `imageDataUrl` data URLs, stale `pdfBlobUrl`).
13. Constellation-mode pan jumps: `handleWorkspacePointerDown` (~L1953) sets `state.panStart` to the raw pointer (`{x: e.clientX, y: e.clientY}`), while the other pans (~L2136, ~L2416) store it camera-relative (`e.clientX - state.camera.x`); `handleWorkspacePointerMove` (~L2633) sets `state.camera.x = e.clientX - state.panStart.x` for all three, so in Constellation mode the first move snaps the camera to about the drag distance from the origin (read, not run).

## Features

### Workspace, fabrics and persistence
Grep: `btnOpenWorkspace`, `initializeWorkspace`, `loadFabricsGrid`, `openFabric`, `createAndLoadNewFabric`, `importOldFabric`, `prepareFabricState`, `saveCurrentFabric`, `copyFileToFolder`, `restoreFolderHandle`, `isFolderInUse`, `writeLockFile`, `startLockHeartbeat`, `saveHandleToDB`, `copyDirectory`, `showFabricContextMenu`, `btnHome`.
Found (read): the chosen directory handle is kept in IndexedDB (`FileFabricFS`/`handles`, key `targetWorkspace`) and re-used on startup via `restoreFolderHandle` (permission re-request button "Restore Previous Workspace"). A `.fabric_lock` file (`{timestamp, pid}` with a per-tab `sessionStorage` id) is written to the workspace folder when it is opened, and the 10 s heartbeat (`startLockHeartbeat`) rewrites it in the open fabric's folder (`currentFabricHandle`), not the workspace's - so the workspace lock goes stale once a fabric is open; `isFolderInUse` treats a lock as stale after 30 s and asks via `confirm` to take over. Valid fabrics are sub-folders containing `fabric.json` (or legacy `project.json`). `openFabric` re-hydrates images (`imageDataUrl` from `sources/<name>`) and PDFs (`pdfBlobUrl`) by file NAME in a flat `sources/` folder (area sub-folders were removed, leftover `/* Flat storage */` stubs remain in `handleFileDrop`, `renderFileItem`, `openDocxPreview`). `copyFileToFolder` de-duplicates names (same size -> `prompt` to rename or link to the existing file; different size -> appends an underscore plus the last four digits of the timestamp) and rewrites `fileData.name`. `btnHome` saves and returns to the home grid. `importOldFabric` takes a `.json` and resolves name clashes with `(n)`. `beforeunload` removes the lock and saves. A 1 s `setInterval` re-renders when any `clock` drawing exists.
Connects to: everything via `state`; file import (`handleFileDrop`), thumbnails (`saveCurrentFabric` draws `bgCanvas` + `canvas` at 300px).
Open leads: none unread in this area.

### Camera, modes, toolbar and shortcuts
Grep: `setMode`, `setupToolbarListeners`, `handleWorkspaceWheel`, `startCameraAnimation`, `animateCamera`, `spacePressed`, `closeElementsRibbon`, `closeEraserRibbon`, `hidePropertiesPanel`, `instructionText`, `isPanning`, `panStart`, `cameraPanStartX`.
Found: `state.mode` strings: select, pan, draw, delete, line, arrow, rect, circle, book, text, notepad, folder, totem, elements, place-progress-bar, place-clock, place-calendar, place-dashboard-box, draw-box, place-table, place-scroll-box, move-totem (internal). `setMode` also toggles ribbons, active buttons (main toolbar and the dashboard-edit toolbar `btn-edit-tool-*`), cursor class `draw-mode` and the hint text. Shortcuts (ignored in inputs/contenteditable): V H P T N L A R S(book) M(totem) C E; Shift+R constellation, Shift+D mission control, Shift+S widget sidebar; Space = temporary pan. Wheel zoom is exponential, clamped 0.25-5, pivots on cursor, disabled while `editingDashboardId`. `setMode('folder')` has no hint text branch and no toolbar shortcut. Settings popup: graphics preset, tablet mode, GPU check (`btn-check-gpu`).
Connects to: `handleWorkspacePointerDown/Move/Up` (all tools), `render`.

### Tablet mode (touch gestures)
Grep: `tabletMode`, `setTabletMode`, `handleTabletTouchDown`, `handleTabletTouchMove`, `handleTabletTouchUp`, `activeTouches`, `touchGestureMaxCount`, `TOUCH_SWIPE_THRESHOLD`, `resetTouchGesture`.
Found: device-level setting in localStorage `spatial-tablet-mode`. When on, `pointerType==='touch'` events are fully consumed at the top of the workspace pointer handlers: 2 fingers pan, 2-finger quick tap synthesises `handleWorkspaceContextMenu`, 3-finger swipe up = `openMissionControl`, down = `toggleConstellationMode`, left = `toggleWidgetSidebar`. Gesture class is decided by the peak finger count since all fingers last lifted.

### Ink, shapes, eraser and lasso
Grep: `SmoothPen`, `smoothPen`, `inkCanvas`, `drawCurrentPolygon`, `drawLasso`, `isAreaFullyInsidePolygon`, `isDrawingFullyInsidePolygon`, `doPolygonsOverlap`, `penPalette`, `btnEraserLines`, `eraserMode`.
Found: freehand uses `SmoothPen` on a separate `ink-canvas` overlay (pressure EMA, `getCoalescedEvents`, width 2-8) and is committed as a `path` drawing (>2 points) on pointerup; main-canvas rendering re-smooths with quadratic segments in `drawDrawings`. Shapes: the `line` and `arrow` modes create drawings; the `rect`, `circle` and `book` modes create AREAS through `openNamePrompt` (circle = 64-gon polygon; there is no stroke-only rect/circle drawing from the toolbar, although `drawDrawings` still renders `rect`/`circle` drawing types); a new same-colour shape that partially overlaps an existing area is merged into it (`doPolygonsOverlap` returns false when fully nested, so nesting is kept). `draw-box` makes four separate line drawings. Eraser: normal mode removes links first, then drawings, then areas under the cursor (also tables via DOM click); `lines` mode limits drawings and areas to path/line/arrow - links are hit-tested before that filter, so they are still erased in `lines` mode. Dragging with the eraser re-dispatches synthetic `pointerdown` events. Lasso (select ribbon): freehand polygon, selects fully-enclosed (notes: any corner) areas/drawings/files/totems, then drags the set by incremental dx/dy from `state.dragStartWorld` in `handleWorkspacePointerMove` (`lassoInitialPositions`/`lassoInitialPolygon` are written but never read).
Open leads: `lassoInitialPositions`/`lassoInitialPolygon` are written on lasso grab but I did not see them read for undo.

### Areas, nesting, corner holes and links
Grep: `getAreaBBox`, `getAreaCorners`, `getNearestHole`, `getAreaSize`, `deleteArea`, `startAreaRename`, `startAreaResize`, `showAreaContextMenu`, `openNamePrompt`, `drawAreas`, `drawLinks`, `getThemeAdjustedAreaColor`, `blendHexColors`, `linkDraftStart`, `state.links`.
Found: an area is `{id,name,color,polygons|points,containedFiles,isBook?,isNote?,isFolder?,type?,isLocked,parentAreaId}`. Dragging an area moves a "drag set" = the area plus all areas fully inside it (or locked children) plus drawings fully inside and files whose `areaId` is in the set; the set is brought to the end of `state.areas` (z-order). Right-click menu: rename, resize (8 handles remapping every point proportionally, Esc restores), colour, lock, delete (edit for dashboard/scroll boxes, toggle orientation for scroll boxes). Non-book, non-scroll-box areas show 4 corner "holes"; with the line tool, dragging from one hole to another creates a `state.links` entry (`fromAreaId/fromCorner/toAreaId/toCorner`) drawn as a bezier by the TOP-MOST linked area in `drawAreas`, with occlusion rules (shared container: no occlusion; direct parent of one end: hidden; unrelated area crossed: blurred "tunnel"). `deleteArea` removes links but not the area's child drawings/notes. In `efficient` preset areas are filled opaque via `blendHexColors` and the per-area backdrop blur is skipped.
Connects to: `recalculateItemLinks`, culling (`areaOwnsVisibleLink` keeps off-screen link owners alive).

### Books (paged shelves)
Grep: `isBook`, `titles`, `activeTitleId`, `activePageId`, `handleBookUIClick`, `drawBookUI`, `bookName`, `bookTitleId`, `bookPageId`, `globalBookFiles`, `loadGlobalShelves`.
Found: a book area has `titles[{id,name,pages[]}]`, tabs on the right edge, `<` `>` arrows around the title (the `>` on the last page appends a page), `+` adds a title. Only items whose `bookTitleId/bookPageId` match are visible. Files dropped in a book are moved into `globalBookFiles` (localStorage) - `assignFileToStorage` removes them from `state.files` - and re-attached to any book with the same name in any fabric (`prepareFabricState`, `openNamePrompt`). Renaming a book updates the global copies. Clicks on the arrows/tabs/`+` are handled in the select-mode branch of `handleWorkspacePointerDown` through `handleBookUIClick` (tabs and `+` sit outside the polygon, so that branch also tests books that were not hit).
Open leads: `pendingBookData` and `btn-delete-global-book`, `book-selector`, `book-name-input` (ribbons in `index.html`) have no listeners that I saw in `script.js`.

### Files: drop import, file cards, previews
Grep: `setupDragAndDrop`, `handleFileDrop`, `handleFolderDrop`, `renderFileItem`, `isImageFile`, `isPdfFile`, `getFileIcon`, `openPdfPreview`, `openDocxPreview`, `openCodePreview`, `loadDocxJs`, `uploadProgress`, `isPinnedPdfPage`, `isYoutube`.
Found: dropping files anywhere calls `handleFileDrop` (position + area hit with smallest-area priority, dashboard/scroll boxes only while editing; drop onto the open edge sidebar assigns to that folder); `.txt` files become note areas instead of files; dropped directories become a folder area (`handleFolderDrop`, flat, non-recursive). Image data is read into `imageDataUrl`; PDFs get `pdfBlobUrl`. A file card has a "⋮" menu (open, resize, unpin, note, lock, copy, delete); dragging a card past release re-assigns it to the area under the pointer. PDF preview renders one page at a time to a canvas with zoom; "Pin" snapshots the current page as `isPinnedPdfPage` JPEG on the canvas. Pasting a YouTube URL as a text note turns it into a thumbnail card (`isYoutube`, double-click opens the URL). Generic double-click opens docx (docx-preview + JSZip from unpkg, loaded lazily), code/markdown/csv/ipynb as text (notebooks rendered with `marked`), anything else triggers a download from `sources/`. `uploadProgress` is the bottom ribbon; many font/align/bold handlers call `uploadProgress.finish()` oddly (leftover).

### Folders and Edge sidebar
Grep: `isFolder`, `containedFiles`, `openEdgeSidebar`, `renderEdgeSidebar`, `buildFileListItemEl`, `toggleEdgeSidebarEditMode`, `refreshFolderWidgets`, `activeEdgeFolderId`.
Found: folder area is a fixed 120x90 polygon drawn as a folder shape; double-click opens the edge sidebar listing `containedFiles`; in edit mode items can be deleted or dragged out (drag clones the file onto the canvas at the original pointer-down point and forwards a synthetic pointerdown to it). `buildFileListItemEl` is shared with the folder widget.

### Text boxes and rich text
Grep: `openTextEditor`, `syncTextsDOM`, `showPropertiesPanel`, `updateInlineEditorStyle`, `syncPropertiesPanelToSelection`, `savedSelectionRange`, `scaleInlineFontSizes`, `resizingText`, `tableTextProxy`, `getLineFontSize`.
Found: text drawings (`type:'text'`) store HTML (`text`), `fontSize` in world px, `width` optional. Editing is an absolutely-positioned `contenteditable` at screen scale, with inline `font-size` spans scaled by zoom on open and divided on close (`scaleInlineFontSizes`); ribbon controls use `document.execCommand` with a saved selection range. Rendering is by DOM (`syncTextsDOM`), the canvas only draws highlight, selection box, and resize handles (`_handles`, `_resizeBox`; only east/west). Left/right edge dragging resizes width. `tableTextProxy` makes the ribbon drive table-cell formatting but nothing in what I read assigns it to `state.selectedText`.
Open leads: where `tableTextProxy` is meant to be activated (likely removed code).

### Notes (notepad areas)
Grep: `createNotepad`, `syncNotesDOM`, `isNote`, `textContent`, `note-editor`, `sticky-note-container`.
Found: a note is an area (`isNote:true`, colour `#fff3c4`, 250x250) with `textContent`; DOM = display div (headings `#`, checkbox lines) + hidden textarea shown on double-click; Ctrl+B toggles a checkbox on the current line; clicking a rendered checkbox rewrites the markdown line. Used as the data source for progress bars.

### Tables
Grep: `syncTables`, `place-table`, `colWidths`, `rowHeights`, `table-context-menu`, `isResizing`.
Found: `state.tables[{id,x,y,rows,cols,cells,colWidths,rowHeights,parentAreaId,areaId,scrollBoxPageId}]`; DOM `<table>` of contenteditable cells; rebuilt only when a structural signature (`_tableSig`) changes; Ctrl+B in a cell inserts a checkbox; right-click menu resize (drag handles) / delete.

### Progress bars, clocks, calendars (dashboard elements)
Grep: `progress_bar`, `getLinkedNotesForProgressBar`, `showProgressBarContextMenu`, `clock`, `showClockContextMenu`, `syncCalendars`, `renderCalendarHTML`, `updateAllCalendarsHTML`, `showCalendarContextMenu`, `calendarSync`.
Found: progress bar and clock are canvas-drawn in `drawDrawings`. A bar finds its parent area, then BFS-expands through nested notes, lines whose ends touch two areas, and `state.links` to collect linked notes; progress = checked/total checkboxes of the selected note(s) (auto-match by vertical order among peer bars, or `targetNoteId`), animated with `animatedProgress`. Calendars are DOM; month navigation is shared (`state.calendarSync.viewMonth/viewYear`) unless the calendar is "Fixed Month"; schedules colour days with `prompt` input (`state.calendarSync.schedules`, keyed by year-month-day strings such as 2026-07-04).

### Dashboard box, scroll box and dashboard edit mode
Grep: `dashboard_box`, `isScrollBox`, `enterDashboardEditMode`, `exitDashboardEditMode`, `editingDashboardId`, `renderPagesList`, `startScrollBoxAnimation`, `syncScrollBoxes`, `renderScrollBoxHTML`, `getActiveScrollBoxPageId`, `dashboard-edit-modal`.
Found: `dashboard_box` is a plain 400x300 area that only adopts items while being edited. A scroll box is a paged container (`pages[]`, `currentPageIndex`, `layout` horizontal|vertical, 300 ms slide `animation`); each child carries `scrollBoxPageId`. Edit mode shows a modal over the canvas (pointer-events pass through the "hole"), animates the camera to fit the box, hides the main toolbar, and restores `_savedCamera` on Done. Its sidepanel has theme colour / grid size / snap-to-grid (applied via `de-opt-apply`) and a draggable page list.
Open leads: `state.snapToGrid` is stored and shown but I did not find code that snaps.

### Totems, magnetic fields, constellation, mission control
Grep: `state.totems`, `computeMagneticClusters`, `activeMagneticFields`, `drawGrid`, `drawTotems`, `generateTotemThumbnail`, `showTotemContextMenu`, `movingTotemContext`, `toggleConstellationMode`, `drawConstellationLinks`, `openMissionControl`, `syncTotemIndicators`.
Found: totems are named pills. `computeMagneticClusters` (run from `drawGrid` every frame) assigns `linkedTotemId` to every area/drawing/file within 500 px of a totem and chains outward at 300 px; grid dots near fields are tinted by influence. "Move Totem & Field" collects everything within 500 px (plus `linkedTotemId` matches, tables, other totems) and moves them with the pointer until the next click; direct dragging of totems is disabled. Constellation mode (Shift+R) hides files, draws bowed curves between totems whose areas are linked, and clicking a totem zooms to it. Mission control shows `thumbnail` cards (made by `generateTotemThumbnail` when the totem is created; `openMissionControl` only fills a missing one, and the menu's refresh is the only way to regenerate one). `syncTotemIndicators` is a stub that clears the layer (edge arrows were removed); `getTotemInitials`/`getOffscreenIndicatorPosition` are unused.

### Render pipeline and performance
Grep: `render`, `scheduleRender`, `updateViewBounds`, `getRenderBBox`, `isBBoxOnScreen`, `bgCanvas`, `graphicsPreset`.
Found: order in `render()`: fill, `drawGrid`, (constellation branch returns early), background drawings (locked, no area), `drawAreas` (each area snapshots the canvas into `bgCanvas`, blurs it under itself unless `efficient`; draws its own locked drawings and links), `drawTotems`, foreground drawings, `drawCurrentPolygon`, `drawLasso`, then DOM syncs, then a re-schedule while scroll-box animations run. Culling margin is 12.5% per side of the viewport.

### Side panels and Widget sidebar
Grep: `sidePanelStack`, `hiddenSidePanels`, `openSidePanel`, `hideSidePanel`, `closeSidePanel`, `updateSidePanelSelectors`, `toggleWidgetSidebar`, `WIDGET_RENDERERS`, `createDefaultWidget`, `renderWidgetSidebar`, `setupWidgetDrag`, `state.sidebarWidgets`.
Found: Edge and Widget sidebars share a card-stack model (frontmost / receded / hidden) with tab switcher in the headers; Escape or an outside click only HIDES, the × button closes. Widgets (`calendar`, `clock`, `notes`, `progress_bar`, `folder`, `text`, `rect`) are stored in `state.sidebarWidgets`; the sidebar calendar widget keeps its own month/schedules (not `calendarSync`), and clock widgets share one 1 s interval.

### PWA and service worker
Grep: `CACHE_NAME`, `urlsToCache`, `manifest.json`.
Found: `sw.js` is network-first with cache fallback (`ignoreSearch`), only for same-origin and cdnjs/jsdelivr GETs. `manifest.json`, `icon-192.png`, `icon-512.png` exist but I did not read the manifest.

### Dev helper scripts and backup files
`refactor.py` (one-shot: turned the inline listeners in `setupWorkspaceListeners` into the named `handleWorkspace*` functions - already applied), `restore.py` (splices a region from `script.js.fixed6` into a new `script.js.restored`), brace/syntax checkers, `fix.py` (broken) and `check.js` (WSH-only syntax check). `script.js.fixed*`, `.restored`, `.patched`, `style.css.bak`, `index.html.bak-dupfix-20260717` are unread snapshots; only `script.js`, `style.css`, `index.html`, `sw.js` are loaded by the app.

## Open leads

- `style.css` lines 2101-2154 and 2435-2734 (scroll-box dots variants, widget cards/forms) were not read; `.cal-*` and `.calendar-container` are defined twice (~1759-1860 and ~2835-2958) with the later block winning.
- `manifest.json`, `knowledge/*.md`, the Claude settings folder, the `script.js.*` snapshots, `style.css.bak` and `index.html.bak-dupfix-20260717` were not read.
- Unread-by-use names: `pendingBookData`, `lassoInitialPositions`, `tableTextProxy`, `getTotemInitials`, `getOffscreenIndicatorPosition`, `HSLToHex`/`hexToHSL` are used only as described above; `isDashboard` is tested in `showAreaContextMenu` but never set.
- Whether anything snaps to `state.gridSize` (only `drawGrid` and the dashboard options use it as far as I read).
