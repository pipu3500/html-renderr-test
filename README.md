# kindle-dashboard

Erzeugt für jedes Kindle ein eigenes Dashboard-PNG (GitHub Actions, stündlich und bei jeder Änderung).

## Ablauf

1. `editor.html` (Browser, Windows/Android) öffnen, Geräte anlegen, Fenster anordnen, „Hochladen“.
2. Der Editor schreibt `profiles.json` ins Repo.
3. Der Workflow startet, `screenshot.js` erzeugt pro Gerät `public/<Dateiname>` und eine Vorschau `public/preview-<Dateiname>`.
4. Jedes Kindle holt sich sein PNG von `https://<USER>.github.io/<REPO>/<Dateiname>`.

Der Editor liegt nach dem ersten Lauf auch unter `https://<USER>.github.io/<REPO>/editor.html`.

## Geräteprofil (profiles.json)

| Feld | Bedeutung |
|---|---|
| `name`, `id` | Anzeigename und interner Name |
| `file` | PNG-Dateiname, pro Gerät eindeutig |
| `width`, `height` | Display-Auflösung im Hochformat, z. B. 758 × 1024 |
| `rotate` | 90 = quer, Unterkante des Kindle rechts; 270 = quer, Unterkante links; 0 / 180 = Hochformat |
| `zoom` | Layout-Fläche = Auflösung ÷ Zoom. Vorschlag: längste Seite ÷ 1024, dann sieht das Layout auf jedem Gerät ähnlich aus |
| `widgets` | Wetter, Google Kalender, Google Termine, Google Drive (an/aus, Position, Größe, Drehung, Einstellungen) |

Das PNG hat immer exakt die eingestellte Auflösung, 8 Bit, 1 Kanal (Graustufen), ohne Alpha.
Alte `layout.json` (ein Gerät) wird automatisch als Gerät „Paperwhite 2“ mit `dashboard.png` übernommen.

## Wetterdienste

| Dienst | Hinweis |
|---|---|
| `openmeteo` | Standard, weltweit, Anzeige mit eigenen Symbolen |
| `dwd` | DWD-Daten über Bright Sky, für Deutschland |
| `metno` | MET Norway (yr.no), weltweit |
| `wttr` | wttr.in als fertiges Bild |

Fällt ein Dienst aus, springt `screenshot.js` automatisch auf einen der anderen (Open-Meteo, MET Norway, DWD). Die Quelle steht unten im Wetterfenster.
Orte werden über die Open-Meteo-Ortssuche gefunden; Koordinaten wie `51.33, 7.97` gehen direkt.

## Wenn ein Gerät nicht rendert

Ein Fehler in einem Profil (z. B. doppelter Dateiname) lässt den Lauf fehlschlagen, damit nichts halb Veröffentlichtes online geht. Das Protokoll unter „Actions“ nennt das betroffene Gerät.
