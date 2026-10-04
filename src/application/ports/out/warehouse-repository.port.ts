import { Warehouse } from '../../../domain/entities/warehouse/entity';

export interface WarehouseRepositoryPort {
    save(warehouse: Warehouse): Promise<void>;
    findById(tenantId: string, id: string): Promise<Warehouse | null>;
    findByCode(tenantId: string, code: string): Promise<Warehouse | null>;
    findAll(
        tenantId: string,
        filter?: { onlyActive?: boolean; branchId?: string },
    ): Promise<Warehouse[]>;
}
