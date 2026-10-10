# Ladenfluss

Professionelle statische Website für Ladenfluss.

## Aktueller verbindlicher Produktfahrplan (Beta + Personalfluss)

Die abgestimmte Reihenfolge aus Cloud, neuem Layout, Beta-Start, PEP,
Urlaubsplaner sowie Mitarbeiterprofilen und Bewerbermanagement ist in
[Produktfahrplan: Beta, PEP, Urlaub & Personalfluss](docs/produktfahrplan-beta-personalfluss.md)
festgehalten. Dieser Plan beschreibt die **Ziele**, nicht den gegenwärtigen
Funktions- oder Release-Status.

## Betrieb
- Domain: ladenfluss.de
- E-Mail: info@ladenfluss.de
- Betreiber: AO-Shop
- Hosting: Vercel

## Vor öffentlichem Livegang
Im Impressum muss noch die ladungsfähige Geschäftsadresse ergänzt werden.

## Deployment
Dieses Repository ist für ein direktes Vercel-Deployment vorbereitet.
Framework Preset: Other
Build Command: leer lassen
Output Directory: leer lassen


## Aktueller Stand

Website v1.5 ist der bisher veröffentlichte Stand. Die Stabilisierung v1.5.1
ist lokal vorbereitet, noch nicht hochgeladen oder veröffentlicht.
Details und nachvollziehbare Prüfergebnisse: [v1.5.1](docs/v1.5.1-stability.md).
Die lokale Weiterentwicklung ergänzt ein überarbeitetes Cockpit, gemeinsame
Besetzungsanalyse, Sicherungsexport und robustere Rechner. Aktueller Prüfstand:
[Cockpit und Planungslogik](docs/smarter-cockpit.md) – 44 Funktionstests bestanden;
visuelle Browserprüfung und native Builds weiterhin offen.

Für lokale Funktionstests: `npm ci --ignore-scripts` und `npm test`.
Für Browsertests zusätzlich `npx playwright install chromium` und
`npm run test:browser`.

## Historischer Produktplan v1.3–v1.5

Die folgenden Punkte sind Planungsziele, keine Bestätigung des Lieferstands.
Echtes Kundenlogin, Cloudspeicherung und buchbare Module sind weiterhin offen.

### v1.3 — Orientierung + Mein Laden
- öffentliche Willkommensseite als klarer Einstieg
- Produktübersicht und eigene Erklärseiten je Modul
- kostenloses Mein-Laden-Cockpit mit lokalen Stammdaten/Richtwerten
- Rechner als kostenlose Einstiegsprodukte
- geplante Module sichtbar, aber eindeutig als noch nicht verfügbar gekennzeichnet
- Ladenfluss MHD als späteren WWS-Baustein architektonisch reservieren

### v1.4 — Konto + modularer Kundenbereich
- echtes Laden-/Unternehmenskonto statt nur Browserdaten
- Benutzer, Unternehmen und Rollen als gemeinsame Datenbasis
- Modulstatus: kostenlos, Testphase, gebucht
- erste echte Dashboard-Daten statt reiner Zielwerte
- Produktseiten führen sauber in Anmeldung/Test/Buchung
- Architektur für modulare Preise (z. B. PEP einzeln) vorbereiten

### v1.5 — erster operativer Ladenfluss-Kern
- erster buchbarer Funktionsbereich, bevorzugt Personal & PEP
- Umsatz Tages-/Wochen-/Monatsansicht als eng verbundener Bereich
- gemeinsames Datenmodell für spätere Artikel, Kasse, Bestand und MHD
- klare Ereignis-/Änderungshistorie statt versteckter Überschreibungen
- mobile Bedienbarkeit für den Einsatz direkt im Laden

## Feste Produktprinzipien
1. Kleine Händler und inhabergeführte Geschäfte zuerst.
2. Ein Modul muss allein verständlich und nützlich sein.
3. Im WWS teilen Module dieselben Stammdaten; keine unnötige Doppelerfassung.
4. Oberfläche spricht in Aufgaben und Entscheidungen, nicht in ERP-Fachsprache.
5. Kostenloser Einstieg bleibt dauerhaft sinnvoll.
6. Kein Feature nur deshalb bauen, weil klassische ERP-Systeme es besitzen.
7. Kritische Bestands-, Preis-, Kassen- und Personaländerungen müssen nachvollziehbar sein.
8. Spätere MHD-Funktionen verwenden den zentralen Ladenfluss-Artikelstamm.
