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
`https://cdn.jsdelivr.net/gh/<Benutzername>/<Repository>@<Branch>/android-dashboard/devices.json`
(jsDelivr spiegelt öffentliche GitHub-Repos kostenlos, mit den richtigen Content-Types — direkt
von GitHub geht das aus technischen Gründen nicht). Der Editor leert den jsDelivr-Cache beim
Hochladen automatisch mit; ganz frisch ist die App trotzdem erst, wenn sie das nächste Mal
aktualisiert (Einstellung „Aktualisieren alle … Minuten“, Standard 15).

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

## Wetterdienste

Wie beim Kindle: Open-Meteo (Standard), DWD über Bright Sky, MET Norway. Alle drei sind
öffentliche, für Browser freigegebene Programmierschnittstellen (CORS erlaubt), die App braucht
dafür keine eigenen Schlüssel oder Umwege.

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
