# lars22.github.io

Persönliches Reisetagebuch, gebaut mit [Hugo](https://gohugo.io). Jeder Push auf `main` baut die Seite
über GitHub Actions (`.github/workflows/hugo.yml`) und veröffentlicht sie auf GitHub Pages.

## Artikel schreiben

- **Vom Handy oder Browser:** `https://lars22.github.io/admin/` (Sveltia CMS), Anmeldung mit einem
  GitHub-Token (Fine-grained, nur dieses Repo, *Contents: Read and write*). Fotos werden schon beim
  Hochladen auf höchstens 1600 px verkleinert.
- **Von Hand:** Ordner `content/posts/<kurzer-name>/` mit `index.md` und den Fotos anlegen.

Deutsche Artikel bekommen im Kopfbereich `language: de`, damit Browser und Vorlese-Programme sie richtig behandeln.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `content/` | Artikel (`posts/`) und die Archiv-Seite |
| `layouts/` | Vorlagen: Startseite, Artikel, Archiv, 404, Link-Vorschau (`partials/`) |
| `static/` | Schriften (lokal, keine Anfrage an Google), Favicon, Editor (`admin/`) |
| `hugo.toml` | Einstellungen |

Lokal ansehen: `hugo server`.

Lizenz- und Quellenhinweise stehen in [NOTICE.md](NOTICE.md).
