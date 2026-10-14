# Ladenfluss Cloud Beta – Freigabeplan

Stand: 10.10.2026. Dieser Plan ist **keine** Bestätigung, dass die Cloud bereits produktionsreif ist.

## Reihenfolge und Freigabekriterien

### 1. Mandantentrennung (Blocker)
- Zwei unabhängige Testunternehmen A und B mit je einem echten Testkonto anlegen.
- Mit dem normalen Supabase-Client (Publishable Key, User-JWT) versuchen, Daten des jeweils anderen Unternehmens zu lesen, anzulegen, zu ändern und zu löschen.
- Alle fremden Zugriffe müssen abgewiesen werden; Zugriff innerhalb des eigenen Unternehmens muss rollenabhängig funktionieren.
- Rollen owner/admin/manager/employee auf jeder betroffenen Tabelle separat prüfen.
- Nicht allein auf vorhandene RLS-Schalter oder fehlende Advisor-Warnungen vertrauen.

### 2. Datenintegrität und Synchronisation (Blocker)
- Revisionskonflikte mit zwei gleichzeitig geöffneten Sitzungen testen: keine stillen Überschreibungen.
- Fehlgeschlagene Netzwerkoperationen dürfen lokale Änderungen nicht als synchronisiert markieren.
- JSON-Payloads anhand eines versionierten Schemas validieren, bevor sie gespeichert oder geladen werden.
- Backup-Export und Wiederherstellung zunächst in einer Testumgebung verifizieren.
- Cloud-Dokumenthistorie auf konsistente Revisionsnummern prüfen.

### 3. Authentifizierung und E-Mail (Blocker)
- Resend SMTP in Supabase konfigurieren, ohne API-Schlüssel in Git oder Client-Code zu speichern.
- Registrierung, Bestätigung, Anmeldung, Abmeldung und Passwort-Reset durchtesten.
- Redirect-URLs ausschließlich auf vertrauenswürdige Ladenfluss-Domains beschränken.
- CAPTCHA, Rate-Limits und E-Mail-Absender kontrollieren.

### 4. Website und Oberfläche
- Cloud-Funktionen bis zur bestandenen Abnahme sichtbar als Beta kennzeichnen.
- Klare Zustände: gespeichert, synchronisiert, offline, Konflikt, Fehler.
- Die kostenlosen Werkzeuge einschließlich Urlaubsplaner bleiben ohne Paywall.
- Weinrot/Braun/Cremeweiß als Designsystem; mobile Ansichten und Barrierefreiheit prüfen.

### 5. Fachmodule
- PEP und Urlaubsplaner auf gemeinsame Mitarbeiter-/Filialstammdaten umstellen.
- Danach Personalfluss mit Mitarbeiterprofilen und Bewerbungsverwaltung konzipieren.
- Warenfluss mit zentralem Artikelstamm, Bestand, MHD und Warnungen ergänzen.
- Zahlenfluss erst nach nachvollziehbarer Datenherkunft und Rechteprüfung integrieren.

## Gegenwärtig nachgewiesen
- Supabase-Projekt aktiv; sechs Tabellen im public-Schema, alle mit RLS aktiviert.
- Security- und Performance-Advisors meldeten am 10.10.2026 keine Warnungen.
- Dies ist **kein** Nachweis für korrekte Policies oder erfolgreiche Ende-zu-Ende-Tests.
- Der bestehende README beschreibt lokale v1.5.1-Arbeiten; Live-Deployment und Browser-/Desktop-Tests bleiben gesondert zu bestätigen.

## Release-Gate
Keine Freigabe für echte Kundendaten, bevor Mandantentrennung, Datenintegrität, SMTP-Auth, Backups und End-to-End-Tests erfolgreich dokumentiert wurden.
