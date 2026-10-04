import { MovementType, ReferenceType } from '../../../domain/types';

export interface GetKardexQuery {
    tenantId: string;
    productId: string;
    variantId?: string;
    warehouseId?: string;
    from?: Date;
    to?: Date;
    movementType?: MovementType;
    page?: number;
    limit?: number;
}

export interface KardexEntryResult {
    id: string;
    sequence: string | null;
    date: Date;
    movementId: string;
    movementType: MovementType;
    referenceType?: ReferenceType;
    referenceDocument?: string;
    quantityIn: string;
    quantityOut: string;
    quantityBalance: string;
    unitCost: string;
    averageCost: string;
    inventoryValue: string;
}

export interface KardexResult {
    product: {
        id: string;
        sku: string;
        name: string;
        unitOfMeasure: string;
    };
    warehouse?: {
        id: string;
        name: string;
    };
    entries: KardexEntryResult[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface GetKardexUseCase {
    execute(query: GetKardexQuery): Promise<KardexResult>;
}
