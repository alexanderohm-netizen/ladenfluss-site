import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ladenfluss_wws/main.dart';
import 'package:ladenfluss_wws/demo_catalog.dart';
import 'package:ladenfluss_wws/vacation_plan.dart';
import 'package:ladenfluss_wws/models/inventory.dart';
import 'demo_catalog_test.dart' show MemoryCatalogStore;
import 'vacation_plan_test.dart' show MemoryVacationStorage;

void main() {
  testWidgets('Dashboard remains usable in a small desktop window', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 500));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final catalog = DemoCatalog(store: MemoryCatalogStore());
    final vacations = VacationPlan(storage: MemoryVacationStorage());
    await tester.pumpWidget(LadenflussApp(catalog: catalog, vacations: vacations));
    await tester.pumpAndSettle();
    expect(find.text('Was braucht heute deine Aufmerksamkeit?'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Inventory dropdown books the selected movement type', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1440, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final catalog = DemoCatalog(store: MemoryCatalogStore());
    final vacations = VacationPlan(storage: MemoryVacationStorage());
    await tester.pumpWidget(LadenflussApp(catalog: catalog, vacations: vacations));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.warehouse_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Buchen').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<MovementType>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abschrift (−)').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), '2');
    await tester.enterText(find.byType(TextFormField).at(1), 'Beschädigte Ware');
    await tester.tap(find.widgetWithText(FilledButton, 'Buchen'));
    await tester.pumpAndSettle();
    expect(catalog.stock('demo1'), 5);
    expect(catalog.movements.first.type, MovementType.waste);
    expect(tester.takeException(), isNull);
    await catalog.pendingSave;
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Vacation forms save, cancel and reopen without lifecycle errors', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1440, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final catalog = DemoCatalog(store: MemoryCatalogStore());
    final vacations = VacationPlan(storage: MemoryVacationStorage());
    await tester.pumpWidget(LadenflussApp(catalog: catalog, vacations: vacations));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.beach_access_outlined).first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byIcon(Icons.person_add_alt_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.person_add_alt_outlined));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Anna');
    await tester.tap(find.widgetWithText(FilledButton, 'Anlegen'));
    await tester.pumpAndSettle();
    expect(vacations.employees.single.name, 'Anna');
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.byTooltip('Urlaubsbudget ändern'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Urlaubsbudget ändern'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), '25');
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pumpAndSettle();
    expect(vacations.employees.single.annualDays, 25);
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('Urlaub eintragen'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Urlaub eintragen'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Sommer');
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pumpAndSettle();
    expect(vacations.entries.single.note, 'Sommer');
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.byIcon(Icons.person_add_alt_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.person_add_alt_outlined));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Verwerfen');
    await tester.tap(find.text('Abbrechen'));
    await tester.pumpAndSettle();
    expect(vacations.employees.length, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

}
