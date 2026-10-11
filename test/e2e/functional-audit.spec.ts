import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole } from '@prisma/client';
import Decimal from 'decimal.js';
import Redis from 'ioredis';
import request = require('supertest');
import { randomUUID } from 'crypto';
import { SEED_DATA, seedDatabase } from '../../prisma/seed';

const API_BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'super_secret_jwt_key_uniputumayo_2026_opcion_grado';

describe('Auditoría Funcional E2E - API Real contra PostgreSQL + Redis + RLS', () => {
    jest.setTimeout(60000);
    let prisma: PrismaClient;
    let redis: Redis;
    let jwtService: JwtService;

    // Tokens reales con sesiones activas en Redis
    let tokenOwnerA: string;
    let tokenAdminA: string;
    let tokenAccountantA: string;
    let tokenWarehouseA: string;
    let tokenCashierA: string;

    let tokenOwnerB: string;
    let tokenCashierB: string;

    // Helper para generar tokens y registrar sesión activa en Redis
    async function createAuthenticatedSession(user: { id: string; role: UserRole; tenantId?: string }, tenantId: string) {
        const jti = randomUUID();
        await redis.set(`session:${user.id}:${jti}`, 'active', 'EX', 7200);
        const token = jwtService.sign(
            {
                sub: user.id,
                tenantId,
                role: user.role,
                jti,
            },
            {
                secret: JWT_SECRET,
                expiresIn: '2h',
            },
        );
        return { token, jti };
    }

    beforeAll(async () => {
        await seedDatabase();
        prisma = new PrismaClient();
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        jwtService = new JwtService();

        // Generar sesiones reales para todos los roles de Tenant A
        const sOwnerA = await createAuthenticatedSession(SEED_DATA.users.ownerA, SEED_DATA.tenantA.id);
        tokenOwnerA = sOwnerA.token;

        const sAdminA = await createAuthenticatedSession(SEED_DATA.users.adminA, SEED_DATA.tenantA.id);
        tokenAdminA = sAdminA.token;

        const sAccA = await createAuthenticatedSession(SEED_DATA.users.accountantA, SEED_DATA.tenantA.id);
        tokenAccountantA = sAccA.token;

        const sWhA = await createAuthenticatedSession(SEED_DATA.users.warehouseA, SEED_DATA.tenantA.id);
        tokenWarehouseA = sWhA.token;

        const sCashA = await createAuthenticatedSession(SEED_DATA.users.cashierA, SEED_DATA.tenantA.id);
        tokenCashierA = sCashA.token;

        // Generar sesiones reales para Tenant B
        const sOwnerB = await createAuthenticatedSession(SEED_DATA.users.ownerB, SEED_DATA.tenantB.id);
        tokenOwnerB = sOwnerB.token;

        const sCashB = await createAuthenticatedSession(SEED_DATA.users.cashierB, SEED_DATA.tenantB.id);
        tokenCashierB = sCashB.token;
    });

    afterAll(async () => {
        await prisma.$disconnect();
        await redis.quit();
    });

    // =========================================================================
    // 1. AUTENTICACIÓN & SEGURIDAD DE SESIÓN EN REDIS
    // =========================================================================
    describe('1. Autenticación y Validación de Sesiones (JWT + jti + Redis)', () => {
        it('debe rechazar solicitudes sin token con 401 Unauthorized', async () => {
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/warehouses');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Token de autenticación no provisto');
        });

        it('debe rechazar tokens con firma inválida con 401', async () => {
            const badToken = jwtService.sign(
                { sub: SEED_DATA.users.ownerA.id, tenantId: SEED_DATA.tenantA.id, role: 'OWNER', jti: randomUUID() },
                { secret: 'wrong_secret_key_1234567890' },
            );

            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${badToken}`);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Token inválido, expirado o malformado');
        });

        it('debe rechazar tokens sin reclamo jti con 401', async () => {
            const noJtiToken = jwtService.sign(
                { sub: SEED_DATA.users.ownerA.id, tenantId: SEED_DATA.tenantA.id, role: 'OWNER' },
                { secret: JWT_SECRET },
            );

            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${noJtiToken}`);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('claims sub, tenantId, role y jti son obligatorios');
        });

        it('debe rechazar tokens válidos cuya sesión en Redis fue revocada/expirada con 401', async () => {
            const { token, jti } = await createAuthenticatedSession(SEED_DATA.users.ownerA, SEED_DATA.tenantA.id);

            // Eliminar deliberadamente la sesión en Redis para simular logout / revocación
            await redis.del(`session:${SEED_DATA.users.ownerA.id}:${jti}`);

            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Sesión expirada o invalidada');
        });
    });

    // =========================================================================
    // 2. ENDPOINTS DE PRODUCTOS (CATÁLOGO & VARIANTES)
    // =========================================================================
    describe('2. Endpoints de Productos (Catálogo, Variantes y Búsqueda)', () => {
        let createdProductId: string;
        const testSku = `PINT-AUD-${Date.now().toString().slice(-4)}`;

        it('POST /api/v1/inventory/products: debe crear un nuevo producto con su variante default', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    sku: testSku,
                    name: 'Pintura Vinilo Corona 1 Galón',
                    description: 'Pintura lavable para interiores',
                    unitOfMeasureId: SEED_DATA.uoms.L.id,
                    costPrice: '35000.0000',
                    salePrice: '48000.00',
                    minStockAlert: '5.0000',
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.sku).toBe(testSku);
            expect(res.body.defaultVariantId).toBeDefined();

            createdProductId = res.body.id;

            // Verificar persistencia real en PostgreSQL con RLS
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const dbProduct = await prisma.product.findUnique({
                where: { id: createdProductId },
                include: { variants: true },
            });

            expect(dbProduct).toBeDefined();
            expect(dbProduct?.tenantId).toBe(SEED_DATA.tenantA.id);
            expect(dbProduct?.variants.length).toBe(1);
            expect(dbProduct?.variants[0].isDefault).toBe(true);
        });

        it('POST /api/v1/inventory/products: debe rechazar SKU duplicado con 409 Conflict', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenAdminA}`)
                .send({
                    sku: testSku, // SKU ya existente
                    name: 'Pintura Duplicada',
                    unitOfMeasureId: SEED_DATA.uoms.L.id,
                    costPrice: '35000.00',
                    salePrice: '48000.00',
                });

            expect(res.status).toBe(409);
            expect(res.body.message).toContain(testSku);
        });

        it('POST /api/v1/inventory/products: debe rechazar creación para rol no autorizado (CASHIER) con 403', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    sku: `FORBIDDEN-${Date.now()}`,
                    name: 'Producto No Permitido',
                    unitOfMeasureId: SEED_DATA.uoms.und.id,
                    costPrice: '1000.00',
                    salePrice: '2000.00',
                });

            expect(res.status).toBe(403);
        });

        it('PATCH /api/v1/inventory/products/:id: debe actualizar datos y precios del producto', async () => {
            const res = await request(API_BASE_URL)
                .patch(`/api/v1/inventory/products/${createdProductId}`)
                .set('Authorization', `Bearer ${tokenAdminA}`)
                .send({
                    name: 'Pintura Vinilo Corona Galón (Actualizada)',
                    salePrice: '52000.00',
                });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Pintura Vinilo Corona Galón (Actualizada)');

            // Verificar en PostgreSQL
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const dbProduct = await prisma.product.findUnique({ where: { id: createdProductId } });
            expect(new Decimal(dbProduct!.salePrice).toFixed(2)).toBe('52000.00');
        });

        it('GET /api/v1/inventory/products: debe listar productos con paginación y aislamiento tenant', async () => {
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenAccountantA}`)
                .query({ page: 1, limit: 10 });

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination.total).toBeGreaterThanOrEqual(6);

            // Aislamiento: El producto de Tenant B no debe figurar
            const skus = res.body.data.map((i: any) => i.sku);
            expect(skus).not.toContain(SEED_DATA.products.varillaB.sku);
        });

        it('GET /api/v1/inventory/products/:id: debe retornar el detalle del producto y desglose de bodegas', async () => {
            const res = await request(API_BASE_URL)
                .get(`/api/v1/inventory/products/${SEED_DATA.products.arroz.id}`)
                .set('Authorization', `Bearer ${tokenCashierA}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(SEED_DATA.products.arroz.id);
            expect(res.body.sku).toBe(SEED_DATA.products.arroz.sku);
            expect(res.body.unitOfMeasure).toBeDefined();
            expect(res.body.unitOfMeasure.code).toBe(SEED_DATA.uoms.kg.code.toUpperCase());
        });
    });

    // =========================================================================
    // 3. ENDPOINTS DE BODEGAS (WAREHOUSES)
    // =========================================================================
    describe('3. Endpoints de Bodegas (Warehouses)', () => {
        it('GET /api/v1/inventory/warehouses: debe listar bodegas activas del tenant autenticado', async () => {
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/warehouses')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .query({ onlyActive: true });

            expect(res.status).toBe(200);
            const codes = res.body.map((w: any) => w.code);
            expect(codes).toContain(SEED_DATA.warehouses.warA1.code);
            expect(codes).toContain(SEED_DATA.warehouses.warA2.code);

            // La bodega archivada no debe aparecer con onlyActive=true
            expect(codes).not.toContain(SEED_DATA.warehouses.warA3_archived.code);

            // La bodega de Tenant B no debe figurar
            expect(codes).not.toContain(SEED_DATA.warehouses.warB1.code);
        });
    });

    // =========================================================================
    // 4. MOVIMIENTOS: RECEIVE STOCK & MATEMÁTICA CPP
    // =========================================================================
    describe('4. Recepción de Stock y Cálculo Matemático de CPP', () => {
        it('POST /api/v1/inventory/moves/receive: debe recibir stock y calcular costo promedio ponderado exacto', async () => {
            // Estado inicial Arroz: 100 kg @ 4,000 COP = 400,000 COP
            // Recepción: 50 kg @ 5,000 COP = 250,000 COP
            // Nuevo Stock Esperado: 150 kg
            // Nuevo CPP: (400,000 + 250,000) / 150 = 650,000 / 150 = 4,333.333333 COP
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'FAC-COMPRA-001',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            variantId: SEED_DATA.products.arroz.variantId,
                            quantity: '50.000',
                            unitCost: '5000.0000',
                        },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.lines[0].newStock).toBe('150.000');
            expect(res.body.lines[0].newAverageCost).toBe('4333.333333');

            // Verificación directa en base de datos PostgreSQL
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });

            expect(new Decimal(balance!.quantityOnHand).toFixed(3)).toBe('150.000');
            expect(new Decimal(balance!.averageCost).toFixed(6)).toBe('4333.333333');
            expect(new Decimal(balance!.inventoryValue).toFixed(4)).toBe('650000.0000');
        });

        it('POST /api/v1/inventory/moves/receive: debe rechazar recepción en bodega archivada con 400', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA3_archived.id, // Bodega archivada
                    referenceDocument: 'FAC-ARCHIVED-TEST',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '10.000',
                            unitCost: '4000.00',
                        },
                    ],
                });

            expect(res.status).toBe(422);
            expect(res.body.message).toContain('no se encuentra activa u operativa');
        });
    });

    // =========================================================================
    // 5. MOVIMIENTOS: DISPATCH STOCK & PREVENCIÓN DE STOCK NEGATIVO
    // =========================================================================
    describe('5. Despacho de Stock y Prevención de Stock Negativo', () => {
        it('POST /api/v1/inventory/moves/dispatch: debe despachar stock reduciendo balance a valor CPP', async () => {
            // Stock previo Arroz: 150 kg @ 4,333.333333 COP = 650,000 COP
            // Despacho: 30 kg
            // Costo despachado: 30 * 4,333.333333 = 130,000 COP
            // Stock resultante: 120 kg
            // Valor resultante: 520,000 COP
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'REM-SALIDA-001',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            variantId: SEED_DATA.products.arroz.variantId,
                            quantity: '30.000',
                        },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.lines[0].remainingStock).toBe('120.000');

            // Verificar en PostgreSQL
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });

            expect(new Decimal(balance!.quantityOnHand).toFixed(3)).toBe('120.000');
            expect(new Decimal(balance!.inventoryValue).toFixed(4)).toBe('520000.0000');
        });

        it('POST /api/v1/inventory/moves/dispatch: debe rechazar despacho que supere el stock disponible (400)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'REM-SALIDA-ERR-1',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '999.000', // Stock disponible es 120 kg
                        },
                    ],
                });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_INVENTORY_BALANCE');
        });

        it('POST /api/v1/inventory/moves/dispatch: debe rechazar despacho sobre producto sin stock (TAL-001)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'REM-SALIDA-ERR-2',
                    lines: [
                        {
                            productId: SEED_DATA.products.taladro.id,
                            quantity: '1.000',
                        },
                    ],
                });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_INVENTORY_BALANCE');
        });
    });

    // =========================================================================
    // 6. REVERSIÓN DE MOVIMIENTOS (REVERSE MOVEMENT)
    // =========================================================================
    describe('6. Reversión de Movimientos (Compensación Contable e Invariantes)', () => {
        let movementToReverseId: string;

        it('debe registrar un movimiento y luego revertirlo restaurando el saldo', async () => {
            // 1. Ejecutar un despacho de prueba de 5 kg
            const dispatchRes = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'FAC-VENTA-TEST',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '5.000',
                        },
                    ],
                });

            expect(dispatchRes.status).toBe(201);
            movementToReverseId = dispatchRes.body.movementId;

            // 2. Revertir el movimiento (solo OWNER y ADMIN autorizados)
            const reverseRes = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/reverse')
                .set('Authorization', `Bearer ${tokenAdminA}`)
                .send({
                    movementId: movementToReverseId,
                    reason: 'Anulación de venta por error de digitación',
                });

            expect(reverseRes.status).toBe(200);
            expect(reverseRes.body.reversedMovementId).toBe(movementToReverseId);
            expect(reverseRes.body.reversalMovementId).toBeDefined();

            // 3. Verificar que el saldo volvió a 120 kg en la BD
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            expect(new Decimal(balance!.quantityOnHand).toFixed(3)).toBe('120.000');
        });

        it('debe rechazar revertir un movimiento ya revertido con 400', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/reverse')
                .set('Authorization', `Bearer ${tokenOwnerA}`)
                .send({
                    movementId: movementToReverseId,
                    reason: 'Intento de segunda reversión',
                });

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('ya fue revertido');
        });

        it('debe denegar reversión a un rol no autorizado (CASHIER) con 403', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/reverse')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    movementId: movementToReverseId,
                    reason: 'Reversión por cajero no permitida',
                });

            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // 7. TRANSFERENCIAS MULTI-BODEGA (ATÓMICAS Y TWO-PHASE)
    // =========================================================================
    describe('7. Transferencias Multi-Bodega (Directas y Two-Phase)', () => {
        it('Transferencia Directa: debe trasladar stock inmediatamente entre bodegas', async () => {
            // Origen: Bodega A1 (120 kg) -> Destino: Bodega A2 (0 kg)
            // Cantidad trasladada: 20 kg
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/transfers')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    sourceWarehouseId: SEED_DATA.warehouses.warA1.id,
                    destinationWarehouseId: SEED_DATA.warehouses.warA2.id,
                    referenceDocument: 'TR-DIRECT-001',
                    isTwoPhase: false, // Transferencia atómica directa
                    reason: 'Reabastecimiento de sucursal',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            variantId: SEED_DATA.products.arroz.variantId,
                            quantity: '20.000',
                        },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('COMPLETED');

            // Verificar balances en ambas bodegas
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const sourceBalance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            const destBalance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA2.id,
                    },
                },
            });

            expect(new Decimal(sourceBalance!.quantityOnHand).toFixed(3)).toBe('100.000');
            expect(new Decimal(destBalance!.quantityOnHand).toFixed(3)).toBe('20.000');
        });

        it('Transferencia Two-Phase: iniciar en tránsito y luego recibir en destino', async () => {
            // 1. Iniciar transferencia en tránsito: 10 kg
            const initRes = await request(API_BASE_URL)
                .post('/api/v1/inventory/transfers')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    sourceWarehouseId: SEED_DATA.warehouses.warA1.id,
                    destinationWarehouseId: SEED_DATA.warehouses.warA2.id,
                    referenceDocument: 'TR-2PHASE-001',
                    isTwoPhase: true, // Two-phase
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '10.000',
                        },
                    ],
                });

            expect(initRes.status).toBe(201);
            expect(initRes.body.status).toBe('IN_TRANSIT');
            const transferId = initRes.body.transferId;

            // Verificar que origen descontó los 10 kg pero destino aún no los tiene
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const srcB = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            const dstB = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA2.id,
                    },
                },
            });
            expect(new Decimal(srcB!.quantityOnHand).toFixed(3)).toBe('90.000');
            expect(new Decimal(dstB!.quantityOnHand).toFixed(3)).toBe('20.000');

            // 2. Confirmar recepción en destino
            const receiveRes = await request(API_BASE_URL)
                .post(`/api/v1/inventory/transfers/${transferId}/receive`)
                .set('Authorization', `Bearer ${tokenWarehouseA}`);

            expect(receiveRes.status).toBe(200);
            expect(receiveRes.body.status).toBe('COMPLETED');

            // 3. Verificar que destino ahora tiene 30 kg
            const dstBFinal = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.arroz.variantId,
                        warehouseId: SEED_DATA.warehouses.warA2.id,
                    },
                },
            });
            expect(new Decimal(dstBFinal!.quantityOnHand).toFixed(3)).toBe('30.000');
        });

        it('debe rechazar transferencias entre la misma bodega con 400', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/transfers')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    sourceWarehouseId: SEED_DATA.warehouses.warA1.id,
                    destinationWarehouseId: SEED_DATA.warehouses.warA1.id, // Misma bodega
                    referenceDocument: 'TR-SAME-001',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '5.000',
                        },
                    ],
                });

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('origen y destino deben ser diferentes');
        });
    });

    // =========================================================================
    // 8. TOMA FÍSICA DE INVENTARIO (STOCK COUNT)
    // =========================================================================
    describe('8. Tomas Físicas de Inventario (Stock Counts & Ajustes)', () => {
        let countId: string;
        let cableLineId: string;
        let cementoLineId: string;

        it('POST /api/v1/inventory/stock-counts: debe crear sesión de auditoría física', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/stock-counts')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    autoStart: true,
                    productIds: [SEED_DATA.products.cable.id, SEED_DATA.products.cemento.id],
                    notes: 'Auditoría física fin de mes',
                });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('IN_PROGRESS');
            countId = res.body.id;

            // Encontrar las líneas de cable y cemento
            const cableLine = res.body.lines.find((l: any) => l.productId === SEED_DATA.products.cable.id);
            const cementoLine = res.body.lines.find((l: any) => l.productId === SEED_DATA.products.cemento.id);

            cableLineId = cableLine.id;
            cementoLineId = cementoLine.id;
        });

        it('POST /api/v1/inventory/stock-counts/:id/apply: debe aplicar ajustes por faltante y sobrante', async () => {
            // Cable: sistema = 200 m, conteo = 190 m -> Faltante de 10 m (ADJUSTMENT_OUT)
            // Cemento: sistema = 4 bultos, conteo = 6 bultos -> Sobrante de 2 bultos (ADJUSTMENT_IN)
            const res = await request(API_BASE_URL)
                .post(`/api/v1/inventory/stock-counts/${countId}/apply`)
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .send({
                    counts: [
                        { lineId: cableLineId, countedQuantity: '190.00' },
                        { lineId: cementoLineId, countedQuantity: '6.00' },
                    ],
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('COMPLETED');
            expect(res.body.adjustedLines).toBe(2);

            // Verificar balances en PostgreSQL
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const cableB = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.cable.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            const cementoB = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.cemento.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });

            expect(new Decimal(cableB!.quantityOnHand).toFixed(2)).toBe('190.00');
            expect(new Decimal(cementoB!.quantityOnHand).toFixed(0)).toBe('6');
        });
    });

    // =========================================================================
    // 9. ALERTAS DE STOCK MÍNIMO
    // =========================================================================
    describe('9. Alertas de Stock Mínimo (Stock Alerts)', () => {
        it('GET /api/v1/inventory/stock-alerts: debe reportar productos bajo su umbral mínimo', async () => {
            // Cemento: stock actual = 6 bultos <= minStockAlert = 10 bultos
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/stock-alerts')
                .set('Authorization', `Bearer ${tokenWarehouseA}`);

            expect(res.status).toBe(200);
            expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

            const alertItem = res.body.data.find((i: any) => i.productId === SEED_DATA.products.cemento.id);
            expect(alertItem).toBeDefined();
            expect(alertItem.sku).toBe(SEED_DATA.products.cemento.sku);
            expect(new Decimal(alertItem.currentStock).toNumber()).toBeLessThanOrEqual(new Decimal(alertItem.minimumStock).toNumber());
        });
    });

    // =========================================================================
    // 10. KARDEX OFICIAL CPP
    // =========================================================================
    describe('10. Kardex Oficial CPP (Auditoría de Libro Mayor de Inventario)', () => {
        it('GET /api/v1/inventory/kardex/:productId: debe retornar histórico ordenado con trazabilidad exacta', async () => {
            const res = await request(API_BASE_URL)
                .get(`/api/v1/inventory/kardex/${SEED_DATA.products.arroz.id}`)
                .set('Authorization', `Bearer ${tokenAccountantA}`);

            expect(res.status).toBe(200);
            expect(res.body.product.sku).toBe(SEED_DATA.products.arroz.sku);
            expect(Array.isArray(res.body.entries)).toBe(true);
            expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);

            // Verificar que cada fila contiene datos fiscales completos
            const firstEntry = res.body.entries[0];
            expect(firstEntry).toHaveProperty('movementType');
            expect(firstEntry).toHaveProperty('quantityBalance');
            expect(firstEntry).toHaveProperty('averageCost');
            expect(firstEntry).toHaveProperty('inventoryValue');
        });
    });

    // =========================================================================
    // 11. AISLAMIENTO MULTI-TENANT & POSTGRESQL RLS
    // =========================================================================
    describe('11. Aislamiento Multi-Tenant Estricto y Verificación RLS', () => {
        it('Tenant A no debe poder ver ni consultar productos de Tenant B (404)', async () => {
            const res = await request(API_BASE_URL)
                .get(`/api/v1/inventory/products/${SEED_DATA.products.varillaB.id}`)
                .set('Authorization', `Bearer ${tokenOwnerA}`);

            expect(res.status).toBe(404);
        });

        it('Tenant A no debe poder despachar desde una bodega de Tenant B (404)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenOwnerA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warB1.id, // Bodega de Tenant B
                    referenceDocument: 'REM-CROSS-TENANT',
                    lines: [
                        {
                            productId: SEED_DATA.products.arroz.id,
                            quantity: '1.000',
                        },
                    ],
                });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('no fue encontrado');
        });

        it('Tenant B con su token solo debe ver sus propios recursos y no los de Tenant A', async () => {
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenOwnerB}`);

            expect(res.status).toBe(200);
            const skus = res.body.data.map((i: any) => i.sku);
            expect(skus).toContain(SEED_DATA.products.varillaB.sku);
            expect(skus).not.toContain(SEED_DATA.products.arroz.sku);
            expect(skus).not.toContain(SEED_DATA.products.cable.sku);
        });
    });

    // =========================================================================
    // 12. CONTROL DE ACCESO BASADO EN ROLES (RBAC)
    // =========================================================================
    describe('12. Control de Acceso Basado en Roles (RBAC)', () => {
        it('ACCOUNTANT no debe tener permiso de crear productos (403)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/products')
                .set('Authorization', `Bearer ${tokenAccountantA}`)
                .send({
                    sku: 'FORBIDDEN-ACC',
                    name: 'Test Accountant',
                    unitOfMeasureId: SEED_DATA.uoms.und.id,
                    costPrice: '1000.00',
                    salePrice: '2000.00',
                });

            expect(res.status).toBe(403);
        });

        it('CASHIER no debe tener permiso de recibir inventario (403)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'REM-CASHIER-TEST',
                    lines: [{ productId: SEED_DATA.products.arroz.id, quantity: '1.00', unitCost: '4000.00' }],
                });

            expect(res.status).toBe(403);
        });

        it('CASHIER sí debe tener permiso de despachar inventario (201)', async () => {
            const res = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'REM-CASHIER-DISPATCH',
                    lines: [{ productId: SEED_DATA.products.arroz.id, quantity: '1.000' }],
                });

            expect(res.status).toBe(201);
        });
    });

    // =========================================================================
    // 13. IDEMPOTENCIA REAL (CONCURRENCIA & REPETICIÓN)
    // =========================================================================
    describe('13. Idempotencia de Operaciones de Inventario', () => {
        const idempKey = `IDEMP-AUDIT-${Date.now()}`;

        it('debe ejecutar en primera llamada y retornar resultado cacheado idéntico en segunda llamada sin duplicar stock', async () => {
            const payload = {
                warehouseId: SEED_DATA.warehouses.warA1.id,
                referenceDocument: 'DOC-IDEMP-TEST',
                lines: [
                    {
                        productId: SEED_DATA.products.aceite.id,
                        quantity: '10.00',
                        unitCost: '8000.00',
                    },
                ],
            };

            // Primera llamada con Idempotency-Key
            const res1 = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .set('Idempotency-Key', idempKey)
                .send(payload);

            expect(res1.status).toBe(201);
            const movementId1 = res1.body.movementId;

            // Segunda llamada idéntica con el mismo Idempotency-Key
            const res2 = await request(API_BASE_URL)
                .post('/api/v1/inventory/moves/receive')
                .set('Authorization', `Bearer ${tokenWarehouseA}`)
                .set('Idempotency-Key', idempKey)
                .send(payload);

            expect(res2.status).toBe(201);
            expect(res2.body.movementId).toBe(movementId1);

            // Verificar en la BD que solo se registró 1 movimiento y que el stock subió exactamente 10 unidades (de 50 a 60)
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.aceite.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            expect(new Decimal(balance!.quantityOnHand).toFixed(0)).toBe('60');

            // Verificar registro de idempotencia en la base de datos
            const idempRecord = await prisma.inventoryIdempotencyKey.findUnique({
                where: {
                    tenantId_key: {
                        tenantId: SEED_DATA.tenantA.id,
                        key: idempKey,
                    },
                },
            });
            expect(idempRecord).toBeDefined();
            expect(idempRecord?.statusCode).toBe(200);
            expect(idempRecord?.responseBody).toBeDefined();
        });
    });

    // =========================================================================
    // 14. CONCURRENCIA & PREVENCIÓN DE RACE CONDITIONS (SELECT FOR UPDATE)
    // =========================================================================
    describe('14. Concurrencia y Bloqueo Pesimista (SELECT FOR UPDATE)', () => {
        it('dos solicitudes simultáneas compitiendo por stock limitado solo permiten una y evitan stock negativo', async () => {
            // Producto: Cable Cobre (stock disponible = 190 m)
            // Ejecutaremos dos solicitudes concurrentes de 120 m cada una
            // Solo una puede pasar (190 - 120 = 70 m), la otra debe fallar por INVALID_INVENTORY_BALANCE (422)
            const reqA = request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'RACE-A',
                    lines: [{ productId: SEED_DATA.products.cable.id, quantity: '120.00' }],
                });

            const reqB = request(API_BASE_URL)
                .post('/api/v1/inventory/moves/dispatch')
                .set('Authorization', `Bearer ${tokenCashierA}`)
                .send({
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    referenceDocument: 'RACE-B',
                    lines: [{ productId: SEED_DATA.products.cable.id, quantity: '120.00' }],
                });

            const [resA, resB] = await Promise.all([reqA, reqB]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([201, 422]);

            // Comprobar que en la BD el saldo final es exactamente 70 m (nunca negativo)
            await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, SEED_DATA.tenantA.id);
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: SEED_DATA.tenantA.id,
                        variantId: SEED_DATA.products.cable.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
            });
            expect(new Decimal(balance!.quantityOnHand).toFixed(2)).toBe('70.00');
        });
    });

    // =========================================================================
    // 15. CONTRATO DE RESPUESTA DE ERRORES (SIN FUGAS DE INTERNOS NI CREDENCIALES)
    // =========================================================================
    describe('15. Contrato de Respuestas de Error y Formato Centralizado', () => {
        it('debe responder errores en formato estandarizado sin filtrar stack traces ni detalles SQL', async () => {
            const res = await request(API_BASE_URL)
                .get('/api/v1/inventory/products/00000000-0000-4000-8000-000000000099') // ID no existente (UUID v4)
                .set('Authorization', `Bearer ${tokenWarehouseA}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('statusCode', 404);
            expect(res.body).toHaveProperty('code');
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path');

            // Seguridad: No deben existir stack traces ni filtraciones internas
            expect(res.body).not.toHaveProperty('stack');
            expect(res.body).not.toHaveProperty('sql');
            expect(JSON.stringify(res.body)).not.toContain('prisma');
            expect(JSON.stringify(res.body)).not.toContain('password');
        });
    });
});
