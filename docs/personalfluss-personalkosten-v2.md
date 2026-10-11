# Personalfluss v2 · Kostenplanung und Wiederherstellung

Stand: 11.10.2026 · Entwicklungs-PR #16 (Cloud-Beta bleibt separat deaktiviert).

## Neu

Der lokale Stundenlohn-Tresor enthält zusätzlich – **mit derselben Passphrase verschlüsselt** – einen frei wählbaren Arbeitgeberkosten-Aufschlag (0 bis 100 %) und ein optionales Personalbudget (0 bis 10 Mio. € pro Monat). Aus den Mitarbeitenden mit bekannten Stundenlöhnen werden Brutto-Monats- und Wochenkostenschätzungen ermittelt. Wochenwerte basieren auf den tatsächlich hinterlegten PEP-Schichtzeiten. Das neue Interface zeigt die Summe der erfassten Stundenlöhne, den Arbeitgeberkosten-Aufschlag und das verfügbare Budget an.

Ein Monatsbudget wird **nur bewertet, wenn alle Mitarbeitenden einen Stundenlohn hinterlegt haben**. Fehlt ein Wert, sind die Beträge ausdrücklich Teilsummen; es wird weder „Budget eingehalten“ noch eine fiktive Restdifferenz angezeigt. Ungültige PEP-Zeiten werden nicht stillschweigend als gültige Arbeitszeit behandelt.

## Bruttokosten – Rechenmodell

- Monatliche Bruttokosten (Soll): Summe aus vertraglichen Wochenstunden × individuellem Brutto-Stundenlohn × 52 / 12.
- Geschätzte Arbeitgeberkosten (Monat): monatliche Bruttokosten × (1 + eingestellter Aufschlag / 100).
- Geplante PEP-Woche: Summe der gültigen geplanten Schichtstunden × jeweiliger Stundenlohn × (1 + Aufschlag / 100).
- Budgetunterschied: Monatsbudget minus geschätzte Arbeitgeberkosten – **nur bei vollständig hinterlegten Löhnen**.
- Es handelt sich um eine **vereinfachte Hochrechnung, keine Lohnabrechnung**. Fehlzeiten, Urlaubsentgelt, Zuschläge, Entgeltfortzahlung, 13. Gehalt, Arbeitgebernebenkosten je Beschäftigtentyp, Steuer-/SV-Recht und Tarifverträge sind nicht automatisch abgebildet. Der Prozentsatz stammt ausschließlich aus einer Eingabe des Nutzers. Geplante PEP-Zeiten sind kein Nachweis tatsächlich geleisteter Stunden.

## Datenhaltung und v1-Kompatibilität

`ladenfluss.hr-pay-vault.v1` bleibt der einzige Storage-Key. Der frühere Envelope `version:1` (verschlüsselte Abbildung `employeeId → rate`) wird beim Entsperren weiterhin gelesen und erst bei bewusstem Speichern auf den neuen Envelope `version:2` mit verschlüsselten `rates` und `planning` angehoben.

AES-GCM mit zufälligem Salt/IV und PBKDF2-SHA-256 (250.000 Iterationen) bleiben unverändert. Passphrasen und Klartextwerte werden weder als zusätzliche Keys noch in Team-, PEP-, Urlaubs-, Cloud- oder generischen Sicherungsdaten gespeichert.

Die Felder im **entsperrten Tresor** sind für Personen mit Zugriff auf den aktiven Browser sichtbar. Das ist kein Rollen-/Rechtemodell für Betriebe. Cloud-Beta und Bewerberdaten bleiben bewusst ausgeschlossen.

## Wiederherstellung aus einer verschlüsselten Sicherung

1. Im Mitarbeiterprofil den Wiederherstellungsbereich öffnen, verschlüsselte JSON-Sicherung und **Passphrase der Sicherung** eingeben.
2. Die Anwendung entschlüsselt die Datei nur zur Integritäts- und Formatprüfung; zeigt ausschließlich Anzahl gespeicherter Stundenlöhne und ob Budgeteinstellungen enthalten sind.
3. Existiert ein aktueller Tresor, muss er zunächst mit seiner eigenen Passphrase entsperrt sein; die Anwendung weist ausdrücklich auf ein vorheriges separates verschlüsseltes Backup hin.
4. Erst nach ausdrücklicher Checkbox und zusätzlichem Bestätigungsdialog wird die bestehende verschlüsselte Datei als **vollständiger Ersatz** gespeichert. Keine Verschmelzung, keine unaufgeforderte Änderung oder unverschlüsselte Speicherung.
5. Bei fehlerhafter Datei, falscher Passphrase, Storagefehler oder einem anderen Tab mit neueren Daten bleibt der bisherige Tresor erhalten. Nach erfolgreichem Import bleibt der Tresor gesperrt und muss mit der **Passphrase der importierten Datei** erneut entsperrt werden.

**Wichtige Grenze:** Die Passphrase kann weder wiederhergestellt noch zurückgesetzt werden. Die zusätzliche Sperre auf gemeinsam genutzten Geräten ersetzt keine serverseitigen Berechtigungen. Die Anwendung kann nicht technisch beweisen, dass eine separate Exportdatei vor dem Überschreiben tatsächlich außerhalb des Browsers gesichert wurde.

## Tests / Rollout

- Node-Tests prüfen legacy v1, v2, Ent-/Verschlüsselung, Importvorschau, falsche Passwörter, Parallel-Tab-Konflikte, fehlende Beträge und Budgetlogik.
- Playwright prüft echte Eingabe-/Entsperr-/Backup-/Import-Abläufe, Budgetwarnungen und responsive Darstellung (320, 390, 768, 1440 px).
- Vor produktivem Merge muss GitHub CI grün und Vercel-Vorschau bereit sein.
