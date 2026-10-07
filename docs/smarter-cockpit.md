# Cockpit und Planungslogik – lokaler Entwicklungsstand

Stand: 7. Oktober 2026. Ergänzung zur Stabilisierung v1.5.1, noch nicht
hochgeladen oder veröffentlicht. Kein neuer produktiver Versionsstand.

## Umgesetzt

- Überarbeitetes Mein-Laden-Cockpit mit priorisierter Aufgabe, filterbaren
  Hinweisen, nachvollziehbarer Herleitung und direkten Links zur Bearbeitung.
- Gemeinsame Besetzungsanalyse für Cockpit und Dienstplan. Auswertung an
  tatsächlichen Schichtgrenzen statt grober Zeitraster; fehlende Personalminuten
  berücksichtigen Dauer und Anzahl fehlender Personen.
- Bestätigte Urlaube und manuelle Abwesenheiten reduzieren die Verfügbarkeit.
  Geschlossene Tage und Bundeslandfeiertage erzeugen keine Besetzungslücken.
- Pausendauern werden ausdrücklich als noch nicht zeitlich zugeordnet markiert.
  Es wird keine vollständige Pausenabdeckung behauptet.
- Unternehmensprofil mit validierten Öffnungszeiten, Mindestbesetzung,
  Bundesland und Richtwerten als gemeinsame Grundlage. Ungültige gespeicherte
  Profile werden nicht automatisch ersetzt. Richtwerte sind klar von Istzahlen
  getrennt; Beispieldaten sind gekennzeichnet.
- Berechnungshinweise basieren nur auf der neuesten Kalkulation je Werkzeug,
  sofern höchstens sieben Tage alt. Quelle und Grenzen manueller Daten sind
  sichtbar. Kein automatischer Bestands- oder Umsatzanschluss wird suggeriert.
- Sicherungsdownload der acht bekannten lokalen Datenbereiche als JSON.
  Originalwerte bleiben auch bei beschädigtem JSON erhalten; fremde Schlüssel
  werden ausgeschlossen. Eine Wiederherstellungsoberfläche ist noch offen.
- Acht Rechner lehnen leere und nicht endliche Eingaben ab. Bei ungültiger
  Eingabe werden vorherige Ergebnisse, Kopieraktion und Einordnung verborgen.
  Nullverbrauch führt nicht mehr zu einer erfundenen Lagerreichweite.
- PEP-Dialoge brechen ohne Speichern ab; Zielwochen aus Hinweisen lassen sich
  direkt öffnen. Vor dem Überschreiben einer vorhandenen Schicht wird gefragt.

## Verifikation

`npm test`: **44 Tests bestanden**, 0 Fehler. Enthalten sind reine Logiktests
und DOM-Abläufe mit jsdom, einschließlich Initialisierung aller 27 HTML-Seiten,
Profil → PEP → Rechner, Abwesenheitskonflikten, Hinweispriorisierung,
Datenvalidierung, Sicherungsinhalt und Rechnerkorrekturen.

Diese Tests ersetzen keine visuelle Browserprüfung. Chromium konnte in dieser
Umgebung wegen der Socket-Beschränkung nicht starten. Die vorbereitete
Browser-Suite enthält zusätzlich eine Prüfung der tatsächlich ausgeblendeten
Rechneraktionen; sie wurde hier nicht ausgeführt. Downloadablage und Layout
auf echten Geräten müssen ebenfalls noch geprüft werden.

Flutter ist hier nicht installiert; native Tests und Builds sind weiterhin
unbestätigt. Die zuvor vorbereitete Desktop-Pipeline wurde nicht ausgeführt.

## Noch offen

Echte Konten, Cloudspeicherung, Rollen und buchbare Module sind nicht Teil
dieses Entwicklungsstands. Ebenso fehlen ein Backup-Import und genaue
Pausenzeiten. Der ältere Team-/PEP-Speicher benötigt noch durchgängige
Schema-Prüfung und transaktionale Fehlerbehandlung; die strengere Validierung
von Urlaub und Ladenprofil deckt diese Speicherbereiche nicht vollständig ab.

Vor Veröffentlichung: Browser-Suite und Desktop-Pipeline ausführen, mobile
Ansichten prüfen und den tatsächlichen Download kontrollieren. GitHub-Upload
wurde zuvor von der automatischen Freigabeprüfung mangels ausdrücklicher
Upload-Freigabe abgelehnt; es erfolgte kein erneuter Uploadversuch.
