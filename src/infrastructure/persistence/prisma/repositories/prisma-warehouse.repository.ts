import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { WarehouseRepositoryPort } from '../../../../application/ports/out/warehouse-repository.port';
import { Warehouse } from '../../../../domain/entities/warehouse/entity';
import { WarehouseMapper } from '../mappers/warehouse.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaWarehouseRepository implements WarehouseRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(warehouse: Warehouse): Promise<void> {
        const persistenceData = WarehouseMapper.toPersistence(warehouse);

        await this.client.warehouse.upsert({
            where: {
                tenantId_id: {
                    tenantId: warehouse.getTenantId(),
                    id: warehouse.getId(),
                },
            },
            create: persistenceData,
            update: {
                branchId: persistenceData.branchId,
                code: persistenceData.code,
                name: persistenceData.name,
                description: persistenceData.description,
                status: persistenceData.status,
                updatedAt: new Date(),
                archivedAt: persistenceData.archivedAt,
            },
        });
    }

    async findById(tenantId: string, id: string): Promise<Warehouse | null> {
        const raw = await this.client.warehouse.findFirst({
            where: {
                tenantId,
                id,
            },
        });

        if (!raw) {
            return null;
        }

        return WarehouseMapper.toDomain(raw);
    }

    async findByCode(tenantId: string, code: string): Promise<Warehouse | null> {
        const raw = await this.client.warehouse.findFirst({
            where: {
                tenantId,
                code: code.trim().toUpperCase(),
            },
        });

        if (!raw) {
            return null;
        }

        return WarehouseMapper.toDomain(raw);
    }

    async findAll(
        tenantId: string,
        filter?: { onlyActive?: boolean; branchId?: string },
    ): Promise<Warehouse[]> {
        const where: Prisma.WarehouseWhereInput = {
            tenantId,
        };

        if (filter?.branchId) {
            where.branchId = filter.branchId;
        }

        if (filter?.onlyActive) {
            where.status = 'ACTIVE';
        }

        const rawList = await this.client.warehouse.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        return rawList.map((raw) => WarehouseMapper.toDomain(raw));
    }
}
