# Ladenfluss Cloud-Beta: Auth-Mailversand mit Resend

**Stand 10.10.2026 – noch nicht in Supabase Auth produktiv aktiviert.**

## Verifizierter Ist-Stand

- Die Resend-Domain `ladenfluss.de` ist **verified**, Senden ist aktiviert, Region: `eu-west-1`.
- Die Existenz einer verifizierten Domain sagt **nichts** darüber aus, ob Supabase Auth bereits eine SMTP-Verbindung besitzt.
- Die Tests unter `.github/workflows/local-supabase-auth.yml` nutzen ausschließlich **lokales Mailpit**, senden **keine** echten E-Mails.

## Geplanter Auth-Absender

- Absendername: **Ladenfluss**
- Vorgeschlagener Absender: **info@ladenfluss.de** (bereits vorhandene geschäftliche Adresse)
- HTML-Vorlagen (in GitHub):
  - `email/templates/confirm-signup.html`
  - `email/templates/reset-password.html`
- Empfohlene Betreffzeilen:
  - „Bitte bestätige deine E-Mail-Adresse bei Ladenfluss“
  - „Setze dein Ladenfluss-Passwort zurück“

## Supabase SMTP – bei der Veröffentlichung manuell/geführt prüfen

Supabase unterstützt die direkte Resend-Integration sowie die manuelle SMTP-Konfiguration. Keine Zugangsdaten im Browser oder GitHub speichern.

| Einstellung | Wert |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (verschlüsselt) |
| Benutzername | `resend` |
| Passwort | Ein **geheimer Resend API-Key**, ausschließlich in der serverseitigen Supabase-SMTP-Konfiguration |
| Absendername | `Ladenfluss` |
| Absenderadresse | `info@ladenfluss.de` |

Alternativ zuerst die offizielle **Resend-Integration innerhalb Supabase** prüfen; sie kann die SMTP-Einstellungen automatisiert einrichten.

**Nicht tun:** API-Key in `assets/cloud-config.js`, `Vercel NEXT_PUBLIC_*`, GitHub-Dateien oder Logausgaben schreiben.

## Auth- und Redirect-Einstellungen

1. Registrierung per E-Mail erlauben, E-Mail-Bestätigung **verpflichtend** aktivieren (nicht `autoconfirm`).
2. **Site URL**: `https://ladenfluss.de`
3. **Redirect-Allowlist** explizit für:
   - `https://ladenfluss.de/konto`
   - `https://ladenfluss.de/passwort-zuruecksetzen`
4. HTML der beiden Supabase-E-Mail-Vorlagen aus den Dateien übernehmen. Die Platzhalter `{{ .ConfirmationURL }}` müssen erhalten bleiben.
5. Prüfen, dass das neue Passwort nur nach einem tatsächlichen `PASSWORD_RECOVERY`-Ereignis gesetzt wird und kein normaler eingeloggter Browser Zugang zur Reset-Maske erhält.
6. Spam-/Phishing-Resistenz, Rate-Limits und Zustellungs-/Bounce-Monitoring kontrollieren.

## Freigabe-Abnahmetest (noch offen)

- Testregistrierung mit echter, selbst kontrollierter E-Mail-Adresse.
- Bestätigungsmail kommt an; Links zeigen auf `ladenfluss.de` und werden korrekt verarbeitet.
- Unbestätigter Account kann sich nicht anmelden.
- Nach E-Mail-Bestätigung funktioniert Login und Logout.
- Reset-Mail kommt an, das Passwort lässt sich ändern, altes Passwort funktioniert nicht mehr.
- Zweiter Testbenutzer kann ausschließlich die Daten seines Unternehmens sehen.
- Alle drei geprüften SQL-RPCs bestehen E2E in einer separaten Auth-/RLS-Testumgebung.
- Ein fehlgeschlagener Cloud-Schreibvorgang verwirft keine lokalen Profil-Drafts.

Erst danach `assets/cloud-config.js` auf `enabled:true` ändern.

## Quellen

- Supabase: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase/Resend-Integration: https://supabase.com/partners/catalog/resend
- Resend SMTP: https://resend.com/changelog/smtp-service
