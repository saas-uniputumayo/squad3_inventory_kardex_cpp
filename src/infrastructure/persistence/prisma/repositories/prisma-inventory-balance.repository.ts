import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import {
    InventoryBalanceKey,
    InventoryBalanceRepositoryPort,
    StockAlertFilter,
    StockAlertItem,
} from '../../../../application/ports/out/inventory-balance-repository.port';
import { InventoryBalance } from '../../../../domain/entities/inventory-balance/entity';
import {
    InventoryBalanceMapper,
    RawInventoryBalanceRecord,
} from '../mappers/inventory-balance.mapper';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductVariantMapper } from '../mappers/product-variant.mapper';
import { WarehouseMapper } from '../mappers/warehouse.mapper';
import { PrismaClientOrTx, PrismaService } from '../prisma.service';

@Injectable()
export class PrismaInventoryBalanceRepository implements InventoryBalanceRepositoryPort {
    constructor(@Inject(PrismaService) private readonly client: PrismaClientOrTx) {}

    async findById(tenantId: string, id: string): Promise<InventoryBalance | null> {
        const raw = await this.client.inventoryBalance.findFirst({
            where: {
                tenantId,
                id,
            },
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
        });

        if (!raw) {
            return null;
        }

        return InventoryBalanceMapper.toDomain(raw as RawInventoryBalanceRecord);
    }

