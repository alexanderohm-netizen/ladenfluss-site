# Ladenfluss – verbindlicher Produktfahrplan: Beta, PEP, Urlaub & Personalfluss

Festgehalten am 10. Oktober 2026 aufgrund der Produktentscheidung des Gründers.
**Status:** Produktanforderungen und Prioritäten, keine Behauptung über implementierte oder veröffentlichte Features.

## 1. ZUERST: Cloud-Fundament und Beta-Funktionen zuverlässig fertigstellen
- **Cloud kommt vor dem neuen Design.** Erst echte, geräteübergreifende Synchronisierung, gemeinsamer Unternehmens- und Filialkontext, Authentifizierung, Berechtigungen und belastbare Speicherung aufbauen.
- Resend/Supabase-Login mit echten Bestätigungsmails, Passwort-Reset und mindestens zwei Geräten Ende-zu-Ende testen.
- Bestehende lokale Daten nur nach klarer Zustimmung und sicherer Konfliktbehandlung migrieren; niemals still überschreiben. Cloud-Verlauf, Datenexport und Wiederherstellung prüfen.
- Einen brauchbaren **Beta-Funktionsumfang** fertigstellen: Anmeldung, Unternehmensanlage, kostenlose Cloud-Funktionen und ein konsistentes Grund-Dashboard; bezahlte Module nur entsprechend tatsächlich verfügbarem Funktionsstand und aktiven Berechtigungen.
- Datenschutz, Rollen/Filialen, Datenisolierung, Löschung und mobile Funktion vor Freigabe absichern. Keine angeblich synchronisierten Funktionen zeigen, die nur lokal gespeichert werden.
- **Definition von „Cloud funktioniert“:** Ein angelegtes Unternehmen und freigegebene Daten können nach erneuter Anmeldung auf einem zweiten Gerät geladen werden; Änderungen sind unter definierten Regeln nachvollziehbar; fremde Nutzer dürfen nicht auf die Daten zugreifen.

## 2. DANACH: Das gesamte Ladenfluss-Design und Layout grundlegend erneuern
- Wenn die Cloud-Beta-Funktionen solide funktionieren, bekommt **ganz Ladenfluss** ein einheitliches, hochwertiges, modernes Design – nicht bloß eine einzelne Unterseite oder kosmetische Korrekturen.
- Umfasst Startseite, Navigation, Produktseiten, Kundenkonto/Login, Mein Laden/Cockpit, Cloud, Module und kostenlose Tools.
- Gemeinsames Designsystem mit Typografie, Farben, Abständen, Karten, Tabellen, Formularen, Zuständen, Icons und wiederverwendbaren Komponenten; verständliche, schnelle Bedienung für Händler.
- Responsiv auf Smartphone, Tablet und Desktop; gute Tastaturbedienbarkeit, Kontrast, Barrierefreiheit, Fehlermeldungen, Ladezustände und nachvollziehbare Nutzerführung.
- Vor Freigabe Screens und typische Abläufe auf allen Zielgeräten testen; keine Layoutbrüche oder unterschiedliche Bedienkonzepte je Unterbereich.
- **Erst wenn Cloud und neues Komplett-Layout bereit und überprüft sind**, die neue Ladenfluss-Version auf ladenfluss.de veröffentlichen und durchgehend klar als **Beta** kennzeichnen.
- Öffentliche Website bis zur Freigabe nicht durch unfertige Änderungen ersetzen; bestehende kostenlose Werkzeuge weiterhin zugänglich halten.

