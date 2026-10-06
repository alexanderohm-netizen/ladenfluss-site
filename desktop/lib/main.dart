import 'package:flutter/material.dart';
import 'products_page.dart';
import 'inventory_page.dart';
import 'restock_page.dart';
import 'vacation_page.dart';
import 'vacation_plan.dart';
import 'demo_catalog.dart';

void main() => runApp(const LadenflussApp());

class LadenflussApp extends StatelessWidget {
  const LadenflussApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ladenfluss WWS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF752D43)),
        scaffoldBackgroundColor: const Color(0xFFF8F7F5),
      ),
      home: const Workspace(),
    );
  }
}

class Workspace extends StatefulWidget {
  const Workspace({super.key});

  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  int selected = 0;
  final catalog = DemoCatalog();
  final vacations = VacationPlan();
  @override
  void initState() { super.initState(); catalog.load(); vacations.load(); }
  @override
  void dispose() { catalog.dispose(); vacations.dispose(); super.dispose(); }
  final pages = const ['Heute', 'Artikel', 'Bestand', 'Einkauf', 'Wareneingang', 'Inventur', 'Auswertungen', 'Urlaub', 'Einstellungen'];
  final icons = const [Icons.home_outlined, Icons.inventory_2_outlined, Icons.warehouse_outlined, Icons.shopping_cart_outlined, Icons.local_shipping_outlined, Icons.fact_check_outlined, Icons.bar_chart_outlined, Icons.beach_access_outlined, Icons.settings_outlined];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            scrollable: true,
            extended: MediaQuery.sizeOf(context).width > 1050,
            backgroundColor: Colors.white,
            selectedIndex: selected,
            onDestinationSelected: (value) => setState(() => selected = value),
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 22),
              child: Text('Ladenfluss', style: TextStyle(fontSize: 21, fontWeight: FontWeight.bold)),
            ),
            destinations: [
              for (var i = 0; i < pages.length; i++)
                NavigationRailDestination(icon: Icon(icons[i]), label: Text(pages[i])),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(pages[selected], style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  AnimatedBuilder(animation: catalog, builder: (context, _) => Text(
                    !catalog.loaded ? 'Lokale Daten werden geladen …' :
                    catalog.storageError != null ? catalog.storageError! :
                    'Ladenfluss WWS · Lokale Datenspeicherung (Prototyp, ohne Cloud-Synchronisierung)',
                    style: TextStyle(color: catalog.storageError == null ? null : Colors.red),
                  )),
                  const SizedBox(height: 28),
                  if (selected == 0) ...[
                    Text('Was braucht heute deine Aufmerksamkeit?', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    AnimatedBuilder(
                      animation: catalog,
                      builder: (context, _) {
                        final low = catalog.lowStock;
                        final belowCost = catalog.products.where((p) =>
                            p.active && p.salePriceCents < p.purchasePriceCents).toList();
                        final recent = catalog.movements.isEmpty ? null : catalog.movements.first;
                        return Wrap(
                          spacing: 16,
                          runSpacing: 16,
                          children: [
                            _SignalCard(
                              icon: low.isEmpty ? Icons.check_circle_outline : Icons.warning_amber,
                              title: low.isEmpty ? 'Bestände im grünen Bereich' : '${low.length} Artikel nachbestellen',
                              body: low.isEmpty
                                ? 'Kein Artikel liegt am oder unter dem Meldebestand.'
                                : low.take(2).map((p) => p.name).join(', '),
                              onTap: () => setState(() => selected = 2),
                            ),
                            _SignalCard(
                              icon: belowCost.isEmpty ? Icons.sell_outlined : Icons.warning_amber,
                              title: belowCost.isEmpty ? 'Keine auffälligen Preise' : '${belowCost.length} Preise prüfen',
                              body: belowCost.isEmpty
                                ? 'Aktuell kein Verkaufspreis unter dem Einkaufspreis.'
                                : belowCost.take(2).map((p) => p.name).join(', '),
                              onTap: () => setState(() => selected = 1),
                            ),
                            AnimatedBuilder(
                              animation: vacations,
                              builder: (context, _) {
                                final now = DateTime.now();
                                final today = DateTime(now.year, now.month, now.day);
                                final horizon = DateTime(now.year, now.month, now.day + 14);
                                final upcoming = vacations.entries.where((leave) =>
                                    !leave.end.isBefore(today) &&
                                    !leave.start.isAfter(horizon)).toList();
                                return _SignalCard(
                                  icon: Icons.beach_access_outlined,
                                  title: upcoming.isEmpty
                                    ? 'Urlaub im Blick'
                                    : '${upcoming.length} Urlaubszeiträume in 14 Tagen',
                                  body: upcoming.isEmpty
                                    ? 'Keine anstehenden Zeiträume eingetragen.'
                                    : upcoming.take(2).map((leave) {
                                        for (final person in vacations.employees) {
                                          if (person.id == leave.employeeId) return person.name;
                                        }
                                        return 'Mitarbeiter';
                                      }).join(', '),
                                  onTap: () => setState(() => selected = 7),
                                );
                              },
                            ),
                            _SignalCard(
                              icon: Icons.history,
                              title: 'Letzte Bestandsbewegung',
                              body: recent == null
                                ? 'Noch keine Buchung vorhanden.'
                                : '${recent.quantityDelta > 0 ? '+' : ''}${recent.quantityDelta} Stück · ${recent.reason ?? 'ohne Notiz'}',
                              onTap: () => setState(() => selected = 2),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    const Text('Hinweise basieren auf lokalen Demodaten. Absatzprognosen, Liefertermine und echte Filialdaten folgen später.'),
                  ] else if (selected == 1)
                    ProductsPage(catalog: catalog)
                  else if (selected == 2)
                    InventoryPage(catalog: catalog)
                  else if (selected == 3)
                    RestockPage(catalog: catalog, openInventory: () => setState(() => selected = 2))
                  else if (selected == 7)
                    VacationPage(plan: vacations)
                  else
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text('Das Modul „${pages[selected]}“ wird schrittweise entwickelt. Noch keine Live-Daten oder Buchungen.'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignalCard extends StatelessWidget {
  const _SignalCard({required this.icon, required this.title, required this.body, required this.onTap});
  final IconData icon;
  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 280,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 28),
              const SizedBox(height: 12),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(body),
            ],
          ),
        ),
        ),
      ),
    );
  }
}
