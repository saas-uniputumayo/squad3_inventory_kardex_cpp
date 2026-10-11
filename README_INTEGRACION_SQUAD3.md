# MANUAL TÉCNICO DE INTEGRACIÓN Y AUDITORÍA DE CONSUMO — SQUAD 3 (INVENTORY ENGINE)

> **Documento Exclusivo para Equipos Integradores y Squads Dependientes**  
> **Ecosistema SaaS Contable UniPutumayo — Módulo de Inventarios, Multi-Bodega, CPP y Kardex Valorizado**  
> **Versión del Contrato:** `1.0.0` | **Estado:** `Audited & Functionally Verified` | **Prefijo API:** `/api/v1`

---

## 1. AUDITORÍA PREVIA Y FUENTES DE VERDAD

Este documento es la **guía técnica canónica de integración** para cualquier squad o servicio externo (Squad 1 Core/Auth, Squad 2 POS & Facturación, Squad 4 Compras, Squad 5 Contabilidad y Reportes) que requiera interactuar con el Motor de Inventarios.

### Principio Rector
**No asuma contratos ni calcule estados por su cuenta.** El motor de inventarios de la Squad 3 es la **única fuente de verdad** del stock físico, existencias disponibles, valuación continua mediante Costo Promedio Ponderado (CPP), transferencias multi-bodega y trazabilidad inmutable en el Libro Mayor de Inventario (Kardex).

### Fuentes de Verdad Verificadas
1. **Esquema de Base de Datos:** `prisma/schema.prisma` (Tablas maestras: `products`, `product_variants`, `warehouses`, `units_of_measure`, `inventory_balances`, `inventory_movements`, `inventory_movement_lines`, `inventory_ledger_entries`, `inventory_transfers`, `inventory_transfer_lines`, `stock_counts`, `stock_count_lines`, `inventory_idempotency_keys`).
2. **Capa Presentation:** Controladores en `src/presentation/controllers/inventory/`, DTOs validados con `class-validator` y `class-transformer` en `src/presentation/dto/`.
3. **Mapeo de Errores y Excepciones:** `src/presentation/filters/inventory-exception.filter.ts`.
4. **Seguridad y Contexto:** `src/presentation/guards/jwt-auth.guard.ts`, `src/presentation/guards/roles.guard.ts`, `src/presentation/interceptors/tenant.interceptor.ts`.
5. **Auditoría E2E y Pruebas Automatizadas:** 35 pruebas E2E aprobadas en `test/e2e/functional-audit.spec.ts` y 241 pruebas unitarias/integración en `npm test`.
6. **Especificación OpenAPI:** `docs/openapi.json` y `swagger.json` generados desde el código fuente real.

---

## 2. INVENTARIO COMPLETO DE ENDPOINTS PÚBLICOS

La API expone exactamente **14 operaciones HTTP** distribuidas en 7 controladores. Todos los endpoints requieren autenticación mediante cabecera `Authorization: Bearer <token>` y están bajo el prefijo global `/api/v1`.

### Resumen de Rutas y Operaciones

