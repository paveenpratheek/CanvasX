/* CanvasXP's working copy of the target folder (t-35a415fa01).
 *
 * On a phone every step through the browser's folder access goes to Android
 * and back, about a second each, and CanvasXP's own background reads queued in
 * front of the user's taps (t-6beedb06b4). So CanvasXP works from a copy of the
 * folder in the browser's private storage (OPFS), which reads and writes at
 * once:
 *
 *   XPStore.open(folder, progress) returns a stand-in for the folder's handle
 *   with the calls CanvasX makes (getDirectoryHandle, getFileHandle,
 *   removeEntry, values, getFile, createWritable, ...), all served from the
 *   copy. Each write and removal is also put in a queue that copies it to the
 *   real folder in the background, in order, one at a time; the queue is kept
 *   in OPFS, so a reload or a closed tab carries on where it stopped.
 *
 * The folder stays the master: NoteX syncs with it over USB. _canvasxp/ (the
 * sync's own files, which NoteX writes) and .notex/ are never copied - asking
 * for them hands back the real folder's own handle. Files at the top of the
 * folder (its .fabric_lock) are not copied either.
 *
 * The first opening of a folder copies every file once, at the folder's slow
 * speed, saying how far it has got. After that the copy is used at once, and
 * the folder is compared with it in the background: a canvas changed outside
 * CanvasXP is read in again, one gone from the folder goes from the copy, and
 * one only in the copy (never written back) is written back.
 */
