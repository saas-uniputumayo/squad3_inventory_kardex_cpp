import { DomainException } from './domain.exception';

export class InvalidProductException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_PRODUCT');
    }
}