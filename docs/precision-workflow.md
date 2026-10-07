# Kantigere Oberfläche und verbundene Personalplanung

Entwicklungsstand 7. Oktober 2026, nach dem veröffentlichten v1.5.1-Stand.

Die Startseite stellt drei vorhandene Aufgaben in den Mittelpunkt: Personal,
Preise und Kennzahlen. Ein ausdrücklich als Beispiel markierter Besetzungshinweis
ersetzt die Vorschau auf noch nicht angebundene Umsatz-, Bestands- und MHD-Daten.
Eine gemeinsame Gestaltung verwendet kleine Radien, klare Linien und reduzierte
Schatten.

Im Personalbedarfsrechner wird ein Verkaufstag gewählt. Die Übergabe speichert
die Rechnung im bestehenden lokalen Verlauf und öffnet die entsprechende Woche.
Der Dienstplan vergleicht den Richtwert mit Nettoschichtstunden ohne Abwesenheiten.
Datum und Quelle bleiben sichtbar; ältere Rechnungen erhalten einen Hinweis.
Schichten werden nicht automatisch angelegt oder verändert. Die Bedarfsrechnung
ersetzt keine zeitliche Besetzungsprüfung. Der Verlauf behält wie bisher höchstens
zwölf Rechnungen; der Vergleich ist deshalb keine dauerhafte Sollstundenverwaltung.

46 lokale Funktionstests bestanden. Die Browser-Suite prüft zusätzlich die Navigation
vom Rechner zum konkreten Tag und das Ausblenden beim Wochenwechsel. Visuelle
Bewertung auf echten Geräten ist weiterhin von automatischen Layoutprüfungen zu
unterscheiden.
