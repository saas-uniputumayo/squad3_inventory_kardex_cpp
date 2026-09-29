# SaaS Contable Uniputumayo — Squad 3: Inventory Engine

> **Motor de Inventarios, Multi-Bodega, Costo Promedio Ponderado (CPP), Conteos Físicos y Kardex Valorizado**  
> Backend core de alta precisión contable, concurrencia segura e integración para puntos de venta (POS) y administración web.

---

## 1. Visión General del Sistema

El **Squad 3 — Inventory Engine** es el componente backend central responsable de la integridad física, matemática y contable de los inventarios dentro del ecosistema SaaS Contable Uniputumayo. Proporciona una API REST de alto rendimiento que sirve como **única fuente de verdad** para:

1. **Gestión Multi-Bodega**: Administración de existencias aisladas por sucursal y bodega física.
2. **Cálculo de Costo Promedio Ponderado (CPP)**: Valuación contable continua con precisión de 6 decimales.
3. **Kardex Valorizado Inmutable**: Libro mayor cronológico de movimientos de inventario (`InventoryLedgerEntry`) con secuencia auditable.
4. **Operaciones Transaccionales Concurrenciales**: Recepciones, despachos de venta POS, transferencias y reversiones protegidas mediante bloqueos pesimistas (`SELECT FOR UPDATE`).
5. **Idempotencia Distribuida**: Prevención de duplicación de transacciones ante reintentos de red mediante cabeceras `X-Idempotency-Key`.
6. **Aislamiento Multi-Tenant**: Seguridad a nivel de base de datos mediante PostgreSQL Row Level Security (RLS).

---

