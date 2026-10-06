# Ladenfluss WWS – Fachregeln v0.1

## Artikel
- Artikel-ID ist stabil und unabhängig von SKU oder Barcode.
- SKU ist innerhalb eines Unternehmens eindeutig; Barcode optional und gesondert validiert.
- Geldbeträge werden in Integer-Cent gespeichert, nicht in Float.
- Inaktive Artikel bleiben für historische Buchungen erhalten.

## Bestand
- Bestand gehört immer zu einer Filiale und einem Artikel.
- Eine Bewegung enthält Richtung, Menge, Typ, Grund, Benutzer, Zeit und eindeutigen Idempotenzschlüssel.
- Bestandskorrekturen überschreiben keine historischen Bewegungen.
- Warenzugang, Verkauf, Abschrift und Umlagerung werden als nachvollziehbare Bewegungen modelliert.
- Umlagerung zwischen Filialen ist eine atomare Transaktion oder ein expliziter zweistufiger Transfer.
- Buchungsrechte und Mandantenzugehörigkeit werden serverseitig geprüft.
- Negativbestand ist eine explizite Unternehmensregel, keine unbeabsichtigte Nebenwirkung.

## Erste intelligente Warnungen
- Bestand kleiner oder gleich Meldebestand.
- Fehlender Verkaufspreis oder Verkaufspreis unter Einkaufspreis (Hinweis, nicht automatisch Fehler).
- Lieferung überfällig (sobald Bestell- und Liefertermine vorliegen).
- MHD-Risiko erst mit Charge, MHD und belastbaren Absatzdaten.

## Testfälle vor Livebetrieb
1. Doppelte Buchung mit identischem Idempotenzschlüssel verändert Bestand nur einmal.
2. Nutzer aus Firma A darf Artikel/Bestand von Firma B weder lesen noch verändern.
3. Zwei gleichzeitige Warenzugänge ergeben die korrekte Summe.
4. Storno erzeugt eine Gegenbuchung mit Referenz auf das Original.
5. Artikel-Deaktivierung löscht keine Historie.
6. Filialwechsel ändert den Datenkontext und erfordert erneute Berechtigungsprüfung.

Diese Dokumente und Dart-Klassen sind ein Entwurf, kein angebundenes Backend.
