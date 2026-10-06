# Ladenfluss WWS Desktop

Eigenständiger Flutter-Desktop-Client für macOS und Windows. **Nicht** die Ladenfluss-Website in einem WebView.

## Start
1. Flutter SDK mit Desktop-Unterstützung installieren.
2. In `desktop/` ausführen: `flutter create --platforms=macos,windows .` (erzeugt native Runner).
3. `flutter pub get` und `flutter run -d macos` oder `flutter run -d windows`.

Der jetzige Stand ist ein **UI-Prototyp mit Beispieldaten**. Kein Login, keine echte Artikel-/Bestandsdatenbank und keine Serververbindung. Der spätere Auth-/Datenzugriff wird separat eingebaut und vor produktiver Nutzung durch RLS und Tests abgesichert.
