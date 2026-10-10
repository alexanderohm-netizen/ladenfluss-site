# Cloud-Dokumente: Optimistischer Revisionsschutz (Entwurf)

Status: **nicht ausgeführt**. Vor Einsatz in einer isolierten Testdatenbank prüfen.

## Befund (10.10.2026)
- `cloud_documents`: PRIMARY KEY (company_id,module_key), CHECK revision > 0, JSON-Objekt maximal 1 MiB.
- Trigger `archive_previous_cloud_document` läuft BEFORE UPDATE **nur wenn** OLD.revision von NEW.revision abweicht.
- Damit ist ein UPDATE mit unveränderter Revision und geändertem Payload derzeit nicht durch diesen Trigger blockiert.
- Eine erzwungene Erhöhung um genau eins und ein Compare-and-Swap-Verfahren sind nicht nachgewiesen.

## Zielarchitektur
Alle Schreibvorgänge müssen über eine **atomare bedingte Aktualisierung** laufen:

```sql
UPDATE public.cloud_documents
SET payload = :next_payload,
    revision = :expected_revision + 1,
    updated_at = now()
WHERE company_id = :company_id
  AND module_key = :module_key
  AND revision = :expected_revision
RETURNING revision, updated_at;
```

Wenn keine Zeile zurückkommt: Revision veraltet, Dokument nicht vorhanden oder Zugriff verweigert. Dann neu laden und Konflikt im UI auflösen; niemals automatisch die fremde Änderung überschreiben.

## Datenbankhärtung (separat zu implementieren)
1. Direkte Client-UPDATE-Policy nach Migration entfernen oder den Schreibweg über einen streng abgesicherten RPC kapseln, der Benutzeridentität, Firmenrolle, Modulfreigabe und `expected_revision` prüft.
2. Auf DB-Ebene sicherstellen, dass bei jedem Payload-Update die Revision genau um 1 steigt; auch Änderungen an company_id und module_key verbieten.
3. Erstschreiben nur bei nicht vorhandenem Dokument erlauben, bei Konflikt nicht blind upserten.
4. Trigger für Historie auf alle tatsächlich erlaubten Dokumentänderungen abstimmen; keine unarchivierten Payload-Updates.
5. Historie und Restore mit parallelen Updates testen. Keine Geheimnisse in JSON-Dokumente schreiben.
6. Funktionen mit SECURITY DEFINER auf Eigentümer, search_path, GRANT EXECUTE und Eingabevalidierung prüfen.

## Testmatrix
- A schreibt Revision 1 → 2: erfolgreich.
- B versucht danach mit erwarteter Revision 1 zu schreiben: abgelehnt, Revision 2 unverändert.
- B lädt Revision 2 und schreibt 3: erfolgreich.
- Benutzer aus anderem Unternehmen: kein Lesen/Schreiben.
- Mitarbeiter ohne Schreibrecht: kein Schreiben.
- Payload-Update ohne Revisionswechsel: abgelehnt.
- Revision 2 → 4: abgelehnt.
- Änderung von company_id/module_key: abgelehnt.
- Ungültiger Payload / mehr als 1 MiB: abgelehnt.
- Archiv enthält die vorherige Version exakt einmal.

## UI-Verhalten
Status: lokal geändert, wird gespeichert, synchronisiert, Konflikt, offline. Bei Konflikt: eigene Änderungen nicht verwerfen; serverseitige Version und lokale Version getrennt anzeigen.

## Rollout
1. Reproduzierbare Integrationstests in Staging.
2. Client auf bedingte Updates umstellen.
3. Direkte Schreibwege schließen.
4. Migration testen, Backup und Rollback planen.
5. Erst dann produktiv schalten.
