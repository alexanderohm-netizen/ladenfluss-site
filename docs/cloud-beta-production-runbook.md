# Ladenfluss Cloud-Beta – Freigabe und kontrollierter Rollout

**Stand: 10.10.2026. Noch keine Freigabe zur Änderung der produktiven Supabase-Datenbank.**

## Status der bisherigen Prüfungen

- **GitHub:** JavaScript-/Browser-Tests und isolierte PostgreSQL-Tests erfolgreich.
- **Lokale echte Supabase-Instanz:** E-Mail-Registrierung und -Bestätigung, Passwort-Reset, zwei Auth-Konten, JWT/RLS-Mandantentrennung, Abonnementprüfung und Cloud-Revisionsschutz erfolgreich getestet.
- **Resend:** `ladenfluss.de` ist für das Senden verifiziert. Eine produktive Supabase-SMTP-Verbindung wurde **nicht** nachgewiesen oder eingerichtet.
- **Host-DB:** Das schreibgeschützte Skript `supabase/checks/cloud-beta-readiness.sql` wurde am 10.10.2026 ausgeführt: **7 PASS, 6 PENDING**.
- **Live-Webseite:** Cloud-Beta ist noch nicht aktiviert. `assets/cloud-config.js` bleibt `enabled:false`.

### Genau diese sechs SQL-Freigaben fehlen noch in der gehosteten Datenbank

1. `public.branches.opening_days`
2. `public.branches.opening_hours`
3. `private.guard_cloud_document_revision` + Trigger
4. `public.create_cloud_document_if_absent`
5. `public.save_cloud_document_if_revision`
6. `public.create_company_onboarding`

Die SQL-Entwürfe unter `supabase/drafts/` wurden in einem echten lokalen Supabase-Stack mit JWT-/RLS-API geprüft, **aber noch nicht in einer gehosteten Staging-Instanz**.

## Technischer Installationsablauf nach expliziter Freigabe

**Vorher:** Sicherung/Recovery-Plan, Datenbank-Metadaten prüfen, Rollen-/Auth-Review, Rollback-Verfahren vereinbaren und Deploymentfenster abstimmen.

Geplante Reihenfolge der einzeln zu prüfenden SQL-Bausteine:

1. `supabase/drafts/add_branch_opening_settings.sql` – zwei fehlende nullable Filialfelder hinzufügen, **keine fiktiven Öffnungszeiten nachtragen**.
2. `supabase/drafts/guard_cloud_document_revision.sql` – Revisionsschutz-Trigger.
3. `supabase/drafts/create_cloud_document_if_absent.sql` – kontrollierte erste Erstellung eines Cloud-Dokuments.
4. `supabase/drafts/save_cloud_document_if_revision.sql` – atomarer Vergleich der erwarteten Revision.
5. `supabase/drafts/create_company_onboarding.sql` – Unternehmen + Hauptfiliale in einer Transaktion.
6. Noch einmal `supabase/checks/cloud-beta-readiness.sql` ausführen und **13 PASS / 0 PENDING** bestätigen.

**Wichtig:** `supabase/schema.sql` ist ein historischer v1.4-Prototyp und **kein aktueller Produktionsstand**. Er darf **nicht** blind als Migration ausgeführt werden; die echte Datenbank hat strengere Berechtigungen und andere Spalten.

## Weitere zwingende Freigabeprüfungen

1. Auth-Redirect-Allowlist und verpflichtende E-Mail-Bestätigung konfigurieren und mit echten Test-Postfächern kontrollieren.
2. Resend-SMTP serverseitig an Supabase anschließen; geheimer SMTP-Key niemals in `assets/` oder GitHub-Dateien.
3. Deutsche HTML-Vorlagen in Supabase Auth hinterlegen und bestätigen, dass `{{ .ConfirmationURL }}` korrekt gesetzt wird.
4. Im Browser den vollständigen PKCE-/`PASSWORD_RECOVERY`-Redirect testen, inkl. abgelaufenem oder wiederverwendetem Link.
5. In einer kontrollierten **gehosteten Testumgebung** Auth-Benutzer, RLS-Policies, RPC-Ownership und tatsächliche API-Rechte prüfen. **Die lokalen Tests ersetzen diesen Schritt nicht.**
6. Manuelle Profil-Synchronisierung mit zwei Geräten/Browsern testen, inkl. Konfliktanzeige, Abbruch, Wiederherstellung und Logout.
7. Berechtigungen und Datenschutz der übrigen lokalen Team-, PEP- und Urlaubs-Daten vor Einführung sensibler Cloud-HR-Inhalte neu bewerten. Diese Fachmodule sind im jetzigen Stand noch nicht pro Browserbenutzer getrennt.

## Freigabe/Notfallstrategie

- Beta-Schalter bleibt vor vollständiger Freigabe `false`.
- Neue Funktionen zuerst auf einem separaten Vorschau-Deployment mit ausschließlich Testdaten nutzen.
- Bei Problemen **Cloud-Schalter deaktiviert lassen** bzw. bei einer bereits erfolgten Freigabe sofort deaktivieren und Datenzugriff prüfen.
- Nicht ungeprüft Dokumentrevisionen, Historien oder Tabellen löschen, um Konflikte zu "beheben".
- Ein Rückrollen von SQL-Objekten erfordert eine eigene geprüfte Migration; es ist nicht dasselbe wie das Zurücksetzen der Website.

## Links

- GitHub Draft-PR: https://github.com/alexanderohm-netizen/ladenfluss-site/pull/12
- Interne E-Mail-Anleitung: `docs/cloud-beta-smtp-and-email.md`
- Supabase Auth SMTP: https://supabase.com/docs/guides/auth/auth-smtp
