import { DomainException } from './domain.exception';

export class InvalidInventoryBalanceException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_INVENTORY_BALANCE');
    }
}