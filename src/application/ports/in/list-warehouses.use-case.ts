import { WarehouseStatus } from '../../../domain/types';

export interface ListWarehousesQuery {
    tenantId: string;
    onlyActive?: boolean;
    branchId?: string;
}

export interface WarehouseListItemResult {
    id: string;
    code: string;
    name: string;
    description: string | null;
    branchId: string;
    status: WarehouseStatus;
    isActive: boolean;
}

export interface ListWarehousesUseCase {
    execute(query: ListWarehousesQuery): Promise<WarehouseListItemResult[]>;
}
