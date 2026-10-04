import { Inject, Injectable } from '@nestjs/common';

import { InventoryTransferRepositoryPort } from '../../../../application/ports/out/inventory-transfer-repository.port';
import { InventoryTransfer } from '../../../../domain/entities/inventory-transfer/entity';
import {
    InventoryTransferMapper,
    RawTransferWithLines,
} from '../mappers/inventory-transfer.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaInventoryTransferRepository implements InventoryTransferRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(transfer: InventoryTransfer): Promise<void> {
        const transferData = InventoryTransferMapper.toPersistence(transfer);

        await this.client.inventoryTransfer.upsert({
            where: {
                tenantId_id: {
                    tenantId: transfer.getTenantId(),
                    id: transfer.getId(),
                },
            },
            create: transferData,
            update: {
                status: transferData.status,
                reason: transferData.reason,
                completedById: transferData.completedById,
                outboundMovementId: transferData.outboundMovementId,
                inboundMovementId: transferData.inboundMovementId,
                completedAt: transferData.completedAt,
                updatedAt: new Date(),
            },
        });

        const lines = transfer.getLines();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineData = InventoryTransferMapper.toLinePersistence(
                line,
                transfer.getTenantId(),
                i,
            );

            await this.client.inventoryTransferLine.upsert({
                where: {
                    tenantId_id: {
                        tenantId: transfer.getTenantId(),
                        id: line.getId(),
                    },
                },
                create: lineData,
                update: {
                    quantity: lineData.quantity,
                    transferUnitCost: lineData.transferUnitCost,
                    transferTotalCost: lineData.transferTotalCost,
                },
            });
        }
    }

    async findById(tenantId: string, id: string): Promise<InventoryTransfer | null> {
        const raw = await this.client.inventoryTransfer.findFirst({
            where: {
                tenantId,
                id,
            },
            include: {
                lines: {
                    include: {
                        variant: {
                            select: {
                                unitOfMeasureId: true,
                                unitOfMeasure: {
                                    select: {
                                        decimalPlaces: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { lineNumber: 'asc' },
                },
            },
        });

        if (!raw) {
            return null;
        }

        return InventoryTransferMapper.toDomain(raw as RawTransferWithLines);
    }
}
