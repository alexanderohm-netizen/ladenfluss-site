import 'package:flutter/material.dart';
import 'demo_catalog.dart';
import 'models/inventory.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key, required this.catalog});
  final DemoCatalog catalog;
  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  Future<void> book(String id) async {
    if (!widget.catalog.canEdit) return;
    String amount = '1';
    String reason = '';
    final form = GlobalKey<FormState>();
    MovementType type = MovementType.receipt;
    final saved = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(
      builder: (context, update) => AlertDialog(
        title: const Text('Bestandsbewegung erfassen'),
        content: SizedBox(width: 380, child: Form(key: form, child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<MovementType>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Vorgang'),
              items: const [
                DropdownMenuItem(value: MovementType.receipt, child: Text('Wareneingang (+)')),
                DropdownMenuItem(value: MovementType.sale, child: Text('Verkauf / Abgang (−)')),
                DropdownMenuItem(value: MovementType.waste, child: Text('Abschrift (−)')),
                DropdownMenuItem(value: MovementType.adjustment, child: Text('Bestandskorrektur (+/−)')),
              ],
              onChanged: (v) { if (v != null) update(() => type = v); },
            ),
            TextFormField(initialValue: amount, onChanged: (value) => amount = value,
              decoration: InputDecoration(labelText: type == MovementType.adjustment ? 'Änderung (z. B. -2)' : 'Menge'),
              validator: (v) {
                final n = int.tryParse(v ?? '');
                if (n == null || n == 0 || (type != MovementType.adjustment && n < 0)) return 'Gültige Menge eingeben';
                return null;
              }),
            TextFormField(initialValue: reason, onChanged: (value) => reason = value, decoration: const InputDecoration(labelText: 'Grund / Notiz'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Bitte Grund eingeben' : null),
          ],
        ))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Abbrechen')),
          FilledButton(onPressed: () { if (form.currentState!.validate()) Navigator.pop(context, true); }, child: const Text('Buchen')),
        ],
      ),
    ));
    if (saved == true && mounted) {
      final n = int.parse(amount);
      final delta = type == MovementType.adjustment || type == MovementType.receipt ? n : -n;
      try {
        widget.catalog.book(productId: id, delta: delta, type: type, reason: reason);
      } on StateError catch (error) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Expanded(child: AnimatedBuilder(
    animation: widget.catalog,
    builder: (context, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Bestände je Artikel · Demo-Filiale', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 12),
      Expanded(child: Card(child: ListView(children: [
        for (final p in widget.catalog.products) ListTile(
          title: Text(p.name),
          subtitle: Text('Nr. ${p.sku} · Meldebestand ${p.reorderPoint}'),
          leading: Icon(widget.catalog.stock(p.id) <= p.reorderPoint ? Icons.warning_amber : Icons.check_circle_outline),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('${widget.catalog.stock(p.id)} ${p.unit}'),
            const SizedBox(width: 12),
            OutlinedButton(onPressed: widget.catalog.canEdit ? () => book(p.id) : null, child: const Text('Buchen')),
          ]),
        ),
      ]))),
      const SizedBox(height: 12),
      Text('Letzte Bewegungen', style: Theme.of(context).textTheme.titleMedium),
      SizedBox(height: 170, child: ListView(children: [
        for (final m in widget.catalog.movements.take(20)) ListTile(
          dense: true,
          title: Text('${widget.catalog.products.firstWhere((p) => p.id == m.productId).name}: ${m.quantityDelta > 0 ? '+' : ''}${m.quantityDelta}'),
          subtitle: Text('${m.reason ?? ''} · ${m.createdAt.toLocal()}'),
        ),
        if (widget.catalog.movements.isEmpty) const ListTile(title: Text('Noch keine Buchungen')),
      ])),
      const Text('Lokale Speicherung auf diesem Gerät · noch keine Synchronisierung mit anderen Filialen'),
    ]),
  ));
}
