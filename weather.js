'use strict';
// Holt die Wettervorhersage (max. 3 Tage) von einem der unterstützten Dienste und
// bringt sie in ein einheitliches Format. Läuft im GitHub-Workflow (Node 22),
// nicht im Browser, daher gibt es keine CORS-Probleme.
//
// Ergebnis: { ok, place, source, credit, days: [{ date, cat, tmin, tmax, pop, precip, wind }] }
//   cat    = clear | partly | cloudy | fog | rain | snow | thunder
//   pop    = Regenwahrscheinlichkeit in % (oder null), precip = Niederschlag in mm (oder null)
//   wind   = km/h (oder null)

const SOURCES = {
  openmeteo: { name: 'Open-Meteo', credit: 'Wetterdaten: Open-Meteo.com' },
  dwd:       { name: 'DWD (Bright Sky)', credit: 'Wetterdaten: Deutscher Wetterdienst, über Bright Sky' },
  metno:     { name: 'MET Norway (yr.no)', credit: 'Wetterdaten: MET Norway' }
};
// Reihenfolge der Ersatzquellen, falls der gewählte Dienst ausfällt
const CHAIN = ['openmeteo', 'metno', 'dwd'];
const DEFAULT_TZ = 'Europe/Berlin';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* ---------- Symbol-Zuordnung auf 7 einfache Kategorien ---------- */
function catFromWmo(code) {                         // Open-Meteo (WMO-Wettercodes)
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}
function catFromBrightSky(rec) {                    // Bright Sky (DWD)
  const icon = rec.icon;
  if (icon === 'clear-day' || icon === 'clear-night') return 'clear';
  if (icon === 'partly-cloudy-day' || icon === 'partly-cloudy-night') return 'partly';
  if (icon === 'cloudy' || icon === 'wind') return 'cloudy';
  if (icon === 'fog') return 'fog';
  if (icon === 'rain' || icon === 'hail') return 'rain';
  if (icon === 'sleet' || icon === 'snow') return 'snow';
  if (icon === 'thunderstorm') return 'thunder';
  const cc = rec.cloud_cover;                       // ohne Symbol: aus Bewölkung schätzen
  if (isNum(cc)) return cc < 20 ? 'clear' : cc < 60 ? 'partly' : 'cloudy';
  return 'cloudy';
}
function catFromMetno(symbol) {                     // MET Norway (symbol_code, z. B. "lightrain_day")
  const s = String(symbol || '').replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 'thunder';
  if (s.includes('snow') || s.includes('sleet')) return 'snow';
  if (s.includes('rain')) return 'rain';
  if (s.includes('fog')) return 'fog';
  if (s === 'clearsky' || s === 'fair') return s === 'fair' ? 'partly' : 'clear';
  if (s === 'partlycloudy') return 'partly';
  return 'cloudy';
}

/* Tagessymbol: Gewitter zählt sofort, Regen/Schnee ab 2 Stunden, sonst das häufigste Himmelsbild */
function pickCat(items) {
  const c = {};
  items.forEach((i) => { c[i.cat] = (c[i.cat] || 0) + i.hours; });
  if ((c.thunder || 0) >= 1) return 'thunder';
  if ((c.snow || 0) >= 2) return 'snow';
  if ((c.rain || 0) >= 2) return 'rain';
  if ((c.fog || 0) >= 3) return 'fog';
  let best = null;
  for (const k of ['clear', 'partly', 'cloudy']) if (c[k] && (best === null || c[k] > c[best])) best = k;
  if (best) return best;
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'cloudy';
}

/* ---------- Datum und Zeit ---------- */
const fmtDate = (d, tz) => new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const fmtHour = (d, tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)) % 24;
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const wantedDays = (tz, n, now) => { const t = fmtDate(now || new Date(), tz); return Array.from({ length: n }, (_, i) => addDays(t, i)); };

