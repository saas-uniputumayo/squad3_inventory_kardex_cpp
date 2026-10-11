import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class TransferStockLineDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    @IsUUID('4')
    @IsNotEmpty()
    productId!: string;

    @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
    @IsUUID('4')
    @IsOptional()
    variantId?: string;

    @ApiProperty({ example: '5.0000', description: 'Quantity to transfer in exact decimal representation' })
    @IsString()
    @IsNotEmpty()
    quantity!: string;
}

export class TransferStockDto {
    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    @IsUUID('4')
    @IsNotEmpty()
    sourceWarehouseId!: string;

    @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
    @IsUUID('4')
    @IsNotEmpty()
    destinationWarehouseId!: string;

    @ApiProperty({ example: 'TR-2026-001' })
    @IsString()
    @IsNotEmpty()
    referenceDocument!: string;

    @ApiPropertyOptional({ example: 'Replenishing regional warehouse' })
    @IsString()
    @IsOptional()
    reason?: string;

    @ApiPropertyOptional({ example: false, description: 'If true, creates IN_TRANSIT transfer requiring receive confirmation' })
    @IsBoolean()
    @IsOptional()
    isTwoPhase?: boolean;

    @ApiPropertyOptional({ example: 'Handle with care' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty({ type: [TransferStockLineDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => TransferStockLineDto)
    lines!: TransferStockLineDto[];
}
