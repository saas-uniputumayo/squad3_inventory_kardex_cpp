import { Inject, Injectable } from '@nestjs/common';

import { UnitOfMeasureRepositoryPort } from '../../../../application/ports/out/unit-of-measure-repository.port';
import { UnitOfMeasure } from '../../../../domain/entities/unit-of-measure/entity';
import { UnitOfMeasureMapper } from '../mappers/unit-of-measure.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaUnitOfMeasureRepository implements UnitOfMeasureRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async findById(tenantId: string, id: string): Promise<UnitOfMeasure | null> {
        const raw = await this.client.unitOfMeasure.findFirst({
            where: {
                tenantId,
                id,
            },
        });

        if (!raw) {
            return null;
        }

        return UnitOfMeasureMapper.toDomain(raw);
    }

    async findByCode(tenantId: string, code: string): Promise<UnitOfMeasure | null> {
        const raw = await this.client.unitOfMeasure.findFirst({
            where: {
                tenantId,
                code: code.trim().toUpperCase(),
            },
        });

        if (!raw) {
            return null;
        }

        return UnitOfMeasureMapper.toDomain(raw);
    }
}
