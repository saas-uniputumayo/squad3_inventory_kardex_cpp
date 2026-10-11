import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MovementType } from '../../../domain/types';

export class GetKardexQueryDto {
    @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
    @IsUUID('4')
    @IsOptional()
    variantId?: string;

    @ApiPropertyOptional({ example: '44444444-4444-4444-8444-444444444444' })
    @IsUUID('4')
    @IsOptional()
    warehouseId?: string;

    @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
    @IsDate()
    @Type(() => Date)
    @IsOptional()
    from?: Date;

    @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
    @IsDate()
    @Type(() => Date)
    @IsOptional()
    to?: Date;

    @ApiPropertyOptional({ enum: MovementType, example: MovementType.PURCHASE_RECEIPT })
    @IsEnum(MovementType)
    @IsOptional()
    movementType?: MovementType;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    @IsOptional()
    limit?: number = 50;
}
