import { DomainException } from './domain.exception';

export class InvalidQuantityException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_QUANTITY');
    }
}