import { InventoryBalance as PrismaInventoryBalance, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    InventoryBalance,
    InventoryBalanceProps,
} from '../../../../domain/entities/inventory-balance/entity';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { QuantityRules, QuantityVO } from '../../../../domain/value-objects/quantity.vo';
import { UnitCostVO } from '../../../../domain/value-objects/unit-cost.vo';

export type RawInventoryBalanceRecord = PrismaInventoryBalance & {
    unitOfMeasureId?: string | null;
    allowsFraction?: boolean | null;
    decimalPlaces?: number | null;
    currency?: string | null;
    variant?: {
        unitOfMeasureId: string;
        unitOfMeasure?: {
            decimalPlaces: number;
        };
    } | null;
};

export class InventoryBalanceMapper {
    static toDomain(raw: RawInventoryBalanceRecord): InventoryBalance {
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

        const quantityRules: QuantityRules = {
            unitOfMeasureId,
            allowsFraction,
            decimalPlaces,
        };

        const quantityOnHand = QuantityVO.create(
            new Decimal(raw.quantityOnHand.toString()),
            quantityRules,
        );

        const reservedQuantity = QuantityVO.create(
            new Decimal(raw.reservedQuantity.toString()),
            quantityRules,
        );

        const averageCost = UnitCostVO.create(
            new Decimal(raw.averageCost.toString()),
            currency,
        );

        const inventoryValue = MoneyVO.create(
            new Decimal(raw.inventoryValue.toString()),
            currency,
        );

        const props: InventoryBalanceProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            warehouseId: raw.warehouseId,
            productId: raw.productId,
            variantId: raw.variantId,
            unitOfMeasureId,
            allowsFraction,
            decimalPlaces,
            currency,
            quantityOnHand,
            reservedQuantity,
            averageCost,
            inventoryValue,
            version: raw.version,
            createdAt: raw.updatedAt,
            updatedAt: raw.updatedAt,
        };

        return InventoryBalance.rehydrate(props);
    }

    static toPersistence(entity: InventoryBalance): Prisma.InventoryBalanceUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            warehouseId: entity.getWarehouseId(),
            productId: entity.getProductId(),
            variantId: entity.getVariantId(),
            quantityOnHand: new Prisma.Decimal(entity.getQuantityOnHand().getAmount().toString()),
            reservedQuantity: new Prisma.Decimal(entity.getReservedQuantity().getAmount().toString()),
            averageCost: new Prisma.Decimal(entity.getAverageCost().getAmount().toString()),
            inventoryValue: new Prisma.Decimal(entity.getInventoryValue().getAmount().toString()),
            version: BigInt(entity.getVersion()),
            updatedAt: entity.getUpdatedAt(),
        };
    }
}
