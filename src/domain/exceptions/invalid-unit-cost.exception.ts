import { DomainException } from './domain.exception';

export class InvalidUnitCostException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_UNIT_COST');
    }
}
