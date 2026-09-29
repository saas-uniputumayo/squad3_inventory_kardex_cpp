import { DomainException } from './domain.exception';

export class InvalidStockCountLineException extends DomainException {
    constructor(message: string) {
        super(
            message,
            'INVALID_STOCK_COUNT_LINE',
        );
    }
}