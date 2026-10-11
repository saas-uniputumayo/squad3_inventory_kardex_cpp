import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { SESSION_VALIDATOR_PORT, SessionValidator, UserRole } from '@saas/contracts';
import request = require('supertest');

import { MovementStatus, MovementType, StockCountStatus, TransferStatus } from '../../src/domain/types';
import { InventoryMovementsController } from '../../src/presentation/controllers/inventory/inventory-movements.controller';
import { KardexController } from '../../src/presentation/controllers/inventory/kardex.controller';
import { ProductsController } from '../../src/presentation/controllers/inventory/products.controller';
import { StockAlertsController } from '../../src/presentation/controllers/inventory/stock-alerts.controller';
import { StockCountsController } from '../../src/presentation/controllers/inventory/stock-counts.controller';
import { TransfersController } from '../../src/presentation/controllers/inventory/transfers.controller';
import { WarehousesController } from '../../src/presentation/controllers/inventory/warehouses.controller';
import { InventoryExceptionFilter } from '../../src/presentation/filters/inventory-exception.filter';
import { JwtAuthGuard } from '../../src/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/presentation/guards/roles.guard';
import { TenantInterceptor } from '../../src/presentation/interceptors/tenant.interceptor';
import {
    APPLY_STOCK_COUNT_USE_CASE,
    CREATE_PRODUCT_USE_CASE,
    CREATE_STOCK_COUNT_USE_CASE,
    DISPATCH_STOCK_USE_CASE,
    GET_KARDEX_USE_CASE,
    GET_PRODUCT_DETAIL_USE_CASE,
    GET_STOCK_ALERTS_USE_CASE,
    LIST_WAREHOUSES_USE_CASE,
    RECEIVE_STOCK_USE_CASE,
    RECEIVE_TRANSFER_USE_CASE,
    REVERSE_MOVEMENT_USE_CASE,
    SEARCH_PRODUCTS_USE_CASE,
    TRANSFER_STOCK_USE_CASE,
    UPDATE_PRODUCT_USE_CASE,
} from '../../src/presentation/tokens';
import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { InvalidInventoryMovementException } from '../../src/domain/exceptions/invalid-inventory-movement.exception';
import { WarehouseNotFoundException } from '../../src/application/exceptions';

