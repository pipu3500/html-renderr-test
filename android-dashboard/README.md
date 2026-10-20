# android-dashboard

Dasselbe Grundprinzip wie das Kindle-Dashboard (Wetter, Google Kalender, Google Termine, bis zu
6 gleichzeitige Google-Drive-Fenster, Bibelverse/Texte mit Reihenfolge und Zeitsteuerung,
Geräteprofile mit einstellbarer Auflösung), aber als eigenständiges Android-Projekt, in Farbe und
ohne jede Abhängigkeit von den Kindle-Dateien im Repo. Läuft als App (APK) auf Tablet oder
Smartphone.

## Der wichtigste Unterschied zum Kindle

Ein Kindle kann kein modernes Javascript und kein HTTPS mit aktuellem Zertifikat, darum erzeugt
dort GitHub Actions stündlich ein fertiges PNG-Bild. Ein Android-Gerät hat einen vollwertigen
Browser eingebaut: Die App zeigt die Seite `web/index.html` direkt in einer WebView an, die
Wetterdaten, Google-Kalender und Fotos lädt die Seite dort live selbst. Es gibt keine PNG-Pipeline
und keinen eigenen Rendering-Workflow für Android.

## Aufbau

- `web/index.html`, `web/weather.js`, `web/verses.js` — das eigentliche Dashboard, läuft als
  App-Bestandteil (siehe `app/app/src/main/assets/`, dort liegt eine Kopie, die tatsächlich in
  die APK einfließt)
- `editor.html` — Editor zum Einrichten (Geräte, Fenster, Texte). Lokal öffnen (Doppelklick),
  keine GitHub-Pages-Veröffentlichung nötig
- `devices.json` — wird vom Editor ins Repo geschrieben (ähnlich profiles.json beim Kindle, aber
  eine eigene Datei, eigener Ort)
- `app/` — das Android-Studio-/Gradle-Projekt (Kotlin), aus dem die APK gebaut wird

## Diagnose-Anzeige

In den App-Einstellungen (drei Punkte oben rechts) unter „Diagnose-Anzeige“ einschaltbar. Zeigt
unten im Bild ein kleines, dauerhaft sichtbares Protokoll: die abgefragte Adresse, die
HTTP-Antwort, Zeitpunkt, die Liste aller in `devices.json` gefundenen Geräte-Kennungen und welches
Gerät ausgewählt wurde. Hilft beim Einrichten und bei der Fehlersuche (z. B. wenn die
Geräte-Kennung nicht gefunden wird); für den normalen Betrieb ausgeschaltet lassen.

## Einrichtung

1. `editor.html` öffnen (lokal im Browser, einfach doppelklicken).
2. Unter „GitHub-Zugang“ Benutzername, Repository, Branch und ein Token eintragen (Fine-grained
   Token mit **Contents: Read and write** für dieses Repository — derselbe Weg wie beim
   Kindle-Editor, aber ein eigenes Token oder dasselbe, ganz wie du möchtest).
3. Gerät anlegen (Name, Auflösung, Ausrichtung, **Geräte-Kennung** — die trägst du gleich in der
   App ein), Fenster einrichten, auf „Hochladen“ klicken. Das schreibt
   `android-dashboard/devices.json` ins Repo.
4. App installieren (siehe unten) und in den App-Einstellungen GitHub-Benutzername, Repository,
   Branch und die Geräte-Kennung eintragen.

Die App lädt ihr Layout dann live von
`https://raw.githubusercontent.com/<Benutzername>/<Repository>/<Branch>/android-dashboard/devices.json`.
Das liefert immer den zuletzt committeten Stand (anders als jsDelivr, das für unveränderliche,
selten wechselnde Inhalte gedacht ist und hartnäckig cacht — frühere Versionen dieser App nutzten
jsDelivr auch für devices.json, was dazu führte, dass Änderungen und neu angelegte Geräte teils gar
nicht oder erst nach langer Verzögerung ankamen). jsDelivr kommt nur noch beim „Vorschau-Link“ zum
Einsatz (zum Testen im Desktop-Browser), weil nur jsDelivr HTML-Dateien mit dem richtigen
Content-Type ausliefert, den ein Browser zum Rendern braucht.

Wird ein in der App eingetragenes Gerät im Editor gelöscht oder umbenannt, zeigt die App das
deutlich als Fehlermeldung an, statt unbemerkt auf ein anderes Gerät zurückzufallen.

## APK bekommen

**Ohne Android Studio (empfohlen):** Nach dem Hochladen von `app/**` ins Repo baut GitHub Actions
automatisch die APK (`.github/workflows/android-apk.yml`, völlig unabhängig vom
Kindle-Workflow). Das Ergebnis landet als Release „android-latest“ im Repo unter „Releases“ —
die `app-debug.apk` von dort direkt im Browser des Android-Geräts öffnen und Installation
bestätigen (siehe unten). Alternativ liegt dieselbe Datei auch als Artefakt im jeweiligen
Workflow-Lauf unter „Actions“.

