// Copie JSZip, jsPDF et Supabase depuis node_modules vers ./vendor (chargés en local, sans CDN).
// Usage : npm install && npm run vendor   (puis versionner le dossier vendor/ pour Netlify)
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const out = path.join(root, 'vendor');
fs.mkdirSync(out, { recursive: true });
const files = {
  'jszip.min.js': 'node_modules/jszip/dist/jszip.min.js',
  'jspdf.umd.min.js': 'node_modules/jspdf/dist/jspdf.umd.min.js',
  'supabase.js': 'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
};
let missing = 0;
for (const [dest, src] of Object.entries(files)) {
  const from = path.join(root, src);
  if (!fs.existsSync(from)) { console.warn('Absent (npm install ?) :', src); missing++; continue; }
  fs.copyFileSync(from, path.join(out, dest));
}
console.log(missing ? 'vendor : copie incomplète (le CDN servira de secours).' : 'vendor : 3 bibliothèques copiées.');
