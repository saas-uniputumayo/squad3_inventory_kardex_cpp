import { ApplicationException } from './application.exception';

export class IdempotencyConflictException extends ApplicationException {
    constructor(
        public readonly idempotencyKey: string,
        public readonly operation: string,
        message?: string,
    ) {
        super(
            message ||
                `Conflicto de idempotencia para la clave '${idempotencyKey}' en la operación '${operation}'`,
            'IDEMPOTENCY_CONFLICT',
        );
    }
}
