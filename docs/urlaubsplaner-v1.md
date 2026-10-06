# Ladenfluss Urlaubsplaner – kostenlos in Web und WWS

## Produktentscheidung
Der Urlaubsplaner ist **kostenlos**:
- **Website**: Unter `/tools/urlaubsplaner` ohne Anmeldung.
- **Ladenfluss WWS Desktop**: eigener Menüpunkt **Urlaub**, unabhängig von kostenpflichtigen Warenwirtschaftsfunktionen.
- Kein Paywall-Check ist für den Urlaubsplaner vorgesehen. Ein späteres Benutzerkonto darf die kostenlose Grundfunktion nicht sperren.

## Funktionsumfang Website
- Mitarbeiter mit Jahresbudget erstellen und bearbeiten.
- Urlaub von/bis (einschließlich), Status **geplant** oder **bestätigt**, optional Notiz.
- Monatlicher Teamkalender, Jahresliste und verbleibendes Budget.
- Mo–Fr oder Mo–Sa als reguläre Arbeitstage.
- Feiertage nach Bundesland über `assets/de-holidays.js`; regionale Ausnahmen nicht vollständig.
- Warnung bei doppelten Zeiträumen derselben Person (wird nicht zugelassen).
- Hinweis bei Überschreitung der einstellbaren maximal gleichzeitigen Abwesenheiten (kein generelles Blockieren).
- Speicherung ausschließlich im Browser (`ladenfluss.urlaubsplaner.v1`), kein Login und kein Server.
- Druckansicht/PDF über den Browser.
- Optionaler Import von Mitarbeitern aus der **PEP-Demo desselben Browsers**. Nur gemeinsame Mitarbeiter-IDs verbinden die Module.
- Bestätigte Urlaubszeiträume sind in der **PEP-Demo desselben Browsers** als Abwesenheit erkennbar und fließen in den Besetzungscheck ein. Geplante, noch nicht bestätigte Zeiträume blockieren den PEP nicht automatisch.

## Funktionsumfang Desktop
- Eigenes Flutter-Modul und Dateispeicherung `vacations-v1.json` im lokalen Anwendungsordner.
- Mitarbeiter, Jahresbudgets, monatlicher Kalender, geplante/bestätigte Einträge, Zeitraumbearbeitung und Warnungen.
- Mo–Fr oder Mo–Sa; Feiertage nach Bundesland werden automatisch abgezogen; einzelne kommunale Ausnahmen sind noch nicht abgebildet.
- Versionsprüfung und Sicherungsdatei, Warnung bei Lese-/Schreibproblemen.
- Nicht mit Website, Login, PEP oder einer Cloud verbunden.

## Wichtige Grenzen vor einem produktiven Einsatz
- Browserdaten können beim Löschen der Browserdaten verloren gehen. Andere Geräte sehen den Plan nicht.
- Desktopdaten sind unverschlüsselt; nicht auf gemeinsam zugänglichen Rechnern mit echten Personaldaten einsetzen.
- Keine individuelle Teilzeitlogik oder echten Genehmigungsrechte, keine automatische Urlaubsanspruchsberechnung nach BUrlG und keine Lohnabrechnung.
- Einträge und Überschneidungen sind **Planungshilfen**, keine Entscheidungen über rechtliche Urlaubsansprüche.
- Es fehlt eine geprüfte Import-/Export- und Synchronisationsstrategie zwischen Web und Desktop.

## Verifikation
- JS-Regeltests: `node --test tests/urlaubsplaner.test.cjs`
- Syntax: `node --check assets/urlaubsplaner-store.js && node --check assets/urlaubsplaner.js && node --check assets/pep.js`
- Flutter: `cd desktop && flutter pub get && flutter analyze && flutter test`
- Automatische CI-Workflows sind angelegt. Erfolgreiche vollständige Test- und macOS-/Windows-Builds sind noch nicht bestätigt.
- Änderungen liegen auf `develop/v1.5`, sind **nicht auf `main`** veröffentlicht.
