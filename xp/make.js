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
for (const f of ['script.js', 'style.css', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(APP, f), path.join(SITE, f));
for (const f of ['xp.js', 'xp.css', 'manifest.json']) fs.copyFileSync(path.join(XP, f), path.join(SITE, f));
fs.writeFileSync(path.join(SITE, 'sw.js'), fs.readFileSync(path.join(XP, 'sw.js'), 'utf8').replace('__VERSION__', version));

let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const swap = (from, to) => {
  if (!from.test(html)) throw new Error(`make.js: index.html no longer has ${from}`);
  html = html.replace(from, to);
};
swap(/<html lang="en">/, '<html lang="en" data-edition="portable">');
swap(/<title>[^<]*<\/title>/, '<title>CanvasXP</title>');
swap(/(<link rel="stylesheet" href="style\.css\?v=[^"]*">)/, `$1\n    <link rel="stylesheet" href="xp.css?v=${version}">`);
swap(/(<script src="script\.js\?v=[^"]*"><\/script>)/, `$1\n    <script src="xp.js?v=${version}"></script>`);
swap(/<h1>CanvasX<\/h1>/, '<h1>CanvasXP</h1>');
fs.writeFileSync(path.join(SITE, 'index.html'), html);
console.log(`CanvasXP built in ${path.relative(process.cwd(), SITE) || SITE} (version ${version}).`);