| Método | Ruta Efectiva | Controlador | Propósito Principal | Roles Autorizados |
|:---:|:---|:---|---|:---|
| `POST` | `/api/v1/inventory/products` | `ProductsController.create` | Registrar nuevo producto maestro con variante predeterminada | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `PATCH` | `/api/v1/inventory/products/:id` | `ProductsController.update` | Actualizar metadatos, precios, umbral de alerta o activar/desactivar | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `GET` | `/api/v1/inventory/products` | `ProductsController.search` | Búsqueda paginada en catálogo con filtros y resumen de stock opcional | `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER` |
| `GET` | `/api/v1/inventory/products/:id` | `ProductsController.getDetail` | Consulta detallada de producto con desglose de existencias por bodega | `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER` |
| `GET` | `/api/v1/inventory/warehouses` | `WarehousesController.list` | Listar bodegas asignadas al tenant con filtros de estado y sucursal | `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER` |
| `POST` | `/api/v1/inventory/moves/receive` | `InventoryMovementsController.receive` | Entrada de mercancía (compras/recepciones) y recálculo matemático de CPP | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `POST` | `/api/v1/inventory/moves/dispatch` | `InventoryMovementsController.dispatch` | Salida de mercancía (ventas POS/entregas) valorizada al CPP actual | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`, `CASHIER` |
| `POST` | `/api/v1/inventory/moves/reverse` | `InventoryMovementsController.reverse` | Anular/revertir un movimiento previo generando contra-asiento en Kardex | `OWNER`, `ADMIN` |
| `POST` | `/api/v1/inventory/transfers` | `TransfersController.transfer` | Iniciar traslado multi-bodega (directo atómico o en dos fases) | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `POST` | `/api/v1/inventory/transfers/:id/receive`| `TransfersController.receiveTransfer` | Confirmar recepción física en bodega destino de traslado en tránsito | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `POST` | `/api/v1/inventory/stock-counts` | `StockCountsController.create` | Abrir sesión de toma física de inventario para una bodega | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `POST` | `/api/v1/inventory/stock-counts/:id/apply`| `StockCountsController.apply` | Aplicar conteos físicos y asentar ajustes de faltantes/sobrantes | `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER` |
| `GET` | `/api/v1/inventory/kardex/:productId` | `KardexController.getKardex` | Consultar libro mayor oficial del producto con saldos y CPP continuo | `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER` |
| `GET` | `/api/v1/inventory/stock-alerts` | `StockAlertsController.getAlerts` | Consultar existencias por debajo del umbral mínimo de seguridad | `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER` |

---

## 3. CONTRATOS DE INTEGRACIÓN Y FORMATOS DE DATOS

### 3.1. Representación Numérica y Precisión Decimal
> [!IMPORTANT]
> **Nunca envíe números de coma flotante (`float`/`double`) para cantidades o costos.**  
> La API exige **cadenas de texto numéricas (`string`)** para todos los importes monetarios y cantidades. De lo contrario, los errores de redondeo binario de JavaScript provocarán rechazo por validación (`400 Bad Request`).

- **Cantidades (`quantity`, `quantityOnHand`, etc.):** `string` decimal con hasta 6 cifras decimales (ej. `"10.0000"`, `"0.2500"`).
- **Costos Unitarios (`unitCost`, `costPrice`, `averageCost`):** `string` decimal con 6 cifras decimales (ej. `"15000.000000"`).
- **Valores Totales Monetarios (`totalCost`, `inventoryValue`, `salePrice`):** `string` decimal con 4 cifras decimales (ej. `"150000.0000"`).
- **Política de Redondeo:** `Decimal.ROUND_HALF_UP` implementada en el dominio.

### 3.2. Identificadores y Fechas
- **Identificadores UUID:** Cadenas UUID v4 canónicas en minúsculas (ej. `a0000000-0000-4000-8000-000000000101`). Cualquier UUID mal formado es rechazado de inmediato por `ParseUUIDPipe` con código `400`.
- **Fechas y Timestamps:** Formato ISO 8601 UTC en string (ej. `2026-10-11T15:30:00.000Z`).

### 3.3. Enumeraciones Canónicas Expuestas

#### Tipos de Movimiento (`MovementType`)
- `PURCHASE_RECEIPT`: Entrada por compra a proveedor.
- `SALE_DISPATCH`: Salida por venta (POS / Facturación).
- `TRANSFER_OUT`: Salida por traslado entre bodegas.
- `TRANSFER_IN`: Entrada por traslado entre bodegas.
- `ADJUSTMENT_IN`: Ajuste positivo por sobrante de inventario.
- `ADJUSTMENT_OUT`: Ajuste negativo por faltante o merma.
- `CUSTOMER_RETURN`: Devolución de cliente hacia inventario.
- `SUPPLIER_RETURN`: Devolución a proveedor desde inventario.
- `INITIAL_BALANCE`: Asiento de balance inicial de apertura.

#### Estados de Movimiento (`MovementStatus`)
- `DRAFT`: Borrador (no afecta existencias ni Kardex).
- `POSTED`: Asentado en Kardex y afectando balances.
- `REVERSED`: Anulado mediante movimiento compensatorio.

#### Estados de Transferencia (`TransferStatus`)
- `DRAFT`: Borrador preliminar.
- `IN_TRANSIT`: Mercancía descargada de origen y en tránsito físico.
- `COMPLETED`: Mercancía recibida y cargada en destino.
- `CANCELLED`: Cancelada (solo posible si no hubo salida física).

#### Estados de Toma Física (`StockCountStatus`)
- `DRAFT`: Sesión configurada pero no iniciada.
- `IN_PROGRESS`: Conteo en curso en bodega.
- `COMPLETED`: Conteo conciliado y ajustes asentados.
- `CANCELLED`: Sesión anulada sin impacto contable.

#### Tipos de Documento de Referencia (`ReferenceType`)
- `PURCHASE`, `SALE`, `TRANSFER`, `PHYSICAL_COUNT`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `MANUAL_ADJUSTMENT`, `INITIAL_BALANCE`.

---

## 4. DETALLE DE ENDPOINTS: ESPECIFICACIÓN TÉCNICA

### 4.1. Catálogo de Productos

#### `POST /api/v1/inventory/products`
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Precondiciones:** La unidad de medida (`unitOfMeasureId`) debe existir y pertenecer al tenant. El `sku` debe ser único en el tenant.
- **Petición de Ejemplo:**
```json
{
  "sku": "ARR-DIANA-001",
  "name": "Arroz Diana Tradicional 1kg",
  "description": "Bolsa de arroz blanco 1000g",
  "barcode": "7701234567890",
  "productType": "STOCKABLE",
  "structure": "SIMPLE",
  "unitOfMeasureId": "a0000000-0000-4000-8000-000000000201",
  "costPrice": "3800.0000",
  "salePrice": "4500.0000",
  "wholesalePrice": "4200.0000",
  "taxRate": "0.0000",
  "minStockAlert": "20.0000",
  "costMethod": "WEIGHTED_AVERAGE"
}
```
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "id": "c1000000-0000-4000-8000-000000000001",
  "sku": "ARR-DIANA-001",
  "name": "Arroz Diana Tradicional 1kg",
  "unitOfMeasureId": "a0000000-0000-4000-8000-000000000201",
  "costPrice": "3800.0000",
  "salePrice": "4500.0000",
  "isActive": true,
  "defaultVariantId": "c2000000-0000-4000-8000-000000000001",
  "createdAt": "2026-10-11T15:00:00.000Z"
}
```
- **Errores:**
  - `400 Bad Request`: Formato de precio inválido o UOM inexistente.
  - `409 Conflict`: SKU duplicado (`PRODUCT_SKU_ALREADY_EXISTS`).

