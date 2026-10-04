import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Sonda de Salud')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Mensaje de bienvenida del servicio de inventarios y Kardex' })
  getHello(): string {
    return 'SaaS Contable UniPutumayo - Squad 3: Multi-Warehouse Inventory & Kardex CPP Engine en ejecucion.';
  }

  @Get('health')
  @ApiOperation({ summary: 'Sonda de vida del servicio (Healthcheck)' })
  getHealth() {
    return {
      status: 'ok',
      service: 'squad3_inventory_kardex_cpp',
      port: process.env.PORT || 3003,
      timestamp: new Date().toISOString(),
    };
  }
}
