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
 *   incoming/<id>/ what NoteX leaves: files/<canvas>/<path>, chats/ (an
 *                  agent canvas's conversation), then changes.json. A batch
 *                  is taken in only once every file's hash checks, so a
 *                  cable pulled mid-copy changes nothing;
 *   chats/         each agent canvas's conversation, as NoteX last sent it;
 *   status/        NoteX's steps while it syncs, shown in a popup
 *                  (t-8cbbaa2aad; NoteX t-2ff7b152e9).
 * and, where the user can read them, Queued messages/: each message to the
 * agent written here while away from the PC, answered at the next sync
 * (t-0b4e61bf2b).
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

    /* ------------------------------------------------------------ helpers */

    let chain = Promise.resolve();
    const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

    /* _canvasxp/ is the real folder's own (store.js leaves it out of the working copy), and each
     * step to it costs about a second on a phone (t-6beedb06b4): its handle is kept once found,
     * and device.json and the agent chats - which only Set up and a take-in change - are read
     * once and kept until then. */
    let xpHandle = null, xpFor = null;
    const memo = new Map();
    let savingNow = null; // the working copy's queue to the folder, as store.js last told it
    async function xpDir(create = false) {
        if (!targetWorkspaceHandle) return null;
        if (xpHandle && xpFor === targetWorkspaceHandle) return xpHandle;
        try {
            xpHandle = await targetWorkspaceHandle.getDirectoryHandle(XP, { create });
            xpFor = targetWorkspaceHandle;
            return xpHandle;
        } catch { return null; }
    }
    async function remembered(key, read) {
        if (!memo.has(key)) memo.set(key, await read());
        return memo.get(key);
    }
    async function deviceOf() {
        const dir = await xpDir();
        if (!dir) return null; // not set up: asked again next time, not remembered
        return remembered('device', () => readJson(dir, 'device.json'));
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

    // Stroke icons for the phone layout (t-1c580a5971).
    const svg = (d, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const ICONS = {
        usb: '<path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M6 13v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="20" r="1.5"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        back: '<path d="M15 18l-6-6 6-6"/>',
        more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        up: '<path d="M6 15l6-6 6 6"/>',
        down: '<path d="M6 9l6 6 6-6"/>',
        pc: '<rect x="2" y="4" width="14" height="10" rx="2"/><path d="M6 18h6"/><path d="M9 14v4"/><rect x="18" y="8" width="4" height="10" rx="1"/>',
        robot: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
        chevron: '<path d="M9 6l6 6-6 6"/>',
    };

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
        if (!dir || !(await deviceOf())) return;
        // Read from the working copy, so it must say what the folder holds: once every write is there (t-35a415fa01).
        // While the folder refuses one, nothing is claimed; tried again later.
        if (!(await XPStore.idle(targetWorkspaceHandle))) { scheduleManifest(30000); return; }
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

    /* Folder handles opened once per take-in: on an Android phone every step
     * through the browser's folder access costs about a second (t-8706c0507c). */
    function handles(root) {
        const m = new Map();
        return async (segs, create = false) => {
            let d = root, k = '';
            for (const s of segs) {
                k += '/' + s;
                let h = m.get(k);
                if (!h) { h = await d.getDirectoryHandle(s, { create }); m.set(k, h); }
                d = h;
            }
            return d;
        };
    }
    async function fileIn(dirOf, segs) {
        try { return await (await (await dirOf(segs.slice(0, -1))).getFileHandle(segs[segs.length - 1])).getFile(); } catch { return null; }
    }
    const hexOf = async (buf) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (x) => x.toString(16).padStart(2, '0')).join('');
    const KEEP_BYTES = 64 * 1024 * 1024; // read once to check, kept to write

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
     * build on it; waiting then names what it waits for, and progress(text)
     * hears how far it has got (t-bae0747ece). */
    const noProgress = () => {};
    async function takeIn(progress = noProgress) {
        const dir = await xpDir();
        if (!dir) return { taken: 0, aside: [] };
        const ids = await waitingBatches();
        if (!ids.length) return { taken: 0, aside: [] };
        let waiting = null;
        const inc = await dir.getDirectoryHandle('incoming');
        const manifest = (await readJson(dir, 'manifest.json')) || {};
        manifest.applied = manifest.applied || [];
        let taken = 0;
        const aside = [];
        for (const id of ids) {
            if (!manifest.applied.includes(id)) {
                const b = await inc.getDirectoryHandle(id);
                const ch = await readJson(b, 'changes.json');
                if (!ch || !Array.isArray(ch.ops)) { waiting = 'the list of changes (changes.json) still copying'; break; }
                const puts = ch.ops.filter((o) => o.op === 'put').length;
                const inBatch = handles(b);
                const bytes = new Map();
                let kept = 0;
                let checked = 0;
                for (const op of ch.ops) {
                    if (op.op === 'chat') {
                        const f = safeCanvas(op.canvas) && (await fileAt(b, ['chats', `${op.canvas}.json`]));
                        if (!f) { waiting = `"${op.canvas}"'s chat still copying`; break; }
                        if ((await sha256(f)) !== op.sha) { waiting = `"${op.canvas}"'s chat not yet what NoteX sent`; break; }
                        continue;
                    }
                    if (op.op !== 'put') continue;
                    if (!safeCanvas(op.canvas) || !safeRel(op.path)) { waiting = `a file CanvasXP cannot name: ${op.canvas}/${op.path}`; break; }
                    const f = await fileIn(inBatch, ['files', op.canvas, ...op.path.split('/')]);
                    if (!f) { waiting = `${op.canvas}/${op.path} still copying`; break; }
                    const buf = await f.arrayBuffer();
                    if ((await hexOf(buf)) !== op.sha) { waiting = `${op.canvas}/${op.path} not yet what NoteX sent`; break; }
                    if (kept + buf.byteLength <= KEEP_BYTES) { bytes.set(`${op.canvas}/${op.path}`, new Blob([buf])); kept += buf.byteLength; }
                    if (++checked % 5 === 0) progress(`Checking the PC's changes: ${checked} of ${puts} files`);
                }
                if (waiting) break;
                const known = new Map();
                aside.push(...(await applyOps(b, ch.ops, progress, { inBatch, bytes, known })));
                // What was written or found in place goes into the manifest, so it is not read again.
                manifest.canvases = manifest.canvases || {};
                for (const [key, info] of known) {
                    const i = key.indexOf('/');
                    const c = (manifest.canvases[key.slice(0, i)] ||= { files: {} });
                    (c.files ||= {})[key.slice(i + 1)] = info;
                }
                manifest.applied = [...manifest.applied, id].slice(-KEEP_APPLIED);
                manifest.lastSync = { at: ch.at || new Date().toISOString(), from: ch.from || 'the PC' };
                if (aside.length) manifest.keptAside = [...(manifest.keptAside || []), ...aside].slice(-20);
                await writeJson(dir, 'manifest.json', manifest); // taken in, before the batch goes
                taken++;
            }
            try { await removeFolder(inc, id); } catch (e) { console.warn('Could not remove batch', id, e); } // t-7b1443b8ce
        }
        if (taken) { memo.clear(); await refreshManifest(); } // a batch may bring new chats
        return { taken, aside, waiting };
    }

    /* One batch's changes. A canvas changed here since NoteX last saw it -
     * a file not what NoteX thought - is copied aside as "Name (phone)"
     * before the PC's version is written, so nothing made here is lost. */
    async function applyOps(batch, ops, progress = noProgress, { inBatch = handles(batch), bytes = new Map(), known = new Map() } = {}) {
        const aside = [];
        const checked = new Set();
        const inTarget = handles(targetWorkspaceHandle);
        const current = new Map(); // canvas/path -> { sha, file } of what is in place now
        const keepAside = async (canvas) => {
            if (checked.has(canvas)) return;
            checked.add(canvas);
            if (!(await exists(canvas))) return;
            let changed = false;
            for (const op of ops) {
                if ((op.op !== 'put' && op.op !== 'del') || op.canvas !== canvas || !safeRel(op.path)) continue;
                const f = await fileIn(inTarget, [canvas, ...op.path.split('/')]);
                const now = f ? await hexOf(await f.arrayBuffer()) : null;
                current.set(`${canvas}/${op.path}`, { sha: now, file: f });
                // Already what the PC sends - a take-in cut off before it finished - is no change made here (t-8706c0507c).
                if (now === (op.was || null) || (op.op === 'put' ? now === op.sha : now === null)) continue;
                changed = true;
                break;
            }
            if (!changed) return;
            const to = await phoneName(canvas);
            await copyDir(await targetWorkspaceHandle.getDirectoryHandle(canvas), await targetWorkspaceHandle.getDirectoryHandle(to, { create: true }));
            aside.push({ name: canvas, copy: to });
        };
        const xp = await xpDir(true);
        const total = ops.filter((o) => o.op === 'put').length;
        let done = 0;
        for (const op of ops) {
            try { await one(op); } catch (e) {
                // Which file it was, in the browser's own words (t-bae0747ece).
                const err = new Error(`${[op.canvas, op.path].filter(Boolean).join('/') || op.op}: ${e && e.name ? `${e.name} - ${e.message}` : e}`);
                err.name = 'TakeInError';
                throw err;
            }
            if (op.op === 'put' && ++done % 5 === 0) progress(`Bringing in the PC's changes: ${done} of ${total} files`);
        }
        return aside;

        async function one(op) {
            // Queued messages: what the agent answered goes; what NoteX could not hand it keeps the
            // reason beside it. Only the message NoteX named - a folder of that name now holding
            // another message is left alone.
            if (op.op === 'answered' || op.op === 'unanswered') {
                let box = null;
                try { box = await targetWorkspaceHandle.getDirectoryHandle(QUEUE); } catch { return; }
                for (const it of op.op === 'answered' ? op.items || [] : [op]) {
                    if (!safeSeg(it.dir)) continue;
                    let d;
                    try { d = await box.getDirectoryHandle(it.dir); } catch { continue; }
                    const q = parseQueued(await readText(d, MESSAGE));
                    if (!q || q.meta.id !== it.id) continue;
                    if (op.op === 'answered') { try { await removeFolder(box, it.dir); } catch { /* already gone */ } }
                    else await writeBlob(d, NOT_ANSWERED, String(op.error || 'Not answered.'));
                }
                return;
            }
            if (!safeCanvas(op.canvas)) return;
            if (op.op === 'chat') {
                const f = await fileAt(batch, ['chats', `${op.canvas}.json`]);
                if (f) await writeBlob(await dirAt(xp, ['chats'], true), `${op.canvas}.json`, f);
            } else if (op.op === 'copy') {
                if (!safeCanvas(op.to) || !(await exists(op.canvas)) || (await exists(op.to))) return;
                checked.add(op.canvas); // NoteX already set the phone's version aside
                await copyDir(await targetWorkspaceHandle.getDirectoryHandle(op.canvas), await targetWorkspaceHandle.getDirectoryHandle(op.to, { create: true }));
            } else if (op.op === 'put') {
                if (!safeRel(op.path)) return;
                await keepAside(op.canvas);
                const key = `${op.canvas}/${op.path}`;
                const segs = op.path.split('/');
                const here = current.get(key);
                if (here && here.sha === op.sha) { known.set(key, { size: here.file.size, mtime: here.file.lastModified, sha: op.sha }); return; } // already in place
                const blob = bytes.get(key) || (await fileIn(inBatch, ['files', op.canvas, ...segs]));
                const d = await inTarget([op.canvas, ...segs.slice(0, -1)], true);
                await writeBlob(d, segs[segs.length - 1], blob);
                try { const w = await (await d.getFileHandle(segs[segs.length - 1])).getFile(); known.set(key, { size: w.size, mtime: w.lastModified, sha: op.sha }); } catch { /* read again by the manifest */ }
            } else if (op.op === 'del') {
                if (!safeRel(op.path)) return;
                await keepAside(op.canvas);
                const segs = op.path.split('/');
                try { await (await inTarget([op.canvas, ...segs.slice(0, -1)])).removeEntry(segs[segs.length - 1]); } catch { /* already gone */ }
            } else if (op.op === 'drop') {
                // Deleted on the PC: gone here too, unless it changed here since.
                if (!(await exists(op.canvas))) return;
                const now = {};
                await walk(await targetWorkspaceHandle.getDirectoryHandle(op.canvas), '', async (rel, file) => { now[rel] = await sha256(file); });
                const was = op.files || {};
                const same = Object.keys(now).length === Object.keys(was).length && Object.keys(now).every((k) => now[k] === was[k]);
                if (same) await removeFolder(targetWorkspaceHandle, op.canvas);
            }
        }
    }

    /* ------------------------------------------------------- the home screen */

    const panel = document.createElement('div');
    panel.id = 'xp-sync';
    panel.className = 'xp-sync hidden';
    panel.innerHTML = `<span class="xp-sync-icon">${svg(ICONS.usb, 18)}</span><div class="xp-sync-text"><strong id="xp-sync-title">USB sync</strong> <span id="xp-sync-state"></span> <span id="xp-save-state"></span></div><div class="xp-sync-progress" hidden><span></span></div><button id="xp-setup" class="home-btn">Set up USB sync</button>`;
    const header = document.querySelector('#workspace-content .workspace-header');
    header.parentNode.insertBefore(panel, header.nextSibling);
    const stateEl = panel.querySelector('#xp-sync-state');
    const setupBtn = panel.querySelector('#xp-setup');
    const titleEl = panel.querySelector('#xp-sync-title');
    const progressEl = panel.querySelector('.xp-sync-progress');
    // "n of N" in a step's text fills the card's bar (t-1c580a5971).
    const showProgress = (text) => {
        const m = /(\d+) of (\d+)/.exec(text || '');
        progressEl.hidden = !m;
        if (m) progressEl.firstElementChild.style.width = `${Math.max(3, Math.round((100 * Number(m[1])) / Math.max(1, Number(m[2]))))}%`;
    };

    const when = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

    async function showState(note) {
        const dir = await xpDir();
        const dev = dir && (await deviceOf());
        panel.classList.remove('hidden');
        setupBtn.hidden = Boolean(dev);
        showProgress(null);
        titleEl.textContent = dev ? `USB sync · ${dev.name}` : 'USB sync';
        if (!dev) {
            stateEl.textContent = 'Not set up. Set it up, then plug the phone into the PC and pick this folder in NoteX.';
            return;
        }
        const m = (await readJson(dir, 'manifest.json')) || {};
        const waiting = (await waitingBatches()).length;
        const parts = []; // the phone's name is in the card's title
        parts.push(m.lastSync ? `Last synced with ${m.lastSync.from} on ${when(m.lastSync.at)}.` : `Not synced yet - plug the phone into the PC, pick File transfer, and in NoteX open Phone and choose the folder "${targetWorkspaceHandle.name}".`);
        if (waiting) parts.push(`${waiting} change${waiting === 1 ? '' : 's'} from the PC still copying.`);
        const asks = (await queued()).length;
        if (asks) parts.push(`${asks} message${asks === 1 ? '' : 's'} to the agent ${asks === 1 ? 'waits' : 'wait'} for the PC.`);
        if (note) parts.push(note);
        stateEl.textContent = parts.join(' ');
    }

    setupBtn.addEventListener('click', async () => {
        if (!targetWorkspaceHandle) { alert('Open your target folder first.'); return; }
        // Every step says how it went: a failure here once left nothing on screen (t-2214f3ca16).
        const fail = (step, e) => {
            const why = `${step}: ${e && e.name ? `${e.name} - ${e.message}` : e}`;
            stateEl.textContent = `Set up failed. ${why}`;
            alert(`Set up USB sync failed.\n\n${why}`);
        };
        const folder = targetWorkspaceHandle;
        // Write access first, while the tap still counts as one: it is gone once the name prompt has been open a while.
        try {
            let perm = folder.queryPermission ? await folder.queryPermission({ mode: 'readwrite' }) : 'granted';
            if (perm !== 'granted' && folder.requestPermission) perm = await folder.requestPermission({ mode: 'readwrite' });
            if (perm !== 'granted') { fail('Write access', `CanvasXP may only read "${folder.name}". Allow editing when the browser asks, or open the folder again from the home screen.`); return; }
        } catch (e) { fail('Write access', e); return; }
        const name = (prompt('A name for this phone, shown in NoteX on the PC:', 'My phone') || '').trim();
        if (!name) return;
        setupBtn.disabled = true;
        stateEl.textContent = 'Setting up…';
        try {
            let dir;
            try { dir = await folder.getDirectoryHandle(XP, { create: true }); } catch (e) { fail(`Making the ${XP} folder in "${folder.name}"`, e); return; }
            const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
            try { await writeJson(dir, 'device.json', { id, name, app: 'CanvasXP', createdAt: new Date().toISOString() }); } catch (e) { fail('Writing device.json', e); return; }
            memo.clear();
            const back = await readJson(dir, 'device.json');
            if (!back || back.id !== id) { fail('Reading device.json back', 'it was written but does not read back the same.'); return; }
            try { await serial(refreshManifest); } catch (e) { fail('Writing manifest.json', e); return; }
            await showState(`Set up: "${folder.name}" now holds ${XP}/device.json and manifest.json.`);
        } finally { setupBtn.disabled = false; }
    });

    /* The PC's changes taken in, saying on the USB sync bar how far it has got,
     * what it still waits for, or what went wrong (t-bae0747ece). */
    let takingIn = false;
    async function takeInShown() {
        const show = (text) => { panel.classList.remove('hidden'); stateEl.textContent = text; showProgress(text); };
        takingIn = true;
        try {
            const r = await serial(() => takeIn(show));
            return { ...r, error: null };
        } catch (e) {
            console.warn('Taking in the PC\'s changes failed', e);
            return { taken: 0, aside: [], waiting: null, error: `${e && e.name ? `${e.name} - ${e.message}` : e}` };
        } finally { takingIn = false; }
    }
    const takeInNote = (r) => r.error ? `Could not bring in the PC's changes: ${r.error}`
        : r.waiting ? `The PC's changes are not all here yet - waiting for ${r.waiting}.`
            : r.aside.length ? `Kept your own changes beside the PC's: ${r.aside.map((a) => `"${a.copy}"`).join(', ')}.` : '';

    async function onHome() {
        if (!targetWorkspaceHandle || takingIn) return;
        const r = await takeInShown();
        if (r.taken) await loadFabricsGrid();
        await showState(takeInNote(r));
        scheduleManifest(0);
    }

    /* ------------------------------------- the agent chat, queued for the PC */

    /* On an agent canvas the chat shows the conversation NoteX last sent and,
     * after it, the messages waiting for the PC (t-3e75a404cf). Each is kept
     * where the user can read it (t-0b4e61bf2b): Queued messages/<canvas> -
     * <date time>/ in the target folder, its attachments first and message.md
     * last - canvas, Description, Prompt, the attachments, and a closing
     * comment with its id and each file's hash - so NoteX never takes half a
     * message. NoteX answers it at the next USB sync (NoteX t-e4196083e7,
     * t-957b09f2fe), and reads the words from the headings, so an edit to
     * message.md before then counts. */
    const QUEUE = 'Queued messages';
    const MESSAGE = 'message.md';
    const NOT_ANSWERED = 'Not answered.txt';
    const MAX_TEXT = 4000;
    const MODELS = ['sonnet', 'opus', 'haiku', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low']; // as NoteX offers them (t-078d8f1fd2)
    let syncing = null; // NoteX's latest step while a sync runs

    async function chatOf(name) {
        const dir = await xpDir();
        if (!dir) return null;
        return remembered(`chat:${name}`, async () => { try { return await readJson(await dir.getDirectoryHandle('chats'), `${name}.json`); } catch { return null; } });
    }

    async function readText(dir, name) {
        try { return await (await (await dir.getFileHandle(name)).getFile()).text(); } catch { return null; }
    }

    // message.md: headings to read, and the comment NoteX needs (as NoteX's parseQueued reads it).
    function parseQueued(md) {
        const m = /<!--\s*CanvasXP\s+(\{[\s\S]*?\})\s*-->/.exec(String(md || ''));
        if (!m) return null;
        let meta;
        try { meta = JSON.parse(m[1]); } catch { return null; }
        const body = String(md).slice(0, m.index);
        const section = (h) => {
            const s = new RegExp(`^##\\s+${h}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'm').exec(body);
            const t = s ? s[1].trim() : '';
            return t === '(none)' ? '' : t;
        };
        return { meta, description: section('Description'), prompt: section('Prompt') };
    }

    const pad = (n) => String(n).padStart(2, '0');
    const stampOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`;

    function messageMd({ id, canvas, model, at, description, prompt, files }) {
        const d = new Date(at);
        return [
            '# Queued message', '',
            `Canvas: ${canvas}`,
            `Queued: ${stampOf(d).replace('.', ':')}`,
            `Model: ${MODEL_NAMES[model] || model || 'Sonnet'}`, '',
            '## Description', '', description || '(none)', '',
            '## Prompt', '', prompt || '(none)', '',
            '## Attachments', '', files.length ? files.map((f) => `- ${f.name}`).join('\n') : '(none)', '',
            `<!-- CanvasXP ${JSON.stringify({ id, canvas, model, at, files })} -->`, '',
        ].join('\n');
    }

    // The messages waiting for the PC - for one canvas, or all - oldest first.
    async function queued(name = null) {
        let box;
        try { box = await targetWorkspaceHandle.getDirectoryHandle(QUEUE); } catch { return []; }
        const out = [];
        for await (const e of box.values()) {
            if (e.kind !== 'directory') continue;
            const q = parseQueued(await readText(e, MESSAGE));
            if (!q || (name && q.meta.canvas !== name)) continue;
            const err = await readText(e, NOT_ANSWERED);
            out.push({ ...q.meta, dir: e.name, description: q.description, prompt: q.prompt, files: Array.isArray(q.meta.files) ? q.meta.files : [], error: err && err.trim() });
        }
        return out.sort((a, b) => String(a.at).localeCompare(String(b.at)) || a.dir.localeCompare(b.dir));
    }

    // A name NoteX can keep on Windows, not taken by another file of the message nor by message.md.
    function fileName(name, used) {
        let base = String(name || 'image').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 120) || 'file';
        const dot = base.lastIndexOf('.');
        const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
        for (let i = 2; used.has(base.toLowerCase()); i++) base = `${stem} (${i})${ext}`;
        used.add(base.toLowerCase());
        return base;
    }

    // A folder of its own in Queued messages: "<canvas> - <date time>", "(2)" when taken.
    async function newQueueDir(canvas, at) {
        const box = await targetWorkspaceHandle.getDirectoryHandle(QUEUE, { create: true });
        const base = `${canvas} - ${stampOf(at)}`;
        for (let i = 1; ; i++) {
            const name = i === 1 ? base : `${base} (${i})`;
            try { await box.getDirectoryHandle(name); } catch { return box.getDirectoryHandle(name, { create: true }); }
        }
    }

    // The phone's chat has two boxes: the Description (what the attachments are) above the Prompt.
    const descBox = document.createElement('textarea');
    descBox.id = 'xp-chat-desc';
    descBox.rows = 2;
    descBox.placeholder = 'Optional';
    descBox.setAttribute('aria-label', 'Description - what the attachments are');
    const promptBox = document.getElementById('agent-chat-text');
    promptBox.parentNode.insertBefore(descBox, promptBox);
    promptBox.placeholder = 'Answered at the next sync with the PC';
    promptBox.setAttribute('aria-label', 'Prompt - what the agent should do');
    // Each box says what it is for, above it (t-1c580a5971).
    const fieldLabel = (box, text) => { const l = document.createElement('label'); l.className = 'xp-field-label'; l.htmlFor = box.id; l.textContent = text; box.before(l); };
    fieldLabel(descBox, 'Description · what the attachments are');
    fieldLabel(promptBox, 'Prompt · what the agent should do');

    async function refreshPhoneChat() {
        const name = currentFabricName;
        if (!agentCanvas || !name || !targetWorkspaceHandle) return;
        const dir = await xpDir();
        const dev = dir && (await deviceOf());
        const r = (dev && (await chatOf(name))) || { name, chat: [], model: 'sonnet', models: MODELS };
        const waiting = dev ? await queued(name) : [];
        if (name !== currentFabricName || !agentCanvas) return;
        // The model the canvas answers with: that of its last message waiting here, else the one NoteX keeps for it.
        const lastWaiting = waiting.length ? waiting[waiting.length - 1].model : null;
        renderAgentChat({ ...r, model: lastWaiting || r.model, models: r.models || MODELS, ask: null });
        const log = document.getElementById('agent-chat-log');
        const empty = log.querySelector('.agent-chat-empty');
        if (empty) {
            if (waiting.length) empty.remove();
            else empty.textContent = 'Write to the agent about this canvas, and attach images from your gallery. Your messages are kept in the folder "Queued messages", and the agent answers them the next time the phone syncs with the PC.';
        }
        for (const m of waiting) {
            const answering = Boolean(syncing && syncing.current === m.id);
            const li = document.createElement('li');
            li.className = `from-user queued${m.error && !answering ? ' bad' : ''}`;
            const who = document.createElement('span');
            who.className = 'who';
            who.textContent = `You · ${answering ? 'the agent is answering…' : m.error ? 'not answered' : 'waiting for the PC'} · ${chatAgo(m.at)}`;
            li.append(who);
            if (m.description) {
                const d = document.createElement('span');
                d.className = 'xp-desc';
                d.textContent = m.description;
                li.append(d);
            }
            li.append(document.createTextNode(m.prompt || ''));
            if (m.files.length) {
                const att = document.createElement('span');
                att.className = 'attached';
                att.textContent = `Attached: ${m.files.map((f) => f.name).join(', ')}`;
                li.append(att);
            }
            if (m.error && !answering) {
                const er = document.createElement('span');
                er.className = 'attached';
                er.textContent = `${m.error} It is tried again at the next sync.`;
                li.append(er);
            }
            if (!syncing) {
                const off = document.createElement('button');
                off.className = 'xp-unqueue';
                off.textContent = 'Remove';
                off.title = 'Take this message back before the PC sees it';
                off.addEventListener('click', async () => {
                    if (!confirm('Take this message back? It is deleted from Queued messages, and the agent will not see it.')) return;
                    try { await removeFolder(await targetWorkspaceHandle.getDirectoryHandle(QUEUE), m.dir); } catch { /* already gone */ }
                    refreshPhoneChat();
                });
                li.append(off);
            }
            log.append(li);
        }
        const count = `${r.chat ? r.chat.length : 0}+${waiting.length}`;
        if (log.dataset.xpCount !== count) log.scrollTop = log.scrollHeight;
        log.dataset.xpCount = count;
        document.getElementById('agent-chat-send').disabled = !dev;
        if (!dev) setChatState('Set up USB sync on the home screen first', true);
        else if (syncing) setChatState('syncing with the PC');
        else setChatState(waiting.length ? `${waiting.length} message${waiting.length === 1 ? '' : 's'} wait${waiting.length === 1 ? 's' : ''} for the PC` : 'Answered at the next sync with the PC');
    }

    async function sendPhoneChat() {
        const prompt = promptBox.value.trim();
        const description = descBox.value.trim();
        if ((!prompt && !description && !chatFiles.length) || !agentCanvas) return;
        if (prompt.length + description.length > MAX_TEXT) { setChatState(`A message can be at most ${MAX_TEXT} characters.`, true); return; }
        const dir = await xpDir();
        if (!dir || !(await deviceOf())) { setChatState('Set up USB sync on the home screen first', true); return; }
        const btn = document.getElementById('agent-chat-send');
        btn.disabled = true;
        try {
            const at = new Date();
            const id = `m-${at.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
            const canvas = currentFabricName;
            const msgDir = await newQueueDir(canvas, at);
            const files = [];
            const used = new Set([MESSAGE.toLowerCase(), NOT_ANSWERED.toLowerCase()]);
            for (const f of chatFiles) {
                const name = fileName(f.name, used);
                await writeBlob(msgDir, name, f);
                files.push({ name, size: f.size, sha: await sha256(f) });
            }
            const model = document.getElementById('agent-chat-model').value || null;
            await writeBlob(msgDir, MESSAGE, messageMd({ id, canvas, model, at: at.toISOString(), description, prompt, files }));
            chatFiles = [];
            renderChatFiles();
            promptBox.value = '';
            descBox.value = '';
        } catch (e) {
            setChatState(`Could not keep the message: ${e.message}`, true);
        }
        btn.disabled = false;
        await refreshPhoneChat();
    }

    startAgentChat = function () {
        stopAgentChat();
        const log = document.getElementById('agent-chat-log');
        log.replaceChildren();
        log.dataset.count = '';
        log.dataset.xpCount = '';
        setChatState('');
        refreshPhoneChat();
        chatTimer = setInterval(refreshPhoneChat, 3000);
    };
    refreshAgentChat = refreshPhoneChat;
    sendAgentChat = sendPhoneChat; // Enter in the chat
    {
        // Send was bound to CanvasX's own send, which talks to NoteX over the network.
        const old = document.getElementById('agent-chat-send');
        const btn = old.cloneNode(true);
        old.replaceWith(btn);
        btn.addEventListener('click', () => sendPhoneChat());
    }

    /* --------------------------------------------- NoteX at work: the popup */

    /* While NoteX syncs it leaves a new status file at each step (NoteX
     * t-2ff7b152e9). A new one shows the popup: NoteX is accessing the
     * canvases, a progress bar while the agent answers the queued messages,
     * then Synced once the batch is taken in (t-8cbbaa2aad). Whether NoteX
     * stopped is judged by when a new file last appeared, on this phone's
     * own clock. */
    const POLL_MS = 2000;
    const STALE_MS = 90000;
    const pop = document.createElement('div');
    pop.id = 'xp-pop';
    pop.className = 'xp-pop';
    pop.hidden = true;
    pop.innerHTML = `<div class="xp-pop-card" role="status" aria-live="polite"><div class="xp-pop-head"><span class="xp-pop-icon">${svg(ICONS.pc)}</span><div class="xp-pop-titles"><div class="xp-pop-title"></div><div class="xp-pop-text"></div></div></div><div class="xp-pop-bar"><span></span></div><div class="xp-pop-count"></div>`
        + '<ol class="xp-pop-steps"><li data-step="reading">Read what changed on the phone</li><li data-step="agent">The agent answers your messages</li><li data-step="sending">Send the canvases and answers back</li></ol>'
        + '<div class="xp-pop-actions"><button class="home-btn xp-pop-home" hidden>Go to the home screen</button><button class="home-btn xp-pop-close">Hide</button></div></div>';
    const pill = document.createElement('button');
    pill.id = 'xp-pill';
    pill.className = 'xp-pill';
    pill.hidden = true;
    document.body.append(pop, pill);
    const q = (sel) => pop.querySelector(sel);

    // polls: status reads that finished since the last news - a phone whose reads are slow is not NoteX gone quiet (t-ae96a0c460).
    const STALE_POLLS = 15;
    let started = false, lastName = null, lastAt = 0, polls = 0, current = null, tucked = false, closeTimer = null, view = null, finishing = false;

    function render(v) {
        view = v;
        q('.xp-pop-title').textContent = v.title;
        q('.xp-pop-text').textContent = v.text || '';
        q('.xp-pop-count').textContent = v.count || '';
        const bar = q('.xp-pop-bar');
        bar.hidden = v.bar === undefined;
        bar.classList.toggle('busy', v.bar === 'busy');
        bar.firstElementChild.style.width = typeof v.bar === 'number' ? `${Math.max(3, Math.round(v.bar * 100))}%` : '';
        pop.classList.toggle('ok', Boolean(v.ok));
        pop.classList.toggle('bad', Boolean(v.bad));
        q('.xp-pop-home').hidden = !v.home;
        q('.xp-pop-close').textContent = v.final ? 'OK' : 'Hide';
        // The sync's steps: done, under way, still to come (t-1c580a5971); the agent's only when it answers.
        const order = ['reading', 'agent', 'sending', 'done'];
        const at = order.indexOf(v.stage);
        const steps = q('.xp-pop-steps');
        steps.hidden = at < 0;
        for (const li of steps.children) {
            const i = order.indexOf(li.dataset.step);
            li.className = i < at ? 'done' : i === at ? 'now' : '';
            if (li.dataset.step === 'agent') li.hidden = !(current && current.sawAgent);
        }
        const showPill = tucked && !v.final;
        pop.hidden = showPill;
        pill.hidden = !showPill;
        pill.textContent = `${v.title}${v.count ? ` · ${v.count}` : ''}`;
        clearTimeout(closeTimer);
        if (v.ok && !v.home) closeTimer = setTimeout(closePop, 6000);
    }
    function closePop() {
        clearTimeout(closeTimer);
        pop.hidden = true;
        pill.hidden = true;
        view = null;
    }
    q('.xp-pop-close').addEventListener('click', () => {
        if (!view || view.final) { closePop(); return; }
        tucked = true;
        render(view);
    });
    q('.xp-pop-home').addEventListener('click', () => { closePop(); document.getElementById('btn-home').click(); });
    pill.addEventListener('click', () => { tucked = false; if (view) render(view); });

    function showStep(st) {
        const sawAgent = Boolean(current && current.sync === st.sync && current.sawAgent) || st.stage === 'agent';
        if (!current || current.sync !== st.sync) { tucked = false; finishing = false; }
        current = { ...st, sawAgent };
        syncing = st.stage === 'done' || st.stage === 'failed' ? null : st;
        if (agentCanvas) refreshPhoneChat();
        if (st.stage === 'done') { finish(current); return; }
        if (st.stage === 'failed') { render({ title: 'The sync stopped', text: st.text, final: true, bad: true }); return; }
        if (st.stage === 'agent') {
            render({ stage: 'agent', title: 'The agent is answering your messages', text: `${st.canvas ? `On "${st.canvas}". ` : ''}Keep the phone plugged in.`, bar: st.total ? st.done / st.total : 'busy', count: `${st.done} of ${st.total} answered` });
            return;
        }
        render({ stage: st.stage === 'sending' ? 'sending' : 'reading', title: 'NoteX is accessing your canvases', text: `${st.text || ''}. Keep the phone plugged in.`.replace(/^\. /, ''), bar: 'busy' });
    }

    // The batches still waiting: does one change the canvas open here (an ordinary one, which
    // CanvasX would save its open copy over)?
    async function touchesOpenCanvas() {
        if (homeScreen && !homeScreen.classList.contains('hidden')) return false;
        if (!currentFabricName || agentCanvas) return false; // an agent canvas redraws from fabric.json by itself
        const inc = await dirAt(await xpDir(), ['incoming']).catch(() => null);
        if (!inc) return false;
        for (const id of await waitingBatches()) {
            const ch = await readJson(await inc.getDirectoryHandle(id), 'changes.json');
            if (ch && Array.isArray(ch.ops) && ch.ops.some((o) => o.canvas === currentFabricName || o.to === currentFabricName)) return true;
        }
        return false;
    }

    // Done: take the batch in at once - it may still be appearing - then say Synced.
    async function finish(st) {
        if (finishing) return;
        finishing = true;
        render({ stage: 'sending', title: 'Synced - bringing in the changes', text: st.text, bar: 'busy' });
        for (let i = 0; i < 30 && current === st; i++) {
            if (await touchesOpenCanvas()) {
                render({ title: 'Synced', text: `${st.text}. Go to the home screen to bring the PC's changes into "${currentFabricName}".`, bar: 1, ok: true, final: true, home: true });
                return;
            }
            const r = await takeInShown();
            if (r.error) {
                render({ title: 'Could not bring in the changes', text: takeInNote(r), bar: 1, bad: true, final: true });
                await showState(takeInNote(r));
                return;
            }
            const m = (await readJson(await xpDir(), 'manifest.json')) || {};
            if (r.taken || (m.applied || []).includes(st.batch)) {
                if (r.taken && homeScreen && !homeScreen.classList.contains('hidden')) { await loadFabricsGrid(); await showState(); }
                if (agentCanvas) refreshPhoneChat();
                const aside = r.aside.length ? ` Your own changes were kept beside the PC's: ${r.aside.map((a) => `"${a.copy}"`).join(', ')}.` : '';
                render({ stage: 'done', title: 'Synced', text: `${st.text}.${aside}`, bar: 1, ok: true, final: true });
                return;
            }
            await new Promise((res) => setTimeout(res, POLL_MS));
        }
        if (current === st) render({ stage: 'done', title: 'Synced', text: `${st.text}. The PC's changes are still copying - they come in from the home screen.`, bar: 1, ok: true, final: true });
    }

    async function pollStatus() {
        if (!targetWorkspaceHandle || document.hidden) return;
        const dir = await xpDir();
        if (!dir) { if (!started) { started = true; lastName = null; lastAt = Date.now(); } return; } // nothing from NoteX yet
        let sd = null;
        try { sd = await dir.getDirectoryHandle('status'); } catch { /* NoteX has not synced here yet */ }
        const names = [];
        if (sd) for await (const e of sd.values()) if (e.kind === 'file' && /^s-[^/]*\.json$/.test(e.name)) names.push(e.name);
        names.sort();
        const latest = names[names.length - 1] || null;
        for (const n of names.slice(0, -1)) { try { await sd.removeEntry(n); } catch { /* NoteX may be copying */ } }
        if (!started) { started = true; lastName = latest; lastAt = Date.now(); return; } // left before this page opened
        if (latest && latest !== lastName) {
            lastName = latest;
            lastAt = Date.now();
            polls = 0;
            const st = await readJson(sd, latest);
            if (st && st.stage) showStep(st);
            return;
        }
        polls++;
        if (syncing && Date.now() - lastAt > STALE_MS && polls >= STALE_POLLS) {
            syncing = null;
            current = null;
            if (agentCanvas) refreshPhoneChat();
            render({ title: 'NoteX stopped', text: 'No word from NoteX for a minute and a half - the cable may have come out. Plug the phone in and sync again in NoteX.', final: true, bad: true });
        }
    }
    let polling = false;
    async function tick() {
        if (polling) return;
        polling = true;
        try { await pollStatus(); } catch (e) { console.warn('CanvasXP: reading NoteX\'s status failed', e); } finally { polling = false; }
    }
    setInterval(tick, POLL_MS);
    // A phone asleep runs no timers: waking is not NoteX going quiet.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastAt = Date.now(); polls = 0; } });

    /* ------------------------------------------- always Tablet Mode on a phone */

    // Fingers move the canvas and the pen draws; the PC's mode, where a finger is a mouse,
    // is not offered - on a phone it only ever got the canvas stuck (t-fc05d39619). A mouse
    // and a pen work the same in Tablet Mode.
    setTabletMode(true);
    const tabletToggle = document.getElementById('tablet-mode-toggle');
    const tabletRow = tabletToggle && tabletToggle.closest('label');
    if (tabletRow) {
        tabletRow.style.display = 'none';
        const note = document.createElement('p');
        note.className = 'xp-touch-note';
        note.textContent = 'Touch: two fingers move the canvas, a two-finger tap opens options, and three-finger swipes open Mission Control, Constellation and Widgets, and a three-finger tap shows or hides a stick at the bottom left that moves the canvas. The pen or a mouse clicks, drags and draws.';
        tabletRow.after(note);
    }

    /* ------------------------------------------------------ the phone layout */

    /* The approved phone design (t-1c580a5971) on any screen touched with
     * fingers, and on a small one (t-3de3d9e805): body.xp-phone switches it on,
     * so a tablet keeps it however it is turned and a PC with a mouse keeps
     * CanvasX's layout. A tablet adds body.xp-tab, and held sideways body.xp-side
     * (t-12c54c13d0). Only the chrome changes: what a canvas draws - totems,
     * areas, boxes - keeps CanvasX's look (t-e1d7b8a3de). Every colour comes from
     * CanvasX's theme variables, so its light/dark switch restyles it all. */
    const phoneMQ = matchMedia('(pointer: coarse), (max-width: 640px), (max-height: 500px)');
    const tabMQ = matchMedia('(min-width: 700px) and (min-height: 560px)');
    const sideMQ = matchMedia('(orientation: landscape)');
    const layoutHooks = [];
    const setPhone = () => {
        const phone = phoneMQ.matches;
        const tab = phone && tabMQ.matches;
        document.body.classList.toggle('xp-phone', phone);
        document.body.classList.toggle('xp-tab', tab);
        document.body.classList.toggle('xp-side', tab && sideMQ.matches);
        for (const hook of layoutHooks) hook();
    };
    for (const mq of [phoneMQ, tabMQ, sideMQ]) mq.addEventListener('change', setPhone);
    setPhone();
    const onTablet = () => document.body.classList.contains('xp-tab');
    const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    const iconBtn = (id, label, d) => { const b = make('button', 'xp-icon-btn', svg(d)); b.id = id; b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; return b; };

    // CanvasXP's mark (t-bea4bb5b8d): an area, a totem and the link between them - the app icon's drawing.
    const MARK = '<svg class="xp-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#4f46e5"/><rect x="11" y="13" width="28" height="21" rx="5" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-width="3"/><path d="M25 34v5a6 6 0 0 0 6 6h2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="33" y="39" width="21" height="12" rx="4" fill="#fff"/><circle cx="48" cy="19" r="4.5" fill="#c7d2fe"/></svg>';

    // Home: the logo, a line under the name, the folder in use, and "New canvas".
    {
        const h1 = document.querySelector('.home-header h1');
        h1.innerHTML = 'Canvas<span class="xp-xp">XP</span>';
        const brand = make('div', 'xp-brand', MARK);
        const titles = make('div', 'xp-home-titles');
        h1.before(brand);
        brand.append(titles);
        titles.append(h1, make('span', 'xp-home-sub', 'Your canvases, on this phone'));
        const folderRow = make('div', 'xp-folder-row', `${svg(ICONS.folder, 16)}<span class="xp-folder-label">Folder</span><strong id="xp-folder-name"></strong>`);
        // Picking another folder: once one is picked, Restore no longer means anything (t-6a62beb22c).
        const openBtn = document.getElementById('btn-open-workspace');
        const pickFolder = async () => {
            const before = targetWorkspaceHandle;
            await (window.originalBtnOpenWorkspaceClick || openBtn.onclick)();
            if (targetWorkspaceHandle && targetWorkspaceHandle !== before) {
                openBtn.textContent = 'Open Target Workspace';
                if (window.originalBtnOpenWorkspaceClick) openBtn.onclick = window.originalBtnOpenWorkspaceClick;
            }
        };
        const change = make('button', 'xp-link-btn', 'Change');
        change.type = 'button';
        change.addEventListener('click', pickFolder);
        folderRow.append(change);
        const content = document.getElementById('workspace-content');
        content.prepend(folderRow);
        // Beside Restore Previous Workspace, a way to pick a different folder instead.
        const openRow = make('div', 'xp-open-row');
        openBtn.before(openRow);
        const changeTarget = make('button', 'home-btn', 'Change target folder');
        changeTarget.id = 'xp-change-folder';
        changeTarget.type = 'button';
        changeTarget.addEventListener('click', pickFolder);
        openRow.append(openBtn, changeTarget);
        const showChange = () => { changeTarget.hidden = !(content.classList.contains('hidden') && /restore/i.test(openBtn.textContent)); };
        new MutationObserver(showChange).observe(openBtn, { childList: true, characterData: true, subtree: true });
        new MutationObserver(showChange).observe(content, { attributes: true, attributeFilter: ['class'] });
        showChange();
        const newBtn = document.getElementById('btn-new-fabric');
        for (const n of newBtn.childNodes) if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ' New canvas ';
    }

    // The canvases in two columns, the agent's apart in a list saying what waits for the PC.
    const gridHead = make('div', 'xp-grid-head xp-canvas-head', '<h2>Canvases</h2><span id="xp-canvas-count"></span>');
    const agentHead = make('div', 'xp-grid-head xp-agent-head', '<h2>The agent\'s canvases</h2><span>view only</span>');
    const agentGrid = make('div', 'xp-agent-grid');
    agentGrid.id = 'xp-agent-grid';
    {
        const grid = document.getElementById('fabrics-grid');
        grid.before(gridHead);
        grid.after(agentHead, agentGrid);
    }
    async function arrangeGrid() {
        const grid = document.getElementById('fabrics-grid');
        const agents = [...grid.querySelectorAll('.fabric-card.agent-card')];
        agentGrid.replaceChildren(...agents);
        const own = grid.querySelectorAll('.fabric-card').length;
        document.getElementById('xp-canvas-count').textContent = String(own);
        gridHead.hidden = !own;
        agentHead.hidden = agentGrid.hidden = !agents.length;
        for (const card of agents) {
            const name = card.querySelector('.fabric-card-info h3')?.textContent || '';
            const icon = card.querySelector('.fabric-card-icon');
            if (icon && !icon.querySelector('.xp-robot')) icon.insertAdjacentHTML('beforeend', `<span class="xp-robot">${svg(ICONS.robot, 18)}</span>`);
            if (!card.querySelector('.xp-card-go')) card.insertAdjacentHTML('beforeend', `<span class="xp-card-go">${svg(ICONS.chevron, 18)}</span>`);
            let n = 0;
            try { n = (await queued(name)).length; } catch { /* no queue yet */ }
            const p = card.querySelector('.fabric-card-info p');
            if (p) p.textContent = n ? `${n} message${n === 1 ? '' : 's'} wait${n === 1 ? 's' : ''} for the PC` : 'View only';
        }
    }

    // A canvas: a top bar - back, the canvas, what it is - and a zoom control.
    const topbar = make('header', 'xp-topbar');
    topbar.id = 'xp-topbar';
    const backBtn = iconBtn('xp-back', 'Home', ICONS.back);
    backBtn.addEventListener('click', () => document.getElementById('btn-home').click());
    const tbTitles = make('div', 'xp-tb-titles', '<span id="xp-tb-name"></span><span id="xp-tb-sub"></span>');
    const viewChip = make('span', 'xp-chip', `${svg(ICONS.eye, 14)}View only`);
    viewChip.id = 'xp-view-chip';
    const themeBtn = make('button', 'xp-icon-btn theme-toggle', document.getElementById('btn-theme').innerHTML);
    themeBtn.id = 'xp-theme';
    themeBtn.type = 'button';
    themeBtn.setAttribute('aria-label', 'Switch between light and dark');
    themeBtn.addEventListener('click', () => toggleTheme());
    const moreBtn = iconBtn('xp-more', 'Settings', ICONS.more);
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const popup = document.getElementById('settings-popup');
        const open = popup.style.display !== 'block';
        popup.style.display = open ? 'block' : 'none';
        if (open) {
            document.getElementById('graphics-preset-select').value = state.graphicsPreset || 'performance';
            palettePopup.classList.remove('active');
        }
    });
    topbar.append(backBtn, tbTitles, viewChip, themeBtn, moreBtn);
    const zoomBox = make('div', 'xp-zoom');
    zoomBox.id = 'xp-zoom';
    const zoomOut = make('button', null, '−');
    const zoomPct = make('span', 'xp-zoom-pct', '100%');
    const zoomIn = make('button', null, '+');
    zoomOut.type = zoomIn.type = 'button';
    zoomOut.setAttribute('aria-label', 'Zoom out');
    zoomIn.setAttribute('aria-label', 'Zoom in');
    zoomOut.addEventListener('click', () => keyZoom(1 / 1.25));
    zoomIn.addEventListener('click', () => keyZoom(1.25));
    zoomBox.append(zoomOut, zoomPct, zoomIn);
    document.body.append(topbar, zoomBox);
    // On a tablet the top bar keeps the canvas's name; light/dark and settings join the zoom at the top right.
    const zoomSep = make('span', 'xp-sep');
    layoutHooks.push(() => {
        if (onTablet()) zoomBox.append(zoomSep, themeBtn, moreBtn);
        else { zoomSep.remove(); topbar.append(themeBtn, moreBtn); }
    });
    setPhone();
    setInterval(() => {
        if (!document.body.classList.contains('xp-phone') || document.hidden) return;
        const t = `${Math.round(state.camera.zoom * 100)}%`;
        if (zoomPct.textContent !== t) zoomPct.textContent = t;
    }, 250);

    // The tools: a dock at the bottom, each with its name; home and theme live in the top bar.
    const TOOL_NAMES = { 'btn-select': 'Move', 'btn-pan': 'Pan', 'btn-draw': 'Pen', 'btn-delete': 'Erase', 'btn-text': 'Text', 'btn-notepad': 'Note', 'btn-line': 'Line', 'btn-arrow': 'Arrow', 'btn-rect': 'Box', 'btn-book': 'Book', 'btn-folder': 'Folder', 'btn-circle': 'Circle', 'btn-totem': 'Totem', 'btn-elements': 'Board' };
    for (const [id, name] of Object.entries(TOOL_NAMES)) {
        const b = document.getElementById(id);
        if (b && !b.querySelector('.xp-tool-label')) b.append(make('span', 'xp-tool-label', name));
    }
    const dockHint = make('div', 'xp-dock-hint', 'Swipe the tools for more');
    dockHint.id = 'xp-dock-hint';
    document.body.append(dockHint);
    document.getElementById('toolbar').addEventListener('scroll', () => dockHint.classList.add('seen'), { passive: true });

    // What the top bar says follows the canvas open; on the home screen it is gone.
    function updateChrome() {
        const onCanvas = Boolean(currentFabricName) && homeScreen.classList.contains('hidden');
        document.body.classList.toggle('xp-on-canvas', onCanvas);
        document.getElementById('xp-tb-name').textContent = currentFabricName || '';
        const device = onTablet() ? 'tablet' : 'phone';
        const copying = savingNow && savingNow.waiting;
        document.getElementById('xp-tb-sub').textContent = agentCanvas ? 'Drawn by NoteX from the agent\'s scripts' : copying ? `Saved on this ${device} · copying to the folder` : `Saved on this ${device}`;
        const sub = document.querySelector('.xp-home-sub');
        if (sub) sub.textContent = `Your canvases, on this ${device}`;
        const folder = document.getElementById('xp-folder-name');
        if (folder) folder.textContent = targetWorkspaceHandle ? targetWorkspaceHandle.name : '';
    }
    new MutationObserver(updateChrome).observe(homeScreen, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(updateChrome).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    updateChrome();

    /* ----------------------------------- the agent chat as a sheet from the bottom */

    // Folded, the chat is a bar along the bottom (t-02e85bc11b): a handle, the chat's icon, what
    // waits, and a chevron pointing the way it will go; a tap anywhere on the bar opens it.
    const chatEl = document.getElementById('agent-chat');
    const foldBtn = document.getElementById('agent-chat-fold');
    {
        const head = chatEl.querySelector('.agent-chat-head');
        chatEl.prepend(make('div', 'xp-sheet-handle', '<span></span>'));
        const titles = make('div', 'xp-chat-titles');
        const strong = head.querySelector('strong');
        strong.before(make('span', 'xp-chat-icon', svg(ICONS.chat, 18)), titles);
        titles.append(strong, document.getElementById('agent-chat-state'));
    }
    const showFold = () => {
        const folded = chatEl.classList.contains('folded');
        foldBtn.dataset.dir = folded ? 'up' : 'down';
        foldBtn.innerHTML = svg(folded ? ICONS.up : ICONS.down);
    };
    foldBtn.addEventListener('click', showFold); // after CanvasX's own handler, which folds it
    chatEl.querySelector('.agent-chat-head').addEventListener('click', (e) => {
        if (chatEl.classList.contains('folded') && !e.target.closest('#agent-chat-fold')) foldBtn.click();
    });
    new MutationObserver(showFold).observe(chatEl, { attributes: true, attributeFilter: ['class'] });
    showFold();

    /* ------------------------------------------------- wrapping CanvasX */

    /* The folder opened: CanvasXP works from its copy in the browser's storage from here on
     * (t-35a415fa01). The first time, every file is copied once, with a card saying how far it
     * has got; after that the copy opens at once and the folder is compared with it in the
     * background, the home screen drawn again if a canvas changed outside CanvasXP. */
    const origInit = initializeWorkspace;
    let unwatch = null;
    initializeWorkspace = async function () {
        const real = targetWorkspaceHandle;
        memo.clear();
        xpHandle = null;
        const copy = await XPStore.open(real, ({ done, total, text }) => {
            showBusy(`Making a fast copy of "${real.name}" on this ${onTablet() ? 'tablet' : 'phone'}`,
                total ? `Only this once. ${done} of ${total} files · ${text}` : `Only this once. ${text}…`, total ? done / total : null);
        });
        hideBusy();
        if (targetWorkspaceHandle !== real) return; // another folder was picked meanwhile
        targetWorkspaceHandle = copy;
        if (unwatch) unwatch();
        unwatch = XPStore.onStatus(copy, showSaving);
        showSaving(XPStore.status(copy));
        await origInit.apply(this, arguments);
        updateChrome();
        await tick(); // what NoteX left before the folder was opened is not news
        await onHome();
        setTimeout(async () => {
            if (targetWorkspaceHandle !== copy) return;
            let changed = [];
            try { changed = await XPStore.reconcile(copy); } catch (e) { console.warn('CanvasXP: comparing the folder with the copy failed', e); }
            if (changed.length && targetWorkspaceHandle === copy && !homeScreen.classList.contains('hidden')) await loadFabricsGrid();
        }, 4000);
    };

    // What is still being copied to the folder: on the USB sync card and under the canvas's name.
    function showSaving(st) {
        savingNow = st;
        const el = document.getElementById('xp-save-state');
        if (el) {
            el.textContent = !st ? '' : st.error ? `Could not save to the folder yet (${st.error}) - trying again.`
                : st.waiting ? `Saving ${st.waiting} change${st.waiting === 1 ? '' : 's'} to the folder - keep CanvasXP open before syncing.` : '';
            el.classList.toggle('bad', Boolean(st && st.error));
        }
        updateChrome();
    }
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
    // Opening a canvas from the home screen (t-57764f6348): on a phone reading its pictures can take
    // a while, so a card says at once that it is opening, then counts the pictures and PDFs as they
    // load. A second tap meanwhile opens nothing more. Re-reading the canvas already open (NoteX's
    // agent canvas, a batch taken in) shows no card.
    const openPop = make('div', 'xp-pop xp-open-pop', '<div class="xp-pop-card" role="status" aria-live="polite"><div class="xp-pop-head"><span class="xp-open-spin" aria-hidden="true"></span><div class="xp-pop-titles"><span class="xp-pop-title"></span><span class="xp-pop-text"></span></div></div><div class="xp-pop-bar busy"><span></span></div></div>');
    openPop.hidden = true;
    document.body.append(openPop);
    const openText = openPop.querySelector('.xp-pop-text');
    const openBar = openPop.querySelector('.xp-pop-bar');
    window.onFabricLoading = (done, total) => {
        if (openPop.hidden || !total) return;
        openText.textContent = `Loading pictures and PDFs: ${done} of ${total}`;
        openBar.classList.remove('busy');
        openBar.firstChild.style.width = `${Math.max(4, Math.round((done / total) * 100))}%`;
    };
    // The same card for the folder's first copy into the browser's storage (t-35a415fa01).
    function showBusy(title, text, frac) {
        openPop.querySelector('.xp-pop-title').textContent = title;
        openText.textContent = text;
        openBar.classList.toggle('busy', frac == null);
        openBar.firstChild.style.width = frac == null ? '' : `${Math.max(4, Math.round(frac * 100))}%`;
        openPop.hidden = false;
    }
    function hideBusy() { if (!opening) openPop.hidden = true; }

    /* The phone's keyboard (t-c5dfe34d15). The page is asked to shrink above it
     * (interactive-widget, make.js), but where a browser lays the keyboard over
     * the page instead, --xp-kb holds its height so the chat sheet sits on it.
     * Either way, what is being typed into stays in sight: in the chat its box
     * scrolls into view, and on the canvas - a note, a text, a table cell - the
     * canvas moves up until it clears the keyboard. */
    const vv = window.visualViewport;
    const editing = () => {
        const el = document.activeElement;
        return el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file)$/.test(el.type))) ? el : null;
    };
    function keepTypingInSight() {
        const el = editing();
        if (!el || !document.body.classList.contains('xp-phone')) return;
        const shown = vv ? vv.offsetTop + vv.height : window.innerHeight; // the bottom of what is visible, in page terms
        const r = el.getBoundingClientRect();
        if (el.closest('#agent-chat, .xp-pop, .modal, #new-fabric-modal')) {
            el.scrollIntoView({ block: 'nearest' }); // the compose area's scroll-padding keeps it clear of the Send row
            return;
        }
        if (!el.closest('#workspace, .inline-text-input') && !el.classList.contains('inline-text-input')) return;
        const caretBottom = Math.min(r.bottom, r.top + 160); // a long note: its first lines, where typing starts
        const dy = caretBottom - (shown - 24);
        if (dy <= 0) return;
        state.camera.y -= dy;
        // The text tool's box is placed on the screen once, not by the canvas: it moves with it.
        const box = el.closest('.inline-text-input') || (el.classList.contains('inline-text-input') ? el : null);
        if (box) box.style.top = `${parseFloat(box.style.top || '0') - dy}px`;
        scheduleRender();
    }
    if (vv) {
        let kbTimer = null;
        const onViewport = () => {
            const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
            document.documentElement.style.setProperty('--xp-kb', `${kb > 80 ? kb : 0}px`);
            clearTimeout(kbTimer);
            kbTimer = setTimeout(keepTypingInSight, 60); // once the keyboard has settled
        };
        vv.addEventListener('resize', onViewport);
        vv.addEventListener('scroll', onViewport);
    }
    window.addEventListener('resize', () => setTimeout(keepTypingInSight, 60));
    document.addEventListener('focusin', () => setTimeout(keepTypingInSight, 350)); // the keyboard takes a moment to come up

    let opening = null;
    const origOpen = openFabric;
    openFabric = function (dirHandle, name) {
        if (homeScreen.classList.contains('hidden')) return origOpen.apply(this, arguments);
        if (opening) return opening;
        const args = arguments;
        openPop.querySelector('.xp-pop-title').textContent = `Opening ${name}`;
        openText.textContent = 'Reading the canvas…';
        openBar.classList.add('busy');
        openBar.firstChild.style.width = '';
        openPop.hidden = false;
        opening = (async () => {
            try {
                // Drawn before the slow part starts (a hidden tab draws nothing, hence the timer too).
                await new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); });
                return await origOpen.apply(this, args);
            } finally {
                openPop.hidden = true;
                opening = null;
            }
        })();
        return opening;
    };

    // The grid is drawn again after a canvas is made, renamed or deleted.
    const origGrid = loadFabricsGrid;
    loadFabricsGrid = async function () {
        const r = await origGrid.apply(this, arguments);
        await arrangeGrid();
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
