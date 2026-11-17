/* CanvasX, NoteX and RAGX in one tab (t-6b0606000f).
 *
 * The switcher - CanvasX | NoteX | RAGX - sits on the home screen and at the
 * bottom left of a canvas. NoteX and RAGX are NoteX Studio's: when the studio
 * answers on this PC, its page opens in a frame over CanvasX, which stays
 * open behind it, and the studio's own setup runs there the first time.
 * When it does not answer, a dialog sets it up or starts it (t-699030acb8):
 * CanvasX writes a script into a folder the user chooses, and shows the one
 * command beside it, then carries on once the studio answers.
 *
 * The studio answers /api/hello only to CanvasX's own addresses, and lets
 * only those frame its page; CanvasX never holds the studio's token
 * (NoteX Studio t-c614bd5011). CanvasXP has none of this (xp/make.js).
 */
(() => {
  const REPO = 'https://github.com/paveenpratheek/NoteX-Studio.git';
  const STUDIO = (() => {
    try { const u = new URL(localStorage.getItem('canvasx-studio-url') || ''); if (/^https?:$/.test(u.protocol)) return u.origin; } catch (_) { /* the default */ }
    return 'http://127.0.0.1:7075';
  })();
  // The addresses NoteX Studio accepts with no setting; another is passed with --canvasx-origin.
  const KNOWN = ['http://127.0.0.1:9075', 'http://localhost:9075'];
  const ORIGIN = location.origin;
  const FLAG = KNOWN.includes(ORIGIN) || !/^https?:\/\/[A-Za-z0-9.\-\[\]:]+$/.test(ORIGIN) ? '' : ` --canvasx-origin ${ORIGIN}`;
  const WINDOWS = /win/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const VIEWS = [['canvasx', 'CanvasX'], ['notex', 'NoteX'], ['rag', 'RAGX']];

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let view = 'canvasx';
  let frame = null;
  let frameReady = false;
  let pending = null; // the view asked for while the dialog is open
  const switches = [];

  /* ------------------------------------------------------------ hello */

  async function hello() {
    try {
      const r = await fetch(`${STUDIO}/api/hello`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.studio === 'NoteX Studio' ? d : null;
    } catch (_) { return null; }
  }

  /* -------------------------------------------------------- switcher */

  function makeSwitch(where) {
    const nav = el('nav', `app-switch ${where}`);
    nav.setAttribute('aria-label', 'CanvasX, NoteX and RAGX');
    for (const [id, label] of VIEWS) {
      const b = el('button', 'app-switch-btn', label);
      b.type = 'button';
      b.dataset.view = id;
      b.title = id === 'canvasx' ? 'Your canvases' : id === 'notex' ? 'NoteX: the agent on your canvases, your inbox, your phone' : 'RAGX: ask your files';
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
  }

  /* ----------------------------------------------------------- the frame */

  const layer = el('section', 'apps-layer');
  layer.id = 'apps-layer';
  layer.hidden = true;
  layer.setAttribute('aria-label', 'NoteX Studio');

  // The studio page takes CanvasX's light or dark mode, not the system's.
  const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const tell = (msg) => { if (frame && frameReady) frame.contentWindow.postMessage({ notexStudio: 1, ...msg }, STUDIO); };
  new MutationObserver(() => tell({ theme: themeNow() })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function openFrame(id) {
    if (!frame) {
      frame = el('iframe', 'apps-frame');
      frame.title = 'NoteX Studio';
      frame.allow = 'clipboard-write';
      frame.src = `${STUDIO}/?embed=1&view=${encodeURIComponent(id)}&theme=${themeNow()}`;
      frame.addEventListener('load', () => { frameReady = true; tell({ theme: themeNow() }); });
      layer.prepend(frame);
    } else {
      tell({ show: id, theme: themeNow() });
    }
    view = id;
    paint();
  }

  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== STUDIO) return;
    const m = e.data;
    if (!m || m.notexStudio !== 1) return;
    if (m.event === 'ready') { frameReady = true; tell({ theme: themeNow() }); }
    if (m.event === 'show' && m.view === 'canvasx') { view = 'canvasx'; paint(); }
  });

  async function go(id) {
    if (id === 'canvasx') { view = 'canvasx'; paint(); return; }
    if (frame) { openFrame(id); return; }
    const hi = await hello();
    if (hi) openFrame(id);
    else { pending = id; openDialog(); }
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
        'title NoteX Studio setup',
        'cd /d "%~dp0"',
        'where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com/downloads and run this again. & start "" https://git-scm.com/downloads & pause & exit /b 1)',
        'where node >nul 2>nul || (echo Node.js is not installed. Get Node.js 24 from https://nodejs.org and run this again. & start "" https://nodejs.org/en/download & pause & exit /b 1)',
        'for /f "tokens=1 delims=." %%v in (\'node -p "process.versions.node"\') do set NODEMAJOR=%%v',
        'if %NODEMAJOR% LSS 24 (echo NoteX Studio needs Node.js 24 or newer. & start "" https://nodejs.org/en/download & pause & exit /b 1)',
        `if not exist "NoteX Studio\\package.json" git clone --recursive ${REPO} "NoteX Studio" || (echo The download did not finish. & pause & exit /b 1)`,
        'cd "NoteX Studio"',
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
      '[ "$(node -p \'process.versions.node.split(".")[0]\')" -ge 24 ] || { echo "NoteX Studio needs Node.js 24 or newer"; exit 1; }',
      `[ -f "NoteX Studio/package.json" ] || git clone --recursive ${REPO} "NoteX Studio" || exit 1`,
      'cd "NoteX Studio" || exit 1',
      `exec node studio/start.js${FLAG}`,
      '',
    ].join('\n');
  }

  function startScript() {
    return WINDOWS
      ? ['@echo off', 'title NoteX Studio', 'cd /d "%~dp0"', `node studio\\start.js${FLAG}`, 'pause', ''].join('\r\n')
      : ['#!/bin/sh', 'cd "$(dirname "$0")" || exit 1', `exec node studio/start.js${FLAG}`, ''].join('\n');
  }

  const SETUP_FILE = WINDOWS ? 'NoteX Studio setup.cmd' : 'NoteX Studio setup.sh';
  const START_FILE = WINDOWS ? 'Start NoteX Studio.cmd' : 'Start NoteX Studio.sh';
  const setupCommand = () => `git clone --recursive ${REPO} "NoteX Studio"${WINDOWS ? ';' : ' &&'} cd "NoteX Studio"${WINDOWS ? ';' : ' &&'} node studio/start.js${FLAG}`;
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

  function commandBox(cmd) {
    const box = el('div', 'apps-cmd');
    const code = el('code', null, cmd);
    const copy = el('button', 'home-btn', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cmd); copy.textContent = 'Copied'; } catch (_) { copy.textContent = 'Select and copy it'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 2000);
    });
    box.append(code, copy);
    return box;
  }

  function option({ title, text, button, file, script, command, check }) {
    const card = el('div', 'apps-option');
    card.append(el('h3', null, title), el('p', null, text));
    const pick = el('button', 'home-btn primary', button);
    pick.type = 'button';
    const result = el('p', 'apps-result');
    pick.addEventListener('click', async () => {
      if (!window.showDirectoryPicker) {
        download(file, script());
        result.textContent = `${file} is downloading. Move it into the folder for NoteX Studio and ${WINDOWS ? 'double-click it' : `run it there with: sh "${file}"`}.`;
        return;
      }
      let dir;
      try { dir = await window.showDirectoryPicker({ id: 'notex-studio', mode: 'readwrite' }); } catch (e) { if (e.name !== 'AbortError') result.textContent = e.message; return; }
      if (check) { const bad = await check(dir); if (bad) { result.textContent = bad; result.classList.add('bad'); return; } }
      result.classList.remove('bad');
      try {
        await writeInto(dir, file, script());
        result.textContent = `${file} is in ${dir.name}. ${WINDOWS ? 'Double-click it there' : `Run it there with: sh "${file}"`} - a terminal opens and stays open while NoteX Studio runs.`;
      } catch (e) {
        download(file, script());
        result.textContent = `The browser would not write ${file} into ${dir.name}, so it is downloading instead - move it there and ${WINDOWS ? 'double-click it' : 'run it'}.`;
      }
    });
    card.append(pick, result, el('p', 'apps-or', 'Or open a terminal in that folder and paste:'), commandBox(command()));
    return card;
  }

  /* An installed NoteX Studio is a folder whose package.json says so. */
  async function isStudio(dir) {
    try {
      const f = await (await dir.getFileHandle('package.json')).getFile();
      if (JSON.parse(await f.text()).name === 'notex-studio') return null;
    } catch (_) { /* not one */ }
    return `${dir.name} is not a NoteX Studio folder - choose the folder with its package.json, or set it up with the first option.`;
  }

  function openDialog() {
    dialog.replaceChildren();
    const head = el('div', 'apps-dialog-head');
    const h = el('h2', null, 'Set up NoteX and RAGX');
    h.id = 'apps-dialog-title';
    const close = el('button', 'home-btn', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    head.append(h, close);
    dialog.append(head);
    const lead = el('p', 'apps-lead');
    lead.textContent = `NoteX and RAGX run on this PC, in NoteX Studio. CanvasX did not find it at ${STUDIO.replace(/^https?:\/\//, '')} - it is not running, or not installed yet.`;
    dialog.append(lead);
    if (location.protocol === 'file:') {
      dialog.append(el('p', 'apps-result bad', 'CanvasX is open as a file, which NoteX Studio cannot reach. Open it from http://localhost:9075 instead - NoteX Studio serves it there once it runs.'));
    }
    const opts = el('div', 'apps-options');
    opts.append(
      option({
        title: 'Setup NoteX and RAGX',
        text: 'Choose a folder to install NoteX Studio in. CanvasX writes a setup script there: run it once, and it checks Git and Node.js, downloads NoteX Studio and starts it. Its setup then opens here, checks and installs the rest, and asks to start NoteX and RAGX.',
        button: 'Select directory…', file: SETUP_FILE, script: setupScript, command: setupCommand,
      }),
      option({
        title: 'Installed already? Start it',
        text: 'Choose the NoteX Studio folder. CanvasX writes a script there that starts NoteX Studio for this CanvasX.',
        button: 'Select directory…', file: START_FILE, script: startScript, command: startCommand, check: isStudio,
      }),
    );
    dialog.append(opts);
    const wait = el('p', 'apps-wait', 'Waiting for NoteX Studio to start…');
    dialog.append(wait);
    if (!dialog.open) dialog.showModal();
    clearInterval(polling);
    polling = setInterval(async () => {
      if (!dialog.open) { clearInterval(polling); return; }
      const hi = await hello();
      if (!hi || !dialog.open) return;
      clearInterval(polling);
      wait.textContent = 'NoteX Studio is running.';
      dialog.close();
      openFrame(pending || 'notex');
    }, 2000);
  }

  /* ------------------------------------------------------------- go */

  function init() {
    // Home: the switcher where the name was; the name stays for CanvasXP's build to find.
    const header = document.querySelector('.home-header');
    if (header) { header.classList.add('has-switch'); header.prepend(makeSwitch('home')); }
    layer.append(makeSwitch('layer'));
    document.body.append(makeSwitch('floating'), layer, dialog);
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