describe('Inventory Presentation HTTP Integration Tests', () => {
    let app: INestApplication;
    let jwtService: JwtService;
    let validAdminToken: string;
    let validCashierToken: string;
    let revokedSessionToken: string;
    let expiredToken: string;

    const mockSessionValidator: SessionValidator = {
        isSessionActive: jest.fn().mockImplementation((_userId: string, sessionId: string) => {
            return Promise.resolve(sessionId !== 'revoked-session-uuid');
        }),
    };

    const mockReceiveStockUseCase = { execute: jest.fn() };
    const mockDispatchStockUseCase = { execute: jest.fn() };
    const mockReverseMovementUseCase = { execute: jest.fn() };
    const mockTransferStockUseCase = { execute: jest.fn() };
    const mockReceiveTransferUseCase = { execute: jest.fn() };
    const mockGetKardexUseCase = { execute: jest.fn() };
    const mockGetStockAlertsUseCase = { execute: jest.fn() };
    const mockCreateProductUseCase = { execute: jest.fn() };
    const mockUpdateProductUseCase = { execute: jest.fn() };
    const mockSearchProductsUseCase = { execute: jest.fn() };
    const mockGetProductDetailUseCase = { execute: jest.fn() };
    const mockListWarehousesUseCase = { execute: jest.fn() };
    const mockCreateStockCountUseCase = { execute: jest.fn() };
    const mockApplyStockCountUseCase = { execute: jest.fn() };

    beforeAll(async () => {
        const testSecret = 'uniputumayo-saas-super-secret-jwt-key-2026';
        jwtService = new JwtService({ secret: testSecret });

        validAdminToken = jwtService.sign({
            sub: '11111111-1111-4111-8111-111111111111',
            tenantId: '22222222-2222-4222-8222-222222222222',
            role: UserRole.ADMIN,
            jti: 'active-admin-session-uuid',
        });

        validCashierToken = jwtService.sign({
            sub: '33333333-3333-4333-8333-333333333333',
            tenantId: '22222222-2222-4222-8222-222222222222',
            role: UserRole.CASHIER,
            jti: 'active-cashier-session-uuid',
        });

        revokedSessionToken = jwtService.sign({
            sub: '11111111-1111-4111-8111-111111111111',
            tenantId: '22222222-2222-4222-8222-222222222222',
            role: UserRole.ADMIN,
            jti: 'revoked-session-uuid',
        });

        expiredToken = jwtService.sign(
            {
                sub: '11111111-1111-4111-8111-111111111111',
                tenantId: '22222222-2222-4222-8222-222222222222',
                role: UserRole.ADMIN,
                jti: 'expired-session-uuid',
            },
            { expiresIn: '-1s' },
        );

        const mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'JWT_SECRET') return testSecret;
                if (key === 'JWT_EXPIRATION') return '8h';
                return null;
            }),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [
                ProductsController,
                WarehousesController,
                InventoryMovementsController,
                TransfersController,
                KardexController,
                StockAlertsController,
                StockCountsController,
            ],
            providers: [
                { provide: JwtService, useValue: jwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: SESSION_VALIDATOR_PORT, useValue: mockSessionValidator },
                JwtAuthGuard,
                RolesGuard,
                TenantInterceptor,
                { provide: RECEIVE_STOCK_USE_CASE, useValue: mockReceiveStockUseCase },
                { provide: DISPATCH_STOCK_USE_CASE, useValue: mockDispatchStockUseCase },
                { provide: REVERSE_MOVEMENT_USE_CASE, useValue: mockReverseMovementUseCase },
                { provide: TRANSFER_STOCK_USE_CASE, useValue: mockTransferStockUseCase },
                { provide: RECEIVE_TRANSFER_USE_CASE, useValue: mockReceiveTransferUseCase },
                { provide: GET_KARDEX_USE_CASE, useValue: mockGetKardexUseCase },
                { provide: GET_STOCK_ALERTS_USE_CASE, useValue: mockGetStockAlertsUseCase },
                { provide: CREATE_PRODUCT_USE_CASE, useValue: mockCreateProductUseCase },
                { provide: UPDATE_PRODUCT_USE_CASE, useValue: mockUpdateProductUseCase },
                { provide: SEARCH_PRODUCTS_USE_CASE, useValue: mockSearchProductsUseCase },
                { provide: GET_PRODUCT_DETAIL_USE_CASE, useValue: mockGetProductDetailUseCase },
                { provide: LIST_WAREHOUSES_USE_CASE, useValue: mockListWarehousesUseCase },
                { provide: CREATE_STOCK_COUNT_USE_CASE, useValue: mockCreateStockCountUseCase },
                { provide: APPLY_STOCK_COUNT_USE_CASE, useValue: mockApplyStockCountUseCase },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api/v1');
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        app.useGlobalFilters(new InventoryExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Transversal Authentication & Session Validation', () => {
        it('returns 401 Unauthorized when request lacks Bearer token', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/warehouses');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('statusCode', 401);
        });

        it('returns 401 Unauthorized when token has invalid signature or is malformed', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', 'Bearer invalid.token.payload');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('statusCode', 401);
        });

        it('returns 401 Unauthorized when JWT token has expired', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('statusCode', 401);
        });

        it('returns 401 Unauthorized when session is revoked in Redis (jti invalid)', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${revokedSessionToken}`);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('statusCode', 401);
            expect(response.body.message).toContain('Sesión expirada o invalidada');
        });

        it('returns 403 Forbidden when CASHIER attempts ReceiveStock (requires OWNER/ADMIN/WAREHOUSE_MANAGER)', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${validCashierToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    referenceDocument: 'FAC-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '10.0000',
                            unitCost: '5000.00',
                        },
                    ],
                });

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('statusCode', 403);
        });
    });

    describe('DTO Validation & Idempotency Pipeline', () => {
        it('returns 400 Bad Request when request body has invalid UUID', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    warehouseId: 'not-a-uuid',
                    referenceDocument: 'FAC-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '10.0000',
                            unitCost: '5000.00',
                        },
                    ],
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('statusCode', 400);
        });

        it('returns 201 Created on valid POST /moves/receive transporting Idempotency-Key header', async () => {
            mockReceiveStockUseCase.execute.mockResolvedValue({
                movementId: '55555555-5555-4555-8555-555555555555',
                type: MovementType.PURCHASE_RECEIPT,
                status: MovementStatus.POSTED,
                warehouseId: '44444444-4444-4444-8444-444444444444',
                referenceDocument: 'FAC-001',
                lines: [],
                totalReceivedCost: '50000.00',
                createdAt: new Date(),
            });

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .set('Idempotency-Key', 'unique-key-123')
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    referenceDocument: 'FAC-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '10.0000',
                            unitCost: '5000.00',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('movementId', '55555555-5555-4555-8555-555555555555');
            expect(mockReceiveStockUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'unique-key-123',
                    tenantId: '22222222-2222-4222-8222-222222222222',
                    performedById: '11111111-1111-4111-8111-111111111111',
                }),
            );
        });

        it('returns 201 Created on valid POST /moves/dispatch by CASHIER', async () => {
            mockDispatchStockUseCase.execute.mockResolvedValue({
                movementId: '66666666-6666-4666-8666-666666666666',
                type: MovementType.SALE_DISPATCH,
                status: MovementStatus.POSTED,
                warehouseId: '44444444-4444-4444-8444-444444444444',
                referenceDocument: 'POS-001',
                lines: [],
                totalDispatchCost: '25000.00',
                createdAt: new Date(),
            });

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${validCashierToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    referenceDocument: 'POS-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '5.0000',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('movementId', '66666666-6666-4666-8666-666666666666');
        });

        it('returns 200 OK on GET /kardex/:productId', async () => {
            mockGetKardexUseCase.execute.mockResolvedValue({
                product: {
                    id: '11111111-1111-4111-8111-111111111111',
                    sku: 'SKU-001',
                    name: 'Arroz',
                    unitOfMeasure: 'KG',
                },
                entries: [],
                pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
            });

            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/kardex/11111111-1111-4111-8111-111111111111')
                .set('Authorization', `Bearer ${validAdminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.product).toHaveProperty('sku', 'SKU-001');
        });

        it('returns 200 OK on GET /stock-alerts', async () => {
            mockGetStockAlertsUseCase.execute.mockResolvedValue({
                data: [],
                meta: { total: 0 },
            });

            const response = await request(app.getHttpServer())
                .get('/api/v1/inventory/stock-alerts')
                .set('Authorization', `Bearer ${validAdminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('meta');
        });

        it('returns 201 Created on POST /transfers', async () => {
            mockTransferStockUseCase.execute.mockResolvedValue({
                transferId: '77777777-7777-4777-8777-777777777777',
                status: TransferStatus.COMPLETED,
                referenceDocument: 'TR-001',
                sourceWarehouseId: '44444444-4444-4444-8444-444444444444',
                destinationWarehouseId: '55555555-5555-4555-8555-555555555555',
                lines: [],
                createdAt: new Date(),
            });

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/transfers')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    sourceWarehouseId: '44444444-4444-4444-8444-444444444444',
                    destinationWarehouseId: '55555555-5555-4555-8555-555555555555',
                    referenceDocument: 'TR-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '2.0000',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('transferId', '77777777-7777-4777-8777-777777777777');
        });
    });

    describe('Stock Counts Endpoints (POST /stock-counts and POST /stock-counts/:id/apply)', () => {
        it('returns 201 Created on POST /stock-counts (creation of stock count)', async () => {
            mockCreateStockCountUseCase.execute.mockResolvedValue({
                stockCountId: '88888888-8888-4888-8888-888888888888',
                warehouseId: '44444444-4444-4444-8444-444444444444',
                status: StockCountStatus.DRAFT,
                description: 'Conteo mensual octubre',
                lines: [
                    {
                        lineId: '99999999-9999-4999-8999-999999999999',
                        productId: '11111111-1111-4111-8111-111111111111',
                        systemQuantity: '10.0000',
                        countedQuantity: '10.0000',
                        differenceQuantity: '0.0000',
                        unitCost: '5000.00',
                    },
                ],
                createdAt: new Date(),
            });

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/stock-counts')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    notes: 'Conteo mensual octubre',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('stockCountId', '88888888-8888-4888-8888-888888888888');
            expect(response.body).toHaveProperty('status', StockCountStatus.DRAFT);
            expect(mockCreateStockCountUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    tenantId: '22222222-2222-4222-8222-222222222222',
                    performedById: '11111111-1111-4111-8111-111111111111',
                }),
            );
        });

        it('returns 200 OK on POST /stock-counts/:id/apply with Idempotency-Key', async () => {
            mockApplyStockCountUseCase.execute.mockResolvedValue({
                stockCountId: '88888888-8888-4888-8888-888888888888',
                warehouseId: '44444444-4444-4444-8444-444444444444',
                status: StockCountStatus.COMPLETED,
                description: 'Conteo mensual octubre aplicado',
                lines: [],
                adjustmentMovements: [],
                createdAt: new Date(),
            });

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/stock-counts/88888888-8888-4888-8888-888888888888/apply')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .set('Idempotency-Key', 'idemp-count-apply-001')
                .send({
                    counts: [
                        {
                            lineId: '99999999-9999-4999-8999-999999999999',
                            countedQuantity: '12.0000',
                        },
                    ],
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', StockCountStatus.COMPLETED);
            expect(mockApplyStockCountUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    stockCountId: '88888888-8888-4888-8888-888888888888',
                    tenantId: '22222222-2222-4222-8222-222222222222',
                    idempotencyKey: 'idemp-count-apply-001',
                    performedById: '11111111-1111-4111-8111-111111111111',
                }),
            );
        });

        it('returns 403 Forbidden when CASHIER attempts to create or apply a stock count', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/stock-counts')
                .set('Authorization', `Bearer ${validCashierToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    description: 'Conteo no autorizado',
                });

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('statusCode', 403);
        });
    });

    describe('Semantic Exception Filter HTTP Responses', () => {
        it('maps 404 Not Found when warehouse does not exist', async () => {
            mockReceiveStockUseCase.execute.mockRejectedValue(
                new WarehouseNotFoundException('wh-not-found-id'),
            );

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    referenceDocument: 'FAC-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '10.0000',
                            unitCost: '5000.00',
                        },
                    ],
                });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('statusCode', 404);
            expect(response.body).toHaveProperty('code', 'WAREHOUSE_NOT_FOUND');
        });

        it('maps 409 Conflict when movement is already reversed', async () => {
            mockReverseMovementUseCase.execute.mockRejectedValue(
                new InvalidInventoryMovementException('Movement is already reversed'),
            );

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/reverse')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    movementId: '55555555-5555-4555-8555-555555555555',
                    reason: 'Duplicate entry',
                });

            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('statusCode', 409);
            expect(response.body).toHaveProperty('code', 'INVALID_INVENTORY_MOVEMENT');
        });

        it('maps 422 Unprocessable Entity when available stock balance is insufficient', async () => {
            mockDispatchStockUseCase.execute.mockRejectedValue(
                new InvalidInventoryBalanceException('Available balance is insufficient for dispatch'),
            );

            const response = await request(app.getHttpServer())
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    warehouseId: '44444444-4444-4444-8444-444444444444',
                    referenceDocument: 'POS-001',
                    lines: [
                        {
                            productId: '11111111-1111-4111-8111-111111111111',
                            quantity: '999.0000',
                        },
                    ],
                });

            expect(response.status).toBe(422);
            expect(response.body).toHaveProperty('statusCode', 422);
            expect(response.body).toHaveProperty('code', 'INVALID_INVENTORY_BALANCE');
        });
    });
});
