# Cloud Beta – RLS- und Funktionsaudit (10.10.2026)

**Methode:** Read-only-Abfragen gegen pg_policies und pg_proc des verbundenen Supabase-Projekts. Keine Testnutzer erstellt, keine Policies verändert. Eine erfolgreiche Mandantentrennung ist damit noch **nicht** nachgewiesen.

## Bestätigte Regeln
- Alle sechs public-Tabellen haben RLS aktiviert (separate Inventur).
- `companies`: SELECT für Mitglieder, UPDATE für owner/admin; INSERT nur mit eigener Benutzer-ID, bestätigter E-Mail und nicht anonymem Konto.
- `company_members`: SELECT nur für die eigene Benutzer-ID; keine Client-INSERT/UPDATE/DELETE-Policy.
- `branches`: SELECT für alle aktiven Rollen, UPDATE für owner/admin.
- `module_access`: SELECT für owner/admin/manager; keine Client-Schreib-Policy.
- `cloud_documents`: SELECT/INSERT/UPDATE über `private.module_allowed`; keine Client-DELETE-Policy.
- `cloud_document_history`: SELECT über `private.module_allowed`; keine Client-Schreib-Policy.

## Private Funktionen
- `is_verified_account()` prüft bestätigte E-Mail, Auth-User und nicht anonym.
- `has_role(target,roles)` prüft aktive Mitgliedschaft und bestätigtes Konto.
- `module_allowed(target,requested)` lässt `profile` und `vacation` für owner/admin/manager zu; für andere Module ist ein aktiver/Test-`module_access`-Eintrag mit `valid_until > now()` erforderlich.
- `new_company()` legt owner-Mitgliedschaft und Hauptfiliale beim Anlegen eines Unternehmens an.
- `archive_previous_cloud_document()` archiviert die vorherige Revision und löscht alte Historieneinträge (beabsichtigte Begrenzung auf etwa fünf alte Revisionen, separat testen).
- Alle fünf privaten Funktionen sind SECURITY DEFINER mit leerem search_path. EXECUTE-Rechte, Triggerbindungen und Besitzerrechte müssen gesondert geprüft werden.

## Risiken / Entscheidungen
1. **Hoch:** Modulfreischaltung ohne `valid_until` ist trotz `status='active'` nicht möglich. Produktentscheidung: unbefristetes Aktiv-Abo zulassen oder Ablaufdatum zwingend setzen. Nicht ohne Spezifikation ändern.
2. **Hoch:** Kein nachgewiesener Schutz vor stillen gleichzeitigen Updates. `revision` ist vorhanden, aber aus den Policies allein folgt keine optimistische Sperre.
3. **Mittel:** `employee` darf aktuell keine Cloud-Dokumente lesen oder bearbeiten. Für Dienstpläne ist wahrscheinlich ein gesondertes Leserecht erforderlich; Datenschutz für Personalinformationen beachten.
4. **Mittel:** Historienlöschung und Triggerrechte prüfen, bevor Backup-/Restore-Versprechen gemacht werden.
5. **Mittel:** Schreibvorgänge an `company_members` und `module_access` brauchen einen abgesicherten serverseitigen Verwaltungsweg.
6. **Zu prüfen:** Grants/EXECUTE auf SECURITY-DEFINER-Funktionen, Trigger-Definitionen, RPC-Schnittstellen und mögliche ungeschützte Tabellen in anderen exponierten Schemas.

## Nächste Tests
- Zwei getrennte bestätigte Testkonten und Unternehmen A/B in isolierter Testumgebung.
- Für jede Tabelle SELECT, INSERT, UPDATE, DELETE unter A/B und den Rollen owner/admin/manager/employee ausführen.
- Parallele Revisionen mit zwei Sitzungen schreiben und Konflikte erzwingen.
- Freischaltung von `active`, `trial`, `inactive` mit null, vergangenem und künftigem Ablaufdatum prüfen.
- Sämtliche Abweichungen dokumentieren, bevor Änderungen an produktiven Policies erfolgen.

## Freigabestatus
**Nicht freigegeben.** Read-only-Inspektion abgeschlossen; praktische Rechte- und E2E-Tests stehen aus.
