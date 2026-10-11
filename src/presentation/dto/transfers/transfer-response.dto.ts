import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferStatus } from '../../../domain/types';

export class TransferStockLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '5.0000' })
    quantity!: string;

    @ApiProperty({ example: '15000.00' })
    unitCost!: string;

    @ApiProperty({ example: '75000.00' })
    totalCost!: string;
}

export class TransferStockResponseDto {
    @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
    transferId!: string;

    @ApiProperty({ enum: TransferStatus, example: TransferStatus.COMPLETED })
    status!: TransferStatus;

    @ApiProperty({ example: 'TR-2026-001' })
    referenceDocument!: string;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    sourceWarehouseId!: string;

    @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
    destinationWarehouseId!: string;

    @ApiProperty({ type: [TransferStockLineResponseDto] })
    lines!: TransferStockLineResponseDto[];

    @ApiPropertyOptional({ example: '77777777-7777-4777-8777-777777777777' })
    outboundMovementId?: string;

    @ApiPropertyOptional({ example: '88888888-8888-4888-8888-888888888888' })
    inboundMovementId?: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class ReceiveTransferResponseDto {
    @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
    transferId!: string;

    @ApiProperty({ enum: TransferStatus, example: TransferStatus.COMPLETED })
    status!: TransferStatus;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    sourceWarehouseId!: string;

    @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
    destinationWarehouseId!: string;

    @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
    inboundMovementId!: string;

    @ApiProperty({ example: '2026-10-06T10:30:00.000Z' })
    completedAt!: Date;
}
