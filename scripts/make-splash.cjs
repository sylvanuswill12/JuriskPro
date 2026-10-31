// Génère assets/splash.png (+ splash-dark.png) : logo JuriskPro centré sur fond sombre.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

(async () => {
  const N = 2732;
  const bg = '#0D1411';
  const src = path.join(process.cwd(), 'assets', 'icon-foreground.png');
  if (!fs.existsSync(src)) throw new Error('assets/icon-foreground.png introuvable');
  const logo = await sharp(src).resize(Math.round(N * 0.62)).png().toBuffer();
  const out = path.join(process.cwd(), 'assets', 'splash.png');
  await sharp({ create: { width: N, height: N, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
  fs.copyFileSync(out, path.join(process.cwd(), 'assets', 'splash-dark.png'));
  console.log('Splash généré :', out);
})().catch((e) => { console.error(e); process.exit(1); });
