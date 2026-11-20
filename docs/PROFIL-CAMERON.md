# Cameron Style Profile – Format

Cameron liefert eine JSON-Datei nach `schema/cameron-style-profile.schema.json`
(Schema-ID `unipop.style-profile/1`). Ein vollständiges Beispiel liegt in
`examples/profil-cameron-exemple.json`.

## Pflichtfelder

| Feld | Inhalt |
|---|---|
| `schema` | immer `"unipop.style-profile/1"` |
| `name`, `version` | Name und Version des Profils, z. B. `"1.0.0"` |
| `palette` | 1 bis 16 Farben, jeweils mit `hex` (`#RRGGBB`) |
| `generation.positive` | Liste der Stilanweisungen für den Prompt |

## Optionale Felder

| Feld | Inhalt |
|---|---|
| `palette[].name / role / usage / confidence` | Rolle: `primary`, `secondary`, `accent`, `background`, `text`, `neutral` |
| `illustration` | `style`, `imagery`, `keywords[]` |
| `composition` | `rules[]`, `layouts[]` |
| `typography` | `headings` und `body` mit `family`, `weight`, `case`; `notes` |
| `backgrounds` | `types[]`, `notes` |
| `graphicElements[]` | wiederkehrende grafische Elemente |
| `branding` | `logoRules[]`, `placement` (`top-left` … `bottom-right`, `center`), `minSizePercent` |
| `formats[]` | `label`, `width`, `height` – erscheinen im Studio als zusätzliche Formate |
| `generation.summary / negative[]` | Kopfzeile des Prompts, Negativliste |
| `subjects[]` | `title`, `prompt` – erscheinen als Motivvorschläge |
| `uncertainties[]` | was die Analyse nicht sicher feststellen konnte |

`confidence` ist `"observed"` (in den Referenzen sichtbar) oder `"assumed"` (Annahme).
Das Studio zeigt beide Stufen getrennt an.

## Was das Profil im Studio steuert

- **Prompt**: `generation`, `illustration`, `palette`, `composition`, `backgrounds`, `graphicElements`
- **Akzentfarbe der Oberfläche**: Farbe mit `role: "primary"`
- **Demo-Maquetten**: Palette (Hintergrund = `role: "background"`)
- **Textebenen**: `typography.headings.family` als Markenschrift, Palette als Farbauswahl
- **Logo-Ebene**: `branding.placement` und `minSizePercent` als Startwerte
- **Formate und Motivvorschläge**: `formats`, `subjects`

Im Studio erzeugt «Analyser le style» das fertige Briefing für Cameron inklusive Schema.
