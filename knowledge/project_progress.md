# PROJECT PROGRESS — Spatial File Manager (File Fabric)

---

## 📜 GUIDELINES FOR MAINTAINING THIS FILE

> **READ THIS SECTION FIRST BEFORE MAKING ANY CHANGES TO THIS FILE.**

### Core Rules

1. **APPEND-ONLY**: Nothing in this file may ever be deleted. You may only ADD new entries.
2. **Removed Features**: If a feature is removed, do NOT delete its entry. Instead, add a line:
   `- **[REMOVED on YYYY-MM-DD]**: <reason>`
3. **Changed Features**: If a feature is changed, do NOT delete the old description. Add:
   `- **[CHANGED on YYYY-MM-DD]**: <old behavior> → <new behavior>`
4. **Renamed Features**: If a feature or file is renamed, add:
   `- **[RENAMED on YYYY-MM-DD]**: <old name> → <new name>`
5. **Bug Fixes**: When fixing a bug, add a new entry under the Changelog section with date, description of the bug, and what was changed.
6. **New Features**: When adding a new feature, add it to the Features section AND add a changelog entry.
7. **Date Format**: Always use `YYYY-MM-DD` format for dates.
8. **Line References**: When referencing code, include the file name and approximate line number: `script.js:L920`
9. **User Quotes**: When the user gives important instructions or preferences, quote them verbatim in the "User Directives" section.
10. **Never Assume Deletion Is OK**: If a previous agent deleted code and left a comment like `// REMOVED`, that is a BUG. The code must be restored. Always check this file first to understand what features should exist.

### How to Add a Changelog Entry

```
### YYYY-MM-DD — <Short Title>
- **What**: <Description of what was done>
- **Why**: <Reason / user request>
- **Files Modified**: <list of files>
- **Lines Changed**: <approximate line ranges>
- **Status**: DONE | IN PROGRESS | REVERTED | BROKEN
```

### How to Add a Bug Report

```
### BUG-XXXX — <Short Title>
- **Reported**: YYYY-MM-DD
- **Description**: <What is broken>
- **Expected**: <What should happen>
- **Status**: OPEN | FIXED (YYYY-MM-DD) | WONTFIX
- **Fix Details**: <What was changed to fix it>
```

### Reading Priority for New Agents

If you are a new agent picking up this project (e.g., after conversation truncation):
1. Read this entire file first.
2. Check the "Outstanding Issues" section for unfinished work.
3. Check the "User Directives" section for user preferences and rules.
4. Do NOT delete any code without explicit user approval.
5. Do NOT remove features — if unsure, ask the user.

---

## 📁 PROJECT OVERVIEW

- **Project Name**: Spatial File Manager (also called "File Fabric")
- **Project Age**: ~3.5 months (earliest artifacts date to 2026-03-28)
- **Location**: `E:\antigravity\file-fabric\`
  - **[CORRECTED on 2026-07-21]**: Actual working directory is `E:\antigravity V1\file-fabric\` (note the `V1`).
- **Type**: Single-page web application (vanilla HTML/CSS/JS)
- **Purpose**: An infinite 2D canvas app for spatially organizing, managing, and linking files. Users can drop files, draw regions (areas), add text, create dashboards, and visually connect related content.
- **PWA**: Yes — includes `manifest.json`, `sw.js`, icons (`icon-192.png`, `icon-512.png`)
- **Target Browser**: Chrome/Edge (requires File System Access API)
- **Hosting**: Served via local HTTP server (http-server) on **port 9075**
  - **[CHANGED on 2026-07-14]**: Port 5075 → Port 9075 per user request.
- **Data Storage**: Uses the browser File System Access API. Fabrics are saved as JSON files in a user-selected workspace directory. Each fabric has its own subdirectory with a `fabric.json` and a `sources/` folder for imported files.
- **No Backend**: Entirely client-side. No server-side logic.
- **Previous Conversation ID**: `65676443-a8f8-433b-9239-42e2437ed8b2` (title: "host the webapp locally in port 5000")

---

## 📂 FILE STRUCTURE

| File | Purpose |
|---|---|
| `index.html` | Main entry point. Contains all HTML structure: toolbar, ribbons, modals, templates, overlays. Version-tagged CSS/JS includes. |
| `script.js` | Core application logic (~9658 lines — **[UPDATED on 2026-07-21]: now ~11,426 lines** after the viewport-culling/render-coalescing/AABB-reject optimization work, see Changelog). State management, rendering, event handling, file system access, all features. |
| `style.css` | All CSS styles (~2049 lines — **[UPDATED on 2026-07-21]: now ~3,017 lines**). CSS variables, component styles, animations. |
| `style.css.bak` | Backup of an older version of style.css. |
| `manifest.json` | PWA manifest. App name: "Spatial File Manager", short name: "File Fabric". |
| `sw.js` | Service worker for PWA (currently being nuked on load to prevent cache issues). |
| `icon-192.png` | PWA icon 192x192 |
| `icon-512.png` | PWA icon 512x512 |
| `script.js.fixed` through `script.js.fixed6` | Historical fix attempts (do not use, keep for reference). |
| `script.js.patched` | A patched version from a previous session. |
| `script.js.restored` | A restored version from a previous session. |
| `check.js`, `check_braces.js`, `check_braces.py`, `check_syntax.py`, `fix.py`, `restore.py`, `test.js`, `test_regex.js` | Utility/debugging scripts used during development. |

---

## 🔧 TOOLS & TECHNOLOGIES

| Tool | Purpose |
|---|---|
| **Vanilla HTML/CSS/JS** | Core stack. No frameworks. |
| **Canvas 2D API** | Main rendering surface for areas, drawings, grid, totems, links, etc. |
| **File System Access API** | Reading/writing workspace directories and fabric files. |
| **IndexedDB** | Persisting directory handles across sessions (`openHandleDB`). |
| **http-server (npm)** | Local development server on port 5075. |
| **PDF.js** | PDF preview rendering (loaded dynamically). |
| **docx-preview** | DOCX file preview (loaded dynamically via unpkg CDN). |
| **JSZip** | Required by docx-preview (loaded dynamically via unpkg CDN). |
| **Google Fonts (Inter)** | Primary font family. |
| **PWA (manifest + SW)** | Installable web app support. SW is currently disabled on load to prevent caching issues. |

---

## ⚡ FEATURES

### Canvas & Navigation
- **Infinite 2D Canvas**: Pan and zoom with mouse/touch. Camera state: `{ x, y, zoom }`.
- **Grid Rendering**: Configurable grid size (default 40px). Snap-to-grid option.
- **Pan Tool (H)**: Drag to pan the canvas.
- **Zoom**: Scroll wheel to zoom in/out. High DPI support via `devicePixelRatio`.
- **Space + Drag**: Hold space to temporarily pan regardless of current tool.
- **Graphics Presets**: "Performance" and "Efficient" modes via settings dropdown.

### Drawing Tools
- **[RESTORED on 2026-07-15] Pencil Tool (P)**: Completely rebuilt "Apple Pencil" style drawing engine (`SmoothPen` class). Uses a dual-canvas overlay (`#ink-canvas`) initialized with `{ desynchronized: true }` for zero-latency drawing. Features high-frequency hardware polling via `getCoalescedEvents()`, Bezier curve midpoint interpolation for smooth ink, and Exponential Moving Average (EMA) pressure sensitivity. Drawings are baked to the main canvas on `pointerup`.
- **Line (L)**: Draw straight lines between points.
- **Arrow (A)**: Draw arrows with directional heads.
- **Rectangle (R)**: Draw rectangular shapes.
- **Circle (C)**: Draw circular shapes.
- **Eraser / Delete (E)**: Two modes — "Normal" (delete anything) and "Lines Only" (delete only line/arrow drawings). Has its own ribbon panel.

### Text & Notes
- **Text Tool (T)**: Place text labels on canvas.
  - **[CHANGED on 2026-07-16]**: Migrated from Canvas `ctx.fillText` rendering to DOM-based `<div class="text-item">` to support full HTML Rich-Text editing. Text now exists perfectly synced inside the `#files-layer`.
  - Properties ribbon for: font size (12–120px), font family (Inter, Georgia, Courier, Comic Sans), bold, italic, alignment (left/center/right), text border toggle, text color, highlight/background color.
  - Rich Text Formatting: When editing a text box, selecting specific words and clicking ribbon formatting buttons applies changes *only* to the highlighted text (via `document.execCommand`).
- **Notepad Tool (N)**: Place resizable notepad widgets. Features: word wrap toggle, sticky mode toggle, font size controls (A-/A+), character count, close button. Template in `index.html` (`#tpl-notepad`).

### Areas (Regions)
- **Named Color Regions**: Drawn with pencil tool. Each area has: id, name, color, points (polygon), optional multi-polygon support.
- **Area Context Menu**: Right-click for options (rename, resize, delete, etc.).
- **Area Resize**: Interactive handle-based resizing with escape-to-cancel.
- **Area-to-Area Links**: Animated curved connection lines between areas. State: `state.links[]` with `fromAreaId`, `toAreaId`, corners, color.
- **Area Corner Holes**: Visual anchor points on area corners for link connections.
- **Marching Ants Selection**: Selected areas show animated dashed borders.
- **Area Animation**: Slide transitions when navigating between area "pages" (scroll boxes).

### Selection
- **Select Tool (V)**: Click to select items. Supports normal and lasso modes.
- **Lasso Selection**: Draw a freehand polygon to select multiple items (areas, drawings, files, totems).
- **Multi-drag**: Drag selected groups of items together.

### Files
- **Drag & Drop Import**: Drop files from OS onto the canvas. Files are copied into the fabric's `sources/` directory.
- **File Rendering**: Files shown as visual cards on the canvas with thumbnails (images), icons (PDFs, docs), etc.
- **PDF Preview**: Double-click PDFs to open an in-app PDF viewer with zoom controls. Uses PDF.js.
- **DOCX Preview**: Double-click .docx files for in-app preview. Uses docx-preview library.
- **Code Preview**: Double-click .py/.ipynb files for syntax-highlighted preview.
- **Pinned PDF Pages**: Individual PDF pages can be pinned as separate items on the canvas.
- **YouTube Links**: YouTube URLs can be placed as visual cards. Double-click opens in new tab.
- **Upload Progress Ribbon**: Shows import progress with spinner, text, progress bar, and count.

### Books (Shelves)
- **Book Tool (S)**: Organize items into named "books" (collections/groups).
- **Book Ribbon**: Select existing book or create new book. Place items into books.
- **Global Shelves**: Books are saved globally via `loadGlobalShelves()` / `saveGlobalShelves()`.
- **Delete Book**: Remove a book and all its associations.

### Folders
- **Folder Tool (F)**: Create folder containers on the canvas.
- **Edge Sidebar**: Click a folder to open a slide-out sidebar showing folder contents. Supports edit mode for rearranging/removing items.

### Totems
- **Totem Marker Tool**: Place named markers (totems) on the canvas. Rendered as colored rounded-rect pills with text.
- **Totem Indicators**: When totems are off-screen, floating indicator buttons appear at screen edges pointing toward the totem. Shows initials of totem name.
- **Totem Context Menu**: Right-click for options.
- **Constellation Mode (Shift+R)**: Zooms out to show all totems at once in an overview mode.

### Dashboard / Elements System
- **Dashboard Creator Tool ($)**: Opens a ribbon with placeable dashboard widgets.
- **Progress Bar**: Placeable progress bar widget with context menu for editing value.
- **Clock**: Placeable live clock widget with context menu.
- **Calendar**: Placeable calendar widget. Features: month navigation (prev/next), today highlighting, week starts on Monday, schedule/event support per day, fixed-month mode, calendar context menu with 3-dot options button, synchronized view across calendars.
- **Dashboard Box**: A titled box container for grouping dashboard content.
- **Plain Box**: A simple rectangular box element.
- **Table**: Configurable rows×cols table with editable cells. Supports checkboxes (Ctrl+B), contenteditable cells, context menu for resize/delete.
- **Scroll Box**: Multi-page container with navigation (prev/next, dots, add page). Animated page transitions. Contains child areas that animate in/out.

### Dashboard Edit Mode
- **Dashboard Edit Popup**: Full-screen modal editor for editing dashboard areas. Activated by editing a dashboard area.
- **Topbar Tools**: Select/Move, Pan, Pencil, Text, Notepad, Progress Bar, Clock, Calendar, Dashboard Box, Box, Table, Scroll Box.
- **Side Panel**: Background color picker, grid size slider, snap-to-grid toggle, "Apply Theme" button, pages list.
- **Done Button**: Exits edit mode, restores camera.

### Mission Control
- **Shortcut**: `Shift + D`
- **[REMOVED — DATE UNKNOWN]**: A previous agent deleted the entire Mission Control feature and left only a comment `// ===== MISSION CONTROL REMOVED =====` at script.js:L9182.
- **[RESTORED on 2026-07-14]**: Feature was rebuilt. Now opens a glassmorphic overlay showing all totems with auto-generated screenshots. Clicking a totem teleports the camera to it.

### Home Screen / Workspace Management
- **Home Screen Overlay**: Full-screen overlay showing workspace selection and fabric list.
- **Open Target Workspace**: Button to select a workspace directory via File System Access API.
- **Fabrics Grid**: Visual grid of all fabric cards in the workspace. Each card shows fabric name.
- **New Whiteboard**: Create a new fabric with name and background color options.
- **Import Old Project**: Import a legacy `.json` fabric file.
- **Fabric Context Menu**: Right-click a fabric card for rename/delete options.
- **Home Button (toolbar)**: Returns to the home screen.
- **Lock Heartbeat**: Tab-level locking to prevent multiple tabs editing the same fabric (`startLockHeartbeat`).
- **Handle Persistence**: Saves/restores workspace directory handles via IndexedDB across sessions.

