const fs = require('fs');
const path = require('path');
const root = process.cwd();
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const required = ['index.html', 'styles.css', 'core.js', 'catalogue.js', 'app.js', 'auth-gate.js', 'supabase-config.js'];
for (const name of required) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error(`Fichier requis absent à la racine : ${name}`);
  fs.copyFileSync(source, path.join(out, name));
}
for (const name of ['politique-confidentialite.html', 'sw.js', 'manifest.webmanifest']) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, name));
}
for (const dir of ['icons', 'assets', 'vendor', 'models']) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(out, dir), { recursive: true });
}
console.log('JuriskPro web assets copied to www.');
