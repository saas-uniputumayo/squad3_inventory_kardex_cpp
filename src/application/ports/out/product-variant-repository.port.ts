import { ProductVariant } from '../../../domain/entities/product/variant.entity';

export interface ProductVariantRepositoryPort {
    save(variant: ProductVariant): Promise<void>;
    findById(tenantId: string, id: string): Promise<ProductVariant | null>;
    findDefaultByProductId(
        tenantId: string,
        productId: string,
    ): Promise<ProductVariant | null>;
    findBySku(tenantId: string, sku: string): Promise<ProductVariant | null>;
    findByProductId(
        tenantId: string,
        productId: string,
    ): Promise<ProductVariant[]>;
}
