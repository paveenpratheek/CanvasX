/* CanvasX Studio's shell: CanvasX, NoteX and RAGX in one tab (t-6b0606000f),
 * in AutomatU's look (t-596cee6ec1).
 *
 * - A sidebar beside the front page and beside NoteX's and RAGX's pages:
 *   the mark and CanvasX Studio, the three views, the list that goes with
 *   the open one, and the studio's state with Setup at its foot. On an open
 *   canvas the sidebar steps aside and the compact switcher stays top left,
 *   where the user put it (t-e602bd404b).
 * - The front page: a crumb and a serif title, a search, the canvases as
 *   cards, a click picking one and a panel telling its totems (t-8ffd76e25a).
 * - NoteX and RAGX are CanvasX Studio's: when it answers, its page opens in
 *   a frame beside the sidebar, the canvas kept open behind. When it does
 *   not, a note says the server is not running (t-cd919a268f), and a dialog
 *   sets it up or starts it (t-699030acb8).
 *
 * The studio answers /api/hello only to CanvasX's own addresses and lets
 * only those frame its page; CanvasX never holds its token (CanvasX Studio's
 * t-c614bd5011). CanvasXP has none of this (xp/make.js).
 */
(() => {
  const NAME = 'CanvasX Studio';
  const REPO = 'https://github.com/paveenpratheek/NoteX-Studio.git'; // the repository keeps its name
  const FOLDER = 'CanvasX Studio';
  const STUDIO = (() => {
    try { const u = new URL(localStorage.getItem('canvasx-studio-url') || ''); if (/^https?:$/.test(u.protocol)) return u.origin; } catch (_) { /* the default */ }
    return 'http://127.0.0.1:7075';
  })();
  // The addresses the studio accepts with no setting; another is passed with --canvasx-origin.
  const KNOWN = ['http://127.0.0.1:9075', 'http://localhost:9075'];
  const ORIGIN = location.origin;
  const FLAG = KNOWN.includes(ORIGIN) || !/^https?:\/\/[A-Za-z0-9.\-\[\]:]+$/.test(ORIGIN) ? '' : ` --canvasx-origin ${ORIGIN}`;
  const WINDOWS = /win/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const LAUNCHER_KEY = 'canvasx-studio-launcher';
  const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private window */ } } };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svg = (markup) => { const t = document.createElement('template'); t.innerHTML = markup.trim(); const s = t.content.firstElementChild; s.setAttribute('aria-hidden', 'true'); return s; };
  const ICON = {
    mark: '<svg width="22" height="22" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    canvasx: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/></svg>',
    notex: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    rag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    close: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  };
  const VIEWS = [['canvasx', 'CanvasX', 'Your canvases'], ['notex', 'NoteX', 'NoteX: places, inbox, agents, phone'], ['rag', 'RAGX', 'RAGX: ask your files']];

  let view = 'canvasx';
  let frame = null;
  let frameReady = false;
  let pending = null; // the view asked for while the dialog is open
  const studio = { up: null, setupDone: false, engines: [] };
  const switches = [];

  /* ------------------------------------------------------------ hello */

  async function hello() {
    try {
      const r = await fetch(`${STUDIO}/api/hello`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      if (!r.ok) return null;
      const d = await r.json();
      // An older studio still calls itself NoteX Studio.
      return d && (d.studio === NAME || d.studio === 'NoteX Studio') ? d : null;
    } catch (_) { return null; }
  }

  async function refresh() {
    const hi = await hello();
    const was = studio.up;
    studio.up = Boolean(hi);
    studio.setupDone = Boolean(hi && hi.setupDone);
    studio.engines = (hi && hi.engines) || [];
    if (hi && hi.launcher) store.set(LAUNCHER_KEY, '1');
    paintStatus();
    if (studio.up) hideNote();
    else if (was !== false && !frame) showNote();
    return hi;
  }

  /* ---------------------------------------------------------- sidebar */

  const side = el('aside', 'cxs-side');
  side.setAttribute('aria-label', NAME);
  const recentList = el('div', 'cxs-rows');
  const statusName = el('span', 'cxs-st-name');
  const statusMeta = el('span', 'cxs-st-meta');
  const statusDot = el('span', 'cxs-dot');

  function buildSide() {
    const brand = el('div', 'cxs-brand');
    brand.append(svg(ICON.mark), el('span', 'cxs-brand-name', NAME));
    const nav = el('nav', 'cxs-nav');
    nav.setAttribute('aria-label', 'CanvasX, NoteX and RAGX');
    for (const [id, label, hint] of VIEWS) {
      const b = el('button', 'cxs-tab');
      b.type = 'button';
      b.dataset.view = id;
      b.title = hint;
      const off = el('span', 'cxs-off', 'off');
      b.append(svg(ICON[id]), el('span', 'cxs-tab-l', label), off);
      b.addEventListener('click', () => go(id));
      nav.append(b);
    }
    switches.push(nav);
    const list = el('div', 'cxs-list');
    const add = el('button', 'cxs-add');
    add.type = 'button';
    add.append(svg(ICON.plus), 'New canvas');
    add.addEventListener('click', () => { const b = document.getElementById('btn-new-fabric'); if (b && targetWorkspace()) b.click(); else openWorkspace(); });
    list.append(el('div', 'cxs-h', 'Recent canvases'), recentList, add);
    const foot = el('div', 'cxs-foot');
    const st = el('div', 'cxs-status');
    const words = el('span', 'cxs-st');
    words.append(statusName, statusMeta);
    st.append(statusDot, words);
    const setup = el('button', 'cxs-row-btn');
    setup.type = 'button';
    setup.append(svg(ICON.gear), 'Setup');
    setup.addEventListener('click', openSetup);
    foot.append(st, setup);
    side.append(brand, nav, list, foot);
  }

  function paintStatus() {
    const up = studio.up;
    statusDot.className = `cxs-dot ${up ? 'on' : 'off'}`;
    statusName.textContent = up == null ? `Looking for ${NAME}…` : up ? `${NAME} is up` : 'Server not running';
    const running = studio.engines.filter((e) => e.state === 'running').map((e) => e.label);
    statusMeta.textContent = up ? (running.length ? `${running.join(' · ')} running` : 'NoteX and RAGX stopped') : STUDIO.replace(/^https?:\/\//, '');
    document.body.classList.toggle('cxs-down', up === false);
  }

  /* -------------------------------------------- the compact switcher */

  // On an open canvas: CanvasX · NoteX · RAGX, top left (t-e602bd404b).
  function makePill() {
    const nav = el('nav', 'app-switch top');
    nav.setAttribute('aria-label', 'CanvasX, NoteX and RAGX');
    for (const [id, label, hint] of VIEWS) {
      const b = el('button', 'app-switch-btn', label);
      b.type = 'button';
      b.dataset.view = id;
      b.title = hint;
      b.addEventListener('click', () => go(id));
      nav.append(b);
    }
    switches.push(nav);
    return nav;
  }

  function paint() {
    for (const nav of switches) {
      for (const b of nav.children) {
        const on = b.dataset.view === view;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    }
    layer.hidden = view === 'canvasx';
    document.body.classList.toggle('apps-open', view !== 'canvasx');
    side.dataset.view = view;
  }

  /* ----------------------------------------------------------- the frame */

  const layer = el('section', 'apps-layer');
  layer.id = 'apps-layer';
  layer.hidden = true;
  layer.setAttribute('aria-label', NAME);

  // The studio page takes CanvasX's light or dark mode, not the system's.
  const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const tell = (msg) => { if (frame && frameReady) frame.contentWindow.postMessage({ notexStudio: 1, ...msg }, STUDIO); };
  new MutationObserver(() => tell({ theme: themeNow() })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function openFrame(id) {
    if (!frame) {
      frame = el('iframe', 'apps-frame');
      frame.title = NAME;
      frame.allow = 'clipboard-write';
      frame.src = `${STUDIO}/?embed=1&view=${encodeURIComponent(id)}&theme=${themeNow()}`;
      frame.addEventListener('load', () => { frameReady = true; tell({ theme: themeNow() }); });
      layer.prepend(frame);
    } else {
      tell({ show: id, theme: themeNow() });
    }
    view = id === 'setup' ? (view === 'canvasx' ? 'notex' : view) : id;
    paint();
  }

  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== STUDIO) return;
    const m = e.data;
    if (!m || m.notexStudio !== 1) return;
    if (m.event === 'ready') { frameReady = true; tell({ theme: themeNow() }); }
    if (m.event === 'show' && m.view === 'canvasx') { view = 'canvasx'; paint(); }
    if (m.event === 'setup-done') refresh();
  });

  async function go(id) {
    if (id === 'canvasx') { view = 'canvasx'; paint(); return; }
    if (frame) { openFrame(id); return; }
    const hi = await refresh();
    if (hi) openFrame(id);
    else { pending = id; openDialog(); }
  }

  async function openSetup() {
    const hi = studio.up ? true : await refresh();
    if (hi) openFrame('setup');
    else { pending = 'notex'; openDialog(); }
  }

  /* -------------------------------------------- server not running */

  const note = el('section', 'cxs-note');
  note.setAttribute('role', 'alertdialog');
  note.setAttribute('aria-labelledby', 'cxs-note-title');
  note.hidden = true;
  let noteDismissed = false;
  let starting = null;

  function buildNote() {
    const head = el('div', 'cxs-note-head');
    const words = el('div', 'cxs-note-words');
    const title = el('div', 'cxs-note-title', 'The server is not running');
    title.id = 'cxs-note-title';
    const text = el('div', 'cxs-note-text', 'NoteX and RAGX need it. Your canvases open and save without it.');
    words.append(title, text);
    const x = el('button', 'cxs-icon-btn');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.append(svg(ICON.close));
    x.addEventListener('click', () => { noteDismissed = true; hideNote(); });
    head.append(el('span', 'cxs-dot hot'), words, x);
    const row = el('div', 'cxs-note-row');
    const start = el('button', 'cxs-btn dark');
    start.type = 'button';
    start.append(svg(ICON.play), 'Start the server');
    start.addEventListener('click', () => startServer(text));
    const other = el('button', 'cxs-btn');
    other.type = 'button';
    other.textContent = 'Not installed?';
    other.addEventListener('click', () => { pending = 'notex'; openDialog(); });
    row.append(start, other);
    note.append(head, row);
  }

  function showNote() { if (!noteDismissed) note.hidden = false; }
  function hideNote() { note.hidden = true; }

  /* The studio's launcher, where its setup registered one on this PC, starts
   * it from a link; anywhere else the dialog's Start it does (t-cd919a268f). */
  function startServer(text) {
    if (store.get(LAUNCHER_KEY) !== '1') { pending = 'notex'; openDialog({ start: true }); return; }
    text.textContent = 'Starting… your browser may ask to open CanvasX Studio.';
    const a = el('a');
    a.href = 'canvasx-studio://start';
    document.body.append(a);
    a.click();
    a.remove();
    clearInterval(starting);
    let tries = 0;
    starting = setInterval(async () => {
      if (++tries > 40) { clearInterval(starting); text.textContent = 'It did not start. Open the dialog to start it another way.'; return; }
      if (await refresh()) clearInterval(starting);
    }, 1500);
  }

  /* ---------------------------------------------------------- the dialog */

  const dialog = el('dialog', 'apps-dialog');
  dialog.id = 'apps-dialog';
  dialog.setAttribute('aria-labelledby', 'apps-dialog-title');
  let polling = null;

  function setupScript() {
    if (WINDOWS) {
      return [
        '@echo off',
        'setlocal',
        `title ${NAME} setup`,
        'cd /d "%~dp0"',
        'where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com/downloads and run this again. & start "" https://git-scm.com/downloads & pause & exit /b 1)',
        'where node >nul 2>nul || (echo Node.js is not installed. Get Node.js 24 from https://nodejs.org and run this again. & start "" https://nodejs.org/en/download & pause & exit /b 1)',
        'for /f "tokens=1 delims=." %%v in (\'node -p "process.versions.node"\') do set NODEMAJOR=%%v',
        `if %NODEMAJOR% LSS 24 (echo ${NAME} needs Node.js 24 or newer. & start "" https://nodejs.org/en/download & pause & exit /b 1)`,
        `if not exist "${FOLDER}\\package.json" git clone --recursive ${REPO} "${FOLDER}" || (echo The download did not finish. & pause & exit /b 1)`,
        `cd "${FOLDER}"`,
        `node studio\\start.js${FLAG}`,
        'pause',
        '',
      ].join('\r\n');
    }
    return [
      '#!/bin/sh',
      'cd "$(dirname "$0")" || exit 1',
      'command -v git >/dev/null || { echo "Git is not installed - get it from https://git-scm.com/downloads"; exit 1; }',
      'command -v node >/dev/null || { echo "Node.js is not installed - get Node.js 24 from https://nodejs.org"; exit 1; }',
      `[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 24 ] || { echo "${NAME} needs Node.js 24 or newer"; exit 1; }`,
      `[ -f "${FOLDER}/package.json" ] || git clone --recursive ${REPO} "${FOLDER}" || exit 1`,
      `cd "${FOLDER}" || exit 1`,
      `exec node studio/start.js${FLAG}`,
      '',
    ].join('\n');
  }

  function startScript() {
    return WINDOWS
      ? ['@echo off', `title ${NAME}`, 'cd /d "%~dp0"', `node studio\\start.js${FLAG}`, 'pause', ''].join('\r\n')
      : ['#!/bin/sh', 'cd "$(dirname "$0")" || exit 1', `exec node studio/start.js${FLAG}`, ''].join('\n');
  }

  const SETUP_FILE = WINDOWS ? `${NAME} setup.cmd` : `${NAME} setup.sh`;
  const START_FILE = WINDOWS ? `Start ${NAME}.cmd` : `Start ${NAME}.sh`;
  const setupCommand = () => `git clone --recursive ${REPO} "${FOLDER}"${WINDOWS ? ';' : ' &&'} cd "${FOLDER}"${WINDOWS ? ';' : ' &&'} node studio/start.js${FLAG}`;
  const startCommand = () => `npm start${FLAG ? ` --${FLAG}` : ''}`;

  /* The script written into the folder the user picks; a browser that
   * cannot, or will not write it, downloads it instead (t-699030acb8). */
  async function writeInto(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  function download(name, text) {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function commandBox(label, cmd) {
    const wrap = el('div', 'apps-cmd-wrap');
    wrap.append(el('div', 'apps-cmd-label', label));
    const box = el('div', 'apps-cmd');
    const code = el('code', null, cmd);
    const copy = el('button', 'cxs-btn', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cmd); copy.textContent = 'Copied'; } catch (_) { copy.textContent = 'Select it'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 2000);
    });
    box.append(code, copy);
    wrap.append(box);
    return wrap;
  }

  function option({ title, icon, steps, text, button, primary, file, script, check }) {
    const card = el('div', `apps-option${primary ? ' primary' : ''}`);
    const head = el('div', 'apps-option-head');
    const badge = el('span', 'apps-option-icon');
    badge.append(svg(ICON[icon]));
    head.append(badge, el('span', 'apps-option-title', title));
    card.append(head);
    if (steps) { const ol = el('ol', 'apps-steps'); for (const s of steps) ol.append(el('li', null, s)); card.append(ol); }
    if (text) card.append(el('p', null, text));
    const pick = el('button', `cxs-btn${primary ? ' dark' : ''}`, button);
    pick.type = 'button';
    const result = el('p', 'apps-result');
    pick.addEventListener('click', async () => {
      if (!window.showDirectoryPicker) {
        download(file, script());
        result.textContent = `${file} is downloading. Move it into the folder for ${NAME} and ${WINDOWS ? 'double-click it' : `run it there with: sh "${file}"`}.`;
        return;
      }
      let dir;
      try { dir = await window.showDirectoryPicker({ id: 'canvasx-studio', mode: 'readwrite' }); } catch (e) { if (e.name !== 'AbortError') result.textContent = e.message; return; }
      if (check) { const bad = await check(dir); if (bad) { result.textContent = bad; result.classList.add('bad'); return; } }
      result.classList.remove('bad');
      try {
        await writeInto(dir, file, script());
        result.textContent = `${file} is in ${dir.name}. ${WINDOWS ? 'Double-click it there' : `Run it there with: sh "${file}"`} - a terminal opens and stays open while ${NAME} runs.`;
      } catch (e) {
        download(file, script());
        result.textContent = `The browser would not write ${file} into ${dir.name}, so it is downloading instead - move it there and ${WINDOWS ? 'double-click it' : 'run it'}.`;
      }
    });
    card.append(pick, result);
    return card;
  }

  /* An installed studio is a folder whose package.json says so. */
  async function isStudio(dir) {
    try {
      const f = await (await dir.getFileHandle('package.json')).getFile();
      if (['notex-studio', 'canvasx-studio'].includes(JSON.parse(await f.text()).name)) return null;
    } catch (_) { /* not one */ }
    return `${dir.name} is not the ${NAME} folder - choose the folder with its package.json, or set it up instead.`;
  }

  function openDialog({ start = false } = {}) {
    dialog.replaceChildren();
    const head = el('div', 'apps-dialog-head');
    const words = el('div');
    const h = el('h2', null, `${NAME} isn't running`);
    h.id = 'apps-dialog-title';
    const lead = el('p', 'apps-lead');
    lead.append(`NoteX and RAGX run on this PC, in ${NAME}. CanvasX looked for it at `, el('code', null, STUDIO.replace(/^https?:\/\//, '')), ' and found nothing - it is stopped, or not installed yet.');
    words.append(el('div', 'apps-crumb', 'NoteX and RAGX'), h, lead);
    const close = el('button', 'cxs-icon-btn boxed');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.append(svg(ICON.close));
    close.addEventListener('click', () => dialog.close());
    head.append(words, close);
    dialog.append(head);
    if (location.protocol === 'file:') {
      dialog.append(el('p', 'apps-result bad', `CanvasX is open as a file, which ${NAME} cannot reach. Open it from http://localhost:9075 instead - ${NAME} serves it there once it runs.`));
    }
    const opts = el('div', 'apps-options');
    const setupOpt = option({
      title: 'Set it up on this PC', icon: 'down', primary: !start,
      steps: ['Choose a folder to install it in.', `Run ${SETUP_FILE} there once.`, 'Its setup opens here and does the rest.'],
      button: 'Choose a folder…', file: SETUP_FILE, script: setupScript,
    });
    const startOpt = option({
      title: 'Installed already? Start it', icon: 'play', primary: start,
      text: `Choose the ${NAME} folder. CanvasX writes ${START_FILE} there for this CanvasX - double-click it.`,
      button: 'Choose its folder…', file: START_FILE, script: startScript, check: isStudio,
    });
    opts.append(...(start ? [startOpt, setupOpt] : [setupOpt, startOpt]));
    dialog.append(opts);
    const more = el('details', 'apps-more');
    more.append(el('summary', null, 'Rather use a terminal?'), commandBox('Set it up, in the folder for it:', setupCommand()), commandBox(`Start it, in the ${NAME} folder:`, startCommand()));
    dialog.append(more);
    const wait = el('p', 'apps-wait', `Waiting for ${NAME} - this opens by itself once it starts.`);
    dialog.append(wait);
    if (!dialog.open) dialog.showModal();
    clearInterval(polling);
    polling = setInterval(async () => {
      if (!dialog.open) { clearInterval(polling); return; }
      const hi = await refresh();
      if (!hi || !dialog.open) return;
      clearInterval(polling);
      dialog.close();
      openFrame(pending || 'notex');
    }, 2000);
  }

  /* ------------------------------------------------- the front page */

  const targetWorkspace = () => { try { return typeof targetWorkspaceHandle !== 'undefined' ? targetWorkspaceHandle : null; } catch (_) { return null; } };
  const openWorkspace = () => { const b = document.getElementById('btn-open-workspace'); if (window.originalBtnOpenWorkspaceClick && targetWorkspace()) window.originalBtnOpenWorkspaceClick(); else if (b) b.click(); };

  const front = { picked: null, filter: 'all', query: '' };
  const titleBlock = el('div', 'cxs-head');
  const crumb = el('div', 'cxs-crumb', 'Workspace');
  const search = el('input', 'cxs-search-input');
  const filters = el('div', 'cxs-filters');
  const panel = el('aside', 'cxs-panel');
  const empty = el('div', 'cxs-empty');

  function buildFront() {
    const home = document.getElementById('home-screen');
    const header = home && home.querySelector('.home-header');
    const actions = header && header.querySelector('.home-actions');
    const content = document.getElementById('workspace-content');
    const grid = document.getElementById('fabrics-grid');
    if (!home || !header || !actions || !content || !grid) return;
    header.classList.add('has-switch');
    titleBlock.append(crumb, el('h2', 'cxs-title', 'Your canvases'));
    header.prepend(titleBlock);

    const label = el('label', 'cxs-search');
    label.append(svg(ICON.search), el('span', 'cxs-vh', 'Find a canvas'));
    search.type = 'search';
    search.placeholder = 'Find a canvas';
    search.addEventListener('input', () => { front.query = search.value.trim().toLowerCase(); applyFilter(); });
    label.append(search);
    const change = el('button', 'cxs-btn cxs-change', 'Change workspace');
    change.type = 'button';
    change.addEventListener('click', openWorkspace);
    const newBtn = document.getElementById('btn-new-fabric');
    actions.prepend(label);
    const theme = document.getElementById('btn-theme-home');
    if (theme) theme.after(change); else actions.append(change);
    if (newBtn) {
      newBtn.classList.add('cxs-new');
      for (const n of [...newBtn.childNodes]) if (n.nodeType === 3 && n.textContent.trim()) n.textContent = 'New canvas';
      actions.append(newBtn);
    }

    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Show');
    const body = el('div', 'cxs-body');
    grid.before(filters);
    grid.before(body);
    body.append(grid, panel);
    panel.hidden = true;

    empty.append(el('div', 'cxs-empty-title', 'Choose the folder your canvases live in'), el('p', null, 'CanvasX keeps each canvas in a folder of its own inside it. Your browser asks you once to allow it.'));
    const choose = el('button', 'cxs-btn dark', 'Choose a folder…');
    choose.type = 'button';
    choose.addEventListener('click', () => document.getElementById('btn-open-workspace').click());
    empty.append(choose);
    content.before(empty);

    // A click picks a canvas; Open the canvas or a double click opens it (t-8ffd76e25a).
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.fabric-card');
      if (!card || e.target.closest('.fabric-card-options-btn')) return;
      e.stopPropagation();
      e.preventDefault();
      pick(card.dataset.name);
    }, true);
    grid.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.fabric-card');
      if (card && !e.target.closest('.fabric-card-options-btn')) openCanvas(card.dataset.name);
    });
    new MutationObserver(decorate).observe(grid, { childList: true });
    new MutationObserver(paintWorkspace).observe(content, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(paintHome).observe(home, { attributes: true, attributeFilter: ['class'] });
    paintWorkspace();
    paintHome();
  }

  const cards = () => [...document.querySelectorAll('#fabrics-grid .fabric-card')];

  const when = (ms) => new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });

  /* When each canvas was last saved, from its fabric.json - read for its
   * metadata only - so the newest come first, as recent canvases do. */
  async function savedTimes(list) {
    const ws = targetWorkspace();
    if (!ws) return;
    await Promise.all(list.map(async (c) => {
      try {
        const f = await (await (await ws.getDirectoryHandle(c.dataset.name)).getFileHandle('fabric.json')).getFile();
        c.dataset.saved = String(f.lastModified);
        const p = c.querySelector('.fabric-card-info p');
        if (p) p.textContent = `${c.classList.contains('agent-card') ? 'Agent canvas' : 'Canvas'} · saved ${when(f.lastModified)}`;
      } catch (_) { c.dataset.saved = '0'; }
    }));
  }

  let decorating = null;
  let sorting = false;
  function decorate() {
    if (sorting) return;
    clearTimeout(decorating);
    decorating = setTimeout(async () => {
      const fresh = [];
      for (const c of cards()) {
        if (c.dataset.name) continue;
        const h = c.querySelector('.fabric-card-info h3');
        c.dataset.name = h ? h.textContent : '';
        c.tabIndex = 0;
        c.setAttribute('role', 'button');
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCanvas(c.dataset.name); else if (e.key === ' ') { e.preventDefault(); pick(c.dataset.name); } });
        fresh.push(c);
      }
      await savedTimes(fresh);
      const all = cards();
      const sorted = [...all].sort((a, b) => Number(b.dataset.saved || 0) - Number(a.dataset.saved || 0));
      if (sorted.some((c, i) => c !== all[i])) {
        sorting = true;
        const grid = document.getElementById('fabrics-grid');
        for (const c of sorted) grid.append(c);
        setTimeout(() => { sorting = false; }, 0);
      }
      paintFilters();
      applyFilter();
      paintRecent();
      if (front.picked && !cards().some((c) => c.dataset.name === front.picked)) { front.picked = null; panel.hidden = true; }
      if (front.picked) for (const c of cards()) c.classList.toggle('picked', c.dataset.name === front.picked);
    }, 60);
  }

  function paintFilters() {
    const all = cards();
    const agents = all.filter((c) => c.classList.contains('agent-card'));
    filters.replaceChildren();
    for (const [id, label] of [['all', `All · ${all.length}`], ['agent', `Agent canvases · ${agents.length}`], ['canvas', `Your canvases · ${all.length - agents.length}`]]) {
      const b = el('button', `cxs-chip${front.filter === id ? ' on' : ''}`, label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(front.filter === id));
      b.addEventListener('click', () => { front.filter = id; paintFilters(); applyFilter(); });
      filters.append(b);
    }
  }

  function applyFilter() {
    for (const c of cards()) {
      const agent = c.classList.contains('agent-card');
      const show = (front.filter === 'all' || (front.filter === 'agent') === agent) && (!front.query || c.dataset.name.toLowerCase().includes(front.query));
      c.hidden = !show;
    }
  }

  function paintRecent() {
    recentList.replaceChildren();
    const list = cards().slice(0, 6);
    if (!list.length) { recentList.append(el('div', 'cxs-empty-row', targetWorkspace() ? 'No canvases yet' : 'No workspace chosen')); return; }
    for (const c of list) {
      const b = el('button', `cxs-row${front.picked === c.dataset.name ? ' on' : ''}`);
      b.type = 'button';
      const nm = el('span', 'cxs-row-name');
      nm.append(el('span', `cxs-swatch${c.classList.contains('agent-card') ? ' agent' : ''}`), el('span', 'cxs-ellipsis', c.dataset.name));
      b.append(nm, el('span', 'cxs-row-n', c.classList.contains('agent-card') ? 'agent' : ''));
      b.addEventListener('click', () => { go('canvasx'); pick(c.dataset.name); });
      recentList.append(b);
    }
  }

  function paintWorkspace() {
    const ws = targetWorkspace();
    const open = !document.getElementById('workspace-content').classList.contains('hidden');
    document.body.classList.toggle('cxs-ws', open);
    crumb.replaceChildren('Workspace');
    if (ws) crumb.append(' · ', el('span', 'cxs-mono', ws.name));
    empty.hidden = open;
  }

  function paintHome() {
    const home = document.getElementById('home-screen');
    document.body.classList.toggle('cxs-home', !home.classList.contains('hidden'));
  }

  async function pick(name) {
    front.picked = name;
    for (const c of cards()) c.classList.toggle('picked', c.dataset.name === name);
    paintRecent();
    const card = cards().find((c) => c.dataset.name === name);
    if (!card) return;
    const agent = card.classList.contains('agent-card');
    panel.hidden = false;
    panel.replaceChildren();
    const box = el('div', 'cxs-panel-card');
    box.append(el('div', 'cxs-kicker', agent ? 'Agent canvas' : 'Canvas'), el('div', 'cxs-panel-title', name));
    const meta = el('div', 'cxs-panel-meta', 'Reading…');
    box.append(meta);
    const stats = el('div', 'cxs-stats');
    const totems = el('div', 'cxs-totems');
    box.append(stats, totems);
    const row = el('div', 'cxs-actions');
    const open = el('button', 'cxs-btn dark', 'Open the canvas');
    open.type = 'button';
    open.addEventListener('click', () => openCanvas(name));
    const nx = el('button', 'cxs-btn', 'Its places in NoteX');
    nx.type = 'button';
    nx.addEventListener('click', () => go('notex'));
    row.append(open, nx);
    box.append(row);
    panel.append(box);
    if (agent) panel.append(el('div', 'cxs-aside-note', 'The agent draws this canvas from its scripts. To edit it yourself, take it back from the agent with the canvas card’s menu.'));
    try {
      const dir = await targetWorkspace().getDirectoryHandle(name);
      const file = await (await dir.getFileHandle('fabric.json')).getFile();
      const data = JSON.parse(await file.text());
      if (front.picked !== name) return;
      const s = data.state || data;
      const all = Array.isArray(s.totems) ? s.totems : [];
      const tops = all.filter((t) => !t.parentTotemId);
      const n = (k) => (Array.isArray(s[k]) ? s[k].length : 0);
      meta.textContent = `Saved ${new Date(file.lastModified).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      for (const [v, k] of [[tops.length, tops.length === 1 ? 'totem' : 'totems'], [n('areas'), n('areas') === 1 ? 'box' : 'boxes'], [n('files'), n('files') === 1 ? 'file' : 'files']]) {
        const cell = el('div');
        cell.append(el('div', 'cxs-stat-v', String(v)), el('div', 'cxs-stat-k', k));
        stats.append(cell);
      }
      if (tops.length) {
        totems.append(el('div', 'cxs-kicker', 'Totems'));
        for (const t of tops.slice(0, 7)) {
          const subs = all.filter((x) => x.parentTotemId === t.id).length;
          const r = el('div', 'cxs-totem');
          r.append(el('span', 'cxs-ellipsis', t.name || 'Untitled'), el('span', 'cxs-totem-n', subs ? `${subs} sub-totem${subs === 1 ? '' : 's'}` : ''));
          totems.append(r);
        }
        if (tops.length > 7) totems.append(el('div', 'cxs-totem-more', `and ${tops.length - 7} more`));
      }
    } catch (_) {
      meta.textContent = 'Its details could not be read.';
    }
  }

  async function openCanvas(name) {
    try {
      const dir = await targetWorkspace().getDirectoryHandle(name);
      if (typeof openFabric === 'function') await openFabric(dir, name);
    } catch (e) { console.error(e); }
  }

  /* ------------------------------------------------------------- go */

  function init() {
    if (!document.querySelector('link[data-cxs-fonts]')) {
      const f = el('link');
      f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&display=swap';
      f.dataset.cxsFonts = '1';
      document.head.append(f);
    }
    document.body.classList.add('cxs');
    buildSide();
    buildNote();
    buildFront();
    document.body.append(side, makePill(), layer, note, dialog);
    paint();
    paintStatus();
    paintRecent();
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
