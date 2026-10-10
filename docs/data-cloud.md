# Modul-Cloud: Zahlenfluss und Warenfluss (Entwicklungszweig)

Stand: 10.10.2026. Route `/daten-cloud`, aus dem Kundenkonto verlinkt.
Keine Produktionsfreigabe, keine automatische Synchronisation und keine Desktop-WWS-Anbindung.

## Umgesetzt
- Ein gemeinsamer manueller Sicherungsbildschirm für Zahlenfluss und Warenfluss.
- Bestätigtes Supabase-Konto, Firmenzuordnung und erlaubte Rollen (owner/admin/manager).
- Prüft das gebuchte Modul (active/trial, gültiges Ablaufdatum) vor jeder Cloud-Datenabfrage. Das bestehende Postgres-RLS erzwingt die Berechtigung unabhängig vom Frontend.
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
