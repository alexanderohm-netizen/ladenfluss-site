# Cloud-Beta – Berechtigungsbefund 10.10.2026

Read-only SQL-Abfrage von `information_schema.role_table_grants` für `public.cloud_documents` und `authenticated`/`anon`:

| Rolle | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| authenticated | ja | nein | nein | nein |
| anon | nein | nein | nein | nein |

**Konsequenz:** Die existierenden RLS-Policies für INSERT/UPDATE eröffnen ohne Tabellen-GRANT keine direkten Schreibrechte. Der frühere Entwurf, der direkte Client-Updates als aktuell offen bezeichnete, war insofern zu pauschal und wurde korrigiert.

**Entwicklungsentscheidung:** `authenticated` behält nur SELECT auf `cloud_documents`. Schreiben soll ausschließlich über streng autorisierte SECURITY-DEFINER-RPCs laufen. Deren Autorisierung, Schema-/Funktions-GRANTs, Ausnahmen und Concurrent-Update-Verhalten sind vor der Freigabe in Staging zu testen.

**Nicht geprüft:** Ob es weitere RPCs oder serverseitige Schlüsselpfade gibt, die bereits Änderungen ausführen können. Die Tabelle ist deshalb nicht pauschal als vollständig abgesichert einzustufen.

**Release-Gate:** Zwei bestätigte Testkonten mit getrennten Unternehmen, gültige und ungültige Rollen, gleichzeitige Schreibvorgänge, Versionskonflikte und Historieneinträge nachweislich testen.
