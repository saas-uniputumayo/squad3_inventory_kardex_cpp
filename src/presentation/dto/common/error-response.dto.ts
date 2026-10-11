import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
    @ApiProperty({ example: 400, description: 'Código de estado HTTP' })
    statusCode: number;

    @ApiProperty({
        example: 'INSUFFICIENT_STOCK',
        description: 'Código de error estructurado del dominio o aplicación',
    })
    code: string;

    @ApiProperty({
        example: 'No hay existencias suficientes para realizar el despacho',
        description: 'Mensaje descriptivo del error',
    })
    message: string | string[];

    @ApiProperty({
        example: '2026-10-06T06:30:00.000Z',
        description: 'Marca de tiempo en formato ISO',
    })
    timestamp: string;

    @ApiProperty({
        example: '/api/v1/inventory/moves/dispatch',
        description: 'Ruta del endpoint solicitado',
    })
    path: string;
}
