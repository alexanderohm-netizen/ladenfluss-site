import 'package:flutter/foundation.dart';
import 'models/product.dart';
import 'models/inventory.dart';

/// In-memory demo state. Replace with authenticated, transactional backend.
class DemoCatalog extends ChangeNotifier {
  final products = <Product>[
    const Product(id: 'demo1', sku: '10001', name: 'Haferdrink 1 L', unit: 'Stück', purchasePriceCents: 109, salePriceCents: 199, reorderPoint: 12),
    const Product(id: 'demo2', sku: '10002', name: 'Kaffee 500 g', unit: 'Stück', purchasePriceCents: 349, salePriceCents: 599, reorderPoint: 8),
  ];
  final movements = <InventoryMovement>[];
  final Map<String, int> openingStock = {'demo1': 7, 'demo2': 24};
  static const branchId = 'demo-branch';
  static const companyId = 'demo-company';

  int stock(String productId) => (openingStock[productId] ?? 0) +
      movements.where((m) => m.productId == productId && m.branchId == branchId)
          .fold<int>(0, (sum, m) => sum + m.quantityDelta);

  void addProduct(Product product) {
    if (products.any((p) => p.sku == product.sku)) throw StateError('Artikelnummer bereits vorhanden');
    products.add(product);
    notifyListeners();
  }

  void book({required String productId, required int delta, required MovementType type, required String reason}) {
    if (!products.any((p) => p.id == productId)) throw StateError('Artikel nicht gefunden');
    if (delta == 0) throw StateError('Menge darf nicht null sein');
    if (delta < 0 && stock(productId) + delta < 0) throw StateError('Nicht genügend Bestand');
    if ((type == MovementType.receipt || type == MovementType.transferIn) && delta < 0) throw StateError('Zugang muss positiv sein');
    if ((type == MovementType.sale || type == MovementType.waste || type == MovementType.transferOut) && delta > 0) throw StateError('Abgang muss negativ sein');
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    movements.insert(0, InventoryMovement(
      id: id, companyId: companyId, branchId: branchId, productId: productId,
      type: type, quantityDelta: delta, createdAt: DateTime.now(),
      actorId: 'demo-user', idempotencyKey: id, reason: reason.trim(),
    ));
    notifyListeners();
  }

  List<Product> get lowStock => products.where((p) => stock(p.id) <= p.reorderPoint).toList();
}
