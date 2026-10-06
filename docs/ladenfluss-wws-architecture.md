# Ladenfluss – Zwei Produkte, eine Plattform

Status: Architekturentwurf v1.5, noch keine produktive Desktop-App.

## Produktgrenzen
**Ladenfluss Web** (ladenfluss.de): kostenlose Rechner ohne Login; eigenständige Werkzeuge wie PEP und MHD; Kundenkonto, Unternehmens- und Filialverwaltung. Einzeln nutzbare Werkzeuge bleiben im Browser.

**Ladenfluss WWS** (Flutter Desktop für macOS und Windows): täglicher Warenwirtschafts-Arbeitsplatz mit Artikelstamm, Lieferanten, Einkauf/Bestellungen, Wareneingang, Beständen, Inventur, Preisen/Aktionen und Auswertungen. Kassenintegration erst nach technischer und rechtlicher Prüfung.

## Gemeinsame Plattform
- Supabase Auth: verifizierte Benutzer, Passwort-Reset und serverseitig geprüfte Zugriffe.
- PostgreSQL: companies, company_members, branches; später products, suppliers, inventory_movements, purchase_orders, receipts, price_history.
- Row Level Security für jeden mandantenbezogenen Datensatz; keine service_role im Client.
- Geschäftsregeln für Buchungen und Bestandsänderungen ausschließlich über geprüfte Serverfunktionen/Transaktionen.
- Jede Bewegung revisionsfähig mit Akteur, Zeitpunkt, Ursache, Standort und Referenz.
- Webmodule und Desktop greifen auf dieselbe fachliche Datenbasis zu, nicht auf gegenseitige Browser-/Gerätespeicher.

## Desktop-UX
Navigation: Heute, Artikel, Bestand, Einkauf, Wareneingang, Inventur, Auswertungen, Einstellungen.
Startbildschirm priorisiert konkrete Handlungen: fehlender Bestand, MHD-Risiko, überfällige Lieferung, unplausible Preise. Jede Meldung zeigt Ursache, Wirkung und nächsten Schritt.
Tastaturbedienung, Barcode-Scanner als Eingabegerät, schnelle Suche, druckbare Dokumente und klare Statusanzeigen sind MVP-Kriterien.

## Offline und Synchronisation
MVP startet bewusst online-first. Lokaler verschlüsselter Cache und offlinefähige Bestandsbuchungen erst mit Konfliktregeln, Idempotenzschlüsseln und nachvollziehbarem Synchronisationsprotokoll. Keine unkontrollierte Offline-Mengenänderung.

## Release-Schnitt
Phase A: sichere Accounts + Unternehmen/Filialen + Rollen (Web).
Phase B: Desktop-Shell für Windows/macOS + Login + Filialauswahl + read-only Artikelübersicht.
Phase C: Artikelstamm, Lieferanten und transaktionale Bestandsbewegungen.
Phase D: Bestellung, Wareneingang, Inventur und proaktive Hinweise.
Phase E: MHD, Zahlenfluss und PEP über gemeinsame Datenmodelle verbinden.

## Nicht behaupten
Es existiert noch kein fertiger Desktop-Build, kein verbundener Supabase-Produktivdienst und keine verifizierte Windows-/macOS-Auslieferung.
