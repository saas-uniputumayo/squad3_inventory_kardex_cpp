import { ApplicationException } from './application.exception';

export class ResourceNotFoundException extends ApplicationException {
    constructor(
        resourceName: string,
        identifier: string,
        code: string = 'RESOURCE_NOT_FOUND',
    ) {
        super(`${resourceName} con identificador '${identifier}' no fue encontrado`, code);
    }
}

export class ProductNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Producto', identifier, 'PRODUCT_NOT_FOUND');
    }
}

export class ProductVariantNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Variante de producto', identifier, 'PRODUCT_VARIANT_NOT_FOUND');
    }
}

export class WarehouseNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Bodega', identifier, 'WAREHOUSE_NOT_FOUND');
    }
}

export class UnitOfMeasureNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Unidad de medida', identifier, 'UNIT_OF_MEASURE_NOT_FOUND');
    }
}

export class MovementNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Movimiento de inventario', identifier, 'MOVEMENT_NOT_FOUND');
    }
}

export class TransferNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Transferencia de inventario', identifier, 'TRANSFER_NOT_FOUND');
    }
}

export class StockCountNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string) {
        super('Conteo físico', identifier, 'STOCK_COUNT_NOT_FOUND');
    }
}
