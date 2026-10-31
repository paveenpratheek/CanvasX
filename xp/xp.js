/* CanvasXP: CanvasX on a phone (t-66914c8b0f), and its side of the USB sync
 * with NoteX on the PC (t-3d7b88b6a1; NoteX t-71306596ff, t-76fdccd60b).
 *
 * Loaded after script.js, only in CanvasXP's page; it changes CanvasX by
 * wrapping a few of its functions, so script.js stays the same in both.
 *
 * Everything it keeps is in _canvasxp/ inside the target folder:
 *   device.json    written by Set up USB sync: this phone's id and name;
 *   manifest.json  every file of every canvas with its SHA-256, refreshed
 *                  after each save - NoteX reads it to see what changed - and
 *                  the batches taken in;
 *   incoming/<id>/ what NoteX leaves: files/<canvas>/<path>, then
 *                  changes.json. A batch is taken in only once every file's
 *                  hash checks, so a cable pulled mid-copy changes nothing.
 * NoteX never replaces or deletes anything here; this page does, because
 * over File transfer Windows asks before either.
 */
(() => {
    'use strict';
    const XP = '_canvasxp';
    const LOCK = '.fabric_lock';
    const KEEP_APPLIED = 200;
    const BAD_SEG = /[\\/:*?"<>|\x00-\x1f]/;
    const safeSeg = (s) => typeof s === 'string' && s.length > 0 && s.length <= 200 && s !== '.' && s !== '..' && !BAD_SEG.test(s) && !/[. ]$/.test(s);
    const safeCanvas = (s) => safeSeg(s) && !s.startsWith('.') && s !== XP;
    const safeRel = (r) => typeof r === 'string' && r.split('/').every(safeSeg);
    // Chrome writes through a .crswap file beside the real one; it is never a canvas's own.
    const skipFile = (name) => name === LOCK || name.endsWith('.crswap');

    // No NoteX on the phone: talking to the agent happens on the PC.
    startAgentChat = function () {};

    /* ------------------------------------------------------------ helpers */

    let chain = Promise.resolve();
    const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

    async function xpDir(create = false) {
        if (!targetWorkspaceHandle) return null;
        try { return await targetWorkspaceHandle.getDirectoryHandle(XP, { create }); } catch { return null; }
    }
    async function readJson(dir, name) {
        try { return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text()); } catch { return null; }
    }
    async function writeBlob(dir, name, data) {
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(data);
        await w.close();
    }
    const writeJson = (dir, name, obj) => writeBlob(dir, name, JSON.stringify(obj, null, 2));
    async function sha256(blob) {
        const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    async function dirAt(root, segs, create = false) {
        let d = root;
        for (const s of segs) d = await d.getDirectoryHandle(s, { create });
        return d;
    }
    async function fileAt(root, segs) {
        try { return await (await (await dirAt(root, segs.slice(0, -1))).getFileHandle(segs[segs.length - 1])).getFile(); } catch { return null; }
    }
    async function walk(dir, prefix, fn) {
        for await (const e of dir.values()) {
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.kind === 'directory') await walk(e, rel, fn);
            else if (!skipFile(e.name)) await fn(rel, await e.getFile());
        }
    }
    async function copyDir(from, to) {
        for await (const e of from.values()) {
            if (e.kind === 'directory') await copyDir(e, await to.getDirectoryHandle(e.name, { create: true }));
            else if (!skipFile(e.name)) await writeBlob(to, e.name, await e.getFile());
        }
    }
    async function exists(name) {
        try { await targetWorkspaceHandle.getDirectoryHandle(name); return true; } catch { return false; }
    }
    async function phoneName(base) {
        for (let i = 1; ; i++) {
            const n = i === 1 ? `${base} (phone)` : `${base} (phone ${i})`;
            if (!(await exists(n))) return n;
        }
    }

    /* ----------------------------------------------------------- manifest */

    let manifestTimer = null;
    function scheduleManifest(ms = 1500) {
        clearTimeout(manifestTimer);
        manifestTimer = setTimeout(() => serial(refreshManifest), ms);
    }

    /* Every canvas's files with their hashes; a file whose size and date are
     * unchanged keeps the hash it had, so photos are not read again. */
    async function refreshManifest() {
        const dir = await xpDir();
        if (!dir || !(await readJson(dir, 'device.json'))) return;
        const prev = (await readJson(dir, 'manifest.json')) || {};
        const canvases = {};
        for await (const e of targetWorkspaceHandle.values()) {
            if (e.kind !== 'directory' || !safeCanvas(e.name)) continue;
            try { await e.getFileHandle('fabric.json'); } catch { continue; }
            const old = (prev.canvases && prev.canvases[e.name] && prev.canvases[e.name].files) || {};
            const files = {};
            await walk(e, '', async (rel, file) => {
                const o = old[rel];
                files[rel] = o && o.size === file.size && o.mtime === file.lastModified ? o : { size: file.size, mtime: file.lastModified, sha: await sha256(file) };
            });
            canvases[e.name] = { files };
        }
        await writeJson(dir, 'manifest.json', { app: 'CanvasXP', at: new Date().toISOString(), canvases, applied: prev.applied || [], lastSync: prev.lastSync || null, keptAside: prev.keptAside || [] });
    }

    /* ----------------------------------------------------- taking batches in */

    async function waitingBatches() {
        const dir = await xpDir();
        if (!dir) return [];
        let inc;
        try { inc = await dir.getDirectoryHandle('incoming'); } catch { return []; }
        const ids = [];
        for await (const e of inc.values()) if (e.kind === 'directory') ids.push(e.name);
        return ids.sort();
    }

    /* Every batch NoteX left, oldest first. One still being copied - no
     * changes.json yet, or a file not whole - stops the rest, which may
     * build on it. */
    async function takeIn() {
        const dir = await xpDir();
        if (!dir) return { taken: 0, aside: [] };
        const ids = await waitingBatches();
        if (!ids.length) return { taken: 0, aside: [] };
        const inc = await dir.getDirectoryHandle('incoming');
        const manifest = (await readJson(dir, 'manifest.json')) || {};
        manifest.applied = manifest.applied || [];
        let taken = 0;
        const aside = [];
        for (const id of ids) {
            if (!manifest.applied.includes(id)) {
                const b = await inc.getDirectoryHandle(id);
                const ch = await readJson(b, 'changes.json');
                if (!ch || !Array.isArray(ch.ops)) break;
                let whole = true;
                for (const op of ch.ops) {
                    if (op.op !== 'put') continue;
                    if (!safeCanvas(op.canvas) || !safeRel(op.path)) { whole = false; break; }
                    const f = await fileAt(b, ['files', op.canvas, ...op.path.split('/')]);
                    if (!f || (await sha256(f)) !== op.sha) { whole = false; break; }
                }
                if (!whole) break;
                aside.push(...(await applyOps(b, ch.ops)));
                manifest.applied = [...manifest.applied, id].slice(-KEEP_APPLIED);
                manifest.lastSync = { at: ch.at || new Date().toISOString(), from: ch.from || 'the PC' };
                if (aside.length) manifest.keptAside = [...(manifest.keptAside || []), ...aside].slice(-20);
                await writeJson(dir, 'manifest.json', manifest); // taken in, before the batch goes
                taken++;
            }
            try { await inc.removeEntry(id, { recursive: true }); } catch (e) { console.warn('Could not remove batch', id, e); }
        }
        if (taken) await refreshManifest();
        return { taken, aside };
    }

    /* One batch's changes. A canvas changed here since NoteX last saw it -
     * a file not what NoteX thought - is copied aside as "Name (phone)"
     * before the PC's version is written, so nothing made here is lost. */
    async function applyOps(batch, ops) {
        const aside = [];
        const checked = new Set();
        const keepAside = async (canvas) => {
            if (checked.has(canvas)) return;
            checked.add(canvas);
            if (!(await exists(canvas))) return;
            let changed = false;
            for (const op of ops) {
                if ((op.op !== 'put' && op.op !== 'del') || op.canvas !== canvas || !safeRel(op.path)) continue;
                const f = await fileAt(targetWorkspaceHandle, [canvas, ...op.path.split('/')]);
                const now = f ? await sha256(f) : null;
                if (now !== (op.was || null)) { changed = true; break; }
            }
            if (!changed) return;
            const to = await phoneName(canvas);
            await copyDir(await targetWorkspaceHandle.getDirectoryHandle(canvas), await targetWorkspaceHandle.getDirectoryHandle(to, { create: true }));
            aside.push({ name: canvas, copy: to });
        };
        for (const op of ops) {
            if (!safeCanvas(op.canvas)) continue;
            if (op.op === 'copy') {
                if (!safeCanvas(op.to) || !(await exists(op.canvas)) || (await exists(op.to))) continue;
                checked.add(op.canvas); // NoteX already set the phone's version aside
                await copyDir(await targetWorkspaceHandle.getDirectoryHandle(op.canvas), await targetWorkspaceHandle.getDirectoryHandle(op.to, { create: true }));
            } else if (op.op === 'put') {
                if (!safeRel(op.path)) continue;
                await keepAside(op.canvas);
                const segs = op.path.split('/');
                const f = await fileAt(batch, ['files', op.canvas, ...segs]);
                const d = await dirAt(targetWorkspaceHandle, [op.canvas, ...segs.slice(0, -1)], true);
                await writeBlob(d, segs[segs.length - 1], f);
            } else if (op.op === 'del') {
                if (!safeRel(op.path)) continue;
                await keepAside(op.canvas);
                const segs = op.path.split('/');
                try { await (await dirAt(targetWorkspaceHandle, [op.canvas, ...segs.slice(0, -1)])).removeEntry(segs[segs.length - 1]); } catch { /* already gone */ }
            } else if (op.op === 'drop') {
                // Deleted on the PC: gone here too, unless it changed here since.
                if (!(await exists(op.canvas))) continue;
                const now = {};
                await walk(await targetWorkspaceHandle.getDirectoryHandle(op.canvas), '', async (rel, file) => { now[rel] = await sha256(file); });
                const was = op.files || {};
                const same = Object.keys(now).length === Object.keys(was).length && Object.keys(now).every((k) => now[k] === was[k]);
                if (same) await targetWorkspaceHandle.removeEntry(op.canvas, { recursive: true });
            }
        }
        return aside;
    }

    /* ------------------------------------------------------- the home screen */

    const panel = document.createElement('div');
    panel.id = 'xp-sync';
    panel.className = 'xp-sync hidden';
    panel.innerHTML = '<div class="xp-sync-text"><strong>USB sync</strong> <span id="xp-sync-state"></span></div><button id="xp-setup" class="home-btn">Set up USB sync</button>';
    const header = document.querySelector('#workspace-content .workspace-header');
    header.parentNode.insertBefore(panel, header.nextSibling);
    const stateEl = panel.querySelector('#xp-sync-state');
    const setupBtn = panel.querySelector('#xp-setup');

    const when = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

    async function showState(note) {
        const dir = await xpDir();
        const dev = dir && (await readJson(dir, 'device.json'));
        panel.classList.remove('hidden');
        setupBtn.hidden = Boolean(dev);
        if (!dev) {
            stateEl.textContent = 'Not set up. Set it up, then plug the phone into the PC and pick this folder in NoteX.';
            return;
        }
        const m = (await readJson(dir, 'manifest.json')) || {};
        const waiting = (await waitingBatches()).length;
        const parts = [`This phone is "${dev.name}".`];
        parts.push(m.lastSync ? `Last synced with ${m.lastSync.from} on ${when(m.lastSync.at)}.` : `Not synced yet - plug the phone into the PC, pick File transfer, and in NoteX open Phone and choose the folder "${targetWorkspaceHandle.name}".`);
        if (waiting) parts.push(`${waiting} change${waiting === 1 ? '' : 's'} from the PC still copying.`);
        if (note) parts.push(note);
        stateEl.textContent = parts.join(' ');
    }

    setupBtn.addEventListener('click', async () => {
        if (!targetWorkspaceHandle) { alert('Open your target folder first.'); return; }
        const name = (prompt('A name for this phone, shown in NoteX on the PC:', 'My phone') || '').trim();
        if (!name) return;
        const dir = await xpDir(true);
        const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
        await writeJson(dir, 'device.json', { id, name, app: 'CanvasXP', createdAt: new Date().toISOString() });
        await serial(refreshManifest);
        await showState();
    });

    async function onHome() {
        if (!targetWorkspaceHandle) return;
        const r = await serial(takeIn);
        if (r.taken) await loadFabricsGrid();
        const note = r.aside.length ? `Kept your own changes beside the PC's: ${r.aside.map((a) => `"${a.copy}"`).join(', ')}.` : '';
        await showState(note);
        scheduleManifest(0);
    }

    /* ------------------------------------------------- wrapping CanvasX */

    const origInit = initializeWorkspace;
    initializeWorkspace = async function () {
        await origInit.apply(this, arguments);
        await onHome();
    };
    const origWrite = writeFabric;
    writeFabric = async function () {
        const r = await origWrite.apply(this, arguments);
        scheduleManifest();
        return r;
    };
    const origCopy = copyFileToFolder;
    copyFileToFolder = async function () {
        const r = await origCopy.apply(this, arguments);
        scheduleManifest();
        return r;
    };
    // The grid is drawn again after a canvas is made, renamed or deleted.
    const origGrid = loadFabricsGrid;
    loadFabricsGrid = async function () {
        const r = await origGrid.apply(this, arguments);
        scheduleManifest();
        return r;
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden && targetWorkspaceHandle) { clearTimeout(manifestTimer); serial(refreshManifest); } });

    // While the home screen shows, a batch NoteX just copied in is taken in.
    setInterval(async () => {
        if (!targetWorkspaceHandle || homeScreen.classList.contains('hidden') || document.hidden) return;
        if ((await waitingBatches()).length) onHome();
    }, 10000);
    document.getElementById('btn-home').addEventListener('click', () => setTimeout(onHome, 800));
})();
