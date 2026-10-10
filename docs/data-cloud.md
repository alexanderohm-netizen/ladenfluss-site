# Modul-Cloud: Zahlenfluss und Warenfluss (Entwicklungszweig)

Stand: 10.10.2026. Route `/daten-cloud`, aus dem Kundenkonto verlinkt.
Keine Produktionsfreigabe, keine automatische Synchronisation und keine Desktop-WWS-Anbindung.

## Umgesetzt
- Ein gemeinsamer manueller Sicherungsbildschirm für das kostenlose Ladenprofil sowie Zahlenfluss und Warenfluss bei aktivem Modulzugang.
- Bestätigtes Supabase-Konto, Firmenzuordnung und erlaubte Rollen (owner/admin/manager).
- Prüft bei kostenpflichtigen Modulen den Zugang (active/trial, gültiges Ablaufdatum) vor jeder Cloud-Datenabfrage. Das Ladenprofil ist als kostenloser Cloud-Bereich ausgenommen. Das bestehende Postgres-RLS erzwingt die Berechtigung unabhängig vom Frontend.
- Bestehender `cloud_documents`-Speicher und `save_cloud_document` RPC mit Revisionsprüfung. Keine Schemaänderung, keine Zahlungsfreigabe.
- Vorschau des lokalen und des Cloud-Datenstands; Upload oder lokale Übernahme nur nach ausdrücklicher Zustimmung.
- Download vor der Übernahme möglich. Kein Merge, kein Hintergrund-Sync, kein automatisches Überschreiben.
- Erneuter Vergleich der Cloud-Revision vor lokalem Ersetzen, lokale Rohdatenprüfung vor beiden Schreibwegen. Eine unklare Antwort oder ein Konflikt sperrt die Vorschau bis zum Neuladen.
- Schutz vor verspäteten Auth-/Netzwerkantworten durch Generationsprüfung und Benutzerabgleich.
- Erlaubte Felder normalisiert mittels vorhandener Modulvalidatoren aus `restore-core.js`, maximal 500 KB pro Snapshot.

## Verifikation
- JavaScript-Syntaxprüfung für alle neuen Skripte erfolgreich.
- Sechs ausgeführte Kernprüfungen: Modulbereinigung für Zahlenfluss/Warenfluss, Erstübernahme, Sperre nach lokaler Änderung, Datenlimit und unbekanntes Modul.
- Weitere Browser-/DOM-Regressionstests sind in `tests/data-cloud.test.cjs` hinterlegt. Diese Tests wurden in dieser Änderung **noch nicht mit npm test / Browser ausgeführt**.
- Live-E-Mail-/Login-, Zweitgeräte-, Firmenisolations- und Stripe-Entitlement-Test steht aus.

## Blocker vor öffentlicher Freigabe
1. Bestehende Auth-Freigabekriterien aus `docs/cloud-foundation.md`: Redirect-URLs, SMTP, Passwortregeln und Datenschutz.
2. Tatsächliche berechtigte Testfirma mit gültigem Modulzugang; derzeit werden keine kostenpflichtigen Module an Kunden freigeschaltet.
3. Vollständige Browser-Tests, echte Sitzungen, Kontowechsel und konkurrierende Änderungen auf zwei Geräten verifizieren.
4. Aktuellen Produktumfang, Datenlimits, Datenexport/Löschung und Backup/Restore dokumentieren.
5. Erst nach Cloud-Stabilisierung das gemeinsame Warenwirtschaftsdatenmodell, danach das Systemlayout angehen.

Die lokalen Zahlenfluss- und Warenfluss-Werkzeuge bleiben ohne Konto nutzbar. Eine aktive Bezahlung oder Lizenz wird durch diese Änderung nicht erzeugt.

## Ergänzende Verifikation (10. Oktober)
- SQL mit authentifizierter Testsession und ROLLBACK: Erstellung von Unternehmen inklusive Inhaberrolle und Hauptfiliale erfolgreich.
- Zweite Testsession unter ROLLBACK: kein lesbares Cloud-Dokument aus fremder Firma (RLS-Firmenisolation).
- Nachweis nach ROLLBACK: keine dauerhaften Testkunden, Firmen oder Dokumente.
- Kostenloses Ladenprofil über eigene strikte Feldauswahl und bestehende Profilvalidierung ergänzt. Dazu zwei Regressionstests in der Suite.
- GitHub Actions CI für Unit-Tests und Browser-Tests unter `.github/workflows/cloud-regression.yml` eingerichtet; vollständiges Testergebnis zum Zeitpunkt dieser Dokumentation noch nicht bestätigt.

## Versionsverlauf für Cloud-Sicherungen (10. Oktober 2026)
- Supabase-Migration `cloud_document_history` erfolgreich angewandt; SQL-Quelle: `supabase/cloud-document-history.sql`.
- Jede bestätigte Aktualisierung eines Cloud-Dokuments archiviert die vorherige Revision. Maximal fünf ältere Revisionen je Unternehmen und Modul bleiben gespeichert.
- Die Tabelle `cloud_document_history` erlaubt Browsern ausschließlich `SELECT`, geschützt durch dieselbe Modul-/Rollen-RLS wie das aktuelle Cloud-Dokument. Historie kann nicht direkt vom Browser verändert werden.
- `/daten-cloud` zeigt ältere Versionen und erlaubt einen JSON-Download oder die **ausdrücklich bestätigte lokale Übernahme**. Das Wiederherstellen älterer Versionen schreibt nicht automatisch in die Cloud. Die aktuelle Cloud-Revision wird zuvor erneut geprüft.
- Transaktionaler Remote-Test: Acht Versionen geschrieben, fünf ältere Revisionen (3–7) archiviert; ein fremdes Händlerkonto sah keine Historie. Der gesamte Test wurde zurückgerollt. Security Advisor meldete anschließend keine Befunde.
- Zusätzlicher Playwright-Test prüft historischen lokalen Restore, Cloud-Unverändertheit, Revisionskonflikt und Zweitgerät mit der tatsächlichen lokal ausgelieferten Supabase-Clientbibliothek (HTTP-Antworten simuliert).
- Ein erfolgreicher Test ersetzt keine echte SMTP-/PKCE-Kundenvalidierung; die öffentliche Version bleibt daher unangetastet.
