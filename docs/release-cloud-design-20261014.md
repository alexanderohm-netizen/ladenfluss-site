# Ladenfluss – Release 14.10.2026

Ausgangspunkt: main 59e5c82. Der Cloud-Kandidat 868befb wurde regulär zusammengeführt; Personalfluss-Profile, gemeinsamer Teamstamm und PEP-Fadenkreuz bleiben erhalten.

## Cloud-Beta

Aktiviert: bestätigtes Konto, Unternehmens-/Filialanlage, manuelles Ladenprofil-Sync mit Vergleich, Revisionskontrolle, Entwürfen und lokaler Wiederherstellung. Projekt nzxtdrmdvqyvcbohplzt, eu-central-1. Nur öffentlicher Publishable-Key im Browser. Keine Datenbankänderung in diesem Release.

Die gehosteten 14 Struktur-/Berechtigungsprüfungen wurden am 14.10. erneut ausgeführt: alle PASS. Auth-Einstellungen: E-Mail-Login und Registrierung aktiv, Bestätigung erforderlich. Der Nutzer bestätigt bereits durchgeführte Funktionstests; SMTP-Registrierung wurde in der vorherigen Sitzung erfolgreich getestet. Keine neuen E-Mails versandt.

Der Advisor markiert die drei bewusst aufrufbaren SECURITY DEFINER RPCs. Ihre aktuellen Definitionen prüfen bestätigten Nutzer und Unternehmens-/Modulzugriff, verwenden einen leeren search_path und begrenzen Payload/Revision. Die Passwort-Leak-Prüfung ist im Auth-Projekt nicht aktiviert. Diese Hinweise sind kein neuer Befund eines Cross-Tenant-Zugriffs.

**Grenze:** Mitarbeiter-, Vergütungs-, Urlaubs- und Schichtdaten bleiben lokal. Cloud ist keine automatische Sicherung dieser Module. Die Oberfläche benennt dies.

## Bedienung

- Startseite: drei direkte Aufgaben-Einstiege, Cloud-Zugang und funktionierende Entwicklungslinks.
- Seitenübergreifend: ruhigere weinrote/cremefarbene Flächen, lesbarere Schrift, einheitliche Abstände, mobile Anpassungen und reduzierte Bewegung.
- Personalfluss: Mitarbeiterliste zuerst, Stellenprofile optional aufklappbar, Suche zurücksetzen, kompakter Kopf und lesbarere Profile.
- Urlaubsplaner: kompakter Einstieg, Monatswahl, Mitarbeiter-/Statusfilter. Konfliktberechnung berücksichtigt weiter alle Personen; Filter verändern keine Daten.
- Rechner: sichtbare Formulare und Berechnen-Taste, optionales Tastenfeld, Vergleich einer gemerkten Variante je Rechenart. Rabattcheck zeigt Mehrabsatz für gleichen Rohertrag und Einkaufspreisgrenze. Beispielwerte sind ausdrücklich keine Branchenstandards.

## Prüfung und bekannte Grenzen

143 Node-/JSDOM-Tests bestanden vor Übergabe an GitHub. Enthält neue Regressionen für Rabattgrenzen/Nullpreis, Kalenderfilter mit unveränderter Konflikterkennung und getrennte Rechenszenarien. Vorhandene fehleranfällige Assertions korrigiert: zufällige Base64-Zeichenfolge e1 ist kein Nachweis eines unverschlüsselten Mitarbeiterschlüssels; außerdem alte Bestätigungstexte und async DOM-Teardown.

Die Browser-CI wurde an die beabsichtigten neuen Einstiege angepasst. Am 15.10. bestanden 143 Node-/JSDOM-Tests und alle 45 Browserprüfungen auf afb5597. Ein dabei zuvor entdeckter Überlauf der Startseitenkarten bei 390/320 px wurde behoben. CI-Screenshots von Startseite, Personalfluss, Urlaubsplaner und Rechner wurden in Desktop- und Mobilansicht visuell geprüft. Eine weitere kleine Anpassung hält die Startseiten-Schaltflächen auch im einspaltigen 320-px-Layout kompakt; dafür wird zusätzlich ein Screenshot erzeugt. Die abschließende Browser-CI prüft auch diesen Stand.

Ein lokaler Browser steht in dieser Arbeitsumgebung nicht zur Verfügung (kein control-browser); die Browserprüfung läuft in GitHub Actions.

Vercel API meldete 403 für Team warenfluss; Veröffentlichung erfolgt über bestehende Git-Anbindung. Live-Erfolg separat anhand Commit/Deployment und ausgeliefertem Inhalt prüfen.

## Noch vom Betreiber zu vervollständigen

Impressum enthält bisher keine vollständige Geschäftsanschrift. Datenschutztext enthält weiterhin offene Betreiberangaben/AV-Vertrags- und Aufbewahrungsinformationen. Keine Adresse, Vertragsabschlüsse oder rechtliche Freigabe erfunden. Diese betrieblichen Angaben müssen ergänzt werden; dieser Release bestätigt keine rechtliche Prüfung.
