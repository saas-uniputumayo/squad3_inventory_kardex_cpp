import { ApiProperty } from '@nestjs/swagger';
import { MovementStatus, MovementType } from '../../../domain/types';

export class ReceiveStockLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '10.0000', description: 'Quantity received' })
    quantity!: string;

    @ApiProperty({ example: '15000.00', description: 'Unit cost received' })
    unitCost!: string;

    @ApiProperty({ example: '150000.00', description: 'Total cost of the received line' })
    totalCost!: string;

    @ApiProperty({ example: '0.0000', description: 'Stock quantity prior to movement' })
    previousStock!: string;

    @ApiProperty({ example: '10.0000', description: 'New stock quantity after movement' })
    newStock!: string;

    @ApiProperty({ example: '0.00', description: 'Previous average cost (CPP)' })
    previousAverageCost!: string;

    @ApiProperty({ example: '15000.00', description: 'Recalculated weighted average cost (CPP)' })
    newAverageCost!: string;
}

export class ReceiveStockResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    movementId!: string;

    @ApiProperty({ enum: MovementType, example: MovementType.PURCHASE_RECEIPT })
    type!: MovementType;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ example: 'FAC-2026-001' })
    referenceDocument!: string;

    @ApiProperty({ type: [ReceiveStockLineResponseDto] })
    lines!: ReceiveStockLineResponseDto[];

    @ApiProperty({ example: '150000.00', description: 'Total cost of all lines received' })
    totalReceivedCost!: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class DispatchStockLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '5.0000', description: 'Quantity dispatched' })
    quantity!: string;

    @ApiProperty({ example: '15000.00', description: 'Current CPP at time of dispatch' })
    unitCost!: string;

    @ApiProperty({ example: '75000.00', description: 'Total dispatch valuation' })
    totalCost!: string;

    @ApiProperty({ example: '10.0000', description: 'Stock prior to dispatch' })
    previousStock!: string;

    @ApiProperty({ example: '5.0000', description: 'Remaining stock after dispatch' })
    remainingStock!: string;
}

export class DispatchStockResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    movementId!: string;

    @ApiProperty({ enum: MovementType, example: MovementType.SALE_DISPATCH })
    type!: MovementType;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ example: 'REM-2026-001' })
    referenceDocument!: string;

    @ApiProperty({ type: [DispatchStockLineResponseDto] })
    lines!: DispatchStockLineResponseDto[];

    @ApiProperty({ example: '75000.00' })
    totalDispatchCost!: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class ReversalLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '5.0000', description: 'Restored quantity' })
    quantityRestored!: string;

    @ApiProperty({ example: '10.0000', description: 'Stock after reversal' })
    newStock!: string;

    @ApiProperty({ example: '15000.00', description: 'Updated CPP after reversal' })
    newAverageCost!: string;
}

export class ReverseMovementResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    reversedMovementId!: string;

    @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
    reversalMovementId!: string;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: 'Incorrect shipment quantity' })
    reason!: string;

    @ApiProperty({ type: [ReversalLineResponseDto] })
    lines!: ReversalLineResponseDto[];

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}
