import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as http from 'http';
import { randomUUID } from 'crypto';

const BASE_URL = 'http://127.0.0.1:3003';
const TENANT_ID = '20000000-0000-0000-0000-000000000002';
const BRANCH_ID = '20100000-0000-0000-0000-000000000001';
const USER_ID = '20200000-0000-0000-0000-000000000001';

function request(
  method: string,
  path: string,
  body: any = null,
  headers: any = {},
): Promise<{ status: number; data?: any; raw?: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': TENANT_ID,
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('============================================================');
  console.log('SUITE AUTOMATIZADA DE PRUEBAS E2E (SQUAD 3 INVENTARIOS Y KARDEX)');
  console.log(`Iniciando servidor NestJS en ${BASE_URL}...`);
  console.log('============================================================\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(3003);
  console.log('Servidor NestJS iniciado en puerto 3003. Ejecutando pruebas E2E...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, details: string = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // 1. Healthcheck
    const resHealth = await request('GET', '/health');
    assert(
      resHealth.status === 200 && resHealth.data?.service === 'squad3_inventory_kardex_cpp',
      '1. GET /health responde 200 y servicio correcto',
      JSON.stringify(resHealth.data),
    );

    // 2. Crear Bodega Principal
    const whPrincipalCode = `BOD-PRIN-${Date.now().toString().slice(-4)}`;
    const resWh1 = await request('POST', '/api/v1/inventory/warehouses', {
      branchId: BRANCH_ID,
      code: whPrincipalCode,
      name: `Bodega Principal Central ${whPrincipalCode}`,
      address: 'Calle 10 # 5-20, Mocoa, Putumayo',
    });
    assert(
      resWh1.status === 201 && resWh1.data?.data?.id,
      '2. POST /api/v1/inventory/warehouses crea Bodega Principal',
      JSON.stringify(resWh1.data),
    );
    const wh1Id = resWh1.data?.data?.id;

    // 3. Crear Bodega Secundaria (Punto de Venta / Exhibición)
    const whSecCode = `BOD-EXH-${Date.now().toString().slice(-4)}`;
    const resWh2 = await request('POST', '/api/v1/inventory/warehouses', {
      branchId: BRANCH_ID,
      code: whSecCode,
      name: `Bodega Exhibición POS ${whSecCode}`,
      address: 'Carrera 6 # 8-15, Mocoa, Putumayo',
    });
    assert(
      resWh2.status === 201 && resWh2.data?.data?.id,
      '3. POST /api/v1/inventory/warehouses crea Bodega Exhibición',
      JSON.stringify(resWh2.data),
    );
    const wh2Id = resWh2.data?.data?.id;

    // 4. Listar Bodegas
    const resWhList = await request('GET', `/api/v1/inventory/warehouses?branchId=${BRANCH_ID}`);
    assert(
      resWhList.status === 200 && Array.isArray(resWhList.data?.data) && resWhList.data.data.length >= 2,
      '4. GET /api/v1/inventory/warehouses lista bodegas asociadas a la sucursal',
    );

    // 5. Crear Producto con SKU único
    const testSku = `PROD-TEST-${Date.now().toString().slice(-5)}`;
    const resProd = await request('POST', '/api/v1/inventory/products', {
      sku: testSku,
      name: 'Varilla Corrugada 1/2 pulgada x 6m',
      category: 'FERRETERIA_PESADA',
      unitOfMeasure: 'UNIDAD',
      costPrice: 0,
      salePrice: 38000,
      taxRate: 0.19,
      minStockAlert: 15,
      description: 'Acero estructural grado 60 norma NSR-10',
    });
    assert(
      resProd.status === 201 && resProd.data?.data?.id,
      '5. POST /api/v1/inventory/products registra producto con SKU único',
      JSON.stringify(resProd.data),
    );
    const prodId = resProd.data?.data?.id;

    // 6. Consultar catálogo con existencia inicial en 0
    const resProdList = await request('GET', `/api/v1/inventory/products?search=${testSku}`);
    assert(
      resProdList.status === 200 &&
        resProdList.data?.data?.[0]?.sku === testSku &&
        resProdList.data.data[0].totalAvailable === 0,
      '6. GET /api/v1/inventory/products retorna producto con existencia inicial en 0.000',
    );

    // 7. Primer Ingreso por Compra: 50 unidades @ $20,000 COP
    const resRec1 = await request('POST', '/api/v1/inventory/moves/receive', {
      productId: prodId,
      warehouseId: wh1Id,
      quantity: 50.0,
      unitCost: 20000.0,
      referenceDocument: 'FAC_COMPRA_PROV_001',
    });
    assert(
      resRec1.status === 201 &&
        resRec1.data?.data?.newStock === 50 &&
        resRec1.data?.data?.newWeightedAverageCost === 20000,
      '7. POST /moves/receive registra compra inicial e inicializa CPP en $20,000 COP',
      JSON.stringify(resRec1.data),
    );

    // 8. Segundo Ingreso por Compra: 50 unidades @ $30,000 COP (Prueba del CPP ponderado)
    // Formula: (50*20000 + 50*30000) / 100 = 2,500,000 / 100 = 25000 CPP
    const resRec2 = await request('POST', '/api/v1/inventory/moves/receive', {
      productId: prodId,
      warehouseId: wh1Id,
      quantity: 50.0,
      unitCost: 30000.0,
      referenceDocument: 'FAC_COMPRA_PROV_002',
    });
    assert(
      resRec2.status === 201 &&
        resRec2.data?.data?.newStock === 100 &&
        resRec2.data?.data?.newWeightedAverageCost === 25000,
      '8. POST /moves/receive recalcula dinámicamente CPP NIIF a exactamente $25,000 COP',
      JSON.stringify(resRec2.data),
    );

    // 9. Despacho por Venta POS: 20 unidades
    // Debe usar el CPP actual ($25,000) y dejar nuevo stock en 80
    const resDisp = await request('POST', '/api/v1/inventory/moves/dispatch', {
      productId: prodId,
      warehouseId: wh1Id,
      quantity: 20.0,
      referenceDocument: 'TICKET_POS_0001',
    });
    assert(
      resDisp.status === 200 &&
        resDisp.data?.data?.quantity === 20 &&
        resDisp.data?.data?.unitCost === 25000 &&
        resDisp.data?.data?.totalCost === 500000 &&
        resDisp.data?.data?.newStock === 80,
      '9. POST /moves/dispatch descuenta 20 u a CPP de $25,000 dejando saldo en 80 u',
      JSON.stringify(resDisp.data),
    );
    const dispatchMoveId = resDisp.data?.data?.moveId;

    // 10. Intento de Despacho con Sobregiro (Zero Negative Stock Invariant)
    // Actualmente hay 80 u disponibles. Intentamos despachar 100 u. Debe abortar!
    const resOverdraft = await request('POST', '/api/v1/inventory/moves/dispatch', {
      productId: prodId,
      warehouseId: wh1Id,
      quantity: 100.0,
      referenceDocument: 'INTENTO_SOBREGIRO',
    });
    assert(
      resOverdraft.status !== 200,
      '10. POST /moves/dispatch bloquea atomicamente despacho superior al stock disponible (Cero Stock Negativo)',
      `Status HTTP recibido: ${resOverdraft.status}`,
    );

    // 11. Traslado Inter-Bodegas: 30 unidades de Bodega 1 a Bodega 2
    const resTransfer = await request('POST', '/api/v1/inventory/transfers', {
      productId: prodId,
      sourceWarehouseId: wh1Id,
      targetWarehouseId: wh2Id,
      quantity: 30.0,
      referenceDocument: 'GUIA_TRASLADO_001',
    });
    assert(
      resTransfer.status === 201 &&
        resTransfer.data?.data?.transferOutMoveId &&
        resTransfer.data?.data?.transferInMoveId &&
        resTransfer.data?.data?.quantity === 30,
      '11. POST /transfers ejecuta traslado atómico inter-bodegas (30 unidades)',
      JSON.stringify(resTransfer.data),
    );

    // 12. Reversión de Movimiento (VOID_RETURN)
    // Reversamos el despacho de la venta POS de 20 u -> Restaura 20 u en Bodega 1
    const resReversal = await request('POST', '/api/v1/inventory/moves/reverse', {
      originalMoveId: dispatchMoveId,
      reason: 'Cliente canceló la compra POS antes de entrega',
    });
    assert(
      resReversal.status === 200 &&
        resReversal.data?.data?.reversalMoveId &&
        resReversal.data?.data?.quantity === 20,
      '12. POST /moves/reverse restituye stock mediante contra-movimiento VOID_RETURN',
      JSON.stringify(resReversal.data),
    );

    // 13. Consulta de Kardex Valorizado NIIF
    const resKardex = await request('GET', `/api/v1/inventory/kardex/${prodId}`);
    assert(
      resKardex.status === 200 &&
        resKardex.data?.data?.sku === testSku &&
        Array.isArray(resKardex.data?.data?.movements) &&
        resKardex.data.data.movements.length >= 5,
      '13. GET /kardex/:productId genera historial inmutable cronológico con saldos',
      `Movimientos registrados: ${resKardex.data?.data?.movements?.length}`,
    );

    // 14. Alertas de Stock Mínimo
    const resAlerts = await request('GET', '/api/v1/inventory/stock-alerts');
    assert(
      resAlerts.status === 200 && Array.isArray(resAlerts.data?.data),
      '14. GET /stock-alerts retorna lista de productos en umbral de alerta',
    );
  } catch (err: any) {
    console.error('Error durante la ejecución E2E:', err);
    failed++;
  } finally {
    await app.close();
    console.log('\nServidor NestJS detenido.');
  }

  console.log('\n============================================================');
  console.log(`TOTAL PRUEBAS E2E EJECUTADAS: ${passed + failed}`);
  console.log(`EXITOSAS: ${passed}`);
  console.log(`FALLIDAS: ${failed}`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Fallo fatal en runner E2E:', e);
  process.exit(1);
});
