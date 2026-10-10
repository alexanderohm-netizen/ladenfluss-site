# Ladenfluss Cloud-Beta – Konto & Onboarding (Entwicklungsstand)

**Status: nur Entwicklungszweig, noch nicht öffentlich freigegeben.**

## Implementierte Komponenten

- `assets/cloud-config.js`: expliziter Beta-Schalter (standardmäßig `enabled:false`); enthält absichtlich weder API-Key noch Projekt-URL.
- `assets/supabase-browser.js`: Supabase-JavaScript-SDK lazy via fest gepinnter Version `@supabase/supabase-js@2.117.2` von esm.sh, **nur** wenn freigeschaltet. Es werden ausschließlich `sb_publishable_`-Keys akzeptiert. HTTPS-Pflicht.
- `assets/auth-core.js`: signUp, signInWithPassword, serverseitig validierter Benutzer über getUser, E-Mail-Bestätigung, Reset per E-Mail, Passwortänderung, Logout und erste Firma laden.
- `konto.html`/`assets/account.js`: Registrierung, Login, Passwort vergessen, eingeloggter Zustand und Logout. Passwörter werden nicht in eigenen LocalStorage-Werten gehalten.
- `passwort-zuruecksetzen.html`/`assets/password-reset.js`: neue Passwortvergabe mit mindestens zwölf Zeichen; Sitzung nach erfolgreichem Reset abmelden.
- `onboarding.html`/`assets/onboarding.js`: verifizierte Konten legen Unternehmen und erste Filiale über **eine** Datenbank-RPC an; bei deaktivierter Beta keine Writes.
- `mein-laden.html`/`assets/cloud-profile.js`: **manueller Ladenprofil-Abgleich** im Reiter Datensicherung. Bestehende Daten werden erst nach bewusster Bestätigung hochgeladen oder lokal übernommen. Bei Cloud-Import wird eine Sicherung des vorherigen Profils im Browser erstellt, die über die Oberfläche zurückgespielt werden kann. Vor Import wird die Revision erneut gelesen.
- Cloud-Entwürfe liegen seit der Sicherheitsüberarbeitung ausschließlich unter `ladenfluss.cloud-draft.v2.<userId>.<companyId>.<moduleKey>`. Backup-Schlüssel enthalten ebenfalls Benutzer und Unternehmen; ein Benutzerwechsel sperrt die alte Cloud-Session-Oberfläche. Ein ungesendeter Entwurf wird nie automatisch von neuem lokalem Profilinhalt ersetzt. Der Händler kann den Entwurf bewusst lokal wiederherstellen und separat hochladen.
- `konto.html`/`assets/local-privacy.js`: optionaler separater Befehl **Abmelden und lokale Ladenfluss-Daten löschen**. Nach ausdrücklicher Bestätigung werden alle lokalen Schlüssel mit `ladenfluss.`-Präfix gelöscht; fremde lokale Schlüssel bleiben unberührt. Normales Abmelden bewahrt lokale Daten.
- `supabase/drafts/create_company_onboarding.sql`: SQL-Entwurf für atomare Einrichtung unter Nutzung des bereits vorhandenen Triggers `private.new_company`. Maximal ein Unternehmen pro Gründer während der Beta. Keine direkten INSERT-/UPDATE-Rechte auf den Tabellen erforderlich.

## Vor Aktivierung zwingend

1. In **Supabase Auth** E-Mail-/Passwort-Login und verpflichtende E-Mail-Bestätigung aktivieren bzw. bestätigen.
2. Supabase **Site URL** auf die gewünschte HTTPS-Domain setzen und als Redirect-URLs explizit zulassen:
   - `https://ladenfluss.de/konto`
   - `https://ladenfluss.de/passwort-zuruecksetzen`
   - Optional eine **genau definierte** Staging-Domain mit den beiden Pfaden (keine pauschale Wildcard).
