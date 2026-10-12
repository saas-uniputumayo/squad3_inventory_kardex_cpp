import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CountLineDto {
    @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
    @IsUUID('4')
    @IsNotEmpty()
    lineId!: string;

    @ApiProperty({ example: '12.0000', description: 'Cantidad física real contada' })
    @IsString()
    @IsNotEmpty()
    countedQuantity!: string;

    @ApiPropertyOptional({ example: 'Conteo verificado en bodega' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class ApplyStockCountDto {
    @ApiPropertyOptional({
        type: [CountLineDto],
        description: 'Actualizaciones opcionales de líneas de conteo antes de aplicar y asentar los ajustes',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CountLineDto)
    @IsOptional()
    counts?: CountLineDto[];
}
