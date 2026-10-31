// Génère assets/splash.png (+ splash-dark.png) pour l'écran de démarrage natif.
// Utilise assets/splash-source.png (logo + slogan sur fond JuriskPro) s'il existe,
// sinon un fond uni. La page web (index.html) prend ensuite le relais avec le même visuel.
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.join(process.cwd(), 'assets');
  const out = path.join(dir, 'splash.png');
  const source = path.join(dir, 'splash-source.png');
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, out);
  } else {
    const sharp = require('sharp');
    const N = 2732;
    await sharp({ create: { width: N, height: N, channels: 4, background: '#0D1411' } }).png().toFile(out);
  }
  fs.copyFileSync(out, path.join(dir, 'splash-dark.png'));
  console.log('Splash généré :', out);
})().catch((e) => { console.error(e); process.exit(1); });
