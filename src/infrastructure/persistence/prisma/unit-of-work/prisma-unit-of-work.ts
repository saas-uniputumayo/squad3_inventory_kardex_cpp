import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    TransactionalContext,
    UnitOfWorkPort,
} from '../../../../application/ports/out/unit-of-work.port';
import { TenantContext } from '../../../context/tenant-context';
import { PrismaService } from '../prisma.service';
import {
    PrismaInventoryBalanceRepository,
    PrismaInventoryLedgerRepository,
    PrismaInventoryMovementRepository,
    PrismaInventoryTransferRepository,
    PrismaProductRepository,
    PrismaProductVariantRepository,
    PrismaStockCountRepository,
    PrismaUnitOfMeasureRepository,
    PrismaWarehouseRepository,
} from '../repositories';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWorkPort {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta una serie de operaciones atómicas en una única transacción de Prisma/PostgreSQL.
     * Si existe un tenantId en TenantContext, configura RLS en la sesión transaccional
     * mediante la función `set_current_tenant(UUID)`.
     */
    async execute<T>(
        work: (context: TransactionalContext) => Promise<T>,
    ): Promise<T> {
        return await this.prisma.$transaction(
            async (tx) => {
                const tenantId = TenantContext.getTenantId();
                if (tenantId) {
                    try {
                        await (tx as any).$executeRawUnsafe(
                            `SELECT set_current_tenant($1::uuid)`,
                            tenantId,
                        );
                    } catch {
                        // Respaldo directo en caso de que la función no esté cargada
                        await (tx as any).$executeRawUnsafe(
                            `SET LOCAL app.current_tenant_id = '${tenantId}'`,
                        );
                    }
                }

                const context: TransactionalContext = {
                    productRepository: new PrismaProductRepository(tx),
                    productVariantRepository: new PrismaProductVariantRepository(tx),
                    warehouseRepository: new PrismaWarehouseRepository(tx),
                    unitOfMeasureRepository: new PrismaUnitOfMeasureRepository(tx),
                    inventoryBalanceRepository: new PrismaInventoryBalanceRepository(tx),
                    inventoryMovementRepository: new PrismaInventoryMovementRepository(tx),
                    inventoryLedgerRepository: new PrismaInventoryLedgerRepository(tx),
                    inventoryTransferRepository: new PrismaInventoryTransferRepository(tx),
                    stockCountRepository: new PrismaStockCountRepository(tx),
                };

                return await work(context);
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
                timeout: 20000,
            },
        );
    }
}
