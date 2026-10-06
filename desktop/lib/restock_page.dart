import 'package:flutter/material.dart';
import 'demo_catalog.dart';

/// An explainable suggestion, not a purchase order.
class RestockPage extends StatelessWidget {
  const RestockPage({super.key, required this.catalog, required this.openInventory});
  final DemoCatalog catalog;
  final VoidCallback openInventory;

  @override
  Widget build(BuildContext context) => Expanded(
    child: AnimatedBuilder(
      animation: catalog,
      builder: (context, _) {
        final candidates = catalog.lowStock
            .where((p) => p.reorderPoint > 0)
            .toList()
          ..sort((a, b) =>
              (catalog.stock(a.id) - a.reorderPoint)
                  .compareTo(catalog.stock(b.id) - b.reorderPoint));
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Automatische Bestellhinweise',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text(
            'Einfacher Vorschlag: Sobald der Meldebestand erreicht ist, '
            'wird ein Zielbestand vom Doppelten des Meldebestands angenommen. '
            'Verbrauch, Lieferzeit, Verpackungseinheiten und Lieferant sind noch nicht berücksichtigt.',
          ),
          const SizedBox(height: 18),
          if (candidates.isEmpty)
            const Card(child: Padding(
              padding: EdgeInsets.all(24),
              child: Row(children: [
                Icon(Icons.check_circle_outline),
                SizedBox(width: 12),
                Expanded(child: Text('Aktuell kein Bestellhinweis vorhanden.')),
              ]),
            ))
          else
            Expanded(child: Card(
              clipBehavior: Clip.antiAlias,
              child: ListView.separated(
                itemCount: candidates.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final p = candidates[index];
                  final onHand = catalog.stock(p.id);
                  final target = 2 * p.reorderPoint;
                  final quantity = target > onHand ? target - onHand : 0;
                  return ListTile(
                    leading: const Icon(Icons.warning_amber_rounded),
                    title: Text(p.name),
                    subtitle: Text(
                      'Lager: $onHand · Meldebestand: ${p.reorderPoint} '
                      '· Zielbestand: $target',
                    ),
                    trailing: Text(
                      'Vorschlag: +$quantity ${p.unit}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  );
                },
              ),
            )),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: openInventory,
            icon: const Icon(Icons.warehouse_outlined),
            label: const Text('Bestände ansehen'),
          ),
          const SizedBox(height: 8),
          const Text(
            'Nur Planungshilfe. Es wird keine Bestellung an Lieferanten übermittelt.',
          ),
        ]);
      },
    ),
  );
}
