import 'package:flutter/material.dart';
import 'models/product.dart';

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});
  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  final products = <Product>[
    const Product(id: 'demo1', sku: '10001', name: 'Haferdrink 1 L', unit: 'Stück', purchasePriceCents: 109, salePriceCents: 199, reorderPoint: 12),
    const Product(id: 'demo2', sku: '10002', name: 'Kaffee 500 g', unit: 'Stück', purchasePriceCents: 349, salePriceCents: 599, reorderPoint: 8),
  ];
  String search = '';
  String price(int cents) => '${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')} €';
  int? cents(String input) {
    final value = input.trim();
    if (!RegExp(r'^\d+([,.]\d{1,2})?$').hasMatch(value)) return null;
    final parts = value.replaceAll(',', '.').split('.');
    return int.parse(parts.first) * 100 + (parts.length > 1 ? int.parse(parts.last.padRight(2, '0')) : 0);
  }

  Future<void> add() async {
    final sku = TextEditingController(), name = TextEditingController(),
      buy = TextEditingController(), sell = TextEditingController(),
      threshold = TextEditingController(text: '5');
    final form = GlobalKey<FormState>();
    final saved = await showDialog<bool>(context: context, builder: (dialog) => AlertDialog(
      title: const Text('Artikel anlegen'),
      content: SizedBox(width: 420, child: Form(key: form, child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextFormField(controller: sku, decoration: const InputDecoration(labelText: 'Artikelnummer'),
            validator: (v) => v == null || v.trim().isEmpty ? 'Bitte Nummer eingeben' : products.any((p) => p.sku == v.trim()) ? 'Nummer schon vorhanden' : null),
          TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Artikelname'),
            validator: (v) => v == null || v.trim().isEmpty ? 'Bitte Namen eingeben' : null),
          TextFormField(controller: buy, decoration: const InputDecoration(labelText: 'Einkaufspreis (€)'),
            validator: (v) => cents(v ?? '') == null ? 'Gültigen Preis eingeben' : null),
          TextFormField(controller: sell, decoration: const InputDecoration(labelText: 'Verkaufspreis (€)'),
            validator: (v) => cents(v ?? '') == null ? 'Gültigen Preis eingeben' : null),
          TextFormField(controller: threshold, decoration: const InputDecoration(labelText: 'Meldebestand (Stück)'),
            validator: (v) { final n = int.tryParse(v ?? ''); return n == null || n < 0 ? 'Gültige Menge eingeben' : null; }),
        ]),
      ))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Abbrechen')),
        FilledButton(onPressed: () { if (form.currentState!.validate()) Navigator.pop(dialog, true); }, child: const Text('Speichern')),
      ],
    ));
    if (saved == true && mounted) setState(() => products.add(Product(
      id: DateTime.now().microsecondsSinceEpoch.toString(), sku: sku.text.trim(),
      name: name.text.trim(), unit: 'Stück', purchasePriceCents: cents(buy.text)!,
      salePriceCents: cents(sell.text)!, reorderPoint: int.parse(threshold.text),
    )));
    for (final field in [sku, name, buy, sell, threshold]) { field.dispose(); }
  }

  @override
  Widget build(BuildContext context) {
    final visible = products.where((p) => p.name.toLowerCase().contains(search) || p.sku.toLowerCase().contains(search)).toList();
    return Expanded(child: Column(children: [
      Row(children: [
        Expanded(child: TextField(decoration: const InputDecoration(
          border: OutlineInputBorder(), prefixIcon: Icon(Icons.search), hintText: 'Artikel suchen'),
          onChanged: (v) => setState(() => search = v.toLowerCase().trim()))),
        const SizedBox(width: 12),
        FilledButton.icon(onPressed: add, icon: const Icon(Icons.add), label: const Text('Artikel anlegen')),
      ]),
      const SizedBox(height: 16),
      Expanded(child: Card(child: ListView(children: [
        for (final p in visible) ListTile(
          title: Text(p.name), subtitle: Text('Nr. ${p.sku} · Meldebestand ${p.reorderPoint}'),
          trailing: Text('EK ${price(p.purchasePriceCents)} · VK ${price(p.salePriceCents)}')),
        if (visible.isEmpty) const ListTile(title: Text('Keine passenden Artikel gefunden')),
      ]))),
      const Text('Demo: Neue Artikel werden noch nicht dauerhaft gespeichert.'),
    ]));
  }
}
