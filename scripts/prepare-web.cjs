const fs = require('fs');
const path = require('path');
const root = process.cwd();
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const required = ['index.html', 'styles.css', 'core.js', 'template-engine.js', 'layout-pdf.js', 'engine.js', 'spec.js', 'catalogue-data.js', 'catalogue.js', 'app.js', 'auth-gate.js', 'supabase-config.js'];
for (const name of required) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error(`Fichier requis absent à la racine : ${name}`);
  fs.copyFileSync(source, path.join(out, name));
}
for (const name of ['politique-confidentialite.html', 'conditions-utilisation.html', 'sw.js', 'manifest.webmanifest']) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, name));
}
for (const dir of ['icons', 'assets', 'vendor', 'models', 'catalogue', 'templates']) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(out, dir), { recursive: true });
}
// Garde-fou : chaque script chargé par index.html doit être présent dans www (sinon l'APK perdrait silencieusement une fonction).
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/<script src="\.\/([^"?]+)"/g)) {
  if (!fs.existsSync(path.join(out, m[1]))) throw new Error(`index.html charge ${m[1]} mais il n'est pas copié dans www : ajoutez-le à la liste de scripts/prepare-web.cjs`);
}
console.log('JuriskPro web assets copied to www.');
