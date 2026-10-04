import { Module } from '@nestjs/common';

import { PrismaIdempotencyAdapter } from './persistence/prisma/idempotency/prisma-idempotency.adapter';
import { PrismaModule } from './persistence/prisma/prisma.module';
import { PrismaService } from './persistence/prisma/prisma.service';
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
} from './persistence/prisma/repositories';
import { PrismaUnitOfWork } from './persistence/prisma/unit-of-work/prisma-unit-of-work';
import {
    IDEMPOTENCY_PORT,
    INVENTORY_BALANCE_REPOSITORY_PORT,
    INVENTORY_LEDGER_REPOSITORY_PORT,
    INVENTORY_MOVEMENT_REPOSITORY_PORT,
    INVENTORY_TRANSFER_REPOSITORY_PORT,
    PRODUCT_REPOSITORY_PORT,
    PRODUCT_VARIANT_REPOSITORY_PORT,
    STOCK_COUNT_REPOSITORY_PORT,
    UNIT_OF_MEASURE_REPOSITORY_PORT,
    UNIT_OF_WORK_PORT,
    WAREHOUSE_REPOSITORY_PORT,
} from './tokens';

@Module({
    imports: [PrismaModule],
    providers: [
        PrismaService,
        PrismaProductRepository,
        {
            provide: PRODUCT_REPOSITORY_PORT,
            useClass: PrismaProductRepository,
        },
        PrismaProductVariantRepository,
        {
            provide: PRODUCT_VARIANT_REPOSITORY_PORT,
            useClass: PrismaProductVariantRepository,
        },
        PrismaWarehouseRepository,
        {
            provide: WAREHOUSE_REPOSITORY_PORT,
            useClass: PrismaWarehouseRepository,
        },
        PrismaUnitOfMeasureRepository,
        {
            provide: UNIT_OF_MEASURE_REPOSITORY_PORT,
            useClass: PrismaUnitOfMeasureRepository,
        },
        PrismaInventoryBalanceRepository,
        {
            provide: INVENTORY_BALANCE_REPOSITORY_PORT,
            useClass: PrismaInventoryBalanceRepository,
        },
        PrismaInventoryMovementRepository,
        {
            provide: INVENTORY_MOVEMENT_REPOSITORY_PORT,
            useClass: PrismaInventoryMovementRepository,
        },
        PrismaInventoryLedgerRepository,
        {
            provide: INVENTORY_LEDGER_REPOSITORY_PORT,
            useClass: PrismaInventoryLedgerRepository,
        },
        PrismaInventoryTransferRepository,
        {
            provide: INVENTORY_TRANSFER_REPOSITORY_PORT,
            useClass: PrismaInventoryTransferRepository,
        },
        PrismaStockCountRepository,
        {
            provide: STOCK_COUNT_REPOSITORY_PORT,
            useClass: PrismaStockCountRepository,
        },
        PrismaUnitOfWork,
        {
            provide: UNIT_OF_WORK_PORT,
            useClass: PrismaUnitOfWork,
        },
        PrismaIdempotencyAdapter,
        {
            provide: IDEMPOTENCY_PORT,
            useClass: PrismaIdempotencyAdapter,
        },
    ],
    exports: [
        PrismaModule,
        PrismaService,
        PrismaProductRepository,
        PRODUCT_REPOSITORY_PORT,
        PrismaProductVariantRepository,
        PRODUCT_VARIANT_REPOSITORY_PORT,
        PrismaWarehouseRepository,
        WAREHOUSE_REPOSITORY_PORT,
        PrismaUnitOfMeasureRepository,
        UNIT_OF_MEASURE_REPOSITORY_PORT,
        PrismaInventoryBalanceRepository,
        INVENTORY_BALANCE_REPOSITORY_PORT,
        PrismaInventoryMovementRepository,
        INVENTORY_MOVEMENT_REPOSITORY_PORT,
        PrismaInventoryLedgerRepository,
        INVENTORY_LEDGER_REPOSITORY_PORT,
        PrismaInventoryTransferRepository,
        INVENTORY_TRANSFER_REPOSITORY_PORT,
        PrismaStockCountRepository,
        STOCK_COUNT_REPOSITORY_PORT,
        PrismaUnitOfWork,
        UNIT_OF_WORK_PORT,
        PrismaIdempotencyAdapter,
        IDEMPOTENCY_PORT,
    ],
})
export class InfrastructureModule {}
