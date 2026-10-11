import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { InventoryExceptionFilter } from '../../src/presentation/filters/inventory-exception.filter';
import {
    IdempotencyConflictException,
    ProductNotFoundException,
    ProductSkuAlreadyExistsException,
    WarehouseNotFoundException,
} from '../../src/application/exceptions';
import { InvalidInventoryBalanceException } from '../../src/domain/exceptions/invalid-inventory-balance.exception';
import { InvalidWarehouseException } from '../../src/domain/exceptions/invalid-warehouse.exception';
import { InvalidInventoryMovementException } from '../../src/domain/exceptions/invalid-inventory-movement.exception';
import { InvalidStockCountException } from '../../src/domain/exceptions/invalid-stock-count.exception';
import { InvalidQuantityException } from '../../src/domain/exceptions/invalid-quantity.exception';

describe('InventoryExceptionFilter', () => {
    let filter: InventoryExceptionFilter;
    let mockResponse: {
        status: jest.Mock;
        json: jest.Mock;
    };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        filter = new InventoryExceptionFilter();
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const mockRequest = {
            url: '/api/v1/inventory/moves/receive',
            method: 'POST',
        };
        mockHost = {
            switchToHttp: () => ({
                getResponse: () => mockResponse,
                getRequest: () => mockRequest,
            }),
        } as unknown as ArgumentsHost;
    });

    it('maps ResourceNotFoundException (ProductNotFoundException) to 404 Not Found', () => {
        const error = new ProductNotFoundException('prod-123');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                code: 'PRODUCT_NOT_FOUND',
                message: expect.stringContaining('prod-123'),
                path: '/api/v1/inventory/moves/receive',
            }),
        );
    });

    it('maps WarehouseNotFoundException to 404 Not Found', () => {
        const error = new WarehouseNotFoundException('wh-999');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                code: 'WAREHOUSE_NOT_FOUND',
            }),
        );
    });

    it('maps IdempotencyConflictException to 409 Conflict', () => {
        const error = new IdempotencyConflictException('key-abc', 'RECEIVE_STOCK');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                code: 'IDEMPOTENCY_CONFLICT',
                message: expect.stringContaining('key-abc'),
            }),
        );
    });

    it('maps ProductSkuAlreadyExistsException to 409 Conflict', () => {
        const error = new ProductSkuAlreadyExistsException('SKU-001');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                code: 'PRODUCT_SKU_ALREADY_EXISTS',
            }),
        );
    });

    it('maps InvalidInventoryMovementException (already reversed) to 409 Conflict', () => {
        const error = new InvalidInventoryMovementException('Movement is already reversed');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                code: 'INVALID_INVENTORY_MOVEMENT',
            }),
        );
    });

    it('maps InvalidStockCountException to 409 Conflict', () => {
        const error = new InvalidStockCountException('Stock count already applied');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                code: 'INVALID_STOCK_COUNT',
            }),
        );
    });

    it('maps InvalidInventoryBalanceException (insufficient stock) to 422 Unprocessable Entity', () => {
        const error = new InvalidInventoryBalanceException('Available balance is insufficient for dispatch');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 422,
                code: 'INVALID_INVENTORY_BALANCE',
            }),
        );
    });

    it('maps InvalidWarehouseException (archived warehouse) to 422 Unprocessable Entity', () => {
        const error = new InvalidWarehouseException('Warehouse is ARCHIVED');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 422,
                code: 'INVALID_WAREHOUSE',
            }),
        );
    });

    it('maps input domain exceptions (InvalidQuantityException) to 400 Bad Request', () => {
        const error = new InvalidQuantityException('Quantity cannot be negative');

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                code: 'INVALID_QUANTITY',
            }),
        );
    });

    it('preserves native NestJS HttpException status and message', () => {
        const error = new HttpException('Forbidden access', HttpStatus.FORBIDDEN);

        filter.catch(error, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 403,
                message: 'Forbidden access',
            }),
        );
    });

    it('sanitizes unexpected Error to 500 without leaking stack traces or internals', () => {
        const secretError = new Error('Database password was leaked: supersecret');

        filter.catch(secretError, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 500,
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Ha ocurrido un error inesperado al procesar la solicitud',
            }),
        );
        expect(mockResponse.json).not.toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('supersecret'),
            }),
        );
    });
});
