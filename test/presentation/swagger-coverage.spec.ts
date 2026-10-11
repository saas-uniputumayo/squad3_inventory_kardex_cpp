import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';

describe('Swagger / OpenAPI Documentation Coverage Audit', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    const EXPECTED_OPERATIONS: { method: string; path: string; tag: string }[] = [
        { method: 'post', path: '/api/v1/inventory/products', tag: 'Inventory - Products' },
        { method: 'get', path: '/api/v1/inventory/products', tag: 'Inventory - Products' },
        { method: 'patch', path: '/api/v1/inventory/products/{id}', tag: 'Inventory - Products' },
        { method: 'get', path: '/api/v1/inventory/products/{id}', tag: 'Inventory - Products' },
        { method: 'get', path: '/api/v1/inventory/warehouses', tag: 'Inventory - Warehouses' },
        { method: 'post', path: '/api/v1/inventory/moves/receive', tag: 'Inventory - Movements' },
        { method: 'post', path: '/api/v1/inventory/moves/dispatch', tag: 'Inventory - Movements' },
        { method: 'post', path: '/api/v1/inventory/moves/reverse', tag: 'Inventory - Movements' },
        { method: 'post', path: '/api/v1/inventory/transfers', tag: 'Inventory - Transfers' },
        { method: 'post', path: '/api/v1/inventory/transfers/{id}/receive', tag: 'Inventory - Transfers' },
        { method: 'get', path: '/api/v1/inventory/kardex/{productId}', tag: 'Inventory - Kardex' },
        { method: 'get', path: '/api/v1/inventory/stock-alerts', tag: 'Inventory - Stock Alerts' },
        { method: 'post', path: '/api/v1/inventory/stock-counts', tag: 'Inventory - Stock Counts' },
        { method: 'post', path: '/api/v1/inventory/stock-counts/{id}/apply', tag: 'Inventory - Stock Counts' },
    ];

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api/v1');

        const config = new DocumentBuilder()
            .setTitle('SaaS Contable UniPutumayo - Motor de Inventarios y Kardex CPP (Squad 3)')
            .setDescription('API RESTful de Inventarios Multi-Tenant con PostgreSQL RLS')
            .setVersion('1.0.0')
            .addBearerAuth(
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT emitido por Core',
                },
                'bearer',
            )
            .build();

        document = SwaggerModule.createDocument(app, config);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    it('debe generar una especificación OpenAPI 3.0 válida', () => {
        expect(document).toBeDefined();
        expect(document.openapi).toMatch(/^3\./);
        expect(document.info).toBeDefined();
        expect(document.info.title).toContain('SaaS Contable');
        expect(document.paths).toBeDefined();
    });

    it('debe registrar el esquema de seguridad Bearer JWT', () => {
        expect(document.components).toBeDefined();
        expect(document.components?.securitySchemes).toBeDefined();
        const schemes = document.components?.securitySchemes as Record<string, any>;
        expect(schemes['bearer']).toBeDefined();
        expect(schemes['bearer'].type).toBe('http');
        expect(schemes['bearer'].scheme).toBe('bearer');
    });

    it('debe cubrir el 100% de los 14 endpoints del motor de inventarios sin excepciones', () => {
        for (const expected of EXPECTED_OPERATIONS) {
            const pathItem = document.paths[expected.path];
            expect(pathItem).toBeDefined();

            const operation = (pathItem as Record<string, any>)[expected.method];
            expect(operation).toBeDefined();

            // Verificar tag
            expect(operation.tags).toBeDefined();
            expect(operation.tags).toContain(expected.tag);

            // Verificar summary descriptivo
            expect(operation.summary).toBeDefined();
            expect(typeof operation.summary).toBe('string');
            expect(operation.summary.length).toBeGreaterThan(5);

            // Verificar respuestas mínimas documentadas (éxito + errores estándar)
            expect(operation.responses).toBeDefined();
            const responseKeys = Object.keys(operation.responses);
            const hasSuccess = responseKeys.includes('200') || responseKeys.includes('201');
            expect(hasSuccess).toBe(true);
            expect(responseKeys).toContain('401');
            expect(responseKeys).toContain('403');

            // Verificar seguridad Bearer auth en cada endpoint protegido
            expect(operation.security).toBeDefined();
            expect(Array.isArray(operation.security)).toBe(true);
            expect(operation.security.length).toBeGreaterThan(0);
        }
    });

    it('debe documentar esquemas de componentes para los DTO principales', () => {
        const schemas = document.components?.schemas as Record<string, any>;
        expect(schemas).toBeDefined();

        const expectedSchemas = [
            'CreateProductDto',
            'UpdateProductDto',
            'ReceiveStockDto',
            'DispatchStockDto',
            'ReverseMovementDto',
            'TransferStockDto',
            'CreateStockCountDto',
            'ApplyStockCountDto',
            'ErrorResponseDto',
            'KardexResponseDto',
            'StockAlertsResponseDto',
        ];

        for (const schemaName of expectedSchemas) {
            expect(schemas[schemaName]).toBeDefined();
        }
    });
});
