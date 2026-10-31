// Exécuté dans la CI juste après `npx cap add android`.
// Donne au thème Android le fond sombre de JuriskPro (zone derrière la barre
// d'état et la barre de navigation) et des icônes système claires.
const fs = require('fs');
const path = require('path');

const res = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'values');
if (!fs.existsSync(res)) throw new Error('Projet Android introuvable : lancer `npx cap add android` avant.');

fs.writeFileSync(
  path.join(res, 'jp_colors.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="jp_window_bg">#0D1411</color>\n</resources>\n'
);

const stylesPath = path.join(res, 'styles.xml');
let styles = fs.readFileSync(stylesPath, 'utf8');
const extra = [
  '<item name="android:windowBackground">@color/jp_window_bg</item>',
  '<item name="android:statusBarColor">@color/jp_window_bg</item>',
  '<item name="android:navigationBarColor">@color/jp_window_bg</item>',
  '<item name="android:windowLightStatusBar">false</item>',
  '<item name="android:windowLightNavigationBar">false</item>'
].map((l) => '        ' + l).join('\n');

let patched = 0;
styles = styles.replace(/(<style\s+name="AppTheme(?:\.NoActionBar)?"[^>]*>)/g, (m) => {
  patched++;
  return m + '\n' + extra;
});
if (!patched) console.warn('Avertissement : aucun style AppTheme trouvé, thème non modifié.');
fs.writeFileSync(stylesPath, styles);
console.log(`Thème Android JuriskPro appliqué (${patched} style(s)).`);
