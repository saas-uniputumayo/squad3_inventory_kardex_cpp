import {
    InventoryTransfer as PrismaInventoryTransfer,
    InventoryTransferLine as PrismaInventoryTransferLine,
    Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';

import {
    InventoryTransfer,
    InventoryTransferProps,
    TransferStatus,
} from '../../../../domain/entities/inventory-transfer/entity';
import {
    InventoryTransferLine,
    InventoryTransferLineProps,
} from '../../../../domain/entities/inventory-transfer/line.entity';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { QuantityRules, QuantityVO } from '../../../../domain/value-objects/quantity.vo';
import { TransferReferenceVO } from '../../../../domain/value-objects/transfer-reference.vo';
import { UnitCostVO } from '../../../../domain/value-objects/unit-cost.vo';

export type RawTransferWithLines = PrismaInventoryTransfer & {
    lines?: (PrismaInventoryTransferLine & {
        variant?: {
            unitOfMeasureId: string;
            unitOfMeasure?: {
                decimalPlaces: number;
            };
        };
    })[];
};

export class InventoryTransferMapper {
    static toDomain(raw: RawTransferWithLines): InventoryTransfer {
        const reference = TransferReferenceVO.create(
            raw.referenceDocument ?? `TRF-${raw.id.slice(0, 8)}`,
        );

        const domainLines = (raw.lines ?? []).map((rawLine, index) => {
            const unitOfMeasureId =
                rawLine.variant?.unitOfMeasureId ??
                '00000000-0000-0000-0000-000000000000';
            const decimalPlaces = rawLine.variant?.unitOfMeasure?.decimalPlaces ?? 3;
            const allowsFraction = decimalPlaces > 0;
            const currency = 'COP';

            const rules: QuantityRules = {
                unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
            };

            const quantity = QuantityVO.create(new Decimal(rawLine.quantity.toString()), rules);

            const transferUnitCost = UnitCostVO.create(
                new Decimal(rawLine.transferUnitCost.toString()),
                currency,
            );
            const transferTotalCost = MoneyVO.create(
                new Decimal(rawLine.transferTotalCost.toString()),
                currency,
            );

            const lineProps: InventoryTransferLineProps = {
                id: rawLine.id,
                transferId: rawLine.transferId,
                productId: rawLine.productId,
                variantId: rawLine.variantId,
                unitOfMeasureId,
                allowsFraction,
                decimalPlaces,
                quantity,
                transferUnitCost,
                transferTotalCost,
                lineNumber: rawLine.lineNumber ?? index + 1,
                createdAt: rawLine.createdAt,
            };

            return InventoryTransferLine.rehydrate(lineProps);
        });

        const transferProps: InventoryTransferProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            sourceWarehouseId: raw.sourceWarehouseId,
            destinationWarehouseId: raw.destinationWarehouseId,
            status: raw.status as TransferStatus,
            reference,
            notes: raw.reason ?? undefined,
            reason: raw.reason,
            createdById: raw.createdById,
            completedById: raw.completedById,
            outboundMovementId: raw.outboundMovementId,
            inboundMovementId: raw.inboundMovementId,
            occurredAt: raw.createdAt,
            createdAt: raw.createdAt,
            completedAt: raw.completedAt,
            cancelledAt: null,
        };

        return InventoryTransfer.rehydrate(transferProps, domainLines);
    }

    static toPersistence(entity: InventoryTransfer): Prisma.InventoryTransferUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            sourceWarehouseId: entity.getSourceWarehouseId(),
            destinationWarehouseId: entity.getDestinationWarehouseId(),
            status: entity.getStatus(),
            referenceDocument: entity.getReference().getValue(),
            reason: entity.getNotes() ?? entity.getReason() ?? null,
            createdById: entity.getCreatedById(),
            completedById: entity.getCompletedById(),
            outboundMovementId: entity.getOutboundMovementId(),
            inboundMovementId: entity.getInboundMovementId(),
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getCreatedAt(),
            completedAt: entity.getCompletedAt(),
        };
    }

    static toLinePersistence(
        line: InventoryTransferLine,
        tenantId: string,
        index: number,
    ): Prisma.InventoryTransferLineUncheckedCreateInput {
        return {
            id: line.getId(),
            tenantId,
            transferId: line.getTransferId(),
            lineNumber: line.getLineNumber() ?? index + 1,
            productId: line.getProductId(),
            variantId: line.getVariantId(),
            quantity: new Prisma.Decimal(line.getQuantity().getAmount().toString()),
            transferUnitCost: new Prisma.Decimal(
                (line.getTransferUnitCost()?.getAmount() ?? 0).toString(),
            ),
            transferTotalCost: new Prisma.Decimal(
                (line.getTransferTotalCost()?.getAmount() ?? 0).toString(),
            ),
            createdAt: line.getCreatedAt(),
        };
    }
}
