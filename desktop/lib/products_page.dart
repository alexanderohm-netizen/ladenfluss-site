import 'package:flutter/material.dart';
import 'demo_catalog.dart';
import 'models/product.dart';
import 'product_editor_dialog.dart';

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key, required this.catalog});
  final DemoCatalog catalog;
  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  String search = '';

  String euro(int cents) =>
      '${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')} €';

  Future<void> edit([Product? initial]) async {
    if (!widget.catalog.canEdit) return;
    final result = await showDialog<Product>(
      context: context,
      builder: (_) => ProductEditorDialog(
        existing: widget.catalog.products,
        initial: initial,
      ),
    );
    if (result == null || !mounted) return;
    try {
      if (initial == null) {
        widget.catalog.addProduct(result);
      } else {
        widget.catalog.updateProduct(result);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(initial == null ? 'Artikel angelegt' : 'Artikel aktualisiert')),
      );
    } on StateError catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Expanded(
    child: AnimatedBuilder(
      animation: widget.catalog,
      builder: (context, _) {
        final products = widget.catalog.products;
        final visible = products.where((p) =>
            p.name.toLowerCase().contains(search) ||
            p.sku.toLowerCase().contains(search) ||
            (p.barcode?.contains(search) ?? false)).toList();
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 18, runSpacing: 8, children: [
            Text('${products.length} Artikel im Sortiment',
                style: Theme.of(context).textTheme.titleMedium),
            Text('${widget.catalog.lowStock.length} unter Meldebestand',
                style: Theme.of(context).textTheme.titleMedium),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Name, Artikelnummer oder Barcode suchen',
                ),
                onChanged: (v) => setState(() => search = v.trim().toLowerCase()),
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: widget.catalog.canEdit ? () => edit() : null,
              icon: const Icon(Icons.add),
              label: const Text('Neuer Artikel'),
            ),
          ]),
          const SizedBox(height: 12),
          Expanded(child: Card(
            clipBehavior: Clip.antiAlias,
            child: ListView.separated(
              itemCount: visible.isEmpty ? 1 : visible.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (visible.isEmpty) {
                  return const ListTile(title: Text('Keine Artikel gefunden'));
                }
                final p = visible[index];
                final low = widget.catalog.stock(p.id) <= p.reorderPoint;
                final belowCost = p.salePriceCents < p.purchasePriceCents;
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text(
                    'Nr. ${p.sku} · EK ${euro(p.purchasePriceCents)} · VK ${euro(p.salePriceCents)}'
                    '${p.barcode == null ? '' : ' · Barcode ${p.barcode}'}',
                  ),
                  leading: Icon(low ? Icons.warning_amber_rounded :
                      Icons.inventory_2_outlined,
                    color: low ? Colors.deepOrange : null),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (belowCost) const Tooltip(
                      message: 'Verkaufspreis liegt unter Einkaufspreis',
                      child: Icon(Icons.sell_outlined, color: Colors.deepOrange),
                    ),
                    const SizedBox(width: 10),
                    Text('Bestand ${widget.catalog.stock(p.id)}'),
                    const SizedBox(width: 10),
                    IconButton(
                      tooltip: 'Artikel bearbeiten',
                      icon: const Icon(Icons.edit_outlined),
                      onPressed: widget.catalog.canEdit ? () => edit(p) : null,
                    ),
                  ]),
                  onTap: widget.catalog.canEdit ? () => edit(p) : null,
                );
              },
            ),
          )),
          const SizedBox(height: 8),
          const Text('Lokaler Prototyp: Änderungen werden auf diesem Gerät gespeichert. Noch kein Kundenkonto.'),
        ]);
      },
    ),
  );
}
