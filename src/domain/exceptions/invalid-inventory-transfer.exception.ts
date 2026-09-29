import { DomainException } from './domain.exception';

export class InvalidInventoryTransferException
    extends DomainException {
    constructor(message: string) {
        super(
            message,
            'INVALID_INVENTORY_TRANSFER',
        );
    }
}