3. Verifizierten E-Mail-Versand via eigenes SMTP (Resend oder gleichwertig), Absenderdomain und Zustelltests einrichten. Auth-Rate-Limits/CAPTCHA prüfen. Ohne funktionierende Bestätigungsmails kein Beta-Release.
4. Die neuen SQL-Entwürfe in einer **isolierten Supabase-Testumgebung** mit tatsächlichen Supabase-Auth-Benutzern prüfen. Die aktuellen PostgreSQL-CI-Tests verwenden simulierte `auth.uid()`/Verifikationshilfen und ersetzen diesen E2E-Test **nicht**.
5. Bestehenden `private.new_company`-Trigger und `private.is_verified_account`-Logik abgleichen. Prüfen, ob `public` in der Data API exponiert und die exakt vorgesehenen RPCs für `authenticated` freigegeben sind. SECURITY-DEFINER-Owner, eingeschränkten `search_path` und Ausführungsrechte explizit prüfen.
6. Im Staging gegen echte Konten testen: Registrierung, Bestätigung, Login, Reset, Logout, zwei getrennte Unternehmen, unbestätigte Konten, Mitarbeiterrolle, doppelte Einrichtung, Netzwerkausfall.
7. Nach erfolgreichem Review und Sicherheitsfreigabe `assets/cloud-config.js` gezielt mit `enabled:true`, Projekt-HTTPS-URL und **ausschließlich** Publishable Key konfigurieren. Keine Service-Role- oder Secret-Keys in öffentlich ausgelieferten Assets.
8. Getrennte Rollout-/Rollbackplanung und Datenschutz-/Nutzungsbedingungen prüfen; Beta sichtbar als Beta kennzeichnen, erst wenn die Daten tatsächlich zuverlässig über die Cloud gespeichert werden.

## Designgrenzen und nächste Schritte

- Im Entwicklungszweig ist der **erste, manuell ausgelöste Cloud-Abgleich für Ladenprofil und Richtwerte** integriert, aber deaktiviert. PEP/Urlaubsplaner/Warenfluss/Zahlenfluss speichern weiterhin **lokal**. Ohne erfolgreiche Auth-/RPC-Konfiguration erfolgt keine geräteübergreifende Synchronisierung.
- Der Passwort-Reset benötigt freigegebene Redirects und funktionierende E-Mail-Verifizierung.
- Browserdaten aus den frei nutzbaren Werkzeugen (`ladenfluss.store.v1`, PEP, Team, Urlaub) sind **weiterhin geräteweit im Origin** gespeichert und nicht automatisch nach Benutzer getrennt. Nutzer auf gemeinsam genutzten Geräten können solche Daten sehen, solange sie nicht explizit gelöscht wurden. Deshalb gibt es einen gesonderten, bestätigungspflichtigen vollständigen Löschweg. Vor Speicherung echter Personal-/HR-Daten in der Cloud ist eine durchgängige Mandantentrennung aller lokalen Fachmodule erforderlich.
- Alte `ladenfluss.cloud-draft.v1.*`-Schlüssel werden bewusst **nicht automatisch in fremde neue Konten übernommen**. Sie bleiben lesbar im Browserspeicher, bis sie ausdrücklich exportiert oder über die bestätigte lokale Gerätedatenlöschung entfernt werden.
- Die erste Filiale wird atomar angelegt. Weitere Filialen, Einladungen, Mitarbeitendenprofile und Paywalls folgen nach Beta-Grundlage.
- Eine Staging-/Testumgebung kann zusätzliche Kosten verursachen; keine kostenpflichtige Ressource wurde ohne Zustimmung erstellt.

## Nachweise

- `.github/workflows/web-vacation-check.yml` startet JavaScript-/JSDOM-/Browserprüfungen.
- `.github/workflows/cloud-sql-test.yml` prüft die SQL-Entwürfe in einem kurzlebigen PostgreSQL-Testcontainer.
- `tests/auth-core.test.cjs` prüft Auth-Verhalten ohne echte Konten oder E-Mails.
- `tests/cloud-profile-ui.test.cjs` prüft manuelle Profil-Uploads, ausdrückliche Importbestätigung, Wiederherstellung und Schutz vor veralteten Cloud-Versionen.
- `tests/cloud-onboarding-assertions.sql` prüft Firmen- und Filialanlage mit simulierten Auth-Kontexten.

**Aktivierungsentscheidung:** Bis alle Release-Gates erfüllt sind, bleiben echte Registrierungen im Frontend gesperrt und die produktive Supabase-Datenbank unverändert.
