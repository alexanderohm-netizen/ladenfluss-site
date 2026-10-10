# Urlaubsplan: kostenlose manuelle Cloud-Sicherung

Stand: 10. Oktober 2026. Route `/urlaub-cloud`, verlinkt im Konto und Urlaubsplaner.

## Verhalten

- Anmeldung mit bestätigter E-Mail; Unternehmen auswählbar, nur aktive Owner/Admin/Manager. Die Datenbank erzwingt Berechtigungen zusätzlich über bestehende RLS.
- Lokaler und Cloud-Stand werden verglichen. Keine automatische Übertragung, kein Merge, kein Realtime. Explizite Zustimmung vor Upload oder lokalem Ersetzen.
- `cloud_documents`, Modul `vacation`, über vorhandene `save_cloud_document`-RPC. Keine neue Migration oder Stripe-Abhängigkeit.
- Upload verwendet die gelesene Revision (0 für erstmalige Erstellung). Konflikte oder unklare Netzwerkfehler machen die Vorschau ungültig; erst neu lesen, nie blind erneut speichern.
- Konto-/Sitzungswechsel verwerfen Vorschau und verspätete Antworten. Erneute serverseitige Benutzerprüfung vor Übertragung. PostgREST-Anfragen laufen nach 15 Sekunden ab.
- Downloads beider Stände als JSON; vor Übernahme kann der bisherige lokale Stand gesichert werden.
- Lokale Übernahme prüft Änderungen seit Vorschau und gleiche IDs mit abweichenden Namen im lokalen Team. Sie ersetzt ausschließlich Urlaub, durch den bestehenden Team-Storage-Adapter auch innerhalb des kanonischen Teampakets.
- Maximal 2.000 Personen / 10.000 Einträge / 500 KB; erlaubte Felder werden normalisiert. Keine Demo-Dateninitialisierung. Keine geheimen Schlüssel im Browser.
- Alle anderen Planer-Tabs vor Übernahme schließen. localStorage bietet keine geräte- oder tabübergreifenden Transaktionen. Lokaler Stand bleibt nach Abmeldung erhalten; keine automatische Kontentrennung für lokale Daten. Unternehmen und Richtung deshalb ausdrücklich prüfen.

## Verifikation / Grenzen

124 Funktionstests erfolgreich, davon 11 neue Tests: CAS-Konflikt, Erstsicherung, zweites Gerät, lokale Änderung, Logout während Anfrage, stiller Kontowechsel, Mitarbeiterrolle, ID-Konflikt, Team-Envelope, Speicherfehler, beschädigte Cloud-Daten.

Ein zusätzlicher Browser-Test mit echtem Supabase-SDK und CSP prüft Handy-/Desktoplayout, Erstupload, Revisionskonflikt und ein zweites Browserprofil. Screenshots bei 390/1440 px geprüft.

Die Tests ersetzen den Cloud-Dienst durch kontrollierte Antworten; sie beweisen keinen abgeschlossenen realen E-Mail-/Login-/Zweitgerätetest. Vor Freigabe: echte Registrierung/Bestätigung, Save auf Gerät A, Load auf Gerät B, paralleler Konflikt und Firmenisolation prüfen; Datenschutz-/Aufbewahrungs-/Löschprozess vervollständigen.

Am 10. Oktober erneut geprüft: Supabase-Migrationsliste enthält nur `20261008061158 cloud_foundation`. Der abgebrochene Billing-Migrationsversuch hat laut Migrationsliste keine neue Migration registriert. Billing bleibt gesonderte Release-Voraussetzung.

## Erweiterung: Sicherungsverlauf und Schutz vor veralteten Ständen (10. Oktober 2026)

- Der Urlaubsplan nutzt jetzt die bereits vorhandene, RLS-geschützte Tabelle `cloud_document_history`. Bei neuen Uploads bewahrt der Server automatisch bis zu fünf frühere Revisionen auf. Der Client lädt diese Revisionen nur für die autorisierte Firma und das Modul `vacation`.
- Frühere Revisionen können einzeln heruntergeladen oder **erst nach aktiver Zustimmung ausschließlich auf dieses Gerät** übernommen werden. Die Cloud wird beim lokalen Restore nicht zurückgesetzt.
- Vor **jeder** lokalen Wiederherstellung, auch von einer älteren Revision, liest der Browser die aktuelle Remote-Revision erneut. Bei Abweichung wird die Operation gestoppt und die Vorschau muss neu geladen werden.
- Der Cloud-Upload gilt nur bei einer eindeutig bestätigten Server-Antwort mit der exakt erwarteten Folge-Revision als bestätigt. Bei unklaren Antworten niemals unbesehen erneut speichern.
- Auch bei einer fehlgeschlagenen Kontrollabfrage nach einer bestätigten Speicherung wird dieser Unterschied ausdrücklich angezeigt.
- Zusätzliche Funktionstests prüfen historischen Restore, keine Remote-Schreiboperation, Revisionskonflikte und ungültige Bestätigungen. Der Browser-Test prüft den historischen Restore mit dem ausgelieferten Supabase-JavaScript-SDK und simulierten Serverantworten.
- **Weiterhin bewusst keine automatische Synchronisierung:** Bis eine konfliktfeste gemeinsame Mitarbeiter-/Urlaubsdatenbasis besteht, bleiben die Übertragungen manuell. Nutzer müssen ausdrücklich wählen, welcher Stand übernommen wird.

## Mailversand-Status
Die Domain `ladenfluss.de` wurde im verbundenen Resend-Konto bestätigt: DKIM, SPF-TXT, send-MX und rsend-CNAME sind **verified**. Die Einbindung als SMTP in Supabase Auth und der echte Registrierungs-/Zweitgeräte-Livetest bleiben gesonderte Freigabebedingungen. Der SMTP-Schlüssel gehört ausschließlich ins geschützte Supabase-Dashboard, niemals in die Quelltexte.
