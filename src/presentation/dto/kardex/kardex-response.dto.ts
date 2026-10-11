import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType, ReferenceType } from '../../../domain/types';

export class KardexProductInfoResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    id!: string;

    @ApiProperty({ example: 'SKU-001' })
    sku!: string;

    @ApiProperty({ example: 'Arroz Diana 1kg' })
    name!: string;

    @ApiProperty({ example: 'KG' })
    unitOfMeasure!: string;
}

export class KardexWarehouseInfoResponseDto {
    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    id!: string;

    @ApiProperty({ example: 'Bodega Principal' })
    name!: string;
}

export class KardexEntryResponseDto {
    @ApiProperty({ example: '99999999-9999-4999-8999-999999999999' })
    id!: string;

    @ApiPropertyOptional({ example: '1' })
    sequence!: string | null;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    date!: Date;

    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    movementId!: string;

    @ApiProperty({ enum: MovementType, example: MovementType.PURCHASE_RECEIPT })
    movementType!: MovementType;

    @ApiPropertyOptional({ enum: ReferenceType, example: ReferenceType.PURCHASE })
    referenceType?: ReferenceType;

    @ApiPropertyOptional({ example: 'FAC-2026-001' })
    referenceDocument?: string;

    @ApiProperty({ example: '10.0000', description: 'Quantity received' })
    quantityIn!: string;

    @ApiProperty({ example: '0.0000', description: 'Quantity dispatched' })
    quantityOut!: string;

    @ApiProperty({ example: '10.0000', description: 'Cumulative balance of stock' })
    quantityBalance!: string;

    @ApiProperty({ example: '15000.00', description: 'Transaction unit cost' })
    unitCost!: string;

    @ApiProperty({ example: '15000.00', description: 'Weighted average unit cost (CPP)' })
    averageCost!: string;

    @ApiProperty({ example: '150000.00', description: 'Total inventory valuation at this point' })
    inventoryValue!: string;
}

export class KardexPaginationResponseDto {
    @ApiProperty({ example: 1 })
    page!: number;

    @ApiProperty({ example: 50 })
    limit!: number;

    @ApiProperty({ example: 120 })
    total!: number;

    @ApiProperty({ example: 3 })
    totalPages!: number;
}

export class KardexResponseDto {
    @ApiProperty({ type: KardexProductInfoResponseDto })
    product!: KardexProductInfoResponseDto;

    @ApiPropertyOptional({ type: KardexWarehouseInfoResponseDto })
    warehouse?: KardexWarehouseInfoResponseDto;

    @ApiProperty({ type: [KardexEntryResponseDto] })
    entries!: KardexEntryResponseDto[];

    @ApiProperty({ type: KardexPaginationResponseDto })
    pagination!: KardexPaginationResponseDto;
}
