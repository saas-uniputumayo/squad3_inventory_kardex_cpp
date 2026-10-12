import { ApiProperty } from '@nestjs/swagger';
import { MovementStatus, MovementType } from '../../../domain/types';

export class ReceiveStockLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '10.0000', description: 'Cantidad recibida (entrada)' })
    quantity!: string;

    @ApiProperty({ example: '15000.00', description: 'Costo unitario de compra recibido' })
    unitCost!: string;

    @ApiProperty({ example: '150000.00', description: 'Costo total de la línea recibida' })
    totalCost!: string;

    @ApiProperty({ example: '0.0000', description: 'Existencia previa al movimiento' })
    previousStock!: string;

    @ApiProperty({ example: '10.0000', description: 'Nueva existencia posterior al movimiento' })
    newStock!: string;

    @ApiProperty({ example: '0.00', description: 'Costo promedio ponderado (CPP) previo' })
    previousAverageCost!: string;

    @ApiProperty({ example: '15000.00', description: 'Costo promedio ponderado (CPP) recalculado' })
    newAverageCost!: string;
}

export class ReceiveStockResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    movementId!: string;

    @ApiProperty({ enum: MovementType, example: MovementType.PURCHASE_RECEIPT })
    type!: MovementType;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ example: 'FAC-2026-001' })
    referenceDocument!: string;

    @ApiProperty({ type: [ReceiveStockLineResponseDto] })
    lines!: ReceiveStockLineResponseDto[];

    @ApiProperty({ example: '150000.00', description: 'Costo total acumulado de las líneas recibidas' })
    totalReceivedCost!: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class DispatchStockLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '5.0000', description: 'Cantidad despachada (salida)' })
    quantity!: string;

    @ApiProperty({ example: '15000.00', description: 'CPP vigente al momento del despacho' })
    unitCost!: string;

    @ApiProperty({ example: '75000.00', description: 'Valoración total del despacho a costo CPP' })
    totalCost!: string;

    @ApiProperty({ example: '10.0000', description: 'Existencia previa al despacho' })
    previousStock!: string;

    @ApiProperty({ example: '5.0000', description: 'Existencia remanente tras el despacho' })
    remainingStock!: string;
}

export class DispatchStockResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    movementId!: string;

    @ApiProperty({ enum: MovementType, example: MovementType.SALE_DISPATCH })
    type!: MovementType;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
    warehouseId!: string;

    @ApiProperty({ example: 'REM-2026-001' })
    referenceDocument!: string;

    @ApiProperty({ type: [DispatchStockLineResponseDto] })
    lines!: DispatchStockLineResponseDto[];

    @ApiProperty({ example: '75000.00', description: 'Costo total acumulado del despacho (CMV)' })
    totalDispatchCost!: string;

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}

export class ReversalLineResponseDto {
    @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
    productId!: string;

    @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
    variantId!: string;

    @ApiProperty({ example: '5.0000', description: 'Cantidad física restaurada' })
    quantityRestored!: string;

    @ApiProperty({ example: '10.0000', description: 'Nueva existencia tras la reversión' })
    newStock!: string;

    @ApiProperty({ example: '15000.00', description: 'CPP actualizado tras la reversión' })
    newAverageCost!: string;
}

export class ReverseMovementResponseDto {
    @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
    reversedMovementId!: string;

    @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
    reversalMovementId!: string;

    @ApiProperty({ enum: MovementStatus, example: MovementStatus.POSTED })
    status!: MovementStatus;

    @ApiProperty({ example: 'Anulación por error en cantidad digitada' })
    reason!: string;

    @ApiProperty({ type: [ReversalLineResponseDto] })
    lines!: ReversalLineResponseDto[];

    @ApiProperty({ example: '2026-10-06T10:00:00.000Z' })
    createdAt!: Date;
}
