import { DomainException } from './domain.exception';

export class InvalidStockCountException extends DomainException {
    constructor(message: string) {
        super(
            message,
            'INVALID_STOCK_COUNT',
        );
    }
}