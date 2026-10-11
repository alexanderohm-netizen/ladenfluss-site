# Ladenfluss – freigegebene Bildvorlage als verbindliches Webdesign

Stand: 11. Oktober 2026 · Designzweig `feature/ladenfluss-design-v2-20261011`.

## Maßgebliche visuelle Referenzen

Zwei vom Auftraggeber gelieferte Ladenfluss-Mockups: (1) das große modulare Laden-Dashboard mit cremefarbener Navigation, oberer Suche, sechs KPI-Karten, Charts, PEP, Insights, Team, Urlaubsanträgen und Schnellaktionen; (2) die öffentliche Landingpage mit warmer Ladenfotografie, großer burgunderfarbener Serifenschrift „Ein System für deinen Laden“, sechs Produktkacheln, Vorteilen und floraler Markenatmosphäre.

**Diese Bildvorlagen ersetzen die frühere freiere Design-v2-Interpretation.** Es sollen keine weiteren KI-Mockupbilder generiert werden.

## Umsetzung

### Startseite (`index.html`, `assets/reference-landing.css`)
- Heller kompakter Header, weinrotes Ladenfluss-Logo, Links zu Produkten, Lösungen, Preisen, Ressourcen und Über uns.
- Laden-Hero mit echtem Pexels-Foto einer Floristin mit Tablet statt erfundenem Fotomaterial; weinrotes typografisches Leitmotiv sowie „Beta entdecken“ und „Demo ansehen“ als echte Links zur lokalen Anwendung.
- Sechs Produktkacheln in der Reihenfolge Cloud, Zahlenfluss, Warenfluss, PEP, Urlaubsplaner und Personalfluss; unfertige Module ausdrücklich „in Entwicklung“, nicht als fertig dargestellt.
- Vorteilszeile und Abschnitt „Läden bewegen Menschen“, warme Weiß-, Creme- und Brauntöne, burgunderrote Akzente und responsives Handylayout.
- Foto: Andrea Piacquadio / Pexels, Foto #3932817. Pexels-Lizenz vor produktiver Veröffentlichung bei Bedarf nochmals verifizieren; die Verwendung einer öffentlich eingebundenen Foto-URL kann Verfügbarkeit und Ladezeit beeinflussen.

### Cockpit (`mein-laden.html`, `assets/reference-dashboard.css`, `assets/reference-dashboard.js`)
- Helle linke System-Navigation in der Reihenfolge der Referenz: Übersicht, Mein Laden, Zahlenfluss, Warenfluss, PEP, Urlaubsplaner, Personalfluss, Cloud und verfügbare Hilfswerkzeuge; Settings, Backup und Module bleiben erreichbar.
- Suchleiste mit realen internen Links; Hinweiszähler und Ladenname; mobile aufklappbare Seitenleiste.
- Sechs Statuskarten, obere Dreispaltenreihe und untere Dreispaltenreihe sowie Schnellaktionen nach Referenz.
- **Wichtig:** Keine fiktiven Umsatz-, Warenbestands-, Bewerbungs- oder Cloud-Daten. Nicht angebundene Werte werden als „–“, geplante Module als „In Entwicklung“, die Cloud als **„Lokal“** ausgewiesen.
- Das Personalstunden-Diagramm basiert auf den vorhandenen aktuellen PEP-Wochenschichten, die PEP-Tabelle auf denselben Schicht-/Abwesenheitsdaten.
- Team-, Urlaubs- und Hinweis-Widgets lesen die vorhandenen lokalen Speicherformate und vorhandenen Hinweis-Engine; es entstehen keine neuen doppelten Datenbanken.
- Alle Werte werden als Textknoten erzeugt, keine Ausführung von selbst eingegebenem HTML. Widgets lesen Daten nur; Schreiben erfolgt weiterhin über die Module.
- Das bisherige Cockpit mit Ladenprofil, Richtwerten, Hinweisdetails, Rechenverlauf, Datensicherung und Modulstatus bleibt unter den ursprünglichen Tabs erhalten.

### Bestehende Modul-Seiten
Die vorherigen Implementierungen von PEP, Urlaubsplaner und Personalfluss bleiben funktionsfähig und im weinrot/cremefarbenen Design-v2-Stil. Sie sind eine Grundlage für die spätere vollständige visuelle Vereinheitlichung.

## Sicherheit, Verfügbarkeit und Grenzen

- Cloud-Beta bleibt deaktiviert, keine Supabase-Migrationen, keine Änderungen an der öffentlichen Domain.
- Änderungen liegen ausschließlich im GitHub-Designzweig und in Vercel-Preview-Deployments, Pull Request #13 bleibt Draft.
- Keine neue Bildgenerierung; das Fotomotiv ist ein bereits existierendes Pexels-Bild.
- Bestehende lokale Planungsdaten bleiben erhalten; neue Oberfläche liest diese Daten, statt Testzahlen zu simulieren.
- Automatische JS-/Browser-Checks prüfen Responsive-Breite, Navigation, Datenanschlüsse, Suche und Platzhalter. Visuelle Abnahme anhand der gelieferten Mockups durch den Auftraggeber ist vor einem produktiven Merge weiterhin erforderlich.

## Dateien
- `index.html`
- `assets/reference-landing.css`
- `mein-laden.html`
- `assets/reference-dashboard.css`
- `assets/reference-dashboard.js`
- `tests/browser/flows.test.cjs`
