# Gemeinsamer Rechner und Urlaubsplaner als App-Oberflächen

Der Handelsrechner unter `/rechner` bündelt acht Rechenarten mit Menü,
Ergebnisdisplay und Dezimaltastatur in Weinrot und Braun. Vorhandene Formeln
und Validierung in `assets/site.js` werden weiterverwendet. Eingaben bleiben
beim Wechsel innerhalb der Sitzung erhalten. Alte Einzeladressen bleiben
kompatibel; die Werkzeugübersicht führt zum gemeinsamen Rechner.

Die HTML-Formvorlagen werden mit `node scripts/build-calculator.cjs` aus den
bestehenden Werkzeugseiten erzeugt. Änderungen an deren Feldern erfordern
anschließend eine erneute Generierung von `rechner.html`.

Der Urlaubsplaner zeigt Kalender, Team/Resturlaub, Einstellungen und Erfassung
getrennt. Bearbeiten öffnet die Erfassung; erfolgreiches Speichern führt zurück
zum Kalender. Bestehende Speicherformate bleiben erhalten.

Lokale Prüfung: 48 Funktionstests bestanden. Browser-Suite ergänzt um alle
Rechenarten, Tastenfeld und die neuen Urlaubsansichten. Screenshots werden in CI
für 390 und 1440 Pixel bereitgestellt. Die Oberfläche ist eine responsive
Website; keine installierbare Offline-App wird behauptet.
