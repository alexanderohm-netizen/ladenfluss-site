class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.unit,
    required this.purchasePriceCents,
    required this.salePriceCents,
    required this.reorderPoint,
    this.barcode,
    this.active = true,
  });

  final String id;
  final String sku;
  final String name;
  final String unit;
  final String? barcode;
  final int purchasePriceCents;
  final int salePriceCents;
  final int reorderPoint;
  final bool active;

  bool get hasValidPrice => purchasePriceCents >= 0 && salePriceCents >= 0;
}
