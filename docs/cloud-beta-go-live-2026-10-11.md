# Ladenfluss Cloud-Beta – Freigabeplan (11.10.2026)

## Geprüfter technischer Stand
- Hosted Supabase: Projekt `nzxtdrmdvqyvcbohplzt`, Region `eu-central-1`.
- Am 11.10.2026 wurden sechs Migrationen eingespielt: `cloud_beta_company_retail_type`, `cloud_beta_branch_opening_settings`, `cloud_beta_guard_document_revision`, `cloud_beta_create_document_if_absent`, `cloud_beta_save_document_if_revision`, `cloud_beta_create_company_onboarding`.
- SQL-Bereitschaft: 14 von 14 Prüfungen PASS (Spalten, RPCs, Revisionstrigger, RLS/Grants).
- Supabase Performance Advisor: keine Hinweise.
- Supabase Security Advisor: drei erwartete WARN zu bewusst für `authenticated` freigegebenen `SECURITY DEFINER`-RPCs (Onboarding / Dokument-Erstellen / versioniertes Speichern). **Kein allgemeines Sicherheitszertifikat.** Funktionen prüfen serverseitig bestätigte Nutzerkonten und Modul-/Unternehmensberechtigung. Der produktive Cross-Tenant-/Missbrauchstest bleibt Freigabepflicht.
- Lokal/CI: realer lokaler Supabase/GoTrue/Mailpit-Browser-E2E für Registrierung, Onboarding, Passwort-Reset und manuellen Ladenprofil-Sync erfolgreich (Commit `9f910c3d64059a2f8657c9476b50703d9de66ddb`, drei GitHub-Workflows grün).
- Projekt-SMTP: Betreiber bestätigt Einrichtung von Resend bei Supabase. Der tatsächliche Versand aus Supabase ist **noch nicht mittels Test-Registrierung nachgewiesen**.
- `assets/cloud-config.js`: weiterhin `enabled: false`; keine produktive Kundenfreigabe.

## Verbindliche manuelle Einstellungen in Supabase
1. Projekt öffnen: https://supabase.com/dashboard/project/nzxtdrmdvqyvcbohplzt
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://ladenfluss.de`
   - **Redirect URLs:** `https://ladenfluss.de/konto` und `https://ladenfluss.de/passwort-zuruecksetzen`.
   - Keine Wildcard-Weiterleitung zu fremden Domains für die Produktion.
3. **Authentication → Sign In / Providers → Email**: E-Mail-Anmeldung eingeschaltet, E-Mail-Bestätigung für neue Nutzer eingeschaltet.
4. **Authentication → SMTP Settings / Emails**: Custom SMTP aktiv, Resend-Host `smtp.resend.com`, Port `465`, Benutzer `resend`, als Passwort der geheime Resend-API-Key (nur im Supabase-Dashboard). Absender `info@ladenfluss.de`. Niemals API-Key ins Git-Repository oder an den Assistenten senden.
5. Registrierungs- und Reset-Mail müssen bei einem echten Testkonto eintreffen. Bestätigungs- und Reset-Link dürfen ausschließlich auf `ladenfluss.de` zeigen.

## Sicherheits- und Datenschutzfreigabe vor öffentlichem Launch
- Datenschutzentwurf `datenschutz.html` enthält jetzt Konten, Supabase, Resend, lokale Module/Personalfluss und die erste begrenzte Cloud-Beta.
- Vollständige ladungsfähige Geschäftsanschrift in **Impressum UND Datenschutz** ergänzen; das bestehende Impressum nennt derzeit nur „Deutschland“.
- DSGVO-/AV-Verträge, internationale Datenübermittlungen, Löschfristen und tatsächliche Aufbewahrung verifizieren; Datenschutztext rechtlich prüfen lassen.
- Kein automatischer Upload von Team, Stundenlöhnen, PEP, Urlaub, Warenfluss, Zahlenfluss oder MHD. **Nur explizit manuell synchronisiertes Ladenprofil** ist in der ersten Cloud-Beta vorgesehen.
- Zwei getrennte bestätigte Testkonten mit getrennten Unternehmen in der produktiven Umgebung anlegen. Zugriff A → B muss sowohl über normale Abfragen als auch alle RPCs verweigert werden; unbestätigte Konten dürfen weder Unternehmen noch Cloud-Dokumente schreiben.
- Mit echten Browsern die E-Mail-Bestätigung, Redirects, Anmeldung, Abmeldung, Passwort-Reset, Onboarding, Ladenprofil-Hoch-/Herunterladen, Konfliktbehandlung und Geräte-Trennung testen.
- Erst dann `assets/cloud-config.js` auf `enabled: true`, Supabase-Projekt-URL und **Publishable-Key** `sb_publishable_...` setzen (niemals `sb_secret_` oder `service_role`), die Release-Gate-Tests aktualisieren, grünes CI/Review bestätigen, Release-PR freigeben und Produktion prüfen.

## Rückrollplan
- `assets/cloud-config.js` bei Fehlern wieder auf `enabled: false` setzen und an Vercel ausliefern; Website-Tools bleiben lokal verfügbar.
- Vor kundenführender Cloud-Nutzung DB-Backup/Restore-Verfahren und Lösch-/Migrationsweg klären; nicht ungeprüft produktive Kundendaten löschen.
