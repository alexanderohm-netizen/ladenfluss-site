# Personalfluss – Team & Mitarbeiterprofile (Design v2)

**Entwicklungszweig:** `feature/ladenfluss-design-v2-20261011` · **Stand:** 11.10.2026  
**Cloud-Beta und Bewerbungsannahme sind NICHT freigeschaltet.**

## Tatsächlich implementiert

- Neue, responsive Start- und Überblicksansicht `/mitarbeiter`, passend zur Ladenfluss-Farbwelt Weinrot/Braun/Creme.
- Durchsuchbare Teamliste, Rollenfilter, anklickbare Profile, Stammdaten hinzufügen und bearbeiten.
- Profilansicht mit Rolle, Einsatzort, Sollstunden, selbst gesetzter Unterlagen-Kennzeichnung.
- Aktuelle Dienstplanwoche aus **derselben** Team- und Wochenplan-Speicherung wie PEP; zeigt Schichtzeiten, Wochenstunden und eingetragene Abwesenheiten.
- Urlaubsplaner-Verbindung über die Mitarbeiter-ID: bestätigte Urlaubszeiträume werden im Profil gezählt, wenn der Mitarbeiter aus dem Team im Urlaubsplaner übernommen wurde.
- Bestehende Team-IDs bleiben beim Bearbeiten unverändert, damit die PEP-Zuordnung der Schichten erhalten bleibt.
- Keine HTML-Ausführung aus Namen oder Profildaten: DOM `textContent`, keine ungeprüfte Markup-Interpolation.
- Schreibfehler werden sichtbar. Das vorhandene Team wird nicht durch einen nur scheinbar erfolgreichen Speichervorgang verändert; beschädigte Teamlisten sind in Personalfluss schreibgeschützt.
- Bestehende Demo-Mitarbeiter werden als Beispiel kenntlich gemacht.
- Bewerbungsmodul: **nur beschriftete Roadmap** (Ausschreibung → Sichtung → Gespräch → Entscheidung). Es gibt weder veröffentlichte Stellenanzeigen noch ein Bewerbungsformular oder lokale Bewerberdaten.

## Speicherung und Datenschutz

Der vorhandene Schlüssel `ladenfluss.team.v1` bleibt unverändert: dieselben Datensätze dienen dem PEP und dem Personalfluss. Das ist derzeit **Browser-LocalStorage, keine serverseitige Personalverwaltung**. Ein anderer Nutzer desselben Browsers kann die lokalen Teamdaten sehen, solange sie nicht gelöscht werden. Das Tool ist nicht für vertrauliche Mitarbeiterunterlagen, Gesundheitsdaten, Gehälter, Kontaktdaten oder Bewerbungsunterlagen geeignet. Diese werden bewusst nicht abgefragt oder gespeichert.

Die Urlaubsdaten liegen weiterhin getrennt unter `ladenfluss.urlaubsplaner.v1` und müssen im Urlaubsplaner über den expliziten Teamimport verknüpft werden. Es erfolgt **keine stillschweigende Synchronisierung** oder Veränderung des Urlaubsplans beim Bearbeiten eines Personalfluss-Profils. Namen können deshalb nach einer Änderung vorübergehend zwischen den Modulen abweichen, bis eine echte, geprüfte Team-Synchronisation entwickelt wird.

## Noch offen (separates Feature nach Cloud-Beta)

- Multi-Tenant-Accounts, rollenbasierte HR-Berechtigungen, Audit-Log, angemessene Datenhaltung/Löschkonzept.
- Arbeitsverträge/Qualifikationen/Onboarding mit differenziertem Zugriff.
- Bewerbermanagement mit datenschutzkonformen Fristen, Dateiuploads, Bewerbungsstatus und veröffentlichten Stellenausschreibungen.
- Redaktionell abgestimmte Einbindung in die neue Website und das Cockpit bei späterer Produktionsfreigabe.

## Tests

- `tests/web-flows.test.cjs`: Mitarbeiter-ID bleibt bei Bearbeitung erhalten, Speicherfehler werden nicht verschluckt, beschädigte Datensätze bleiben unverändert, kein HTML-Injection-Risiko.
- `tests/browser/flows.test.cjs`: Profile, Suche, Filter, PEP-Verbindung bei 1440/768/390/320 px; bestätigter Urlaub nach bewusstem Teamimport im Profil sichtbar.
- `npm test` und `npm run test:browser` auf GitHub Actions.

## Freigabe

Die Entwicklung bleibt in **Draft PR #13**. Keine Änderungen auf `main`, keine Produktionsdatenbank-Änderung und keine Cloud-Aktivierung.
