import { DomainException } from './domain.exception';

export class InvalidProductVariantException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_PRODUCT_VARIANT');
    }
}