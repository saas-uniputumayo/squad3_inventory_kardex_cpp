import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Número de página a consultar (1-indexed)',
        example: 1,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La página debe ser un número entero' })
    @Min(1, { message: 'La página mínima es 1' })
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Cantidad de elementos por página',
        example: 20,
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El límite debe ser un número entero' })
    @Min(1, { message: 'El límite mínimo es 1' })
    @Max(100, { message: 'El límite máximo por página es 100' })
    limit?: number = 20;
}
