import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { MovementSource, ReferenceType } from '../../../domain/types';

export class DispatchStockLineDto {
    @ApiProperty({
        description: 'ID UUID del producto a despachar',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsUUID('4', { message: 'productId debe ser un UUID válido' })
    @IsNotEmpty()
    productId: string;

    @ApiPropertyOptional({
        description: 'ID UUID de la variante específica (si no se envía, se toma la default)',
        example: '00000000-0000-0000-0000-000000000002',
    })
    @IsOptional()
    @IsUUID('4', { message: 'variantId debe ser un UUID válido' })
    variantId?: string;

    @ApiProperty({
        description: 'Cantidad a despachar/descargar (número decimal en formato string)',
        example: '10.0000',
    })
    @IsNumberString({}, { message: 'quantity debe ser un número decimal válido' })
    @IsNotEmpty()
    quantity: string;
}

export class DispatchStockDto {
    @ApiProperty({
        description: 'ID UUID de la bodega desde donde sale el stock',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsUUID('4', { message: 'warehouseId debe ser un UUID válido' })
    @IsNotEmpty({ message: 'warehouseId es obligatorio' })
    warehouseId: string;

    @ApiProperty({
        description: 'Número o identificador del documento de soporte (factura de venta, remisión de salida)',
        example: 'FAC-POS-100234',
    })
    @IsString()
    @IsNotEmpty({ message: 'referenceDocument es obligatorio' })
    referenceDocument: string;

    @ApiPropertyOptional({
        description: 'Tipo de documento de referencia',
        enum: ReferenceType,
        default: ReferenceType.POS_SALE,
    })
    @IsOptional()
    @IsEnum(ReferenceType)
    referenceType?: ReferenceType;

    @ApiPropertyOptional({
        description: 'ID UUID de la venta u orden de despacho',
        example: '00000000-0000-0000-0000-000000000010',
    })
    @IsOptional()
    @IsUUID('4')
    referenceId?: string;

    @ApiPropertyOptional({
        description: 'Origen del movimiento de salida',
        enum: MovementSource,
        default: MovementSource.POS,
    })
    @IsOptional()
    @IsEnum(MovementSource)
    source?: MovementSource;

    @ApiPropertyOptional({
        description: 'Observaciones o notas de la salida',
        example: 'Despacho caja registradora #1',
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({
        description: 'Fecha física del movimiento (ISO string)',
        example: '2026-10-06T10:15:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    occurredAt?: string;

    @ApiProperty({
        description: 'Líneas de productos a despachar',
        type: [DispatchStockLineDto],
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'Debe ingresar al menos una línea de producto' })
    @ValidateNested({ each: true })
    @Type(() => DispatchStockLineDto)
    lines: DispatchStockLineDto[];
}
