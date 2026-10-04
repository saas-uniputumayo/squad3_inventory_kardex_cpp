import { StockCount } from '../../../domain/entities/stock-count/entity';

export interface StockCountRepositoryPort {
    save(stockCount: StockCount): Promise<void>;
    findById(tenantId: string, id: string): Promise<StockCount | null>;
}
