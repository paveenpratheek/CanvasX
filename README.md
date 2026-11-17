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
- **Moving round from the keyboard**: the arrow keys pan the canvas and `Shift+Up` / `Shift+Down` zoom in and out about the middle of the screen, smoothly for as long as you hold them. `Shift+Alt` with an arrow flies to the nearest totem or sub-totem that way, keeping the zoom. On an agent canvas, `Shift+A` puts the cursor in the chat with the agent, and `Escape` gives the keys back to the canvas.
- **Light and dark mode**: a sun/moon button on the home screen and the toolbar. It changes CanvasX itself (home screen, toolbars, menus, dialogs) and is remembered in your browser. In light mode a canvas on the default black is shown white (its file still says black, so dark mode shows it black again); a canvas given another colour keeps it. White text on a light canvas is shown black, and white again in dark mode. A new canvas starts on the theme's background.

**Organisation**
- **Totems**: named groups that gather nearby areas, with Constellation mode (`Shift+R`) to see them all at once
- **Sub-totems**: one level of groups inside a totem, such as a book's chapters or a game's cars. Right-click a totem and choose **Add sub-totem**, or let the agent write them. Boxes join the sub-totem they sit near; the label is smaller and ringed; Constellation mode links each sub-totem to its totem; moving a totem with its field takes its sub-totems along, and deleting a totem leaves its sub-totems as totems.
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
- **Agent canvases**: assign an empty canvas to the agent from its menu on the home screen. NoteX then draws it from the agent's scripts. CanvasX shows it view-only, with only Pan and Home and the view shortcuts (Shift+R constellation, Shift+D Mission Control, Shift+S widget sidebar, H pan, the arrow keys, Shift+Up/Down and Shift+Alt+arrow, Shift+A to the chat), and redraws it whenever NoteX changes it. Take it back from the agent to edit it yourself. Beside an agent canvas sits a **chat with the agent**: ask about the canvas or tell it how to arrange it, and pick the model. Attach, drop or paste files and images into the chat and say where they go; the agent places them in the same answer. NoteX runs the agent, redraws the canvas when it changes it, and keeps the conversation. CanvasX finds NoteX through `.notex/link.json`, which NoteX writes into the workspace while it runs.

