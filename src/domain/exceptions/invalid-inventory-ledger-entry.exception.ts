import { DomainException } from './domain.exception';

export class InvalidInventoryLedgerEntryException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_INVENTORY_LEDGER_ENTRY');
    }
}
