const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 758,
    height: 1024,
    deviceScaleFactor: 1
  });

  await page.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'dashboard.png' });

  await browser.close();
})();
