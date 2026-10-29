# CanvasX

**An infinite spatial canvas for organising real files, notes and plans, saved as plain files on your own disk, with no server, no account and no build step.**

![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)
![Vanilla JS](https://img.shields.io/badge/vanilla-JavaScript-yellow)
![PWA](https://img.shields.io/badge/PWA-Chrome%20%7C%20Edge-informational)

CanvasX (which began as **File Fabric**, the "Spatial File Manager") is a pan-and-zoom canvas where you think in space. You drop real files onto it, draw areas around related things, write notes and checklists, link ideas together, and build small dashboards from progress bars, clocks and calendars. Each canvas, called a *fabric*, is a folder on your disk, so your work is never locked inside an app or a cloud.

It is the canvas at the centre of a three-part system:
- **CanvasX** is where the user thinks and organises.
- **NoteX** turns canvases into documents AI can search, and lets AI agents write onto canvases with a tag-based script.
- **RAGX** is the local RAG engine that searches them and answers with citations.

---

## Why this was hard

- **A full drawing and layout app in plain JavaScript.** About 11,800 lines of application logic, 3,000 lines of CSS and 600 lines of HTML, with no framework, no bundler and no build step. Rendering, hit-testing, geometry, nesting, dragging, autosave and every widget are written by hand.
- **Real files, not uploads.** It uses the browser's **File System Access API**: a workspace is a folder you pick, each fabric is a sub-folder, and dropped files are copied in beside the canvas. Saving means writing safely to disk from a web page.
- **Spatial structure has rules.** Which area an item belongs to is worked out from geometry: point-in-polygon ray casting, the smallest enclosing area, Bézier bounding boxes and polygon overlap. Groups (totems) are formed by distance, and progress bars count the checklists of every note reachable through links.
- **Saving without losing work** (see below).

### The save-pipeline fix

Edits were being lost: a pen drawing could vanish, and erasing an image or deleting a box was only saved if something *else* triggered a save later. Leaving a canvas could even write one canvas's state into another canvas's file. The rebuilt save pipeline (commit `6a9a781`):

- binds each save to the canvas and state it was requested for, so a save can never land in the wrong `fabric.json`;
- queues saves so they run after any earlier save, and lets a pending save be written immediately;
- writes waiting saves when you go home, open or create a canvas, hide the tab or leave the page, and asks before closing the tab if a changed save hasn't been written yet;
- makes the eraser, file-card and menu deletes, moves, shapes, area naming and panning all request a save, and so does any input that ends while a canvas is open;
- skips a save that is identical to the last write;
- refuses saves while another canvas is still loading;
- replaces an alert on every failed thumbnail with one console warning per canvas.

The on-disk format (`fabric.json`, `.fabric_lock`) is unchanged, so NoteX and existing canvases keep working.

---

## Features

**Canvas**
- Infinite pan and zoom, with focal-point zoom and high-DPI rendering
- **Areas**: free-form or box regions that hold items, nest inside each other and carry names and colours
- **Pen, shapes, lines and arrows**, plus an eraser with several modes
- **Text** with Markdown headings, fonts, alignment, colours and highlights
- **Notes** with Markdown checklists (`- [ ]` / `- [x]`)
- **Files**: drag in any file from the OS, with image and PDF previews
- **YouTube links** as visual cards
- **Lasso selection**, context menus, colour palettes and keyboard shortcuts for every tool

**Organisation**
- **Totems**: named groups that gather nearby areas, with Constellation mode (`Shift+R`) to see them all at once
- **Links**: corner-to-corner connections between areas
- **Scroll boxes**: multi-page containers with animated page transitions
- **Books**: named collections, kept on shelves shared by every canvas

**Dashboards**
- **Progress bars** driven by the checklists in linked notes
- Live **clock**, **calendar** with month navigation, and **tables**

**App**
- Installable **PWA** with a network-first service worker
- A home screen of fabrics with thumbnails
- A lock file (`.fabric_lock`, refreshed every 10 s) so other tools know when a canvas is open

---

## How a canvas is stored

```
<workspace>/
  <fabric name>/
    fabric.json      the whole canvas: areas, drawings, files, totems, links, widgets
    thumbnail.jpg    shown on the home screen
    sources/         copies of every file dropped on the canvas
    .fabric_lock     present while the canvas is open; refreshed every 10 s
```

Because it is plain JSON in plain folders, other programs can read it. **NoteX** reads it to build AI-searchable documents, and writes agents' scripts into it only when the lock has gone stale.

---

## Tech stack

- **Vanilla JavaScript, HTML5 Canvas, CSS**, with no framework and no build
- **File System Access API** for reading and writing real folders (Chromium only)
- **Service worker + Web App Manifest** for an installable PWA
- `marked` for Markdown in notebook previews

## Getting started

CanvasX is static files. Serve the folder and open it in **Chrome or Edge**:

```bash
python -m http.server 9075
```

Then go to `http://localhost:9075`, pick (or create) a workspace folder, and create a fabric.

## Project layout

```
index.html        structure: toolbars, ribbons, modals, templates
script.js         all application logic: state, rendering, events, tools, saving
style.css         styles and animations
sw.js             service worker
manifest.json     PWA manifest
knowledge/        the project's own append-only records: code map, progress, decisions
```

## Works with ter-manager

CanvasX runs as its own web app. Its canvases connect to the rest of the system through **ter-manager** (my own terminal and workspace manager, not public yet), where the **NoteX** and **RAGX** plugins run. NoteX, inside ter-manager, reads every canvas in your workspace, keeps the ones you choose in RAGX automatically, and writes AI agents' scripts onto canvases whenever CanvasX isn't holding them open. So what you lay out in CanvasX can be searched, cited and added to by AI, without CanvasX itself changing.

## GitX ready

This repository is set up for the **GitX workflow**, so any AI coding agent that opens it works the same disciplined way:

- `AGENTS.md` holds the project's rules and the workflow once; `CLAUDE.md` and `GEMINI.md` import it, so **Claude Code** and **Google Antigravity** both follow it.
- The `gitx-workflow` skill ships in `.claude/skills/` and `.agents/skills/`, and a hook in `.claude/settings.json` checks the workflow after every edit and at the end of each turn, when GitX is installed on the machine (without it, the hook stays silent).
- `GitX.md` is a **map of the code**: each feature, the code it owns and its known bugs, so an agent asks GitX instead of reading 11,000 lines from scratch.
- Agents catch up on recorded decisions before changing anything, record new decisions as they happen, and commit with GitX trailers, so the reasoning behind every change travels with the code.

## Related projects

- **NoteX**: canvases → AI documents, and AI agents → canvases.
- **RAGX**: the local RAG engine that searches them.

## License

Copyright (C) 2026 Paveen Pratheek.
CanvasX is free software under the **GNU Affero General Public License v3 or later**. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The name "CanvasX" is not licensed for use by modified versions.
