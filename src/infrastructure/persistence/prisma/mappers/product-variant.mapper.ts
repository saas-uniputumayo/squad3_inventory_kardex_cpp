import { ProductVariant as PrismaProductVariant, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    ProductVariant,
    ProductVariantProps,
    ProductVariantStatus,
} from '../../../../domain/entities/product/variant.entity';
import { CostMethod } from '../../../../domain/types';
import { MoneyVO } from '../../../../domain/value-objects/money.vo';
import { SkuVO } from '../../../../domain/value-objects/sku.vo';

export class ProductVariantMapper {
    static toDomain(raw: PrismaProductVariant): ProductVariant {
        const props: ProductVariantProps = {
            id: raw.id,
            tenantId: raw.tenantId,
            productId: raw.productId,
            sku: SkuVO.create(raw.sku),
            name: raw.name,
            description: raw.description,
            status: raw.status as ProductVariantStatus,
            costPrice: MoneyVO.create(new Decimal(raw.costPrice.toString())),
            salePrice: MoneyVO.create(new Decimal(raw.salePrice.toString())),
            wholesalePrice: raw.wholesalePrice
                ? MoneyVO.create(new Decimal(raw.wholesalePrice.toString()))
                : null,
            taxRate: new Decimal(raw.taxRate.toString()),
            minStockAlert: new Decimal(raw.minStockAlert.toString()),
            unitOfMeasureId: raw.unitOfMeasureId,
            isDefault: raw.isDefault,
            costMethod: CostMethod.WEIGHTED_AVERAGE,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            archivedAt: raw.archivedAt,
        };

        return ProductVariant.rehydrate(props);
    }

    static toPersistence(entity: ProductVariant): Prisma.ProductVariantUncheckedCreateInput {
        return {
            id: entity.getId(),
            tenantId: entity.getTenantId(),
            productId: entity.getProductId(),
            sku: entity.getSku().getValue(),
            name: entity.getName(),
            description: entity.getDescription(),
            status: entity.getStatus(),
            costPrice: new Prisma.Decimal(entity.getCostPrice().getAmount().toString()),
            salePrice: new Prisma.Decimal(entity.getSalePrice().getAmount().toString()),
            wholesalePrice: entity.getWholesalePrice()
                ? new Prisma.Decimal(entity.getWholesalePrice()!.getAmount().toString())
                : null,
            taxRate: new Prisma.Decimal(entity.getTaxRate().toString()),
            minStockAlert: new Prisma.Decimal(entity.getMinStockAlert().toString()),
            unitOfMeasureId: entity.getUnitOfMeasureId(),
            isDefault: entity.getIsDefault(),
            createdAt: entity.getCreatedAt(),
            updatedAt: entity.getUpdatedAt(),
            archivedAt: entity.getArchivedAt(),
        };
    }
}
