import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReverseMoveDto {
  @ApiProperty({ description: 'ID del movimiento original de inventario que se desea reversar' })
  @IsUUID()
  @IsNotEmpty()
  originalMoveId: string;

  @ApiProperty({ description: 'Motivo auditado de la reversion de inventario', example: 'Anulacion de venta POS comprobante POS-001' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
