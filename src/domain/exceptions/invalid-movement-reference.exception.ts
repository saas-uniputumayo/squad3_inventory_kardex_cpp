import { DomainException } from './domain.exception';

export class InvalidMovementReferenceException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_MOVEMENT_REFERENCE');
    }
}
