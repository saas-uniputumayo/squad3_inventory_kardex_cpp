import { Module } from '@nestjs/common';
import {
    APPLY_STOCK_COUNT_USE_CASE,
    CREATE_PRODUCT_USE_CASE,
    CREATE_STOCK_COUNT_USE_CASE,
    DISPATCH_STOCK_USE_CASE,
    GET_KARDEX_USE_CASE,
    GET_PRODUCT_DETAIL_USE_CASE,
    GET_STOCK_ALERTS_USE_CASE,
    IDEMPOTENCY_PORT,
    INVENTORY_BALANCE_REPOSITORY_PORT,
    INVENTORY_LEDGER_REPOSITORY_PORT,
    LIST_WAREHOUSES_USE_CASE,
    PRODUCT_REPOSITORY_PORT,
    PRODUCT_VARIANT_REPOSITORY_PORT,
    RECEIVE_STOCK_USE_CASE,
    RECEIVE_TRANSFER_USE_CASE,
    REVERSE_MOVEMENT_USE_CASE,
    SEARCH_PRODUCTS_USE_CASE,
    STOCK_COUNT_REPOSITORY_PORT,
    TRANSFER_STOCK_USE_CASE,
    UNIT_OF_MEASURE_REPOSITORY_PORT,
    UNIT_OF_WORK_PORT,
    UPDATE_PRODUCT_USE_CASE,
    WAREHOUSE_REPOSITORY_PORT,
} from './tokens';
import {
    IdempotencyPort,
    InventoryBalanceRepositoryPort,
    InventoryLedgerRepositoryPort,
    ProductRepositoryPort,
    ProductVariantRepositoryPort,
    StockCountRepositoryPort,
    UnitOfMeasureRepositoryPort,
    UnitOfWorkPort,
    WarehouseRepositoryPort,
} from './ports/out';
import {
    ApplyStockCountService,
    CreateProductService,
    CreateStockCountService,
    DispatchStockService,
    GetKardexService,
    GetProductDetailService,
    GetStockAlertsService,
    ListWarehousesService,
    ReceiveStockService,
    ReceiveTransferService,
    ReverseMovementService,
    SearchProductsService,
    TransferStockService,
    UpdateProductService,
} from './services';

