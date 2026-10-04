import { TransferStatus } from '../../../domain/types';

export interface ReceiveTransferCommand {
    tenantId: string;
    transferId: string;
    performedById?: string;
    idempotencyKey?: string;
}

export interface ReceiveTransferResult {
    transferId: string;
    status: TransferStatus;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    inboundMovementId: string;
    completedAt: Date;
}

export interface ReceiveTransferUseCase {
    execute(command: ReceiveTransferCommand): Promise<ReceiveTransferResult>;
}
