// Erzeugt für jedes Kindle-Profil aus profiles.json ein PNG.
//
// Pro Profil:  Auflösung (Hochformat, wie das Kindle-Panel), Ausrichtung, Zoom, Dateiname, Fenster-Layout.
// Ablauf:      index.html rendern (Layout-Fläche = native Fläche / Zoom, mit Zoom als deviceScaleFactor),
//              auf die exakte Kindle-Auflösung bringen, drehen, in 8-Bit-Graustufen ohne Alpha speichern.
// Ausgabe:     public/<Dateiname> (für den Kindle) und public/preview-<Dateiname> (Vorschau, ungedreht).
// Fehlt profiles.json, wird die alte layout.json als einzelnes Profil "dashboard.png" (758x1024) benutzt.

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { createWeather } = require('./weather');

const OUT_DIR = path.join(__dirname, 'public');
const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,60}\.png$/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (v, lo, hi, fallback) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback; };

function readJson(name) {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadProfiles() {
  let list;
  const doc = readJson('profiles.json');
  if (doc) {
    list = doc.profiles;
    if (!Array.isArray(list) || !list.length) throw new Error('profiles.json enthält keine Profile');
  } else {
    const legacy = readJson('layout.json');
    console.log('profiles.json fehlt, benutze layout.json als Profil "dashboard.png"');
    list = [{ name: 'Paperwhite 2', file: 'dashboard.png', width: 758, height: 1024,
              rotate: Number(process.env.KINDLE_ROTATE || 90), zoom: 1, widgets: legacy ? legacy.widgets : {} }];
  }
  const used = new Set();
  return list.map((p, i) => {
    const file = typeof p.file === 'string' && FILE_RE.test(p.file) ? p.file : 'dashboard-' + (i + 1) + '.png';
    if (used.has(file)) throw new Error('Dateiname mehrfach vergeben: ' + file);
    used.add(file);
    return {
      name: String(p.name || 'Gerät ' + (i + 1)).slice(0, 60),
      file,
      width: Math.round(num(p.width, 200, 4000, 758)),
      height: Math.round(num(p.height, 200, 4000, 1024)),
      rotate: [0, 90, 180, 270].includes(Number(p.rotate)) ? Number(p.rotate) : 90,
      zoom: num(p.zoom, 0.5, 4, 1),
      widgets: p.widgets && typeof p.widgets === 'object' ? p.widgets : {}
    };
  });
}

const weather = createWeather();
const weatherCache = new Map();
function weatherFor(cfg) {
  if (!cfg || cfg.enabled === false || cfg.source === 'wttr') return Promise.resolve(null);   // wttr.in lädt die Seite selbst
  const key = [cfg.source || 'openmeteo', cfg.location || '', cfg.days || 3].join('|');
  if (!weatherCache.has(key)) weatherCache.set(key, weather.getWeather(cfg));
  return weatherCache.get(key);
}

async function render(browser, p) {
  const portrait = p.rotate === 0 || p.rotate === 180;
  const nativeW = portrait ? p.width : p.height;      // Größe des Bildes vor dem Drehen
  const nativeH = portrait ? p.height : p.width;
  const pageW = Math.round(nativeW / p.zoom);         // Layout-Fläche, in der der Editor arbeitet
  const pageH = Math.round(nativeH / p.zoom);

  const wx = await weatherFor(p.widgets.weather);
  if (wx) console.log('  Wetter:', wx.ok ? wx.place + ' über ' + wx.source : 'Fehler: ' + wx.error);

  const page = await browser.newPage();
  let shot;
  try {
    await page.setViewport({ width: pageW, height: pageH, deviceScaleFactor: p.zoom });
    await page.evaluateOnNewDocument((layout, w, size) => {
      window.LAYOUT = layout; window.WEATHER = w; window.PAGE = size;
    }, { widgets: p.widgets }, wx, { w: pageW, h: pageH });
    try {
      // Google-Kalender-iFrames halten oft Verbindungen offen -> networkidle0 läuft dann in den Timeout
      await page.goto('file://' + path.join(__dirname, 'index.html'), { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (err) {
      console.warn('  Seite nicht vollständig "idle", Screenshot wird trotzdem gemacht:', err.message);
    }
    await sleep(5000);                                 // Kalender-Inhalte nachladen lassen
    shot = Buffer.from(await page.screenshot({ type: 'png' }));
  } finally {
    await page.close();
  }

  // Auf die exakte Größe bringen (bei Zoom kann Chrome um 1 px abweichen)
  let landscape = shot;
  const m0 = await sharp(shot).metadata();
  if (m0.width !== nativeW || m0.height !== nativeH) {
    if (Math.abs(m0.width - nativeW) > 4 || Math.abs(m0.height - nativeH) > 4) {
      throw new Error('Screenshot ist ' + m0.width + 'x' + m0.height + ', erwartet ' + nativeW + 'x' + nativeH);
    }
    landscape = await sharp(shot).resize(nativeW, nativeH, { fit: 'fill' }).png().toBuffer();
  }
  fs.writeFileSync(path.join(OUT_DIR, 'preview-' + p.file), landscape);

  let img = sharp(landscape).flatten({ background: '#ffffff' });   // kein Alpha-Kanal
  if (p.rotate) img = img.rotate(p.rotate);
  const png = await img.grayscale().toColourspace('b-w')           // 1 Kanal, 8 Bit
    .png({ compressionLevel: 9, palette: false, progressive: false }).toBuffer();

  const meta = await sharp(png).metadata();
  if (meta.width !== p.width || meta.height !== p.height || meta.channels !== 1 || meta.hasAlpha) {
    throw new Error('PNG hat nicht das erwartete Format (' + p.width + 'x' + p.height + ', 1 Kanal, ohne Alpha)');
  }
  fs.writeFileSync(path.join(OUT_DIR, p.file), png);
  console.log('  OK', p.file, meta.width + 'x' + meta.height, '| Layout-Fläche', pageW + 'x' + pageH,
              '| Zoom', p.zoom, '| Drehung', p.rotate);
}

(async () => {
  const profiles = loadProfiles();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const failed = [];
  try {
    for (const p of profiles) {
      console.log('Profil "' + p.name + '"');
      try { await render(browser, p); }
      catch (err) { console.error('  FEHLER:', err.message); failed.push(p.name); }
    }
  } finally {
    await browser.close();
  }
  if (failed.length) throw new Error('Fehlgeschlagene Profile: ' + failed.join(', '));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
