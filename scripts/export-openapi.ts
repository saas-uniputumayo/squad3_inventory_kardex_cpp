import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
    console.log('Generando especificación OpenAPI/Swagger...');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');

    const config = new DocumentBuilder()
        .setTitle('SaaS Contable UniPutumayo — Motor de Inventarios y Kardex CPP (Squad 3)')
        .setDescription(
            'API RESTful del Motor de Inventarios, Multi-Bodega, Valuación Kardex CPP, Transferencias en Dos Fases, Tomas Físicas y Validación de Sesiones en Redis.',
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
    const outputPath = path.resolve(__dirname, '../docs/openapi.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
    console.log(`Especificación OpenAPI exportada exitosamente en: ${outputPath}`);

    // También guardar una copia en la raíz para fácil acceso: swagger.json
    const rootSwaggerPath = path.resolve(__dirname, '../swagger.json');
    fs.writeFileSync(rootSwaggerPath, JSON.stringify(document, null, 2), 'utf-8');
    console.log(`Copia OpenAPI raíz guardada en: ${rootSwaggerPath}`);

    await app.close();
}

exportOpenApi()
    .then(() => {
        console.log('Exportación finalizada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error durante la exportación de OpenAPI:', err);
        process.exit(1);
    });