---

#### `GET /api/v1/inventory/products`
- **Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER`.
- **Query Params:**
  - `search` (opcional): Filtro por texto en SKU o nombre.
  - `sku` (opcional): Filtro exacto por SKU.
  - `barcode` (opcional): Filtro exacto por código de barras.
  - `warehouseId` (opcional): Si se envía, la respuesta incluye el bloque `stock` valorizado para esa bodega.
  - `page` (default: 1), `limit` (default: 20, max: 100).
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000001",
      "sku": "ARR-DIANA-001",
      "barcode": "7701234567890",
      "name": "Arroz Diana Tradicional 1kg",
      "description": "Bolsa de arroz blanco 1000g",
      "categoryId": null,
      "unitOfMeasure": {
        "id": "a0000000-0000-4000-8000-000000000201",
        "code": "kg",
        "name": "Kilogramo"
      },
      "costPrice": "3800.0000",
      "salePrice": "4500.0000",
      "wholesalePrice": "4200.0000",
      "taxRate": "0.0000",
      "minStockAlert": "20.0000",
      "isActive": true,
      "stock": {
        "quantityOnHand": "100.0000",
        "reservedQuantity": "0.0000",
        "availableQuantity": "100.0000",
        "averageCost": "3800.000000",
        "inventoryValue": "380000.0000"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### `GET /api/v1/inventory/products/:id`
- **Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER`.
- **Query Params:** `warehouseId` (opcional).
- **Respuesta Exitosa (`200 OK`):** Retorna la información completa del producto y el balance consolidado o de la bodega especificada.
- **Errores:** `404 Not Found` si el producto no existe o pertenece a otro tenant.

---

### 4.2. Bodegas

#### `GET /api/v1/inventory/warehouses`
- **Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CASHIER`.
- **Query Params:** `onlyActive` (boolean, default: `true`), `branchId` (UUID, opcional).
- **Respuesta Exitosa (`200 OK`):**
```json
[
  {
    "id": "a0000000-0000-4000-8000-000000000011",
    "code": "WAR-A1",
    "name": "Bodega Principal Tenant A",
    "description": "Bodega central de almacenamiento",
    "branchId": "a0000000-0000-4000-8000-000000000001",
    "status": "ACTIVE",
    "isActive": true
  }
]
```

---

### 4.3. Movimientos Operativos de Inventario

#### `POST /api/v1/inventory/moves/receive` (Entrada de Mercancía)
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Cabeceras Opcionales:** `Idempotency-Key: <UUID>` (Recomendado para evitar dobles recepciones por reintentos de red).
- **Efecto Contable y en Base de Datos:**
  1. Adquiere bloqueo pesimista `SELECT ... FOR UPDATE` sobre `inventory_balances`.
  2. Registra el movimiento con estado `POSTED` y tipo `PURCHASE_RECEIPT`.
  3. Inserta asiento en `inventory_ledger_entries` (Kardex).
  4. Recalcula el Costo Promedio Ponderado continuo:
     $$\text{Nuevo CPP} = \frac{(\text{Stock Previo} \times \text{CPP Previo}) + (\text{Cantidad Recibida} \times \text{Costo Unitario})}{\text{Stock Previo} + \text{Cantidad Recibida}}$$
- **Petición de Ejemplo:**
```json
{
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "referenceDocument": "FAC-PROV-9082",
  "referenceType": "PURCHASE",
  "notes": "Compra directa distribuidor mayorista",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "quantity": "50.0000",
      "unitCost": "5000.0000"
    }
  ]
}
```
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "movementId": "e1000000-0000-4000-8000-000000000001",
  "type": "PURCHASE_RECEIPT",
  "status": "POSTED",
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "referenceDocument": "FAC-PROV-9082",
  "totalReceivedCost": "250000.00",
  "createdAt": "2026-10-11T15:10:00.000Z",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "quantity": "50.0000",
      "unitCost": "5000.00",
      "totalCost": "250000.00",
      "previousStock": "100.0000",
      "newStock": "150.0000",
      "previousAverageCost": "4000.00",
      "newAverageCost": "4333.33"
    }
  ]
}
```

