import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ListWarehousesQueryDto {
    @ApiPropertyOptional({
        description: 'Filtrar únicamente bodegas activas',
        example: true,
        default: true,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    @IsBoolean()
    onlyActive?: boolean = true;

    @ApiPropertyOptional({
        description: 'Filtrar bodegas por sucursal asignada',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsOptional()
    @IsUUID('4')
    branchId?: string;
}
