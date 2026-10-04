import { Warehouse as PrismaWarehouse, Prisma } from '@prisma/client';

import {
    Warehouse,
    WarehouseProps,
    WarehouseStatus,
} from '../../../../domain/entities/warehouse/entity';
import { WarehouseCodeVO } from '../../../../domain/value-objects/warehouse-code.vo';

export class WarehouseMapper {
    static toDomain(raw: PrismaWarehouse): Warehouse {
        const props: WarehouseProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            branchId: raw.branchId,
            code: WarehouseCodeVO.create(raw.code),
            name: raw.name,
            description: raw.description,
            status: raw.status as WarehouseStatus,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            archivedAt: raw.archivedAt,
        };

        return Warehouse.rehydrate(props);
    }

    static toPersistence(entity: Warehouse): Prisma.WarehouseUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            branchId: entity.getBranchId(),
            code: entity.getCode().getValue(),
            name: entity.getName(),
            description: entity.getDescription(),
            status: entity.getStatus(),
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getUpdatedAt(),
            archivedAt: entity.getArchivedAt(),
        };
    }
}
