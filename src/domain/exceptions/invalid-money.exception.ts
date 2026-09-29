import { DomainException } from './domain.exception';

export class InvalidMoneyException extends DomainException {
    constructor(message: string) {
        super(message, 'INVALID_MONEY');
    }
}