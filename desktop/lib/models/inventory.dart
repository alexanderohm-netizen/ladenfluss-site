enum MovementType { receipt, sale, adjustment, transferIn, transferOut, waste }

class InventoryMovement {
  const InventoryMovement({
    required this.id,
    required this.companyId,
    required this.branchId,
    required this.productId,
    required this.type,
    required this.quantityDelta,
    required this.createdAt,
    required this.actorId,
    required this.idempotencyKey,
    this.reason,
  });

  final String id;
  final String companyId;
  final String branchId;
  final String productId;
  final MovementType type;
  final int quantityDelta;
  final DateTime createdAt;
  final String actorId;
  final String idempotencyKey;
  final String? reason;
}

class StockLevel {
  const StockLevel({required this.productId, required this.branchId, required this.quantity});
  final String productId;
  final String branchId;
  final int quantity;
}