**Mit Android Studio:** `app/` in Android Studio öffnen (Datei → Öffnen). Fehlt die
Gradle-Wrapper-Datei (`gradlew`/`gradle-wrapper.jar`), bietet Android Studio an, sie zu erzeugen —
das einmal bestätigen. Danach normal über „Run“ bauen und installieren, oder
„Build → Generate Signed Bundle / APK“ für eine Installationsdatei.

### Installation aus unbekannten Quellen

Diese APK ist nicht im Play Store, daher fragt Android beim ersten Mal nach, ob Installationen aus
dieser Quelle (z. B. dem Browser oder Dateien-App) erlaubt werden sollen. Das ist normal für
selbst gebaute Apps und muss einmalig bestätigt werden.

## Vollbild

Die App blendet Status- und Navigationsleiste aus und zeichnet randlos bis an den Bildschirmrand
(modernes „Edge-to-edge“, per `WindowInsetsControllerCompat` statt des veralteten
`android:windowFullscreen`, das Android 15 und neuer nicht mehr zuverlässig beachtet — sonst bleibt
genau an der Stelle der sonst eingeblendeten Statusleiste eine ungenutzte schwarze Lücke, und die
Seite füllt die restliche Fläche nicht richtig, weil sie beim Start kurzzeitig von einer kleineren
Fenstergröße ausgeht, bevor die WebView ihre endgültige Größe erreicht, und das nicht zuverlässig
mitbekommt). Mit Fingerwisch vom Rand lassen sich die Systemleisten bei Bedarf kurz einblenden.

## Zeitplan für den Bildschirm (voll automatisch)

In der App unter den drei Punkten oben rechts → „Zeitplan für den Bildschirm …“. Pro Wochentag
ein Schieberegler mit zwei Griffen (von … bis), dazu Schnellknöpfe „Ganztägig“ und „Aus“. Ohne
eingeschalteten Zeitplan (Hauptschalter oben) bleibt der Bildschirm wie bisher immer wach.

Innerhalb der eingestellten Zeiten hält die App den Bildschirm wach. Zum **Start** einer
Einschaltzeit weckt sie das Gerät zusätzlich selbstständig auf (per Alarm, auch aus dem
Ruhezustand), damit kein manuelles Einschalten nötig ist. Am **Ende** einer Einschaltzeit lässt
sie nur die Wach-Sperre los; das Gerät schläft dann nach der normalen Bildschirm-Zeitsperre
(Android-Einstellungen → Display) ein — für ein zügiges Abschalten dort am besten eine kurze
Zeitspanne einstellen, z. B. 15–30 Sekunden. Ein aktives Ausschalten durch die App selbst ist ohne
Geräteverwalter-Rechte nicht möglich, die hier bewusst nicht genutzt werden.

Damit das pünktliche Aufwecken zuverlässig funktioniert, bietet die App in den Einstellungen bei
Bedarf zwei weitere Schritte an (je ein Knopf, erscheinen nur, wenn nötig):
- **Akku-Optimierung deaktivieren** — sonst könnte Android die App zwischen den Weckzeiten ganz
  einfrieren.
- **Pünktliches Aufwecken erlauben** — ab Android 12 muss diese Berechtigung einmalig in den
  Systemeinstellungen bestätigt werden (wie bei Wecker-Apps).

Nach einem Neustart des Geräts stellt sich der nächste Weck-Alarm von selbst wieder ein.

## Wetterdienste

Wie beim Kindle: Open-Meteo (Standard), DWD über Bright Sky, MET Norway. Alle drei sind
öffentliche, für Browser freigegebene Programmierschnittstellen (CORS erlaubt), die App braucht
dafür keine eigenen Schlüssel oder Umwege.

## Einstellungs-Button

Der Button oben rechts blendet sich nach ein paar Sekunden ohne Berührung automatisch aus, damit
er das Dashboard nicht stört. Jede Berührung des Bildschirms lässt ihn kurz wieder erscheinen.

## Grenzen und Hinweise

- **Öffentliches Repo nötig:** jsDelivr kann nur öffentliche GitHub-Repos spiegeln. Ist das Repo
  privat, lädt die App nichts; dann bräuchte es einen anderen Weg (z. B. die Geräte-Datei selbst
  irgendwo mit Token hinter Login bereitstellen) — in dieser Version nicht enthalten.
- **Internetverbindung:** Die App braucht durchgehend Internet (WLAN reicht), da sie live rendert
  statt ein fertiges Bild zu laden.
- **Bildschirm bleibt an:** Für den Dashboard-Betrieb hält die App den Bildschirm wach
  (`FLAG_KEEP_SCREEN_ON`). Für ein wandmontiertes Tablet ist das meist gewünscht; bei einem
  Smartphone, das auch normal genutzt wird, eher nicht — dafür gibt es in dieser Version noch
  keine Ein/Aus-Einstellung.
- **Kein Play-Store-Release:** Die APK ist mit einem Debug-Schlüssel signiert, gut zum Installieren
  auf eigenen Geräten. Für eine Veröffentlichung im Play Store bräuchte es einen eigenen
  Signierschlüssel und weitere Schritte, die hier nicht enthalten sind.
