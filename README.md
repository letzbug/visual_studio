# UniPop Visual Studio – v0.1-demo

Lokaler Web-Prototyp: Referenzbilder verwalten, das von Cameron erstellte Style Profile
importieren, daraus Generierungs-Prompts bauen und Visuals mit Text- und Logo-Ebenen exportieren.
Oberfläche auf Französisch.

## Starten

`index.html` doppelklicken (Chrome, Edge oder Firefox). Keine Installation, kein Server, kein Login.
Für GitHub Pages den Ordner unverändert hochladen.

Zum Ausprobieren: «Découvrir le studio avec le profil d’exemple», dann «Générer un visuel».

## Was in v0.1 echt funktioniert

- Referenzbibliothek: Drag-and-drop (PNG, JPG, WebP), Stilreferenz markieren, von der Analyse
  ausschliessen, ersetzen, einzeln oder als ZIP exportieren, Sammlung als JSON ex- und importieren
- Cameron Style Profile: Import (Datei, Drag-and-drop, Einfügen), Validierung gegen das Schema mit
  Fehlerliste, Anzeige, Bearbeitung (Formular oder JSON), Export
- Style Engine: Profil + Motiv + Format + Textoption ergeben den Prompt («Voir le prompt», kopierbar,
  inkl. Negativ-Prompt und JSON-Anfrage)
- Canvas: Formate, Zoom/Pan, Variantenvergleich, Text- und Logo-Ebenen, Undo/Redo,
  Präsentationsmodus, Command Palette (Ctrl/⌘ K), Tastaturkürzel (?)
- Export als PNG/JPG in Formatauflösung oder doppelt
- Automatisches Speichern und Wiederherstellen in IndexedDB

## Was bewusst nicht echt ist

- **Keine KI-Bildgenerierung.** Der Demo-Modus zeichnet abstrakte Maquetten in den Profilfarben.
  Sie tragen im Canvas und in jedem Export den Vermerk «Maquette de démonstration, pas une image IA».
- **Keine KI-Stilanalyse.** «Analyser le style» bereitet ZIP und Briefing für Cameron vor.
  Die dort gezeigten Farben sind eine lokale Pixelzählung, keine KI-Auswertung.
- OpenAI Images, FLUX und Recraft sind als Anbieter vorbereitet, aber deaktiviert.

## Struktur

```
index.html
css/tokens.css, studio.css      Design-Tokens, Layout und Komponenten
js/config.js                    öffentliche Konfiguration (workerUrl), nie Schlüssel
js/core/                        util, db (IndexedDB), store (State, Undo, Autosave)
js/style/schema.js              JSON-Schema, Validierung, Beispielprofil, Cameron-Briefing
js/style/prompt-engine.js       Style Engine
js/style/color-measure.js       lokale Farbmessung
js/ai/pipeline.js               StyleAnalyzer → StyleProfile → ImageGenerator
js/ui/                          library, profile, stage, inspector, dialogs, export
schema/, examples/, docs/       Schema, Beispielprofil, Formatbeschreibung für Cameron
worker/                         Beispiel für den Cloudflare Worker
```

## Echte KI später anbinden

1. Worker nach `worker/cloudflare-worker.example.js` deployen, Schlüssel als Worker-Secret setzen.
2. In `js/config.js` die `workerUrl` eintragen. Danach sind die Anbieter unter
   «Options de génération» wählbar. Vor dem ersten Senden fragt das Studio nach;
   übertragen wird nur der Prompt, keine Referenzbilder.
3. Automatische Stilanalyse: in `js/ai/pipeline.js` den Analyzer `remote-api` implementieren.
   Er muss ein Objekt nach dem Profil-Schema zurückgeben, der Rest der Anwendung bleibt gleich.

Für UniPop Boost: Alle Funktionen hängen am globalen Objekt `UVS`; `UVS.buildPrompt()`,
`UVS.generators` und `UVS.setProfile()` sind die Anknüpfungspunkte.

## Datenschutz

Referenzen, Profil und Visuals bleiben im Browser dieses Rechners (IndexedDB). Die Anwendung lädt
keine externen Ressourcen und sendet im Demo-Modus nichts. Hinweis: Browserdaten löschen entfernt
auch die Bibliothek, deshalb die Sammlung regelmässig exportieren.

Die Markenschrift (Standard: Gotham) wird nur verwendet, wenn sie auf dem Rechner installiert ist.