/* Stundenwerte zu Tageswerten zusammenfassen.
   records: [{ time: Date, hours, temp, precip, pop, wind, cat }] */
function aggregate(records, wanted, tz) {
  const days = [];
  for (const date of wanted) {
    const rs = records.filter((r) => fmtDate(r.time, tz) === date);
    if (!rs.length) continue;
    const temps = rs.map((r) => r.temp).filter(isNum);
    const precs = rs.map((r) => r.precip).filter(isNum);
    const pops = rs.map((r) => r.pop).filter(isNum);
    const winds = rs.map((r) => r.wind).filter(isNum);
    let dayRs = rs.filter((r) => { const h = fmtHour(r.time, tz); return h >= 6 && h <= 21; });
    if (!dayRs.length) dayRs = rs;
    days.push({
      date,
      cat: pickCat(dayRs),
      tmin: temps.length ? Math.round(Math.min(...temps)) : null,
      tmax: temps.length ? Math.round(Math.max(...temps)) : null,
      pop: pops.length ? Math.round(Math.max(...pops)) : null,
      precip: precs.length ? Math.round(precs.reduce((a, b) => a + b, 0) * 10) / 10 : null,
      wind: winds.length ? Math.round(Math.max(...winds)) : null
    });
  }
  return days;
}

function createWeather(fetchImpl, options) {
  fetchImpl = fetchImpl || globalThis.fetch;
  options = options || {};
  const now = options.now || (() => new Date());
  const retryDelay = options.retryDelay == null ? 1500 : options.retryDelay;
  const userAgent = options.userAgent ||
    'kindle-dashboard/1.0 github.com/' + (process.env.GITHUB_REPOSITORY || 'unknown/unknown');

  async function getJson(url, headers) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchImpl(url, {
          headers: Object.assign({ Accept: 'application/json' }, headers || {}),
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' von ' + new URL(url).host);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await sleep(retryDelay);
      }
    }
    throw lastErr;
  }

  const COORD = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  async function geocode(place) {
    const m = place.match(COORD);                                 // "51.33, 7.97" geht direkt
    if (m) return { name: place.trim(), lat: Number(m[1]), lon: Number(m[2]), tz: DEFAULT_TZ };
    const find = async (name) => {
      const j = await getJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) +
        '&count=1&language=de&format=json');
      return j.results && j.results[0];
    };
    let r = await find(place);
    if (!r && /[,\s]/.test(place.trim())) r = await find(place.trim().split(/[,\s]+/)[0]);   // "Berlin Mitte" -> "Berlin"
    if (!r) throw new Error('Ort „' + place + '“ nicht gefunden');
    return { name: place.trim(), lat: r.latitude, lon: r.longitude, tz: r.timezone || DEFAULT_TZ };
  }

  /* ---------- Anbieter ---------- */
  const providers = {
    async openmeteo(loc, n) {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max' +
        '&timezone=auto&forecast_days=' + n;
      const j = await getJson(url);
      const d = j.daily;
      if (!d || !Array.isArray(d.time) || !d.time.length) throw new Error('Open-Meteo: keine Tagesdaten');
      return d.time.slice(0, n).map((date, i) => ({
        date,
        cat: catFromWmo(d.weather_code[i]),
        tmin: isNum(d.temperature_2m_min[i]) ? Math.round(d.temperature_2m_min[i]) : null,
        tmax: isNum(d.temperature_2m_max[i]) ? Math.round(d.temperature_2m_max[i]) : null,
        pop: isNum(d.precipitation_probability_max && d.precipitation_probability_max[i]) ? Math.round(d.precipitation_probability_max[i]) : null,
        precip: isNum(d.precipitation_sum && d.precipitation_sum[i]) ? Math.round(d.precipitation_sum[i] * 10) / 10 : null,
        wind: isNum(d.wind_speed_10m_max && d.wind_speed_10m_max[i]) ? Math.round(d.wind_speed_10m_max[i]) : null
      }));
    },

    async dwd(loc, n) {
      const wanted = wantedDays(loc.tz, n, now());
      const url = 'https://api.brightsky.dev/weather?lat=' + loc.lat + '&lon=' + loc.lon +
        '&date=' + wanted[0] + '&last_date=' + addDays(wanted[n - 1], 1) + '&tz=' + encodeURIComponent(loc.tz);
      const j = await getJson(url);
      if (!j.weather || !j.weather.length) throw new Error('Bright Sky: keine Daten');
      const records = j.weather.map((w) => ({
        time: new Date(w.timestamp), hours: 1, temp: w.temperature, precip: w.precipitation,
        pop: w.precipitation_probability, wind: w.wind_speed, cat: catFromBrightSky(w)
      }));
      const days = aggregate(records, wanted, loc.tz);
      if (!days.length) throw new Error('Bright Sky: keine Tageswerte');
      return days;
    },

    async metno(loc, n) {
      const wanted = wantedDays(loc.tz, n, now());
      const url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + loc.lat.toFixed(4) + '&lon=' + loc.lon.toFixed(4);
      const j = await getJson(url, { 'User-Agent': userAgent });
      const ts = j.properties && j.properties.timeseries;
      if (!ts || !ts.length) throw new Error('MET Norway: keine Daten');
      const records = ts.map((e, i) => {
        const inst = (e.data.instant && e.data.instant.details) || {};
        const time = new Date(e.time);
        const next = ts[i + 1] ? (new Date(ts[i + 1].time) - time) / 3600000 : 6;
        const h1 = e.data.next_1_hours, h6 = e.data.next_6_hours;
        let cat = null, precip = null, pop = null, hours = 1;
        if (h1) {
          cat = catFromMetno(h1.summary && h1.summary.symbol_code);
          precip = h1.details && h1.details.precipitation_amount;
        } else if (h6) {
          hours = Math.max(1, Math.min(next, 6));
          cat = catFromMetno(h6.summary && h6.summary.symbol_code);
          if (h6.details && isNum(h6.details.precipitation_amount)) precip = h6.details.precipitation_amount * hours / 6;
        }
        if (h6 && h6.details && isNum(h6.details.probability_of_precipitation)) pop = h6.details.probability_of_precipitation;
        return { time, hours, temp: inst.air_temperature, precip, pop,
                 wind: isNum(inst.wind_speed) ? inst.wind_speed * 3.6 : null, cat };
      }).filter((r) => r.cat);
      const days = aggregate(records, wanted, loc.tz);
      if (!days.length) throw new Error('MET Norway: keine Tageswerte');
      return days;
    }
  };

  /* ---------- Hauptfunktion mit Ersatzquellen ---------- */
  async function getWeather(cfg) {
    const source = SOURCES[cfg.source] ? cfg.source : 'openmeteo';
    const place = String(cfg.location || '').trim() || 'Sundern';
    const n = Math.min(3, Math.max(1, Math.round(Number(cfg.days) || 3)));
    const errors = [];
    let loc;
    try { loc = await geocode(place); }
    catch (err) { return { ok: false, place, error: err.message }; }

    for (const src of [source].concat(CHAIN.filter((s) => s !== source))) {
      try {
        const days = await providers[src](loc, n);
        return { ok: true, place, source: src, credit: SOURCES[src].credit + (src !== source ? ' (Ersatzquelle)' : ''),
                 fallbackFrom: src !== source ? source : null, days };
      } catch (err) {
        errors.push(SOURCES[src].name + ': ' + err.message);
        console.warn('Wetter über ' + SOURCES[src].name + ' fehlgeschlagen: ' + err.message);
      }
    }
    return { ok: false, place, error: 'Alle Wetterdienste nicht erreichbar' };
  }

  return { getWeather, geocode, providers };
}

module.exports = { createWeather, SOURCES, CHAIN, aggregate, pickCat, catFromWmo, catFromMetno, catFromBrightSky, wantedDays, addDays };
