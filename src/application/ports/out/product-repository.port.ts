import { Product } from '../../../domain/entities/product/entity';

export interface SearchProductsFilter {
    search?: string;
    sku?: string;
    barcode?: string;
    categoryId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export interface ProductRepositoryPort {
    save(product: Product): Promise<void>;
    findById(tenantId: string, id: string): Promise<Product | null>;
    findBySku(tenantId: string, sku: string): Promise<Product | null>;
    findByBarcode(tenantId: string, barcode: string): Promise<Product | null>;
    search(
        tenantId: string,
        filter: SearchProductsFilter,
    ): Promise<{ products: Product[]; total: number }>;
    hasMovementsOrHistory(tenantId: string, id: string): Promise<boolean>;
    delete(tenantId: string, id: string): Promise<void>;
}
