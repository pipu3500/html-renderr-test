const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();

  // Exakte Display-Auflösung des Kindle Paperwhite 2 (Hochformat)
  await page.setViewport({
    width: 758,
    height: 1024,
    deviceScaleFactor: 1
  });

  await page.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'dashboard.png' });

  await browser.close();
})();