(() => {
    'use strict';
    const PASS = new Set(['_canvasxp', '.notex']);
    const LOCK = '.fabric_lock';
    const skipReal = (name) => name === LOCK || name.endsWith('.crswap');
    const MIME = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp',
        pdf: 'application/pdf', json: 'application/json', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv',
        html: 'text/html', js: 'text/javascript', css: 'text/css', ipynb: 'application/json', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    // OPFS files have no type; the folder's had one from their name, and an image read as a data URL needs it.
    const mimeOf = (name) => MIME[(name.split('.').pop() || '').toLowerCase()] || '';
    const join = (a, b) => (a ? `${a}/${b}` : b);
    const under = (path, dir) => path === dir || path.startsWith(`${dir}/`);
    const segsOf = (path) => (path ? path.split('/') : []);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function readJson(dir, name) {
        try { return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text()); } catch { return null; }
    }
    async function writeFile(dir, name, data) {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(data);
        await w.close();
    }

    class Store {
        constructor(real, ws, files, saved, pending) {
            this.real = real;
            this.ws = ws;            // OPFS: canvasxp/<folder>/, holding files/, state.json, pending.json
            this.files = files;      // OPFS: the copy itself
            this.ready = Boolean(saved && saved.ready);
            this.index = (saved && saved.index) || {}; // path -> { size, mtime } of the real file as last written or read
            this.pending = (pending || []).map(({ op, path }) => ({ op, path })); // { op: 'put' | 'del' | 'mkdir', path }, oldest first
            this.version = new Map(); // path -> writes made here, so a background read never lands on a newer write
            this.localDirs = new Map([['', files]]);
            this.realDirs = new Map([['', real]]);
            this.pumping = false;
            this.idleWaiters = [];
            this.listeners = new Set();
            this.lastError = null;
            this.saveTimers = {};
            this.root = new MDir(this, '', real.name);
        }

        /* ------------------------------------------------ the copy, in OPFS */

        async localDir(path, create = false) {
            let d = this.localDirs.get(path);
            if (d) return d;
            const segs = segsOf(path);
            const parent = await this.localDir(segs.slice(0, -1).join('/'), create);
            d = await parent.getDirectoryHandle(segs[segs.length - 1], { create });
            this.localDirs.set(path, d);
            return d;
        }
        async localFile(path, create = false) {
            const segs = segsOf(path);
            return (await this.localDir(segs.slice(0, -1).join('/'), create)).getFileHandle(segs[segs.length - 1], { create });
        }
        forgetDirs(map, path) { for (const k of [...map.keys()]) if (k && under(k, path)) map.delete(k); }

        /* ------------------------------------------- the queue to the folder */

        touched(path) {
            return this.pending.some((o) => under(path, o.path) || (o.op !== 'del' && under(o.path, path)));
        }
        enqueue(op) {
            const p = op.path;
            this.version.set(p, (this.version.get(p) || 0) + 1);
            if (op.op === 'mkdir' && this.pending.some((o) => o.op === 'mkdir' && o.path === p)) return;
            if (op.op === 'put') this.pending = this.pending.filter((o) => !(o.op === 'put' && o.path === p));
            if (op.op === 'del') this.pending = this.pending.filter((o) => o.op === 'del' || !under(o.path, p));
            this.pending.push(op);
            this.save('pending');
            this.emit();
            this.pump();
        }
        save(which) {
            clearTimeout(this.saveTimers[which]);
            this.saveTimers[which] = setTimeout(() => {
                const data = which === 'pending' ? this.pending : { ready: this.ready, index: this.index };
                writeFile(this.ws, `${which === 'pending' ? 'pending' : 'state'}.json`, JSON.stringify(data)).catch((e) => console.warn('CanvasXP: keeping the copy\'s', which, 'failed', e));
            }, 300);
        }
        async realDir(segs, create = false) {
            const path = segs.join('/');
            let d = this.realDirs.get(path);
            if (d) return d;
            const parent = await this.realDir(segs.slice(0, -1), create);
            d = await parent.getDirectoryHandle(segs[segs.length - 1], { create });
            this.realDirs.set(path, d);
            return d;
        }
        async pump() {
            if (this.pumping) return;
            this.pumping = true;
            let wait = 2000;
            try {
                while (this.pending.length) {
                    const op = this.pending[0];
                    try {
                        await this.apply(op);
                        this.lastError = null;
                        wait = 2000;
                    } catch (e) {
                        // The folder refused: said, tried again a little later, the queue kept. One
                        // that keeps failing goes to the back, so the writes behind it still go.
                        this.lastError = `${op.path}: ${e && e.name ? `${e.name} - ${e.message}` : e}`;
                        console.warn('CanvasXP: writing to the folder failed', this.lastError);
                        this.realDirs = new Map([['', this.real]]);
                        op.fails = (op.fails || 0) + 1;
                        if (op.fails % 3 === 0 && this.pending.length > 1 && this.pending[0] === op) this.pending.push(this.pending.shift());
                        // Every write left has failed: whoever waits for the folder to have them all hears it will not.
                        if (this.pending.every((o) => o.fails)) for (const r of this.idleWaiters.splice(0)) r(false);
                        this.emit();
                        await sleep(wait);
                        wait = Math.min(wait * 2, 30000);
                        continue;
                    }
                    // Taken out by identity: a newer write of the same file may have replaced it meanwhile.
                    const i = this.pending.indexOf(op);
                    if (i >= 0) this.pending.splice(i, 1);
                    this.save('pending');
                    this.emit();
                }
            } finally {
                this.pumping = false;
                this.save('state');
                for (const r of this.idleWaiters.splice(0)) r(true);
                this.emit();
            }
        }
        async apply(op) {
            const segs = segsOf(op.path);
            const name = segs[segs.length - 1];
            if (op.op === 'mkdir') { await this.realDir(segs, true); return; }
            if (op.op === 'put') {
                let blob;
                try { blob = await (await this.localFile(op.path)).getFile(); } catch (e) {
                    if (e && e.name === 'NotFoundError') return; // gone here since; its removal follows in the queue
                    throw e;
                }
                const fh = await (await this.realDir(segs.slice(0, -1), true)).getFileHandle(name, { create: true });
                const w = await fh.createWritable();
                await w.write(blob);
                await w.close();
                if (name !== LOCK) {
                    const f = await fh.getFile();
                    this.index[op.path] = { size: f.size, mtime: f.lastModified };
                    this.save('state');
                }
                return;
            }
            if (op.op === 'del') {
                let parent;
                try { parent = await this.realDir(segs.slice(0, -1)); } catch (e) { if (e && e.name === 'NotFoundError') return this.unindex(op.path); throw e; }
                try { await removeReal(parent, name); } catch (e) { if (!e || e.name !== 'NotFoundError') throw e; }
                this.forgetDirs(this.realDirs, op.path);
                this.unindex(op.path);
            }
        }
        unindex(path) {
            for (const k of Object.keys(this.index)) if (under(k, path)) delete this.index[k];
            this.save('state');
        }
        // True once everything written here is in the folder too; false when the folder refuses every write still waiting.
        idle() {
            if (!this.pending.length && !this.pumping) return Promise.resolve(true);
            if (this.pending.length && this.pending.every((o) => o.fails)) return Promise.resolve(false);
            return new Promise((r) => this.idleWaiters.push(r));
        }
        status() { return { waiting: this.pending.length, error: this.lastError, ready: this.ready, comparing: Boolean(this.comparing) }; }
        emit() { for (const fn of this.listeners) { try { fn(this.status()); } catch { /* a listener's own trouble */ } } }

        /* ------------------------------------- the folder compared with the copy */

        // Every file under a real folder, with its handle and when it last changed.
        async listReal(dir, prefix, out) {
            for await (const e of dir.values()) {
                const rel = join(prefix, e.name);
                if (e.kind === 'directory') await this.listReal(e, rel, out);
                else if (!skipReal(e.name)) out.push({ path: rel, handle: e });
            }
            return out;
        }
        async listLocal(path) {
            const out = new Set();
            const walk = async (dir, prefix) => {
                for await (const [n, h] of dir.entries()) {
                    const rel = join(prefix, n);
                    if (h.kind === 'directory') await walk(h, rel);
                    else if (!skipReal(n)) out.add(rel);
                }
            };
            try { await walk(await this.localDir(path), path); } catch { /* not here */ }
            return out;
        }
        // A real file read into the copy, unless a write made here since would be overwritten.
        async pull(path, handle, file) {
            const v = this.version.get(path) || 0;
            const f = file || (await handle.getFile());
            if (this.touched(path) || (this.version.get(path) || 0) !== v) return false;
            await writeFile(await this.localDir(path.split('/').slice(0, -1).join('/'), true), path.split('/').pop(), f);
            this.index[path] = { size: f.size, mtime: f.lastModified };
            return true;
        }

        // The first opening: every file copied once.
        async copyAll(progress) {
            const tops = [];
            for await (const e of this.real.values()) if (e.kind === 'directory' && !PASS.has(e.name)) tops.push(e);
            progress({ done: 0, total: 0, text: 'Listing the files in the folder' });
            const all = [];
            for (const d of tops) await this.listReal(d, d.name, all);
            let done = 0;
            for (const { path, handle } of all) {
                const f = await handle.getFile();
                const had = this.index[path];
                const local = had && had.size === f.size && had.mtime === f.lastModified ? await this.localFile(path).then((h) => h.getFile()).catch(() => null) : null;
                if (!local || local.size !== f.size) await this.pull(path, handle, f);
                done++;
                progress({ done, total: all.length, text: path.split('/')[0] });
                if (done % 25 === 0) this.save('state');
            }
            this.ready = true;
            this.save('state');
        }

        /* Later openings, in the background: each canvas looked at cheaply (its
         * fabric.json and the names in it); one that differs is compared file by
         * file. Says which top-level folders changed. */
        async reconcile() {
            this.comparing = true;
            try { return await this.compareAll(); } finally { this.comparing = false; this.emit(); }
        }
        async compareAll() {
            const changed = new Set();
            const realTops = new Map();
            for await (const e of this.real.values()) if (e.kind === 'directory' && !PASS.has(e.name)) realTops.set(e.name, e);
            const localTops = new Set();
            for await (const [n, h] of this.files.entries()) if (h.kind === 'directory') localTops.add(n);
            for (const [name, dir] of realTops) {
                await this.idle(); // the user's writes go first
                if (!localTops.has(name)) {
                    if (this.touched(name)) continue;
                    if (await this.compare(name, dir)) changed.add(name);
                    continue;
                }
                if (await this.looksSame(name, dir)) continue;
                if (await this.compare(name, dir)) changed.add(name);
            }
            for (const name of localTops) {
                if (realTops.has(name) || this.touched(name)) continue;
                const known = Object.keys(this.index).some((k) => under(k, name));
                if (known) {
                    // Removed from the folder outside CanvasXP: gone from the copy too.
                    await this.files.removeEntry(name, { recursive: true }).catch(() => {});
                    this.forgetDirs(this.localDirs, name);
                    this.unindex(name);
                    changed.add(name);
                } else {
                    // Only ever here (written before the queue was kept): written back now.
                    for (const p of await this.listLocal(name)) this.enqueue({ op: 'put', path: p });
                }
            }
            this.save('state');
            return [...changed];
        }
        async looksSame(name, dir) {
            const names = new Set();
            const walkNames = async (d, prefix, depth) => {
                for await (const e of d.values()) {
                    const rel = join(prefix, e.name);
                    if (e.kind === 'directory') { if (depth < 1) await walkNames(e, rel, depth + 1); else names.add(`${rel}/`); }
                    else if (!skipReal(e.name)) names.add(rel);
                }
            };
            await walkNames(dir, name, 0);
            const known = new Set();
            for (const k of Object.keys(this.index)) {
                if (!under(k, name)) continue;
                const s = k.split('/');
                known.add(s.length > 3 ? `${s.slice(0, 3).join('/')}/` : k);
            }
            if (names.size !== known.size || [...names].some((n) => !known.has(n))) return false;
            // The canvas itself: fabric.json changed outside means it was rewritten.
            for (const f of ['fabric.json', 'agent.json']) {
                const p = `${name}/${f}`;
                if (!this.index[p]) continue;
                const real = await dir.getFileHandle(f).then((h) => h.getFile()).catch(() => null);
                if (!real || real.size !== this.index[p].size || real.lastModified !== this.index[p].mtime) return false;
            }
            return true;
        }
        async compare(name, dir) {
            let changed = false;
            const real = await this.listReal(dir, name, []);
            const seen = new Set();
            for (const { path, handle } of real) {
                seen.add(path);
                if (this.touched(path)) continue;
                const f = await handle.getFile();
                const had = this.index[path];
                if (had && had.size === f.size && had.mtime === f.lastModified) continue;
                if (await this.pull(path, handle, f)) changed = true;
            }
            for (const p of await this.listLocal(name)) {
                if (seen.has(p) || this.touched(p)) continue;
                if (this.index[p]) {
                    try { await (await this.localDir(p.split('/').slice(0, -1).join('/'))).removeEntry(p.split('/').pop()); } catch { /* gone */ }
                    delete this.index[p];
                    changed = true;
                } else this.enqueue({ op: 'put', path: p });
            }
            return changed;
        }
    }

    // Removing from the real folder: recursive where the browser can, one by one where it cannot.
    async function removeReal(parent, name) {
        try { await parent.removeEntry(name, { recursive: true }); return; } catch (e) { if (e.name !== 'TypeMismatchError' && e.name !== 'InvalidModificationError') throw e; }
        const dir = await parent.getDirectoryHandle(name);
        const kids = [];
        for await (const e of dir.values()) kids.push(e);
        for (const e of kids) {
            if (e.kind === 'directory') await removeReal(dir, e.name);
            else await dir.removeEntry(e.name);
        }
        await parent.removeEntry(name);
    }

    /* ------------------------------------------- what CanvasX is handed instead */

    class MDir {
        constructor(store, path, name) { this.store = store; this.path = path; this.name = name; this.kind = 'directory'; }
        async getDirectoryHandle(name, opts = {}) {
            if (!this.path && PASS.has(name)) return this.store.real.getDirectoryHandle(name, opts);
            const s = this.store;
            const p = join(this.path, name);
            const parent = await s.localDir(this.path);
            let made = false;
            try { await parent.getDirectoryHandle(name); } catch (e) {
                if (!opts.create || e.name !== 'NotFoundError') throw e;
                await parent.getDirectoryHandle(name, { create: true });
                made = true;
            }
            if (made) s.enqueue({ op: 'mkdir', path: p });
            return new MDir(s, p, name);
        }
        async getFileHandle(name, opts = {}) {
            const parent = await this.store.localDir(this.path);
            await parent.getFileHandle(name, { create: Boolean(opts.create) });
            return new MFile(this.store, join(this.path, name), name);
        }
        async removeEntry(name, opts = {}) {
            if (!this.path && PASS.has(name)) return this.store.real.removeEntry(name, opts);
            const s = this.store;
            const p = join(this.path, name);
            await (await s.localDir(this.path)).removeEntry(name, opts);
            s.forgetDirs(s.localDirs, p);
            s.enqueue({ op: 'del', path: p });
        }
        async *entries() {
            const s = this.store;
            for await (const [n, h] of (await s.localDir(this.path)).entries()) {
                const p = join(this.path, n);
                yield [n, h.kind === 'directory' ? new MDir(s, p, n) : new MFile(s, p, n)];
            }
        }
        async *values() { for await (const [, h] of this.entries()) yield h; }
        async *keys() { for await (const [n] of this.entries()) yield n; }
        [Symbol.asyncIterator]() { return this.entries(); }
        async isSameEntry(o) { return o instanceof MDir && o.store === this.store && o.path === this.path; }
        async resolve(o) { return o && o.store === this.store && under(o.path, this.path) ? segsOf(o.path).slice(segsOf(this.path).length) : null; }
        queryPermission(d) { return this.store.real.queryPermission ? this.store.real.queryPermission(d) : 'granted'; }
        requestPermission(d) { return this.store.real.requestPermission ? this.store.real.requestPermission(d) : 'granted'; }
    }

    class MFile {
        constructor(store, path, name) { this.store = store; this.path = path; this.name = name; this.kind = 'file'; }
        async getFile() {
            const f = await (await this.store.localFile(this.path)).getFile();
            return new File([f], this.name, { type: mimeOf(this.name), lastModified: f.lastModified });
        }
        async createWritable(opts) {
            const s = this.store, path = this.path;
            const w = await (await s.localFile(path, true)).createWritable(opts);
            return {
                write: (d) => w.write(d),
                seek: (p) => w.seek(p),
                truncate: (n) => w.truncate(n),
                abort: (r) => w.abort(r),
                async close() { await w.close(); s.enqueue({ op: 'put', path }); },
            };
        }
        async isSameEntry(o) { return o instanceof MFile && o.store === this.store && o.path === this.path; }
        queryPermission(d) { return this.store.root.queryPermission(d); }
        requestPermission(d) { return this.store.root.requestPermission(d); }
    }

    /* ------------------------------------------------------------- opening */

    const stores = new Map();
    const safeKey = (name) => String(name || 'folder').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120) || 'folder';

    /* The stand-in for `folder`, or the folder itself where the browser has no
     * private storage. progress({ done, total, text }) hears the first copy. */
    async function open(folder, progress = () => {}) {
        if (!folder || folder instanceof MDir) return folder;
        if (!navigator.storage || !navigator.storage.getDirectory) return folder;
        try {
            const known = stores.get(folder.name);
            if (known && (await known.real.isSameEntry(folder).catch(() => false))) return known.root;
            if (navigator.storage.persist) navigator.storage.persist().catch(() => {});
            const top = await (await navigator.storage.getDirectory()).getDirectoryHandle('canvasxp', { create: true });
            const ws = await top.getDirectoryHandle(safeKey(folder.name), { create: true });
            const files = await ws.getDirectoryHandle('files', { create: true });
            const store = new Store(folder, ws, files, await readJson(ws, 'state.json'), await readJson(ws, 'pending.json'));
            stores.set(folder.name, store);
            if (!store.ready) await store.copyAll(progress);
            store.pump(); // what was still waiting when the page last closed
            return store.root;
        } catch (e) {
            console.warn('CanvasXP: the working copy could not be made; working on the folder itself', e);
            return folder;
        }
    }
    const storeOf = (h) => (h instanceof MDir ? h.store : null);

    window.XPStore = {
        open,
        // The folder compared with the copy, in the background; resolves to the top-level folders that changed.
        reconcile: (h) => (storeOf(h) ? storeOf(h).reconcile() : Promise.resolve([])),
        idle: (h) => (storeOf(h) ? storeOf(h).idle() : Promise.resolve()),
        status: (h) => (storeOf(h) ? storeOf(h).status() : null),
        onStatus: (h, fn) => { const s = storeOf(h); if (s) s.listeners.add(fn); return () => s && s.listeners.delete(fn); },
        real: (h) => (storeOf(h) ? storeOf(h).real : h),
        isCopy: (h) => Boolean(storeOf(h)),
    };
})();
