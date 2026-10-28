const fs = require('fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');
let depth = 0, minDepth = 0, inStr = false, strChar = '';
for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inStr) { if (c === strChar && content[i-1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth < minDepth) minDepth = depth; }
}
console.log(`${file}: final depth=${depth}, min depth=${minDepth}`);
if (depth !== 0) { console.log('ERROR: Unbalanced braces!'); process.exit(1); }
else console.log('OK: Braces balanced');
