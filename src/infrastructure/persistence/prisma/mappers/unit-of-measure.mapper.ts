import { UnitOfMeasure as PrismaUnitOfMeasure, Prisma } from '@prisma/client';

import {
    UnitOfMeasure,
    UnitOfMeasureProps,
    UnitOfMeasureStatus,
    UnitType,
} from '../../../../domain/entities/unit-of-measure/entity';
import { UnitOfMeasureCodeVO } from '../../../../domain/value-objects/unit-of-measure-code.vo';

export class UnitOfMeasureMapper {
    static toDomain(raw: PrismaUnitOfMeasure): UnitOfMeasure {
        const props: UnitOfMeasureProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            code: UnitOfMeasureCodeVO.create(raw.code),
            name: raw.name,
            type: raw.unitType as UnitType,
            allowsFraction: raw.decimalPlaces > 0,
            decimalPlaces: raw.decimalPlaces,
            status: raw.isActive
                ? UnitOfMeasureStatus.ACTIVE
                : UnitOfMeasureStatus.INACTIVE,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };

        return UnitOfMeasure.rehydrate(props);
    }

    static toPersistence(entity: UnitOfMeasure): Prisma.UnitOfMeasureUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            code: entity.getCode().getValue(),
            name: entity.getName(),
            symbol: entity.getCode().getValue().slice(0, 10),
            unitType: entity.getType(),
            decimalPlaces: entity.getDecimalPlaces(),
            isActive: entity.getStatus() === UnitOfMeasureStatus.ACTIVE,
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getUpdatedAt(),
        };
    }
}
