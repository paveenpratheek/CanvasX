/* Draws CanvasXP's PNG icons from its SVGs (t-bea4bb5b8d), with Edge headless:
 *
 *   node xp/icons/render.mjs
 *
 * icon.svg (rounded) -> icon-192.png, icon-512.png; icon-full.svg (full bleed,
 * the mark inside the maskable safe circle) -> icon-maskable-512.png and the
 * apple-touch icon-180.png. The PNGs are kept in the repository, so a build
 * needs no browser; run this again only after changing an SVG.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-full.svg', 'icon-maskable-512.png', 512], ['icon-full.svg', 'icon-180.png', 180]];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-icons-'));
const port = 9300 + Math.floor(Math.random() * 400);
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${tmp}`, 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 50 && !ws; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { ws = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page').webSocketDebuggerUrl; } catch (_) { /* not up yet */ }
}
const sock = new WebSocket(ws);
await new Promise((r) => sock.addEventListener('open', r));
let n = 0;
const waiting = new Map();
sock.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; waiting.set(id, r); sock.send(JSON.stringify({ id, method, params })); });
try {
  await cdp('Page.enable');
  await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [src, out, size] of OUT) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    const svg = fs.readFileSync(path.join(HERE, src), 'utf8');
    const html = `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`;
    await cdp('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
    await new Promise((r) => setTimeout(r, 400));
    const shot = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    fs.writeFileSync(path.join(HERE, out), Buffer.from(shot.result.data, 'base64'));
    console.log(`${out} (${size}x${size})`);
  }
} finally {
  edge.kill();
  setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* Edge still holds it */ } process.exit(0); }, 500);
}
