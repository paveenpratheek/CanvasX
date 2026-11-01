/* Builds CanvasXP into xp/site from CanvasX's own files (t-66914c8b0f):
 *
 *   node xp/make.js
 *
 * CanvasX's page, script, styles and icons are copied as they are; only the
 * page's head changes - its name, its manifest, data-edition="portable",
 * and xp.css and xp.js after CanvasX's own. Netlify runs this and publishes
 * xp/site (netlify.toml), so nothing of the repository but the app goes out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const XP = path.dirname(fileURLToPath(import.meta.url));
const APP = path.dirname(XP);
const SITE = path.join(XP, 'site');
const version = Date.now().toString(36);

// Emptied rather than removed: a local server for the phone may be serving from it.
fs.mkdirSync(SITE, { recursive: true });
for (const f of fs.readdirSync(SITE)) fs.rmSync(path.join(SITE, f), { recursive: true, force: true });
for (const f of ['script.js', 'style.css']) fs.copyFileSync(path.join(APP, f), path.join(SITE, f));
for (const f of ['store.js', 'xp.js', 'xp.css', 'manifest.json']) fs.copyFileSync(path.join(XP, f), path.join(SITE, f));
// CanvasXP's own icons, not CanvasX's (t-bea4bb5b8d); icons/render.mjs draws the PNGs from the SVGs.
for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-180.png', 'favicon.svg']) fs.copyFileSync(path.join(XP, 'icons', f), path.join(SITE, f));
fs.writeFileSync(path.join(SITE, 'sw.js'), fs.readFileSync(path.join(XP, 'sw.js'), 'utf8').replace('__VERSION__', version));

let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const swap = (from, to) => {
  if (!from.test(html)) throw new Error(`make.js: index.html no longer has ${from}`);
  html = html.replace(from, to);
};
swap(/<html lang="en">/, '<html lang="en" data-edition="portable">');
swap(/<title>[^<]*<\/title>/, '<title>CanvasXP</title>');
// The keyboard makes the page shorter, so the chat sheet stays above it instead of the browser moving the page.
swap(/(<meta name="viewport" content="[^"]*)(")/, '$1, interactive-widget=resizes-content$2');
// Every build is a new address for CanvasX's own files too, so a phone never keeps an old copy.
swap(/<link rel="stylesheet" href="style\.css\?v=[^"]*">/, `<link rel="stylesheet" href="style.css?v=${version}">\n    <link rel="stylesheet" href="xp.css?v=${version}">`);
swap(/<script src="script\.js\?v=[^"]*"><\/script>/, `<script src="script.js?v=${version}"></script>\n    <script src="store.js?v=${version}"></script>\n    <script src="xp.js?v=${version}"></script>`);
swap(/<h1>CanvasX<\/h1>/, '<h1>CanvasXP</h1>');
swap(/<meta name="theme-color" content="[^"]*">/, '<meta name="theme-color" content="#141418">');
swap(/<link rel="apple-touch-icon" href="[^"]*">/, '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n    <link rel="apple-touch-icon" href="icon-180.png">');
fs.writeFileSync(path.join(SITE, 'index.html'), html);
console.log(`CanvasXP built in ${path.relative(process.cwd(), SITE) || SITE} (version ${version}).`);
