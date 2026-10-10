# Cloud-Beta: parallele Registerkarten und sichere Profilübernahme

Stand: 10.10.2026 · **nur Entwicklungszweig / Cloud-Beta deaktiviert**

## Problem

Zwei Browserregisterkarten können mit derselben Anmeldung gleichzeitig denselben lokalen Cloud-Entwurf unter `ladenfluss.cloud-draft.v2.<userId>.<companyId>.profile` bearbeiten. Ohne Schutz könnte eine ältere Registerkarte die jüngeren Daten einer zweiten Registerkarte beim Speichern, Bereinigen oder Konfliktlösen löschen.

## Implementierter Schutz

- Bei `load()` wird der exakte Rohinhalt des lokalen Entwurfs als Vergleichsstand übernommen.
- **Vor jedem `setItem/removeItem`** und **vor jedem Cloud-Speicheraufruf** wird geprüft, ob der Browserspeicher inzwischen von einer anderen Registerkarte verändert wurde.
- Bei Abweichung bricht die Aktion mit `DRAFT_CHANGED_EXTERNALLY` ab. Die fremde Fassung bleibt erhalten.
- Zusätzlich hört das Profil-Dashboard auf den `storage`-Event anderer Tabs, zeigt eine Warnung und sperrt weitere Übertragungen, bis der Benutzer **Cloud-Profil prüfen** wählt.
- Führt der Server einen Schreibvorgang erfolgreich aus und eine andere Registerkarte verändert währenddessen den lokalen Entwurf, wird der andere Entwurf nicht gelöscht. Stattdessen muss der Benutzer Cloud und lokales Profil neu vergleichen.
- Eine lokale Profilübernahme legt zuerst eine Sicherung an. Schlägt das anschließende Entfernen des Entwurfs durch eine zwischenzeitliche Änderung fehl, wird die lokale Profilübernahme soweit möglich zurückgerollt; der Browser-Backupdatensatz bleibt erhalten.
- Bei unterschiedlichen Versionen stellt die Oberfläche Ladenprofil und Cloud-Dokument Feld für Feld gegenüber, ohne HTML aus Inhalten zu rendern.

## Was diese Lösung leistet — und was nicht

Der lokale Vergleich ist ein **Best-Effort-Schutz**: `localStorage` bietet keine transaktionale Operation „Vergleiche und schreibe“, also kann ein extrem enger Schreibwettlauf zwischen zwei Tabs nie vollständig über diesen Mechanismus ausgeschlossen werden.

**Die serverseitige Datenintegrität** gewährleistet dagegen der PostgreSQL-Revisionsvergleich `save_cloud_document_if_revision` in einer Transaktion. Eine veraltete Serverrevision kann die neuere nicht überschreiben.

Es findet weiterhin keine automatische Cloud-Synchronisation von Personal-, Urlaubs- oder Dienstplandaten statt. Die anderen lokalen Module speichern vorerst geräteweit. Für die spätere Cloud-HR-Beta brauchen sie eine eigene Identitäts- und Mandantentrennung.

## Testnachweise

- `tests/cloud-sync-core.test.cjs`: parallele Registerkarten, stale drafts, fehlgeschlagene Bereinigung und In-Flight-Schreibvorgänge.
- `tests/cloud-profile-ui.test.cjs`: `storage`-Event und Bedienungssperre, nicht angezeigte externe Änderung vor dem RPC, sichere Übernahme und Rollback, Feldvergleich inklusive XSS-Schutz.
- `tests/local-supabase-browser-e2e.cjs`: zwei getrennte Browserkontexte mit Cloud-Import, Updatekonflikt und Erhalt des lokalen Entwurfs.
- `.github/workflows/web-vacation-check.yml` und `.github/workflows/local-supabase-auth.yml` führen die Tests im Entwicklungszweig aus.

## Bedienhinweis für die Beta

Bei einer Warnung zu konkurrierenden Änderungen zuerst **Cloud-Profil prüfen**, Unterschiede vergleichen und danach ausdrücklich auswählen, ob ein lokaler Entwurf übernommen oder die Cloud-Version genutzt werden soll. Niemals zum „Beheben“ alte Entwürfe unkontrolliert aus dem Browser löschen.

**Nicht auf Produktion aktivieren**, bevor echtes Supabase-Staging, Auth-E-Mail/SMTP und die fehlenden Datenbank-RPCs mit Freigabe geprüft wurden.
