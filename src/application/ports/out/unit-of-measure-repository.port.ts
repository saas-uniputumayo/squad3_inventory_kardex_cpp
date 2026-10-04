import { UnitOfMeasure } from '../../../domain/entities/unit-of-measure/entity';

export interface UnitOfMeasureRepositoryPort {
    findById(tenantId: string, id: string): Promise<UnitOfMeasure | null>;
    findByCode(tenantId: string, code: string): Promise<UnitOfMeasure | null>;
}
