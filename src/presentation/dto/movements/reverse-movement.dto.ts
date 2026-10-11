import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { ReferenceType } from '../../../domain/types';

export class ReverseMovementDto {
    @ApiProperty({
        description: 'ID UUID del movimiento de inventario original que se desea anular/reversar',
        example: '00000000-0000-0000-0000-000000000001',
    })
    @IsUUID('4', { message: 'movementId debe ser un UUID válido' })
    @IsNotEmpty({ message: 'movementId es obligatorio' })
    movementId: string;

    @ApiProperty({
        description: 'Motivo o justificación de la anulación del movimiento',
        example: 'Factura anulada por error en digitación del cliente',
    })
    @IsString()
    @IsNotEmpty({ message: 'El motivo (reason) es obligatorio' })
    reason: string;

    @ApiPropertyOptional({
        description: 'Tipo de documento de soporte de la anulación',
        enum: ReferenceType,
        default: ReferenceType.MANUAL_ADJUSTMENT,
    })
    @IsOptional()
    @IsEnum(ReferenceType)
    referenceType?: ReferenceType;

    @ApiPropertyOptional({
        description: 'Identificador del documento de reversión',
        example: 'NOTA-CREDITO-0042',
    })
    @IsOptional()
    @IsString()
    referenceDocument?: string;

    @ApiPropertyOptional({
        description: 'ID UUID de referencia externa',
        example: '00000000-0000-0000-0000-000000000009',
    })
    @IsOptional()
    @IsUUID('4')
    referenceId?: string;
}
