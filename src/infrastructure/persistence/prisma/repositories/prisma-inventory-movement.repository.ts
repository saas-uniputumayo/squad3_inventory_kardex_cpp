import { Inject, Injectable } from '@nestjs/common';

import { InventoryMovementRepositoryPort } from '../../../../application/ports/out/inventory-movement-repository.port';
import { InventoryMovement } from '../../../../domain/entities/inventory-movement/entity';
import { ReferenceType } from '../../../../domain/types';
import {
    InventoryMovementMapper,
    RawMovementWithLines,
} from '../mappers/inventory-movement.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaInventoryMovementRepository implements InventoryMovementRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(movement: InventoryMovement): Promise<void> {
        const movementData = InventoryMovementMapper.toPersistence(movement);

        await this.client.inventoryMovement.upsert({
            where: {
                tenantId_id: {
                    tenantId: movement.getTenantId(),
                    id: movement.getId(),
                },
            },
            create: movementData,
            update: {
                status: movementData.status,
                postedAt: movementData.postedAt,
                reversedAt: movementData.reversedAt,
                reversesMovementId: movementData.reversesMovementId,
                updatedAt: new Date(),
            },
        });

        const lines = movement.getLines();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineData = InventoryMovementMapper.toLinePersistence(
                line,
                movement.getTenantId(),
                i,
            );

            await this.client.inventoryMovementLine.upsert({
                where: {
                    tenantId_id: {
                        tenantId: movement.getTenantId(),
                        id: line.getId(),
                    },
                },
                create: lineData,
                update: {
                    quantity: lineData.quantity,
                    unitCost: lineData.unitCost,
                    totalCost: lineData.totalCost,
                },
            });
        }
    }

    async findById(tenantId: string, id: string): Promise<InventoryMovement | null> {
        const raw = await this.client.inventoryMovement.findFirst({
            where: {
                tenantId,
                id,
            },
            include: {
                lines: {
                    include: {
                        unitOfMeasure: {
                            select: {
                                decimalPlaces: true,
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

        return InventoryMovementMapper.toDomain(raw as RawMovementWithLines);
    }

    async findByReference(
        tenantId: string,
        referenceType: ReferenceType,
        referenceId: string,
    ): Promise<InventoryMovement | null> {
        const isUuid = referenceId.length === 36;

        const raw = await this.client.inventoryMovement.findFirst({
            where: {
                tenantId,
                referenceType,
                OR: [
                    ...(isUuid ? [{ referenceId }] : []),
                    { referenceDocument: referenceId },
                ],
            },
            include: {
                lines: {
                    include: {
                        unitOfMeasure: {
                            select: {
                                decimalPlaces: true,
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

        return InventoryMovementMapper.toDomain(raw as RawMovementWithLines);
    }

    async findByReferenceDocument(
        tenantId: string,
        referenceDocument: string,
    ): Promise<InventoryMovement[]> {
        const rawList = await this.client.inventoryMovement.findMany({
            where: {
                tenantId,
                referenceDocument,
            },
            include: {
                lines: {
                    include: {
                        unitOfMeasure: {
                            select: {
                                decimalPlaces: true,
                            },
                        },
                    },
                    orderBy: { lineNumber: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return rawList.map((raw) =>
            InventoryMovementMapper.toDomain(raw as RawMovementWithLines),
        );
    }
}