### Color System
- **Fabric Color Picker**: Change canvas background color.
- **Area Color Picker**: Change default area fill color.
- **Text Color Picker**: Change text color for selected text.
- **Highlight Color Picker**: Change text background/highlight color.
- **20-Color Preset Palette**: Custom color palette popup for quick color selection.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `H` | Pan tool |
| `P` | Pencil tool |
| `T` | Text tool |
| `N` | Notepad tool |
| `L` | Line tool |
| `A` | Arrow tool |
| `R` | Rectangle tool |
| `S` | Book tool |
| `C` | Circle tool |
| `E` | Eraser / Delete tool |
| `Space + Drag` | Temporary pan |
| `Shift + R` | Toggle Constellation Mode |
| `Shift + D` | Mission Control — **[CURRENTLY BROKEN — feature deleted by previous agent]** |

---

## 👤 USER DIRECTIVES

> These are verbatim or paraphrased instructions from the user that must be respected by all agents.

1. **"NOTHING SHOULD BE DELETED FROM THE .md FILE ONLY TO BE ADDED"** — This file is append-only. (2026-07-14)
2. **"if any feature is removed then it should just mention it as removed or changed to or renamed to but the older data should be there"** — Never erase history. (2026-07-14)
3. **"mission control is not opening when i press shift + D"** — The Mission Control feature must be restored. (2026-07-14)
4. **"i am getting a notification in antigravity saying server cleared a prefix of the conversation as it grew too large. that maybe the case you are in loop and forgeting things i told you"** — Conversation truncation is happening. This file exists to mitigate that. (2026-07-14)
5. **Do NOT delete features without explicit user approval.** A previous agent deleted Mission Control without permission. This must never happen again.
6. **Hosting Port**: The app is served on **port 9075**.
   - **[CHANGED on 2026-07-14]**: Port 5075 → Port 9075.

---

## 🐛 OUTSTANDING ISSUES

### BUG-0001 — Mission Control Not Opening (Shift+D)
- **Reported**: 2026-07-14
- **Description**: Pressing `Shift + D` does nothing. The entire Mission Control feature was deleted by a previous agent. Only a comment remains at `script.js:L9182`.
- **Expected**: A Mission Control overlay/panel should open.
- **Status**: FIXED (2026-07-14)
- **Fix Details**: Rebuilt the feature from scratch. `Shift+D` now triggers `openMissionControl()` which creates a DOM overlay grid of totems and their screenshot thumbnails.

### BUG-0002 — Main Ribbon Missing / Scaling Problem
- **Reported**: 2026-07-14 (approx)
- **Description**: The main toolbar/ribbon disappears and UI scaling is broken.
- **Expected**: Toolbar should always be visible. UI should scale correctly.
- **Status**: FIXED (2026-07-14)
- **Fix Details**: Restored `#workspace` width/height to `100vw`/`100vh` and removed the `100%` on `body` which was causing a 0-height workspace layout collapse.

### BUG-0003 — Scroll Box and Area Box Interactive Area Disoriented
- **Reported**: 2026-07-14 (approx)
- **Description**: The interactive areas/hitboxes for scroll boxes and area boxes are misaligned from their visual positions.
- **Expected**: Clickable regions should match visual positions exactly.
- **Status**: FIXED (2026-07-14)
- **Fix Details**: Fixed by the same `#workspace` CSS fix above. The canvas coordinate mapping `screenToWorld` relies on the workspace taking up the whole screen.

### BUG-0004 — Totem Floating Buttons Misaligned
- **Reported**: 2026-07-14 (approx)
- **Description**: Totem indicator buttons at screen edges are not positioned correctly.
- **Expected**: Indicators should point toward off-screen totems from the nearest screen edge.
- **Status**: FIXED (2026-07-14)
- **Fix Details**: Restored missing `transform: translate(-50%, -50%);` to `.totem-indicator` in `style.css`.

### BUG-0005 — Calendar Visual State Corrupted
- **Reported**: 2026-07-14 (approx)
- **Description**: The calendar widget is visually "messed up" — likely CSS or DOM rendering issue.
- **Expected**: Calendar should render cleanly with proper grid layout, navigation, and today highlighting.
- **Status**: FIXED (2026-07-14)
- **Fix Details**: Removed duplicate conflicting `.cal-header` definition and defined missing CSS variables `--text-secondary` and `--bg-hover` in `:root`.

### BUG-0006 — ReferenceError on Tool Use
- **Reported**: 2026-07-15
- **Description**: All tools stopped working and threw `Uncaught ReferenceError: worldPos is not defined` when trying to interact with the canvas.
- **Expected**: Tools should function normally without throwing errors.
- **Status**: FIXED (2026-07-15)
- **Fix Details**: Moved `const worldPos` declaration out of a scoped `else` block so it is available to all interaction logic in `pointermove`. Also removed dangling `addEventListener` calls for deleted pen toolbar buttons that broke app initialization.

### BUG-0007 — Code Preview Modal Invisible
- **Reported**: 2026-07-15
- **Description**: Double-clicking `.ipynb` and `.py` files appeared to freeze the UI because the code preview modal was opening invisibly.
- **Expected**: The code modal should be visible.
- **Status**: FIXED (2026-07-15)
- **Fix Details**: Added `modal.style.opacity = '1'` to `openCodePreview()` to override the default `.pdf-modal-overlay` hidden opacity state.

### BUG-0008 — Markdown Styling Broken in Notebooks
- **Reported**: 2026-07-15
- **Description**: Markdown text inside Jupyter notebooks (e.g., `# Heading`) was rendering bold but without correct font scaling due to default CSS resets stripping header sizes.
- **Expected**: Markdown headers and formatting should look correct.
- **Status**: FIXED (2026-07-15)
- **Fix Details**: Added `marked.min.js` to properly parse markdown strings into HTML, and wrapped the output in a `.notebook-markdown` container with explicit CSS styles to override the global CSS reset for `h1`-`h4`, `pre`, and `code`.

### BUG-0009 — Right-Click Panning Triggers Context Menu
- **Reported**: 2026-07-15
- **Description**: Panning with the right mouse button would accidentally trigger the browser's context menu or the custom area options menu upon release.
- **Expected**: Panning should quietly release without triggering menus.
- **Status**: FIXED (2026-07-15)
- **Fix Details**: Added logic to track the camera start coordinates during `handleWorkspacePointerDown`. In `handleWorkspacePointerUp`, if the camera moved more than 5 pixels, it sets a timestamp `lastPanEndTime`. The context menu handler intercepts and prevents any menu from opening if called within 100ms of panning.

### BUG-0010 — Files Lag When Scrolling or Panning Areas
- **Reported**: 2026-07-15
- **Description**: Files dragged into a scroll box or drawn area exhibited a "delayed animation" (rubber-banding lag) when the area was moved or the box was scrolled.
- **Expected**: Files should stick perfectly to the scroll box/area without lag.
- **Status**: FIXED (2026-07-15)
- **Fix Details**: Removed `transform` and `all` from the `.file-item` CSS `transition` property. The CSS animation engine was trying to tween the instant coordinate updates sent by the JS render loop, causing the 0.3s lag.

### BUG-0011 — Stray "Resize Table / Delete Table" Menu Appears in Bottom-Left While Editing Text
- **Reported**: 2026-07-17
- **Description**: A "Resize Table / Delete Table" context menu (and the upload progress ribbon) appeared spontaneously in the bottom-left corner of the canvas while the user was editing a text box — without ever right-clicking a table.
- **Root Cause**: `index.html` had a large duplicated block. The entire region `elements-ribbon-panel → table-config-ribbon → eraser-ribbon → pen-ribbon → instructions → workspace → tpl-notepad → fabric-context-menu → table-context-menu → upload-progress-ribbon → edge-sidebar` was present TWICE (first copy started at the first `#elements-ribbon-panel`, second copy was the complete, correct one followed by `#mission-control-overlay`). The first copy's `#edge-sidebar` was also truncated (missing its `#edge-sidebar-content` div). This produced duplicate element IDs across the document. The second, duplicate `#table-context-menu` and `#upload-progress-ribbon` were `position: absolute` but never got their `hidden` class managed by JS (`getElementById` only ever targets the first copy), so they rendered in normal document flow at the bottom-left, leaking onto the canvas.
- **Expected**: The table context menu should only appear when right-clicking a table; no stray menus on the canvas.
- **Status**: FIXED (2026-07-17)
- **Fix Details**: Removed the first (broken/truncated) duplicate copy from `index.html` (former lines 370–564), leaving a single clean copy of every element. Verified via script: zero duplicate IDs remain, `<div>` open/close balanced (111/111), `<template>` balanced (1/1), and the surviving `#edge-sidebar` correctly contains its `#edge-sidebar-content`. Bumped cache-buster `script.js?v=1049 → v=1050`; bumped SW `CACHE_NAME v1049 → v1050` and refreshed its precache list (`script.js?v=1050`, `style.css?v=1028`). A backup of the pre-fix HTML was saved as `index.html.bak-dupfix-2026-07-17`.

---

## 📋 CHANGELOG

### 2026-07-17 — Removed Duplicated HTML Block (Stray Table Menu Fix)
- **What**: Deleted a large duplicated block in `index.html` (former lines 370–564) that repeated the ribbon panels, workspace, notepad template, context menus, upload ribbon, and a truncated edge-sidebar.
- **Why**: The duplicate `#table-context-menu` and `#upload-progress-ribbon` (never hidden by JS, which only targets the first-matched ID) rendered in the bottom-left of the canvas, appearing as a spurious "Resize Table / Delete Table" menu while the user edited a text box. See BUG-0011.
- **Files Modified**: `index.html`, `sw.js`
- **Lines Changed**: `index.html` former L370–L564 removed (793 → 598 lines); cache-buster `v=1049 → v=1050`; `sw.js` CACHE_NAME `v1049 → v1050`, precache versions refreshed.
- **Status**: DONE

### 2026-07-15 - Mission Control Restoration & JS Syntax Fix
- **What**: Restored Mission Control HTML/CSS and fixed a trailing comma in JS.
- **Why**: The massive refactor accidentally deleted the Mission Control HTML overlay causing Shift+D to fail, and left a trailing `, { passive: false }` causing JS to fail to load, rendering buttons unclickable.
- **Files Modified**: `index.html`, `style.css`, `script.js`
- **Lines Changed**: `index.html:L570`, `style.css:L2075-L2120`, `script.js:L1267`
- **Status**: DONE

### 2026-07-15 — Code Preview, Notebook Rendering & UX Fixes
- **What**: Fixed invisible code preview modal, integrated `marked.js` for Jupyter notebook Markdown parsing, fixed right-click panning context menu triggering, and eliminated visual lag when scrolling/panning files.
- **Why**: User reported UI freezing on `.ipynb` files, incorrect notebook markdown formatting, context menu interruptions when panning, and delayed file animations.
- **Files Modified**: `script.js`, `style.css`, `index.html`
- **Status**: DONE
- **Fix Details**: 
  - **Code Preview**: Forced `opacity: '1'` on the dynamically created code modal.
  - **Jupyter Notebooks**: Imported `marked.min.js` via CDN and added a `.notebook-markdown` CSS namespace to restore default browser styles (font size, margins, font weight) for headings and code blocks inside notebooks.
  - **Right-Click Panning**: Added a distance threshold check to `handleWorkspacePointerDown/Up` that records `lastPanEndTime`. The context menu is now suppressed if it fires immediately after the camera was moved.
  - **Delayed File Animation**: Removed `all` and `transform` from the `.file-item` CSS `transition` rules so the DOM elements instantly sync with JS coordinate updates instead of tweening.

### 2026-07-15 — Codebase Cleanup & Refactoring
- **What**: Performed a massive code audit and removed dead code, while structurally refactoring a major logic block.
- **Why**: User requested to identify and clear out "debris" from removed features and rearrange code for neatness.
- **Files Modified**: `index.html`, `style.css`, `script.js`
- **Status**: DONE
- **Fix Details**: 
  - **HTML**: Removed the orphaned `<div id="mission-control-overlay">` block.
  - **CSS**: Deleted over 150 lines of unused styles for features like Python Scripting Sidebar, Scroll Box Context Menu, Engine Toggle, old Totems, and old Sticky Notes.
  - **JS Debris**: Removed unused functions: `updateColorIndicators()`, `getUniqueGlobalBookNames()`, and `setDashboardEditTool()`.
  - **JS Refactor**: Extracted the massive 1,200+ line `setupWorkspaceListeners()` function by breaking its pointer and wheel listener lambdas out into standalone helper functions (`handleWorkspacePointerDown`, `handleWorkspacePointerMove`, `handleWorkspacePointerUp`, `handleWorkspaceWheel`, `handleWorkspaceContextMenu`, `handleWorkspaceDoubleClick`) for dramatically improved readability.

### 2026-07-15 — Resize Handles CSS Alignment Fix
- **What**: Fixed a bug where area resize handles were visually misaligned from their mathematical corner positions.
- **Why**: User reported that when resizing an area or scroll box, the resize handles box appeared misaligned. Browser `box-sizing: border-box` calculations caused the absolute positioning to be offset from the true corner.
- **Files Modified**: `script.js`
- **Lines Changed**: Replaced manual coordinate adjustment with CSS `transform: translate(-50%, -50%)`.
- **Status**: DONE
- **Fix Details**: Applied `translate(-50%, -50%)` to `hEl` to ensure the handles center perfectly on their calculated screen coordinates regardless of border width.

### 2026-07-15 — Pen Tool Color Ribbon
- **What**: Added a new sub-ribbon for the pen tool that allows color selection from the preset palette.
- **Why**: User requested a sub-ribbon to appear under the main ribbon when the pen tool is used, showing the colors in a single row.
- **Files Modified**: `index.html`, `script.js`
- **Lines Changed**: Added `#pen-ribbon-panel` in `index.html`. Added visibility toggle in `script.js:setMode()`.
- **Status**: DONE
- **Fix Details**: Created a dedicated ribbon panel populated dynamically with `PRESET_COLORS` using flexbox for a single-row layout.

