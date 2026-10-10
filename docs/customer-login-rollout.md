# Ladenfluss – echtes Händlerkonto: Inbetriebnahme

Stand: 10. Oktober 2026 · Nur Entwicklungszweig `feature/cloud-foundation`.

## Bereits programmiert
- E-Mail- und Passwort-Registrierung über das echte Supabase Auth SDK.
- E-Mail-Bestätigung per PKCE-Link **oder** sechsstelligem Code (auch auf einem anderen Gerät).
- Bestätigungscode erneut senden über `auth.resend({type:'signup'})`.
- Passwort-Login, lokale Abmeldung und Wiederherstellung per bestätigtem Einmal-Link.
- Anzeigen von Unternehmen und gebuchten Modulen nach erfolgreicher Anmeldung.
- Firmen erstellen/umbenennen und rollenbasierte Dokument-Speicherung.
- Zusätzliche Supabase-RLS-Migration `verified_customer_policy`: Unbestätigte E-Mail-Adressen dürfen kein Unternehmen erstellen und keine Unternehmensdaten einsehen. Nicht bestätigte Sessions öffnen keinen Kundenbereich.
- UI löscht benutzte OTPs und eingegebene Passwörter nach Form-Submission. In der App sind keinerlei Admin- oder Service-Role-Keys enthalten.

## Noch im Supabase Dashboard erforderlich
Der verbundene Supabase-Connector kann die Auth-Einstellungen **nicht** verändern. Diese Einstellungen müssen vom Projekteigentümer im Dashboard vorgenommen werden.

1. Öffne https://supabase.com/dashboard/project/nzxtdrmdvqyvcbohplzt/auth/url-configuration
   - Produktions-Site-URL später: `https://www.ladenfluss.de/konto`.
   - Nur **exakte** Redirect-URLs für Konto und Recovery zulassen:
     `https://www.ladenfluss.de/konto` und
     `https://www.ladenfluss.de/konto?recovery=1`.
   - Für einen Vorschautest zusätzlich die **konkret verwendete** Vercel-Vorschau für dieselben beiden Routen zulassen. Keine `*.vercel.app`-Wildcards. Die Vorschau kann Vercel-SSO verlangen.
   - Die produktive Domain verweist aktuell noch nicht auf den neuen Login: vor Liveversand unbedingt kontrollieren, dass das Ziel den getesteten Stand liefert.
2. Unter Auth → Providers → Email sicherstellen: E-Mail-Anmeldung aktiviert; E-Mail-Bestätigung **erforderlich**. Minimum Passwortlänge serverseitig mindestens 12 Zeichen.
3. Auth → SMTP: für öffentliche Registrierung einen funktionsfähigen transaktionalen Mailversand einrichten, Domain verifizieren (SPF/DKIM, DMARC prüfen), Absender `Ladenfluss` festlegen. Das eingebaute Supabase-Mail-System eignet sich **nicht** für Kunden außerhalb des Projektteams. Bestehende Microsoft-365-Postfach- und MX-Einträge von `info@ladenfluss.de` nicht verändern. SMTP-API-Schlüssel **niemals** in GitHub oder diesen Chat kopieren.
4. Auth → Email Templates:
   - Confirm signup: Inhalt aus `supabase/templates/confirmation.html`, Betreff `Bestätige deine E-Mail-Adresse · Ladenfluss`.
   - Reset Password: Inhalt aus `supabase/templates/recovery.html`, Betreff `Dein neues Passwort · Ladenfluss`.
   - `{{ .ConfirmationURL }}` und `{{ .Token }}` in der Signup-Vorlage unverändert lassen.
   - Im Mailanbieter ggf. Link-Tracking deaktivieren, weil es PKCE-Links verändern kann.
5. Testen: mit eigenem Testkonto anmelden, eine E-Mail empfangen, Code bestätigen, Firma erstellen, Gerät B anmelden, Cloud-Sicherung speichern/übernehmen, Passwort ändern und abmelden. Fehler, Rate Limits und fremde Unternehmensdaten mitprüfen.

## Release-Grenzen
- Bei der CI werden die echte Supabase-SDK-Bibliothek und UI genutzt, aber Netzwerkantworten simuliert. Die Datenbank-RLS wurde in Transaktionen mit Rollback getestet. Beides ersetzt **keine** echte SMTP-Zustellung / produktive Registrierung mit einem Postfach.
- Der Preview-Branch darf bis zum Abschluss der End-to-End-Prüfung nicht auf `main` gemerged oder öffentlich freigegeben werden.
- Kunden-Datenschutz, Löschfristen und Account-Löschung sind noch nicht vollständig umgesetzt. Stripe-Preise, PEP-Zahlungen und Abo-Freischaltungen bleiben separat.
