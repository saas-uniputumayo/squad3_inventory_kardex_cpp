import { CreateProductService } from '../../src/application/services/product/create-product.service';
import { UpdateProductService } from '../../src/application/services/product/update-product.service';
import { SearchProductsService } from '../../src/application/services/product/search-products.service';
import { GetProductDetailService } from '../../src/application/services/product/get-product-detail.service';
import {
    ProductBarcodeAlreadyExistsException,
    ProductNotFoundException,
    ProductSkuAlreadyExistsException,
    UnitOfMeasureNotFoundException,
} from '../../src/application/exceptions';
import { UnitOfMeasure, UnitType } from '../../src/domain/entities/unit-of-measure/entity';
import { UnitOfMeasureCodeVO } from '../../src/domain/value-objects/unit-of-measure-code.vo';
import {
    InMemoryInventoryBalanceRepository,
    InMemoryProductRepository,
    InMemoryProductVariantRepository,
    InMemoryUnitOfMeasureRepository,
    InMemoryUnitOfWork,
} from './mocks/mock-ports';

describe('Product Application Services (HU-01, HU-02, HU-03)', () => {
    const tenantId = 'tenant-test-1';
    let productRepo: InMemoryProductRepository;
    let variantRepo: InMemoryProductVariantRepository;
    let uomRepo: InMemoryUnitOfMeasureRepository;
    let balanceRepo: InMemoryInventoryBalanceRepository;
    let uow: InMemoryUnitOfWork;

    let createService: CreateProductService;
    let updateService: UpdateProductService;
    let searchService: SearchProductsService;
    let detailService: GetProductDetailService;

    beforeEach(async () => {
        productRepo = new InMemoryProductRepository();
        variantRepo = new InMemoryProductVariantRepository();
        uomRepo = new InMemoryUnitOfMeasureRepository();
        balanceRepo = new InMemoryInventoryBalanceRepository();

        uow = new InMemoryUnitOfWork({
            productRepository: productRepo,
            productVariantRepository: variantRepo,
            warehouseRepository: {} as any,
            inventoryBalanceRepository: balanceRepo,
            inventoryMovementRepository: {} as any,
            inventoryLedgerRepository: {} as any,
            inventoryTransferRepository: {} as any,
            stockCountRepository: {} as any,
            unitOfMeasureRepository: uomRepo,
        });

        // Seed basic UOM
        const uom = UnitOfMeasure.create({
            id: 'uom-und-1',
            tenantId,
            code: UnitOfMeasureCodeVO.create('UND'),
            name: 'Unidad',
            type: UnitType.UNIT,
            allowsFraction: false,
            decimalPlaces: 0,
        });
        await uomRepo.save(uom);

        createService = new CreateProductService(productRepo, variantRepo, uomRepo, uow);
        updateService = new UpdateProductService(productRepo, uomRepo, uow);
        searchService = new SearchProductsService(productRepo, variantRepo, uomRepo, balanceRepo);
        detailService = new GetProductDetailService(productRepo, variantRepo, uomRepo, balanceRepo);
    });

    describe('CreateProductService (HU-02)', () => {
        it('debe crear un producto simple y generar automáticamente su variante por defecto', async () => {
            const result = await createService.execute({
                tenantId,
                sku: 'PROD-001',
                name: 'Laptop Gamer',
                unitOfMeasureId: 'uom-und-1',
                costPrice: 2500000,
                salePrice: 3200000,
                barcode: '7701234567890',
            });

            expect(result.id).toBeDefined();
            expect(result.sku).toBe('PROD-001');
            expect(result.name).toBe('Laptop Gamer');
            expect(result.defaultVariantId).toBeDefined();

            const savedProduct = await productRepo.findById(tenantId, result.id);
            expect(savedProduct).not.toBeNull();
            expect(savedProduct!.getSku().getValue()).toBe('PROD-001');

            const defaultVariant = await variantRepo.findById(tenantId, result.defaultVariantId!);
            expect(defaultVariant).not.toBeNull();
            expect(defaultVariant!.getIsDefault()).toBe(true);
            expect(defaultVariant!.getSku().getValue()).toBe('PROD-001');
        });

        it('debe rechazar la creación si el SKU ya existe en el tenant', async () => {
            await createService.execute({
                tenantId,
                sku: 'PROD-DUPLICATE',
                name: 'Producto A',
                unitOfMeasureId: 'uom-und-1',
                costPrice: 1000,
                salePrice: 2000,
            });

            await expect(
                createService.execute({
                    tenantId,
                    sku: 'PROD-DUPLICATE',
                    name: 'Producto B',
                    unitOfMeasureId: 'uom-und-1',
                    costPrice: 1500,
                    salePrice: 2500,
                }),
            ).rejects.toThrow(ProductSkuAlreadyExistsException);
        });

        it('debe rechazar la creación si el código de barras ya existe en el tenant', async () => {
            await createService.execute({
                tenantId,
                sku: 'PROD-BAR-1',
                name: 'Producto 1',
                barcode: '12345678',
                unitOfMeasureId: 'uom-und-1',
                costPrice: 1000,
                salePrice: 2000,
            });

            await expect(
                createService.execute({
                    tenantId,
                    sku: 'PROD-BAR-2',
                    name: 'Producto 2',
                    barcode: '12345678',
                    unitOfMeasureId: 'uom-und-1',
                    costPrice: 1000,
                    salePrice: 2000,
                }),
            ).rejects.toThrow(ProductBarcodeAlreadyExistsException);
        });

        it('debe rechazar la creación si la unidad de medida no existe', async () => {
            await expect(
                createService.execute({
                    tenantId,
                    sku: 'PROD-NO-UOM',
                    name: 'Sin UOM',
                    unitOfMeasureId: 'uom-inexistente',
                    costPrice: 1000,
                    salePrice: 2000,
                }),
            ).rejects.toThrow(UnitOfMeasureNotFoundException);
        });
    });

    describe('UpdateProductService (HU-03)', () => {
        it('debe actualizar los datos comerciales sin modificar inventario ni CPP', async () => {
            const created = await createService.execute({
                tenantId,
                sku: 'PROD-COMM-1',
                name: 'Nombre Original',
                unitOfMeasureId: 'uom-und-1',
                costPrice: 1000,
                salePrice: 1500,
            });

            const updated = await updateService.execute({
                tenantId,
                productId: created.id,
                name: 'Nombre Modificado',
                costPrice: 1200,
                salePrice: 1800,
            });

            expect(updated.name).toBe('Nombre Modificado');
            expect(updated.costPrice).toBe('1200.0000');
            expect(updated.salePrice).toBe('1800.00');

            const loaded = await productRepo.findById(tenantId, created.id);
            expect(loaded!.getName()).toBe('Nombre Modificado');
            expect(loaded!.getCostPrice().getAmount().toNumber()).toBe(1200);
        });

        it('debe lanzar ProductNotFoundException si el producto no existe', async () => {
            await expect(
                updateService.execute({
                    tenantId,
                    productId: 'non-existing-id',
                    name: 'Test',
                }),
            ).rejects.toThrow(ProductNotFoundException);
        });
    });

    describe('SearchProductsService (HU-01) y GetProductDetailService', () => {
        beforeEach(async () => {
            await createService.execute({
                tenantId,
                sku: 'SKU-APPLE',
                name: 'Apple iPhone 15',
                unitOfMeasureId: 'uom-und-1',
                barcode: '0194253782',
                costPrice: 3000000,
                salePrice: 4000000,
            });

            await createService.execute({
                tenantId,
                sku: 'SKU-SAMSUNG',
                name: 'Samsung Galaxy S24',
                unitOfMeasureId: 'uom-und-1',
                barcode: '088727682',
                costPrice: 2800000,
                salePrice: 3800000,
            });
        });

        it('debe filtrar productos por texto de búsqueda (SKU o nombre)', async () => {
            const searchResult = await searchService.execute({
                tenantId,
                search: 'iphone',
            });

            expect(searchResult.pagination.total).toBe(1);
            expect(searchResult.data[0].sku).toBe('SKU-APPLE');
        });

        it('debe obtener el detalle del producto', async () => {
            const searchResult = await searchService.execute({
                tenantId,
                search: 'SAMSUNG',
            });
            const samsungId = searchResult.data[0].id;

            const detail = await detailService.execute({
                tenantId,
                productId: samsungId,
            });

            expect(detail.id).toBe(samsungId);
            expect(detail.sku).toBe('SKU-SAMSUNG');
            expect(detail.name).toBe('Samsung Galaxy S24');
        });
    });
});