### 2026-07-15 — Scroll Box Controls CSS Fix & Refinement
- **What**: Fixed a major layout bug where the scroll box pagination controls (prev, next, page label, add page) were rendering on top of each other, and refined the design to be thinner.
- **Why**: Legacy absolute positioning CSS from an older design iteration was conflicting with the new flexbox pill layout. The user also requested a slimmer profile for the pill.
- **Files Modified**: `style.css`, `index.html`
- **Lines Changed**: Deleted large duplicated/legacy CSS blocks (lines 2357-2460 and 2570-2655 in style.css). Reduced `.scroll-box-controls` padding and button sizes.
- **Status**: DONE
- **Fix Details**: Removed the conflicting `position: absolute` rules that broke the `.scroll-box-controls` flex layout. Shrunk the pill padding and control buttons from 24px to 20px for a more elegant look. Bumped cache busters in `index.html`.

### 2026-07-15 — Folder & Calendar Bug Fixes
- **What**: Fixed the Edge Sidebar CSS for folders, implemented dynamic folder text color based on background luminance, refined calendar styling, and debugged/fixed the calendar 3-dots context menu.
- **Why**: User reported double-clicking folders did nothing, calendar styling needed polish, and the 3-dots menu was unresponsive.
- **Files Modified**: `script.js`, `style.css`, `index.html`
- **Lines Changed**: Reintroduced `#edge-sidebar` CSS rules; updated `drawAreas()` for dynamic text color; updated `.calendar-container` CSS; updated `renderCalendarHTML()` event handlers and `showCalendarContextMenu()` positioning.
- **Status**: DONE
- **Fix Details**: The calendar context menu was failing to appear because it was missing `position: absolute` and a high `z-index` in its styling. Handlers were migrated to standard `onclick`/`oncontextmenu` with `stopPropagation` to prevent workspace drag capture. Cache busters were added to index.html to force browser reloads.

### 2026-07-15 — Smooth Pen High-Performance Rebuild
- **What**: Reimplemented the Pen tool using a dual-canvas overlay architecture for zero-latency rendering.
- **Why**: User requested "Apple Pencil" level smoothness, accuracy, and low latency for the pen tool.
- **Files Modified**: `index.html`, `style.css`, `script.js`
- **Lines Changed**: Added `<canvas id="ink-canvas">`, added `SmoothPen` class, updated pointer event handlers.
- **Status**: DONE
- **Fix Details**: Handled DPI scaling and origin centering for the overlay canvas. Added fallback for dropped `getCoalescedEvents` to prevent dashing. Refactored the render loop to `drawOverlay()` to safely redraw Bezier splines and prevent tearing under `{ desynchronized: true }`.

### 2026-07-15 — Pen Tool Completely Removed
- **What**: Removed the Pen / Area Draw tool from the UI, keyboard shortcuts, and interaction logic.
- **Why**: User explicitly requested the removal of the pen tool (before asking to rebuild it).
- **Files Modified**: `index.html`, `script.js`
- **Lines Changed**: Removed `btn-draw` from HTML, stripped `state.mode === 'draw'` logic from script.js pointer events and render loop.
- **Status**: DONE (Later restored and rebuilt as Smooth Pen)

### 2026-07-14 — Restored Mission Control Feature
- **What**: Rebuilt the Mission Control overlay from scratch and mapped it to `Shift+D`. Features a glassmorphic grid displaying all active totems with thumbnail screenshots of their areas. Clicking a totem card teleports the camera to its physical location.
- **Why**: Feature was deleted by a previous agent without permission.
- **Files Modified**: `index.html`, `style.css`, `script.js`
- **Status**: DONE

### 2026-07-14 — Fixed Missing UI, Hit-testing, Calendar & Totem Indicators
- **What**: Fixed CSS regressions from recent updates. Restored `#workspace` dimensions, fixed totem transforms, removed duplicate calendar CSS, and added missing CSS variables.
- **Why**: The UI was completely broken, main ribbon was missing, hit-testing was offset, calendar looked corrupted, and totems were misaligned.
- **Files Modified**: `style.css`
- **Lines Changed**: `style.css:L1-30, L1205-L1212, L1287-L1293`
- **Status**: DONE

### 2026-07-14 — Port Migration to 9075
- **What**: Started local server on port 9075.
- **Why**: User requested to host the project on port 9075.
- **Files Modified**: None (runtime configuration).
- **Status**: DONE

### 2026-07-14 — Fixed Canvas 0x0 Crash & Busted Cache
- **What**: Increment version tags in `index.html` (`script.js?v=140`, `style.css?v=15`) to bust browser cache. Restarted local python server on port 5075.
- **Why**: The user's browser was caching an older version of `script.js` lacking safety checks, which led to an `InvalidStateError` when `drawImage` was called on a 0x0 canvas during load/resize.
- **Files Modified**: `index.html`
- **Status**: DONE

### 2026-07-14 — Project Progress File Created
- **What**: Created `project_progress.md` as a persistent project memory file.
- **Why**: User requested it to combat conversation truncation causing agents to lose context.
- **Files Modified**: `project_progress.md` (NEW)
- **Status**: DONE

### 2026-07-04 — Scroll Box Subagent Created
- **What**: A specific subagent (`scroll_box_implementer`) was created to implement the Scroll Box feature.
- **Why**: Modularize complex feature development.
- **Files Modified**: `.agents/agents/scroll_box_implementer/agent.json`, `script.js`, `style.css`, `index.html`
- **Status**: DONE

### Pre-2026-07-14 — Mission Control Deleted (BY PREVIOUS AGENT — UNAUTHORIZED)
- **What**: The entire Mission Control feature was deleted from `script.js`. Only a comment `// ===== MISSION CONTROL REMOVED =====` was left at line 9182. The `Shift + D` keyboard shortcut was also removed from the keydown handler.
- **Why**: Unknown. Previous agent removed it without user approval.
- **Files Modified**: `script.js`
- **Status**: NEEDS REVERSAL — Feature must be restored.

### Pre-2026-07-14 — Port Migration
- **What**: Development server migrated from port 5000 to 9075 to 5075.
- **Why**: User preference / conflict resolution.
- **Files Modified**: None (runtime configuration).
- **Status**: DONE

### Pre-2026-07-14 — Service Worker Disabled
- **What**: Added code in `index.html` (lines 564-571) to unregister all service workers on page load to prevent cache-related issues.
- **Why**: Service worker caching was causing stale code to be served.
- **Files Modified**: `index.html`
- **Status**: DONE

---

## 🏗️ ARCHITECTURE NOTES

### State Management
- Single global `state` object (script.js:L1-57) holds all application state.
- Key state properties: `mode`, `camera`, `areas[]`, `drawings[]`, `files[]`, `totems[]`, `tables[]`, `links[]`, `calendarSync`.
- State is serialized to JSON and saved to the filesystem via `saveCurrentFabric()`.

### Rendering Pipeline
- `render()` function (script.js:L5051) is the main render loop, called via `requestAnimationFrame`.
- Canvas renders: background, grid, areas (polygons), drawings (lines/shapes), links (curves), totems.
- DOM renders: files layer, notepad widgets, calendar containers, scroll box containers, table containers, totem indicators.
- Sync functions update DOM elements: `syncFilesVisibility()`, `syncNotesDOM()`, `syncCalendars()`, `syncScrollBoxes()`, `syncTables()`, `syncTotemIndicators()`.
- **[UPDATED on 2026-07-21]**: `render()` is never called directly anymore from event handlers — call `scheduleRender()` instead, which coalesces any number of same-frame requests into a single `render()` call via one `requestAnimationFrame`. `render()` itself now begins with `updateViewBounds()`, computing the visible world-space rectangle (`viewBounds`) that every canvas draw loop and DOM sync function tests items against (`isItemOnScreen()`/`isBBoxOnScreen()`) to skip off-screen items entirely. See the 2026-07-21 Changelog entries ("Viewport Culling", "Render Coalescing + De-quadratic DOM Orphan Cleanup", "In-Place Table Updates + AABB Early-Reject") for full detail and exact function locations.

### Coordinate System
- World coordinates: infinite canvas space.
- Screen coordinates: browser viewport space.
- Transform: `screenX = worldX * zoom + camera.x`, `screenY = worldY * zoom + camera.y`.
- DOM elements positioned in world coordinates, transformed by parent container.

### File System Structure (per workspace)
```
<workspace-root>/
  <fabric-name>/
    fabric.json          — Serialized state
    sources/             — Imported file copies
      file1.pdf
      file2.png
      ...
```

### Keyboard Shortcut Handler
- Located at script.js:L911-L947.
- `Shift + <key>` shortcuts handled first (before modifier guard at L931).
- Single-key shortcuts (V, H, P, T, etc.) handled after modifier guard.
- To add a new `Shift + X` shortcut, add it between L924-L928 (before the modifier guard return).

---

## 🔖 VERSION TAGS

- `style.css?v=1019` — CSS version tag in index.html (historical, 2026-07 early session)
- `script.js?v=1019` — JS version tag in index.html (historical, 2026-07 early session)
- **[UPDATED on 2026-07-21]**: Current tags are `script.js?v=1055` and `style.css?v=1029` (`sw.js` CACHE_NAME `file-fabric-v1055`, precache list kept in sync with both). Remember these are two INDEPENDENT counters — bumping one does not bump the other, and `sw.js`'s precache list must be updated to match both or the service worker's cache-first-on-network-failure fallback can silently serve stale JS or CSS after a fix.

---

## Recent Fixes
- **2026-07-15**: Fixed a bug where double-clicking a deployed folder did nothing. The issue was traced to the `#edge-sidebar` element completely missing its CSS definitions in `style.css`. The CSS classes were restored, allowing the sidebar to slide in and display the folder contents as intended.
- **2026-07-15**: Improved folder icon readability by changing the text color to black when the folder's background color is white (or any light color).
- **2026-07-15**: Decreased calendar bezel padding, styled the calendar header more elegantly, and fixed the calendar 3-dot navigation/options buttons not working due to event propagation issues.
- **2026-07-15**: Migrated calendar buttons to use a robust click pattern (stop propagation on `pointerdown`, execute on `click`) to ensure compatibility across all devices and prevent context menus from immediately dismissing themselves.
- **2026-07-15**: Fixed the calendar context menu rendering issue where it was statically placed; it is now absolutely positioned over the calendar with proper z-index and event handling.
- **2026-07-15**: Fixed invisible code preview modal for `.ipynb` and `.py` files by forcing modal opacity to 1. Added `marked.js` to parse Jupyter Notebook markdown and added `.notebook-markdown` CSS to restore heading sizes and weights.
- **2026-07-15**: Fixed an annoying UX bug where right-click panning triggered context menus. Distance threshold tracking now reliably distinguishes between a pan and a click, squelching the context menu appropriately.
- **2026-07-15**: Removed `transform` from `.file-item` CSS transitions, eliminating a rubber-banding visual lag effect that occurred when files were contained within a moving area or a scrolled scrollbox.

*Last updated: 2026-07-15*

### 2026-07-16 - Text Tool Right-Click Resize Option
- **What**: Added a 'Resize Text Box' option to the text context menu that prompts the user for an explicit pixel width.
- **Why**: The user reported that clicking and dragging the resize handles was still finicky/buggy. A manual numeric input provides a robust alternative.
- **Files Modified**: script.js, index.html
- **Status**: DONE

### 2026-07-16 — Text Tool DOM Migration & Rich-Text Formatting
- **What**: Rebuilt the Text Engine from a canvas-based `fillText` renderer to a fully DOM-based system with `contenteditable` capabilities.
- **Why**: User wanted to be able to drag, highlight, and format specific words or sentences within a single text box using the properties ribbon (e.g., bolding one word while keeping the rest normal).
- **Files Modified**: `script.js`, `index.html`
- **Lines Changed**: `script.js` (Text Rendering and `openTextEditor`), `index.html` (bump cache buster to `v=1043`)
- **Status**: DONE
- **Fix Details**:
  - Replaced `<textarea>` with `<div contenteditable="true">` for the inline editor.
  - Stopped rendering `type === 'text'` in `drawDrawings()` and instead synced them to DOM nodes inside `#files-layer` via a new `syncTextsDOM()` function.
  - Bound property ribbon buttons (Bold, Italic, Text Color, Highlight Color, Font Size) to use `document.execCommand` when the inline editor has focus, intercepting the `pointerdown` event with `e.preventDefault()` to prevent focus loss.
  - Older markdown (`# Heading`) text is parsed and converted seamlessly to `<br>` separated HTML text.

### 2026-07-17 — PWA Standalone Capabilities Restored (Network-First Cache)
- **What**: Rebuilt the Progressive Web App (PWA) Service Worker to use a proper Network-First caching strategy, allowing the app to be installed and used 100% offline.
- **Why**: The user wanted the app ready for "standalone use". The previous Service Worker had been lobotomized (set to self-destruct) by an earlier agent to circumvent developer cache-busting issues, completely breaking offline functionality.
- **Files Modified**: `sw.js`, `index.html`
- **Status**: DONE
- **Fix Details**:
  - Rewrote `sw.js` to implement a dynamic `fetch` event listener that requests the network first, caches the fresh result, and falls back to the cache if the network fails.
  - Removed the `registration.unregister()` loop in `index.html` and replaced it with a standard `navigator.serviceWorker.register()` call.
  - Core app assets (`index.html`, `script.js`, `style.css`, fonts, and CDNs) are now properly stored in `file-fabric-cache-v1044`.
  - Fixed a bug where pressing Spacebar in the Rich-Text editor would trigger pan mode by adding an `isContentEditable` check to the keyboard shortcut bypass logic.
  - Changed the font size control from a range slider to a numeric input box for precise font sizing.
  - Fixed a UI bug where the font size label (e.g., "24px") did not update when changing font size while editing text.

