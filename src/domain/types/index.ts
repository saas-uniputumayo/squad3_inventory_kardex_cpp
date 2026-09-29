export enum MovementType {
    PURCHASE_RECEIPT = 'PURCHASE_RECEIPT',
    SALE_DISPATCH = 'SALE_DISPATCH',
    TRANSFER_IN = 'TRANSFER_IN',
    TRANSFER_OUT = 'TRANSFER_OUT',
    SHRINKAGE_LOSS = 'SHRINKAGE_LOSS',
    DAMAGE_LOSS = 'DAMAGE_LOSS',
    ADJUSTMENT_IN = 'ADJUSTMENT_IN',
    ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
    CUSTOMER_RETURN = 'CUSTOMER_RETURN',
    SUPPLIER_RETURN = 'SUPPLIER_RETURN',
    VOID_RETURN = 'VOID_RETURN',
}

export enum MovementStatus {
    DRAFT = 'DRAFT',
    POSTED = 'POSTED',
    REVERSED = 'REVERSED',
}

export enum MovementSource {
    POS = 'POS',
    PURCHASE = 'PURCHASE',
    TRANSFER = 'TRANSFER',
    ADJUSTMENT = 'ADJUSTMENT',
    STOCK_COUNT = 'STOCK_COUNT',
    RETURN = 'RETURN',
    SYSTEM = 'SYSTEM',
}

export enum ReferenceType {
    POS_SALE = 'POS_SALE',
    POS_VOID = 'POS_VOID',
    PURCHASE = 'PURCHASE',
    PURCHASE_RETURN = 'PURCHASE_RETURN',
    TRANSFER = 'TRANSFER',
    STOCK_COUNT = 'STOCK_COUNT',
    MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
    CUSTOMER_RETURN = 'CUSTOMER_RETURN',
    SUPPLIER_RETURN = 'SUPPLIER_RETURN',
    OTHER = 'OTHER',
}

export enum TransferStatus {
    DRAFT = 'DRAFT',
    IN_TRANSIT = 'IN_TRANSIT',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    REVERSED = 'REVERSED',
}

export enum StockCountStatus {
    DRAFT = 'DRAFT',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum StockCountLineStatus {
    PENDING = 'PENDING',
    COUNTED = 'COUNTED',
    APPLIED = 'APPLIED',
    CANCELLED = 'CANCELLED',
}

export enum ProductType {
    STOCKABLE = 'STOCKABLE',
    SERVICE = 'SERVICE',
}

export enum ProductStructure {
    SIMPLE = 'SIMPLE',
    WITH_VARIANTS = 'WITH_VARIANTS',
}

export enum ProductStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED',
}

export enum ProductVariantStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED',
}

export enum WarehouseStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED',
}

export enum CostMethod {
    WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
}

export enum AdjustmentReason {
    INITIAL_STOCK = 'INITIAL_STOCK',
    STOCK_COUNT = 'STOCK_COUNT',
    DAMAGE = 'DAMAGE',
    LOSS = 'LOSS',
    FOUND = 'FOUND',
    CORRECTION = 'CORRECTION',
    OTHER = 'OTHER',
}
