import { DomainException } from './domain.exception';

export class InvalidUnitOfMeasureException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_UNIT_OF_MEASURE');
    }
}