### 2026-07-17 — Font Size UI & Standalone Script Tag Fixes
- **What**: Fixed the font size input box clearing text selection, and fixed the "Open Target Workspace" button failing to work in the PWA.
- **Why**: The user reported that clicking the font size box removed their text selection, and later reported that the main app button did not work when opened as a standalone PWA.
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Status**: DONE
- **Fix Details**:
  - **Font Sizing**: Replaced the glitchy `execCommand('backColor')` fake highlight system completely. Changed the font size input listener from `input` to `change`. When the user enters a number, it applies `<font size="7">`, overwrites the size, and calls `editor.focus()` to instantly restore the browser's native text selection highlight.
  - **Standalone / PWA Bug**: Discovered a rogue `<script>` tag accidentally injected into the `<head>` of `index.html` during a version bump. This caused `script.js` to run before the DOM loaded, resulting in `null` element errors that broke all buttons. Removed the duplicate tag so the script only loads at the end of the `<body>`.
  - **Service Worker**: Upgraded `sw.js` to use `caches.match(event.request, { ignoreSearch: true })`. This guarantees that cache hits succeed even if `index.html` requests a different query string (like `?v=1046`), permanently preventing offline loading failures due to version mismatches.

### 2026-07-17 � Native Context Menu & Syntax Error Fixes
- **What**: Re-enabled native browser context menus for all text inputs (text boxes and tables) and fixed a critical JavaScript syntax error.
- **Why**: The user reported that right-clicking to copy/paste text inside a text box was mistakenly blocked by the custom Table/Text context menus. After attempting a fix, a duplicate variable declaration broke the standalone app.
- **Files Modified**: script.js
- **Status**: DONE
- **Fix Details**:
  - Updated handleWorkspaceContextMenu to allow contenteditable elements to surface the browser's native context menu instead of capturing the right-click.
  - Updated the Table Context Menu listener to similarly ignore right-clicks originating inside a table cell's contenteditable area.
  - Resolved an Uncaught SyntaxError (duplicate hitCell declaration) that was preventing script.js from parsing and causing the Open Workspace button to fail silently.

### 2026-07-17 � Text Formatting Sync Fix
- **What**: Fixed discrepancies in text wrapping and alignment between the inline edit mode and the baked DOM text.
- **Why**: The user reported that text formatting was shifting, and the boundary was clipping the text.
- **Files Modified**: script.js
- **Status**: DONE
- **Fix Details**:
  - Reverted white-space back to pre-wrap in syncTextsDOM to perfectly match the contenteditable container's spacing behavior.
  - Explicitly synchronized ontWeight, ontStyle, and ontFamily from the existing text object into the temporary contenteditable editor so that line breaks reflect the true font metrics.

### 2026-07-17 - Text Box Hit-Test / Ghost Drag Area Fix
- **What**: Fixed a hit-testing bug where a text box's clickable/draggable region no longer matched its real rendered size, letting the user click-drag from empty space near a text box.
- **Why**: The user reported that after changing the text tool to wrap into a defined width (growing vertically as more text is added, instead of the old single-line horizontal growth), the box could still be dragged by clicking on a "hallucinated" area that didn't visually contain text.
- **Root Cause**: `getDraggableDrawingAt()` (script.js:685) and the eraser-tool's duplicate hit-test (script.js:~1731) each independently recomputed the text box's width/height from `d.text.split('
')` - logic written for the old plain-text canvas renderer. Since the 2026-07-16 migration to `contenteditable` + rich-text (about_code.md L432), `d.text` stores HTML (`<div>`, `<br>`, etc.), so `split('
')` collapses wrapped paragraphs into one "line" and never simulates the `d.width`-based word-wrap that the real DOM box uses. This produced a hit-test rectangle completely decoupled from the actual rendered `.text-item` DOM box - the box everyone sees on screen. Note that `drawDrawings()` (script.js:6570) already solved this correctly by reading the live DOM element's `offsetWidth`/`offsetHeight` for the selection-outline/resize-handles, so only the hit-test paths were stale.
- **Files Modified**: script.js
- **Lines Changed**: ~685-724 (`getDraggableDrawingAt`), ~1731-1754 (eraser-mode text hit-test)
- **Status**: DONE
- **Fix Details**:
  - Both functions now read `document.getElementById(d.id).offsetWidth/offsetHeight` (the real synced `.text-item` DOM box) as the primary source of truth for hit-testing, matching what `drawDrawings()` already does for the visible selection outline.
  - The old `split('\n')` + `ctx.measureText()` estimate is kept only as a fallback for the first frame before `syncTextsDOM()` has created the DOM element yet.

### 2026-07-17 - Text Ribbon Selection Sync + Per-Selection Font Family
- **What**: Fixed the text properties ribbon (font size, font family, bold/italic) always showing the whole text box's stored values instead of the actual formatting at the current cursor/selection. Also added the ability to set a different font family on a specific text selection (previously font family could only be set for the entire box; font size already supported per-selection via execCommand).
- **Why**: The user reported the ribbon showed "24px" even when the highlighted selection was actually 17px, since a run of custom-sized text had been set earlier. They also wanted two sentences in the same text box to be able to use different font families, matching how font size already worked per-selection.
- **Root Cause**: `showPropertiesPanel()` (script.js:387) only ever reads `textDrawing.fontSize`/`fontFamily` (the whole-box stored values) and is called once when a text box is selected/opened - it never re-runs as the user's cursor/selection moves within the editor, so any per-span custom size or family from a previous edit was invisible to the ribbon.
- **Files Modified**: script.js
- **Lines Changed**: ~458-501 (new `matchFontFamilyOption()` / `syncPropertiesPanelToSelection()` + `selectionchange` listener), ~542-569 (`propFontFamily` change handler)
- **Status**: DONE
- **Fix Details**:
  - Added `syncPropertiesPanelToSelection()`, wired to `document.addEventListener('selectionchange', ...)` while an `.inline-text-input` is active. It reads `getComputedStyle()` on the element at the selection's `startContainer` (de-scaled by `state.camera.zoom` for font-size, since the live editor is screen-space and gets scaled back down to world-space units - same convention used elsewhere for text sizing) and updates the font-size input, font-family select, and bold/italic button active-states to match.
  - `propFontFamily`'s change handler now mirrors the existing `propFontSize` per-selection pattern: when an inline editor is active, it restores the saved selection range and applies `document.execCommand('fontName', false, family)` (with `styleWithCSS` true) so only the selected run gets the new font, instead of always overwriting the whole box's `fontFamily`.

