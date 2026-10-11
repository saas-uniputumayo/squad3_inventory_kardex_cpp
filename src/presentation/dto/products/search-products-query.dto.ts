import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class SearchProductsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Búsqueda por texto libre en SKU o nombre',
        example: 'arepa',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filtro exacto por SKU',
        example: 'SKU-AREPA-001',
    })
    @IsOptional()
    @IsString()
    sku?: string;

    @ApiPropertyOptional({
        description: 'Filtro exacto por código de barras',
        example: '7701234567890',
    })
    @IsOptional()
    @IsString()
    barcode?: string;

    @ApiPropertyOptional({
        description: 'Filtro por ID de categoría',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsOptional()
    @IsUUID('4')
    categoryId?: string;

    @ApiPropertyOptional({
        description: 'Filtro de existencias para una bodega específica (incluye saldos en la respuesta)',
        example: '00000000-0000-0000-0000-000000000002',
    })
    @IsOptional()
    @IsUUID('4')
    warehouseId?: string;

    @ApiPropertyOptional({
        description: 'Filtro por estado de activación (true o false)',
        example: true,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    @IsBoolean()
    isActive?: boolean;
}
