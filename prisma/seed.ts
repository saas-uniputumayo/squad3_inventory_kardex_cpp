import { PrismaClient, TaxRegime, DocumentType, UserRole, WarehouseStatus, ProductType, UnitType, MovementType, MovementStatus, MovementSource, ReferenceType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

// IDs Determinísticos de Auditoría E2E (Todos estrictamente conformes a RFC 4122 UUID v4)
export const SEED_DATA = {
    tenantA: {
        id: 'a1111111-1111-4111-8111-111111111111',
        nitRut: '901.854.123-1',
        businessName: 'AUDIT Empresa Ferretera del Putumayo S.A.S.',
        tradeName: 'Ferretería Audit Putumayo',
        address: 'Calle 10 # 8-45 Centro, Mocoa, Putumayo',
        phone: '3124567890',
        email: 'contacto@auditputumayo.co',
    },
    tenantB: {
        id: 'b2222222-2222-4222-8222-222222222222',
        nitRut: '901.854.999-2',
        businessName: 'AUDIT Distribuidora Comercial de la Amazonía S.A.S.',
        tradeName: 'Distribuidora Audit Amazonía',
        address: 'Av. San Francisco # 12-30, Mocoa, Putumayo',
        phone: '3109876543',
        email: 'contacto@auditamazonia.co',
    },
    branches: {
        branchA1: {
            id: 'a0000000-0000-4000-8000-000000000001',
            code: 'BR-A1',
            name: 'Sucursal Principal Centro Mocoa',
        },
        branchB1: {
            id: 'b0000000-0000-4000-8000-000000000001',
            code: 'BR-B1',
            name: 'Sucursal Norte Mocoa',
        },
    },
    warehouses: {
        warA1: {
            id: 'a0000000-0000-4000-8000-000000000010',
            code: 'WAR-A1',
            name: 'Bodega Central Mocoa',
            status: WarehouseStatus.ACTIVE,
        },
        warA2: {
            id: 'a0000000-0000-4000-8000-000000000020',
            code: 'WAR-A2',
            name: 'Bodega Secundaria Mocoa',
            status: WarehouseStatus.ACTIVE,
        },
        warA3_archived: {
            id: 'a0000000-0000-4000-8000-000000000030',
            code: 'WAR-A3-ARCH',
            name: 'Bodega Archivada Puerto Asís',
            status: WarehouseStatus.ARCHIVED,
        },
        warB1: {
            id: 'b0000000-0000-4000-8000-000000000010',
            code: 'WAR-B1',
            name: 'Bodega Central Tenant B',
            status: WarehouseStatus.ACTIVE,
        },
    },
    users: {
        // Tenant A Users
        ownerA: {
            id: 'a0000000-0000-4000-8000-000000000101',
            email: 'owner.a@audit.co',
            role: UserRole.OWNER,
            fullName: 'Propietario Tenant A',
            documentNumber: '10000001',
        },
        adminA: {
            id: 'a0000000-0000-4000-8000-000000000102',
            email: 'admin.a@audit.co',
            role: UserRole.ADMIN,
            fullName: 'Administrador Tenant A',
            documentNumber: '10000002',
        },
        accountantA: {
            id: 'a0000000-0000-4000-8000-000000000103',
            email: 'accountant.a@audit.co',
            role: UserRole.ACCOUNTANT,
            fullName: 'Contador Tenant A',
            documentNumber: '10000003',
        },
        warehouseA: {
            id: 'a0000000-0000-4000-8000-000000000104',
            email: 'warehouse.a@audit.co',
            role: UserRole.WAREHOUSE_MANAGER,
            fullName: 'Jefe de Bodega Tenant A',
            documentNumber: '10000004',
        },
        cashierA: {
            id: 'a0000000-0000-4000-8000-000000000105',
            email: 'cashier.a@audit.co',
            role: UserRole.CASHIER,
            fullName: 'Cajero Tenant A',
            documentNumber: '10000005',
        },
        // Tenant B Users
        ownerB: {
            id: 'b0000000-0000-4000-8000-000000000101',
            email: 'owner.b@audit.co',
            role: UserRole.OWNER,
            fullName: 'Propietario Tenant B',
            documentNumber: '20000001',
        },
        cashierB: {
            id: 'b0000000-0000-4000-8000-000000000105',
            email: 'cashier.b@audit.co',
            role: UserRole.CASHIER,
            fullName: 'Cajero Tenant B',
            documentNumber: '20000005',
        },
    },
    uoms: {
        // Tenant A UOMs
        kg: {
            id: 'a0000000-0000-4000-8000-000000000201',
            code: 'kg',
            name: 'Kilogramo',
            symbol: 'kg',
            unitType: UnitType.WEIGHT,
            decimalPlaces: 3,
        },
        und: {
            id: 'a0000000-0000-4000-8000-000000000202',
            code: 'und',
            name: 'Unidad',
            symbol: 'und',
            unitType: UnitType.UNIT,
            decimalPlaces: 0,
        },
        m: {
            id: 'a0000000-0000-4000-8000-000000000203',
            code: 'm',
            name: 'Metro',
            symbol: 'm',
            unitType: UnitType.LENGTH,
            decimalPlaces: 2,
        },
        L: {
            id: 'a0000000-0000-4000-8000-000000000204',
            code: 'L',
            name: 'Litro',
            symbol: 'L',
            unitType: UnitType.VOLUME,
            decimalPlaces: 3,
        },
        bulto: {
            id: 'a0000000-0000-4000-8000-000000000205',
            code: 'bulto',
            name: 'Bulto',
            symbol: 'blt',
            unitType: UnitType.UNIT,
            decimalPlaces: 0,
        },
        // Tenant B UOMs
        undB: {
            id: 'b0000000-0000-4000-8000-000000000201',
            code: 'und',
            name: 'Unidad',
            symbol: 'und',
            unitType: UnitType.UNIT,
            decimalPlaces: 0,
        },
    },
    products: {
        arroz: {
            id: 'a0000000-0000-4000-8000-000000000301',
            variantId: 'a0000000-0000-4000-8000-000000000311',
            sku: 'ARR-001',
            barcode: '770123450001',
            name: 'Arroz Blanco Diana 1kg',
            costPrice: '4000.000000',
            salePrice: '5500.00',
            minStockAlert: '20.000000',
            initialStock: '100.000',
        },
        aceite: {
            id: 'a0000000-0000-4000-8000-000000000302',
            variantId: 'a0000000-0000-4000-8000-000000000312',
            sku: 'ACE-001',
            barcode: '770123450002',
            name: 'Aceite Vegetal 1L',
            costPrice: '8000.000000',
            salePrice: '11000.00',
            minStockAlert: '15.000000',
            initialStock: '50.000',
        },
        cable: {
            id: 'a0000000-0000-4000-8000-000000000303',
            variantId: 'a0000000-0000-4000-8000-000000000313',
            sku: 'CAB-001',
            barcode: '770123450003',
            name: 'Cable Cobre #12 THHN Centelsa',
            costPrice: '2500.000000',
            salePrice: '3800.00',
            minStockAlert: '50.000000',
            initialStock: '200.000',
        },
        cemento: {
            id: 'a0000000-0000-4000-8000-000000000304',
            variantId: 'a0000000-0000-4000-8000-000000000314',
            sku: 'CEM-001',
            barcode: '770123450004',
            name: 'Cemento Gris Argos 50kg',
            costPrice: '25000.000000',
            salePrice: '32000.00',
            minStockAlert: '10.000000',
            initialStock: '4.000', // Stock 4 <= minStockAlert 10 (Alert active!)
        },
        taladro: {
            id: 'a0000000-0000-4000-8000-000000000305',
            variantId: 'a0000000-0000-4000-8000-000000000315',
            sku: 'TAL-001',
            barcode: '770123450005',
            name: 'Taladro Percutor Industrial 1/2',
            costPrice: '180000.000000',
            salePrice: '250000.00',
            minStockAlert: '2.000000',
            initialStock: '0.000', // Zero stock (Test negative dispatch)
        },
        servicio: {
            id: 'a0000000-0000-4000-8000-000000000306',
            variantId: 'a0000000-0000-4000-8000-000000000316',
            sku: 'SRV-001',
            barcode: null,
            name: 'Servicio de Mantenimiento y Calibración',
            costPrice: '50000.000000',
            salePrice: '80000.00',
            minStockAlert: '0.000000',
            productType: ProductType.SERVICE,
        },
        // Tenant B Product
        varillaB: {
            id: 'b0000000-0000-4000-8000-000000000301',
            variantId: 'b0000000-0000-4000-8000-000000000311',
            sku: 'VAR-B01',
            barcode: '770123459001',
            name: 'Varilla Corrugada 1/2 Diaco (Tenant B)',
            costPrice: '30000.000000',
            salePrice: '42000.00',
            minStockAlert: '20.000000',
            initialStock: '50.000',
        },
    },
};

export async function seedDatabase() {
    console.log('--- INICIANDO SEMILLERO MULTI-TENANT REPRODUCIBLE (AUDITORÍA E2E) ---');
    const passwordHash = await bcrypt.hash('AuditPassword2026*', 10);

    // 1. Desactivar temporalmente sesión para semillero global de tenants
    await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '', true);`);

    // Limpieza segura de datos transaccionales previos de los tenants de auditoría
    // para garantizar un estado 100% reproducible y limpio al re-ejecutar pruebas E2E.
    console.log('0. Limpiando datos transaccionales previos de los tenants de auditoría...');
    await prisma.inventoryMovement.updateMany({
        where: {
            tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] },
            reversesMovementId: { not: null },
        },
        data: { reversesMovementId: null },
    });
    await prisma.inventoryTransfer.updateMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
        data: { outboundMovementId: null, inboundMovementId: null },
    });
    await prisma.inventoryAuditLog.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.stockCountLine.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.stockCount.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryTransferLine.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryTransfer.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryLedgerEntry.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryMovementLine.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryMovement.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryBalance.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });
    await prisma.inventoryIdempotencyKey.deleteMany({
        where: { tenantId: { in: [SEED_DATA.tenantA.id, SEED_DATA.tenantB.id] } },
    });

    // 2. Sembrando Tenants
    console.log('1. Sembrando Tenants A y B...');
    const tenantA = await prisma.tenant.upsert({
        where: { id: SEED_DATA.tenantA.id },
        update: { businessName: SEED_DATA.tenantA.businessName, isActive: true },
        create: {
            id: SEED_DATA.tenantA.id,
            nitRut: SEED_DATA.tenantA.nitRut,
            businessName: SEED_DATA.tenantA.businessName,
            tradeName: SEED_DATA.tenantA.tradeName,
            address: SEED_DATA.tenantA.address,
            phone: SEED_DATA.tenantA.phone,
            email: SEED_DATA.tenantA.email,
            countryCode: 'COL',
            currencyCode: 'COP',
            taxRegime: TaxRegime.REGIMEN_SIMPLE,
            isActive: true,
        },
    });

    const tenantB = await prisma.tenant.upsert({
        where: { id: SEED_DATA.tenantB.id },
        update: { businessName: SEED_DATA.tenantB.businessName, isActive: true },
        create: {
            id: SEED_DATA.tenantB.id,
            nitRut: SEED_DATA.tenantB.nitRut,
            businessName: SEED_DATA.tenantB.businessName,
            tradeName: SEED_DATA.tenantB.tradeName,
            address: SEED_DATA.tenantB.address,
            phone: SEED_DATA.tenantB.phone,
            email: SEED_DATA.tenantB.email,
            countryCode: 'COL',
            currencyCode: 'COP',
            taxRegime: TaxRegime.RESPONSABLE_IVA,
            isActive: true,
        },
    });

    // =========================================================================
    // SEMILLERO TENANT A
    // =========================================================================
    console.log('2. Sembrando entidades de Tenant A...');
    await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, tenantA.id);

    // Branch A1
    await prisma.branch.upsert({
        where: { tenantId_code: { tenantId: tenantA.id, code: SEED_DATA.branches.branchA1.code } },
        update: { name: SEED_DATA.branches.branchA1.name },
        create: {
            id: SEED_DATA.branches.branchA1.id,
            tenantId: tenantA.id,
            code: SEED_DATA.branches.branchA1.code,
            name: SEED_DATA.branches.branchA1.name,
            address: 'Calle 10 # 8-45 Centro, Mocoa',
            phone: '3124567890',
            isActive: true,
        },
    });

    // Warehouses Tenant A
    await prisma.warehouse.upsert({
        where: { tenantId_code: { tenantId: tenantA.id, code: SEED_DATA.warehouses.warA1.code } },
        update: { name: SEED_DATA.warehouses.warA1.name, status: SEED_DATA.warehouses.warA1.status },
        create: {
            id: SEED_DATA.warehouses.warA1.id,
            tenantId: tenantA.id,
            branchId: SEED_DATA.branches.branchA1.id,
            code: SEED_DATA.warehouses.warA1.code,
            name: SEED_DATA.warehouses.warA1.name,
            status: SEED_DATA.warehouses.warA1.status,
        },
    });

    await prisma.warehouse.upsert({
        where: { tenantId_code: { tenantId: tenantA.id, code: SEED_DATA.warehouses.warA2.code } },
        update: { name: SEED_DATA.warehouses.warA2.name, status: SEED_DATA.warehouses.warA2.status },
        create: {
            id: SEED_DATA.warehouses.warA2.id,
            tenantId: tenantA.id,
            branchId: SEED_DATA.branches.branchA1.id,
            code: SEED_DATA.warehouses.warA2.code,
            name: SEED_DATA.warehouses.warA2.name,
            status: SEED_DATA.warehouses.warA2.status,
        },
    });

    await prisma.warehouse.upsert({
        where: { tenantId_code: { tenantId: tenantA.id, code: SEED_DATA.warehouses.warA3_archived.code } },
        update: { name: SEED_DATA.warehouses.warA3_archived.name, status: SEED_DATA.warehouses.warA3_archived.status },
        create: {
            id: SEED_DATA.warehouses.warA3_archived.id,
            tenantId: tenantA.id,
            branchId: SEED_DATA.branches.branchA1.id,
            code: SEED_DATA.warehouses.warA3_archived.code,
            name: SEED_DATA.warehouses.warA3_archived.name,
            status: SEED_DATA.warehouses.warA3_archived.status,
            archivedAt: new Date(),
        },
    });

    // Users Tenant A
    for (const u of [
        SEED_DATA.users.ownerA,
        SEED_DATA.users.adminA,
        SEED_DATA.users.accountantA,
        SEED_DATA.users.warehouseA,
        SEED_DATA.users.cashierA,
    ]) {
        await prisma.user.upsert({
            where: { tenantId_email: { tenantId: tenantA.id, email: u.email } },
            update: { role: u.role, passwordHash },
            create: {
                id: u.id,
                tenantId: tenantA.id,
                branchId: SEED_DATA.branches.branchA1.id,
                documentType: DocumentType.CC,
                documentNumber: u.documentNumber,
                email: u.email,
                passwordHash,
                fullName: u.fullName,
                role: u.role,
                isActive: true,
            },
        });
    }

    // UOMs Tenant A
    for (const uomKey of ['kg', 'und', 'm', 'L', 'bulto'] as const) {
        const uom = SEED_DATA.uoms[uomKey];
        await prisma.unitOfMeasure.upsert({
            where: { tenantId_code: { tenantId: tenantA.id, code: uom.code } },
            update: {
                name: uom.name,
                symbol: uom.symbol,
                unitType: uom.unitType,
                decimalPlaces: uom.decimalPlaces,
            },
            create: {
                id: uom.id,
                tenantId: tenantA.id,
                code: uom.code,
                name: uom.name,
                symbol: uom.symbol,
                unitType: uom.unitType,
                decimalPlaces: uom.decimalPlaces,
                isActive: true,
            },
        });
    }

    // Products & Variants Tenant A
    const productList = [
        { data: SEED_DATA.products.arroz, uomId: SEED_DATA.uoms.kg.id },
        { data: SEED_DATA.products.aceite, uomId: SEED_DATA.uoms.und.id },
        { data: SEED_DATA.products.cable, uomId: SEED_DATA.uoms.m.id },
        { data: SEED_DATA.products.cemento, uomId: SEED_DATA.uoms.bulto.id },
        { data: SEED_DATA.products.taladro, uomId: SEED_DATA.uoms.und.id },
        { data: SEED_DATA.products.servicio, uomId: SEED_DATA.uoms.und.id },
    ];

    for (const item of productList) {
        const prod = item.data;
        await prisma.product.upsert({
            where: { tenantId_sku: { tenantId: tenantA.id, sku: prod.sku } },
            update: { name: prod.name, salePrice: new Decimal(prod.salePrice) },
            create: {
                id: prod.id,
                tenantId: tenantA.id,
                sku: prod.sku,
                barcode: prod.barcode ?? undefined,
                name: prod.name,
                productType: (prod as any).productType ?? ProductType.STOCKABLE,
                costPrice: new Decimal(prod.costPrice),
                salePrice: new Decimal(prod.salePrice),
                minStockAlert: new Decimal(prod.minStockAlert),
                unitOfMeasureId: item.uomId,
            },
        });

        await prisma.productVariant.upsert({
            where: { tenantId_sku: { tenantId: tenantA.id, sku: prod.sku } },
            update: { name: prod.name },
            create: {
                id: prod.variantId,
                tenantId: tenantA.id,
                productId: prod.id,
                sku: prod.sku,
                name: prod.name,
                costPrice: new Decimal(prod.costPrice),
                salePrice: new Decimal(prod.salePrice),
                minStockAlert: new Decimal(prod.minStockAlert),
                unitOfMeasureId: item.uomId,
                isDefault: true,
            },
        });

        // Seed initial balance if initialStock > 0
        if ('initialStock' in prod && new Decimal(prod.initialStock).gt(0)) {
            const qty = new Decimal(prod.initialStock);
            const cost = new Decimal(prod.costPrice);
            const val = qty.times(cost);

            await prisma.inventoryBalance.upsert({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: tenantA.id,
                        variantId: prod.variantId,
                        warehouseId: SEED_DATA.warehouses.warA1.id,
                    },
                },
                update: {
                    quantityOnHand: qty,
                    averageCost: cost,
                    inventoryValue: val,
                },
                create: {
                    tenantId: tenantA.id,
                    productId: prod.id,
                    variantId: prod.variantId,
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    quantityOnHand: qty,
                    averageCost: cost,
                    inventoryValue: val,
                },
            });

            // Asegurar balance inicial 0 en Bodega A2 para la variante
            await prisma.inventoryBalance.upsert({
                where: {
                    tenantId_variantId_warehouseId: {
                        tenantId: tenantA.id,
                        variantId: prod.variantId,
                        warehouseId: SEED_DATA.warehouses.warA2.id,
                    },
                },
                update: {
                    quantityOnHand: new Decimal(0),
                    averageCost: new Decimal(0),
                    inventoryValue: new Decimal(0),
                },
                create: {
                    tenantId: tenantA.id,
                    productId: prod.id,
                    variantId: prod.variantId,
                    warehouseId: SEED_DATA.warehouses.warA2.id,
                    quantityOnHand: new Decimal(0),
                    averageCost: new Decimal(0),
                    inventoryValue: new Decimal(0),
                },
            });

            // Registrar movimiento inicial de apertura/compra
            const moveId = `a0000000-0000-4000-8000-00000000040${prod.sku.slice(-1)}`;
            const moveLineId = `a0000000-0000-4000-8000-00000000041${prod.sku.slice(-1)}`;
            const ledgerId = `a0000000-0000-4000-8000-00000000042${prod.sku.slice(-1)}`;

            await prisma.inventoryMovement.upsert({
                where: { id: moveId },
                update: {},
                create: {
                    id: moveId,
                    tenantId: tenantA.id,
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    type: MovementType.PURCHASE_RECEIPT,
                    status: MovementStatus.POSTED,
                    source: MovementSource.PURCHASE,
                    referenceType: ReferenceType.PURCHASE,
                    referenceDocument: `DOC-INIT-${prod.sku}`,
                    createdById: SEED_DATA.users.ownerA.id,
                    postedById: SEED_DATA.users.ownerA.id,
                    postedAt: new Date(),
                    createdAt: new Date(),
                },
            });

            await prisma.inventoryMovementLine.upsert({
                where: { id: moveLineId },
                update: {},
                create: {
                    id: moveLineId,
                    tenantId: tenantA.id,
                    movementId: moveId,
                    productId: prod.id,
                    variantId: prod.variantId,
                    unitOfMeasureId: item.uomId,
                    lineNumber: 1,
                    quantity: qty,
                    unitCost: cost,
                    totalCost: val,
                    previousQuantity: new Decimal(0),
                    newQuantity: qty,
                    averageCostBefore: new Decimal(0),
                    averageCostAfter: cost,
                    inventoryValueBefore: new Decimal(0),
                    inventoryValueAfter: val,
                },
            });

            await prisma.inventoryLedgerEntry.upsert({
                where: { id: ledgerId },
                update: {},
                create: {
                    id: ledgerId,
                    tenantId: tenantA.id,
                    warehouseId: SEED_DATA.warehouses.warA1.id,
                    movementId: moveId,
                    productId: prod.id,
                    variantId: prod.variantId,
                    movementType: MovementType.PURCHASE_RECEIPT,
                    quantityIn: qty,
                    quantityOut: new Decimal(0),
                    quantityDelta: qty,
                    quantityBalance: qty,
                    unitCost: cost,
                    costDelta: val,
                    averageCostBefore: new Decimal(0),
                    averageCostAfter: cost,
                    inventoryValueBefore: new Decimal(0),
                    inventoryValueAfter: val,
                    referenceType: ReferenceType.PURCHASE,
                    referenceDocument: `DOC-INIT-${prod.sku}`,
                    createdAt: new Date(),
                },
            });
        }
    }

    // =========================================================================
    // SEMILLERO TENANT B (Aislamiento Multi-Tenant)
    // =========================================================================
    console.log('3. Sembrando entidades de Tenant B...');
    await prisma.$executeRawUnsafe(`SELECT set_current_tenant($1::uuid)`, tenantB.id);

    // Branch B1
    await prisma.branch.upsert({
        where: { tenantId_code: { tenantId: tenantB.id, code: SEED_DATA.branches.branchB1.code } },
        update: { name: SEED_DATA.branches.branchB1.name },
        create: {
            id: SEED_DATA.branches.branchB1.id,
            tenantId: tenantB.id,
            code: SEED_DATA.branches.branchB1.code,
            name: SEED_DATA.branches.branchB1.name,
            address: 'Av. San Francisco # 12-30, Mocoa',
            phone: '3109876543',
            isActive: true,
        },
    });

    // Warehouse B1
    await prisma.warehouse.upsert({
        where: { tenantId_code: { tenantId: tenantB.id, code: SEED_DATA.warehouses.warB1.code } },
        update: { name: SEED_DATA.warehouses.warB1.name },
        create: {
            id: SEED_DATA.warehouses.warB1.id,
            tenantId: tenantB.id,
            branchId: SEED_DATA.branches.branchB1.id,
            code: SEED_DATA.warehouses.warB1.code,
            name: SEED_DATA.warehouses.warB1.name,
            status: SEED_DATA.warehouses.warB1.status,
        },
    });

    // Users Tenant B
    for (const u of [SEED_DATA.users.ownerB, SEED_DATA.users.cashierB]) {
        await prisma.user.upsert({
            where: { tenantId_email: { tenantId: tenantB.id, email: u.email } },
            update: { role: u.role, passwordHash },
            create: {
                id: u.id,
                tenantId: tenantB.id,
                branchId: SEED_DATA.branches.branchB1.id,
                documentType: DocumentType.CC,
                documentNumber: u.documentNumber,
                email: u.email,
                passwordHash,
                fullName: u.fullName,
                role: u.role,
                isActive: true,
            },
        });
    }

    // UOM Tenant B
    await prisma.unitOfMeasure.upsert({
        where: { tenantId_code: { tenantId: tenantB.id, code: SEED_DATA.uoms.undB.code } },
        update: {
            name: SEED_DATA.uoms.undB.name,
            symbol: SEED_DATA.uoms.undB.symbol,
            unitType: SEED_DATA.uoms.undB.unitType,
            decimalPlaces: SEED_DATA.uoms.undB.decimalPlaces,
        },
        create: {
            id: SEED_DATA.uoms.undB.id,
            tenantId: tenantB.id,
            code: SEED_DATA.uoms.undB.code,
            name: SEED_DATA.uoms.undB.name,
            symbol: SEED_DATA.uoms.undB.symbol,
            unitType: SEED_DATA.uoms.undB.unitType,
            decimalPlaces: SEED_DATA.uoms.undB.decimalPlaces,
            isActive: true,
        },
    });

    // Product B1
    const prodB = SEED_DATA.products.varillaB;
    await prisma.product.upsert({
        where: { tenantId_sku: { tenantId: tenantB.id, sku: prodB.sku } },
        update: { name: prodB.name },
        create: {
            id: prodB.id,
            tenantId: tenantB.id,
            sku: prodB.sku,
            barcode: prodB.barcode,
            name: prodB.name,
            productType: ProductType.STOCKABLE,
            costPrice: new Decimal(prodB.costPrice),
            salePrice: new Decimal(prodB.salePrice),
            minStockAlert: new Decimal(prodB.minStockAlert),
            unitOfMeasureId: SEED_DATA.uoms.undB.id,
        },
    });

    await prisma.productVariant.upsert({
        where: { tenantId_sku: { tenantId: tenantB.id, sku: prodB.sku } },
        update: { name: prodB.name },
        create: {
            id: prodB.variantId,
            tenantId: tenantB.id,
            productId: prodB.id,
            sku: prodB.sku,
            name: prodB.name,
            costPrice: new Decimal(prodB.costPrice),
            salePrice: new Decimal(prodB.salePrice),
            minStockAlert: new Decimal(prodB.minStockAlert),
            unitOfMeasureId: SEED_DATA.uoms.undB.id,
            isDefault: true,
        },
    });

    const qtyB = new Decimal(prodB.initialStock);
    const costB = new Decimal(prodB.costPrice);
    const valB = qtyB.times(costB);

    await prisma.inventoryBalance.upsert({
        where: {
            tenantId_variantId_warehouseId: {
                tenantId: tenantB.id,
                variantId: prodB.variantId,
                warehouseId: SEED_DATA.warehouses.warB1.id,
            },
        },
        update: {
            quantityOnHand: qtyB,
            averageCost: costB,
            inventoryValue: valB,
        },
        create: {
            tenantId: tenantB.id,
            productId: prodB.id,
            variantId: prodB.variantId,
            warehouseId: SEED_DATA.warehouses.warB1.id,
            quantityOnHand: qtyB,
            averageCost: costB,
            inventoryValue: valB,
        },
    });

    // Reset session tenant
    await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '', true);`);
    console.log('--- SEMILLERO MULTI-TENANT COMPLETADO EXITOSAMENTE ---');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('prisma/seed.ts')) {
    seedDatabase()
        .then(() => {
            console.log('Semillero ejecutado con éxito.');
            process.exit(0);
        })
        .catch((e) => {
            console.error('Error durante la ejecución del semillero:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