    async findByLocation(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null> {
        const raw = await this.client.inventoryBalance.findFirst({
            where: {
                tenantId,
                warehouseId,
                productId,
                variantId,
            },
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
        });

        if (!raw) {
            return null;
        }

        return InventoryBalanceMapper.toDomain(raw as RawInventoryBalanceRecord);
    }

    /**
     * SELECT FOR UPDATE pesimista dentro de la transacción activa de PostgreSQL.
     * Garantiza aislamiento estricto y previene race conditions de stock concurrente.
     */
    async findForUpdate(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null> {
        const rows = await (this.client as any).$queryRaw<any[]>`
            SELECT 
                b.id,
                b.tenant_id as "tenantId",
                b.product_id as "productId",
                b.variant_id as "variantId",
                b.warehouse_id as "warehouseId",
                b.quantity_on_hand as "quantityOnHand",
                b.reserved_quantity as "reservedQuantity",
                b.average_cost as "averageCost",
                b.inventory_value as "inventoryValue",
                b.version,
                b.updated_at as "updatedAt",
                v.unit_of_measure_id as "unitOfMeasureId",
                u.decimal_places as "decimalPlaces"
            FROM inventory_balances b
            JOIN product_variants v ON v.id = b.variant_id
            JOIN unit_of_measures u ON u.id = v.unit_of_measure_id
            WHERE b.tenant_id = ${tenantId}::uuid
              AND b.warehouse_id = ${warehouseId}::uuid
              AND b.product_id = ${productId}::uuid
              AND b.variant_id = ${variantId}::uuid
            FOR UPDATE OF b
        `;

        if (!rows || rows.length === 0) {
            return null;
        }

        const raw = rows[0];
        return InventoryBalanceMapper.toDomain({
            id: raw.id,
            tenantId: raw.tenantId,
            productId: raw.productId,
            variantId: raw.variantId,
            warehouseId: raw.warehouseId,
            quantityOnHand: raw.quantityOnHand,
            reservedQuantity: raw.reservedQuantity,
            averageCost: raw.averageCost,
            inventoryValue: raw.inventoryValue,
            version: BigInt(raw.version),
            updatedAt: raw.updatedAt,
            unitOfMeasureId: raw.unitOfMeasureId,
            decimalPlaces: Number(raw.decimalPlaces),
            allowsFraction: Number(raw.decimalPlaces) > 0,
            currency: 'COP',
        });
    }

    /**
     * Adquiere bloqueos pesimistas en orden determinístico lexicográfico
     * para erradicar totalmente cualquier posibilidad de deadlock entre transferencias
     * o movimientos multi-ítem.
     */
    async findManyForUpdate(
        tenantId: string,
        keys: InventoryBalanceKey[],
    ): Promise<InventoryBalance[]> {
        if (!keys.length) {
            return [];
        }

        // Ordenamiento determinístico por warehouseId -> productId -> variantId
        const sortedKeys = [...keys].sort((a, b) => {
            const keyA = `${a.warehouseId}:${a.productId}:${a.variantId}`;
            const keyB = `${b.warehouseId}:${b.productId}:${b.variantId}`;
            return keyA.localeCompare(keyB);
        });

        const balances: InventoryBalance[] = [];

        for (const key of sortedKeys) {
            const balance = await this.findForUpdate(
                tenantId,
                key.warehouseId,
                key.productId,
                key.variantId,
            );
            if (balance) {
                balances.push(balance);
            }
        }

        return balances;
    }

    async save(balance: InventoryBalance): Promise<void> {
        const persistenceData = InventoryBalanceMapper.toPersistence(balance);

        await this.client.inventoryBalance.upsert({
            where: {
                tenantId_variantId_warehouseId: {
                    tenantId: balance.getTenantId(),
                    variantId: balance.getVariantId(),
                    warehouseId: balance.getWarehouseId(),
                },
            },
            create: persistenceData,
            update: {
                quantityOnHand: persistenceData.quantityOnHand,
                reservedQuantity: persistenceData.reservedQuantity,
                averageCost: persistenceData.averageCost,
                inventoryValue: persistenceData.inventoryValue,
                version: persistenceData.version,
                updatedAt: new Date(),
            },
        });
    }

    async saveMany(balances: InventoryBalance[]): Promise<void> {
        for (const balance of balances) {
            await this.save(balance);
        }
    }

    async findByWarehouse(
        tenantId: string,
        warehouseId: string,
    ): Promise<InventoryBalance[]> {
        const rawList = await this.client.inventoryBalance.findMany({
            where: {
                tenantId,
                warehouseId,
            },
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
            orderBy: { productId: 'asc' },
        });

        return rawList.map((raw) =>
            InventoryBalanceMapper.toDomain(raw as RawInventoryBalanceRecord),
        );
    }

    async findLowStockAlerts(
        tenantId: string,
        filter?: StockAlertFilter,
    ): Promise<{ items: StockAlertItem[]; total: number }> {
        const where: Prisma.InventoryBalanceWhereInput = {
            tenantId,
        };

        if (filter?.warehouseId) {
            where.warehouseId = filter.warehouseId;
        }

        if (filter?.search) {
            where.OR = [
                { product: { name: { contains: filter.search, mode: 'insensitive' } } },
                { product: { sku: { contains: filter.search, mode: 'insensitive' } } },
                { variant: { name: { contains: filter.search, mode: 'insensitive' } } },
                { variant: { sku: { contains: filter.search, mode: 'insensitive' } } },
            ];
        }

        const rawList = await this.client.inventoryBalance.findMany({
            where,
            include: {
                product: true,
                variant: {
                    include: {
                        unitOfMeasure: true,
                    },
                },
                warehouse: true,
            },
            orderBy: { quantityOnHand: 'asc' },
        });

        const lowStockItems: StockAlertItem[] = [];

        for (const raw of rawList) {
            const onHand = new Decimal(raw.quantityOnHand.toString());
            const minAlert = new Decimal(
                (raw.variant?.minStockAlert ?? raw.product.minStockAlert).toString(),
            );

            if (onHand.lessThanOrEqualTo(minAlert)) {
                lowStockItems.push({
                    balance: InventoryBalanceMapper.toDomain(raw as RawInventoryBalanceRecord),
                    product: ProductMapper.toDomain(raw.product),
                    variant: ProductVariantMapper.toDomain(raw.variant),
                    warehouse: WarehouseMapper.toDomain(raw.warehouse),
                });
            }
        }

        const page = filter?.page && filter.page > 0 ? filter.page : 1;
        const limit = filter?.limit && filter.limit > 0 ? filter.limit : 50;
        const skip = (page - 1) * limit;

        const paginatedItems = lowStockItems.slice(skip, skip + limit);

        return {
            items: paginatedItems,
            total: lowStockItems.length,
        };
    }
}
