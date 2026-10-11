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

export class ReceiveStockLineDto {
    @ApiProperty({
        description: 'ID UUID del producto a ingresar',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsUUID('4', { message: 'productId debe ser un UUID válido' })
    @IsNotEmpty()
    productId: string;

    @ApiPropertyOptional({
        description: 'ID UUID de la variante específica (si no se envía, se usa la variante default)',
        example: '00000000-0000-0000-0000-000000000002',
    })
    @IsOptional()
    @IsUUID('4', { message: 'variantId debe ser un UUID válido' })
    variantId?: string;

    @ApiProperty({
        description: 'Cantidad a ingresar (número decimal en formato string)',
        example: '50.0000',
    })
    @IsNumberString({}, { message: 'quantity debe ser un número decimal válido' })
    @IsNotEmpty()
    quantity: string;

    @ApiProperty({
        description: 'Costo unitario de compra o adquisición (número decimal en formato string)',
        example: '1500.0000',
    })
    @IsNumberString({}, { message: 'unitCost debe ser un número decimal válido' })
    @IsNotEmpty()
    unitCost: string;
}

export class ReceiveStockDto {
    @ApiProperty({
        description: 'ID UUID de la bodega receptora',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsUUID('4', { message: 'warehouseId debe ser un UUID válido' })
    @IsNotEmpty({ message: 'warehouseId es obligatorio' })
    warehouseId: string;

    @ApiProperty({
        description: 'Número o identificador del documento de soporte (factura de compra, remisión, etc.)',
        example: 'FAC-COMPRA-8921',
    })
    @IsString()
    @IsNotEmpty({ message: 'referenceDocument es obligatorio' })
    referenceDocument: string;

    @ApiPropertyOptional({
        description: 'Tipo de documento de referencia',
        enum: ReferenceType,
        default: ReferenceType.PURCHASE,
    })
    @IsOptional()
    @IsEnum(ReferenceType)
    referenceType?: ReferenceType;

    @ApiPropertyOptional({
        description: 'ID UUID de la entidad de referencia externa (orden de compra, etc.)',
        example: '00000000-0000-0000-0000-000000000005',
    })
    @IsOptional()
    @IsUUID('4')
    referenceId?: string;

    @ApiPropertyOptional({
        description: 'Origen del movimiento de entrada',
        enum: MovementSource,
        default: MovementSource.PURCHASE,
    })
    @IsOptional()
    @IsEnum(MovementSource)
    source?: MovementSource;

    @ApiPropertyOptional({
        description: 'Notas u observaciones del movimiento',
        example: 'Recepción de lote 2026-A proveedor Molinos del Sur',
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({
        description: 'Fecha en que ocurrió el movimiento físico (ISO string)',
        example: '2026-10-06T10:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    occurredAt?: string;

    @ApiProperty({
        description: 'Líneas de productos a ingresar al inventario',
        type: [ReceiveStockLineDto],
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'Debe ingresar al menos una línea de producto' })
    @ValidateNested({ each: true })
    @Type(() => ReceiveStockLineDto)
    lines: ReceiveStockLineDto[];
}
