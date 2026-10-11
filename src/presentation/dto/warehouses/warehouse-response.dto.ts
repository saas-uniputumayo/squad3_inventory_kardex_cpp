import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WarehouseStatus } from '../../../domain/types';

export class WarehouseResponseDto {
    @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', description: 'ID de la bodega' })
    id: string;

    @ApiProperty({ example: 'BOD-01', description: 'Código único de la bodega' })
    code: string;

    @ApiProperty({ example: 'Bodega Principal', description: 'Nombre descriptivo' })
    name: string;

    @ApiPropertyOptional({ example: 'Bodega central de almacenamiento', nullable: true })
    description: string | null;

    @ApiProperty({ example: '00000000-0000-0000-0000-000000000002', description: 'ID de la sucursal' })
    branchId: string;

    @ApiProperty({ enum: WarehouseStatus, example: WarehouseStatus.ACTIVE })
    status: WarehouseStatus;

    @ApiProperty({ example: true, description: 'Indica si está operativa para movimientos' })
    isActive: boolean;
}
