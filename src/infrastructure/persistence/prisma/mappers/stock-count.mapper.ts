import {
    StockCount as PrismaStockCount,
    StockCountLine as PrismaStockCountLine,
    Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';

import {
    StockCount,
    StockCountProps,
} from '../../../../domain/entities/stock-count/entity';
import {
    StockCountLine,
    StockCountLineProps,
} from '../../../../domain/entities/stock-count/line.entity';
import { StockCountLineStatus, StockCountStatus } from '../../../../domain/types';
import { QuantityRules, QuantityVO } from '../../../../domain/value-objects/quantity.vo';

export type RawStockCountWithLines = PrismaStockCount & {
    lines?: (PrismaStockCountLine & {
        variant?: {
            unitOfMeasureId: string;
            unitOfMeasure?: {
                decimalPlaces: number;
            };
        };
    })[];
};

export class StockCountMapper {
    static toDomain(raw: RawStockCountWithLines): StockCount {
        const domainLines = (raw.lines ?? []).map((rawLine) => {
            const unitOfMeasureId =
                rawLine.variant?.unitOfMeasureId ??
                '00000000-0000-0000-0000-000000000000';
            const decimalPlaces = rawLine.variant?.unitOfMeasure?.decimalPlaces ?? 3;
            const allowsFraction = decimalPlaces > 0;

            const rules: QuantityRules = {
                unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
            };

            const systemQuantity = QuantityVO.create(
                new Decimal(rawLine.systemQuantity.toString()),
                rules,
            );

            const countedQuantity = rawLine.countedQuantity
                ? QuantityVO.create(new Decimal(rawLine.countedQuantity.toString()), rules)
                : undefined;

            const lineProps: StockCountLineProps = {
                id: rawLine.id,
                stockCountId: rawLine.stockCountId,
                productId: rawLine.productId,
                variantId: rawLine.variantId,
                unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
                status: rawLine.status as StockCountLineStatus,
                systemQuantity,
                countedQuantity,
                notes: undefined,
                createdAt: rawLine.createdAt,
                countedAt: rawLine.countedAt ?? undefined,
            };

            return StockCountLine.rehydrate(lineProps);
        });

        const stockCountProps: StockCountProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            warehouseId: raw.warehouseId,
            status: raw.status as StockCountStatus,
            notes: raw.notes ?? undefined,
            createdAt: raw.createdAt,
            startedAt: raw.startedAt ?? undefined,
            completedAt: raw.completedAt ?? undefined,
            cancelledAt: undefined,
        };

        return StockCount.rehydrate(stockCountProps, domainLines);
    }

    static toPersistence(entity: StockCount): Prisma.StockCountUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            warehouseId: entity.getWarehouseId(),
            status: entity.getStatus(),
            notes: entity.getNotes() ?? null,
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getCreatedAt(),
            startedAt: entity.getStartedAt() ?? null,
            completedAt: entity.getCompletedAt() ?? null,
        };
    }

    static toLinePersistence(
        line: StockCountLine,
        tenantId: string,
    ): Prisma.StockCountLineUncheckedCreateInput {
        const sysQty = new Prisma.Decimal(line.getSystemQuantity().getAmount().toString());
        const countedQty = line.getCountedQuantity()
            ? new Prisma.Decimal(line.getCountedQuantity()!.getAmount().toString())
            : null;

        const diffQty = line.getCountedQuantity()
            ? new Prisma.Decimal(
                  line.getCountedQuantity()!.getAmount().minus(line.getSystemQuantity().getAmount()).toString(),
              )
            : null;

        return {
            id: line.getId(),
            tenantId,
            stockCountId: line.getStockCountId(),
            productId: line.getProductId(),
            variantId: line.getVariantId(),
            systemQuantity: sysQty,
            countedQuantity: countedQty,
            differenceQuantity: diffQty,
            status: line.getStatus(),
            countedAt: line.getCountedAt() ?? null,
            createdAt: line.getCreatedAt(),
            updatedAt: line.getCreatedAt(),
        };
    }
}
