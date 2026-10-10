# Ladenfluss – verbindlicher Produktfahrplan: Beta, PEP, Urlaub & Personalfluss

Festgehalten am 10. Oktober 2026 aufgrund der Produktentscheidung des Gründers.
**Status:** Produktanforderungen und Prioritäten, keine Behauptung über implementierte oder veröffentlichte Features.

## 1. Erst die technisch funktionierende Beta vorbereiten
- Neues, konsistentes, modernes Ladenfluss-Layout für Website, Anmeldung, Cockpit und wichtige Cloud-Ansichten entwerfen und browserübergreifend prüfen.
- Echte Registrierung/Login/E-Mail-Bestätigung, Unternehmensanlage und gemeinsame Cloud auf mehreren Geräten vollständig mit echtem Postfach testen.
- Module/Rollen/Zugriffsrechte, Cloud-Speicherung, Datenisolierung, Datenschutz, Lösch- und Exportmöglichkeiten vor einem öffentlichen Betatest prüfen.
- Erst **wenn Layout online UND Cloud tatsächlich funktioniert**, den neuen Stand auf ladenfluss.de veröffentlichen und **überall klar als „Beta“ kennzeichnen** (Website/Header, Kundenkonto und produktrelevante Module). Nutzer dürfen keinen fertiggestellten Regelbetrieb annehmen.
- Bereits produktive Website nicht durch unfertige Entwicklungsstände ersetzen. Keine öffentliche Freigabe/Stripe-Live-Schaltung, bis die jeweiligen Release-Gates erfüllt sind.
- Kostenlos nutzbare Werkzeuge weiter verfügbar halten; kein Loginzwang für bisher freie Rechner, soweit nicht produktbedingt notwendig.

## 2. Nach dem Beta-Start: PEP deutlich verbessern
- **PEP** wird ein wichtiges Entwicklungsprojekt mit deutlich besserer Bedienbarkeit, Gestaltung und Funktionalität: Es soll im Ladenalltag wirklich überzeugend sein, nicht nur ein einfacher Planer.
- Bestehende Oberfläche und Funktionen zuerst kritisch auf Schwachstellen, unklare Abläufe und Reibung prüfen. Dann gezielte UX-Verbesserungen entwickeln und durch realistische Tests absichern.
- Vorschläge zur Detailplanung (noch nicht ausdrücklich beauftragt): bessere Wochen-/Monatsübersicht, schnelle Schichtbearbeitung, Visualisierung von Besetzungsbedarf, Abwesenheits- und Konflikthinweise, mobile Bedienung, transparente Freigabe von Plänen.
- Verbindung mit Personalfluss (Stammdaten) und Urlaubsplaner; keine dreifache Pflege von Mitarbeitern.

## 3. Urlaubsplaner neu denken
- Der bisherige Urlaubsplaner entspricht noch nicht den Erwartungen; **nicht** bloß kosmetisch überarbeiten.
- Bedienfluss, Darstellung, Übersichtlichkeit und praktische Nützlichkeit grundlegend verbessern. Kostenloses Kernangebot ausdrücklich berücksichtigen.
- Potenzielle Gestaltungsideen (vor Umsetzung noch zu priorisieren): klarer Teamkalender, individuelle Resturlaubskonten, Überschneidungswarnungen, einfacher Antrag-/Genehmigungsablauf, Verknüpfung mit PEP, mobile Benutzung.
- Urlaubsinformationen nur berechtigten Mitarbeitern/Vorgesetzten offenlegen und angemessene Datenschutzregeln vorsehen.

## 4. Eigenes Modul „Personalfluss“ (Arbeitstitel bestätigt als Wunschrichtung)
Ziel: zentrale Verwaltung personeller Themen/HR, verbunden mit dem PEP und Urlaubsplaner.

### Mitarbeiterprofile
- Für **jeden Mitarbeiter** soll ein eigenes, zugeordnetes Profil existieren.
- Einmalig gepflegte Stammdaten werden für Personaleinsatzplanung, Abwesenheiten und weitere Personalprozesse gemeinsam genutzt.
- Rollen- und standortabhängige Berechtigungen; HR-Daten nicht pauschal jedem Kollegen offenlegen.
- Welche Profilfelder erfasst werden, später anhand Erforderlichkeit und DSGVO definieren; keine unnötige Speicherung sensibler Mitarbeiterinformationen.

### Stellenanzeigen und Bewerbungen
- Händler sollen **Stellenanzeigen erstellen und veröffentlichen / ausschreiben können**.
- Bewerbungen sollen in einem klaren, datenschutzgerechten Prozess eingehen und bearbeitet werden können (Bewerberübersicht, Status, Kommunikation, Verantwortlichkeiten und notwendige Löschfristen).
- Öffentliches Jobportal, teilbare Stellenlinks auf ladenfluss.de und optional externe Jobbörsen als zu prüfende Veröffentlichungswege; **kein Versprechen**, bereits mit Drittanbieter-Jobbörsen verbunden zu sein.
- Interessenten/Bewerber sind zunächst **keine Mitarbeiterkonten**. Erst nach einer tatsächlichen Einstellung können über einen kontrollierten Prozess Mitarbeiterprofile angelegt werden.
- Keine automatische Datenweitergabe, bevor Rechtsgrundlagen, Einwilligungen wo erforderlich und passende Berechtigungen existieren.

## Architektonische Leitlinien
- Ein Unternehmen und seine Filialen, **ein gemeinsamer Mitarbeiterstamm**, gemeinsame Rollen, einheitliche Cloud.
- PEP, Urlaubsplaner und Personalfluss sind eigenständige Module, arbeiten aber vernetzt.
- Kleine Einzelhändler zuerst; leicht verständliche Bedienung statt komplexer ERP-Strukturen.
- Auf neue Features wird „online“ erst geschrieben, wenn sie **tatsächlich** veröffentlicht und geprüft sind.
- Fortschritt nach jeder Etappe separat dokumentieren: geplant / in Entwicklung / testbar / produktiv.

## Reihenfolge als verbindliche Priorität
1. Resend-Domainverifizierung und produktive Supabase-E-Mail-Einrichtung, Live-Login mit echtem Kunden-/Testkonto.
2. Echte, sichere Cloud auf Mac/Telefon testen; Datenschutz-/Freigabeschritte fertigstellen.
3. Neues Layout abschließen und auf ladenfluss.de **als Beta** veröffentlichen.
4. PEP funktional und visuell erheblich aufwerten.
5. Urlaubsplaner grundlegend verbessern und mit PEP verzahnen.
6. Personalfluss mit Mitarbeiterprofilen und Stellen-/Bewerberverwaltung aufbauen; Integration mit PEP und Urlaub.

**Entscheidung zur Benennung:** „Personalfluss“ wird vorläufig als Name des HR-Bereichs verwendet, bis die finale Benennung gemeinsam feststeht.
