import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Application Module (Inbound Use Cases)
import { InventoryApplicationModule } from '../application/application.module';

// Presentation Controllers
import { ProductsController } from './controllers/inventory/products.controller';
import { WarehousesController } from './controllers/inventory/warehouses.controller';
import { InventoryMovementsController } from './controllers/inventory/inventory-movements.controller';
import { TransfersController } from './controllers/inventory/transfers.controller';
import { KardexController } from './controllers/inventory/kardex.controller';
import { StockAlertsController } from './controllers/inventory/stock-alerts.controller';
import { StockCountsController } from './controllers/inventory/stock-counts.controller';

// Guards, Interceptors, Filters
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { InventoryExceptionFilter } from './filters/inventory-exception.filter';

@Module({
    imports: [
        InventoryApplicationModule, // Pure Application layer dependency
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const secret = configService.get<string>('JWT_SECRET');

                if (!secret) {
                    throw new Error('FATAL: Variable de entorno JWT_SECRET obligatoria no configurada en el servidor');
                }

                return {
                    secret,
                    signOptions: {
                        expiresIn: (configService.get<string>('JWT_EXPIRATION') || '8h') as any,
                    },
                };
            },
        }),
    ],
    controllers: [
        ProductsController,
        WarehousesController,
        InventoryMovementsController,
        TransfersController,
        KardexController,
        StockAlertsController,
        StockCountsController,
    ],
    providers: [
        JwtAuthGuard,
        RolesGuard,
        TenantInterceptor,
        InventoryExceptionFilter,
    ],
    exports: [
        JwtAuthGuard,
        RolesGuard,
        TenantInterceptor,
        InventoryExceptionFilter,
        InventoryApplicationModule,
    ],
})
export class PresentationModule {}
