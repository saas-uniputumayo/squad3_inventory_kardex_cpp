import {
    InventoryMovement as PrismaInventoryMovement,
    InventoryMovementLine as PrismaInventoryMovementLine,
    Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';

import {
    InventoryMovement,
    InventoryMovementProps,
} from '../../../../domain/entities/inventory-movement/entity';
import {
    InventoryMovementLine,
    InventoryMovementLineProps,
} from '../../../../domain/entities/inventory-movement/line.entity';
import { MovementSource, MovementStatus, MovementType, ReferenceType } from '../../../../domain/types';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { MovementReferenceVO } from '../../../../domain/value-objects/movement-reference.vo';
import { QuantityRules, QuantityVO } from '../../../../domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../../../domain/value-objects/unit-cost.vo';

export type RawMovementWithLines = PrismaInventoryMovement & {
    lines?: (PrismaInventoryMovementLine & {
        unitOfMeasure?: {
            decimalPlaces: number;
        };
    })[];
};

export class InventoryMovementMapper {
    static toDomain(raw: RawMovementWithLines): InventoryMovement {
        const referenceType = (raw.referenceType ?? ReferenceType.OTHER) as ReferenceType;
        const referenceId = raw.referenceId ?? raw.referenceDocument ?? undefined;
        const reference = MovementReferenceVO.create(referenceType, referenceId);

        const movementProps: InventoryMovementProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            warehouseId: raw.warehouseId,
            type: raw.type as MovementType,
            status: raw.status as MovementStatus,
            source: raw.source as MovementSource,
            reference,
            notes: raw.reason ?? undefined,
            occurredAt: raw.createdAt,
            createdAt: raw.createdAt,
            postedAt: raw.postedAt ?? undefined,
            reversedAt: raw.reversedAt ?? undefined,
            reversalMovementId: raw.reversesMovementId ?? undefined,
        };

        const domainLines = (raw.lines ?? []).map((rawLine, index) => {
            const decimalPlaces = rawLine.unitOfMeasure?.decimalPlaces ?? 3;
            const allowsFraction = decimalPlaces > 0;
            const currency = 'COP';

            const rules: QuantityRules = {
                unitOfMeasureId: rawLine.unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
            };

            const lineProps: InventoryMovementLineProps = {
                id: rawLine.id,
                movementId: rawLine.movementId,
                productId: rawLine.productId,
                variantId: rawLine.variantId,
                unitOfMeasureId: rawLine.unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
                currency,
                quantity: QuantityVO.create(new Decimal(rawLine.quantity.toString()), rules),
                unitCost: UnitCostVO.create(new Decimal(rawLine.unitCost.toString()), currency),
                totalCost: MoneyVO.create(new Decimal(rawLine.totalCost.toString()), currency),
                lineNumber: rawLine.lineNumber ?? index + 1,
                createdAt: rawLine.createdAt,
            };

            return InventoryMovementLine.rehydrate(lineProps);
        });

        return InventoryMovement.rehydrate(movementProps, domainLines);
    }

    static toPersistence(entity: InventoryMovement): Prisma.InventoryMovementUncheckedCreateInput {
        const refType = entity.getReference().getType();
        const refId = entity.getReference().getId();

        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            warehouseId: entity.getWarehouseId(),
            type: entity.getType(),
            status: entity.getStatus(),
            source: entity.getSource(),
            referenceType: refType,
            referenceId: refId && refId.length === 36 ? refId : null,
            referenceDocument: entity.getReference().toString(),
            reason: entity.getNotes() ?? null,
            reversesMovementId: entity.getReversalMovementId() ?? null,
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getCreatedAt(),
            postedAt: entity.getPostedAt() ?? null,
            reversedAt: entity.getReversedAt() ?? null,
        };
    }

    static toLinePersistence(
        line: InventoryMovementLine,
        tenantId: string,
        index: number,
    ): Prisma.InventoryMovementLineUncheckedCreateInput {
        return {
            id: line.getId(),
            tenantId,
            movementId: line.getMovementId(),
            lineNumber: line.getLineNumber() ?? index + 1,
            productId: line.getProductId(),
            variantId: line.getVariantId(),
            unitOfMeasureId: line.getUnitOfMeasureId(),
            quantity: new Prisma.Decimal(line.getQuantity().getAmount().toString()),
            unitCost: new Prisma.Decimal(line.getUnitCost().getAmount().toString()),
            totalCost: new Prisma.Decimal(line.getTotalCost().getAmount().toString()),
            previousQuantity: new Prisma.Decimal(0),
            newQuantity: new Prisma.Decimal(0),
            averageCostBefore: new Prisma.Decimal(0),
            averageCostAfter: new Prisma.Decimal(0),
            inventoryValueBefore: new Prisma.Decimal(0),
            inventoryValueAfter: new Prisma.Decimal(0),
            createdAt: line.getCreatedAt(),
        };
    }
}
