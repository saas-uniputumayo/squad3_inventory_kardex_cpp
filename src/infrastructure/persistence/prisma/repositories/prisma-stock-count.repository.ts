import { Inject, Injectable } from '@nestjs/common';

import { StockCountRepositoryPort } from '../../../../application/ports/out/stock-count-repository.port';
import { StockCount } from '../../../../domain/entities/stock-count/entity';
import {
    RawStockCountWithLines,
    StockCountMapper,
} from '../mappers/stock-count.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaStockCountRepository implements StockCountRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(stockCount: StockCount): Promise<void> {
        const countData = StockCountMapper.toPersistence(stockCount);

        await this.client.stockCount.upsert({
            where: {
                tenantId_id: {
                    tenantId: stockCount.getTenantId(),
                    id: stockCount.getId(),
                },
            },
            create: countData,
            update: {
                status: countData.status,
                notes: countData.notes,
                startedAt: countData.startedAt,
                completedAt: countData.completedAt,
                updatedAt: new Date(),
            },
        });

        const lines = stockCount.getLines();
        for (const line of lines) {
            const lineData = StockCountMapper.toLinePersistence(
                line,
                stockCount.getTenantId(),
            );

            await this.client.stockCountLine.upsert({
                where: {
                    tenantId_id: {
                        tenantId: stockCount.getTenantId(),
                        id: line.getId(),
                    },
                },
                create: lineData,
                update: {
                    countedQuantity: lineData.countedQuantity,
                    differenceQuantity: lineData.differenceQuantity,
                    status: lineData.status,
                    countedAt: lineData.countedAt,
                    updatedAt: new Date(),
                },
            });
        }
    }

    async findById(tenantId: string, id: string): Promise<StockCount | null> {
        const raw = await this.client.stockCount.findFirst({
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
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!raw) {
            return null;
        }

        return StockCountMapper.toDomain(raw as RawStockCountWithLines);
    }
}