---

#### `POST /api/v1/inventory/moves/dispatch` (Salida de Mercancía / Venta POS)
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`, `CASHIER`.
- **Cabeceras Opcionales:** `Idempotency-Key: <UUID>`.
- **Efecto Contable y en Base de Datos:**
  1. Adquiere bloqueo pesimista `SELECT ... FOR UPDATE` sobre `inventory_balances`.
  2. Valida la invariante estricta: $\text{Cantidad a Despachar} \le \text{Cantidad Disponible}$. Si no hay existencias, rechaza con `400 Bad Request` (`INSUFFICIENT_STOCK`).
  3. Descuenta las existencias valorizando la salida al **CPP actual vigente** (no al precio de venta).
  4. Inserta el registro correspondiente en `inventory_ledger_entries`.
- **Petición de Ejemplo:**
```json
{
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "referenceDocument": "TICKET-POS-00124",
  "referenceType": "SALE",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "quantity": "30.0000"
    }
  ]
}
```
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "movementId": "e2000000-0000-4000-8000-000000000001",
  "type": "SALE_DISPATCH",
  "status": "POSTED",
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "referenceDocument": "TICKET-POS-00124",
  "totalDispatchCost": "130000.00",
  "createdAt": "2026-10-11T15:15:00.000Z",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "quantity": "30.0000",
      "unitCost": "4333.333333",
      "totalCost": "130000.00",
      "previousStock": "150.0000",
      "remainingStock": "120.0000"
    }
  ]
}
```

---

#### `POST /api/v1/inventory/moves/reverse` (Reversión Compensatoria)
- **Roles:** `OWNER`, `ADMIN` (Los roles `CASHIER` y `WAREHOUSE_MANAGER` son rechazados con `403 Forbidden`).
- **Comportamiento Arquitectónico:** El motor **nunca ejecuta `DELETE` ni `UPDATE` destructivo** sobre movimientos históricos. En su lugar:
  - Crea un nuevo movimiento compensatorio con tipo inverso y marca `reversesMovementId`.
  - El movimiento original pasa a estado `REVERSED`.
  - Intento de revertir un movimiento ya revertido es rechazado de inmediato (`400 Bad Request`).
- **Petición de Ejemplo:**
```json
{
  "movementId": "e2000000-0000-4000-8000-000000000001",
  "reason": "Anulación de ticket POS por error en método de pago"
}
```
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "reversedMovementId": "e2000000-0000-4000-8000-000000000001",
  "reversalMovementId": "e3000000-0000-4000-8000-000000000001",
  "status": "POSTED",
  "reason": "Anulación de ticket POS por error en método de pago",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "quantityRestored": "30.0000",
      "newStock": "150.0000",
      "newAverageCost": "4333.33"
    }
  ],
  "createdAt": "2026-10-11T15:20:00.000Z"
}
```

---

### 4.4. Transferencias Multi-Bodega

#### `POST /api/v1/inventory/transfers`
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Modalidades Soportadas (`isTwoPhase`):**
  - `isTwoPhase: false` (Transferencia Directa Atómica): Descarga inmediatamente de origen e incrementa en destino en una sola transacción local. Estado resultante: `COMPLETED`.
  - `isTwoPhase: true` (Transferencia en Dos Fases): Descarga de origen y deja la mercancía en estado `IN_TRANSIT`. La bodega destino aún **no ve el incremento de stock** hasta que se ejecute la confirmación de recepción.
- **Petición de Ejemplo (Two-Phase):**
```json
{
  "sourceWarehouseId": "a0000000-0000-4000-8000-000000000011",
  "destinationWarehouseId": "a0000000-0000-4000-8000-000000000012",
  "referenceDocument": "TR-REGIONAL-004",
  "reason": "Reabastecimiento de sucursal norte",
  "isTwoPhase": true,
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "quantity": "20.0000"
    }
  ]
}
```
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "transferId": "f1000000-0000-4000-8000-000000000001",
  "status": "IN_TRANSIT",
  "referenceDocument": "TR-REGIONAL-004",
  "sourceWarehouseId": "a0000000-0000-4000-8000-000000000011",
  "destinationWarehouseId": "a0000000-0000-4000-8000-000000000012",
  "outboundMovementId": "e4000000-0000-4000-8000-000000000001",
  "createdAt": "2026-10-11T15:25:00.000Z",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "quantity": "20.0000",
      "unitCost": "4333.333333",
      "totalCost": "86666.67"
    }
  ]
}
```
- **Errores Específicos:**
  - `409 Conflict`: Si `sourceWarehouseId === destinationWarehouseId` (`La bodega de origen y destino deben ser diferentes`).

