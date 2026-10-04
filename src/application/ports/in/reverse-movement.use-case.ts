import {
    MovementStatus,
    ReferenceType,
} from '../../../domain/types';

export interface ReverseMovementCommand {
    tenantId: string;
    movementId: string;
    reason: string;
    referenceType?: ReferenceType;
    referenceId?: string;
    referenceDocument?: string;
    performedById?: string;
    idempotencyKey?: string;
}

export interface ReversalLineResult {
    productId: string;
    variantId: string;
    quantityRestored: string;
    newStock: string;
    newAverageCost: string;
}

export interface ReverseMovementResult {
    reversedMovementId: string;
    reversalMovementId: string;
    status: MovementStatus;
    reason: string;
    lines: ReversalLineResult[];
    createdAt: Date;
}

export interface ReverseMovementUseCase {
    execute(command: ReverseMovementCommand): Promise<ReverseMovementResult>;
}
