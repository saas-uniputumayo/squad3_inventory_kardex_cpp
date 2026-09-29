import { DomainException } from './domain.exception';

export class InvalidTransferReferenceException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_TRANSFER_REFERENCE');
    }
}
