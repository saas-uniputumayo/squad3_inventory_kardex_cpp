import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { InventoryExceptionFilter } from './presentation/filters/inventory-exception.filter';

import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Fail-fast on startup if JWT_SECRET is not configured (CRÍTICO 5)
    const configService = app.get(ConfigService);
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
        logger.error('FATAL: Variable de entorno JWT_SECRET obligatoria no está configurada en el servidor');
        process.exit(1);
    }

    // Global API versioned prefix
    app.setGlobalPrefix('api/v1');

    // Security & Validation: Strict global ValidationPipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: false },
        }),
    );

    // Global centralized exception filter for inventory domain & application exceptions
    app.useGlobalFilters(new InventoryExceptionFilter());

    // CORS configuration
    const corsOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
        : '*';

    app.enableCors({
        origin: corsOrigins,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Swagger OpenAPI Documentation
    const config = new DocumentBuilder()
        .setTitle('SaaS Contable UniPutumayo — Motor de Inventarios y Kardex CPP (Squad 3)')
        .setDescription(
            'API RESTful de Inventarios Multi-Tenant con PostgreSQL RLS, Control Multi-Bodega, Valuación Kardex CPP, Transferencias en Dos Fases, Tomas Físicas y Validación de Sesiones en Redis.',
        )
        .setVersion('1.0.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Token JWT emitido por Core (claims: sub, tenantId, role, jti)',
            },
            'bearer',
        )
        .addTag('Inventory - Products', 'Catálogo de productos, variantes, precios y unidades de medida')
        .addTag('Inventory - Warehouses', 'Consulta y filtrado de bodegas asignadas al tenant')
        .addTag('Inventory - Movements', 'Recepciones de compra, despachos y reversiones con recálculo de Costo Promedio Ponderado (CPP)')
        .addTag('Inventory - Transfers', 'Traslados multi-bodega directos o en dos fases (en tránsito y recepción)')
        .addTag('Inventory - Stock Counts', 'Sesiones de toma física de inventario y aplicación de ajustes por faltante/sobrante')
        .addTag('Inventory - Kardex', 'Libro mayor de inventarios oficial con trazabilidad de movimientos y saldos acumulados')
        .addTag('Inventory - Stock Alerts', 'Monitoreo de productos con stock por debajo del umbral mínimo de seguridad')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });

    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    logger.log(`Inventory Engine API running on port ${port} with prefix /api/v1`);
    logger.log(`OpenAPI documentation available at /api/docs`);
}

bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
