import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    ProductRepositoryPort,
    SearchProductsFilter,
} from '../../../../application/ports/out/product-repository.port';
import { Product } from '../../../../domain/entities/product/entity';
import { ProductMapper } from '../mappers/product.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaProductRepository implements ProductRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async save(product: Product): Promise<void> {
        const persistenceData = ProductMapper.toPersistence(product);

        await this.client.product.upsert({
            where: {
                tenantId_id: {
                    tenantId: product.getTenantId(),
                    id: product.getId(),
                },
            },
            create: persistenceData,
            update: {
                name: persistenceData.name,
                description: persistenceData.description,
                barcode: persistenceData.barcode,
                categoryId: persistenceData.categoryId,
                productType: persistenceData.productType,
                status: persistenceData.status,
                costPrice: persistenceData.costPrice,
                salePrice: persistenceData.salePrice,
                wholesalePrice: persistenceData.wholesalePrice,
                taxRate: persistenceData.taxRate,
                minStockAlert: persistenceData.minStockAlert,
                unitOfMeasureId: persistenceData.unitOfMeasureId,
                costMethod: persistenceData.costMethod,
                updatedAt: new Date(),
                archivedAt: persistenceData.archivedAt,
            },
        });
    }

    async findById(tenantId: string, id: string): Promise<Product | null> {
        const raw = await this.client.product.findFirst({
            where: {
                tenantId,
                id,
            },
        });

        if (!raw) {
            return null;
        }

        return ProductMapper.toDomain(raw);
    }

    async findBySku(tenantId: string, sku: string): Promise<Product | null> {
        const raw = await this.client.product.findFirst({
            where: {
                tenantId,
                sku,
            },
        });

        if (!raw) {
            return null;
        }

        return ProductMapper.toDomain(raw);
    }

    async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
        const normalized = barcode.trim();
        const raw = await this.client.product.findFirst({
            where: {
                tenantId,
                OR: [
                    { barcode: normalized },
                    {
                        barcodes: {
                            some: {
                                barcode: normalized,
                                isActive: true,
                            },
                        },
                    },
                ],
            },
        });

        if (!raw) {
            return null;
        }

        return ProductMapper.toDomain(raw);
    }

    async search(
        tenantId: string,
        filter: SearchProductsFilter,
    ): Promise<{ products: Product[]; total: number }> {
        const where: Prisma.ProductWhereInput = {
            tenantId,
        };

        if (filter.categoryId) {
            where.categoryId = filter.categoryId;
        }

        if (filter.isActive !== undefined) {
            where.status = filter.isActive ? 'ACTIVE' : { not: 'ACTIVE' };
        }

        if (filter.sku) {
            where.sku = {
                contains: filter.sku,
                mode: 'insensitive',
            };
        }

        if (filter.barcode) {
            where.barcode = {
                contains: filter.barcode,
                mode: 'insensitive',
            };
        }

        if (filter.search) {
            where.OR = [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { sku: { contains: filter.search, mode: 'insensitive' } },
                { barcode: { contains: filter.search, mode: 'insensitive' } },
                { description: { contains: filter.search, mode: 'insensitive' } },
            ];
        }

        const page = filter.page && filter.page > 0 ? filter.page : 1;
        const limit = filter.limit && filter.limit > 0 ? filter.limit : 20;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.client.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            this.client.product.count({ where }),
        ]);

        return {
            products: items.map((raw) => ProductMapper.toDomain(raw)),
            total,
        };
    }

    async hasMovementsOrHistory(tenantId: string, id: string): Promise<boolean> {
        const [movementCount, ledgerCount] = await Promise.all([
            this.client.inventoryMovementLine.count({
                where: {
                    tenantId,
                    productId: id,
                },
            }),
            this.client.inventoryLedgerEntry.count({
                where: {
                    tenantId,
                    productId: id,
                },
            }),
        ]);

        return movementCount > 0 || ledgerCount > 0;
    }

    async delete(tenantId: string, id: string): Promise<void> {
        await this.client.product.deleteMany({
            where: {
                tenantId,
                id,
            },
        });
    }
}
