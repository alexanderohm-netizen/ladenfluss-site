# Ladenfluss WWS Desktop

Eigenständiger Flutter-Desktop-Client für macOS und Windows – **kein WebView** der Ladenfluss-Website.

## Aktueller Entwicklungsstand (v1.5)

- Artikel anlegen, bearbeiten und nach Name, Nummer oder Barcode suchen.
- Bestände erfassen: Wareneingang, Verkauf/Abgang, Abschrift und Korrektur.
- Buchungshistorie und Prüfung auf negative Bestände.
- Dashboard mit tatsächlich berechneten Hinweisen zu Meldebeständen und Preisen unter Einkaufspreis.
- Einkauf: einfache, transparente Nachbestellvorschläge auf Basis von Meldebeständen. **Keine echte Bestellung**.
- Versionierte lokale JSON-Speicherung mit Sicherungsdatei und nacheinander ausgeführten Schreibvorgängen.
- Bei nicht lesbaren lokalen Daten wird die Bearbeitung gesperrt, um versehentliches Überschreiben zu vermeiden.
- Erste Unit-Tests für Artikel, Bestandslogik und Speicherreihenfolge unter `test/`.
- GitHub Actions prüft Dart-Code und Tests; dessen erfolgreiche Ausführung ist noch nicht bestätigt.

**Achtung:** Beim ersten Start werden zwei **Beispielartikel** angelegt. Die lokale Datei enthält keine Verschlüsselung, keine Cloud-Synchronisierung, keinen echten Login und keine Trennung echter Kundenkonten. Nicht für produktive Unternehmensdaten geeignet.

## Start auf einem Entwicklungsrechner

1. Flutter SDK mit Desktop-Unterstützung installieren.
2. Im Ordner `desktop/` einmal ausführen: `flutter create --platforms=macos,windows .` (erzeugt die noch fehlenden nativen Runner).
3. `flutter pub get`
4. `flutter run -d macos` oder auf Windows `flutter run -d windows`.
5. `flutter test` und `flutter analyze` zur Prüfung ausführen.

**Build-Status:** In dieser Entwicklungsumgebung ist kein Flutter SDK vorhanden; das Programm wurde hier noch nicht kompiliert oder als Mac-/Windows-Anwendung gestartet.

## Nächste Meilensteine

1. Erste erfolgreiche macOS- und Windows-Builds und Behebung aller Test-/Analysefehler.
2. Sicheres Kundenlogin und Unternehmen-/Filialmodell (Supabase Auth + RLS).
3. Serverseitige, transaktionale Bestandsbuchungen einschließlich Idempotenz und Rollenrechten.
4. Lieferanten, echte Bestellungen, Wareneingänge und Inventur.
5. Ladenfluss MHD, Zahlenfluss und PEP mit gemeinsamem Firmenkonto verbinden.

Im ersten Schritt wird bewusst **keine** Offline-/Cloud-Synchronisation behauptet. Das erfordert später Konfliktauflösung, serverseitige Autorisierung und eigene Tests.
