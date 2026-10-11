import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Application Exceptions
import { ApplicationException } from '../../application/exceptions/application.exception';
import { IdempotencyConflictException } from '../../application/exceptions/idempotency-conflict.exception';
import { ProductBarcodeAlreadyExistsException } from '../../application/exceptions/product-barcode-already-exists.exception';
import { ProductSkuAlreadyExistsException } from '../../application/exceptions/product-sku-already-exists.exception';
import { ResourceNotFoundException } from '../../application/exceptions/resource-not-found.exception';

// Domain Exceptions
import { DomainException } from '../../domain/exceptions/domain.exception';
import { InvalidInventoryBalanceException } from '../../domain/exceptions/invalid-inventory-balance.exception';
import { InvalidInventoryLedgerEntryException } from '../../domain/exceptions/invalid-inventory-ledger-entry.exception';
import { InvalidInventoryMovementException } from '../../domain/exceptions/invalid-inventory-movement.exception';
import { InvalidInventoryTransferLineException } from '../../domain/exceptions/invalid-inventory-transfer-line.exception';
import { InvalidInventoryTransferException } from '../../domain/exceptions/invalid-inventory-transfer.exception';
import { InvalidMoneyException } from '../../domain/exceptions/invalid-money.exception';
import { InvalidMovementReferenceException } from '../../domain/exceptions/invalid-movement-reference.exception';
import { InvalidProductVariantException } from '../../domain/exceptions/invalid-product-variant.exception';
import { InvalidProductException } from '../../domain/exceptions/invalid-product.exception';
import { InvalidQuantityException } from '../../domain/exceptions/invalid-quantity.exception';
import { InvalidSkuException } from '../../domain/exceptions/invalid-sku.exception';
import { InvalidStockCountLineException } from '../../domain/exceptions/invalid-stock-count-line.exception';
import { InvalidStockCountException } from '../../domain/exceptions/invalid-stock-count.exception';
import { InvalidTransferReferenceException } from '../../domain/exceptions/invalid-transfer-reference.exception';
import { InvalidUnitCostException } from '../../domain/exceptions/invalid-unit-cost.exception';
import { InvalidUnitOfMeasureException } from '../../domain/exceptions/invalid-unit-of-measure.exception';
import { InvalidWarehouseException } from '../../domain/exceptions/invalid-warehouse.exception';

export interface StructuredErrorResponse {
    statusCode: number;
    code: string;
    message: string | string[];
    timestamp: string;
    path: string;
}

@Catch()
export class InventoryExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(InventoryExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const timestamp = new Date().toISOString();
        const path = request.url;

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_SERVER_ERROR';
        let message: string | string[] = 'Ha ocurrido un error interno en el servidor';

        // ─── 1. RECURSOS NO ENCONTRADOS (404 NOT FOUND) ──────────────────────────
        if (exception instanceof ResourceNotFoundException) {
            statusCode = HttpStatus.NOT_FOUND;
            code = exception.code;
            message = exception.message;
        }

        // ─── 2. CONFLICTOS DE ESTADO E IDEMPOTENCIA (409 CONFLICT) ───────────────
        else if (
            exception instanceof IdempotencyConflictException ||
            exception instanceof ProductSkuAlreadyExistsException ||
            exception instanceof ProductBarcodeAlreadyExistsException ||
            exception instanceof InvalidInventoryMovementException ||
            exception instanceof InvalidInventoryTransferException ||
            exception instanceof InvalidInventoryTransferLineException ||
            exception instanceof InvalidStockCountException ||
            exception instanceof InvalidStockCountLineException ||
            exception instanceof InvalidInventoryLedgerEntryException
        ) {
            statusCode = HttpStatus.CONFLICT;
            code = exception.code;
            message = exception.message;
        }

        // ─── 3. ENTIDADES NO PROCESABLES / INVARIANTES DE STOCK (422) ─────────────
        else if (
            exception instanceof InvalidInventoryBalanceException ||
            exception instanceof InvalidWarehouseException
        ) {
            statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
            code = exception.code;
            message = exception.message;
        }

        // ─── 4. ERRORES DE INPUT / VALIDACIÓN DE FORMATO (400 BAD REQUEST) ───────
        else if (
            exception instanceof InvalidQuantityException ||
            exception instanceof InvalidUnitCostException ||
            exception instanceof InvalidMoneyException ||
            exception instanceof InvalidSkuException ||
            exception instanceof InvalidMovementReferenceException ||
            exception instanceof InvalidTransferReferenceException ||
            exception instanceof InvalidUnitOfMeasureException ||
            exception instanceof InvalidProductException ||
            exception instanceof InvalidProductVariantException ||
            exception instanceof DomainException ||
            exception instanceof ApplicationException
        ) {
            statusCode = HttpStatus.BAD_REQUEST;
            code = exception.code;
            message = exception.message;
        }

        // ─── 5. HTTP EXCEPTIONS ESTÁNDAR DE NESTJS (ValidationPipe, 401, 403) ───
        else if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const resObj = exceptionResponse as Record<string, any>;
                code = resObj.error || HttpStatus[statusCode] || 'HTTP_EXCEPTION';
                message = resObj.message || exception.message;
            } else {
                code = HttpStatus[statusCode] || 'HTTP_EXCEPTION';
                message = exception.message;
            }
        }

        // ─── 6. ERRORES NO CONTROLADOS (500) SANITIZADOS ─────────────────────────
        else {
            this.logger.error(
                `Error no controlado en ${request.method} ${request.url}: ${(exception as Error)?.message}`,
                (exception as Error)?.stack,
            );
            statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            code = 'INTERNAL_SERVER_ERROR';
            message = 'Ha ocurrido un error inesperado al procesar la solicitud';
        }

        const errorPayload: StructuredErrorResponse = {
            statusCode,
            code,
            message,
            timestamp,
            path,
        };

        response.status(statusCode).json(errorPayload);
    }
}
