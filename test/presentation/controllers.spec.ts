import Decimal from 'decimal.js';
import { ProductsController } from '../../src/presentation/controllers/inventory/products.controller';
import { WarehousesController } from '../../src/presentation/controllers/inventory/warehouses.controller';
import { InventoryMovementsController } from '../../src/presentation/controllers/inventory/inventory-movements.controller';
import { TransfersController } from '../../src/presentation/controllers/inventory/transfers.controller';
import { KardexController } from '../../src/presentation/controllers/inventory/kardex.controller';
import { StockAlertsController } from '../../src/presentation/controllers/inventory/stock-alerts.controller';
import { StockCountsController } from '../../src/presentation/controllers/inventory/stock-counts.controller';
import { AuthenticatedUser } from '../../src/presentation/decorators/current-user.decorator';
import { UserRole } from '@saas/contracts';
import { CostMethod, MovementSource, MovementStatus, MovementType, ProductStructure, ProductType, ReferenceType, StockCountStatus, TransferStatus } from '../../src/domain/types';

describe('Presentation Layer - Controllers Unit Tests', () => {
    const mockUser: AuthenticatedUser = {
        sub: 'actor-uuid-1111',
        tenantId: 'tenant-uuid-2222',
        role: UserRole.ADMIN,
        jti: 'session-uuid-3333',
    };

    describe('ProductsController', () => {
        let controller: ProductsController;
        let createProductUseCase: { execute: jest.Mock };
        let updateProductUseCase: { execute: jest.Mock };
        let searchProductsUseCase: { execute: jest.Mock };
        let getProductDetailUseCase: { execute: jest.Mock };

        beforeEach(() => {
            createProductUseCase = { execute: jest.fn() };
            updateProductUseCase = { execute: jest.fn() };
            searchProductsUseCase = { execute: jest.fn() };
            getProductDetailUseCase = { execute: jest.fn() };

            controller = new ProductsController(
                createProductUseCase as any,
                updateProductUseCase as any,
                searchProductsUseCase as any,
                getProductDetailUseCase as any,
            );
        });

        it('POST /products passes tenantId from user and converts prices to Decimal', async () => {
            const dto = {
                sku: 'SKU-001',
                name: 'Test Product',
                unitOfMeasureId: 'uom-1',
                costPrice: '1500.50',
                salePrice: '2500.00',
                costMethod: CostMethod.WEIGHTED_AVERAGE,
                productType: ProductType.STOCKABLE,
                structure: ProductStructure.SIMPLE,
            };
            const mockResult = { id: 'p-1', sku: 'SKU-001', name: 'Test Product' };
            createProductUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.create(dto as any, mockUser);

            expect(createProductUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    sku: 'SKU-001',
                    costPrice: new Decimal('1500.50'),
                    salePrice: new Decimal('2500.00'),
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('PATCH /products/:id passes productId from param and tenantId from user', async () => {
            const dto = { name: 'Updated Name', salePrice: '3000.00' };
            const mockResult = { id: 'p-1', name: 'Updated Name' };
            updateProductUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.update('p-1', dto as any, mockUser);

            expect(updateProductUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    productId: 'p-1',
                    name: 'Updated Name',
                    salePrice: new Decimal('3000.00'),
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('GET /products passes query parameters and tenantId from user', async () => {
            const query = { search: 'arepa', page: 1, limit: 10 };
            const mockResult = { data: [], pagination: { total: 0 } };
            searchProductsUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.search(query as any, mockUser);

            expect(searchProductsUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    search: 'arepa',
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('GET /products/:id passes productId and warehouseId with tenantId from user', async () => {
            const mockResult = { id: 'p-1', sku: 'SKU-001' };
            getProductDetailUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.getDetail('p-1', 'wh-1', mockUser);

            expect(getProductDetailUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                productId: 'p-1',
                warehouseId: 'wh-1',
            });
            expect(result).toBe(mockResult);
        });
    });

    describe('WarehousesController', () => {
        let controller: WarehousesController;
        let listWarehousesUseCase: { execute: jest.Mock };

        beforeEach(() => {
            listWarehousesUseCase = { execute: jest.fn() };
            controller = new WarehousesController(listWarehousesUseCase as any);
        });

        it('GET /warehouses passes tenantId and query filters to use case', async () => {
            const mockWarehouses = [{ id: 'wh-1', name: 'Bodega Central' }];
            listWarehousesUseCase.execute.mockResolvedValue(mockWarehouses);

            const result = await controller.list({ onlyActive: true, branchId: 'br-1' } as any, mockUser);

            expect(listWarehousesUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                onlyActive: true,
                branchId: 'br-1',
            });
            expect(result).toBe(mockWarehouses);
        });
    });

    describe('InventoryMovementsController', () => {
        let controller: InventoryMovementsController;
        let receiveStockUseCase: { execute: jest.Mock };
        let dispatchStockUseCase: { execute: jest.Mock };
        let reverseMovementUseCase: { execute: jest.Mock };

        beforeEach(() => {
            receiveStockUseCase = { execute: jest.fn() };
            dispatchStockUseCase = { execute: jest.fn() };
            reverseMovementUseCase = { execute: jest.fn() };

            controller = new InventoryMovementsController(
                receiveStockUseCase as any,
                dispatchStockUseCase as any,
                reverseMovementUseCase as any,
            );
        });

        it('POST /moves/receive transfers actorId, tenantId, idempotencyKey and decimals', async () => {
            const dto = {
                warehouseId: 'wh-1',
                referenceDocument: 'FAC-001',
                lines: [
                    { productId: 'p-1', quantity: '10.5000', unitCost: '12000.00' },
                ],
            };
            const mockResult = { movementId: 'm-1', status: MovementStatus.POSTED };
            receiveStockUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.receive(dto as any, mockUser, 'idemp-key-1');

            expect(receiveStockUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    performedById: mockUser.sub,
                    idempotencyKey: 'idemp-key-1',
                    warehouseId: 'wh-1',
                    lines: [
                        {
                            productId: 'p-1',
                            variantId: undefined,
                            quantity: new Decimal('10.5000'),
                            unitCost: new Decimal('12000.00'),
                        },
                    ],
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('POST /moves/dispatch transfers actorId, tenantId, idempotencyKey and decimals', async () => {
            const dto = {
                warehouseId: 'wh-1',
                referenceDocument: 'REM-001',
                lines: [
                    { productId: 'p-1', quantity: '5.0000' },
                ],
            };
            const mockResult = { movementId: 'm-2', status: MovementStatus.POSTED };
            dispatchStockUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.dispatch(dto as any, mockUser, 'idemp-key-2');

            expect(dispatchStockUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    performedById: mockUser.sub,
                    idempotencyKey: 'idemp-key-2',
                    warehouseId: 'wh-1',
                    lines: [
                        {
                            productId: 'p-1',
                            variantId: undefined,
                            quantity: new Decimal('5.0000'),
                        },
                    ],
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('POST /moves/reverse transfers movementId, reason, actorId, and idempotencyKey', async () => {
            const dto = { movementId: 'm-1', reason: 'Error en digitación' };
            const mockResult = { reversedMovementId: 'm-1', status: MovementStatus.REVERSED };
            reverseMovementUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.reverse(dto as any, mockUser, 'idemp-key-3');

            expect(reverseMovementUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                performedById: mockUser.sub,
                idempotencyKey: 'idemp-key-3',
                movementId: 'm-1',
                reason: 'Error en digitación',
                referenceType: undefined,
                referenceId: undefined,
                referenceDocument: undefined,
            });
            expect(result).toBe(mockResult);
        });
    });

    describe('TransfersController', () => {
        let controller: TransfersController;
        let transferStockUseCase: { execute: jest.Mock };
        let receiveTransferUseCase: { execute: jest.Mock };

        beforeEach(() => {
            transferStockUseCase = { execute: jest.fn() };
            receiveTransferUseCase = { execute: jest.fn() };

            controller = new TransfersController(
                transferStockUseCase as any,
                receiveTransferUseCase as any,
            );
        });

        it('POST /transfers transfers actorId, tenantId, lines with Decimals and idempotencyKey', async () => {
            const dto = {
                sourceWarehouseId: 'wh-1',
                destinationWarehouseId: 'wh-2',
                referenceDocument: 'TR-001',
                lines: [{ productId: 'p-1', quantity: '8.0000' }],
            };
            const mockResult = { transferId: 'tr-1', status: TransferStatus.COMPLETED };
            transferStockUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.transfer(dto as any, mockUser, 'idemp-tr-1');

            expect(transferStockUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    performedById: mockUser.sub,
                    idempotencyKey: 'idemp-tr-1',
                    sourceWarehouseId: 'wh-1',
                    destinationWarehouseId: 'wh-2',
                    lines: [
                        {
                            productId: 'p-1',
                            variantId: undefined,
                            quantity: new Decimal('8.0000'),
                        },
                    ],
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('POST /transfers/:id/receive confirms receipt with transferId param and actorId', async () => {
            const mockResult = { transferId: 'tr-1', status: TransferStatus.COMPLETED };
            receiveTransferUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.receiveTransfer('tr-1', mockUser, 'idemp-tr-2');

            expect(receiveTransferUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                performedById: mockUser.sub,
                transferId: 'tr-1',
                idempotencyKey: 'idemp-tr-2',
            });
            expect(result).toBe(mockResult);
        });
    });

    describe('KardexController', () => {
        let controller: KardexController;
        let getKardexUseCase: { execute: jest.Mock };

        beforeEach(() => {
            getKardexUseCase = { execute: jest.fn() };
            controller = new KardexController(getKardexUseCase as any);
        });

        it('GET /kardex/:productId passes productId from param, tenantId and filters', async () => {
            const mockResult = { product: { id: 'p-1' }, entries: [] };
            getKardexUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.getKardex(
                'p-1',
                { warehouseId: 'wh-1', page: 1, limit: 50 } as any,
                mockUser,
            );

            expect(getKardexUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    productId: 'p-1',
                    warehouseId: 'wh-1',
                    page: 1,
                    limit: 50,
                }),
            );
            expect(result).toBe(mockResult);
        });
    });

    describe('StockAlertsController', () => {
        let controller: StockAlertsController;
        let getStockAlertsUseCase: { execute: jest.Mock };

        beforeEach(() => {
            getStockAlertsUseCase = { execute: jest.fn() };
            controller = new StockAlertsController(getStockAlertsUseCase as any);
        });

        it('GET /stock-alerts passes tenantId and search filters to use case', async () => {
            const mockResult = { data: [], meta: { total: 0 } };
            getStockAlertsUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.getAlerts(
                { warehouseId: 'wh-1', search: 'arroz' } as any,
                mockUser,
            );

            expect(getStockAlertsUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                warehouseId: 'wh-1',
                search: 'arroz',
                page: undefined,
                limit: undefined,
            });
            expect(result).toBe(mockResult);
        });
    });

    describe('StockCountsController', () => {
        let controller: StockCountsController;
        let createStockCountUseCase: { execute: jest.Mock };
        let applyStockCountUseCase: { execute: jest.Mock };

        beforeEach(() => {
            createStockCountUseCase = { execute: jest.fn() };
            applyStockCountUseCase = { execute: jest.fn() };

            controller = new StockCountsController(
                createStockCountUseCase as any,
                applyStockCountUseCase as any,
            );
        });

        it('POST /stock-counts passes warehouseId, tenantId and actorId', async () => {
            const dto = { warehouseId: 'wh-1', notes: 'Auditoría mensual' };
            const mockResult = { id: 'sc-1', status: StockCountStatus.DRAFT };
            createStockCountUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.create(dto as any, mockUser);

            expect(createStockCountUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockUser.tenantId,
                    warehouseId: 'wh-1',
                    notes: 'Auditoría mensual',
                    performedById: mockUser.sub,
                }),
            );
            expect(result).toBe(mockResult);
        });

        it('POST /stock-counts/:id/apply passes stockCountId param, counts with Decimals and idempotencyKey', async () => {
            const dto = {
                counts: [{ lineId: 'line-1', countedQuantity: '15.0000' }],
            };
            const mockResult = { stockCountId: 'sc-1', status: StockCountStatus.COMPLETED };
            applyStockCountUseCase.execute.mockResolvedValue(mockResult);

            const result = await controller.apply('sc-1', dto as any, mockUser, 'idemp-sc-1');

            expect(applyStockCountUseCase.execute).toHaveBeenCalledWith({
                tenantId: mockUser.tenantId,
                stockCountId: 'sc-1',
                performedById: mockUser.sub,
                idempotencyKey: 'idemp-sc-1',
                counts: [
                    {
                        lineId: 'line-1',
                        countedQuantity: new Decimal('15.0000'),
                        notes: undefined,
                    },
                ],
            });
            expect(result).toBe(mockResult);
        });
    });
});
