import { DomainException } from './domain.exception';

export class InvalidSkuException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_SKU');
    }
}