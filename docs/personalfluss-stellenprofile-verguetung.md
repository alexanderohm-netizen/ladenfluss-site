# Personalfluss: Stellenprofile & verschlüsselte Vergütung

Stand 11.10.2026 – Entwicklungszweig `feature/personalfluss-stellenprofile-verguetung-20261011`, Draft-PR #15.

## Ziel

Fachlich vollständigeres Stellenprofil je Position sowie ein **individueller Brutto-Stundenlohn je Mitarbeiter**. Der gesamte Bereich folgt dem freigegebenen Ladenfluss-Design (Weinrot, Creme, warmes Braun). Bestehende PEP-/Urlaubs-Verknüpfungen bleiben über unveränderte Team-IDs erhalten.

## Stellenprofile

Zehn editierbare Vorlagen: Verkauf, Aushilfe, Kasse, Schichtleitung, Stellvertretende Filialleitung, Filialleitung, Lager, Service, Küche, Ausbildung. Jedes Profil enthält Titel, Einsatzbereich, Verantwortung, Kurzbeschreibung, Aufgaben und Anforderungen. Nutzer können weitere Rollen definieren. Rollenbezeichnungen bestehender Profile bleiben für die Zuordnung zu PEP stabil; andere Inhalte sind bearbeitbar.

Die Daten liegen unter `ladenfluss.positions.v1`. Der Mitarbeiter-Datensatz unter `ladenfluss.team.v1` enthält weiterhin nur die gewohnte Rolle als Text; er enthält **keinen Stundenlohn**. Die Bewerbungs-Roadmap ist weiterhin nicht veröffentlicht.

## Vergütung

Ein Mitarbeiterprofil kann ein **separates** persönliches Entgelt (Brutto-Euro pro Stunde, maximal zwei Dezimalstellen) bekommen. Die Anzeige erfordert eine passwortgeschützte Entsperrung. Anschließend sichtbar:
- Eigener Brutto-Stundenlohn
- Soll-Wochenkosten: Sollstunden × Stundenlohn
- Durchschnittliche Brutto-Monatskosten: Wochenwert × 52 / 12
- Kosten der in der aktuellen PEP-Woche geplanten Schichten (ohne Zuschläge, Arbeitgeberanteile, Steuern und weitere Abrechnungsbestandteile)

### Sicherheitsmodell

- Im Browser `localStorage` liegt **nur** AES-GCM-verschlüsselter Inhalt unter `ladenfluss.hr-pay-vault.v1`. Schlüssel per PBKDF2-HMAC-SHA-256 mit 250.000 Iterationen und zufälligem Salt aus der selbst gewählten Passphrase. Frischer zufälliger IV pro Speichervorgang; Integrität durch AEAD.
- Keine Passphrase im Browser-Speicher, GitHub, Backend oder im Cloud-Beta-Profil.
- Nach Neuaufruf, manuellem Sperren oder beim Verlassen des Tabs muss die Passphrase neu eingegeben werden.
- Ein konkurrierender Schreibversuch aus einem weiteren Tab führt zum Sperren statt zum Überschreiben der letzten Änderung.
- Der Tresor ist **nicht** Teil des generischen Ladenfluss-Backups. Ein separates **verschlüsseltes** JSON-Exportformat ist vorhanden; ein Importmechanismus muss vor vollständiger Wiederherstellbarkeit noch implementiert und getestet werden. Weder die Datei noch die passwortlose Exportfunktion verschafft Zugang zu Klardaten.
- Die Stellenprofile selbst enthalten keine personenbezogenen Zahlungen und sind unverschlüsselt lokal gespeichert.
- Bei fehlendem WebCrypto gibt es **keinen** Rückfall auf lesbaren Klartext.
- **Kein mehrmandantenfähiger HR-Zugriffsschutz.** Browser-Erweiterungen, fremder JavaScript-Code im selben Ursprung, kompromittierte Geräte oder bewusst geteilte Passphrasen können Sicherheit gefährden. Auf gemeinsam genutzten Firmenendgeräten den Tresor nicht öffnen.
- Für Bankdaten/IBAN, echte Lohnabrechnungen, Steuer- und Sozialdaten, Dokumente oder eine unternehmensweite HR-Cloud sind zuerst dedizierte Rollen, serverseitige Zugriffsregeln, rechtliche Prüfung, Löschfristen und Audit-Logs nötig.

## Qualität & Freigabe

Node.js Unit-Tests prüfen Ver- und Entschlüsselung, falsche Passphrasen, manipulierte Werte, parallele Tabs und beschädigte Positionsdaten. Playwright prüft Rolle → Mitarbeiterprofil → PEP, Maskierung, eigene Stundenlöhne und responsive Darstellung bei 1440, 768, 390, 320 px.

Der Entwicklungszweig darf erst nach grünem CI-Lauf freigegeben werden. Der separate Cloud-PR #14 bleibt unverändert und deaktiviert.

## Mögliche spätere Ergänzungen

- Sicherer Import bestehender verschlüsselter Lohn-Tresore (mit Passwortprüfung und bewusster Backup-/Ersetzen-Bestätigung).
- Datenschutzkonforme Team-/HR-Konten, Freigaben auf Filial- und Geschäftsführungsebene, Zugriffsaudit.
- Arbeitgebernebenkosten- und Zuschlagsmodelle nach individuell konfigurierbaren Regeln, ohne automatische Lohnabrechnung vor fachlicher und rechtlicher Prüfung.
