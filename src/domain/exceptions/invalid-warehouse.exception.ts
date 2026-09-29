import { DomainException } from './domain.exception';

export class InvalidWarehouseException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_WAREHOUSE');
    }
}