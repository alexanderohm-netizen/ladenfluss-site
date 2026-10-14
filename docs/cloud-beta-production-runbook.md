# Ladenfluss Cloud-Beta – Freigabe und kontrollierter Rollout

**Stand: 11.10.2026. Cloud-Beta-Aktivierung angefragt; gehostete Auth-, SMTP-, Backup- und Datenschutz-Gates noch nicht erfüllt. Keine produktiven Schemaänderungen vorgenommen.**

## Status der bisherigen Prüfungen

- **GitHub:** JavaScript-/Browser-Tests und isolierte PostgreSQL-Tests erfolgreich.
- **Lokale echte Supabase-Instanz:** E-Mail-Registrierung und -Bestätigung, Passwort-Reset, zwei Auth-Konten, JWT/RLS-Mandantentrennung, Abonnementprüfung und Cloud-Revisionsschutz erfolgreich getestet.
- **Resend:** `ladenfluss.de` ist für das Senden verifiziert. Eine produktive Supabase-SMTP-Verbindung wurde **nicht** nachgewiesen oder eingerichtet.
- **Host-DB:** Das schreibgeschützte Skript `supabase/checks/cloud-beta-readiness.sql` wurde am 10.10.2026 ausgeführt: **7 PASS, 7 PENDING (14 Checks)**.
- **Live-Webseite:** Cloud-Beta ist noch nicht aktiviert. `assets/cloud-config.js` bleibt `enabled:false`.

### Genau diese sieben SQL-Freigaben fehlen noch in der gehosteten Datenbank

1. `public.companies.retail_type`
2. `public.branches.opening_days`
3. `public.branches.opening_hours`
4. `private.guard_cloud_document_revision` + Trigger
5. `public.create_cloud_document_if_absent`
6. `public.save_cloud_document_if_revision`
7. `public.create_company_onboarding`

Die SQL-Entwürfe unter `supabase/drafts/` wurden in einem echten lokalen Supabase-Stack mit JWT-/RLS-API geprüft, **aber noch nicht in einer gehosteten Staging-Instanz**.

## Technischer Installationsablauf nach expliziter Freigabe

**Vorher:** Sicherung/Recovery-Plan, Datenbank-Metadaten prüfen, Rollen-/Auth-Review, Rollback-Verfahren vereinbaren und Deploymentfenster abstimmen.

Geplante Reihenfolge der einzeln zu prüfenden SQL-Bausteine:

1. `supabase/drafts/add_company_retail_type.sql` – fehlende nullable Einzelhandelsbranche ergänzen, ohne bestehende Daten zu verändern.
2. `supabase/drafts/add_branch_opening_settings.sql` – zwei fehlende nullable Filialfelder hinzufügen, **keine fiktiven Öffnungszeiten nachtragen**.
3. `supabase/drafts/guard_cloud_document_revision.sql` – Revisionsschutz-Trigger.
4. `supabase/drafts/create_cloud_document_if_absent.sql` – kontrollierte erste Erstellung eines Cloud-Dokuments.
5. `supabase/drafts/save_cloud_document_if_revision.sql` – atomarer Vergleich der erwarteten Revision.
6. `supabase/drafts/create_company_onboarding.sql` – Unternehmen + Hauptfiliale in einer Transaktion.
7. Noch einmal `supabase/checks/cloud-beta-readiness.sql` ausführen und **14 PASS / 0 PENDING** bestätigen.

**Wichtig:** `supabase/schema.sql` ist ein historischer v1.4-Prototyp und **kein aktueller Produktionsstand**. Er darf **nicht** blind als Migration ausgeführt werden; die echte Datenbank hat strengere Berechtigungen und andere Spalten.

## Weitere zwingende Freigabeprüfungen

1. **Vorher Datenschutz rechtlich prüfen:** `/datenschutz` beschreibt noch ausschließlich lokale Datenverarbeitung und trägt einen Hinweis auf spätere Anpassung vor Nutzerkonten. Einen freigegebenen Beta-Text mit Supabase/Auth/Resend, Aufbewahrung, Zugriff, Löschung und AV-Verträgen veröffentlichen. Kein Blind-Deploy.
2. Auth-Redirect-Allowlist und verpflichtende E-Mail-Bestätigung konfigurieren und mit echten Test-Postfächern kontrollieren.
3. Resend-SMTP serverseitig an Supabase anschließen; geheimer SMTP-Key niemals in `assets/` oder GitHub-Dateien.
4. Deutsche HTML-Vorlagen in Supabase Auth hinterlegen und bestätigen, dass `{{ .ConfirmationURL }}` korrekt gesetzt wird.
5. Im Browser den vollständigen PKCE-/`PASSWORD_RECOVERY`-Redirect testen, inkl. abgelaufenem oder wiederverwendetem Link.
6. In einer kontrollierten **gehosteten Testumgebung** Auth-Benutzer, RLS-Policies, RPC-Ownership und tatsächliche API-Rechte prüfen. **Die lokalen Tests ersetzen diesen Schritt nicht.**
7. Manuelle Profil-Synchronisierung mit zwei Geräten/Browsern testen, inkl. Konfliktanzeige, Abbruch, Wiederherstellung und Logout.
8. Berechtigungen und Datenschutz der übrigen lokalen Team-, PEP- und Urlaubs-Daten vor Einführung sensibler Cloud-HR-Inhalte neu bewerten. Diese Fachmodule sind im jetzigen Stand noch nicht pro Browserbenutzer getrennt.

## Freigabe/Notfallstrategie

- Beta-Schalter bleibt vor vollständiger Freigabe `false`.
- Neue Funktionen zuerst auf einem separaten Vorschau-Deployment mit ausschließlich Testdaten nutzen.
- Bei Problemen **Cloud-Schalter deaktiviert lassen** bzw. bei einer bereits erfolgten Freigabe sofort deaktivieren und Datenzugriff prüfen.
- Nicht ungeprüft Dokumentrevisionen, Historien oder Tabellen löschen, um Konflikte zu "beheben".
- Ein Rückrollen von SQL-Objekten erfordert eine eigene geprüfte Migration; es ist nicht dasselbe wie das Zurücksetzen der Website.

## Links

- GitHub Design-v2-kompatible Integrations-PR: https://github.com/alexanderohm-netizen/ladenfluss-site/pull/14
- Ältere Ausgangs-PR: https://github.com/alexanderohm-netizen/ladenfluss-site/pull/12
- Interne E-Mail-Anleitung: `docs/cloud-beta-smtp-and-email.md`
- Supabase Auth SMTP: https://supabase.com/docs/guides/auth/auth-smtp
