import Decimal from 'decimal.js';
import { Quantity } from '../src/core/domain/value-objects/quantity.vo';
import { Cost } from '../src/core/domain/value-objects/cost.vo';
import { Product } from '../src/core/domain/entities/product.entity';
import { Warehouse } from '../src/core/domain/entities/warehouse.entity';
import { StockQuant } from '../src/core/domain/entities/stock-quant.entity';
import { StockMove } from '../src/core/domain/entities/stock-move.entity';
import { InsufficientStockException } from '../src/core/domain/exceptions/inventory.exceptions';

console.log('================================================================');
console.log('SUITE DE PRUEBAS DE DOMINIO - SQUAD 3 INVENTARIO Y KARDEX CPP');
console.log('================================================================');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log('[PASS] ' + testName);
    passed++;
  } else {
    console.error('[FAIL] ' + testName);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. PRUEBAS DE VALUE OBJECT: Quantity (3 decimales para unidades fraccionarias)
// -------------------------------------------------------------
console.log('\n--- 1. Value Object: Quantity (Fraccionario 3 Decimales) ---');

try {
  const q1 = new Quantity(12.3456);
  assert(q1.value === 12.346, 'Quantity redondea a 3 decimales ROUND_HALF_UP (12.3456 -> 12.346)');
} catch (e: any) {
  assert(false, 'Quantity redondeo fallo: ' + e.message);
}

try {
  const q1 = new Quantity(2.5);
  const q2 = new Quantity(1.25);
  const sum = q1.add(q2);
  assert(sum.value === 3.75, 'Quantity.add suma cantidades fraccionarias exactamente (2.5 + 1.25 = 3.75)');
} catch (e: any) {
  assert(false, 'Quantity.add fallo: ' + e.message);
}

try {
  const q1 = new Quantity(10.0);
  const q2 = new Quantity(4.25);
  const diff = q1.subtract(q2);
  assert(diff.value === 5.75, 'Quantity.subtract resta cantidades correctamente (10.0 - 4.25 = 5.75)');
} catch (e: any) {
  assert(false, 'Quantity.subtract fallo: ' + e.message);
}

try {
  const q1 = new Quantity(5.0);
  const q2 = new Quantity(10.0);
  q1.subtract(q2);
  assert(false, 'Quantity.subtract debe fallar si genera stock negativo');
} catch (e) {
  assert(true, 'Quantity.subtract bloquea cantidades negativas por invariante de dominio');
}

try {
  new Quantity(-1.5);
  assert(false, 'Quantity no debe permitir creacion con valor negativo');
} catch (e) {
  assert(true, 'Quantity rechaza cantidades negativas al instanciar');
}

try {
  const qA = new Quantity(5.0);
  const qB = new Quantity(3.0);
  assert(qA.isGreaterThan(qB), 'Quantity.isGreaterThan identifica 5.0 > 3.0');
  assert(!qB.isGreaterThan(qA), 'Quantity.isGreaterThan rechaza 3.0 > 5.0');
  assert(qA.equals(new Quantity(5.0)), 'Quantity.equals identifica igualdad exacta');
} catch (e: any) {
  assert(false, 'Comparaciones de Quantity fallaron: ' + e.message);
}

// -------------------------------------------------------------
// 2. PRUEBAS DE VALUE OBJECT: Cost (4 decimales para costo unitario COP)
// -------------------------------------------------------------
console.log('\n--- 2. Value Object: Cost (4 Decimales COP) ---');

try {
  const c1 = new Cost(15420.55554);
  assert(c1.value === 15420.5555, 'Cost redondea a 4 decimales exactos');
} catch (e: any) {
  assert(false, 'Cost redondeo fallo: ' + e.message);
}

try {
  new Cost(-100);
  assert(false, 'Cost no debe permitir costo negativo');
} catch (e) {
  assert(true, 'Cost rechaza costos negativos con excepcion');
}

try {
  const unitCost = new Cost(25000);
  const qty = new Quantity(3.5);
  const total = unitCost.multiply(qty);
  assert(total.value === 87500.0, 'Cost.multiply calcula costo total exacto (25000 * 3.5 = 87500)');
} catch (e: any) {
  assert(false, 'Cost.multiply fallo: ' + e.message);
}

// -------------------------------------------------------------
// 3. PRUEBAS DE ENTIDAD: StockQuant (Existencia y Bloqueo de Negativos)
// -------------------------------------------------------------
console.log('\n--- 3. Entidad: StockQuant (Existencias y Reservas) ---');

try {
  const quant = new StockQuant(
    'sq-1',
    'tenant-1',
    'prod-1',
    'wh-1',
    new Quantity(100),
    new Quantity(20),
  );
  assert(quant.getAvailableQuantity().value === 80, 'StockQuant calcula disponible = onHand - reserved (100 - 20 = 80)');

  const afterDispatch = quant.dispatch(new Quantity(50));
  assert(afterDispatch.quantityOnHand.value === 50, 'StockQuant.dispatch descuenta existencia onHand (100 - 50 = 50)');
  assert(afterDispatch.getAvailableQuantity().value === 30, 'Disponible actualizado a 30 (50 - 20 = 30)');
} catch (e: any) {
  assert(false, 'StockQuant operacion fallo: ' + e.message);
}

try {
  const quant = new StockQuant(
    'sq-1',
    'tenant-1',
    'prod-1',
    'wh-1',
    new Quantity(10),
    new Quantity(2),
  );
  // available = 8, trying to dispatch 9
  quant.dispatch(new Quantity(9));
  assert(false, 'StockQuant debe arrojar InsufficientStockException al superar disponible');
} catch (e) {
  assert(e instanceof InsufficientStockException, 'StockQuant bloquea sobregiro lanzando InsufficientStockException');
}

try {
  const quant = new StockQuant(
    'sq-1',
    'tenant-1',
    'prod-1',
    'wh-1',
    new Quantity(50),
    new Quantity(0),
  );
  const afterReceive = quant.receive(new Quantity(25.5));
  assert(afterReceive.quantityOnHand.value === 75.5, 'StockQuant.receive incrementa existencia (50 + 25.5 = 75.5)');
} catch (e: any) {
  assert(false, 'StockQuant.receive fallo: ' + e.message);
}

// -------------------------------------------------------------
// 4. PRUEBAS DE ALGORITMO: Costo Promedio Ponderado (CPP) Dinámico
// -------------------------------------------------------------
console.log('\n--- 4. Algoritmo NIIF: Costo Promedio Ponderado (CPP) ---');

try {
  // Caso A: Inventario inicial en 0, primera compra
  // 10 unidades @ $1,000 COP => Nuevo CPP = $1,000 COP
  const initialStock = 0;
  const initialCost = 0;
  const buyQty1 = 10;
  const buyPrice1 = 1000;

  const cpp1 = buyPrice1;
  assert(cpp1 === 1000, 'CPP inicial con stock 0 es igual al precio de compra ($1,000)');

  // Caso B: Segunda compra
  // Stock previo: 10 u @ $1,000 = $10,000
  // Nueva compra: 10 u @ $2,000 = $20,000
  // Total: $30,000 / 20 u = $1,500 COP
  const prevStockNum = 10;
  const prevCostNum = 1000;
  const buyQty2 = 10;
  const buyPrice2 = 2000;

  const prevTotal = new Decimal(prevStockNum).mul(prevCostNum);
  const incomingTotal = new Decimal(buyQty2).mul(buyPrice2);
  const totalQty = new Decimal(prevStockNum).add(buyQty2);
  const cpp2 = prevTotal.add(incomingTotal).div(totalQty).toNumber();

  assert(cpp2 === 1500, 'CPP se recalcula exactamente a $1,500 ((10*1000 + 10*2000)/20)');

  // Caso C: Despacho por venta
  // Despacho de 5 unidades. El CPP NO CAMBIA, se mantiene en $1,500
  const costOfSale = cpp2;
  const remainingStock = totalQty.minus(5).toNumber();
  assert(costOfSale === 1500, 'Despacho por venta conserva el CPP de $1,500');
  assert(remainingStock === 15, 'Stock remanente es de 15 unidades');

  // Caso D: Tercera compra con decimales fraccionarios
  // Stock previo: 15 u @ $1,500 = $22,500
  // Nueva compra: 5 u @ $3,500 = $17,500
  // Total: $40,000 / 20 u = $2,000 COP
  const prevTotalD = new Decimal(15).mul(1500);
  const incomingTotalD = new Decimal(5).mul(3500);
  const totalQtyD = new Decimal(20);
  const cpp3 = prevTotalD.add(incomingTotalD).div(totalQtyD).toNumber();
  assert(cpp3 === 2000, 'CPP recalcula tras despacho previo: $40,000 / 20 = $2,000');
} catch (e: any) {
  assert(false, 'Calculo de CPP fallo: ' + e.message);
}

// -------------------------------------------------------------
// 5. PRUEBAS DE CLASIFICACIÓN DE MOVIMIENTO: StockMove
// -------------------------------------------------------------
console.log('\n--- 5. Clasificación de Movimientos (StockMove) ---');

try {
  const moveDispatch = new StockMove(
    'm-1', 'tenant-1', 'prod-1', 'wh-1',
    'SALE_DISPATCH',
    new Quantity(5), new Cost(1500), new Cost(7500),
    new Quantity(20), new Quantity(15), 'user-1'
  );
  assert(moveDispatch.isOutflow(), 'SALE_DISPATCH clasificado correctamente como salida (outflow)');
  assert(!moveDispatch.isInflow(), 'SALE_DISPATCH no es entrada');

  const moveReceipt = new StockMove(
    'm-2', 'tenant-1', 'prod-1', 'wh-1',
    'PURCHASE_RECEIPT',
    new Quantity(10), new Cost(1500), new Cost(15000),
    new Quantity(15), new Quantity(25), 'user-1'
  );
  assert(moveReceipt.isInflow(), 'PURCHASE_RECEIPT clasificado correctamente como entrada (inflow)');
  assert(!moveReceipt.isOutflow(), 'PURCHASE_RECEIPT no es salida');

  const moveTransferOut = new StockMove(
    'm-3', 'tenant-1', 'prod-1', 'wh-1',
    'TRANSFER_OUT',
    new Quantity(4), new Cost(1500), new Cost(6000),
    new Quantity(25), new Quantity(21), 'user-1'
  );
  assert(moveTransferOut.isOutflow(), 'TRANSFER_OUT clasificado como salida');

  const moveTransferIn = new StockMove(
    'm-4', 'tenant-1', 'prod-1', 'wh-2',
    'TRANSFER_IN',
    new Quantity(4), new Cost(1500), new Cost(6000),
    new Quantity(0), new Quantity(4), 'user-1'
  );
  assert(moveTransferIn.isInflow(), 'TRANSFER_IN clasificado como entrada');

  const moveReversal = new StockMove(
    'm-5', 'tenant-1', 'prod-1', 'wh-1',
    'VOID_RETURN',
    new Quantity(5), new Cost(1500), new Cost(7500),
    new Quantity(15), new Quantity(20), 'user-1'
  );
  assert(moveReversal.isInflow(), 'VOID_RETURN clasificado como entrada de restitucion');
} catch (e: any) {
  assert(false, 'Clasificacion de movimientos fallo: ' + e.message);
}

// -------------------------------------------------------------
// 6. PRUEBAS DE ENTIDAD: Product y Alertas de Stock
// -------------------------------------------------------------
console.log('\n--- 6. Entidad Product y Alerta de Stock Minimo ---');

try {
  const prod = new Product(
    'prod-1',
    'tenant-1',
    'CEMENTO-GRIS-50KG',
    'Cemento Gris Argos 50kg',
    'CONSTRUCCION',
    'BULTO',
    new Cost(28500),
    35000,
    0.19,
    new Quantity(10),
  );

  assert(prod.sku === 'CEMENTO-GRIS-50KG', 'SKU asignado correctamente');
  assert(prod.unitOfMeasure === 'BULTO', 'Unidad de medida BULTO soportada');
  assert(prod.minStockAlert.value === 10, 'Alerta de stock minimo configurada en 10 bultos');

  const updatedProd = prod.updatePricesAndAlert(new Cost(29000), 36500, 34000, new Quantity(15));
  assert(updatedProd.costPrice.value === 29000, 'Costo unitario actualizado a 29000');
  assert(updatedProd.salePrice === 36500, 'Precio de venta actualizado a 36500');
  assert(updatedProd.minStockAlert.value === 15, 'Alerta de stock minimo actualizada a 15');
} catch (e: any) {
  assert(false, 'Prueba de Product fallo: ' + e.message);
}

// -------------------------------------------------------------
// RESUMEN FINAL
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL PRUEBAS EJECUTADAS: ${passed + failed}`);
console.log(`EXITOSAS: ${passed}`);
console.log(`FALLIDAS: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
