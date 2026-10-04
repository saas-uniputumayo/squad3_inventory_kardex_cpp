import { Inject, Injectable } from '@nestjs/common';

import { ProductVariantRepositoryPort } from '../../../../application/ports/out/product-variant-repository.port';
import { ProductVariant } from '../../../../domain/entities/product/variant.entity';
import { ProductVariantMapper } from '../mappers/product-variant.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaProductVariantRepository implements ProductVariantRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(variant: ProductVariant): Promise<void> {
        const persistenceData = ProductVariantMapper.toPersistence(variant);

        await this.client.productVariant.upsert({
            where: {
                tenantId_id: {
                    tenantId: variant.getTenantId(),
                    id: variant.getId(),
                },
            },
            create: persistenceData,
            update: {
                sku: persistenceData.sku,
                name: persistenceData.name,
                description: persistenceData.description,
                status: persistenceData.status,
                costPrice: persistenceData.costPrice,
                salePrice: persistenceData.salePrice,
                wholesalePrice: persistenceData.wholesalePrice,
                taxRate: persistenceData.taxRate,
                minStockAlert: persistenceData.minStockAlert,
                unitOfMeasureId: persistenceData.unitOfMeasureId,
                isDefault: persistenceData.isDefault,
                updatedAt: new Date(),
                archivedAt: persistenceData.archivedAt,
            },
        });
    }

    async findById(tenantId: string, id: string): Promise<ProductVariant | null> {
        const raw = await this.client.productVariant.findFirst({
            where: {
                tenantId,
                id,
            },
        });

        if (!raw) {
            return null;
        }

        return ProductVariantMapper.toDomain(raw);
    }

    async findDefaultByProductId(
        tenantId: string,
        productId: string,
    ): Promise<ProductVariant | null> {
        const raw = await this.client.productVariant.findFirst({
            where: {
                tenantId,
                productId,
                isDefault: true,
            },
        });

        if (!raw) {
            return null;
        }

        return ProductVariantMapper.toDomain(raw);
    }

    async findBySku(tenantId: string, sku: string): Promise<ProductVariant | null> {
        const raw = await this.client.productVariant.findFirst({
            where: {
                tenantId,
                sku,
            },
        });

        if (!raw) {
            return null;
        }

        return ProductVariantMapper.toDomain(raw);
    }

    async findByProductId(
        tenantId: string,
        productId: string,
    ): Promise<ProductVariant[]> {
        const rawList = await this.client.productVariant.findMany({
            where: {
                tenantId,
                productId,
            },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });

        return rawList.map((raw) => ProductVariantMapper.toDomain(raw));
    }
}
