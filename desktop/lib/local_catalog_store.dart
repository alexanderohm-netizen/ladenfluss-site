import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'models/product.dart';
import 'models/inventory.dart';

/// Storage contract enables isolated tests and alternative backends.
abstract class CatalogStore {
  Future<Map<String, dynamic>?> read();
  Future<void> write({
    required List<Product> products,
    required List<InventoryMovement> movements,
    required Map<String, int> openingStock,
  });
}

/// Local prototype storage. Not encrypted, synced, or suitable for multi-user production.
class LocalCatalogStore implements CatalogStore {
  Future<File> get _file async {
    final dir = await getApplicationSupportDirectory();
    final folder = Directory('${dir.path}${Platform.pathSeparator}ladenfluss_wws');
    if (!await folder.exists()) await folder.create(recursive: true);
    return File('${folder.path}${Platform.pathSeparator}catalog-v1.json');
  }

  @override
  Future<Map<String, dynamic>?> read() async {
    final file = await _file;
    if (!await file.exists()) {
      // An interrupted save may have left only the backup.
      final backup = File('${file.path}.bak');
      if (!await backup.exists()) return null;
      return _readFile(backup);
    }
    return _readFile(file);
  }

  Future<Map<String, dynamic>> _readFile(File file) async {
    final decoded = jsonDecode(await file.readAsString());
    if (decoded is! Map<String, dynamic> || decoded['version'] != 1) {
      throw const FormatException('Unbekanntes Datenformat');
    }
    return decoded;
  }

  @override
  Future<void> write({
    required List<Product> products,
    required List<InventoryMovement> movements,
    required Map<String, int> openingStock,
  }) async {
    final file = await _file;
    final payload = jsonEncode({
      'version': 1,
      'products': [
        for (final p in products) {
          'id': p.id, 'sku': p.sku, 'name': p.name, 'unit': p.unit,
          'barcode': p.barcode, 'purchasePriceCents': p.purchasePriceCents,
          'salePriceCents': p.salePriceCents, 'reorderPoint': p.reorderPoint,
          'active': p.active,
        },
      ],
      'openingStock': openingStock,
      'movements': [
        for (final m in movements) {
          'id': m.id, 'companyId': m.companyId, 'branchId': m.branchId,
          'productId': m.productId, 'type': m.type.name,
          'quantityDelta': m.quantityDelta, 'createdAt': m.createdAt.toIso8601String(),
          'actorId': m.actorId, 'idempotencyKey': m.idempotencyKey,
          'reason': m.reason,
        },
      ],
    });
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(payload, flush: true);
    if (await file.exists()) {
      final backup = File('${file.path}.bak');
      if (await backup.exists()) await backup.delete();
      await file.rename(backup.path);
      try {
        await temp.rename(file.path);
      } catch (_) {
        await backup.rename(file.path);
        rethrow;
      }
    } else {
      await temp.rename(file.path);
    }
  }
}