**CanvasXP, on your phone**
- **CanvasXP** is CanvasX for phones: the same app, built from the same files, that you host on Netlify and install from Chrome or Samsung Internet. It works on a target folder in the phone's own storage, like CanvasX on the PC.
- **USB sync with the PC through NoteX.** Press **Set up USB sync** on CanvasXP's home screen, plug the phone in with **File transfer**, and pick the same folder in NoteX's **Phone** view. After that, **Phone attached - sync** in NoteX keeps the two the same, canvas by canvas. When both sides changed a canvas, both versions are kept: the PC's under its name, the phone's beside it as "Name (phone)".
- CanvasXP keeps what the sync needs in `_canvasxp/` inside its folder. It lists every file with its SHA-256 after each save, and when its home screen shows it takes in what NoteX copied over, once every file's hash checks. If you changed a canvas on the phone after NoteX last saw it, your version is kept aside as "Name (phone)" before the PC's is written.
- **Gemini or Claude, per canvas.** The agent chat's model picker lists Claude's models and, through Google Antigravity, Gemini 3.8 Flash (High, Medium, Low). Each agent canvas keeps the model its last message used, so a canvas you hand to Gemini is answered by Gemini, on the PC and for messages queued on the phone, until you pick another; NoteX runs it (see NoteX's README).
- **Fast on a phone.** A web page reaches a phone's folders only through Android, about a second a step, so CanvasXP keeps a working copy of the target folder in the browser's own storage and works from that: canvases open in a second or two, and saves and attachments never wait. Each change is copied to the folder in the background, in order, and kept if the page closes first; the USB sync card says how many changes are still on their way, so let them finish before syncing. The first time a folder is opened, every file is copied once, with a card counting them; after that, changes made to the folder outside CanvasXP are noticed and read in.
- **Talk to the agent from the phone.** Agent canvases come to the phone view-only, with the chat beside them, which has two boxes: **Description** (what the attachments are) and **Prompt** (what the agent should do). Send keeps the message in your target folder, in **Queued messages**, as a folder named `<canvas> - <date time>` holding the photos from your gallery or other files you attached and a readable `message.md` with the canvas, Description, Prompt and attachments. The chat shows it as "waiting for the PC", and you can still remove it. At the next USB sync NoteX has the agent answer each message, and the redrawn canvas and the answers come back to the phone in the same sync, while the answered folders are cleared. One NoteX could not hand to the agent keeps a `Not answered.txt` saying why.
- **Made for a phone, in light or dark.** The home screen shows the folder in use, the USB sync card with a progress bar while the PC's changes come in, your canvases in two columns and the agent's canvases listed apart with how many messages wait for the PC, and a **New canvas** button within reach of your thumb. On a canvas a top bar holds back, the canvas's name, light/dark and Settings, with a zoom control below it, and the tools sit in a dock at the bottom, each named, swiping sideways for more. On an agent canvas the top bar says **View only** and the chat is a sheet from the bottom that folds to a bar. CanvasXP is always in Tablet Mode: two fingers move the canvas and pinch to zoom, and the pen draws. A three-finger tap shows or hides a see-through stick at the bottom left, like a touch game's: push it to glide across the canvas, faster the further you push, and let go to stop. Double-tap the stick to switch it to **totem jumps**: then a push flies to the nearest totem that way, like Shift+Alt with an arrow but in any direction, and holding it hops on to the next; double-tap again to glide. CanvasX in Tablet Mode has it too. In Mission Control one finger scrolls and a tap goes to a totem; in the constellation view one finger moves the view and a tap on a totem's name goes to it. The page itself never scrolls, so only the canvas moves.
- **And for a tablet, either way up.** Any touch screen gets this design, so a tablet keeps it however it is turned; a PC with a mouse keeps CanvasX's layout. Upright, the canvases come in three columns and the dock and chat sheet are larger. Sideways, the home screen puts the folder, USB sync and the agent's canvases in a column beside four columns of canvases, the tools stand in a column down the left edge, zoom, light/dark and Settings sit at the top right, and the agent chat is a panel on the right with the canvas beside it. What a canvas holds - totems, areas, boxes and the rest - looks and works the same on every screen.
- **Its own logo and icon.** The home screen shows CanvasXP's mark - an area, a totem and the link between them - beside its name, and the installed app, the browser tab and the home-screen shortcut use the same icon (`xp/icons`; `node xp/icons/render.mjs` draws the PNGs from the SVGs).
- **A popup while NoteX syncs.** When NoteX starts reading the phone, CanvasXP says NoteX is accessing your canvases. While the agent answers your waiting messages it shows a progress bar ("1 of 3 answered"), and once NoteX's changes are taken in it shows Synced, with what changed. **Hide** tucks it into a slim bar at the top. If NoteX goes quiet for a minute and a half, it says NoteX stopped. If you have an ordinary canvas open that the PC changed, it asks you to go to the home screen to bring the changes in, so your open copy is not saved over them.

---

## How a canvas is stored

```
<workspace>/
  <fabric name>/
    fabric.json      the whole canvas: areas, drawings, files, totems, links, widgets
    thumbnail.jpg    shown on the home screen
    sources/         copies of every file dropped on the canvas
    .fabric_lock     present while the canvas is open; refreshed every 10 s
    agent.json       present when the canvas is assigned to the agent
  _canvasxp/         on a phone, CanvasXP's USB sync: device.json, manifest.json, incoming/,
                     chats/, status/ (NoteX's steps)
  Queued messages/   on a phone, messages to the agent waiting for the PC: <canvas> - <date time>/
                     with message.md and the attachments
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

### NoteX and RAGX from CanvasX

The switcher at the top of the home screen, and at the bottom left of a canvas, reads **CanvasX · NoteX · RAGX**. NoteX and RAGX come from [NoteX Studio](https://github.com/paveenpratheek/NoteX-Studio), which runs them on your PC:

- When NoteX Studio is running, **NoteX** or **RAGX** opens its page in this same tab, with your canvas kept open behind it. The first time, its setup runs there: it checks and installs what it needs, asks whether your agent is Claude Code or Google Antigravity, and then asks to start NoteX and RAGX.
- When it is not, a dialog offers **Setup NoteX and RAGX** or, if it is installed already, **Start it**. Either way you choose a folder, CanvasX writes a script there, and you run it once; the one command to paste into a terminal is shown as well. The dialog opens NoteX once the studio answers.

CanvasX looks for the studio at `http://127.0.0.1:7075` (another address can be set in `localStorage['canvasx-studio-url']`). It only asks the studio whether it is there and shows the studio's page in a frame; it never holds the studio's token. CanvasXP has no switcher.

### CanvasXP on Netlify

```bash
node xp/make.js
```

This builds CanvasXP into `xp/site`: CanvasX's own page, script, styles and icons, with CanvasXP's name, manifest, service worker, `xp.css` and `xp.js` added. Drag `xp/site` onto Netlify, or link this repository: `netlify.toml` runs the build and publishes only `xp/site`, so nothing else in the repository goes online. Open the site on the phone in Chrome or Samsung Internet, install it, and pick a target folder.

## Project layout

```
index.html        structure: toolbars, ribbons, modals, templates
script.js         all application logic: state, rendering, events, tools, saving
style.css         styles and animations
apps.js, apps.css the CanvasX · NoteX · RAGX switcher and NoteX Studio's setup dialog
sw.js             service worker
manifest.json     PWA manifest
knowledge/        the project's own append-only records: code map, progress, decisions
xp/               CanvasXP: xp.js (USB sync, phone side), xp.css, manifest, service worker, make.js
netlify.toml      publishes CanvasXP (xp/site) on Netlify
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
