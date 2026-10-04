import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    InventoryLedgerRepositoryPort,
    KardexQueryFilter,
} from '../../../../application/ports/out/inventory-ledger-repository.port';
import { InventoryLedgerEntry } from '../../../../domain/entities/inventory-ledger-entry/entity';
import {
    InventoryLedgerMapper,
    RawLedgerEntryRecord,
} from '../mappers/inventory-ledger.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaInventoryLedgerRepository implements InventoryLedgerRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    /**
     * Persiste una entrada de Kardex de forma append-only.
     * Es inmutable y no permite updates ni deletes.
     */
    async save(entry: InventoryLedgerEntry): Promise<void> {
        const persistenceData = InventoryLedgerMapper.toPersistence(entry);

        await this.client.inventoryLedgerEntry.create({
            data: persistenceData,
        });
    }

    /**
     * Persiste múltiples entradas de Kardex en orden cronológico append-only.
     */
    async saveMany(entries: InventoryLedgerEntry[]): Promise<void> {
        for (const entry of entries) {
            await this.save(entry);
        }
    }

    async findByProduct(
        tenantId: string,
        filter: KardexQueryFilter,
    ): Promise<{ entries: InventoryLedgerEntry[]; total: number }> {
        const where: Prisma.InventoryLedgerEntryWhereInput = {
            tenantId,
            productId: filter.productId,
        };

        if (filter.variantId) {
            where.variantId = filter.variantId;
        }

        if (filter.warehouseId) {
            where.warehouseId = filter.warehouseId;
        }

        if (filter.movementType) {
            where.movementType = filter.movementType;
        }

        if (filter.from || filter.to) {
            where.createdAt = {};
            if (filter.from) {
                where.createdAt.gte = filter.from;
            }
            if (filter.to) {
                where.createdAt.lte = filter.to;
            }
        }

        const page = filter.page && filter.page > 0 ? filter.page : 1;
        const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.client.inventoryLedgerEntry.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }],
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
                    movement: {
                        select: {
                            source: true,
                        },
                    },
                },
            }),
            this.client.inventoryLedgerEntry.count({ where }),
        ]);

        return {
            entries: items.map((raw) =>
                InventoryLedgerMapper.toDomain(raw as RawLedgerEntryRecord),
            ),
            total,
        };
    }
}