## 3. ERST ANSCHLIESSEND: Jedes Unterthema einzeln neu durchdenken
- Nach erfolgreicher Synchronisierung, funktionsfähiger Cloud-Beta und einheitlichem Gesamtdesign folgt die Produktentwicklung **Modul für Modul**.
- Jeweils erst reale Händlerprobleme, Nutzerabläufe und Verbesserungspotenzial ermitteln, dann gezielt neue Funktionen entwerfen, implementieren und testen.
- Nicht alle Module gleichzeitig oberflächlich überarbeiten; Qualität und durchdachte Verzahnung gehen vor einer langen Featureliste.
- Priorisierte Schwerpunkte: PEP, Urlaubsplaner und Personalfluss mit Mitarbeiterprofilen, Stellenanzeigen und Bewerbungen; Zahlenfluss und Warenfluss anschließend nach demselben Verfahren schrittweise verbessern.
- Jedes Modul verwendet den gemeinsamen Cloud-, Unternehmens- und Mitarbeiterkontext ohne doppelte Stammdateneingabe.

## 4. Nach dem Beta-Start: PEP deutlich verbessern
- **PEP** wird ein wichtiges Entwicklungsprojekt mit deutlich besserer Bedienbarkeit, Gestaltung und Funktionalität: Es soll im Ladenalltag wirklich überzeugend sein, nicht nur ein einfacher Planer.
- Bestehende Oberfläche und Funktionen zuerst kritisch auf Schwachstellen, unklare Abläufe und Reibung prüfen. Dann gezielte UX-Verbesserungen entwickeln und durch realistische Tests absichern.
- Vorschläge zur Detailplanung (noch nicht ausdrücklich beauftragt): bessere Wochen-/Monatsübersicht, schnelle Schichtbearbeitung, Visualisierung von Besetzungsbedarf, Abwesenheits- und Konflikthinweise, mobile Bedienung, transparente Freigabe von Plänen.
- Verbindung mit Personalfluss (Stammdaten) und Urlaubsplaner; keine dreifache Pflege von Mitarbeitern.

## 5. Urlaubsplaner neu denken
- Der bisherige Urlaubsplaner entspricht noch nicht den Erwartungen; **nicht** bloß kosmetisch überarbeiten.
- Bedienfluss, Darstellung, Übersichtlichkeit und praktische Nützlichkeit grundlegend verbessern. Kostenloses Kernangebot ausdrücklich berücksichtigen.
- Potenzielle Gestaltungsideen (vor Umsetzung noch zu priorisieren): klarer Teamkalender, individuelle Resturlaubskonten, Überschneidungswarnungen, einfacher Antrag-/Genehmigungsablauf, Verknüpfung mit PEP, mobile Benutzung.
- Urlaubsinformationen nur berechtigten Mitarbeitern/Vorgesetzten offenlegen und angemessene Datenschutzregeln vorsehen.

## 6. Eigenes Modul „Personalfluss“ (Arbeitstitel bestätigt als Wunschrichtung)
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

## Reihenfolge als verbindliche Priorität (aktualisiert am 10. Oktober 2026)
1. **Cloud-Fundament fertigstellen:** DNS/Resend → Supabase-SMTP → Live-Login → sicherer Sync, Rechte und Wiederherstellung auf verschiedenen Geräten.
2. **Beta-Funktionen zuverlässig umsetzen und testen:** Unternehmen, Cockpit, kostenlose Cloud-Anwendungen, Datenkonsistenz, Datenschutz und verständliche Beta-Grenzen.
3. **Vollständiges Ladenfluss-Redesign:** alle Bereiche auf ein gemeinsames Designsystem und eine einheitliche Navigation bringen; Desktop- und Mobiltests.
4. **Öffentliche Beta veröffentlichen:** erst nach nachgewiesener Cloud-Funktion und abgeschlossenem Gesamtlayout; sichtbar als Beta kennzeichnen.
5. **Ein Modul nach dem anderen weiterentwickeln:** zuerst PEP und Urlaubsplaner gründlich verbessern, anschließend Personalfluss mit Mitarbeiterprofilen/Stellenanzeigen/Bewerbungen; weitere Module sukzessive neu denken.

**Entscheidung zur Benennung:** „Personalfluss“ wird vorläufig als Name des HR-Bereichs verwendet, bis die finale Benennung gemeinsam feststeht.
