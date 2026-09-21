const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 758, deviceScaleFactor: 1 });
  
  const fileUrl = `file://${path.join(__dirname, 'index.html')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  
  // Warte kurz, bis Google Kalender geladen ist
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  await page.screenshot({ path: 'dashboard.png', type: 'png' });
  await browser.close();
})();
