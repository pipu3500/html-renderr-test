/* Textfenster (Bibelverse und andere Texte): Auswahl, Schriften und Darstellung.
   Wird vom Renderer (Node und index.html) und vom Editor benutzt, damit beide dasselbe zeigen.
   Kein Zustand nötig: Welcher Text dran ist, ergibt sich allein aus Startzeit, Wechselzeit und Uhrzeit. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Verses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'Europe/Berlin';
  var DEFAULT_SYNC_MINUTES = 60;

  /* ---------- Schriften ---------- */
  var SYS_SERIF = '"DejaVu Serif","Liberation Serif",Georgia,"Times New Roman",serif';
  var SYS_SANS = '"DejaVu Sans","Liberation Sans",Arial,sans-serif';
  var FONTS = {
    serif:  { label: 'Serif (Standard)', css: SYS_SERIF },
    sans:   { label: 'Sans (Standard)', css: SYS_SANS },
    mono:   { label: 'Monospace', css: '"DejaVu Sans Mono","Liberation Mono",monospace' },
    lora:   { label: 'Lora (Serif)', google: 'Lora', ital: true, fallback: SYS_SERIF },
    merri:  { label: 'Merriweather (Serif)', google: 'Merriweather', ital: true, fallback: SYS_SERIF },
    garamond: { label: 'EB Garamond (Serif)', google: 'EB Garamond', ital: true, fallback: SYS_SERIF },
    crimson:  { label: 'Crimson Text (Serif)', google: 'Crimson Text', ital: true, fallback: SYS_SERIF },
    slab:   { label: 'Roboto Slab (Serif)', google: 'Roboto Slab', ital: false, fallback: SYS_SERIF },
    opensans: { label: 'Open Sans (Sans)', google: 'Open Sans', ital: true, fallback: SYS_SANS },
    roboto: { label: 'Roboto (Sans)', google: 'Roboto', ital: true, fallback: SYS_SANS },
    caveat: { label: 'Caveat (Handschrift)', google: 'Caveat', ital: false, fallback: SYS_SERIF }
  };
  function fontList() { return Object.keys(FONTS).map(function (k) { return [k, FONTS[k].label]; }); }
  function fontCss(key) {
    var f = FONTS[key] || FONTS.serif;
    return f.google ? '"' + f.google + '",' + f.fallback : f.css;
  }
  function fontUrl(key, italic) {
    var f = FONTS[key];
    if (!f || !f.google) return null;
    var fam = f.google.replace(/ /g, '+');
    if (italic && f.ital) return 'https://fonts.googleapis.com/css2?family=' + fam + ':ital,wght@0,400;0,700;1,400;1,700&display=swap';
    return 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@400;700&display=swap';
  }
  /* Lädt die Schrift (Google Fonts). Ist sie nicht erreichbar, bleibt die Ersatzschrift. Löst immer auf. */
  function loadFont(key, italic) {
    var url = fontUrl(key, !!italic);
    if (!url || typeof document === 'undefined') return Promise.resolve();
    return new Promise(function (resolve) {
      var finished = false;
      function fin() { if (!finished) { finished = true; resolve(); } }
      setTimeout(fin, 9000);
      var fam = '"' + FONTS[key].google + '"';
      function afterLink() {
        var jobs = [document.fonts.load('400 20px ' + fam), document.fonts.load('700 20px ' + fam)];
        if (italic && FONTS[key].ital) {
          jobs.push(document.fonts.load('italic 400 20px ' + fam), document.fonts.load('italic 700 20px ' + fam));
        }
        Promise.all(jobs).then(fin, fin);
      }
      var link = document.querySelector('link[data-vfont="' + url + '"]');
      if (link) {
        if (link.getAttribute('data-loaded')) afterLink(); else { link.addEventListener('load', afterLink); link.addEventListener('error', fin); }
        return;
      }
      link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = url; link.setAttribute('data-vfont', url);
      link.onload = function () { link.setAttribute('data-loaded', '1'); afterLink(); };
      link.onerror = fin;
      document.head.appendChild(link);
    });
  }

  /* ---------- Zeit ---------- */
  function ymd(ms) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  }
  function dayNum(ms) {                       // laufende Tageszahl nach Datum in Berlin
    var p = ymd(ms).split('-');
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function tzOffset(ms) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms)).forEach(function (x) { parts[x.type] = x.value; });
    var asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return asUtc - Math.floor(ms / 1000) * 1000;
  }
  function localMidnight(dn) {
    var u = dn * 86400000, g = u - tzOffset(u);
    return u - tzOffset(g);
  }

  /* ---------- Einstellungen ---------- */
  function normalize(c) {
    c = c || {};
    return {
      mode: c.mode === 'random' ? 'random' : 'seq',
      repeats: c.repeats === 'yes' ? 'yes' : 'no',
      atEnd: c.atEnd === 'pause' ? 'pause' : 'restart',
      change: c.change === 'interval' ? 'interval' : 'sync',
      every: Math.max(1, Math.min(9999, Math.floor(Number(c.every)) || 1)),
      unit: c.unit === 'minutes' || c.unit === 'hours' ? c.unit : 'days',
      startAt: Date.parse(c.startAt),
      seed: (Math.floor(Number(c.seed)) >>> 0) || 1
    };
  }
  function syncLen(sm) { return Math.max(1, Math.min(1440, Math.floor(Number(sm)) || DEFAULT_SYNC_MINUTES)) * 60000; }

  /* Nummer des aktuellen Wechsels (0 = erster Text) */
  function slotIndex(c, now, sm) {
    var start = isFinite(c.startAt) ? c.startAt : now;
    var k;
    if (c.change === 'sync') {
      var len = syncLen(sm);
      k = Math.floor(now / len) - Math.floor(start / len);
    } else if (c.unit === 'days') {
      k = Math.floor((dayNum(now) - dayNum(start)) / c.every);
    } else {
      var u = c.unit === 'hours' ? 3600000 : 60000;
      k = Math.floor((Math.floor(now / u) - Math.floor(start / u)) / c.every);
    }
    return Math.max(0, k);
  }
  /* Beginn eines Wechsels in ms */
  function slotStart(c, slot, now, sm) {
    var start = isFinite(c.startAt) ? c.startAt : now;
    if (c.change === 'sync') { var len = syncLen(sm); return (Math.floor(start / len) + slot) * len; }
    if (c.unit === 'days') return localMidnight(dayNum(start) + slot * c.every);
    var u = c.unit === 'hours' ? 3600000 : 60000;
    return (Math.floor(start / u) + slot * c.every) * u;
  }

  /* ---------- Zufall (nachvollziehbar, aus Startwert) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rnd32(seed, i) { return Math.floor(mulberry32((seed ^ Math.imul(i + 1, 2654435761)) >>> 0)() * 4294967296); }
  function shuffled(n, seed, cycle) {
    var a = [], i, r = mulberry32((seed ^ Math.imul(cycle + 7, 2246822519)) >>> 0);
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* Welcher Text (Nummer ab 0) gehört zum Wechsel k? */
  function indexForSlot(c, n, k) {
    if (n <= 1) return 0;
    if (c.mode === 'seq') return k < n ? k : (c.atEnd === 'pause' ? n - 1 : k % n);
    if (c.repeats === 'yes') {                       // zufällig, Wiederholungen erlaubt (nie zweimal direkt hintereinander)
      var idx = rnd32(c.seed, 0) % n;
      for (var i = 1; i <= k; i++) idx = (idx + 1 + rnd32(c.seed, i) % (n - 1)) % n;
      return idx;
    }
    var cycle = Math.floor(k / n), pos = k % n;      // zufällig ohne Wiederholung: gemischter Stapel
    if (c.atEnd === 'pause' && cycle >= 1) { cycle = 0; pos = n - 1; }
    var prevLast = -1, p = null;
    for (var cc = 0; cc <= cycle; cc++) {
      p = shuffled(n, c.seed, cc);
      if (cc > 0 && p[0] === prevLast) { var s = p[0]; p[0] = p[1]; p[1] = s; }   // kein Text doppelt an der Stapelgrenze
      prevLast = p[n - 1];
    }
    return p[pos];
  }

  /* Letzter Wechsel, bevor bei "stehen bleiben" nichts mehr passiert (oder -1 = endlos) */
  function lastSlot(c, n) {
    if (c.atEnd !== 'pause') return -1;
    if (c.mode === 'seq' || c.repeats === 'no') return Math.max(0, n - 1);
    return -1;
  }

  function pick(cfg, total, now, syncMinutes) {
    if (!(total > 0)) return null;
    var c = normalize(cfg), k = slotIndex(c, now, syncMinutes);
    return { slot: k, index: indexForSlot(c, total, k) };
  }
  /* Die nächsten Texte samt Beginn (für die Vorschau im Editor) */
  function upcoming(cfg, total, now, count, syncMinutes) {
    if (!(total > 0)) return [];
    var c = normalize(cfg), k0 = slotIndex(c, now, syncMinutes), last = lastSlot(c, total), out = [];
    for (var i = 0; i < count; i++) {
      var k = k0 + i;
      if (last >= 0 && k > last) { if (i > 0 || k0 > last) { break; } }
      out.push({ slot: k, index: indexForSlot(c, total, k), start: slotStart(c, k, now, syncMinutes), isNow: i === 0,
                 final: last >= 0 && k >= last });
      if (last >= 0 && k >= last) break;
    }
    return out;
  }

  /* ---------- Darstellung ---------- */
  function displayOptions(o) {
    o = o || {};
    var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
    return {
      font: FONTS[o.font] ? o.font : 'serif',
      sizeMode: o.sizeMode === 'fixed' ? 'fixed' : 'auto',
      size: clamp(Math.round(Number(o.size)) || 36, 8, 300),
      maxSize: clamp(Math.round(Number(o.maxSize)) || 72, 10, 300),
      bold: !!o.bold, italic: !!o.italic,
      align: o.align === 'left' ? 'left' : 'center',
      showRef: o.showRef !== false, quotes: !!o.quotes
    };
  }
  /* Zeichnet den Text in das Element root (Größe W x H, muss im Dokument hängen).
     Bei "Automatisch" wird die größte Schrift gewählt, bei der alles hineinpasst. */
  function renderVerse(root, v, opts, W, H) {
    var o = displayOptions(opts);
    while (root.firstChild) root.removeChild(root.firstChild);
    root.setAttribute('lang', 'de');
    var pad = Math.max(10, Math.min(30, Math.round(Math.min(W, H) * 0.05)));
    var inner = document.createElement('div');
    inner.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;' +
      'justify-content:center;overflow:hidden;box-sizing:border-box;color:#000;padding:' + pad + 'px;' +
      'text-align:' + o.align + ';font-family:' + fontCss(o.font) + ';line-height:1.3;';
    var text = document.createElement('div');
    text.style.cssText = 'white-space:pre-wrap;overflow-wrap:break-word;hyphens:auto;-webkit-hyphens:auto;' +
      'font-weight:' + (o.bold ? 700 : 400) + ';font-style:' + (o.italic ? 'italic' : 'normal') + ';';
    text.textContent = o.quotes ? '\u201E' + v.text + '\u201C' : v.text;
    inner.appendChild(text);
    var ref = null;
    if (o.showRef && v.ref) {
      ref = document.createElement('div');
      ref.style.cssText = 'margin-top:0.6em;font-weight:700;font-style:normal;';
      ref.textContent = '\u2014 ' + v.ref;
      inner.appendChild(ref);
    }
    root.appendChild(inner);

    function apply(px) {
      text.style.fontSize = px + 'px';
      if (ref) ref.style.fontSize = Math.max(10, Math.round(px * 0.62)) + 'px';
    }
    function fits() { return inner.scrollHeight <= inner.clientHeight && text.scrollWidth <= text.clientWidth + 1; }
    function fit() {
      if (o.sizeMode === 'fixed') { apply(o.size); return; }
      var lo = 8, hi = Math.max(8, Math.min(o.maxSize, H));
      apply(lo);
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        apply(mid);
        if (fits()) lo = mid; else hi = mid - 1;
      }
      apply(lo);
    }
    apply(o.sizeMode === 'fixed' ? o.size : Math.min(o.maxSize, 40));
    return loadFont(o.font, o.italic).then(fit, fit);
  }

  return {
    TZ: TZ, DEFAULT_SYNC_MINUTES: DEFAULT_SYNC_MINUTES,
    normalize: normalize, slotIndex: slotIndex, slotStart: slotStart, indexForSlot: indexForSlot,
    pick: pick, upcoming: upcoming, fontList: fontList, fontCss: fontCss, fontUrl: fontUrl, loadFont: loadFont,
    displayOptions: displayOptions, renderVerse: renderVerse, dayNum: dayNum, localMidnight: localMidnight
  };
});
