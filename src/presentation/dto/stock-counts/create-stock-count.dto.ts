import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStockCountDto {
    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    @IsUUID('4')
    @IsNotEmpty()
    warehouseId!: string;

    @ApiPropertyOptional({ example: 'Toma física mensual de inventario' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['11111111-1111-4111-8111-111111111111'],
        description: 'Lista opcional de IDs de productos a incluir. Si se omite, se incluyen todos los productos de la bodega.',
    })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    productIds?: string[];

    @ApiPropertyOptional({
        example: true,
        description: 'Indica si la sesión pasa a estado IN_PROGRESS inmediatamente al ser creada',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    autoStart?: boolean;
}
