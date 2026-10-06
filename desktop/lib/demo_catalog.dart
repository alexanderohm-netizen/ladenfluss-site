import 'package:flutter/foundation.dart';
import 'models/product.dart';
import 'models/inventory.dart';
import 'local_catalog_store.dart';

/// In-memory demo state. Replace with authenticated, transactional backend.
class DemoCatalog extends ChangeNotifier {
  final LocalCatalogStore _store = LocalCatalogStore();
  String? storageError;
  bool loaded = false;

  Future<void> load() async {
    try {
      final data = await _store.read();
      if (data != null) {
        final parsedProducts = (data['products'] as List).map((raw) {
          final p = raw as Map<String, dynamic>;
          return Product(id: p['id'] as String, sku: p['sku'] as String,
            name: p['name'] as String, unit: p['unit'] as String,
            barcode: p['barcode'] as String?, purchasePriceCents: p['purchasePriceCents'] as int,
            salePriceCents: p['salePriceCents'] as int, reorderPoint: p['reorderPoint'] as int,
            active: p['active'] as bool? ?? true);
        }).toList();
        final parsedMovements = (data['movements'] as List).map((raw) {
          final m = raw as Map<String, dynamic>;
          return InventoryMovement(id: m['id'] as String,
            companyId: m['companyId'] as String, branchId: m['branchId'] as String,
            productId: m['productId'] as String,
            type: MovementType.values.byName(m['type'] as String),
            quantityDelta: m['quantityDelta'] as int,
            createdAt: DateTime.parse(m['createdAt'] as String),
            actorId: m['actorId'] as String, idempotencyKey: m['idempotencyKey'] as String,
            reason: m['reason'] as String?);
        }).toList();
        final parsedOpening = (data['openingStock'] as Map<String, dynamic>).map(
          (key, value) => MapEntry(key, value as int));
        products..clear()..addAll(parsedProducts);
        movements..clear()..addAll(parsedMovements);
        openingStock..clear()..addAll(parsedOpening);
      }
      storageError = null;
    } catch (e) {
      storageError = 'Lokale Daten konnten nicht geladen werden: $e';
    } finally {
      loaded = true;
      notifyListeners();
    }
  }

  Future<void> save() async {
    try {
      await _store.write(products: products, movements: movements, openingStock: openingStock);
      storageError = null;
    } catch (e) {
      storageError = 'Speichern fehlgeschlagen: $e';
    }
    notifyListeners();
  }

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
    save();
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
    save();
  }

  List<Product> get lowStock => products.where((p) => stock(p.id) <= p.reorderPoint).toList();
}