## 2. Distribución de Responsabilidades entre Squads

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONSUMIDORES (FRONTEND & APIS)                 │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │         SQUAD 4           │         │         SQUAD 5           │   │
│   │   Web Desktop Admin &     │         │   Mobile POS (Offline /   │   │
│   │      High-Speed POS       │         │        Online Sync)       │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
│                 │                                     │                 │
│   ┌─────────────┴─────────────┐         ┌─────────────┴─────────────┐   │
│   │         SQUAD 7           │         │         SQUAD 6           │   │
│   │    Módulo de Compras      │         │   Reportes & Contabilidad │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
└─────────────────┼─────────────────────────────────────┼─────────────────┘
                  │                                     │
                  │ REST API (/api/v1/inventory/*)      │
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SQUAD 3 — INVENTORY ENGINE (CORE)                   │
│                                                                         │
│  • Modelo de Dominio e Invariantes DDD    • Valuación CPP (6 decimales) │
│  • Kardex Cronológico Inmutable           • Bloqueo Pesimista (Locks)   │
│  • Idempotencia (Redis / PostgreSQL)      • Multi-Bodega & Traslados    │
│  • Conteos Físicos & Ajustes              • Alertas de Stock Mínimo     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL 16 (PRISMA ORM & RLS)                     │
│               Aislamiento estricto por tenant (Multi-Tenancy)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Matriz de Responsabilidades

| Funcionalidad / Responsabilidad | Squad 3 (Backend) | Squad 4 (Web POS) | Squad 5 (Mobile) | Squad 7 (Compras) |
| :--- | :---: | :---: | :---: | :---: |
| **Cálculo de Existencias y Stock Disponible** | **Fuente de Verdad** | Solo lectura / Vista | Solo lectura / Sync | Solo lectura |
| **Cálculo de Costo Promedio Ponderado (CPP)** | **Fuente de Verdad** | No calcula | No calcula | Envía costo compra |
| **Generación del Kardex Valorizado** | **Fuente de Verdad** | Solo consulta | N/A | N/A |
| **Ejecución Transaccional de Salidas/Despachos** | **Ejecuta & Bloquea** | Solicita despacho | Solicita despacho | N/A |
| **Ejecución Transaccional de Recepciones** | **Ejecuta & Recalcula** | N/A | N/A | Solicita recepción |
| **Transferencias entre Bodegas** | **Garantiza Atomicidad**| Solicita traslado | N/A | N/A |
| **Reversión de Movimientos** | **Crea contra-asiento** | Solicita reversión| N/A | N/A |
| **Interfaz Gráfica y Formularios** | N/A | **Responsable** | **Responsable** | **Responsable** |

---

## 3. Arquitectura del Software (Hexagonal + DDD)

El proyecto sigue rigurosamente los principios de **Arquitectura Hexagonal (Ports & Adapters)** y **Domain-Driven Design (DDD)**:

```text
src/
├── domain/                         # Capa de Dominio (Cero dependencias externas / frameworks)
│   ├── entities/                   # Agregados y Entidades del Dominio
│   │   ├── product/                # Product & ProductVariant
│   │   ├── warehouse/              # Warehouse (Multi-bodega)
│   │   ├── inventory-balance/      # InventoryBalance (Stock, CPP, Valuación)
│   │   ├── inventory-movement/     # InventoryMovement & InventoryMovementLine
│   │   ├── inventory-transfer/     # InventoryTransfer & InventoryTransferLine
│   │   ├── inventory-ledger-entry/ # InventoryLedgerEntry (Kardex)
│   │   ├── stock-count/            # StockCount & StockCountLine (Conteos Físicos)
│   │   └── unit-of-measure/        # UnitOfMeasure
│   ├── value-objects/              # Objetos de Valor Inmutables
│   │   ├── quantity.vo.ts          # Cantidades con control de decimales por UOM
│   │   ├── unit-cost.vo.ts         # Costos unitarios (6 decimales)
│   │   ├── money.vo.ts             # Valores monetarios (4 decimales en COP)
│   │   ├── sku.vo.ts               # Formato y validación de SKU
│   │   ├── warehouse-code.vo.ts    # Código de bodega
│   │   ├── movement-reference.vo.ts# Referencias documentales de movimientos
│   │   └── transfer-reference.vo.ts# Referencias de traslados
│   ├── policy/                     # Políticas del Negocio
│   │   └── precision.policy.ts     # Precisión numérica canónica y tolerancias
│   ├── types/                      # Enums y tipos canónicos del Dominio
│   │   └── index.ts
│   └── exceptions/                 # Excepciones semánticas del Dominio
│       └── index.ts
├── application/                    # Capa de Aplicación (Casos de uso, DTOs, Puertos)
├── infrastructure/                 # Capa de Infraestructura (Prisma, PostgreSQL, Redis, HTTP)
└── test/                           # Pruebas Unitarias, de Integración y E2E
```

### Reglas Inquebrantables de la Arquitectura

1. **Aislamiento del Dominio**: `src/domain/` no importa NestJS, Prisma, TypeORM ni ningún framework de base de datos o HTTP. Solo utiliza `decimal.js` para matemáticas exactas.
2. **Inmutabilidad de Movimientos Publicados**: Una vez que un `InventoryMovement` pasa a estado `POSTED`, sus líneas, cantidades y costos no pueden ser modificados ni eliminados físicamente (`DELETE` prohibido). Toda corrección se realiza mediante `REVERSAL`.
3. **Persistencia Transaccional Aislada**: Las mutaciones de inventario siempre ocurren dentro de una transacción interactiva con bloqueo pesimista sobre `InventoryBalance`.

---

## 4. Modelo Matemático y Política de Precisión Contable

Para evitar errores de redondeo acumulativo y discrepancias contables en pesos colombianos ($COP$), el sistema implementa la política canónica `InventoryPrecisionPolicy`.

### 4.1 Especificación de Decimales

| Dimensión | Decimales | Objeto de Valor | Justificación |
| :--- | :---: | :--- | :--- |
| **Costo Unitario / CPP** | **6 decimales** | `UnitCostVO` | Evita la pérdida de fracciones en compras por volumen fraccionado. |
| **Valuación de Inventario ($COP$)** | **4 decimales** | `MoneyVO` | Precisión contable extendida antes del redondeo final de balances. |
| **Precios Comerciales (Venta/Mayorista)**| **2 decimales** | `MoneyVO` | Formato comercial estándar para facturación y POS. |
| **Cantidades Físicas** | **0 a 4 dec.** | `QuantityVO` | Controlado por la Unidad de Medida (`UnitOfMeasure`). |

### 4.2 Reglas de Redondeo y Tolerancia

* **Modo de redondeo canónico**: `Decimal.ROUND_HALF_UP` (redondeo estándar financiero hacia el vecino más cercano).
* **Tolerancia de Valuación Derivada**:
  $$\text{Tolerancia} = (\text{Cantidad} \times 0.5 \times 10^{-6}) + 10^{-4}$$
  Esta fórmula deriva la tolerancia matemáticamente a partir del límite superior de redondeo del CPP ($0.5 \times 10^{-6}$) y el último decimal de la valuación monetaria ($10^{-4}$), garantizando que no se filtren estados inconsistentes mientras se aceptan redondeos legítimos.

### 4.3 Fórmula del Costo Promedio Ponderado (CPP)

Ante una recepción de mercancía (`RECEIVE` / `PURCHASE`), el nuevo costo promedio ponderado se calcula de forma continua:

$$CPP_{\text{nuevo}} = \text{round}\left(\frac{\text{ValorInventario}_{\text{previo}} + (\text{Cantidad}_{\text{recibida}} \times \text{CostoUnitario}_{\text{entrada}})}{\text{Cantidad}_{\text{previa}} + \text{Cantidad}_{\text{recibida}}}, 6\right)$$

#### Invariantes Contables del CPP:
1. **Primera Recepción** ($Q_{\text{prev}} = 0$): El nuevo CPP es exactamente igual al costo de compra recibido.
2. **Salidas / Despachos** (`DISPATCH` / `POS_SALE`): Descuentan inventario valorizado al CPP vigente en ese instante. **Una salida nunca modifica el CPP unitario**.
3. **Agotamiento de Stock** ($Q_{\text{actual}} = 0$): La valuación total del inventario pasa a ser `$0.0000 COP`. El último CPP histórico se conserva como referencia comercial.
4. **Stock Negativo Prohibido**: Ninguna operación puede dejar $Q < 0$. Si $\text{requested} > \text{available}$, la transacción es abortada inmediatamente con error `INSUFFICIENT_STOCK`.

---

## 5. Concurrencia, Bloqueos e Idempotencia

### 5.1 Prevención de Condiciones de Carrera (Pessimistic Locking)

Cuando dos transacciones del POS intentan vender el mismo producto simultáneamente:

```text
Cliente 1: Solicita 10 unidades (Stock actual = 15)
Cliente 2: Solicita 10 unidades (Stock actual = 15)

Transacción 1: BEGIN -> SELECT * FROM inventory_balances WHERE id = '...' FOR UPDATE;
Transacción 2: BEGIN -> SELECT * FROM inventory_balances WHERE id = '...' FOR UPDATE; (En espera de Lock)

Transacción 1: Lee 15 -> Valida -> Descuenta 10 -> Stock queda en 5 -> COMMIT (Libera Lock)
Transacción 2: Obtiene Lock -> Lee 5 -> Valida contra 10 -> FALLA con INSUFFICIENT_STOCK -> ROLLBACK
```

### 5.2 Prevención de Deadlocks en Operaciones Multi-Línea y Traslados

Para evitar bloqueos mutuos (*deadlocks*) entre transacciones concurrentes con múltiples productos o entre bodegas opuestas:
* Todos los registros de `InventoryBalance` a bloquear en una transacción son **ordenados determinísticamente** por `(warehouseId, productId, variantId)` de forma ascendente antes de emitir los `SELECT ... FOR UPDATE`.

### 5.3 Idempotencia con `X-Idempotency-Key`

Para proteger el sistema contra reintentos por pérdidas de conexión de red en el POS:
1. El cliente envía un UUID único en el encabezado HTTP `X-Idempotency-Key`.
2. El backend verifica en caché/base de datos atómica si la clave ya fue procesada.
3. Si ya existe, retorna el resultado original almacenado sin ejecutar un nuevo movimiento ni duplicar descuentos.

---

## 6. Historias de Usuario y Catálogo de Endpoints

### 6.1 Resumen de Endpoints Principales

| Método | Endpoint | Historia | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/inventory/products` | **HU-01** | Búsqueda y consulta de productos con stock y CPP para POS y Admin. |
| `POST` | `/api/v1/inventory/products` | **HU-02** | Creación de productos en el catálogo del tenant. |
| `PATCH` | `/api/v1/inventory/products/:id` | **HU-03** | Actualización de atributos comerciales (precios, alertas). |
| `GET` | `/api/v1/inventory/warehouses` | **HU-04** | Consulta de bodegas disponibles y operativas. |
| `POST` | `/api/v1/inventory/moves/dispatch` | **HU-05** | Despacho de inventario por venta POS (bloqueo pesimista). |
| `POST` | `/api/v1/inventory/moves/receive` | **HU-06** | Recepción de mercancía por compras y recálculo de CPP. |
| `POST` | `/api/v1/inventory/moves/reverse` | **HU-07** | Reversión auditada de movimientos mediante contra-asiento. |
| `POST` | `/api/v1/inventory/transfers` | **HU-08** | Traslado atómico o en tránsito entre dos bodegas autorizadas. |
| `GET` | `/api/v1/inventory/kardex/:productId` | **HU-09** | Consulta del Kardex valorizado cronológico e inmutable. |
| `GET` | `/api/v1/inventory/stock-alerts` | **HU-10** | Consulta de productos por debajo del umbral mínimo de stock. |

---

### 6.2 Especificación Detallada de Historias y Contratos de API

#### HU-01 — Consultar productos disponibles para POS
* **Endpoint**: `GET /api/v1/inventory/products`
* **Query Params**: `search`, `sku`, `barcode`, `category`, `warehouseId`, `isActive`, `page`, `limit`.
* **Respuesta Exitosa (`200 OK`)**:
```json
{
  "data": [
    {
      "id": "31000000-0000-0000-0000-000000000001",
      "sku": "CEM-001",
      "barcode": "7701234567890",
      "name": "Cemento Gris Argos 50kg",
      "category": "CONSTRUCCION",
      "unitOfMeasure": "BULTO",
      "averageCost": "24500.000000",
      "salePrice": "32000.00",
      "wholesalePrice": "30000.00",
      "taxRate": "0.19",
      "minStockAlert": "5.000",
      "isActive": true,
      "stock": {
        "quantityOnHand": "145.000",
        "reservedQuantity": "0.000",
        "availableQuantity": "145.000",
        "inventoryValue": "3552500.0000"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

---

#### HU-02 — Crear producto en el catálogo
* **Endpoint**: `POST /api/v1/inventory/products`
* **Request Body**:
```json
{
  "sku": "CAB-008",
  "name": "Cable Cobre THHN #12",
  "barcode": "7701234567891",
  "category": "ELECTRICOS",
  "unitOfMeasure": "METRO",
  "costPrice": "3100.00",
  "salePrice": "4200.00",
  "wholesalePrice": "3900.00",
  "taxRate": "0.19",
  "minStockAlert": "20.000"
}
```
* **Respuesta Exitosa (`201 Created`)**:
```json
{
  "id": "31000000-0000-0000-0000-000000000002",
  "sku": "CAB-008",
  "name": "Cable Cobre THHN #12",
  "unitOfMeasure": "METRO",
  "salePrice": "4200.00",
  "isActive": true,
  "createdAt": "2026-09-29T10:00:00.000Z"
}
```

---

#### HU-03 — Actualizar información comercial de producto
* **Endpoint**: `PATCH /api/v1/inventory/products/:id`
* **Request Body**:
```json
{
  "name": "Cable Cobre THHN #12 Centelsa",
  "salePrice": "4500.00",
  "wholesalePrice": "4200.00",
  "costPrice": "3200.00",
  "minStockAlert": "25.000"
}
```
* **Respuesta Exitosa (`200 OK`)**: Retorna el producto con sus campos comerciales actualizados sin alterar el CPP histórico ni los registros del Kardex.

---

#### HU-04 — Consultar bodegas disponibles
* **Endpoint**: `GET /api/v1/inventory/warehouses`
* **Respuesta Exitosa (`200 OK`)**:
```json
{
  "data": [
    {
      "id": "21000000-0000-0000-0000-000000000001",
      "code": "BOD-01",
      "name": "Bodega Principal Centro",
      "branchId": "11000000-0000-0000-0000-000000000001",
      "isActive": true
    }
  ]
}
```

---

#### HU-05 — Despachar inventario por venta POS
* **Endpoint**: `POST /api/v1/inventory/moves/dispatch`
* **Headers**: `X-Idempotency-Key: <uuid>`
* **Request Body**:
```json
{
  "warehouseId": "21000000-0000-0000-0000-000000000001",
  "referenceType": "POS_SALE",
  "referenceId": "51000000-0000-0000-0000-000000000001",
  "referenceDocument": "POS-000412",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "25.000"
    }
  ]
}
```
* **Respuesta Exitosa (`201 Created`)**:
```json
{
  "movementId": "61000000-0000-0000-0000-000000000001",
  "type": "DISPATCH",
  "status": "POSTED",
  "referenceDocument": "POS-000412",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "25.000",
      "unitCost": "24500.000000",
      "totalCost": "612500.0000",
      "previousStock": "170.000",
      "remainingStock": "145.000"
    }
  ],
  "createdAt": "2026-09-29T10:35:00.000Z"
}
```

---

#### HU-06 — Recibir mercancía de una compra
* **Endpoint**: `POST /api/v1/inventory/moves/receive`
* **Headers**: `X-Idempotency-Key: <uuid>`
* **Request Body**:
```json
{
  "warehouseId": "21000000-0000-0000-0000-000000000001",
  "referenceType": "PURCHASE",
  "referenceId": "51000000-0000-0000-0000-000000000002",
  "referenceDocument": "FAC-9821",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "100.000",
      "unitCost": "24000.000000"
    }
  ]
}
```
* **Respuesta Exitosa (`201 Created`)**:
```json
{
  "movementId": "61000000-0000-0000-0000-000000000002",
  "type": "RECEIVE",
  "status": "POSTED",
  "referenceDocument": "FAC-9821",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "100.000",
      "unitCost": "24000.000000",
      "totalCost": "2400000.0000",
      "previousStock": "70.000",
      "newStock": "170.000",
      "previousAverageCost": "25214.285714",
      "newAverageCost": "24500.000000"
    }
  ]
}
```

---

#### HU-07 — Reversar un movimiento de inventario
* **Endpoint**: `POST /api/v1/inventory/moves/reverse`
* **Headers**: `X-Idempotency-Key: <uuid>`
* **Request Body**:
```json
{
  "movementId": "61000000-0000-0000-0000-000000000001",
  "referenceType": "POS_VOID",
  "referenceId": "51000000-0000-0000-0000-000000000003",
  "referenceDocument": "POS-000412-REV",
  "reason": "Anulación de venta por error de digitación"
}
```
* **Respuesta Exitosa (`201 Created`)**:
```json
{
  "reversalMovementId": "61000000-0000-0000-0000-000000000003",
  "reversedMovementId": "61000000-0000-0000-0000-000000000001",
  "status": "POSTED",
  "reason": "Anulación de venta por error de digitación",
  "createdAt": "2026-09-29T10:50:00.000Z"
}
```

---

#### HU-08 — Trasladar mercancía entre bodegas
* **Endpoint**: `POST /api/v1/inventory/transfers`
* **Headers**: `X-Idempotency-Key: <uuid>`
* **Request Body**:
```json
{
  "sourceWarehouseId": "21000000-0000-0000-0000-000000000001",
  "destinationWarehouseId": "21000000-0000-0000-0000-000000000002",
  "referenceDocument": "REM-000145",
  "reason": "Reabastecimiento de sucursal norte",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "30.000"
    }
  ]
}
```
* **Respuesta Exitosa (`201 Created`)**:
```json
{
  "transferId": "71000000-0000-0000-0000-000000000001",
  "status": "COMPLETED",
  "referenceDocument": "REM-000145",
  "sourceWarehouseId": "21000000-0000-0000-0000-000000000001",
  "destinationWarehouseId": "21000000-0000-0000-0000-000000000002",
  "items": [
    {
      "productId": "31000000-0000-0000-0000-000000000001",
      "quantity": "30.000",
      "unitCost": "24500.000000"
    }
  ],
  "createdAt": "2026-09-29T11:00:00.000Z"
}
```

---

#### HU-09 — Consultar Kardex valorizado
* **Endpoint**: `GET /api/v1/inventory/kardex/:productId`
* **Query Params**: `warehouseId`, `from`, `to`, `moveType`, `page`, `limit`.
* **Respuesta Exitosa (`200 OK`)**:
```json
{
  "product": {
    "id": "31000000-0000-0000-0000-000000000001",
    "sku": "CEM-001",
    "name": "Cemento Gris Argos 50kg",
    "unitOfMeasure": "BULTO"
  },
  "warehouse": {
    "id": "21000000-0000-0000-0000-000000000001",
    "name": "Bodega Principal Centro"
  },
  "entries": [
    {
      "id": "81000000-0000-0000-0000-000000000001",
      "date": "2026-09-24T10:30:00.000Z",
      "movementType": "RECEIVE",
      "referenceDocument": "FAC-9821",
      "quantityIn": "100.000",
      "quantityOut": "0.000",
      "quantityBalance": "170.000",
      "unitCost": "24000.000000",
      "averageCost": "24500.000000",
      "inventoryValue": "4165000.0000"
    },
    {
      "id": "81000000-0000-0000-0000-000000000002",
      "date": "2026-09-25T14:20:00.000Z",
      "movementType": "DISPATCH",
      "referenceDocument": "POS-000412",
      "quantityIn": "0.000",
      "quantityOut": "25.000",
      "quantityBalance": "145.000",
      "unitCost": "24500.000000",
      "averageCost": "24500.000000",
      "inventoryValue": "3552500.0000"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2
  }
}
```

---

#### HU-10 — Consultar alertas de stock mínimo
* **Endpoint**: `GET /api/v1/inventory/stock-alerts`
* **Query Params**: `warehouseId`, `search`, `page`, `limit`.
* **Respuesta Exitosa (`200 OK`)**:
```json
{
  "data": [
    {
      "productId": "31000000-0000-0000-0000-000000000003",
      "sku": "PNT-034",
      "barcode": "7701234567892",
      "name": "Pintura Vinilo Blanco 1 Galón",
      "unitOfMeasure": "GALON",
      "warehouseId": "21000000-0000-0000-0000-000000000001",
      "warehouseName": "Bodega Principal Centro",
      "currentStock": "4.000",
      "minimumStock": "5.000",
      "shortage": "1.000",
      "salePrice": "58000.00"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

---

### 6.3 Endpoints Administrativos y Operaciones Masivas

| Método | Endpoint | Descripción | Comportamiento |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/products/:id` | Detalle exhaustivo de producto. | Retorna ficha técnica y balances multi-bodega. |
| `GET` | `/api/v1/inventory/warehouses/:id/stock` | Existencias detalladas de bodega. | Stock físico, reservado, disponible y valorizado. |
| `GET` | `/api/v1/inventory/moves/:id` | Detalle auditado de movimiento. | Líneas, costos de entrada/salida y usuario creador. |
| `POST` | `/api/v1/inventory/stock-counts` | Registro de Conteos Físicos. | Ajusta diferencias (*surplus* o *shortage*) y actualiza Kardex. |
| `PATCH` | `/api/v1/inventory/products/bulk-activate` | Activación masiva de productos. | Habilita productos seleccionados para la venta. |
| `PATCH` | `/api/v1/inventory/products/bulk-deactivate` | Desactivación masiva de productos.| Inhabilita productos en el POS sin eliminar datos. |
| `POST` | `/api/v1/inventory/products/bulk-delete` | Eliminación / Desactivación masiva. | **Elimina físicamente** si no tiene historial; **desactiva lógicamente** si posee Kardex o ventas. |

#### Ejemplo de Eliminación vs Desactivación Segura (`POST /bulk-delete`):
```json
{
  "results": [
    {
      "productId": "31000000-0000-0000-0000-000000000010",
      "status": "DELETED"
    },
    {
      "productId": "31000000-0000-0000-0000-000000000011",
      "status": "DEACTIVATED",
      "reason": "PRODUCT_HAS_HISTORY"
    }
  ]
}
```

---

## 7. Catálogo Estructurado de Errores

Todos los endpoints retornan errores con formato estandarizado RFC 7807:

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "Stock insuficiente para realizar el despacho del producto.",
  "details": {
    "productId": "31000000-0000-0000-0000-000000000001",
    "requested": "25.000",
    "available": "10.000"
  },
  "timestamp": "2026-09-29T10:35:00.000Z"
}
```

### Códigos de Error Frecuentes

| Código de Error | HTTP Status | Causa / Significado |
| :--- | :---: | :--- |
| `INSUFFICIENT_STOCK` | `409 Conflict` | La cantidad solicitada supera las existencias disponibles (`quantityOnHand - reservedQuantity`). |
| `PRODUCT_NOT_FOUND` | `404 Not Found` | El producto no existe en el catálogo del tenant. |
| `WAREHOUSE_NOT_FOUND` | `404 Not Found` | La bodega no existe o pertenece a otro tenant. |
| `WAREHOUSE_NOT_OPERATIONAL` | `409 Conflict` | La bodega se encuentra inactiva o archivada. |
| `PRODUCT_INACTIVE` | `409 Conflict` | El producto está desactivado para operaciones comerciales. |
| `MOVEMENT_NOT_FOUND` | `404 Not Found` | El movimiento referenciado no existe. |
| `MOVEMENT_ALREADY_REVERSED`| `409 Conflict` | Se intentó reversar un movimiento que ya posee una reversa activa. |
| `DUPLICATE_OPERATION` | `409 Conflict` | Se detectó una operación duplicada con la misma clave de idempotencia. |
| `INVALID_UOM_DECIMALS` | `400 Bad Request` | La cantidad enviada excede los decimales permitidos por su unidad de medida. |
| `SAME_WAREHOUSE_TRANSFER` | `400 Bad Request` | La bodega origen y destino del traslado son idénticas. |

---

## 8. Modelo de Base de Datos (Prisma ORM)

```text
┌───────────────────────────┐         ┌───────────────────────────┐
│          Product          │ 1     * │     InventoryBalance      │
│───────────────────────────│─────────│───────────────────────────│
│ id (PK)                   │         │ id (PK)                   │
│ tenantId (FK)             │         │ tenantId (FK)             │
│ sku (Unique per tenant)   │         │ warehouseId (FK)          │
│ name                      │         │ productId (FK)            │
│ unitOfMeasure             │         │ variantId (FK, opt)       │
│ costPrice                 │         │ quantityOnHand            │
│ salePrice                 │         │ reservedQuantity          │
│ minStockAlert             │         │ averageCost (CPP)         │
│ isActive                  │         │ inventoryValue            │
└───────────────────────────┘         └─────────────┬─────────────┘
              │ 1                                   │ 1
              │                                     │
              │ *                                   │ *
┌─────────────┴─────────────┐         ┌─────────────┴─────────────┐
│   InventoryMovementLine   │ *     1 │   InventoryLedgerEntry    │
│───────────────────────────│─────────│───────────────────────────│
│ id (PK)                   │         │ id (PK)                   │
│ movementId (FK)           │         │ sequence (BigInt AutoInc) │
│ productId (FK)            │         │ tenantId (FK)             │
│ quantity                  │         │ warehouseId (FK)          │
│ unitCost                  │         │ productId (FK)            │
│ totalCost                 │         │ movementType              │
│ previousStock             │         │ quantityIn                │
│ newStock                  │         │ quantityOut               │
│ previousAverageCost       │         │ quantityBalance           │
│ newAverageCost            │         │ averageCost               │
└───────────────────────────┘         │ inventoryValue            │
                                      └───────────────────────────┘
```

---

## 9. Guía de Instalación, Desarrollo y Pruebas

### 9.1 Requisitos Previos
* **Node.js**: v20.x o superior.
* **PostgreSQL**: v16.x con soporte para RLS y extensiones UUID.
* **Redis**: v7.x (para idempotencia distribuida).

### 9.2 Variables de Entorno (`.env`)
```env
PORT=3000
NODE_ENV=development

# Base de Datos PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_contable?schema=public"

# Redis Cache / Idempotencia
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# JWT & Seguridad (Squad 1 Auth)
JWT_SECRET="secret_development_key"
```

### 9.3 Comandos del Proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Generar cliente de Prisma
npm run prisma:generate

# 3. Validar esquema de base de datos
npm run prisma:validate

# 4. Formatear esquema Prisma
npm run prisma:format

# 5. Ejecutar suite de pruebas unitarias (Dominio & Políticas)
npm test

# 6. Comprobación de tipos TypeScript
npx tsc --noEmit

# 7. Iniciar en modo desarrollo
npm run dev
```

---

## 10. Licencia y Créditos

* **Institución**: Instituto Tecnológico del Putumayo (ITP).
* **Proyecto**: SaaS Contable Uniputumayo.
* **Escuadrón**: **Squad 3 — Inventory Engine, Multi-Warehouse & Kardex CPP**.
* **Integración**: Squad 4 (Web Desktop & POS), Squad 5 (Mobile POS), Squad 6 (Reportes & Contabilidad), Squad 7 (Compras).
