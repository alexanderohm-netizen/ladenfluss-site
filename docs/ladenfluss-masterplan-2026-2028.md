# Ladenfluss Masterplan 2026–2028

Status: Produktstrategie und Entwicklungsplan, keine Implementierungszusage.

## Vision
Modulare, intuitive Handelssoftware für kleine und mittelständische Händler. Gemeinsame Stammdaten, transparente Warnungen und konkrete Handlungsempfehlungen. Markenstil: Weinrot, Braun, Cremeweiß.

## Grundprinzipien
- Zuverlässigkeit und Mandantentrennung vor neuen Funktionen.
- Kostenloser Einstieg und Urlaubsplaner bleiben sinnvoll nutzbar.
- Ein Datenobjekt hat eine verantwortliche Quelle; keine unnötige Doppelerfassung.
- Warnungen müssen ihre Datenbasis und Unsicherheit offenlegen.
- Jede Phase hat ein messbares Abnahmekriterium; keine ungeprüften Live-Releases.
- Anforderungen des Gründers werden als neue Tickets aufgenommen und priorisiert, ohne stillschweigend den Scope zu ändern.

## Phase 1 – Fundament (Priorität P0)
Cloud-Beta: SMTP, Registrierung, Mandantentrennung, Rollen, Synchronisationskonflikte, Backups und Wiederherstellung, E2E-Tests. Abnahme: zwei Testunternehmen können unabhängig und sicher arbeiten.

## Phase 2 – Design (P1)
Einheitliches Designsystem in Weinrot/Braun/Cremeweiß für Website, Dashboard, Module und Mobilansichten. Abnahme: konsistente Navigation und geprüfte responsive Oberflächen.

## Phase 3 – Personal (P1)
PEP, Urlaubsplaner, Personalfluss mit Mitarbeiterprofilen und Bewerbungsverwaltung auf gemeinsamen Personalstammdaten. Abnahme: vollständiger Dienstplan- und Urlaubsworkflow mit Rechten und Konfliktbehandlung.

## Phase 4 – Waren (P2)
Warenfluss, zentraler Artikelstamm, Bestandsbewegungen, MHD, Inventur, Barcode und Verlustwarnungen. Abnahme: nachvollziehbare Bestandsänderungen und getestete MHD-Kontrollen.

## Phase 5 – Zahlen und Intelligenz (P2)
Zahlenfluss, KPI-Cockpit, transparente regelbasierte Warnungen und erst danach KI-gestützte Empfehlungen. Abnahme: reproduzierbare Zahlen und erklärbare Hinweise.

## Phase 6 – Marktvalidierung (parallel)
5–10 Pilotgeschäfte, strukturierte Rückmeldungen, Tarife, Abrechnung, Support, Datenschutz und rechtliche Freigabe. Abnahme: wiederholte echte Nutzung und nachgewiesene Zahlungsbereitschaft.

## Phase 7 – Skalierung (langfristig)
Desktop-WWS, Filialverbünde, Integrationen und automatisierte Abläufe. Abnahme: stabile Builds, wirtschaftlicher Betrieb, sichere Schnittstellen.

## Sofortiger nächster Schritt
Phase 1, Paket 1: vorhandene RLS-Policies und Datenbankfunktionen read-only inventarisieren, danach isolierte Testfälle für zwei Unternehmen festlegen. Keine echten Kundendaten für Tests verwenden. Dokumentation der Testergebnisse vor Freigabe.

## Aktueller Stand (10.10.2026)
Supabase-Projekt aktiv, sechs public-Tabellen mit RLS; Security- und Performance-Advisors ohne Warnungen. Kein Beweis für korrekte Mandantentrennung. v1.5.1 laut Repo-Dokumentation lokal entwickelt, noch nicht veröffentlicht. SMTP-Konfiguration offen.
