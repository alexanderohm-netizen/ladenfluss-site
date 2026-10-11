# Ladenfluss Cloud-Beta – konkrete Freigabeprüfung (11. Oktober 2026)

## Scope
**Bisherige Produktion:** ladenfluss.de wurde mit dem neuen Design v2 veröffentlicht (GitHub main, `4e737a9`).

**Neuer Kandidat:** `release/cloud-beta-integration-20261011` (Draft-PR #14). Bewahrt Website, Rechner, PEP, Personalfluss und Urlaubsplaner. Fügt sicheren Auth-/Onboarding-Code, das manuelle Ladenprofil-Sync und geschützte Entwürfe in das neue Dashboard ein.

**Nicht enthalten:** automatische PEP-/Team-/Urlaubs-Synchronisierung, HR-Dateien, Bewerbungseingang, Bezahlabwicklung, Filialeinladungen.

## Gehostete Supabase-Readiness – am 11.10.2026 tatsächlich abgefragt
Das Skript `supabase/checks/cloud-beta-readiness.sql` hat **7 PASS / 7 PENDING** ergeben:

1. PENDING: `companies.retail_type`
2. PENDING: `branches.opening_days`
3. PENDING: `branches.opening_hours`
4. PENDING: Cloud-Revisionsschutztrigger
5. PENDING: `create_cloud_document_if_absent`
6. PENDING: `save_cloud_document_if_revision`
7. PENDING: `create_company_onboarding`

Erfüllt: RLS, berechtigter SELECT-Zugriff, Sperre direkter Updates/Inserts und anonymer Reads, beide privaten Hilfsfunktionen für E-Mail-Verifikation und Module.

Alle sieben fehlenden Bausteine sind **nur als SQL-Entwürfe** vorhanden, inkl. neuer `supabase/drafts/add_company_retail_type.sql`, die Bestandseinträge nicht mit erfundenen Kategorien befüllt.

## Weitere technische und geschäftliche Go-live-Blocker
- **Gehostetes Staging fehlt.** Keine Supabase-Development-Branch erstellt; mögliche zusätzliche Kosten sind vorher zu klären und durch den Nutzer zu bestätigen.
- **SMTP/Auth noch nicht verifiziert.** Vor Beta Supabase Auth > Notifications > Email > SMTP mit Resend konfigurieren, Domain/Absender prüfen, Bestätigung und Reset mit echten Postfächern verifizieren; keine Secret-Keys in GitHub-Dateien oder Chat teilen.
- **Auth-Redirects:** Site URL `https://ladenfluss.de`; explizite Allowlist `https://ladenfluss.de/konto` und `https://ladenfluss.de/passwort-zuruecksetzen`. Optional exakt definierter Staging-Origin, keine unnötigen Wildcards.
- **Datenschutz:** `/datenschutz` beschreibt aktuell die lokalen Rechner und enthält selbst einen Warnhinweis, dass vor Nutzerkonten eine Anpassung nötig ist. Rechtliche Prüfung mit Supabase/Resend als Auftragsverarbeitern, Rechtsgrundlagen, Datenschutzhinweisen, Löschfristen, Übermittlungen, Kontaktdaten, AV/DPA-Verträgen. Keine HR-Daten-Cloud vor zusätzlichen Schutzmaßnahmen.
- **Hosted Auth E2E:** Bestätigter/unbestätigter Benutzer, Rechte/RLS, zwei Unternehmen, Onboarding, doppelter Submit, Cross-Device-Profil-Sync, Konflikt, Wiederherstellung, abgelaufener Reset-Link, Logout.
- **Backups und Freigabefenster:** vor SQL-Rollout Sicherungsstand prüfen, Rollback der *Funktionsfreigabe* getrennt von nicht automatisch reversiblen Schemaänderungen planen.
- **Lizenz/SDK:** Browser-SDK aus gepinntem ESM-Endpunkt nur mit geprüfter Quelle; keine serverseitigen Schlüssel im öffentlichen Bundle.

## Qualitätsnachweis
CI-Stufen: `npm test` und Browser/Playwright (Website + Cloud UI), temporäres PostgreSQL mit **14/14** Gates, realer lokaler Supabase-Auth-/Mailpit-/Chromium-Lauf. **Alle drei müssen beim finalen Kandidaten erfolgreich durchlaufen.** Falls ein Schritt fehlschlägt, nicht aktivieren.

## Veröffentlichung
1. Zugangs-/SMTP-/Datenschutz-Gates abschließen.
2. Gehostete Tests mit Testaccounts erfolgreich abschließen.
3. SQL-Drafts einzeln und geprüft ausrollen, Readiness **14/14 PASS**.
4. Client ausschließlich mit `sb_publishable_` und `https://nzxtdrmdvqyvcbohplzt.supabase.co` konfigurieren.
5. Eigene Beta-Kennzeichnung, Start nur mit manueller Ladenprofilübertragung; Monitoring und Rollback-Vorgehen.
6. Erst dann Cloud-Schalter `enabled:true` und Produktivdeployment aus dem freigegebenen Stand.

Aktuell: **Noch kein produktiver Cloud-Schema-Rollout, keine produktive Aktivierung.** Arbeiten sind im Entwurfszweig nachvollziehbar; keine automatische Aktion im Hintergrund.
