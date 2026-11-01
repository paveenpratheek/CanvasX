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
 *   outbox/<id>/   a message to the agent written here while away from the
 *                  PC: files/, then message.json. NoteX answers it at the
 *                  next sync (t-3e75a404cf; NoteX t-e4196083e7);
 *   status/        NoteX's steps while it syncs, shown in a popup
 *                  (t-8cbbaa2aad; NoteX t-2ff7b152e9).
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
                    if (op.op === 'chat') {
                        const f = safeCanvas(op.canvas) && (await fileAt(b, ['chats', `${op.canvas}.json`]));
                        if (!f || (await sha256(f)) !== op.sha) { whole = false; break; }
                        continue;
                    }
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
        const xp = await xpDir(true);
        for (const op of ops) {
            // The outbox: what the agent answered goes; what NoteX could not hand it keeps the reason.
            if (op.op === 'answered') {
                let box = null;
                try { box = await xp.getDirectoryHandle('outbox'); } catch { continue; }
                for (const id of op.ids || []) if (safeSeg(id)) { try { await box.removeEntry(id, { recursive: true }); } catch { /* already gone */ } }
                continue;
            }
            if (op.op === 'unanswered') {
                if (!safeSeg(op.id)) continue;
                try { await writeJson(await dirAt(xp, ['outbox', op.id]), 'error.json', { error: String(op.error || 'Not answered.'), at: new Date().toISOString() }); } catch { /* removed here meanwhile */ }
                continue;
            }
            if (!safeCanvas(op.canvas)) continue;
            if (op.op === 'chat') {
                const f = await fileAt(batch, ['chats', `${op.canvas}.json`]);
                if (f) await writeBlob(await dirAt(xp, ['chats'], true), `${op.canvas}.json`, f);
            } else if (op.op === 'copy') {
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
        const asks = (await queued()).length;
        if (asks) parts.push(`${asks} message${asks === 1 ? '' : 's'} to the agent ${asks === 1 ? 'waits' : 'wait'} for the PC.`);
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

    /* ------------------------------------- the agent chat, queued for the PC */

    /* On an agent canvas the chat shows the conversation NoteX last sent and,
     * after it, the messages waiting for the PC. Send keeps the message in
     * the outbox - its files first, message.json last, so NoteX never takes
     * half a message - and NoteX answers it at the next USB sync
     * (t-3e75a404cf; NoteX t-e4196083e7, t-957b09f2fe). */
    const MAX_TEXT = 4000;
    const MODELS = ['sonnet', 'opus', 'haiku'];
    let syncing = null; // NoteX's latest step while a sync runs

    async function chatOf(name) {
        const dir = await xpDir();
        try { return await readJson(await dir.getDirectoryHandle('chats'), `${name}.json`); } catch { return null; }
    }

    // The messages waiting for the PC - for one canvas, or all - oldest first.
    async function queued(name = null) {
        const dir = await xpDir();
        let box;
        try { box = await dir.getDirectoryHandle('outbox'); } catch { return []; }
        const out = [];
        for await (const e of box.values()) {
            if (e.kind !== 'directory') continue;
            const m = await readJson(e, 'message.json');
            if (!m || (name && m.canvas !== name)) continue;
            const err = await readJson(e, 'error.json');
            out.push({ ...m, id: e.name, error: err && err.error });
        }
        return out.sort((a, b) => a.id.localeCompare(b.id));
    }

    // A name NoteX can keep on Windows, not taken by another file of the message.
    function fileName(name, used) {
        let base = String(name || 'image').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 120) || 'file';
        const dot = base.lastIndexOf('.');
        const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
        for (let i = 2; used.has(base.toLowerCase()); i++) base = `${stem} (${i})${ext}`;
        used.add(base.toLowerCase());
        return base;
    }

    async function refreshPhoneChat() {
        const name = currentFabricName;
        if (!agentCanvas || !name || !targetWorkspaceHandle) return;
        const dir = await xpDir();
        const dev = dir && (await readJson(dir, 'device.json'));
        const r = (dev && (await chatOf(name))) || { name, chat: [], model: 'sonnet', models: MODELS };
        const waiting = dev ? await queued(name) : [];
        if (name !== currentFabricName || !agentCanvas) return;
        renderAgentChat({ ...r, models: r.models || MODELS, ask: null });
        const log = document.getElementById('agent-chat-log');
        const empty = log.querySelector('.agent-chat-empty');
        if (empty) {
            if (waiting.length) empty.remove();
            else empty.textContent = 'Write to the agent about this canvas, and attach images from your gallery. Your messages wait here, and the agent answers them the next time the phone syncs with the PC.';
        }
        for (const m of waiting) {
            const answering = Boolean(syncing && syncing.current === m.id);
            const li = document.createElement('li');
            li.className = `from-user queued${m.error && !answering ? ' bad' : ''}`;
            const who = document.createElement('span');
            who.className = 'who';
            who.textContent = `You · ${answering ? 'the agent is answering…' : m.error ? 'not answered' : 'waiting for the PC'} · ${chatAgo(m.at)}`;
            li.append(who, document.createTextNode(m.text || ''));
            if (m.files && m.files.length) {
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
                    if (!confirm('Take this message back? The agent will not see it.')) return;
                    try { await (await (await xpDir()).getDirectoryHandle('outbox')).removeEntry(m.id, { recursive: true }); } catch { /* already gone */ }
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
        else setChatState(waiting.length ? `${waiting.length} waiting for the PC` : '');
    }

    async function sendPhoneChat() {
        const textBox = document.getElementById('agent-chat-text');
        const text = textBox.value.trim();
        if ((!text && !chatFiles.length) || !agentCanvas) return;
        if (text.length > MAX_TEXT) { setChatState(`A message can be at most ${MAX_TEXT} characters.`, true); return; }
        const dir = await xpDir();
        if (!dir || !(await readJson(dir, 'device.json'))) { setChatState('Set up USB sync on the home screen first', true); return; }
        const btn = document.getElementById('agent-chat-send');
        btn.disabled = true;
        try {
            const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const msgDir = await dirAt(dir, ['outbox', id], true);
            const filesDir = await msgDir.getDirectoryHandle('files', { create: true });
            const files = [];
            const used = new Set();
            for (const f of chatFiles) {
                const name = fileName(f.name, used);
                await writeBlob(filesDir, name, f);
                files.push({ name, size: f.size, sha: await sha256(f) });
            }
            const model = document.getElementById('agent-chat-model').value || null;
            await writeJson(msgDir, 'message.json', { id, canvas: currentFabricName, text, model, at: new Date().toISOString(), files });
            chatFiles = [];
            renderChatFiles();
            textBox.value = '';
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
    pop.innerHTML = '<div class="xp-pop-card" role="status" aria-live="polite"><div class="xp-pop-title"></div><div class="xp-pop-text"></div><div class="xp-pop-bar"><span></span></div><div class="xp-pop-count"></div><div class="xp-pop-actions"><button class="home-btn xp-pop-home" hidden>Go to the home screen</button><button class="home-btn xp-pop-close">Hide</button></div></div>';
    const pill = document.createElement('button');
    pill.id = 'xp-pill';
    pill.className = 'xp-pill';
    pill.hidden = true;
    document.body.append(pop, pill);
    const q = (sel) => pop.querySelector(sel);

    let started = false, lastName = null, lastAt = 0, current = null, tucked = false, closeTimer = null, view = null, finishing = false;

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
        if (!current || current.sync !== st.sync) { tucked = false; finishing = false; }
        current = st;
        syncing = st.stage === 'done' || st.stage === 'failed' ? null : st;
        if (agentCanvas) refreshPhoneChat();
        if (st.stage === 'done') { finish(st); return; }
        if (st.stage === 'failed') { render({ title: 'The sync stopped', text: st.text, final: true, bad: true }); return; }
        if (st.stage === 'agent') {
            render({ title: 'The agent is answering your messages', text: `${st.canvas ? `On "${st.canvas}". ` : ''}Keep the phone plugged in.`, bar: st.total ? st.done / st.total : 'busy', count: `${st.done} of ${st.total} answered` });
            return;
        }
        render({ title: 'NoteX is accessing your canvases', text: `${st.text || ''}. Keep the phone plugged in.`.replace(/^\. /, ''), bar: 'busy' });
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
        render({ title: 'Synced - bringing in the changes', text: st.text, bar: 'busy' });
        for (let i = 0; i < 30 && current === st; i++) {
            if (await touchesOpenCanvas()) {
                render({ title: 'Synced', text: `${st.text}. Go to the home screen to bring the PC's changes into "${currentFabricName}".`, bar: 1, ok: true, final: true, home: true });
                return;
            }
            const r = await serial(takeIn);
            const m = (await readJson(await xpDir(), 'manifest.json')) || {};
            if (r.taken || (m.applied || []).includes(st.batch)) {
                if (r.taken && homeScreen && !homeScreen.classList.contains('hidden')) { await loadFabricsGrid(); await showState(); }
                if (agentCanvas) refreshPhoneChat();
                const aside = r.aside.length ? ` Your own changes were kept beside the PC's: ${r.aside.map((a) => `"${a.copy}"`).join(', ')}.` : '';
                render({ title: 'Synced', text: `${st.text}.${aside}`, bar: 1, ok: true, final: true });
                return;
            }
            await new Promise((res) => setTimeout(res, POLL_MS));
        }
        if (current === st) render({ title: 'Synced', text: `${st.text}. The PC's changes are still copying - they come in from the home screen.`, bar: 1, ok: true, final: true });
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
            const st = await readJson(sd, latest);
            if (st && st.stage) showStep(st);
            return;
        }
        if (syncing && Date.now() - lastAt > STALE_MS) {
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastAt = Date.now(); });

    /* ------------------------------------------------- wrapping CanvasX */

    const origInit = initializeWorkspace;
    initializeWorkspace = async function () {
        await origInit.apply(this, arguments);
        await tick(); // what NoteX left before the folder was opened is not news
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
