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

  // Viewport im unrotierten Querformat (1024x758)
  await page.setViewport({
    width: 1024,
    height: 758,
    deviceScaleFactor: 1
  });

  await page.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle0' });

  // 1. Unrotiertes PNG im Querformat speichern
  await page.screenshot({ path: 'dashboard_raw.png', omitBackground: false });

  await browser.close();

  // 2. Bild per ImageMagick um 90 Grad drehen & in 8-Bit Graustufen umwandeln
  try {
    execSync('convert dashboard_raw.png -rotate 90 -colorspace gray -depth 8 -type grayscale dashboard.png');
    execSync('rm dashboard_raw.png');
  } catch (err) {
    console.log('ImageMagick Konvertierung fehlgeschlagen:', err);
    execSync('mv dashboard_raw.png dashboard.png');
  }
})();
