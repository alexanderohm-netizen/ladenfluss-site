# Ladenfluss WWS Desktop

Eigenständiger Flutter-Desktop-Client für macOS und Windows – **kein WebView** der Ladenfluss-Website.

## Aktueller Entwicklungsstand (v1.5)

- Artikel anlegen, bearbeiten und nach Name, Nummer oder Barcode suchen.
- Bestände erfassen: Wareneingang, Verkauf/Abgang, Abschrift und Korrektur.
- Buchungshistorie und Prüfung auf negative Bestände.
- Dashboard mit tatsächlich berechneten Hinweisen zu Meldebeständen und Preisen unter Einkaufspreis.
- Einkauf: einfache, transparente Nachbestellvorschläge auf Basis von Meldebeständen. **Keine echte Bestellung**.
- **Urlaubsplaner: kostenloses Desktop-Modul** mit Mitarbeiterliste, jährlichem Urlaubskontingent, Planungskalender, Status, Überschneidungswarnungen und lokaler Speicherung.
- Versionierte lokale JSON-Speicherung mit Sicherungsdatei und nacheinander ausgeführten Schreibvorgängen.
- Bei nicht lesbaren lokalen Daten wird die Bearbeitung gesperrt, um versehentliches Überschreiben zu vermeiden.
- Erste Unit-Tests für Artikel, Bestandslogik, Urlaubstage, Überschneidungen und Speicherreihenfolge unter `test/`.
- GitHub Actions prüft Dart-Code und Tests; dessen erfolgreiche Ausführung ist noch nicht bestätigt.

**Urlaubstage im WWS:** Aktuell kann für die Planung eine regelmäßige 5- oder 6-Tage-Woche gewählt werden. Feiertage nach Bundesland werden berücksichtigt; kommunale Ausnahmen und individuelle Teilzeit-/Schichtmodelle sind noch nicht vollständig abgebildet. Auch der öffentliche Urlaubsplaner auf der Website bietet Bundesland-Feiertage; die beiden Speicherstände sind **nicht synchronisiert**. Genehmigungen sind manuell markierter Status, kein echter digitaler Genehmigungsprozess.

**Achtung:** Beim ersten Start werden zwei **Beispielartikel** angelegt. Die lokale Datei enthält keine Verschlüsselung, keine Cloud-Synchronisierung, keinen echten Login und keine Trennung echter Kundenkonten. Nicht für produktive Unternehmensdaten geeignet.

## Start auf einem Entwicklungsrechner

1. Flutter SDK mit Desktop-Unterstützung installieren.
2. Flutter 3.47.6 verwenden. Im Ordner `desktop/` auf dem Mac `python3 tool/prepare_desktop.py --platform macos`, auf Windows `python tool/prepare_desktop.py --platform windows` ausführen. Das erzeugt den fehlenden Runner, ohne App-Code oder Tests zu ersetzen.
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

## Stabilisierung v1.5.1 (vorbereitet)

Die drei bekannten Dropdown-Analysehinweise sind im Code korrigiert. Deutsche
Dialoge, ein scrollbareres Dashboard und zwei Widgettests wurden ergänzt.
Der GitHub-Workflow bereitet nach erfolgreichen Analyse-/Testschritten native
macOS- und Windows-ZIP-Artefakte vor. Die automatische Prüfung wurde für diesen
Stand noch nicht ausgeführt: Der Upload benötigt eine Freigabe.
Siehe [Prüfstatus](../docs/v1.5.1-stability.md).
