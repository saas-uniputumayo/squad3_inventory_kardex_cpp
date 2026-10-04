import { ApplicationException } from './application.exception';

export class ProductBarcodeAlreadyExistsException extends ApplicationException {
    constructor(
        public readonly barcode: string,
        message?: string,
    ) {
        super(
            message ||
                `Ya existe un producto registrado con el código de barras '${barcode}' en este tenant`,
            'PRODUCT_BARCODE_ALREADY_EXISTS',
        );
    }
}
