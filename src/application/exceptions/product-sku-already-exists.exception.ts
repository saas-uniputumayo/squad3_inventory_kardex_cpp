import { ApplicationException } from './application.exception';

export class ProductSkuAlreadyExistsException extends ApplicationException {
    constructor(
        public readonly sku: string,
        message?: string,
    ) {
        super(
            message || `Ya existe un producto registrado con el SKU '${sku}' en este tenant`,
            'PRODUCT_SKU_ALREADY_EXISTS',
        );
    }
}
