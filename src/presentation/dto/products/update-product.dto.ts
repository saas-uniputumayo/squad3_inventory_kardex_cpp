import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNumberString,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';

export class UpdateProductDto {
    @ApiPropertyOptional({
        description: 'Nombre comercial actualizado del producto',
        example: 'Arepa de Maíz Peto Familiar x 10 uds',
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({
        description: 'Descripción actualizada del producto',
        example: 'Paquete familiar de 10 arepas precocidas',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        description: 'Código de barras actualizado',
        example: '7709999888877',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    barcode?: string;

    @ApiPropertyOptional({
        description: 'ID UUID de la categoría asociada',
        example: '00000000-0000-0000-0000-000000000002',
    })
    @IsOptional()
    @IsUUID('4')
    categoryId?: string;

    @ApiPropertyOptional({
        description: 'Precio base de venta al público (formato decimal string)',
        example: '3000.0000',
    })
    @IsOptional()
    @IsNumberString()
    salePrice?: string;

    @ApiPropertyOptional({
        description: 'Precio al por mayor opcional (formato decimal string)',
        example: '2600.0000',
    })
    @IsOptional()
    @IsNumberString()
    wholesalePrice?: string;

    @ApiPropertyOptional({
        description: 'Costo de adquisición de referencia (formato decimal string)',
        example: '1800.0000',
    })
    @IsOptional()
    @IsNumberString()
    costPrice?: string;

    @ApiPropertyOptional({
        description: 'Porcentaje de IVA / Impuesto',
        example: '19.0000',
    })
    @IsOptional()
    @IsNumberString()
    taxRate?: string;

    @ApiPropertyOptional({
        description: 'Nivel mínimo de existencias para emitir alertas',
        example: '15.0000',
    })
    @IsOptional()
    @IsNumberString()
    minStockAlert?: string;

    @ApiPropertyOptional({
        description: 'ID UUID de la unidad de medida',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @IsOptional()
    @IsUUID('4')
    unitOfMeasureId?: string;

    @ApiPropertyOptional({
        description: 'Estado de activación del producto en el catálogo',
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
