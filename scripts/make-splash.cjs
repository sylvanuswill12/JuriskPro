// Génère assets/splash.png (+ splash-dark.png) : fond uni JuriskPro.
// Le logo et le slogan animés sont affichés par la page (index.html) juste après.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

(async () => {
  const N = 2732;
  const out = path.join(process.cwd(), 'assets', 'splash.png');
  await sharp({ create: { width: N, height: N, channels: 4, background: '#0D1411' } }).png().toFile(out);
  fs.copyFileSync(out, path.join(process.cwd(), 'assets', 'splash-dark.png'));
  console.log('Splash généré :', out);
})().catch((e) => { console.error(e); process.exit(1); });
