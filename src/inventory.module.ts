import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { INVENTORY_REPOSITORY_PORT } from './core/domain/ports/outbound/inventory-repository.port';
import { PostgresInventoryRepository } from './infrastructure/adapters/out/postgres-inventory.repository';
import { InventoryService } from './core/application/services/inventory.service';

import { ProductsController } from './infrastructure/adapters/in/products.controller';
import { WarehousesController } from './infrastructure/adapters/in/warehouses.controller';
import { StockMovesController } from './infrastructure/adapters/in/stock-moves.controller';
import { KardexController } from './infrastructure/adapters/in/kardex.controller';

import { JwtAuthGuard } from './infrastructure/adapters/in/jwt-auth.guard';
import { TenantInterceptor } from './infrastructure/adapters/in/tenant.interceptor';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'super_secret_jwt_key_uniputumayo_2026_production',
        ),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [
    ProductsController,
    WarehousesController,
    StockMovesController,
    KardexController,
  ],
  providers: [
    InventoryService,
    {
      provide: INVENTORY_REPOSITORY_PORT,
      useClass: PostgresInventoryRepository,
    },
    JwtAuthGuard,
    TenantInterceptor,
  ],
  exports: [InventoryService, INVENTORY_REPOSITORY_PORT],
})
export class InventoryModule {}
