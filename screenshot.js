const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();

  // Exakte Display-Auflösung des Kindle Paperwhite 2 (758x1024 Portrait)
  await page.setViewport({
    width: 758,
    height: 1024,
    deviceScaleFactor: 1
  });

  await page.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle0' });

  // 1. Temporäres Roh-PNG erstellen
  await page.screenshot({ path: 'dashboard_raw.png', omitBackground: false });

  await browser.close();

  // 2. Bild in echtes 8-Bit Graustufen-PNG ohne Alpha-Kanal konvertieren für den Kindle eips-Treiber
  try {
    execSync('convert dashboard_raw.png -colorspace gray -depth 8 -type grayscale dashboard.png');
    execSync('rm dashboard_raw.png');
  } catch (err) {
    console.log('ImageMagick Konvertierung fehlgeschlagen, benutze Rohbild:', err);
    execSync('mv dashboard_raw.png dashboard.png');
  }
})();
