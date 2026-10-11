import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class GetStockAlertsQueryDto {
    @ApiPropertyOptional({ example: '44444444-4444-4444-8444-444444444444' })
    @IsUUID('4')
    @IsOptional()
    warehouseId?: string;

    @ApiPropertyOptional({ example: 'Arroz' })
    @IsString()
    @IsOptional()
    search?: string;

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
