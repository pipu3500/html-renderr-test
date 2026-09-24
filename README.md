# kindle-dashboard

Rendert `index.html` (Querformat 1024x758) per Puppeteer und erzeugt daraus
`dashboard.png` für einen Kindle Paperwhite 2 (Gen 6):

- 758x1024 px, 8-Bit-Graustufen, 1 Kanal, kein Alpha
- um 90° gedreht, damit das Dashboard quer erscheint
  (Drehrichtung in `.github/workflows/render.yml` über `KINDLE_ROTATE` = 90 oder 270)
- `preview.png` ist dieselbe Seite ungedreht zum Ansehen im Browser

Veröffentlicht wird auf dem Branch `gh-pages`:
`https://<DEIN-USER>.github.io/<REPO-NAME>/dashboard.png`

## Layout-Editor

`editor.html` ist ein Browser-Tool (Windows, Android, jeder Browser): Fenster Wetter,
Google Kalender, Google Termine und Google Drive an/aus schalten, auf dem simulierten
Kindle-Display verschieben und skalieren, dann „Hochladen“. Der Editor schreibt `layout.json`
ins Repo, der Workflow startet automatisch und erzeugt das neue `dashboard.png`.

Nach dem ersten Workflow-Lauf liegt der Editor auch unter
`https://<DEIN-USER>.github.io/<REPO-NAME>/editor.html` (praktisch fürs Handy).
