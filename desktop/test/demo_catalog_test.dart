import 'package:flutter_test/flutter_test.dart';
import 'package:ladenfluss_wws/demo_catalog.dart';
import 'package:ladenfluss_wws/local_catalog_store.dart';
import 'package:ladenfluss_wws/models/product.dart';
import 'package:ladenfluss_wws/models/inventory.dart';

class MemoryCatalogStore implements CatalogStore {
  bool failReading = false;
  int writeCount = 0;
  final snapshots = <List<Product>>[];

  @override
  Future<Map<String, dynamic>?> read() async {
    if (failReading) throw const FormatException('Corrupted test file');
    return null;
  }

  @override
  Future<void> write({
    required List<Product> products,
    required List<InventoryMovement> movements,
    required Map<String, int> openingStock,
  }) async {
    writeCount++;
    // The first save is intentionally slow; later requests must not overtake it.
    if (writeCount == 1) await Future<void>.delayed(const Duration(milliseconds: 25));
    snapshots.add(List<Product>.of(products));
  }
}

Product item(String id, String sku, {int point = 2}) => Product(
  id: id, sku: sku, name: 'Testartikel $sku', unit: 'Stück',
  purchasePriceCents: 100, salePriceCents: 200, reorderPoint: point,
);

void main() {
  test('Artikelanlage und Bearbeitung erhalten stabile IDs', () async {
    final store = MemoryCatalogStore();
    final catalog = DemoCatalog(store: store);
    await catalog.load();

    catalog.addProduct(item('new', '900'));
    expect(catalog.products.last.id, 'new');
    expect(() => catalog.addProduct(item('again', '900')), throwsStateError);

    catalog.updateProduct(item('new', '901'));
    expect(catalog.products.last.sku, '901');
    expect(catalog.products.last.id, 'new');
    expect(() => catalog.updateProduct(item('new', '10001')), throwsStateError);

    await catalog.pendingSave;
    expect(store.snapshots.last.last.sku, '901');
    catalog.dispose();
  });

  test('Wareneingang, Verkauf und Abschrift buchen nachvollziehbar', () async {
    final catalog = DemoCatalog(store: MemoryCatalogStore());
    await catalog.load();

    expect(catalog.stock('demo1'), 7);
    catalog.book(productId: 'demo1', delta: 8,
      type: MovementType.receipt, reason: 'Lieferschein 123');
    catalog.book(productId: 'demo1', delta: -3,
      type: MovementType.sale, reason: 'Kassenabschluss');
    expect(catalog.stock('demo1'), 12);
    expect(catalog.movements.length, 2);
    expect(catalog.movements.first.reason, 'Kassenabschluss');
    expect(() => catalog.book(productId: 'demo1', delta: -13,
      type: MovementType.waste, reason: 'Abschrift'), throwsStateError);
    expect(() => catalog.book(productId: 'demo1', delta: -1,
      type: MovementType.receipt, reason: 'Ungültig'), throwsStateError);
    expect(catalog.stock('demo1'), 12);

    await catalog.pendingSave;
    catalog.dispose();
  });

  test('Meldebestand wird live aus Bestand und Grenzwert berechnet', () async {
    final catalog = DemoCatalog(store: MemoryCatalogStore());
    await catalog.load();
    expect(catalog.lowStock.any((p) => p.id == 'demo1'), isTrue);
    expect(catalog.lowStock.any((p) => p.id == 'demo2'), isFalse);
    catalog.book(productId: 'demo1', delta: 10,
      type: MovementType.receipt, reason: 'Nachlieferung');
    expect(catalog.lowStock.any((p) => p.id == 'demo1'), isFalse);
    await catalog.pendingSave;
    catalog.dispose();
  });

  test('Schnelle Änderungen schreiben den neuesten Snapshot zuletzt', () async {
    final store = MemoryCatalogStore();
    final catalog = DemoCatalog(store: store);
    await catalog.load();
    catalog.addProduct(item('a', '901'));
    catalog.addProduct(item('b', '902'));
    catalog.addProduct(item('c', '903'));

    await catalog.pendingSave;
    expect(store.snapshots.length, 3);
    expect(store.snapshots.last.map((p) => p.id), containsAll(['a', 'b', 'c']));
    catalog.dispose();
  });

  test('Lesefehler sperrt Buchungen und verhindert Überschreiben', () async {
    final store = MemoryCatalogStore()..failReading = true;
    final catalog = DemoCatalog(store: store);
    await catalog.load();

    expect(catalog.loadFailed, true);
    expect(catalog.canEdit, false);
    expect(catalog.storageError, isNotNull);
    expect(() => catalog.addProduct(item('new', '900')), throwsStateError);
    expect(() => catalog.book(productId: 'demo1', delta: 1,
      type: MovementType.receipt, reason: 'Test'), throwsStateError);
    await catalog.pendingSave;
    expect(store.writeCount, 0);
    catalog.dispose();
  });
}
