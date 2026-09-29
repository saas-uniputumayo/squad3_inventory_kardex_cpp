import { DomainException } from './domain.exception';

export class InvalidInventoryTransferLineException
    extends DomainException {
    constructor(message: string) {
        super(
            message,
            'INVALID_INVENTORY_TRANSFER_LINE',
        );
    }
}