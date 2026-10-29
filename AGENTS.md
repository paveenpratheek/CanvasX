# File Fabric

## What it is

File Fabric (the "Spatial File Manager") is an infinite pan-and-zoom canvas,
a "fabric", for organising real files spatially. You drop files onto it, draw
areas, shapes and ink around them, write text and notes, and build dashboards
from progress bars, clocks, calendars, tables, scroll boxes, books, folders and
totems.

A workspace is a folder on disk, and each fabric is a sub-folder holding its
saved state, a thumbnail and copies of the files dropped into it. It is a
no-build PWA that runs only in Chromium (Chrome or Edge), because it needs the
File System Access API.

## Rules

- **Never delete a feature without the owner's explicit approval.** A previous
  agent removed Mission Control without asking; that must not happen again.
  Code left behind as `// REMOVED` by an earlier agent is a bug: restore it.
- **History is never erased.** A removed, changed or renamed feature is marked
  as `[REMOVED on YYYY-MM-DD]`, `[CHANGED on YYYY-MM-DD]: old → new` or
  `[RENAMED on YYYY-MM-DD]: old → new`, and the old description stays.
- **The files in `knowledge/` are append-only.** Add entries; never delete or
  rewrite past ones. Each file's own guidelines, at its top, say how.
- **Dates are written `YYYY-MM-DD`.**
- **No build step, no framework.** It stays plain files served as they are.
- The app is served on **port 9075**.

## Criteria

A change is done when, served on localhost (port 9075) in Chrome or Edge:

- a workspace folder opens, and a fabric can be created and opened;
- the changed tool works as asked, with no errors in the console;
- the fabric saves to disk within about half a second of an edit and reloads
  exactly as it was left;
- every feature that existed before still exists. Check `knowledge/` for what
  should be there.

There are no automated tests. Verify by running the app.

## GitX

GitX knows this project's code: a map of its features and the code each one
owns, known bugs, the commits that wrote the code and why, and the decisions,
rejected ideas and open questions behind them. Ask GitX; do not work it out
from scratch.

- This folder is its own git repository. Pass it as `cwd` to every GitX tool.
  (CanvasX began as a copy of File Fabric, `E:/antigravity V1/file-fabric`,
  which is a different repository with its own history.)
- **Do not read `GitX.md` or any `.gitx` folder directly.** Ask GitX's tools.
  They hand out the part a task needs, checked against the code as it is now,
  and mark what has gone stale. The raw files are neither.

The workflow:

1. **Start:** `gitx_thought_catch_up` picks up where the last session stopped.
2. **Before working something out:** `gitx_search` in your own words, one part
   of the task at a time. Before building, check the plan against it. A
   decision on record that the owner made is the owner's to change: ask.
3. **As things are decided:** `gitx_thought_record` with the decision, the
   alternatives it beat, and the reason. Cite only the ids it returns.
4. **Commit:** stage, run `gitx_find_related`, and end the message with one
   trailer block as its last paragraph: `GitX-Builds-On` (or `GitX-Root` for
   genuinely new work), then `GitX-Thoughts` with the ids the commit carries
   out.
