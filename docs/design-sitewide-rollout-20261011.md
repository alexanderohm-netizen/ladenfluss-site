# Ladenfluss – Designumstellung der gesamten Website (11. Oktober 2026)

## Ziel und verbindliche Vorlage

Die beiden vom Auftraggeber freigegebenen Mockups sind maßgeblich. Alle öffentlichen Seiten und lokalen Werkzeuge müssen ein zusammenhängendes Ladenfluss-System im Look Weinrot (Burgunder), Cremeweiß, warmes Braun und ruhige Serifenschriften bilden. Keine neuen generierten Bilder.

## Erfasste Bereiche

**Website und Navigation**
- `index.html`: Ladenfoto, Hero „Ein System für deinen Laden“, sechs Modul-Kacheln, Vorteile, Geschichtenabschnitt.
- `assets/site.css` lädt `assets/reference-system.css` zum Schluss: Referenzfarben, gemeinsame Navigation und Markenlogo sowie einheitliche Desktop-/Mobile-Layouts.
- Gemeinsame Header-Navigation für Tools, PEP, Personalfluss, Urlaub, Kontakt, Über uns, Impressum, Datenschutz, Konto/Onboarding und Produktübersichten.
- `produkte.html` und `produkte/*.html`: neue Produktkarten und Überschriften; verfügbare lokale PEP-Beta ist nicht mehr fälschlich als „nicht verfügbar“ ausgezeichnet.
- CSS-Inhalte statt neuer dynamischer Speicherlogik: Die bestehende lokale Produktnutzung und die noch nicht freigegebene Cloud bleiben unverändert.

**Rechner**
- `rechner.html` + `assets/calculator-app.js` + `assets/reference-calculator.css`: neue Markenheader, acht direkte Modus-Links mit Anzeige des aktiven Modus, einheitliches Rechnungs- und Tastenfeld.
- Acht einzelne Rechner unter `/tools/`: Personalbedarf, Marge/Verkaufspreis, Rabatt, Break-even, KPI, Personalbudget, Rohertrag/Wareneinsatz und Lagerumschlag. Alle erhalten dieselben Eingabe-, Ergebnis- und Erklärungsoberflächen.
- `tools/index.html`: Übersicht mit acht direkten Links zum passenden Rechner.
- Rechenfunktionen in `assets/site.js` wurden bewusst nicht verändert. Neue CSS- und Navigationsschichten dürfen keine Standardwerte, Formeln oder gespeicherten Richtwerte verändern.
- Rechner bleiben kostenlos und lokal. Beispielwerte werden nicht als echte Verkaufsdaten dargestellt.

**System und Personal**
- `mein-laden.html` und `assets/reference-dashboard.*`: echte lokale PEP-, Team- und Urlaubsansichten, keine erfundenen Umsatz- oder Cloud-Daten.
- `pep.html`, `tools/urlaubsplaner.html`, `mitarbeiter.html`: behalten bereits überarbeitete Funktionsansichten; gemeinsame Marken-Navigation und Farben.
- `konto.html`, `onboarding.html`: optisch vereinheitlicht, aber weiterhin keine öffentlich aktivierte Cloud-Registrierung.

## Qualitätscheck

- Bestehende JavaScript-/Node- und Playwright-Tests bleiben obligatorisch.
- Zusätzliche Playwright-Tests überprüfen bei 1440, 768, 390 und 320 px die wichtigsten Rechner-, Tool-, Kontakt- und Produktseiten und kontrollieren den horizontalen Überlauf.
- Tests prüfen die Werte für beispielhafte Rabatt-, Margen- und Break-even-Berechnungen sowie Moduswechsel, aktiven Modus, mobile Navigation und Erreichbarkeit der acht Direktlinks.
- Gezielte Fehlerkorrekturen in Tests: Erweitertes Eingabefeld zuerst aufklappen; bei Hash-Routen auf den Abschluss der UI-Umstellung warten. Keine Rechenformeländerung.

## Veröffentlichung / Cloud-Abgrenzung

Design-Änderungen stammen aus `feature/ladenfluss-design-v2-20261011` (PR #13). Die Cloud-Härtung in PR #12 ist davon getrennt; die Cloud-Beta wird weder aktiviert noch mit dieser Design-Freigabe gemerged. Es finden **keine** Datenbankmigrationen und keine neuen Cloud-Speicheraktionen statt. Die öffentliche Freigabe erfolgt nur nach grünen Browser- und Formelprüfungen.

## Nach der Freigabe prüfen

- `https://ladenfluss.de/`, `/rechner`, `/tools`, `/tools/margenrechner`, `/mein-laden`, `/pep`, `/tools/urlaubsplaner`, `/mitarbeiter`
- Mobile Navigation, Fenstergrößen 320–1440 Pixel, Formular- und Ergebnisdarstellung, Kopieren und lokale Planung.
- Farbgleichheit und Motivauswahl im Vergleich zur Vorlage.