@Module({
    imports: [], // Application does NOT import Infrastructure (Decoupled Pure Application Module)
    providers: [
        {
            provide: CREATE_PRODUCT_USE_CASE,
            useFactory: (
                pRepo: ProductRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                uow: UnitOfWorkPort,
            ) => new CreateProductService(pRepo, pvRepo, uomRepo, uow),
            inject: [
                PRODUCT_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: UPDATE_PRODUCT_USE_CASE,
            useFactory: (
                pRepo: ProductRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                uow: UnitOfWorkPort,
            ) => new UpdateProductService(pRepo, uomRepo, uow),
            inject: [
                PRODUCT_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: SEARCH_PRODUCTS_USE_CASE,
            useFactory: (
                pRepo: ProductRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                ibRepo: InventoryBalanceRepositoryPort,
            ) => new SearchProductsService(pRepo, pvRepo, uomRepo, ibRepo),
            inject: [
                PRODUCT_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                INVENTORY_BALANCE_REPOSITORY_PORT,
            ],
        },
        {
            provide: GET_PRODUCT_DETAIL_USE_CASE,
            useFactory: (
                pRepo: ProductRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                ibRepo: InventoryBalanceRepositoryPort,
            ) => new GetProductDetailService(pRepo, pvRepo, uomRepo, ibRepo),
            inject: [
                PRODUCT_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                INVENTORY_BALANCE_REPOSITORY_PORT,
            ],
        },
        {
            provide: LIST_WAREHOUSES_USE_CASE,
            useFactory: (wRepo: WarehouseRepositoryPort) =>
                new ListWarehousesService(wRepo),
            inject: [WAREHOUSE_REPOSITORY_PORT],
        },
        {
            provide: RECEIVE_STOCK_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                pRepo: ProductRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                idemp: IdempotencyPort,
                uow: UnitOfWorkPort,
            ) => new ReceiveStockService(wRepo, pRepo, pvRepo, uomRepo, idemp, uow),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                PRODUCT_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                IDEMPOTENCY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: DISPATCH_STOCK_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                idemp: IdempotencyPort,
                uow: UnitOfWorkPort,
            ) => new DispatchStockService(wRepo, pvRepo, idemp, uow),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                IDEMPOTENCY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: REVERSE_MOVEMENT_USE_CASE,
            useFactory: (idemp: IdempotencyPort, uow: UnitOfWorkPort) =>
                new ReverseMovementService(idemp, uow),
            inject: [IDEMPOTENCY_PORT, UNIT_OF_WORK_PORT],
        },
        {
            provide: TRANSFER_STOCK_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                pvRepo: ProductVariantRepositoryPort,
                idemp: IdempotencyPort,
                uow: UnitOfWorkPort,
            ) => new TransferStockService(wRepo, pvRepo, idemp, uow),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                PRODUCT_VARIANT_REPOSITORY_PORT,
                IDEMPOTENCY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: RECEIVE_TRANSFER_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                idemp: IdempotencyPort,
                uow: UnitOfWorkPort,
            ) => new ReceiveTransferService(wRepo, idemp, uow),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                IDEMPOTENCY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
        {
            provide: GET_KARDEX_USE_CASE,
            useFactory: (
                pRepo: ProductRepositoryPort,
                wRepo: WarehouseRepositoryPort,
                uomRepo: UnitOfMeasureRepositoryPort,
                ilRepo: InventoryLedgerRepositoryPort,
            ) => new GetKardexService(pRepo, wRepo, uomRepo, ilRepo),
            inject: [
                PRODUCT_REPOSITORY_PORT,
                WAREHOUSE_REPOSITORY_PORT,
                UNIT_OF_MEASURE_REPOSITORY_PORT,
                INVENTORY_LEDGER_REPOSITORY_PORT,
            ],
        },
        {
            provide: GET_STOCK_ALERTS_USE_CASE,
            useFactory: (ibRepo: InventoryBalanceRepositoryPort) =>
                new GetStockAlertsService(ibRepo),
            inject: [INVENTORY_BALANCE_REPOSITORY_PORT],
        },
        {
            provide: CREATE_STOCK_COUNT_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                ibRepo: InventoryBalanceRepositoryPort,
                scRepo: StockCountRepositoryPort,
            ) => new CreateStockCountService(wRepo, ibRepo, scRepo),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                INVENTORY_BALANCE_REPOSITORY_PORT,
                STOCK_COUNT_REPOSITORY_PORT,
            ],
        },
        {
            provide: APPLY_STOCK_COUNT_USE_CASE,
            useFactory: (
                wRepo: WarehouseRepositoryPort,
                scRepo: StockCountRepositoryPort,
                idemp: IdempotencyPort,
                uow: UnitOfWorkPort,
            ) => new ApplyStockCountService(wRepo, scRepo, idemp, uow),
            inject: [
                WAREHOUSE_REPOSITORY_PORT,
                STOCK_COUNT_REPOSITORY_PORT,
                IDEMPOTENCY_PORT,
                UNIT_OF_WORK_PORT,
            ],
        },
    ],
    exports: [
        CREATE_PRODUCT_USE_CASE,
        UPDATE_PRODUCT_USE_CASE,
        SEARCH_PRODUCTS_USE_CASE,
        GET_PRODUCT_DETAIL_USE_CASE,
        LIST_WAREHOUSES_USE_CASE,
        RECEIVE_STOCK_USE_CASE,
        DISPATCH_STOCK_USE_CASE,
        REVERSE_MOVEMENT_USE_CASE,
        TRANSFER_STOCK_USE_CASE,
        RECEIVE_TRANSFER_USE_CASE,
        GET_KARDEX_USE_CASE,
        GET_STOCK_ALERTS_USE_CASE,
        CREATE_STOCK_COUNT_USE_CASE,
        APPLY_STOCK_COUNT_USE_CASE,
    ],
})
export class InventoryApplicationModule {}
