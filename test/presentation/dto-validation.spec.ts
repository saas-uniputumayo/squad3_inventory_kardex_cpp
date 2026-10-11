import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductDto } from '../../src/presentation/dto/products/create-product.dto';
import { ReceiveStockDto } from '../../src/presentation/dto/movements/receive-stock.dto';
import { DispatchStockDto } from '../../src/presentation/dto/movements/dispatch-stock.dto';
import { TransferStockDto } from '../../src/presentation/dto/transfers/transfer-stock.dto';
import { ReverseMovementDto } from '../../src/presentation/dto/movements/reverse-movement.dto';
import { CreateStockCountDto } from '../../src/presentation/dto/stock-counts/create-stock-count.dto';

describe('Presentation Layer - DTO Validation Tests', () => {
    describe('CreateProductDto', () => {
        it('fails validation when required fields are missing', async () => {
            const dto = plainToInstance(CreateProductDto, {});
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const propertyNames = errors.map((e) => e.property);
            expect(propertyNames).toContain('sku');
            expect(propertyNames).toContain('name');
            expect(propertyNames).toContain('unitOfMeasureId');
            expect(propertyNames).toContain('costPrice');
            expect(propertyNames).toContain('salePrice');
        });

        it('fails validation when unitOfMeasureId is not a valid UUID', async () => {
            const dto = plainToInstance(CreateProductDto, {
                sku: 'SKU-001',
                name: 'Product Name',
                unitOfMeasureId: 'not-a-uuid',
                costPrice: '100.00',
                salePrice: '150.00',
            });
            const errors = await validate(dto);
            const uomError = errors.find((e) => e.property === 'unitOfMeasureId');

            expect(uomError).toBeDefined();
        });

        it('passes validation with valid payload', async () => {
            const dto = plainToInstance(CreateProductDto, {
                sku: 'SKU-001',
                name: 'Product Name',
                unitOfMeasureId: '11111111-1111-4111-8111-111111111111',
                costPrice: '100.00',
                salePrice: '150.00',
            });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('ReceiveStockDto', () => {
        it('fails validation when lines array is empty', async () => {
            const dto = plainToInstance(ReceiveStockDto, {
                warehouseId: '11111111-1111-4111-8111-111111111111',
                referenceDocument: 'FAC-001',
                lines: [],
            });
            const errors = await validate(dto);
            const linesError = errors.find((e) => e.property === 'lines');

            expect(linesError).toBeDefined();
        });

        it('fails validation when line quantities/costs are missing or invalid', async () => {
            const dto = plainToInstance(ReceiveStockDto, {
                warehouseId: '11111111-1111-4111-8111-111111111111',
                referenceDocument: 'FAC-001',
                lines: [
                    {
                        productId: 'not-a-uuid',
                        quantity: '',
                        unitCost: '',
                    },
                ],
            });
            const errors = await validate(dto);
            const linesError = errors.find((e) => e.property === 'lines');

            expect(linesError?.children?.length).toBeGreaterThan(0);
        });

        it('passes validation with valid receive lines payload', async () => {
            const dto = plainToInstance(ReceiveStockDto, {
                warehouseId: '11111111-1111-4111-8111-111111111111',
                referenceDocument: 'FAC-001',
                lines: [
                    {
                        productId: '22222222-2222-4222-8222-222222222222',
                        quantity: '10.5000',
                        unitCost: '15000.00',
                    },
                ],
            });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('DispatchStockDto', () => {
        it('fails validation when warehouseId is missing', async () => {
            const dto = plainToInstance(DispatchStockDto, {
                referenceDocument: 'REM-001',
                lines: [
                    {
                        productId: '22222222-2222-4222-8222-222222222222',
                        quantity: '5.0000',
                    },
                ],
            });
            const errors = await validate(dto);
            const whError = errors.find((e) => e.property === 'warehouseId');

            expect(whError).toBeDefined();
        });

        it('passes validation with valid dispatch payload', async () => {
            const dto = plainToInstance(DispatchStockDto, {
                warehouseId: '11111111-1111-4111-8111-111111111111',
                referenceDocument: 'REM-001',
                lines: [
                    {
                        productId: '22222222-2222-4222-8222-222222222222',
                        quantity: '5.0000',
                    },
                ],
            });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('TransferStockDto', () => {
        it('fails validation when sourceWarehouseId is not a valid UUID', async () => {
            const dto = plainToInstance(TransferStockDto, {
                sourceWarehouseId: 'invalid-id',
                destinationWarehouseId: '11111111-1111-4111-8111-111111111111',
                referenceDocument: 'TR-001',
                lines: [
                    {
                        productId: '22222222-2222-4222-8222-222222222222',
                        quantity: '2.0000',
                    },
                ],
            });
            const errors = await validate(dto);
            const sourceError = errors.find((e) => e.property === 'sourceWarehouseId');

            expect(sourceError).toBeDefined();
        });
    });

    describe('ReverseMovementDto', () => {
        it('fails validation when reason is missing', async () => {
            const dto = plainToInstance(ReverseMovementDto, {
                movementId: '11111111-1111-4111-8111-111111111111',
            });
            const errors = await validate(dto);
            const reasonError = errors.find((e) => e.property === 'reason');

            expect(reasonError).toBeDefined();
        });

        it('passes validation when movementId and reason are valid', async () => {
            const dto = plainToInstance(ReverseMovementDto, {
                movementId: '11111111-1111-4111-8111-111111111111',
                reason: 'Digitación errónea de factura',
            });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('CreateStockCountDto', () => {
        it('fails validation when warehouseId is not a UUID', async () => {
            const dto = plainToInstance(CreateStockCountDto, {
                warehouseId: '123',
            });
            const errors = await validate(dto);
            const whError = errors.find((e) => e.property === 'warehouseId');

            expect(whError).toBeDefined();
        });

        it('passes validation with valid warehouse UUID and optional fields', async () => {
            const dto = plainToInstance(CreateStockCountDto, {
                warehouseId: '11111111-1111-4111-8111-111111111111',
                notes: 'Conteo semestral',
                autoStart: true,
            });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });
});
