import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'models/product.dart';
import 'models/inventory.dart';

/// Local prototype storage. Not encrypted, synced, or suitable for multi-user production.
class LocalCatalogStore {
  Future<File> get _file async {
    final dir = await getApplicationSupportDirectory();
    final folder = Directory('${dir.path}${Platform.pathSeparator}ladenfluss_wws');
    if (!await folder.exists()) await folder.create(recursive: true);
    return File('${folder.path}${Platform.pathSeparator}catalog-v1.json');
  }

  Future<Map<String, dynamic>?> read() async {
    final file = await _file;
    if (!await file.exists()) return null;
    final decoded = jsonDecode(await file.readAsString());
    if (decoded is! Map<String, dynamic> || decoded['version'] != 1) {
      throw const FormatException('Unbekanntes Datenformat');
    }
    return decoded;
  }

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