### 2026-07-17 - Text Box Drag-to-Resize UX Overhaul
- **What**: Replaced the impractical resize interaction with a proper click-and-drag boundary resize.
- **Why**: The user reported the only reliable way to resize a text box was the right-click "Resize Text Box" menu item, which opens a native browser `prompt()` dialog asking for a pixel width - a poor, non-visual UX. The drag-handle system already existed in code (small squares at the mid-height of the left/right edges) but the grab target was only a ~12px-radius circle at the exact midpoint, with zero hover feedback, so in practice it was very easy to miss and felt broken.
- **Files Modified**: script.js
- **Lines Changed**: ~1647-1697 (`handleWorkspacePointerDown` resize hit-test), ~2618-2628 (`handleWorkspacePointerMove` idle-hover cursor), ~2685-2689 (`handleWorkspacePointerUp` resize finalize), ~6747-6765 (`drawDrawings` handle/edge rendering)
- **Status**: DONE
- **Fix Details**:
  - `drawDrawings()` now stores `drawing._resizeBox = {x, y, w, h}` (the selected text box's on-screen bounding rect) alongside the existing `_handles`, and draws a semi-transparent highlighted bar along the full left/right edge so the draggable region is visually obvious, not just two tiny 8px dots.
  - `handleWorkspacePointerDown()` now checks proximity to the *entire* left/right edge (using `_resizeBox`, with a 10px-screen tolerance) in addition to the original midpoint-dot hit-test, so clicking and dragging anywhere along the boundary line resizes the box.
  - Added a hover branch in `handleWorkspacePointerMove()` that sets `cursor: ew-resize` when idling near a selected text box's edge, giving a discoverability hint before the user clicks.
  - Fixed a separate bug found in the process: the resize `pointerup` handler never called `saveCurrentFabric()`, so a resized text box's new width wasn't guaranteed to persist to disk.
  - The right-click "Resize Text Box" prompt was left in place as a secondary option for exact numeric input; drag is now the primary, discoverable path.

### 2026-07-17 - Rendering Performance: Per-Area Backdrop Blur Optimization
- **What**: Cut the dominant per-frame GPU cost in the render loop - the frosted-glass backdrop blur that `drawAreas()` applies to every area.
- **Why**: The user reported the app running at ~40 FPS during interaction and asked for graphics/fx optimization.
- **Root Cause**: For every non-folder area, every frame, `drawAreas()` (script.js ~7484) ran `ctx.filter='blur(8px)'` over a `drawImage()` of the ENTIRE canvas. A canvas blur processes every pixel of the image it's handed, so with N areas this was N full-screen gaussian blurs per frame (on a HiDPI display, each ~4M pixels). That is the primary reason for the low frame rate during pan/drag/draw (render is on-demand, not a constant loop, so cost concentrates in interaction frames). Secondary issue: the `bgCanvas` snapshot context was created with `willReadFrequently: true` even though it is only ever a `drawImage` source/target (never `getImageData`) - that flag forces a slow CPU-backed canvas and disables GPU acceleration for the per-area snapshot copy.
- **Files Modified**: script.js
- **Lines Changed**: ~67-70 (`bgCtx` context flag), ~7484-7512 (`drawAreas` blur block)
- **Status**: DONE
- **Fix Details**:
  - The backdrop blur now only processes the area's on-screen bounding box (converted world->screen->device px via `worldToScreen` x dpr, expanded by a 24px margin for blur bleed) instead of the whole canvas. Because the area clip is stored in device space and still masks the output, drawing a superset rectangle is pixel-identical to the old full-screen draw - only the pixel count the blur touches shrinks (proportional to how small the area is relative to the viewport).
  - The `'efficient'` graphics preset now skips the backdrop blur entirely (areas render with just their solid translucent fill), giving users a one-click large speedup for scenes with many/large areas.
  - Removed `willReadFrequently: true` from the `bgCtx` creation so the snapshot copy can be GPU-accelerated.
- **Left As-Is (intentionally, lower priority / higher risk)**: the per-area full-canvas snapshot `bgCtx.drawImage(canvas,0,0)` still runs per area (kept because totem thumbnails reuse `bgCanvas`); `syncTextsDOM()` re-queries `.text-item` each frame; light-mode area drop-shadow uses `ctx.shadowBlur`.

### 2026-07-17 - Link Line Occlusion Rules (Nested Areas)
- **What**: Fixed how connector lines between areas render relative to OTHER areas they pass near/through, to properly reflect nesting.
- **Why**: The user reported that when a link's endpoint area (e.g. "fgh") is nested inside a parent area (e.g. "ert"), the connecting line rendered brightly ON TOP of the parent instead of looking like it emerges from behind it. They specified two rules: (1) if both linked areas share a common parent, the connecting line should be clearly visible ("seen connecting"); (2) if an area sits in front of/around part of the linkage, that area should always occlude it, with the line reading as if it's behind that area.
- **Root Cause**: `drawLinks()` (script.js ~7685) already had a bbox-overlap-based system that clips the sharp line out of any non-endpoint area it crosses and shows a softer blurred/dimmed version inside that area instead (a "tunnel behind frosted glass" effect) - but it treated every non-endpoint area identically. It never checked whether that area was a *shared container* of both endpoints (should not occlude at all) vs. the *direct parent of just one* endpoint (should occlude fully, not just blur), so a parent area containing one endpoint got only the same soft dim/blur treatment as an unrelated area the curve incidentally passed near - visually too weak to read as "behind," especially when the link's color contrasted with the parent's fill.
- **Files Modified**: script.js
- **Lines Changed**: ~7685-7815 (`drawLinks()` occlusion classification)
- **Status**: DONE
- **Fix Details**:
  - For every non-endpoint area whose bbox overlaps the link's bezier curve, the code now tests actual point-in-polygon containment (via `isPointInPolygon`) of the link's `from`/`to` endpoint positions, not just bbox overlap, and classifies into three cases:
    1. **Contains both endpoints** (shared ancestor/container) - excluded from occlusion entirely; the line renders at full brightness, satisfying "areas inside the same area should be seen connecting."
    2. **Contains exactly one endpoint** (that endpoint's own parent/container) - added to a new `hiddenAreas` list; the sharp line is clipped out inside it as before, but it is now EXCLUDED from the secondary blurred/dimmed "tunnel" pass, so it renders fully invisible there instead of just dim - satisfying "an area on top of the linkage should always be on top, line goes from behind the area."
    3. **Contains neither endpoint** (incidental crossing, unrelated area) - unchanged existing behavior: clipped from the sharp line, shown via the softer blurred/dimmed tunnel pass.

### 2026-07-18 - Link Line Occlusion: Nested-Area Clip Bug (evenodd counting)
- **What**: Fixed a follow-up to the 2026-07-17 link occlusion fix - a link line correctly hidden behind a parent area (e.g. "ert") was reappearing brightly whenever a CHILD area nested inside that parent (e.g. "asd", sitting inside "ert" but not itself a link endpoint) was also crossed by the same link's curve.
- **Why**: The user reported and correctly diagnosed the exact mechanism: "if a linkage line is going from behind of an area, and an area is placed on that area then the linkage line is shown on the inner area... it counts boundary and not the actual figures present."
- **Root Cause**: `drawLinks()`'s sharp-line clip (script.js ~7741) built ONE combined path - the huge outer rect, then EVERY occluding area's polygon appended as a subsequent subpath - and clipped it all at once with `ctx.clip('evenodd')`. The evenodd fill rule determines inside/outside by *counting* how many subpaths a point's boundary-crossing ray passes through. When occluder B (e.g. "asd") is geometrically nested inside occluder A (e.g. "ert"), a point inside B is crossed by: the outer rect (1) + A's boundary (1) + B's boundary (1) = 3 crossings = odd = "inside" the clip region again, which undoes A's exclusion right where B sits. This is exactly what the screenshot showed: the line vanished correctly inside "ert" but reappeared inside the nested "asd."
- **Files Modified**: script.js
- **Lines Changed**: ~7741-7767 (`drawLinks()` sharp-line clip)
- **Status**: DONE
- **Fix Details**: Replaced the single combined evenodd path with N separate `ctx.clip('evenodd')` calls, one per occluder, each built from a fresh (outer-rect minus this one occluder) path. Canvas `clip()` calls intersect with the current clip region rather than replace it, so chaining them performs true set intersection - "not A" AND "not B" - which is correct regardless of whether the occluders are nested or overlapping, since each clip only ever subtracts one shape at a time instead of counting crossings across a combined multi-hole path. The per-`tunnelAreas`-item blurred pass was not affected by this bug (it already clipped one shape at a time per loop iteration).

### 2026-07-18 - Efficient Graphics Preset: Opaque Areas
- **What**: In the 'efficient' graphics preset, areas now render fully opaque instead of translucent, and `drawGrid()` skips drawing (and computing totem color-influence for) any dot that falls under an area.
- **Why**: The user reported that in efficient mode, areas were still translucent, letting the grid dots show through underneath - which both looked washed-out and meant those dots still had to be rendered (and, where a totem's magnetic field reached them, run through the per-field distance/influence color math) only to be immediately covered by the area's fill.
- **Files Modified**: script.js
- **Lines Changed**: ~7530-7539 (`drawAreas()` FILL alpha), ~6184-6199 and ~6259-6264 (`drawGrid()` opaque-area dot skip)
- **Status**: DONE
- **Fix Details**:
  - `drawAreas()`'s fill alpha is now `1` (fully opaque) when `state.graphicsPreset === 'efficient'`, instead of the normal 0.25-0.55 translucent range.
  - `drawGrid()` now precomputes each visible non-folder area's bbox once per frame (only in efficient mode) and skips any dot whose position falls inside one of those bboxes - both in the plain base-dot loop (already gated off entirely in efficient mode from an earlier pass) and, newly, in the totem magnetic-influence dot loop, which previously ran its per-field `Math.hypot`/`Math.pow` color-blend computation for every dot regardless of whether an opaque area was about to cover it.
  - Uses each area's AABB (not exact polygon shape) for the skip test - a deliberate, cheap approximation consistent with 'efficient' mode's existing performance/precision tradeoffs; a few dots right at a non-rectangular area's bbox corners (outside the actual polygon but inside its bbox) may be skipped even though not strictly covered, which is visually unnoticeable.

### 2026-07-18 - Efficient Mode Area Color Too Bright (opaque-blend fix)
- **What**: Fixed areas looking much brighter/more saturated in efficient mode than the same area in performance mode.
- **Why**: The user compared screenshots of the same area in both modes - efficient mode showed a vivid, fully-saturated yellow/orange, while performance mode showed a muted olive/brown tone for what should be the same area color.
- **Root Cause**: The 2026-07-18 "efficient mode opaque areas" change (see prior entry) set the fill to `hexToRgba(adjustedColor, 1)` - the RAW area color at full opacity. In normal/performance mode, the same color is rendered translucent (alpha ~0.25-0.55) over the dark fabric background, which visually mutes/darkens it via alpha blending. Painting the same raw color at alpha=1 skips that blending entirely, so the color reads far brighter and more saturated than intended - a real visual regression from the previous fix, not the originally reported issue.
- **Files Modified**: script.js
- **Lines Changed**: ~7058-7075 (new `blendHexColors()` helper, added next to `hexToRgba()`), ~7546-7563 (`drawAreas()` FILL section)
- **Status**: DONE
- **Fix Details**:
  - Added `blendHexColors(bgHex, fgHex, ratio)`, which pre-blends `fgHex` toward `bgHex` by `(1 - ratio)` and returns a flat opaque `rgb()` string - i.e. it computes what the translucent fill would have LOOKED like, as a single solid color, without doing real alpha compositing.
  - `drawAreas()`'s FILL section now computes the same `blendRatio` (renamed from `alpha`) that normal mode would have used as its alpha (0.25/0.35 selected, or 0.45/0.55 on light backgrounds), and in efficient mode blends it against `state.fabricColor` via `blendHexColors()` instead of applying it as real alpha. Normal/performance mode is unchanged (still uses `hexToRgba()` with real alpha). The area remains fully opaque in efficient mode (dots still correctly skipped underneath per the prior fix), but now visually matches the muted tone from performance mode instead of showing the raw saturated color.

### 2026-07-18 - CRITICAL: state.fabricColor Undefined After Loading Any Fabric
- **What**: Fixed a pre-existing property-name mismatch bug: `state.fabricColor` was `undefined` on every loaded (non-freshly-created) fabric, silently breaking any logic that depended on it being a real hex color string.
- **Why**: While investigating why the efficient-mode area color fix (previous changelog entry, same date) had no visible effect, the user ran `state.fabricColor` in the console and got `undefined`. Root-caused to `prepareFabricState()` (script.js ~8267), which completely REBUILDS the `state` object from the loaded fabric.json and only ever set `state.bgColor` - never `state.fabricColor` - even though `fabricColor` is the field name used by the default state object (script.js:9) and by every other read/write site in the app (`drawAreas`, `drawGrid`, `render`, the fabric-color picker swatch handler, and the newly-added `blendHexColors` call). Since `prepareFabricState()` runs on every fabric load (i.e. almost immediately in normal use, once you open any fabric from the home screen), `state.fabricColor` was `undefined` in essentially every real session - only a fresh, never-loaded `state` object had the correct default.
- **Why it went unnoticed for so long**: the symptom was almost entirely self-masking. `ctx.fillStyle = state.fabricColor` with `undefined` is a no-op in Canvas (invalid value silently ignored, canvas keeps its built-in default black fillStyle) - which happens to look correct for this app's default dark theme. `isColorLight(undefined)` returns `false` (its own `!color` guard) - "not light" also happens to be the right answer for a dark theme. The bug only became visible once `blendHexColors()` (added in the prior entry) applied a STRICT validity check on its background-color argument and refused to blend against a non-hex value, exposing the raw unblended color instead.
- **Files Modified**: script.js
- **Lines Changed**: ~8267-8305 (`prepareFabricState`), ~8302 (`document.body.style.backgroundColor`), ~8434 (`saveCurrentFabric` thumbnail generation), ~9033 (`syncNotesDOM` text color)
- **Status**: DONE
- **Fix Details**: Unified everything onto `fabricColor` as the single canonical field (matching its usage everywhere else) instead of the parallel, inconsistently-used `bgColor`:
  - `prepareFabricState()` now sets `fabricColor: d.fabricColor || d.bgColor || bgColor` (reading either legacy JSON key, for backward compatibility with already-saved fabrics) instead of `bgColor: d.bgColor || d.fabricColor || bgColor`.
  - The 3 remaining `state.bgColor` reads (`document.body.style.backgroundColor`, the fabric thumbnail generator's `tCtx.fillStyle`, and a note text-color lightness check in `syncNotesDOM`) were all switched to `state.fabricColor`.
  - `saveCurrentFabric()` (`JSON.stringify(state, ...)`) needed no change - it will now naturally persist `fabricColor` going forward since the property actually exists on `state` again.
- **Known Related Gap (not fixed, flagged for the user)**: `prepareFabricState()`'s rebuilt `state` object is also missing several OTHER fields present in the default state object - `graphicsPreset`, `gridSize`, `snapToGrid`, `selectMode`, `lassoPolygon`, `lassoSelection`, `isConstellationMode`, `preConstellationZoom`, `editingDashboardId`. These don't silently corrupt rendering the way `fabricColor` did (comparisons like `state.graphicsPreset === 'efficient'` just resolve to `false`/default behavior when undefined), but it does mean settings like the graphics preset choice reset to defaults every time a fabric is reopened, rather than persisting. Left alone since it's outside the scope of the reported bug; worth a follow-up if the user wants it fixed.

### 2026-07-18 - Widget Sidebar (Shift+S) + Edge Sidebar Redesign
- **What**: Added a new customizable, screen-fixed "Widget Sidebar" (Shift+S) supporting 7 widget types (Calendar, Clock, Notes, Progress Bar, Folder, Text, Rectangle) that the user can add/remove/reorder freely, independent of canvas position/zoom. Also redesigned the existing "Edge Sidebar" (folder viewer) to share the same visual language, and gave both panels an iOS-app-switcher-style stacking behavior plus Escape/click-outside dismissal.
- **Why**: User request - a persistent personal workspace panel separate from the canvas ("like a widget bar"), plus a visual cleanup of the existing folder sidebar. Went through an EnterPlanMode planning pass (3 parallel Explore agents + 1 Plan agent) before implementation given the scope: 3 files touched, a new data model, and real architectural decisions (none of the existing canvas widget systems - calendar/notes/progress-bar/clock - could be reused as-is; see about_code.md for why).
- **Files Modified**: script.js, index.html, style.css
- **Status**: DONE
- **Data Model**: New `state.sidebarWidgets` array (flat, order = visual stack order), each `{id, type, ...type-specific fields}`. Added to `prepareFabricState()`'s field list (script.js ~8339) - `saveCurrentFabric()` needed no changes since it serializes the whole `state` object with no whitelist.
- **Panel-Stack Architecture** (script.js, new module after `closeMissionControl()` ~L5650): `sidePanelStack`/`SIDE_PANELS`/`openSidePanel()`/`closeSidePanel()`/`closeTopSidePanel()`/`applySidePanelStackVisuals()` - when one right-edge panel opens while another is already open, the existing one "recedes" (scales down, dims via `filter: brightness()`) behind the new one instead of closing, reversible when the front one closes. Implemented via a shared `.side-panel`/`.side-panel-open`/`.side-panel-receded` CSS base class using ONLY `transform`/`opacity`/`filter:brightness` (GPU-cheap, compositor-only - explicitly requested by the user, and also replaces the Edge Sidebar's old `right`-based (layout-triggering) slide animation as a side effect). `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` (modeled on Mission Control's existing `_dismissHandler`/`_escHandler` pattern) add Escape-key and click-outside dismissal to both panels.
- **Widget Types** (script.js, new module after `renderEdgeSidebar()`'s section, ~L10600+): a `WIDGET_RENDERERS` registry dispatches `renderXWidget(body, widget)` per type. Clock and Progress Bar are new DOM/CSS implementations from scratch (the canvas versions of these have zero DOM representation - canvas-only via `drawDrawings()`). Notes and Calendar are new, SIMPLER standalone implementations reusing the canvas versions' markdown-lite/CSS-class conventions but NOT their actual functions, since those are tightly coupled to `state.drawings` id-lookups, polygon-bbox geometry, and (for calendar) a single SHARED GLOBAL `state.calendarSync` that would incorrectly synchronize every sidebar calendar instance together - each sidebar calendar widget has its own independent `viewMonth`/`viewYear`/`schedules`.
- **Folder Widget + Extraction**: extracted the Edge Sidebar's ~150-line per-file-row logic (icon/name/meta markup, delete, drag-out-to-canvas, double-click-to-open dispatch) into a new shared `buildFileListItemEl(fileData, {editable, allowDragOut, onDeleteConfirmed})` helper (script.js ~L10326), used by both `renderEdgeSidebar()` and the new `renderFolderWidget()` (which lets the user pick an existing canvas folder area via a `<select>` and shows a live, read+drag-out-only mini file-list). Added `refreshFolderWidgets(folderId)`, called from the two `containedFiles` mutation sites (`assignFileToStorage()` ~L238, and the polygon-extend flow ~L2799) so an open Folder widget stays live-updated, mirroring how `renderEdgeSidebar()` was already invoked imperatively (no pub/sub exists in this codebase).
- **Edge Sidebar Redesign**: adopted the shared `.side-panel`/`.side-panel-header`/`.side-panel-title`/`.side-panel-icon-btn`/`.side-panel-edit-btn`/`.side-panel-content` classes (now visually consistent with the new Widget Sidebar), replaced hardcoded hex/rgba colors with the app's existing CSS custom properties plus one new `--panel-bg-solid` (both panels' background is now `var(--panel-bg-solid)`), moved inline `style=` attributes (the header Edit button in index.html, the delete icon and edit-mode cursor/border toggles in script.js) to CSS classes.
- **Incidental Fixes Made Along the Way**:
  - Deleted the orphaned, selector-less CSS fragment at style.css (previously ~2276-2282, a dangling declaration block with no selector sitting between `.edge-item-delete:hover` and a `/* RESTORED DELETED CONTENT */` comment - confirmed dead debris, its stray extra `}` was the sole cause of a whole-file CSS brace imbalance). Overall style.css brace count is now perfectly balanced (was off-by-one before this fix).
  - `.edge-item-delete` needed real base styling added (color/padding/sizing/flex-centering) since it previously relied entirely on an inline `style=` attribute that was removed during the `buildFileListItemEl()` extraction.
  - Discovered `.hidden` is NOT a global utility class in this codebase - it's defined per-component as a compound selector (e.g. `.modal-overlay.hidden`, `.properties-panel.hidden`). The new `#widget-add-menu` initially used a bare `class="hidden"` with no matching rule (would have rendered visible by default); added `#widget-add-menu.hidden { display: none; }` following the established pattern.
- **Verification Note**: this session's environment cannot reach the user's `file://`-loaded browser session directly (confirmed earlier this session), so this entire feature was built via careful manual brace/CSS-balance verification and full re-reads of every edited region rather than live browser testing. The user should manually verify: Shift+S opens/closes the widget sidebar; Escape and click-outside dismiss both panels; opening one panel while the other is open produces the recede/stack effect; all 7 widget types can be added, edited, reordered, and removed; two calendar widgets navigate independently; the folder widget's file list matches its linked canvas folder and drag-out-to-canvas still works; persistence round-trips correctly after a reload (the `prepareFabricState()` field-omission bug class was already found and fixed once this session for `fabricColor`, so this specific check matters).

### 2026-07-18 - Sidebar Hide-vs-Close Distinction + Header Tab Selector
- **What**: Changed Escape/click-outside on the Edge Sidebar and Widget Sidebar from fully closing the panel to just hiding it (state preserved, still available), and added a tab selector in the header title area that appears whenever both panels are "available" (visible or hidden-but-not-closed), letting the user switch between them without closing either. Only the explicit close (x) button now does a full close.
- **Why**: The user pointed at the Widget Sidebar's header ("Widgets  + Edit x") and asked that when both the Folder and Widget sidebars are open, the title area become a selector to switch between them - and that the Folder option should stay available in that selector until the user explicitly clicks its close button, even if they'd previously dismissed it with Escape.
- **Files Modified**: script.js, index.html, style.css
- **Status**: DONE
- **Design**: Introduced a third panel state alongside the existing frontmost/receded pair: **hidden** (fully off-screen, `hiddenSidePanels` array) - available but not shown, as opposed to **closed** (removed from all tracking, full `onClose` teardown called). `openSidePanel()` pulls a panel out of `hiddenSidePanels` if needed and makes it frontmost (existing behavior, now also panel promoted from hidden works the same way). New `hideSidePanel()` (used by Escape/click-outside and by Shift+S's toggle-off) moves a panel from `sidePanelStack` into `hiddenSidePanels` without calling `onClose` - so `closeEdgeSidebar()`'s teardown (`window.activeEdgeFolderId = null`) only fires on a true close, confirmed via console testing that `activeEdgeFolderId` survives an Escape-hide.
- **Header tab selector**: `updateSidePanelSelectors()` (called at the end of every `applySidePanelStackVisuals()`) checks `sidePanelStack.concat(hiddenSidePanels)` - whenever 2+ panels are available, both panels' header title elements render a small `.side-panel-tab` pair ("Folder" / "Widgets") instead of their normal title text; clicking a tab just calls the existing `openSidePanel(name)`. With only one panel available, titles revert to normal (folder name / "Widgets").
- **Bug fixed along the way**: the previous per-panel `bindSidePanelDismiss()`/`unbindSidePanelDismiss()` design bound a SEPARATE Escape/click-outside listener for each panel and never unbound the receded one's listener when a second panel opened on top - meaning pressing Escape while both panels were stacked would have fired both handlers simultaneously, closing both at once. Replaced with a single, persistent pair of listeners that always act on `sidePanelStack[sidePanelStack.length - 1]` (whatever is actually frontmost right now), eliminating the whole class of bug.
- **Consistency change beyond the literal ask**: also changed Shift+S's toggle-off behavior from `closeSidePanel('widgets')` to `hideSidePanel('widgets')`, so the widget sidebar doesn't disappear from the tab selector via the keyboard shortcut while surviving Escape - avoids an inconsistency where two different "make it go away" actions on the same panel would produce different retained-state outcomes.
- **Verification**: this session had a working local preview server (unlike earlier in the session when only `file://` was available), so this was verified live via the browser console rather than just static code review - confirmed via direct function calls: opening a (simulated) folder + Shift+S correctly recedes the folder behind the widget sidebar and shows the tab selector on both; Escape hides only the frontmost panel and promotes the other to front while preserving `activeEdgeFolderId`; clicking a tab switches focus and receded (not hides) the other; the explicit close button fully removes a panel from the selector and clears its state. No console errors throughout.

### 2026-07-19 — Check GPU Status Feature & Windows Desktop Migration Setup
- **What**: Created a copy of the project in `file-fabric-win`, authored a migration strategy guide (`windows_desktop_migration_strategy.md`), added a "Check GPU Status" diagnostic button to the Settings popup, and hosted the app locally on port 9075.
- **Why**: User asked to duplicate the project directory for Windows desktop development, inquired about challenges/approaches (Electron vs Tauri) and AI model selection (recommending Gemini 1.5 Pro for massive context window), and requested a UI option in settings to verify if rendering uses GPU or CPU hardware acceleration.
- **Files Modified**: `index.html`, `script.js`
- **Lines Changed**: `index.html` (added `#btn-check-gpu` button in `#settings-popup`, bumped `script.js?v=1052`), `script.js` (added WebGL renderer check listener querying `WEBGL_debug_renderer_info` to detect GPU vs software/CPU rendering).
- **Status**: DONE

### 2026-07-21 — Viewport Culling (Render Only What's On Screen)
- **What**: Added frustum/viewport culling so off-screen items are no longer processed each frame. Previously every area, drawing, totem, link, and DOM widget was rendered/rebuilt every frame regardless of camera position — only the grid dots were culled. Now each render loop skips items whose world-space bbox doesn't overlap the visible viewport (plus a 150px screen-margin). This changes render cost from "proportional to total item count" to "proportional to items near the viewport" — the key scalability fix for large fabrics.
- **Why**: User asked for "as much items to be only rendered only when those items actually appear on the screen." Follow-on to the 2026-07-17 blur-optimization work, which reduced per-area cost but still touched every area every frame.
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Status**: DONE
- **New helpers** (added after `bboxDistance()`):
  - `viewBounds` (module-level) + `updateViewBounds(width, height, marginPx=150)` — computes the visible world-space rectangle once per frame; called at the very top of `render()` right after `width`/`height` are known.
    - **[CHANGED on 2026-07-21]**: `marginPx=150` (flat screen-px constant) → `marginRatio=0.125` (proportional, per side). See BUG-0013 below — the margin is now always exactly 12.5% of the CURRENT viewport's width/height per side (25%/1.25x total), not a fixed pixel count. Also, `getRenderBBox()`'s "bare `x`/`y`" fallback described two lines down was never actually correct for text drawings — see the same BUG-0013 entry for the dedicated text branch that replaced it.
  - `getRenderBBox(item)` — robust world bbox for EVERY coordinate convention in the codebase: polygon/points (areas, path drawings), `start`/`end` (line/arrow/rect/circle/book), `colWidths`/`rowHeights` (tables), `x`+`width`/`height` top-left boxes (progress_bar/clock/calendar), CENTER-anchored file/YouTube cards (they use CSS `translate(-50%,-50%)`), and bare `x`/`y` (totems). Returns `null` when unmeasurable → callers treat null as "always draw" (fail-safe, never cull something we can't measure).
  - `isBBoxOnScreen(bbox)` — overlap test vs `viewBounds` (null bounds/bbox → true).
  - `isItemOnScreen(item)` — measures + shifts bbox by `getAnimationOffset()` so items sliding INTO view during a scroll-box page transition aren't wrongly culled.
  - `areaOwnsVisibleLink(area)` — because links are drawn from inside `drawAreas()` by the top-most (highest-index) connected area, an off-screen area is NOT culled if it owns a link whose endpoint-span reaches the viewport (else the link would vanish). Short-circuits instantly when `state.links` is empty.
- **Canvas cull points**: `drawAreas()` (skip off-screen areas, widened to the fixed 120×90 folder shape for folders, kept alive if `areaOwnsVisibleLink`), `drawDrawings()` (skip via `isItemOnScreen`, placed before `ctx.save()` to keep save/restore balanced), `drawTotems()` (point-in-bounds test, DISABLED in constellation mode which must show all totems), `drawLinks()` (skip via the already-computed `linkBBox`).
- **DOM cull points** (all guard against culling an element that holds `document.activeElement`, so an in-progress edit is never disrupted): `syncFilesVisibility()`, `syncTextsDOM()` (also skips its per-frame innerHTML/style rebuild when off-screen), `syncTables()` (**biggest DOM win** — this function does a full `remove()`+rebuild of every table every frame; off-screen tables now skip that entirely), `syncCalendars()`, `syncScrollBoxes()`, `syncNotesDOM()`.
- **Margin rationale**: 150 screen-px (converted to world units via `/zoom`, so it grows when zoomed out). Comfortably covers items straddling the edge and short slide animations; combined with the per-item animation-offset shift, no pop-in at the edges during normal pan/zoom.
  - **[CHANGED on 2026-07-21]**: this flat 150px margin, plus a separate real bug in how text bboxes were measured, turned out to be insufficient — text was observed flickering in/out during panning. See BUG-0013 below: margin is now proportional (1.25x viewport), and `getRenderBBox()` got a dedicated, DOM-accurate branch for text.
- **Verification**: No console errors on load; all new functions confirmed defined in the live page; 13 synthetic unit tests (one+ per coordinate convention, on-screen and off-screen, incl. the "box top above the viewport but body still visible" edge case) all passed against the running code via the browser console. Full end-to-end interaction (panning a loaded fabric with many items) still needs manual user verification since loading a fabric requires the File System Access directory picker, which the agent environment can't drive.
- **Cache-buster**: `script.js?v=1052 → v=1053`; `sw.js` CACHE_NAME `v1051 → v1053` and its precached `script.js?v=1051 → v=1053`.
- **Not culled (intentionally)**: grid dots (already had their own culling in `drawGrid()`); the Widget Sidebar's screen-fixed widgets (not on the canvas, must always render); `computeMagneticClusters()` still runs each frame (drives totem color influence globally).

### 2026-07-21 — Render Coalescing + De-quadratic DOM Orphan Cleanup
- **What**: Two follow-on render-loop optimizations after the viewport culling above. (1) All ~98 `requestAnimationFrame(render)` call sites now go through a new coalescing `scheduleRender()` so at most ONE render runs per animation frame no matter how many code paths request one. (2) The four per-frame DOM orphan-cleanup loops that used `Array.map(...).includes()` (O(n²) every frame) now use a `Set` (O(1) membership).
- **Why**: Continuation of the user's optimization request. Many event handlers (especially `pointermove`) call `requestAnimationFrame(render)` from several branches in one tick, previously queuing multiple redundant renders for the same frame. The orphan-cleanup `.includes()` scans were quadratic in item count.
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Status**: DONE
- **Render coalescing**: Added `_renderScheduled` flag + `scheduleRender()` (just before `render()`). The flag is cleared inside the rAF callback *before* `render()` runs, so a `scheduleRender()` issued from within `render()` (the scroll-box/glow animation self-loop) still queues the next frame correctly. Then did a mechanical global replace of `requestAnimationFrame(render)` → `scheduleRender()` (98 sites). Left untouched: direct synchronous `render()` calls (init, `animateCamera` loop), `requestAnimationFrame(animateCamera)`, and `requestAnimationFrame(() => {…})` custom callbacks. Verified in-browser: firing `scheduleRender()` 50× in one tick keeps the flag set (only one rAF queued) with no errors.
- **Set-based orphan cleanup**: In `syncTextsDOM()`, `syncTables()`, `syncCalendars()`, `syncScrollBoxes()`, the `const xIds = [...].map(...)` + `if (!xIds.includes(el.id))` pattern became `new Set(...)` + `.has(el.id)`. (`syncNotesDOM()` already used a Set.)
- **Note on the original "#4 (cache getElementById)" idea**: deliberately NOT done as literal DOM-ref caching. `getElementById` is already an O(1) browser hash lookup (negligible), and storing element refs on `state` items would break `saveCurrentFabric()`'s `JSON.stringify(state)` (DOM nodes → circular-reference throw). The Set conversion is the genuinely worthwhile, safe form of "stop doing redundant per-frame work" and was done instead. A module-level `Map`-based ref cache (kept off `state`) remains a possible future micro-opt but is low value.
- **Verification**: clean console on load and on reload; all four sync functions + `scheduleRender()` invoked directly in the live page with no errors.
- **Cache-buster**: `script.js?v=1053 → v=1054`; `sw.js` CACHE_NAME `v1053 → v1054` and precached `script.js`.

### 2026-07-21 — In-Place Table Updates + AABB Early-Reject for Hit-Testing/Containment
- **What**: Two more optimizations. (1) `syncTables()` no longer tears down and rebuilds every on-screen table (and re-attaches every cell's event listeners) every frame — it now rebuilds only when the table's STRUCTURE changes. (2) `recalculateItemLinks()` and `findAssignedArea()` now do a cheap AABB (bounding-box) reject before every expensive `isPointInPolygon` ray-cast, massively cutting the practical cost of the O(areas²) / O(items×areas) containment scans.
- **Why**: Continuation of the optimization request; these were the next two items on the agent's suggested list ("in-place table DOM updates" and "spatial index for hit-testing").
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Status**: DONE
- **In-place tables** (`syncTables`, script.js ~L6061): added a structural signature `` `${rows}x${cols}|${colWidths.join(',')}|${rowHeights.join(',')}|${isResizing?1:0}` `` stored on the container as `container._tableSig`. If an existing container's sig matches, take a FAST PATH that only updates cheap per-frame props (left/top position, bg/text color, animation-offset transform, DOM clip, display) and `continue`s — skipping the full `remove()`+recreate. Cell CONTENT is intentionally NOT part of the signature: content lives in the contenteditable DOM and is written back to `state` on `input`, so the DOM is always the current source of truth and never needs a rebuild; only row/col count, column/row sizes, or resize-mode toggling force one. This is both a perf win and a robustness win (the old per-frame rebuild would have destroyed a focused cell's caret if a render happened mid-edit). Verified live: fast path preserves a live-edited cell + the DOM node identity across syncs; a structural change (added column) correctly triggers a rebuild.
- **AABB early-reject** (the safe form of the requested "spatial index"): rather than a persistent grid/bucket spatial hash (which would need invalidation at dozens of area add/move/resize/delete sites — high risk of silently making items non-interactive on this fragile codebase), used a STATELESS approach: a point/area can't be inside a polygon whose bounding box it's outside of, so one O(1) box comparison skips the ray-cast.
  - `recalculateItemLinks()` (script.js ~L2906): precomputes every area's bbox ONCE per call into a `Map` (keyed by the area OBJECT, not id). The area→area parent-assignment loop rejects any `other` whose bbox doesn't fully contain `a`'s bbox (necessary condition for full polygon containment, since a's bbox extremes are real checkpoints). The map is passed through to `findAssignedArea()` for the files and drawings loops.
  - `findAssignedArea(point, currentItem, bboxMap=null)` (script.js ~L3015): new optional 3rd param. Rejects any area whose bbox doesn't contain `point` before the polygon test. Uses the passed map when available (from `recalculateItemLinks`), else computes a bbox inline — so standalone click-time calls (2-arg) also benefit and behavior is unchanged.
  - Stateless = nothing to invalidate; bboxes are recomputed fresh each `recalculateItemLinks` call. No correctness change (AABB never rejects a true container — a point inside a polygon is always inside its AABB).
- **Verification**: identical assignment results to before on a nested synthetic scene (small area parented to big area; files assigned to the smallest containing area; outside file → Unassigned; standalone no-map path correct). Performance: 400 areas + 400 files → **~8.5 ms per full `recalculateItemLinks()`** with 400/400 files correctly assigned, clean console.
- **Cache-buster**: `script.js?v=1054 → v=1055`; `sw.js` CACHE_NAME `v1054 → v1055`.
- **Note on "spatial index"**: a true persistent spatial index was deliberately NOT built (invalidation risk >> benefit for event-driven hit-testing). If a future need arises (e.g. tens of thousands of items with heavy rapid interaction), the natural next step is a coarse grid hash rebuilt lazily on a dirty flag — but the AABB reject already removes the O(n²) sting from the one genuinely quadratic path (`recalculateItemLinks`).

### BUG-0012 — `#workspace` Offset From Viewport (0,0), Misaligning Every Click/Drag/Resize Point
- **Reported**: 2026-07-21
- **Description**: User noticed the "Drag to select or move areas..." instruction text at the top-left visibly pushes the canvas content down, and separately that resize handles / area corners / other points-of-intersection render a few pixels off from where they should be.
- **Root Cause**: `.instructions` (`index.html` ~L487, the small status-text bar showing tool hints) was the ONLY element preceding `#workspace` in `<body>` that lacked `position: fixed`/`absolute` — every sibling before it (`#toolbar`, all `.properties-panel` ribbons, `#home-screen`, `#settings-popup`, `.modal-overlay`) already floats via `position: fixed`. Being `position: static`, `.instructions` sat in normal document flow and physically pushed `#workspace` down by its own rendered height (measured 16px at default zoom/font metrics — the exact amount scales with whatever renders the text at any given font/zoom, so it wasn't even a fixed offset). Confirmed via `getBoundingClientRect()`: `#workspace` sat at `top: 16` instead of `top: 0`, and its bottom (`736`) extended 16px past the actual viewport height (`720`), silently clipped by `body { overflow: hidden }` (so ~16px of canvas at the bottom edge was permanently invisible, dead space nobody could see or reach).
  - This mattered because `screenToWorld()`/`worldToScreen()` (script.js ~L8375) both compute using `workspace.getBoundingClientRect().width/height` but were written assuming `rect.top`/`rect.left` are always `0` (they never subtract them) — true whenever `#workspace` sits flush at the viewport's top-left, false the moment anything (like `.instructions`) pushes it down. Every mouse-driven world-coordinate conversion (drawing, dragging, resizing, hit-testing, area/totem/text placement — dozens of call sites feeding `e.clientX`/`e.clientY` into these two functions) was off by the current offset amount. `openTextEditor()`'s inline editor (`input.style.top = e.clientY + 'px'`, appended via `workspace.appendChild(input)` so its `position:absolute` `top` is relative to `#workspace`'s own local origin) had the identical implicit assumption baked in.
  - Also incidentally meant a full-viewport-width, 16px-tall strip at the very top of the screen was "dead" for canvas interaction — clicks there hit the static `.instructions` div (which had no `pointer-events` rule, i.e. default `auto`) instead of reaching the canvas beneath.
- **Expected**: The canvas/workspace should fill the viewport exactly (`top:0, left:0`), and a screen click should map to the exact same world point that was rendered there — zero pixel error.
- **Status**: FIXED (2026-07-21)
- **Fix Details**: Changed `.instructions` (style.css) from no `position` (defaulting to `static`) to `position: fixed; top: 16px; left: 20px; z-index: 50; pointer-events: none;` — matching the exact convention every other floating overlay in this codebase already uses (`#toolbar` is `position: fixed; z-index: 100`). This takes it out of document flow entirely, so `#workspace` is no longer pushed down, AND makes the label non-interactive (it's pure status text, never had a click handler) so it no longer eats clicks meant for the canvas. No JS changes were needed — fixing the CSS root cause made every downstream consumer (`screenToWorld`, `worldToScreen`, the inline text editor) correct simultaneously, since they were all internally consistent under the (previously false) assumption that `#workspace` starts at viewport `(0,0)`.
- **Files Modified**: `style.css`, `index.html` (cache-buster only), `sw.js` (cache-buster + precache list)
- **Verification**: Live in-browser (after clearing the stale service-worker cache that was serving the pre-fix `index.html`/CSS during the first verification attempt — a reminder that BOTH the HTML's `?v=` query string AND `sw.js`'s `CACHE_NAME`/precache list must bump together, or the SW's cache-first-on-failure fallback can mask a fix): `#workspace.getBoundingClientRect()` now reports `{top:0, left:0}` exactly. A synthetic click at the exact screen point `render()` draws as world `(0,0)` now round-trips through `screenToWorld()` → `worldToScreen()` with **zero pixel error** (previously off by the live offset amount, 16px in the measured case). Clean console before and after.
- **Cache-buster**: `style.css?v=1028 → v=1029` (this bug was CSS-only, so this is the first bump to the CSS version this session); `sw.js` precached `style.css` reference updated to match.

### BUG-0013 — Text Boxes Flickering In/Out While Panning (Viewport-Culling Bbox Bug) + Proportional Culling Margin
- **Reported**: 2026-07-21
- **Description**: User reported text disappearing and reappearing while panning across the fabric, and asked for the viewport-culling margin to be more generous — specifically, if the visible viewport counts as area "1", the culled/rendered region should be "1.25" (25% larger).
- **Root Cause (the actual flicker)**: `getRenderBBox()` (added earlier this session for viewport culling, script.js ~L6347) had no dedicated branch for `type: 'text'` items. Text drawings in this codebase NEVER store a `.height` in `state` — their height is intrinsic to the rendered content (word-wrap, font size, line count) and is computed by the browser, read live from the DOM (`getDraggableDrawingAt()` ~L761 and the eraser hit-test already do exactly this, per the 2026-07-17 entry above). Text items that HAD a `.width` (set via a resize) fell into the generic "explicit-size box" branch, which read `item.height` — always `undefined` for text — producing a **zero-height bbox**. A zero-height box only overlaps the viewport if its exact top-edge y-coordinate is within `viewBounds`; the moment panning moved that one y-value outside the (previously fixed 150px) margin, the text was culled and hidden — even though its real, multi-line rendered content was still substantially on screen. This produced exactly the reported symptom: text popping in/out during pans, worse for taller (multi-line) text boxes since the true miss-vs-viewport margin was effectively "however many pixels of vertical margin exist, compared against a single point instead of the real box." Text items that never had `.width` set fell through to the generic bare-`x`/`y` fallback (a fixed 100×50 box) — also frequently wrong-sized for real text.
- **Expected**: Text (and everything else) should stay rendered continuously through a pan, with no visible pop-in/out at reasonable pan speeds; the culled region should be a generous 1.25x the visible viewport.
- **Status**: FIXED (2026-07-21)
- **Fix Details**:
  - Added a dedicated `item.type === 'text'` branch at the TOP of `getRenderBBox()` (checked before the generic branches, since text can incidentally match them). Mirrors the exact pattern already trusted elsewhere in this codebase for text: if the live `.text-item` DOM element exists (`document.getElementById(item.id)`), use its real `offsetWidth`/`offsetHeight` — same source of truth as hit-testing and the selection outline, so culling can never disagree with what's actually rendered. If the DOM element doesn't exist yet (first frame before `syncTextsDOM()` creates it), falls back to a content-aware estimate (line count × font size × line-height for height, `item.width` or a per-line character-count estimate for width) instead of `0`.
  - Changed `updateViewBounds()`'s margin from a flat `marginPx=150` screen-pixel constant to a **proportional** `marginRatio=0.125` applied to `width`/`height` independently, i.e. `marginX = width*0.125/zoom`, `marginY = height*0.125/zoom`. Since the margin is added on BOTH sides, this makes the total culled region exactly **1.25× the visible viewport's width AND height** at every zoom level, per the user's explicit "visible=1, culled=1.25" ask (verified: at zoom 1 and zoom 2, `(culledWidth / visibleWidth) === 1.25` exactly in both cases).
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Verification**: Live in-browser — confirmed proportional margin math is exactly 1.25x at zoom 1 AND zoom 2 (margin correctly tracks the CURRENT visible viewport, not a fixed world-space size). Confirmed the text bbox fix across 3 cases: (1) text with a live DOM element → bbox height exactly matches `offsetHeight`; (2) text with no DOM element yet → non-zero fallback estimate; (3) the exact regression scenario (`.width` set, no `.height`, matching a resized text box) → non-zero height where the old code would have produced `0`. Clean console throughout.
- **Cache-buster**: `script.js?v=1055 → v=1056`; `sw.js` CACHE_NAME `v1055 → v1056`.
- **Note**: this bug only affected the (new, this-session) viewport-culling logic added for performance — it did NOT affect actual rendering correctness before culling existed, since `drawDrawings()`'s own text rendering doesn't use `getRenderBBox()`. It's specifically a case of the culling optimization introducing a regression, now fixed and cross-checked against the codebase's own established DOM-read pattern to prevent the two systems from ever disagreeing again.

## ⚡ NEW FEATURE — Tablet Mode (Touch Gestures + Stylus Input) (2026-07-21)

- **What**: Added a "Tablet Mode" toggle to the Settings popup (`#settings-popup`, next to Graphics Preset). When ON, finger touches are reserved entirely for system gestures, so a stylus can be used for every click/drag/draw interaction exactly like a mouse — designed for tablets with no keyboard/mouse (hand + stylus use).
  - **2-finger swipe** → continuous pan (moves the camera by the average touch position's frame-to-frame delta).
  - **2-finger tap** (quick, minimal movement) → opens the same context/options menu a mouse right-click would (area/text/totem/progress-bar/clock/calendar menus — whichever the tap hit-tests to).
  - **3-finger swipe up** → opens Mission Control (`openMissionControl()`, same as `Shift+D`).
  - **3-finger swipe down** → toggles Constellation Mode (`toggleConstellationMode()`, same as `Shift+R`).
  - **3-finger swipe left** → toggles the Widget Sidebar (`toggleWidgetSidebar()`, same as `Shift+S`).
  - **Stylus (pen) and mouse are completely untouched** by any of this — Tablet Mode only intercepts `pointerType === 'touch'` events; pen/mouse always flow through the exact same click/drag/draw pipeline as before, regardless of whether Tablet Mode is on.
  - **Single-finger touch, while Tablet Mode is ON, does nothing** (reserved — not used for drawing/selecting) — the assumption (from the user's own description) is that fingers are for gestures only and the stylus does all "clicking." *(This is the one behavioral inference made rather than explicitly specified — flagged in case a single-finger touch action is wanted later.)*
- **Why**: User wants to use the app on a tablet with no physical keyboard/mouse, using hand gestures for navigation/system actions and a stylus for all direct interaction with the fabric.
- **Files Modified**: `index.html`, `script.js`, `sw.js`
- **Status**: DONE
- **Persistence**: `tabletMode` is a **device-level** setting (NOT a fabric property) — stored in `localStorage` under `spatial-tablet-mode`, loaded once at script-load time (`let tabletMode = localStorage.getItem('spatial-tablet-mode') === '1';` near `spacePressed`, script.js ~L60), independent of `state`/`prepareFabricState()`, so it persists across fabric switches and page reloads without needing any per-fabric wiring.
- **Architecture** (script.js, new module right before `setupWorkspaceListeners()`):
  - `setTabletMode(on)` — sets the flag, persists to `localStorage`, syncs the settings-popup checkbox, and calls `resetTouchGesture()`.
  - `activeTouches` (Map: pointerId → `{x, y, downTime}`), `touchGestureMaxCount`, `touchGestureStart`, `touchGestureFired`, `touchPanLast` — gesture-tracking state. Classification uses the **peak** simultaneous touch count since the last all-fingers-up reset (`touchGestureMaxCount`), NOT the live/fluctuating count — so lifting one finger early during a 3-finger swipe can't misfire as a 2-finger action.
  - `handleTabletTouchDown(e)` / `handleTabletTouchMove(e)` / `handleTabletTouchUp(e)` — each returns `true` if it fully consumed the event (caller must stop normal handling), `false` immediately if `!tabletMode || e.pointerType !== 'touch'` — this early bail-out is what guarantees mouse/pen are NEVER affected, and that touch behaves exactly as it always has when Tablet Mode is off.
  - 2-finger tap reuses `handleWorkspaceContextMenu()` — the SAME function a mouse right-click calls — via a synthetic event object (`{clientX, clientY, target: workspace, preventDefault: () => {}}`), so the touch equivalent can never drift out of sync with what right-click does.
  - Thresholds: swipe recognition fires once the 3-finger average travels ≥70 screen-px in the dominant axis (`TOUCH_SWIPE_THRESHOLD`); a 2-finger release counts as a tap if it took ≤350ms (`TOUCH_TAP_MAX_DURATION`) and moved ≤12px (`TOUCH_TAP_MAX_MOVEMENT`).
- **Wiring into the existing pointer pipeline**: ONE line inserted at the very top of each of the three existing handlers — `handleWorkspacePointerDown()`, `handleWorkspacePointerMove()`, `handleWorkspacePointerUp()` — calling `handleTabletTouch{Down,Move,Up}(e)` and returning immediately if it returned `true`. This is the ENTIRE integration surface; no other part of the ~2,600-line pointer-handling code was touched, and per the early-bailout property above, this cannot change behavior for mouse, pen, or touch-with-Tablet-Mode-off.
- **Settings UI** (`index.html`, `#settings-popup`): a labeled checkbox `#tablet-mode-toggle` under a new "Input" heading, styled inline matching the popup's existing convention (no new CSS needed). Wired in `setupToolbarListeners()`: `change` → `setTabletMode(e.target.checked)`; the popup's existing open-handler also syncs the checkbox from the live `tabletMode` value (mirroring how it already syncs `graphics-preset-select`).
- **Verification**: Live in-browser via direct function calls with synthetic touch-pointer objects (no real touchscreen available in this environment):
  - 2-finger pan: two touches down, moved by (+40,+25) each → `state.camera` moved by exactly `(40, 25)`.
  - 2-finger tap: two touches down, one released quickly with no movement → `handleWorkspaceContextMenu` called with the average tap position.
  - 3-finger swipe up/down/left: each correctly called `openMissionControl()` / `toggleConstellationMode()` / `toggleWidgetSidebar()` respectively (verified via temporary spies on the real global functions).
  - Safety checks: `pointerType: 'mouse'` and `'pen'` events are NOT consumed (return `false`) even with Tablet Mode on, and no touches get tracked for them; `pointerType: 'touch'` is NOT consumed when Tablet Mode is off.
  - Gesture state (`activeTouches`, `touchGestureMaxCount`, `touchGestureFired`) correctly resets to empty/0/false after every complete finger-lift sequence. Clean console throughout all tests.
  - **Not yet tested**: real multi-touch input on an actual touchscreen/tablet device (this environment has no touch hardware) — the user should verify on their actual tablet that simultaneous real touches report as expected and that gesture thresholds (70px swipe, 12px/350ms tap) feel right for real finger movement; these are easy constants to retune (`TOUCH_SWIPE_THRESHOLD`/`TOUCH_TAP_MAX_MOVEMENT`/`TOUCH_TAP_MAX_DURATION`, script.js, same module) if they feel too sensitive or too sluggish.
- **Cache-buster**: `script.js?v=1056 → v=1057`; `sw.js` CACHE_NAME `v1056 → v1057`.

### BUG-0014 — Totems Cannot Be Clicked (No Hit-Test in Select-Mode Click Path)
- **Reported**: 2026-07-21
- **Description**: User reported "totem is not clicking" — clicking directly on a totem in normal Select mode did nothing (no selection, no drag), and the click was instead swallowed as the start of a camera pan.
- **Root Cause**: The main select-mode pointerdown handler (`handleWorkspacePointerDown()`) hit-tests, in order, text/progress-bar drawings (`getDraggableDrawingAt()`) and then areas — but had **NO totem hit-test at all**. A click landing exactly on a totem matched neither of those two checks, so it fell all the way through to the final `else` branch, which treats the click as empty space and starts a pan. Totems were only ever hit-tested in two OTHER, narrower code paths that already existed and worked correctly: the right-click context menu (`handleWorkspaceContextMenu()`) and Constellation Mode's click-to-jump handler — neither of which is what a normal left-click in Select mode goes through. Confirmed live before any fix: a synthetic click exactly on a totem's screen position set `state.isPanning = true` and left `draggingArea`/`draggingText` both `false` — i.e., the totem was fully inert to a plain click.
- **Expected**: Clicking and dragging a totem should move it directly, exactly like areas, text boxes, and progress bars already support via click-and-drag.
- **Status**: FIXED (2026-07-21)
- **Fix Details**:
  - Added a totem hit-test to `handleWorkspacePointerDown()`'s select-mode branch, placed AFTER the text/progress-bar check but BEFORE the area check (matching totems' actual render z-order — `drawTotems()` runs after `drawAreas()` in `render()`, so totems visually sit on top of areas and must win hit-test priority over them at the same point). Reuses the same pill-shaped hit-box formula (`ctx.measureText(t.name)` + padding) already used by the two other existing totem hit-test sites (right-click menu, constellation-mode click) — not extracted into a shared helper, since this was a scoped bug fix, not a refactor.
  - On hit: clears any active text selection (matching the area-click convention), and — unless the totem `isLocked` — starts a direct drag: `state.draggingTotem = totem`, `state.dragStartWorld = worldPos`, cursor → `move`, `workspace.setPointerCapture(e.pointerId)`. A locked totem still consumes the click (returns early, no fall-through to pan) but simply doesn't start a drag, matching how locked areas/text already behave.
  - Added a `state.draggingTotem` branch to `handleWorkspacePointerMove()` (mirrors `draggingText`'s exact dx/dy-from-`dragStartWorld` pattern) and to `handleWorkspacePointerUp()` (releases pointer capture, resets cursor, calls `recalculateItemLinks()` since areas/files may now be spatially over/off the totem's old or new position, and `saveCurrentFabric()` to persist the new position).
  - This is a **separate, independent** feature from the existing "Move" context-menu action (`state.mode = 'move-totem'` / `state.movingTotemContext`), which relocates the totem's entire "magnetic field" cluster (nearby areas/files/drawings/tables/totems) together via a click-to-arm/move-with-cursor/click-to-drop flow. The new direct click-drag moves ONLY the totem itself — deliberately not reimplementing or duplicating the cluster-move logic, to keep this fix minimal and scoped to the actual reported bug (totems being completely unclickable), not a redesign of totem movement.
  - Added `draggingTotem: null` to both the default `state` object (script.js ~L43, alongside `draggingArea`/`draggingText`) and `prepareFabricState()`'s rebuilt state object (~L8919), for consistency with how the other two drag-state fields are declared (purely transient UI state, never persisted to fabric.json).
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Verification**: Live in-browser, before/after comparison with a fresh reload (had to clear a stale service-worker cache mid-verification — same `?v=` bump-both-files reminder as prior sessions): (1) a plain click on a totem no longer sets `isPanning`, instead immediately sets `draggingTotem` and cursor `move`; (2) dragging moves the totem by the exact pointer delta; (3) release clears `draggingTotem`, resets cursor to `grab`, and the new position persists; (4) a **locked** totem consumes the click (no pan) but does not start a drag; (5) regression checks confirmed area-clicking is unaffected and the totem right-click context menu still works exactly as before. Clean console throughout.
- **Cache-buster**: `script.js?v=1057 → v=1058`; `sw.js` CACHE_NAME `v1057 → v1058`.

## ⚡ RESTORED FEATURE — Off-Screen Totem Direction Indicators (2026-07-21)

- **What**: Rebuilt the "Totem Indicators" feature from scratch — small clickable arrow badges that appear at the screen edge, pointing toward any totem currently outside the viewport, labeled with that totem's initials. Clicking one animates the camera to jump straight to that totem.
- **Why**: Following up on the BUG-0014 totem-click fix above, the user asked specifically to check `style.css` for totem-related bugs. Investigation found the CSS for this exact feature (`#totem-indicators`, `.totem-indicator`, `.totem-arrow.left/right/top/bottom`) still fully present, but:
  1. **`syncTotemIndicators()` did not exist anywhere in `script.js`** — searched under every plausible name, no trace.
  2. **`#totem-indicators` did not exist anywhere in `index.html`** — no container element at all.
  3. The only surviving reference was one now-meaningless line in `handleWorkspacePointerDown()`: `e.target.closest('.totem-indicator')`.
  4. **A second, independent CSS bug**: even if the feature had been wired up, the arrows would STILL have been invisible — `.totem-arrow.left/.right/.top/.bottom` set `border-width`/`border-color` (the classic CSS-triangle technique) but there was no base `.totem-arrow { width: 0; height: 0; border-style: solid; }` rule, so `border-style` defaulted to `none` and the borders never rendered at all.
  - This is a full, silent feature removal with no `[REMOVED]` note anywhere — the same failure mode as the pre-2026-07-14 Mission Control deletion documented earlier in this file. The user was asked how to handle it (rebuild / delete the dead CSS / leave alone) and chose to rebuild.
- **Files Modified**: `index.html`, `style.css`, `script.js`
- **Status**: DONE
- **HTML**: Added `<div id="totem-indicators"></div>` back into `#workspace`, in its originally-documented position (between `#files-layer`/`#selection-overlay` and `#drop-overlay`).
- **CSS fixes**:
  - Added the missing base `.totem-arrow { width: 0; height: 0; border-style: solid; flex-shrink: 0; }` rule — without this, the existing 4 directional rules had nothing to render.
  - Added `.totem-indicator-label` (a small circular initials badge, 26px, matching the totem's own color) since the original `.totem-indicator` container's `display:flex; gap:6px;` clearly expected a second child alongside the arrow (per the docs: "Shows initials of totem name") that never existed.
  - Added a subtle `filter: drop-shadow(...)` to `.totem-indicator` for visibility against the dark background.
- **JS** (script.js, new functions right after `drawTotems()`):
  - `getTotemInitials(name)` — first 1-2 letters of the first word, or first letter of the first two words if multi-word.
  - `getOffscreenIndicatorPosition(screenX, screenY, width, height, margin)` — the standard "off-screen waypoint" algorithm: clamps the totem's screen position to the inset viewport rectangle along the ray from the viewport center, returning both the clamped point and which edge it hit (for arrow direction).
  - `syncTotemIndicators(width, height)` — for every totem whose `worldToScreen()` position falls outside `[0,width]×[0,height]`, creates/updates a `.totem-indicator` element (arrow + initials badge), removes indicators for totems that are back on-screen or deleted (Set-based orphan cleanup, matching this session's earlier `Set.has()` convention), and wires a `click` handler that calls `startCameraAnimation(-totem.x*zoom, -totem.y*zoom, zoom)` — the exact same camera-jump pattern already used by Constellation Mode's click-to-jump and Mission Control.
  - Wired into `render()`: called alongside the other DOM sync functions (`syncTextsDOM`, `syncTables`, etc.) in the normal render path; explicitly CLEARED (`innerHTML=''`) in the Constellation Mode early-return branch, since Constellation Mode already shows every totem zoomed out — edge arrows would be meaningless there.
  - Added `const totemIndicatorsLayer = document.getElementById('totem-indicators');` alongside the existing `filesLayer` DOM-ref declaration.
- **Verification**: Live in-browser, direct `render()` calls (not `scheduleRender()`) to get synchronous, immediately-checkable results:
  - An off-screen totem gets an indicator; an on-screen one does not.
  - All 4 directions (totem placed far left/right/top/bottom of a centered camera) resolve to the correct arrow class.
  - Label shows correct initials, background matches the totem's color, `title` shows the full name.
  - Confirmed the arrow-visibility fix: `getComputedStyle(...).borderTopStyle` is now `'solid'` (previously would have been `'none'`).
  - Constellation Mode correctly clears all indicators (count 0 after switching).
  - Click-to-jump verified via a temporary spy on `startCameraAnimation()` (confirmed called with the exact expected `-x*zoom, -y*zoom, zoom` target) rather than watching the animation complete — this automated browser tab reports `document.visibilityState: "hidden"` / `hasFocus: false`, and confirmed via a bare `requestAnimationFrame` test that rAF callbacks genuinely do not fire in this environment while the tab is backgrounded. This is an ENVIRONMENT limitation (real user tabs are visible/focused), not a bug — the animation math itself (`animateCamera()`) is pre-existing, shared code already exercised by other jump-to features, so confirming the correct target is passed in is sufficient.
  - Orphan cleanup verified through a full lifecycle: appears off-screen → removed once back on-screen → reappears off-screen again → removed when the totem is deleted entirely. Clean console throughout all tests.
- **Cache-buster**: `script.js?v=1058 → v=1059`; `style.css?v=1029 → v=1030` (first CSS bump since BUG-0012); `sw.js` CACHE_NAME `v1058 → v1059`.

---

*Last updated: 2026-07-22*

### BUG-0015 — Totem Ribbon Button Unclickable
- **Reported**: 2026-07-22
- **Description**: Clicking the Totem Marker button (`#btn-totem`) in the main toolbar ribbon did nothing.
- **Root Cause**: `script.js` was missing the DOM element reference `const btnTotem = document.getElementById('btn-totem')`, was missing the click listener `btnTotem.addEventListener('click', () => setMode('totem'))` in `setupToolbarListeners()`, was missing `'totem': btnTotem` in `setMode()`'s `btns` active-class map, and was missing instruction text for totem mode.
- **Expected**: Clicking the Totem button in the ribbon activates Totem mode, highlights the button, updates status text, and prompts for a Totem Name on click.
- **Status**: FIXED (2026-07-22)
- **Fix Details**: Added `const btnTotem` DOM declaration, wired up `btnTotem.addEventListener('click', () => setMode('totem'))`, registered `'totem': btnTotem` in `setMode()`, added instruction text for totem mode, added `M` key shortcut, and updated cache buster (`v=1060`).

---

### 2026-07-22 — Totem Ribbon Button & Keyboard Shortcut Fix
- **What**: Fixed unclickable Totem button on main toolbar ribbon and added `M` key shortcut.
- **Why**: User reported Totem button present in main ribbon was not clicking.
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Status**: DONE

### 2026-07-22 — Removed Totem Floating Indicators
- **What**: Removed off-screen totem floating direction indicator buttons (edge arrows with initials badges).
- **Why**: Explicit user request ("remove this totem floating button").
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Lines Changed**: `script.js` `syncTotemIndicators()` updated to clear `#totem-indicators` container and return early; bumped `v=1060 → v=1061`.
- **Status**: DONE

### 2026-07-22 — Direct Totem Dragging Disabled
- **What**: Disabled direct single-totem dragging on left-click; totems can now only be relocated by selecting "Move Totem & Field" from their right-click context menu.
- **Why**: Explicit user request ("make the totem like it cannot be moved just by normal dragging, to move user has to select move totem & field option").
- **Files Modified**: `script.js`, `index.html`, `sw.js`
- **Lines Changed**: `script.js` `handleWorkspacePointerDown` updated to not set `state.draggingTotem`; bumped `v=1061 → v=1062`.
- **Status**: DONE




