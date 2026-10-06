import 'package:flutter/material.dart';
import 'models/product.dart';

/// Reusable dialog for creating or editing a product.
class ProductEditorDialog extends StatefulWidget {
  const ProductEditorDialog({
    super.key,
    required this.existing,
    this.initial,
  });

  final List<Product> existing;
  final Product? initial;

  @override
  State<ProductEditorDialog> createState() => _ProductEditorDialogState();
}

class _ProductEditorDialogState extends State<ProductEditorDialog> {
  final form = GlobalKey<FormState>();
  late final TextEditingController sku;
  late final TextEditingController name;
  late final TextEditingController barcode;
  late final TextEditingController buy;
  late final TextEditingController sell;
  late final TextEditingController threshold;

  String formatCents(int amount) =>
      (amount / 100).toStringAsFixed(2).replaceAll('.', ',');

  @override
  void initState() {
    super.initState();
    final p = widget.initial;
    sku = TextEditingController(text: p?.sku ?? '');
    name = TextEditingController(text: p?.name ?? '');
    barcode = TextEditingController(text: p?.barcode ?? '');
    buy = TextEditingController(text: p == null ? '' : formatCents(p.purchasePriceCents));
    sell = TextEditingController(text: p == null ? '' : formatCents(p.salePriceCents));
    threshold = TextEditingController(text: (p?.reorderPoint ?? 5).toString());
  }

  int? parseCents(String raw) {
    final value = raw.trim();
    if (!RegExp(r'^\d+([,.]\d{1,2})?$').hasMatch(value)) return null;
    final parts = value.replaceAll(',', '.').split('.');
    final euros = int.tryParse(parts[0]);
    final remainder = parts.length > 1 ? int.tryParse(parts[1].padRight(2, '0')) : 0;
    if (euros == null || remainder == null) return null;
    return euros * 100 + remainder;
  }

  void submit() {
    if (!(form.currentState?.validate() ?? false)) return;
    final original = widget.initial;
    final product = Product(
      id: original?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
      sku: sku.text.trim(),
      name: name.text.trim(),
      unit: original?.unit ?? 'Stück',
      barcode: barcode.text.trim().isEmpty ? null : barcode.text.trim(),
      purchasePriceCents: parseCents(buy.text)!,
      salePriceCents: parseCents(sell.text)!,
      reorderPoint: int.parse(threshold.text.trim()),
      active: original?.active ?? true,
    );
    Navigator.pop(context, product);
  }

  @override
  void dispose() {
    for (final controller in [sku, name, barcode, buy, sell, threshold]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.initial == null ? 'Artikel anlegen' : 'Artikel bearbeiten'),
    content: SizedBox(
      width: 450,
      child: Form(
        key: form,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
              controller: sku,
              decoration: const InputDecoration(labelText: 'Artikelnummer *'),
              validator: (v) {
                final text = v?.trim() ?? '';
                if (text.isEmpty) return 'Bitte Artikelnummer eingeben';
                if (widget.existing.any((p) => p.id != widget.initial?.id && p.sku == text)) {
                  return 'Diese Artikelnummer ist schon vergeben';
                }
                return null;
              },
            ),
            TextFormField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Artikelname *'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Bitte Namen eingeben' : null,
            ),
            TextFormField(
              controller: barcode,
              decoration: const InputDecoration(labelText: 'Barcode (optional)'),
            ),
            TextFormField(
              controller: buy,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Einkaufspreis (€) *'),
              validator: (v) => parseCents(v ?? '') == null ? 'Gültigen Preis eingeben, z. B. 1,25' : null,
            ),
            TextFormField(
              controller: sell,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Verkaufspreis (€) *'),
              validator: (v) => parseCents(v ?? '') == null ? 'Gültigen Preis eingeben, z. B. 2,49' : null,
            ),
            TextFormField(
              controller: threshold,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Meldebestand (Stück) *'),
              validator: (v) {
                final count = int.tryParse(v?.trim() ?? '');
                return count == null || count < 0 ? 'Ganze Zahl ab 0 eingeben' : null;
              },
            ),
          ]),
        ),
      ),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Abbrechen')),
      FilledButton(onPressed: submit, child: const Text('Speichern')),
    ],
  );
}
