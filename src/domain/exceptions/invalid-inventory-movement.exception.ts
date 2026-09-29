import { DomainException } from './domain.exception';

export class InvalidInventoryMovementException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_INVENTORY_MOVEMENT');
    }
}