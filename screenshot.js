// Rendert index.html im Querformat (1024x758) und erzeugt daraus das PNG
// für den Kindle Paperwhite 2 (Gen 6).
//
// Das Panel des Kindle ist nativ 758x1024 (Hochformat). Damit das Dashboard
// quer erscheint, wird das Querformat-Bild um 90° gedreht und exakt in
// 758x1024, 8-Bit, 1 Kanal (Graustufen), ohne Alpha gespeichert.
// Stimmt am Ende etwas nicht, bricht das Skript ab (kein stiller Fallback).

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LANDSCAPE_W = 1024; // Seite im Querformat
const LANDSCAPE_H = 758;
const KINDLE_W = 758;     // Ergebnis-PNG = native Kindle-Auflösung (Hochformat)
const KINDLE_H = 1024;

// 90  = Oberkante des Dashboards zeigt beim Kindle nach rechts
// 270 = Oberkante des Dashboards zeigt beim Kindle nach links
// Steht das Bild auf dem Kopf: 90 <-> 270 tauschen (siehe render.yml).
const ROTATE = Number(process.env.KINDLE_ROTATE || 90);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  if (![90, 270].includes(ROTATE)) {
    throw new Error('KINDLE_ROTATE muss 90 oder 270 sein, ist aber: ' + ROTATE);
  }

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let landscape;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: LANDSCAPE_W, height: LANDSCAPE_H, deviceScaleFactor: 1 });

    // Layout aus layout.json (vom Editor) an die Seite übergeben
    let layout = null;
    try {
      layout = JSON.parse(fs.readFileSync(path.join(__dirname, 'layout.json'), 'utf8'));
      const on = Object.entries(layout.widgets || {}).filter(([, w]) => w.enabled).map(([id]) => id);
      console.log('layout.json geladen, aktive Fenster:', on.join(', ') || '(keine)');
    } catch (err) {
      console.warn('layout.json nicht lesbar, Standardlayout wird benutzt:', err.message);
    }
    await page.evaluateOnNewDocument((l) => { window.LAYOUT = l; }, layout);

    try {
      // Google-Kalender-iFrames halten oft Verbindungen offen -> networkidle0
      // läuft dann in den Timeout. networkidle2 + feste Wartezeit ist robuster.
      await page.goto('file://' + path.join(__dirname, 'index.html'), {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
    } catch (err) {
      console.warn('Seite nicht vollständig "idle", Screenshot wird trotzdem gemacht:', err.message);
    }
    await sleep(5000); // Kalender-Inhalte nachladen lassen

    landscape = Buffer.from(await page.screenshot({ type: 'png' }));
  } finally {
    await browser.close();
  }

  // Vorschau im Querformat (zum Ansehen im Browser, nicht für den Kindle)
  fs.writeFileSync('preview.png', landscape);

  const kindlePng = await sharp(landscape)
    .flatten({ background: '#ffffff' }) // kein Alpha-Kanal
    .rotate(ROTATE)
    .grayscale()
    .toColourspace('b-w')               // 1 Kanal, 8 Bit
    .png({ compressionLevel: 9, palette: false, progressive: false })
    .toBuffer();

  const meta = await sharp(kindlePng).metadata();
  console.log('Ergebnis:', meta.width + 'x' + meta.height, 'Kanäle:', meta.channels,
              'Tiefe:', meta.depth, 'Alpha:', meta.hasAlpha, 'Rotation:', ROTATE);

  if (meta.width !== KINDLE_W || meta.height !== KINDLE_H || meta.channels !== 1 || meta.hasAlpha) {
    throw new Error('PNG hat nicht das erwartete Format (' + KINDLE_W + 'x' + KINDLE_H +
                    ', 1 Kanal, ohne Alpha)');
  }

  fs.writeFileSync('dashboard.png', kindlePng);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