---

#### `POST /api/v1/inventory/transfers/:id/receive` (Confirmación de Llegada)
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Precondiciones:** La transferencia debe estar en estado `IN_TRANSIT`.
- **Efecto:** Registra el movimiento `TRANSFER_IN` en destino, acredita las existencias calculando el impacto en el CPP destino y marca la transferencia como `COMPLETED`.
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "transferId": "f1000000-0000-4000-8000-000000000001",
  "status": "COMPLETED",
  "sourceWarehouseId": "a0000000-0000-4000-8000-000000000011",
  "destinationWarehouseId": "a0000000-0000-4000-8000-000000000012",
  "inboundMovementId": "e5000000-0000-4000-8000-000000000001",
  "completedAt": "2026-10-11T15:30:00.000Z"
}
```

---

### 4.5. Tomas Físicas de Inventario (Stock Counts)

#### `POST /api/v1/inventory/stock-counts` (Creación de Auditoría)
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Petición de Ejemplo:**
```json
{
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "notes": "Auditoría mensual física de fin de mes",
  "autoStart": true
}
```
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "id": "70000000-0000-4000-8000-000000000001",
  "warehouseId": "a0000000-0000-4000-8000-000000000011",
  "status": "IN_PROGRESS",
  "linesCount": 6,
  "lines": [
    {
      "id": "71000000-0000-4000-8000-000000000001",
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "systemQuantity": "100.0000"
    }
  ],
  "createdAt": "2026-10-11T15:35:00.000Z",
  "startedAt": "2026-10-11T15:35:00.000Z"
}
```

---

#### `POST /api/v1/inventory/stock-counts/:id/apply` (Aplicación de Ajustes)
- **Roles:** `OWNER`, `ADMIN`, `WAREHOUSE_MANAGER`.
- **Comportamiento:**
  - Si $\text{Conteo} > \text{Sistema}$: Genera movimiento compensatorio `ADJUSTMENT_IN` (Sobrante).
  - Si $\text{Conteo} < \text{Sistema}$: Genera movimiento compensatorio `ADJUSTMENT_OUT` (Faltante).
  - Si $\text{Conteo} == \text{Sistema}$: Marca la línea como `EQUAL` sin generar movimientos innecesarios.
