import { InventoryLedgerEntry as PrismaInventoryLedgerEntry, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    InventoryLedgerEntry,
    InventoryLedgerEntryProps,
} from '../../../../domain/entities/inventory-ledger-entry/entity';
import { MovementSource, MovementType, ReferenceType } from '../../../../domain/types';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { QuantityRules, QuantityVO } from '../../../../domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../../../domain/value-objects/unit-cost.vo';

export type RawLedgerEntryRecord = PrismaInventoryLedgerEntry & {
    movementLineId?: string | null;
    unitOfMeasureId?: string | null;
    allowsFraction?: boolean | null;
    decimalPlaces?: number | null;
    source?: MovementSource | null;
    currency?: string | null;
    variant?: {
        unitOfMeasureId: string;
        unitOfMeasure?: {
            decimalPlaces: number;
        };
    } | null;
    movement?: {
        source: MovementSource;
    } | null;
};

export class InventoryLedgerMapper {
    static toDomain(raw: RawLedgerEntryRecord): InventoryLedgerEntry {
        const unitOfMeasureId =
            raw.unitOfMeasureId ??
            raw.variant?.unitOfMeasureId ??
            '00000000-0000-0000-0000-000000000000';

        const decimalPlaces =
            raw.decimalPlaces ??
            raw.variant?.unitOfMeasure?.decimalPlaces ??
            3;

        const allowsFraction =
            raw.allowsFraction ??
            decimalPlaces > 0;

        const currency = (raw.currency ?? 'COP').trim().toUpperCase();

        const rules: QuantityRules = {
            unitOfMeasureId,
            allowsFraction,
            decimalPlaces,
        };

        const qtyInDec = new Decimal(raw.quantityIn.toString());
        const qtyOutDec = new Decimal(raw.quantityOut.toString());

        const quantityIn = qtyInDec.isPositive() && !qtyInDec.isZero()
            ? QuantityVO.create(qtyInDec, rules)
            : undefined;

        const quantityOut = qtyOutDec.isPositive() && !qtyOutDec.isZero()
            ? QuantityVO.create(qtyOutDec, rules)
            : undefined;

        const unitCost = UnitCostVO.create(new Decimal(raw.unitCost.toString()), currency);
        const totalValue = MoneyVO.create(new Decimal(raw.costDelta.abs().toString()), currency);

        const balanceQuantity = QuantityVO.create(new Decimal(raw.quantityBalance.toString()), rules);
        const balanceAverageCost = UnitCostVO.create(new Decimal(raw.averageCostAfter.toString()), currency);
        const balanceValue = MoneyVO.create(new Decimal(raw.inventoryValueAfter.toString()), currency);

        const averageCostBefore = UnitCostVO.create(new Decimal(raw.averageCostBefore.toString()), currency);
        const averageCostAfter = UnitCostVO.create(new Decimal(raw.averageCostAfter.toString()), currency);
        const inventoryValueBefore = MoneyVO.create(new Decimal(raw.inventoryValueBefore.toString()), currency);
        const inventoryValueAfter = MoneyVO.create(new Decimal(raw.inventoryValueAfter.toString()), currency);

        const source = (raw.source ?? raw.movement?.source ?? MovementSource.SYSTEM) as MovementSource;

        const props: InventoryLedgerEntryProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            warehouseId: raw.warehouseId,
            movementId: raw.movementId,
            movementLineId: raw.movementLineId ?? raw.id,
            productId: raw.productId,
            variantId: raw.variantId,
            unitOfMeasureId,
            allowsFraction,
            decimalPlaces,
            currency,
            sequence: raw.sequence,
            movementType: raw.movementType as MovementType,
            source,
            quantityIn,
            quantityOut,
            unitCost,
            totalValue,
            balanceQuantity,
            balanceValue,
            balanceAverageCost,
            averageCostBefore,
            averageCostAfter,
            inventoryValueBefore,
            inventoryValueAfter,
            referenceType: (raw.referenceType as ReferenceType) ?? undefined,
            referenceId: raw.referenceId ?? undefined,
            referenceDocument: raw.referenceDocument ?? undefined,
            occurredAt: raw.createdAt,
            createdAt: raw.createdAt,
        };

        return InventoryLedgerEntry.rehydrate(props);
    }

    static toPersistence(entity: InventoryLedgerEntry): Prisma.InventoryLedgerEntryUncheckedCreateInput {
        const qtyIn = entity.getQuantityIn()
            ? new Prisma.Decimal(entity.getQuantityIn()!.getAmount().toString())
            : new Prisma.Decimal(0);

        const qtyOut = entity.getQuantityOut()
            ? new Prisma.Decimal(entity.getQuantityOut()!.getAmount().toString())
            : new Prisma.Decimal(0);

        const qtyDelta = new Prisma.Decimal(entity.getQuantityDelta().toString());

        const avgBefore = entity.getAverageCostBefore()
            ? new Prisma.Decimal(entity.getAverageCostBefore()!.getAmount().toString())
            : new Prisma.Decimal(entity.getBalanceAverageCost().getAmount().toString());

        const avgAfter = entity.getAverageCostAfter()
            ? new Prisma.Decimal(entity.getAverageCostAfter()!.getAmount().toString())
            : new Prisma.Decimal(entity.getBalanceAverageCost().getAmount().toString());

        const invValBefore = entity.getInventoryValueBefore()
            ? new Prisma.Decimal(entity.getInventoryValueBefore()!.getAmount().toString())
            : new Prisma.Decimal(entity.getBalanceValue().getAmount().toString());

        const invValAfter = entity.getInventoryValueAfter()
            ? new Prisma.Decimal(entity.getInventoryValueAfter()!.getAmount().toString())
            : new Prisma.Decimal(entity.getBalanceValue().getAmount().toString());

        const costDelta = entity.isInbound()
            ? new Prisma.Decimal(entity.getTotalValue().getAmount().toString())
            : new Prisma.Decimal(entity.getTotalValue().getAmount().negated().toString());

        const refId = entity.getReferenceId();

        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            movementId: entity.getMovementId(),
            productId: entity.getProductId(),
            variantId: entity.getVariantId(),
            warehouseId: entity.getWarehouseId(),
            movementType: entity.getMovementType(),
            quantityIn: qtyIn,
            quantityOut: qtyOut,
            quantityDelta: qtyDelta,
            quantityBalance: new Prisma.Decimal(entity.getBalanceQuantity().getAmount().toString()),
            unitCost: new Prisma.Decimal(entity.getUnitCost().getAmount().toString()),
            costDelta,
            averageCostBefore: avgBefore,
            averageCostAfter: avgAfter,
            inventoryValueBefore: invValBefore,
            inventoryValueAfter: invValAfter,
            referenceType: entity.getReferenceType() ?? null,
            referenceId: refId && refId.length === 36 ? refId : null,
            referenceDocument: entity.getReferenceDocument() ?? null,
            createdAt: entity.getOccurredAt(),
        };
    }
}
