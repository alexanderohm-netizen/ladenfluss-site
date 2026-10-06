import 'package:flutter/foundation.dart';
import 'models/product.dart';
import 'models/inventory.dart';
import 'local_catalog_store.dart';

/// Local-first prototype state. No login, tenant isolation or cloud sync yet.
class DemoCatalog extends ChangeNotifier {
  DemoCatalog({CatalogStore? store}) : _store = store ?? LocalCatalogStore();

  final CatalogStore _store;
  Future<void> _writeTail = Future<void>.value();
  bool _disposed = false;
  bool loaded = false;
  bool loadFailed = false;
  String? storageError;

  final products = <Product>[
    const Product(id: 'demo1', sku: '10001', name: 'Haferdrink 1 L',
      unit: 'Stück', purchasePriceCents: 109, salePriceCents: 199, reorderPoint: 12),
    const Product(id: 'demo2', sku: '10002', name: 'Kaffee 500 g',
      unit: 'Stück', purchasePriceCents: 349, salePriceCents: 599, reorderPoint: 8),
  ];
  final movements = <InventoryMovement>[];
  final openingStock = <String, int>{'demo1': 7, 'demo2': 24};

  static const branchId = 'demo-branch';
  static const companyId = 'demo-company';
  bool get canEdit => loaded && !loadFailed;
  Future<void> get pendingSave => _writeTail;

  void _changed() { if (!_disposed) notifyListeners(); }

  Future<void> load() async {
    if (loaded) return;
    try {
      final data = await _store.read();
      if (data != null) {
        final parsedProducts = (data['products'] as List).map((raw) {
          final p = raw as Map<String, dynamic>;
          return Product(
            id: p['id'] as String, sku: p['sku'] as String, name: p['name'] as String,
            unit: p['unit'] as String, barcode: p['barcode'] as String?,
            purchasePriceCents: p['purchasePriceCents'] as int,
            salePriceCents: p['salePriceCents'] as int,
            reorderPoint: p['reorderPoint'] as int, active: p['active'] as bool? ?? true,
          );
        }).toList();
        final parsedMovements = (data['movements'] as List).map((raw) {
          final m = raw as Map<String, dynamic>;
          return InventoryMovement(
            id: m['id'] as String, companyId: m['companyId'] as String,
            branchId: m['branchId'] as String, productId: m['productId'] as String,
            type: MovementType.values.byName(m['type'] as String),
            quantityDelta: m['quantityDelta'] as int,
            createdAt: DateTime.parse(m['createdAt'] as String),
            actorId: m['actorId'] as String,
            idempotencyKey: m['idempotencyKey'] as String,
            reason: m['reason'] as String?,
          );
        }).toList();
        final parsedOpening = (data['openingStock'] as Map<String, dynamic>)
            .map((key, value) => MapEntry(key, value as int));

        // Replace existing state only after *all* stored data was parsed.
        products..clear()..addAll(parsedProducts);
        movements..clear()..addAll(parsedMovements);
        openingStock..clear()..addAll(parsedOpening);
      }
      storageError = null;
      loadFailed = false;
    } catch (error) {
      // Never overwrite an unreadable file with fresh demo data.
      loadFailed = true;
      storageError = 'Datei konnte nicht gelesen werden. Bearbeitung gesperrt, um Datenverlust zu vermeiden: $error';
    } finally {
      loaded = true;
      _changed();
    }
  }

  Future<void> save() {
    if (!canEdit) return Future<void>.value();

    // Capture immutable snapshots *before* asynchronous IO starts.
    final productSnapshot = List<Product>.of(products);
    final movementSnapshot = List<InventoryMovement>.of(movements);
    final openingSnapshot = Map<String, int>.of(openingStock);
    // Serialized writes prevent an older snapshot from overwriting a newer one.
    _writeTail = _writeTail.then((_) async {
      try {
        await _store.write(
          products: productSnapshot, movements: movementSnapshot,
          openingStock: openingSnapshot,
        );
        storageError = null;
      } catch (error) {
        storageError = 'Speichern fehlgeschlagen. Daten sind nur im Speicher: $error';
      }
      _changed();
    });
    return _writeTail;
  }

  void _requireEditable() {
    if (!canEdit) throw StateError('Daten werden geladen oder sind geschützt.');
  }

  int stock(String productId) => (openingStock[productId] ?? 0) +
      movements.where((m) => m.productId == productId && m.branchId == branchId)
          .fold<int>(0, (sum, m) => sum + m.quantityDelta);

  void addProduct(Product product) {
    _requireEditable();
    _validateProduct(product);
    if (products.any((p) => p.id == product.id || p.sku == product.sku)) {
      throw StateError('Artikel-ID oder Artikelnummer bereits vorhanden.');
    }
    products.add(product);
    _changed();
    save();
  }

  void updateProduct(Product replacement) {
    _requireEditable();
    _validateProduct(replacement);
    final index = products.indexWhere((p) => p.id == replacement.id);
    if (index < 0) throw StateError('Artikel nicht gefunden.');
    if (products.any((p) => p.id != replacement.id && p.sku == replacement.sku)) {
      throw StateError('Artikelnummer bereits vergeben.');
    }
    products[index] = replacement;
    _changed();
    save();
  }

  void _validateProduct(Product p) {
    if (p.name.trim().isEmpty || p.sku.trim().isEmpty || p.unit.trim().isEmpty) {
      throw StateError('Name, Artikelnummer und Einheit sind erforderlich.');
    }
    if (!p.hasValidPrice || p.reorderPoint < 0) {
      throw StateError('Preise und Meldebestand dürfen nicht negativ sein.');
    }
  }

  void book({
    required String productId,
    required int delta,
    required MovementType type,
    required String reason,
  }) {
    _requireEditable();
    if (!products.any((p) => p.id == productId && p.active)) {
      throw StateError('Aktiver Artikel nicht gefunden.');
    }
    if (delta == 0) throw StateError('Menge darf nicht null sein.');
    if (reason.trim().isEmpty) throw StateError('Grund ist erforderlich.');
    if (delta < 0 && stock(productId) + delta < 0) {
      throw StateError('Nicht genügend Bestand.');
    }
    if ((type == MovementType.receipt || type == MovementType.transferIn) && delta < 0) {
      throw StateError('Zugang muss positiv sein.');
    }
    if ((type == MovementType.sale || type == MovementType.waste ||
         type == MovementType.transferOut) && delta > 0) {
      throw StateError('Abgang muss negativ sein.');
    }
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    movements.insert(0, InventoryMovement(
      id: id, companyId: companyId, branchId: branchId, productId: productId,
      type: type, quantityDelta: delta, createdAt: DateTime.now(),
      actorId: 'demo-user', idempotencyKey: id, reason: reason.trim(),
    ));
    _changed();
    save();
  }

  List<Product> get lowStock => products.where((p) =>
      p.active && stock(p.id) <= p.reorderPoint).toList();

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