- **Petición de Ejemplo:**
```json
{
  "counts": [
    {
      "lineId": "71000000-0000-4000-8000-000000000001",
      "countedQuantity": "90.0000",
      "notes": "Merma por rotura de empaque"
    }
  ]
}
```
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "stockCountId": "70000000-0000-4000-8000-000000000001",
  "status": "COMPLETED",
  "totalLines": 1,
  "adjustedLines": 1,
  "completedAt": "2026-10-11T15:40:00.000Z",
  "lines": [
    {
      "productId": "c1000000-0000-4000-8000-000000000001",
      "variantId": "c2000000-0000-4000-8000-000000000001",
      "systemQuantity": "100.0000",
      "countedQuantity": "90.0000",
      "differenceQuantity": "-10.0000",
      "adjustmentType": "SHORTAGE",
      "movementId": "e6000000-0000-4000-8000-000000000001"
    }
  ]
}
```

---

### 4.6. Kardex y Alertas de Stock

#### `GET /api/v1/inventory/kardex/:productId`
- **Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`.
- **Query Params:** `warehouseId` (opcional), `variantId` (opcional), `movementType` (opcional), `from` (ISO date), `to` (ISO date), `page` (default 1), `limit` (default 50).
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "product": {
    "id": "c1000000-0000-4000-8000-000000000001",
    "sku": "ARR-DIANA-001",
    "name": "Arroz Diana Tradicional 1kg",
    "unitOfMeasure": "kg"
  },
  "entries": [
    {
      "id": "90000000-0000-4000-8000-000000000001",
      "sequence": "1",
      "date": "2026-10-11T10:00:00.000Z",
      "movementId": "e1000000-0000-4000-8000-000000000001",
      "movementType": "PURCHASE_RECEIPT",
      "referenceType": "PURCHASE",
      "referenceDocument": "DOC-INIT-ARR-001",
      "quantityIn": "100.0000",
      "quantityOut": "0.0000",
      "quantityBalance": "100.0000",
      "unitCost": "4000.00",
      "averageCost": "4000.00",
      "inventoryValue": "400000.00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### `GET /api/v1/inventory/stock-alerts`
- **Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`.
- **Query Params:** `warehouseId` (opcional), `search` (opcional), `page` (default 1), `limit` (default 50).
- **Criterio de Inclusión:** Aquellos productos donde:
  $$\text{currentStock} \le \text{minimumStock}$$
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "data": [
    {
      "productId": "c1000000-0000-4000-8000-000000000004",
      "variantId": "c2000000-0000-4000-8000-000000000004",
      "sku": "CEM-ARG-001",
      "name": "Cemento Gris Argos 50kg",
      "unitOfMeasure": "bulto",
      "warehouseId": "a0000000-0000-4000-8000-000000000011",
      "warehouseName": "Bodega Principal Tenant A",
      "currentStock": "6.0000",
      "reservedStock": "0.0000",
      "availableStock": "6.0000",
      "minimumStock": "10.0000",
      "shortage": "4.0000",
      "salePrice": "34000.00"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

---

## 5. GUÍA ESPECÍFICA: QUÉ DEBE HACER Y QUÉ NO DEBE HACER UNA SQUAD CONSUMIDORA

### ✅ LO QUE DEBE HACER
1. **Delegar toda la valuación:** Envíe exclusivamente la cantidad y el costo de compra en recepciones. El motor de inventarios calculará el CPP, el valor acumulado y la secuencia contable del Kardex.
2. **Utilizar cabeceras de Idempotencia:** Envíe `Idempotency-Key: <UUID>` en todas las operaciones que modifiquen inventario (`POST /moves/receive`, `POST /moves/dispatch`, `POST /transfers`, etc.). Si se produce un corte de red o timeout del cliente, reintente con la **misma clave** sin temor a duplicar el stock.
3. **Manejar respuestas `400 INSUFFICIENT_STOCK`:** Cuando el POS intente despachar y reciba `400`, capture el error para informar al usuario de inmediato que no hay existencias físicas en la bodega seleccionada.
4. **Conservar los identificadores devueltos:** Guarde siempre el `movementId` y `transferId` devueltos en las respuestas para futuras conciliaciones, devoluciones o consultas de trazabilidad.
5. **Respetar la granularidad por Bodega:** Antes de despachar o recibir, consulte las bodegas disponibles con `GET /api/v1/inventory/warehouses` para asegurarse de que el usuario opera en la bodega física correcta.

### ❌ LO QUE NUNCA DEBE HACER
1. **NO modifique directamente tablas de base de datos:** Ninguna squad externa tiene autorización para ejecutar `UPDATE inventory_balances` o `INSERT INTO inventory_movements`. Saltarse la capa de dominio corrompe el CPP continuo, el saldo inmutable y viola las restricciones RLS.
2. **NO duplique la fórmula de cálculo de CPP en frontend o servicios auxiliares:** El CPP continuo involucra redondeos y bloqueos transaccionales pesimistas. Si un consumidor intenta precalcularlo localmente, presentará discrepancias con el Libro Mayor.
3. **NO intente enviar el precio de venta en el despacho:** El despacho descuenta inventario valorizado a **costo de inventario (CPP)**, no al precio cobrado al cliente. La utilidad bruta se determina en la Squad de Facturación comparando el precio de venta con el `totalCost` reportado por la respuesta de despacho.
4. **NO confíe en un `tenantId` enviado en el cuerpo:** La API ignora cualquier `tenantId` en los payloads JSON. El tenant se extrae de manera obligatoria y segura desde los claims del token JWT verificado en el contexto de la base de datos (`set_current_tenant`).
5. **NO asuma transacciones distribuidas (Two-Phase Commit / 2PC):** Si una venta en el POS requiere registrar la factura y descargar inventario, recuerde que son microservicios o módulos desacoplados. Si el despacho de inventario tiene éxito pero la impresión de la factura falla en el frontend, el consumidor debe invocar `POST /api/v1/inventory/moves/reverse` para compensar la salida.

---

## 6. AUTENTICACIÓN, ROLES Y AISLAMIENTO MULTI-TENANT

### 6.1. Contrato de Token JWT
Toda solicitud HTTP debe incluir la cabecera:
```http
Authorization: Bearer <jwt-token>
```

El token debe ser emitido por el servicio de autenticación Core y contener los siguientes claims decodificables:

| Claim | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `sub` | `string` (UUID) | ID del usuario autenticado | `"a0000000-0000-4000-8000-000000000101"` |
| `tenantId` | `string` (UUID) | ID del tenant al que pertenece el usuario | `"a0000000-0000-4000-8000-000000000001"` |
| `role` | `string` (Enum) | Rol RBAC del usuario | `"OWNER"`, `"ADMIN"`, `"CASHIER"`, etc. |
| `jti` | `string` (UUID) | Identificador único de sesión activo en Redis | `"d5f6e7a8-1234-4567-89ab-cdef01234567"` |

### 6.2. Validación en Redis
En cada solicitud entrante, `JwtAuthGuard` comprueba la presencia de la clave:
```redis
session:<userId>:<jti>
```
Si la clave no existe en Redis (sesión expirada o revocada por logout central), la solicitud es rechazada inmediatamente con `401 Unauthorized` (`Sesión revocada o inactiva`).

### 6.3. Aislamiento Multi-Tenant (PostgreSQL RLS)
El `TenantInterceptor` de NestJS inyecta en la conexión transaccional de PostgreSQL la variable de sesión:
```sql
SELECT set_current_tenant('<tenantId>'::uuid);
```
Cualquier intento de consultar o modificar recursos pertenecientes a otro tenant es bloqueado a nivel de motor SQL por las políticas de Row Level Security (RLS), retornando `404 Not Found`.

---

## 7. MATRIZ DE ERRORES Y ESTRATEGIA DE RECUPERACIÓN

La API devuelve errores en un formato estructurado y estandarizado mediante `ErrorResponseDto`:

```json
{
  "statusCode": 400,
  "code": "INSUFFICIENT_STOCK",
  "message": "Stock insuficiente para el producto Arroz Diana. Requerido: 30.0000, Disponible: 10.0000",
  "timestamp": "2026-10-11T15:45:00.000Z",
  "path": "/api/v1/inventory/moves/dispatch"
}
```

### Tabla de Códigos de Error

| HTTP Status | Código de Error (`code`) | Causa Frecuente | ¿Reintentable? | Acción Recomendada para el Consumidor |
|:---:|:---|---|:---:|---|
| `400` | `BAD_REQUEST` | Fallo de validación de campos DTO (ej. UUID mal formado, string vacío) | No | Corregir los datos del payload antes de reenviar. |
| `400` | `INSUFFICIENT_STOCK` | La cantidad a despachar supera las existencias físicas en la bodega | No | Notificar al usuario; consultar disponibilidad con `GET /products/:id`. |
| `400` | `INVALID_QUANTITY` | Cantidad menor o igual a cero, o con exceso de decimales para la UOM | No | Validar que la cantidad sea positiva y compatible con la unidad de medida. |
| `400` | `MOVEMENT_ALREADY_REVERSED`| Se intentó anular un movimiento que ya tenía un contra-asiento | No | Operación redundante; consultar histórico en Kardex. |
| `401` | `UNAUTHORIZED` | Token ausente, firma inválida, sin claim `jti`, o sesión revocada en Redis | Sí (tras re-login) | Redirigir al usuario al flujo de autenticación para renovar el token. |
| `403` | `FORBIDDEN` | El rol del usuario no tiene permisos suficientes para el endpoint | No | Mostrar mensaje de acceso denegado en la interfaz. |
| `404` | `NOT_FOUND` | Producto, bodega o movimiento no encontrado o de otro tenant | No | Verificar los UUIDs enviados; validar contexto de tenant. |
| `409` | `IDEMPOTENCY_CONFLICT` | Operación idéntica en proceso simultáneo o colisión de clave | Sí (con backoff) | Esperar unos segundos y reintentar con la misma clave para obtener el resultado cacheado. |
| `409` | `SAME_WAREHOUSE_TRANSFER`| Intento de trasladar hacia la misma bodega de origen | No | Corregir la bodega de destino seleccionada en el formulario. |
| `422` | `UNPROCESSABLE_ENTITY` | La bodega se encuentra inactiva o archivada | No | Seleccionar una bodega activa mediante `GET /warehouses?onlyActive=true`. |
| `500` | `INTERNAL_SERVER_ERROR` | Error imprevisto en el backend | Sí (con backoff) | Notificar al equipo de backend; reintentar solo si es una operación idempotente. |

---

## 8. MATRIZ DE RESPONSABILIDADES POR SQUAD CONSUMIDORA

| Squad Consumidora | Casos de Uso Típicos | Endpoints a Consumir | Responsabilidad del Consumidor |
|---|---|---|---|
| **Squad 2: POS & Facturación** | - Consulta rápida de existencias<br>- Despacho automático de ventas<br>- Anulación de tickets POS | - `GET /products`<br>- `POST /moves/dispatch`<br>- `POST /moves/reverse` | - Enviar cabecera `Idempotency-Key`<br>- Manejar rechazo por stock insuficiente<br>- Revertir movimiento si la factura no se pudo completar |
| **Squad 4: Módulo de Compras** | - Recepción de pedidos a proveedores<br>- Actualización de costos de catálogo | - `POST /moves/receive`<br>- `PATCH /products/:id` | - Enviar costo unitario exacto pactado con proveedor<br>- Proporcionar número de factura de compra como `referenceDocument` |
| **Squad 5: Contabilidad y Reportes** | - Auditoría de costo de ventas<br>- Valorización fiscal de inventarios<br>- Detección de mermas | - `GET /kardex/:productId`<br>- `GET /stock-alerts`<br>- `POST /stock-counts` | - Interpretar la secuencia cronológica de entradas y salidas<br>- No intentar recalcular el CPP por fuera del motor |
| **Squad 1: Core & Administración** | - Creación inicial del catálogo<br>- Alta de bodegas físicas | - `POST /products`<br>- `GET /warehouses` | - Configurar adecuadamente unidades de medida y umbrales mínimos |

---

## 9. CHECKLIST DE INTEGRACIÓN PARA DESARROLLADORES EXTERNOS

Antes de considerar terminada la integración con la Squad 3, verifique cada uno de los siguientes puntos:

- [ ] **Autenticación Bearer:** El cliente HTTP inyecta el token JWT en la cabecera `Authorization: Bearer <token>`.
- [ ] **Formato de Números:** Todas las cantidades y costos se transmiten como cadenas de texto (`string`), no como números JavaScript.
- [ ] **Validación de UUID:** Los identificadores enviados a rutas o cuerpos son UUIDs v4 válidos.
- [ ] **Cabeceras de Idempotencia:** Se envía `Idempotency-Key: <UUID>` en todas las operaciones que mutan inventario (`receive`, `dispatch`, `transfers`).
- [ ] **Manejo de Respuestas de Conflicto (409):** El cliente captura adecuadamente errores de duplicidad o concurrencia.
- [ ] **Manejo de Stock Insuficiente (400):** La interfaz de usuario muestra alertas claras si un producto no tiene existencias disponibles.
- [ ] **Reversiones en Caso de Falla:** Si la squad consumidora completa un despacho pero falla su persistencia interna posterior, invoca automáticamente `POST /moves/reverse`.
- [ ] **Pruebas en Entorno de Pruebas:** Se ejecutaron pruebas reales de integración contra el servidor local (`http://localhost:3000/api/v1`) con la semilla oficial de datos (`npx prisma db seed`).

---

## 10. TRAZABILIDAD DE LA AUDITORÍA DE LA API

Esta matriz vincula cada endpoint documentado con su implementación real, servicio de aplicación, modelo de base de datos y prueba de aceptación:

| Endpoint | Controlador y Método | Servicio de Aplicación | Tablas de Persistencia | Evidencia en Pruebas E2E | Estado |
|---|---|---|---|---|:---:|
| `POST /products` | `ProductsController.create` | `CreateProductService` | `products`, `product_variants` | `functional-audit.spec.ts:312` | **CONFIRMADO** |
| `GET /products` | `ProductsController.search` | `ListProductsService` | `products`, `product_variants`, `units_of_measure` | `functional-audit.spec.ts:340` | **CONFIRMADO** |
| `GET /products/:id` | `ProductsController.getDetail` | `GetProductDetailService` | `products`, `inventory_balances` | `functional-audit.spec.ts:360` | **CONFIRMADO** |
| `PATCH /products/:id` | `ProductsController.update` | `UpdateProductService` | `products`, `product_variants` | `functional-audit.spec.ts:328` | **CONFIRMADO** |
| `GET /warehouses` | `WarehousesController.list` | `ListWarehousesService` | `warehouses` | `functional-audit.spec.ts:380` | **CONFIRMADO** |
| `POST /moves/receive` | `InventoryMovementsController.receive` | `ReceiveStockService` | `inventory_balances`, `inventory_movements`, `inventory_ledger_entries` | `functional-audit.spec.ts:400` | **CONFIRMADO** |
| `POST /moves/dispatch` | `InventoryMovementsController.dispatch` | `DispatchStockService` | `inventory_balances`, `inventory_movements`, `inventory_ledger_entries` | `functional-audit.spec.ts:445` | **CONFIRMADO** |
| `POST /moves/reverse` | `InventoryMovementsController.reverse` | `ReverseMovementService` | `inventory_balances`, `inventory_movements`, `inventory_ledger_entries` | `functional-audit.spec.ts:478` | **CONFIRMADO** |
| `POST /transfers` | `TransfersController.transfer` | `TransferStockService` | `inventory_transfers`, `inventory_transfer_lines`, `inventory_balances` | `functional-audit.spec.ts:510` | **CONFIRMADO** |
| `POST /transfers/:id/receive`| `TransfersController.receiveTransfer` | `ReceiveTransferService` | `inventory_transfers`, `inventory_balances`, `inventory_movements` | `functional-audit.spec.ts:602` | **CONFIRMADO** |
| `POST /stock-counts` | `StockCountsController.create` | `CreateStockCountService` | `stock_counts`, `stock_count_lines` | `functional-audit.spec.ts:650` | **CONFIRMADO** |
| `POST /stock-counts/:id/apply`| `StockCountsController.apply` | `ApplyStockCountService` | `stock_counts`, `inventory_movements`, `inventory_balances` | `functional-audit.spec.ts:690` | **CONFIRMADO** |
| `GET /kardex/:productId` | `KardexController.getKardex` | `GetKardexService` | `inventory_ledger_entries`, `products` | `functional-audit.spec.ts:740` | **CONFIRMADO** |
| `GET /stock-alerts` | `StockAlertsController.getAlerts` | `GetStockAlertsService` | `inventory_balances`, `product_variants` | `functional-audit.spec.ts:720` | **CONFIRMADO** |

---
*Manual técnico elaborado y certificado para la integración de la Squad 3 — ERP SaaS Contable UniPutumayo.*
