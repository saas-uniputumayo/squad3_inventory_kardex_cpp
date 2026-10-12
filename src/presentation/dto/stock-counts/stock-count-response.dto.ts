import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockCountStatus } from '../../../domain/types';

export class StockCountLineSummaryResponseDto {
    @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
    id!: string;

    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '10.0000', description: 'Cantidad de stock capturada del sistema en la instantánea' })
    systemQuantity!: string;
}

export class CreateStockCountResponseDto {
    @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
    id!: string;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ enum: StockCountStatus, example: StockCountStatus.DRAFT })
    status!: StockCountStatus;

    @ApiProperty({ example: 1 })
    linesCount!: number;

    @ApiProperty({ type: [StockCountLineSummaryResponseDto] })
    lines!: StockCountLineSummaryResponseDto[];

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;

    @ApiPropertyOptional({ example: '2026-10-06T10:05:00.000Z' })
    startedAt?: Date;
}

export class AppliedAdjustmentLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '10.0000' })
    systemQuantity!: string;

    @ApiProperty({ example: '12.0000' })
    countedQuantity!: string;

    @ApiProperty({ example: '2.0000' })
    differenceQuantity!: string;

    @ApiProperty({ enum: ['SURPLUS', 'SHORTAGE', 'EQUAL'], example: 'SURPLUS' })
    adjustmentType!: 'SURPLUS' | 'SHORTAGE' | 'EQUAL';

    @ApiPropertyOptional({ example: '33333333-3333-4333-8333-333333333333' })
    movementId?: string;
}

export class ApplyStockCountResponseDto {
    @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
    stockCountId!: string;

    @ApiProperty({ enum: StockCountStatus, example: StockCountStatus.COMPLETED })
    status!: StockCountStatus;

    @ApiProperty({ example: 10 })
    totalLines!: number;

    @ApiProperty({ example: 2 })
    adjustedLines!: number;

    @ApiProperty({ type: [AppliedAdjustmentLineResponseDto] })
    lines!: AppliedAdjustmentLineResponseDto[];

    @ApiProperty({ example: '2026-10-06T11:00:00.000Z' })
    completedAt!: Date;
}
