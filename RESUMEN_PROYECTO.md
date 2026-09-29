# SQUAD 4

# Web Desktop Admin & High-Speed POS

## Historias de Usuario, Endpoints e Integración con el Squad 3

---

# 1. Objetivo

El Squad 4 es responsable de desarrollar la interfaz web de escritorio para la administración y operación del sistema, incluyendo el POS de alta velocidad.

Para efectos de este documento, se especifican únicamente las funcionalidades que requieren comunicación con el backend de inventario desarrollado por el **Squad 3 — Inventory Engine, Multi-Warehouse & Weighted Average Cost/Kardex**.

El frontend del Squad 4 no administra directamente las existencias ni modifica los valores de inventario.

La responsabilidad queda distribuida así:

```text
┌─────────────────────────────────────────────┐
│                 SQUAD 4                     │
│       Web Desktop / POS                    │
│                                             │
│  • Interfaces                              │
│  • Formularios                             │
│  • Tablas                                  │
│  • Búsqueda de productos                   │
│  • Selección múltiple                      │
│  • Visualización de stock                  │
│  • Visualización de Kardex                 │
│  • Envío de solicitudes HTTP               │
└───────────────────┬─────────────────────────┘
                    │
                    │ REST API
                    ▼
┌─────────────────────────────────────────────┐
│                 SQUAD 3                     │
│             Inventory Engine                │
│                                             │
│  • Stock                                    │
│  • CPP / Weighted Average Cost              │
│  • Kardex                                   │
│  • Movimientos                              │
│  • Entradas                                 │
│  • Salidas                                  │
│  • Transferencias                           │
│  • Reversiones                              │
│  • Concurrencia                             │
│  • Integridad del inventario                │
└─────────────────────────────────────────────┘
```

---

# 2. Alcance

## 2.1 Incluido

El presente documento contempla las funcionalidades del Squad 4 relacionadas con:

* Consulta de productos.
* Creación de productos.
* Actualización de productos.
* Consulta de almacenes.
* Creación de almacenes.
* Consulta de existencias.
* Registro de entradas.
* Registro de salidas.
* Transferencias entre almacenes.
* Reversión de movimientos.
* Consulta de Kardex.
* Consulta de movimientos.
* Operaciones con cantidades fraccionarias.
* Manejo de errores de inventario.
* Idempotencia de operaciones.
* Selección múltiple para operaciones administrativas.
* Activación y desactivación masiva de productos.
* Solicitud de eliminación masiva de productos.

---

## 2.2 Fuera de alcance

No se incluyen en este documento:

* Autenticación.
* Login.
* Registro de usuarios.
* Recuperación de contraseña.
* Gestión de sesiones.
* Roles y permisos.
* Validación de JWT.
* Gestión de tenants.
* Lógica interna de PostgreSQL.
* Implementación del RLS.
* Implementación interna del CPP.
* Implementación interna del Kardex.
* Contabilidad de partida doble.
* Gestión de proveedores.
* Gestión de crédito.
* Implementación interna de ventas.
* Lógica visual del carrito.
* Atajos de teclado.
* Estados exclusivamente locales del frontend.
* Componentes UI.

La autenticación y autorización son responsabilidad del **Squad 1**.

El motor de inventario y su persistencia son responsabilidad del **Squad 3**.

---

# 3. Convenciones de API

## 3.1 Base URL

```text
/api/v1
```

## 3.2 Formato

Las solicitudes y respuestas utilizan JSON.

Los identificadores se manejan mediante UUID.

Las cantidades y valores monetarios relacionados con inventario deben manejarse con precisión decimal.

Ejemplo:

```json
{
  "quantity": "2.750",
  "unitCost": "12500.00"
}
```

No se debe utilizar `float` como fuente de verdad para cálculos de inventario.

---

# 4. Historias de Usuario

---

# HU-INV-01 — Consultar productos

### Historia

**Como** usuario del sistema
**quiero** consultar los productos disponibles
**para** buscarlos desde el POS o desde los módulos administrativos.

### Endpoint

```http
GET /api/v1/inventory/products
```

### Parámetros sugeridos

```text
search
sku
barcode
category
isActive
page
limit
```

### Ejemplo

```http
GET /api/v1/inventory/products?search=arroz&page=1&limit=20
```

### Respuesta

```json
{
  "data": [
    {
      "id": "prod-001",
      "sku": "ARR-001",
      "barcode": "7701234567890",
      "name": "Arroz Diana",
      "category": "Granos",
      "unitOfMeasure": "kg",
      "costPrice": "4200.00",
      "salePrice": "5200.00",
      "wholesalePrice": "4900.00",
      "taxRate": "0.00",
      "minStockAlert": "10.000",
      "isActive": true,
      "stock": {
        "quantityOnHand": "35.000",
        "averageCost": "4150.00",
        "inventoryValue": "145250.00"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### Uso en Squad 4

Este endpoint puede utilizarse tanto para:

* Búsqueda del POS.
* Listado administrativo.
* Búsqueda por código de barras.
* Búsqueda por SKU.
* Consulta del estado del producto.

---

# HU-INV-02 — Consultar detalle de producto

### Historia

**Como** usuario administrativo
**quiero** consultar el detalle de un producto
**para** visualizar su información antes de modificarlo o realizar una operación de inventario.

### Endpoint propuesto

```http
GET /api/v1/inventory/products/{productId}
```

### Respuesta

```json
{
  "id": "prod-001",
  "sku": "ARR-001",
  "barcode": "7701234567890",
  "name": "Arroz Diana",
  "category": "Granos",
  "unitOfMeasure": "kg",
  "costPrice": "4200.00",
  "salePrice": "5200.00",
  "wholesalePrice": "4900.00",
  "taxRate": "0.00",
  "minStockAlert": "10.000",
  "isActive": true
}
```

> **Nota:** el contrato original del Squad 3 solamente define `GET /inventory/products`. Este endpoint individual es una extensión propuesta y puede resolverse mediante filtros si el equipo decide no agregarlo.

---

# HU-INV-03 — Crear producto

### Historia

**Como** administrador
**quiero** crear un producto
**para** incorporarlo al catálogo del sistema.

### Endpoint

```http
POST /api/v1/inventory/products
```

### Request

```json
{
  "sku": "ARR-001",
  "barcode": "7701234567890",
  "name": "Arroz Diana",
  "category": "Granos",
  "unitOfMeasure": "kg",
  "costPrice": "4200.00",
  "salePrice": "5200.00",
  "wholesalePrice": "4900.00",
  "taxRate": "0.00",
  "minStockAlert": "10.000"
}
```

### Respuesta

```json
{
  "id": "prod-001",
  "sku": "ARR-001",
  "barcode": "7701234567890",
  "name": "Arroz Diana",
  "unitOfMeasure": "kg",
  "costPrice": "4200.00",
  "salePrice": "5200.00",
  "isActive": true,
  "createdAt": "2026-09-27T10:00:00Z"
}
```

---

# HU-INV-04 — Actualizar producto

### Historia

**Como** administrador
**quiero** modificar la información de un producto
**para** mantener actualizado el catálogo.

### Endpoint

```http
PATCH /api/v1/inventory/products/{productId}
```

### Request

```json
{
  "name": "Arroz Diana Premium",
  "salePrice": "5500.00",
  "minStockAlert": "15.000"
}
```

### Respuesta

```json
{
  "id": "prod-001",
  "name": "Arroz Diana Premium",
  "salePrice": "5500.00",
  "minStockAlert": "15.000",
  "updatedAt": "2026-09-27T10:15:00Z"
}
```

---

# HU-INV-05 — Consultar almacenes

### Historia

**Como** usuario del sistema
**quiero** consultar los almacenes disponibles
**para** seleccionar el almacén sobre el que deseo realizar una operación.

### Endpoint

```http
GET /api/v1/inventory/warehouses
```

### Respuesta

```json
{
  "data": [
    {
      "id": "wh-001",
      "code": "BOD-01",
      "name": "Bodega Principal",
      "branchId": "branch-001",
      "isActive": true
    },
    {
      "id": "wh-002",
      "code": "BOD-02",
      "name": "Bodega Secundaria",
      "branchId": "branch-001",
      "isActive": true
    }
  ]
}
```

---

# HU-INV-06 — Crear almacén

### Historia

**Como** administrador
**quiero** crear un almacén
**para** manejar inventario separado por ubicación.

### Endpoint

```http
POST /api/v1/inventory/warehouses
```

### Request

```json
{
  "branchId": "branch-001",
  "code": "BOD-03",
  "name": "Bodega Nueva"
}
```

### Respuesta

```json
{
  "id": "wh-003",
  "code": "BOD-03",
  "name": "Bodega Nueva",
  "branchId": "branch-001",
  "isActive": true
}
```

---

# HU-INV-07 — Consultar existencias por almacén

### Historia

**Como** usuario del sistema
**quiero** consultar las existencias de un almacén
**para** conocer qué productos y cantidades están disponibles.

### Endpoint propuesto

```http
GET /api/v1/inventory/warehouses/{warehouseId}/stock
```

### Parámetros

```text
search
sku
barcode
page
limit
```

### Ejemplo

```http
GET /api/v1/inventory/warehouses/wh-001/stock?search=arroz
```

### Respuesta

```json
{
  "warehouse": {
    "id": "wh-001",
    "name": "Bodega Principal"
  },
  "data": [
    {
      "productId": "prod-001",
      "sku": "ARR-001",
      "name": "Arroz Diana",
      "quantityOnHand": "35.000",
      "reservedQuantity": "0.000",
      "availableQuantity": "35.000",
      "averageCost": "4150.00",
      "inventoryValue": "145250.00"
    }
  ]
}
```

> **Extensión propuesta:** el contrato original del profesor no define este endpoint explícitamente. Debe acordarse con el Squad 3.

---

# HU-INV-08 — Registrar entrada de inventario

### Historia

**Como** usuario autorizado para operaciones de inventario
**quiero** registrar una entrada de mercancía
**para** aumentar las existencias y actualizar el CPP.

### Endpoint

```http
POST /api/v1/inventory/moves/receive
```

### Request

```json
{
  "warehouseId": "wh-001",
  "referenceDocument": "COMP-00045",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "100.000",
      "unitCost": "4800.00"
    }
  ]
}
```

### Respuesta

```json
{
  "movementId": "mov-001",
  "type": "RECEIVE",
  "status": "POSTED",
  "warehouseId": "wh-001",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "100.000",
      "unitCost": "4800.00",
      "totalCost": "480000.00",
      "previousStock": "35.000",
      "newStock": "135.000",
      "averageCostBefore": "4150.00",
      "averageCostAfter": "4631.48"
    }
  ],
  "createdAt": "2026-09-27T10:30:00Z"
}
```

El frontend no calcula el nuevo CPP.

---

# HU-INV-09 — Registrar salida de inventario

### Historia

**Como** usuario del POS
**quiero** registrar una salida de inventario
**para** descontar del almacén los productos asociados a una operación.

### Endpoint

```http
POST /api/v1/inventory/moves/dispatch
```

### Request

```json
{
  "warehouseId": "wh-001",
  "referenceDocument": "SALE-000123",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "2.750"
    }
  ]
}
```

### Respuesta

```json
{
  "movementId": "mov-002",
  "type": "DISPATCH",
  "status": "POSTED",
  "warehouseId": "wh-001",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "2.750",
      "unitCost": "4631.48",
      "totalCost": "12736.57",
      "previousStock": "135.000",
      "newStock": "132.250"
    }
  ],
  "createdAt": "2026-09-27T10:35:00Z"
}
```

El costo de salida debe ser calculado por el Squad 3 utilizando el CPP vigente.

---

# HU-INV-10 — Transferir inventario

### Historia

**Como** administrador
**quiero** transferir productos entre almacenes
**para** mover existencias de una ubicación a otra.

### Endpoint

```http
POST /api/v1/inventory/transfers
```

### Request

```json
{
  "sourceWarehouseId": "wh-001",
  "destinationWarehouseId": "wh-002",
  "referenceDocument": "TRF-00015",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "20.000"
    }
  ]
}
```

### Respuesta

```json
{
  "transferId": "trf-001",
  "status": "COMPLETED",
  "sourceWarehouseId": "wh-001",
  "destinationWarehouseId": "wh-002",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "20.000",
      "unitCost": "4631.48"
    }
  ],
  "createdAt": "2026-09-27T10:40:00Z"
}
```

---

# HU-INV-11 — Revertir movimiento

### Historia

**Como** usuario autorizado
**quiero** revertir un movimiento
**para** corregir una operación registrada incorrectamente sin eliminar el historial.

### Endpoint

```http
POST /api/v1/inventory/moves/reverse
```

### Request

```json
{
  "movementId": "mov-002",
  "reason": "Venta anulada SALE-000123"
}
```

### Respuesta

```json
{
  "reversalMovementId": "mov-003",
  "reversedMovementId": "mov-002",
  "status": "POSTED",
  "reason": "Venta anulada SALE-000123",
  "createdAt": "2026-09-27T10:50:00Z"
}
```

### Regla

No se debe eliminar un movimiento publicado.

La corrección se realiza mediante un nuevo movimiento de reversión.

---

# HU-INV-12 — Consultar Kardex

### Historia

**Como** usuario administrativo
**quiero** consultar el Kardex de un producto
**para** revisar el historial de movimientos, existencias y costos.

### Endpoint

```http
GET /api/v1/inventory/kardex/{productId}
```

### Parámetros sugeridos

```text
warehouseId
from
to
moveType
page
limit
```

### Ejemplo

```http
GET /api/v1/inventory/kardex/prod-001?warehouseId=wh-001&from=2026-09-01&to=2026-09-27
```

### Respuesta

```json
{
  "product": {
    "id": "prod-001",
    "sku": "ARR-001",
    "name": "Arroz Diana",
    "unitOfMeasure": "kg"
  },
  "warehouse": {
    "id": "wh-001",
    "name": "Bodega Principal"
  },
  "entries": [
    {
      "id": "ledger-001",
      "createdAt": "2026-09-24T09:00:00Z",
      "movementType": "RECEIVE",
      "referenceDocument": "COMP-00040",
      "quantityIn": "100.000",
      "quantityOut": "0.000",
      "quantityBalance": "170.000",
      "unitCost": "24000.00",
      "averageCost": "24000.00",
      "inventoryValue": "4080000.00"
    },
    {
      "id": "ledger-002",
      "createdAt": "2026-09-25T14:30:00Z",
      "movementType": "DISPATCH",
      "referenceDocument": "SALE-000100",
      "quantityIn": "0.000",
      "quantityOut": "25.000",
      "quantityBalance": "145.000",
      "unitCost": "24000.00",
      "averageCost": "24000.00",
      "inventoryValue": "3480000.00"
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

# HU-INV-13 — Consultar detalle de movimiento

### Historia

**Como** usuario administrativo
**quiero** consultar el detalle de un movimiento
**para** conocer qué operación modificó el inventario.

### Endpoint propuesto

```http
GET /api/v1/inventory/moves/{movementId}
```

### Respuesta

```json
{
  "id": "mov-002",
  "type": "DISPATCH",
  "status": "POSTED",
  "warehouseId": "wh-001",
  "referenceDocument": "SALE-000123",
  "createdAt": "2026-09-27T10:35:00Z",
  "lines": [
    {
      "productId": "prod-001",
      "quantity": "2.750",
      "unitCost": "4631.48",
      "totalCost": "12736.57",
      "previousStock": "135.000",
      "newStock": "132.250"
    }
  ]
}
```

---

# HU-INV-14 — Registrar cantidades fraccionarias

### Historia

**Como** usuario del sistema
**quiero** registrar cantidades decimales
**para** manejar productos vendidos por peso, longitud, volumen u otras unidades fraccionarias.

### Endpoints

Entrada:

```http
POST /api/v1/inventory/moves/receive
```

Salida:

```http
POST /api/v1/inventory/moves/dispatch
```

### Ejemplo

```json
{
  "warehouseId": "wh-001",
  "lines": [
    {
      "productId": "prod-cable-001",
      "quantity": "2.750"
    }
  ]
}
```

Ejemplos:

```text
2.750 kg
1.500 m
0.250 unidades
```

La precisión debe ser determinada por la unidad de medida y validada por el backend.

---

# HU-INV-15 — Evitar salidas superiores al stock

### Historia

**Como** sistema
**quiero** validar la existencia disponible antes de registrar una salida
**para** evitar que el inventario quede en cantidades inválidas.

### Endpoint

```http
POST /api/v1/inventory/moves/dispatch
```

### Error

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock for product prod-001",
  "details": {
    "productId": "prod-001",
    "requested": "500.000",
    "available": "132.250"
  }
}
```

La validación debe realizarse dentro de la transacción del Squad 3.

---

# HU-INV-16 — Controlar operaciones concurrentes

### Historia

**Como** sistema
**quiero** controlar varias operaciones simultáneas sobre el mismo producto
**para** evitar inconsistencias en el inventario.

### Endpoint

```http
POST /api/v1/inventory/moves/dispatch
```

No se requiere un endpoint adicional.

La implementación del Squad 3 debe manejar la concurrencia mediante una operación transaccional y bloqueo apropiado del registro de inventario.

### Ejemplo

```text
Stock inicial: 1

Solicitud A → cantidad 1
Solicitud B → cantidad 1

Resultado:

Solicitud A → APROBADA
Solicitud B → RECHAZADA

Stock final: 0
```

---

# HU-INV-17 — Evitar movimientos duplicados

### Historia

**Como** cliente del sistema
**quiero** poder reenviar una solicitud sin crear accidentalmente dos movimientos
**para** soportar reintentos causados por problemas de red.

### Endpoints

```http
POST /api/v1/inventory/moves/receive
POST /api/v1/inventory/moves/dispatch
POST /api/v1/inventory/transfers
```

### Header

```text
Idempotency-Key: 4b6f1c20-8d90-4f2c-91d0-123456789abc
```

### Regla

Si una misma operación llega nuevamente con la misma clave de idempotencia, el backend debe devolver el resultado de la operación original en lugar de crear un segundo movimiento.

---

# HU-INV-18 — Desactivar múltiples productos

### Historia

**Como** administrador
**quiero** seleccionar varios productos y desactivarlos
**para** administrar rápidamente el catálogo.

### Endpoint propuesto

```http
PATCH /api/v1/inventory/products/bulk-deactivate
```

### Request

```json
{
  "productIds": [
    "prod-001",
    "prod-002",
    "prod-003"
  ]
}
```

### Respuesta

```json
{
  "updated": 3,
  "productIds": [
    "prod-001",
    "prod-002",
    "prod-003"
  ]
}
```

---

# HU-INV-19 — Activar múltiples productos

### Historia

**Como** administrador
**quiero** seleccionar varios productos y activarlos
**para** volverlos disponibles en el sistema.

### Endpoint propuesto

```http
PATCH /api/v1/inventory/products/bulk-activate
```

### Request

```json
{
  "productIds": [
    "prod-001",
    "prod-002"
  ]
}
```

### Respuesta

```json
{
  "updated": 2,
  "productIds": [
    "prod-001",
    "prod-002"
  ]
}
```

---

# HU-INV-20 — Eliminar múltiples productos

### Historia

**Como** administrador
**quiero** seleccionar varios productos y solicitar su eliminación
**para** limpiar productos que ya no se utilizan.

### Endpoint propuesto

```http
POST /api/v1/inventory/products/bulk-delete
```

### Request

```json
{
  "productIds": [
    "prod-010",
    "prod-011",
    "prod-012"
  ]
}
```

### Respuesta

```json
{
  "results": [
    {
      "productId": "prod-010",
      "status": "DELETED"
    },
    {
      "productId": "prod-011",
      "status": "DEACTIVATED",
      "reason": "PRODUCT_HAS_HISTORY"
    },
    {
      "productId": "prod-012",
      "status": "DELETED"
    }
  ]
}
```

### Regla

Un producto que posea historial de movimientos u otras referencias que deban conservarse no debe eliminarse físicamente.

En ese caso se desactiva.

---

# 5. Resumen general de endpoints

## 5.1 Endpoints definidos originalmente por el Squad 3

Estos son los endpoints que forman el contrato principal entregado por el profesor.

| Método  | Endpoint                               | Función               |
| ------- | -------------------------------------- | --------------------- |
| `GET`   | `/api/v1/inventory/products`           | Consultar productos   |
| `POST`  | `/api/v1/inventory/products`           | Crear producto        |
| `PATCH` | `/api/v1/inventory/products/{id}`      | Actualizar producto   |
| `GET`   | `/api/v1/inventory/warehouses`         | Consultar almacenes   |
| `POST`  | `/api/v1/inventory/moves/dispatch`     | Registrar salida      |
| `POST`  | `/api/v1/inventory/moves/receive`      | Registrar entrada     |
| `POST`  | `/api/v1/inventory/moves/reverse`      | Revertir movimiento   |
| `POST`  | `/api/v1/inventory/transfers`          | Transferir inventario |
| `GET`   | `/api/v1/inventory/kardex/{productId}` | Consultar Kardex      |

---

# 5.2 Endpoints adicionales propuestos

Estos endpoints son útiles para completar la experiencia del Squad 4, pero deben ser acordados con el Squad 3 antes de considerarlos parte del contrato definitivo.

| Método  | Endpoint                                           | Función                          |
| ------- | -------------------------------------------------- | -------------------------------- |
| `GET`   | `/api/v1/inventory/products/{productId}`           | Detalle de producto              |
| `GET`   | `/api/v1/inventory/warehouses/{warehouseId}/stock` | Stock por almacén                |
| `GET`   | `/api/v1/inventory/moves/{movementId}`             | Detalle de movimiento            |
| `PATCH` | `/api/v1/inventory/products/bulk-activate`         | Activación masiva                |
| `PATCH` | `/api/v1/inventory/products/bulk-deactivate`       | Desactivación masiva             |
| `POST`  | `/api/v1/inventory/products/bulk-delete`           | Eliminación/desactivación masiva |

---

# 6. Estructura conceptual de datos

El Squad 4 no necesita conocer todos los detalles internos de la base de datos del Squad 3, pero las respuestas API deberían manejar conceptos equivalentes a los siguientes.

## 6.1 Product

```text
Product
├── id
├── tenantId
├── sku
├── barcode
├── name
├── category
├── unitOfMeasure
├── costPrice
├── salePrice
├── wholesalePrice
├── taxRate
├── minStockAlert
├── isActive
├── createdAt
└── updatedAt
```

---

## 6.2 Stock

```text
InventoryBalance
├── productId
├── warehouseId
├── quantityOnHand
├── reservedQuantity
├── averageCost
├── inventoryValue
└── version
```

El `averageCost` representa el costo promedio ponderado vigente para esa existencia.

---

## 6.3 Inventory Movement

```text
InventoryMovement
├── id
├── type
├── status
├── warehouseId
├── referenceDocument
├── createdBy
├── createdAt
└── lines
```

---

## 6.4 Inventory Movement Line

```text
InventoryMovementLine
├── productId
├── quantity
├── unitCost
├── totalCost
├── previousStock
└── newStock
```

---

## 6.5 Kardex

```text
InventoryLedgerEntry
├── id
├── productId
├── warehouseId
├── movementId
├── movementType
├── quantityIn
├── quantityOut
├── quantityBalance
├── unitCost
├── averageCost
├── inventoryValue
├── referenceDocument
└── createdAt
```

---

# 7. Flujo de una entrada

```text
Squad 4
   │
   │ POST /inventory/moves/receive
   ▼
Squad 3
   │
   ├── valida almacén
   ├── valida producto
   ├── inicia transacción
   ├── obtiene stock actual
   ├── registra entrada
   ├── calcula nuevo CPP
   ├── actualiza existencia
   ├── registra Kardex
   └── confirma transacción
   │
   ▼
Respuesta JSON
   │
   ▼
Squad 4 actualiza la interfaz
```

---

# 8. Flujo de una salida desde el POS

```text
POS — Squad 4
      │
      │ POST /inventory/moves/dispatch
      ▼
Inventory Engine — Squad 3
      │
      ├── valida producto
      ├── valida almacén
      ├── bloquea existencia
      ├── comprueba stock disponible
      ├── obtiene CPP
      ├── calcula costo de salida
      ├── descuenta existencia
      ├── registra movimiento
      ├── registra Kardex
      └── confirma transacción
      │
      ▼
Respuesta
      │
      ▼
POS — Squad 4
```

---

# 9. Flujo de transferencia

```text
Squad 4
   │
   │ POST /inventory/transfers
   ▼
Squad 3
   │
   ├── valida almacén origen
   ├── valida almacén destino
   ├── valida stock
   ├── bloquea existencia
   ├── registra salida origen
   ├── registra entrada destino
   ├── recalcula existencia destino
   ├── registra Kardex
   └── confirma transacción
   │
   ▼
Respuesta
```

La transferencia no debe implementarse desde el frontend como dos operaciones independientes.

Debe ser una operación atómica en el backend.

---

# 10. Reversión

Los movimientos históricos no deben eliminarse.

```text
Movimiento original
       │
       │
       ▼
┌───────────────────┐
│ DISPATCH          │
│ -10 unidades      │
└─────────┬─────────┘
          │
          │ reverse
          ▼
┌───────────────────┐
│ REVERSAL          │
│ +10 unidades      │
└───────────────────┘
```

Endpoint:

```http
POST /api/v1/inventory/moves/reverse
```

Esto permite conservar la trazabilidad completa.

---

# 11. Errores esperados

El Squad 3 debe devolver errores estructurados para que el Squad 4 pueda presentarlos correctamente.

## Stock insuficiente

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock",
  "details": {
    "productId": "prod-001",
    "requested": "20.000",
    "available": "5.000"
  }
}
```

## Producto inexistente

```json
{
  "statusCode": 404,
  "code": "PRODUCT_NOT_FOUND",
  "message": "Product not found"
}
```

## Almacén inexistente

```json
{
  "statusCode": 404,
  "code": "WAREHOUSE_NOT_FOUND",
  "message": "Warehouse not found"
}
```

## Producto inactivo

```json
{
  "statusCode": 409,
  "code": "PRODUCT_INACTIVE",
  "message": "Product is inactive"
}
```

## Movimiento inexistente

```json
{
  "statusCode": 404,
  "code": "MOVEMENT_NOT_FOUND",
  "message": "Movement not found"
}
```

## Operación duplicada

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_OPERATION",
  "message": "Operation already processed",
  "details": {
    "movementId": "mov-001"
  }
}
```

---

# 12. Reglas de integración

## 12.1 El frontend no modifica stock directamente

Incorrecto:

```text
Frontend
   ↓
UPDATE stock
```

Correcto:

```text
Frontend
   ↓
POST /inventory/moves/dispatch
   ↓
Inventory Engine
   ↓
actualización del stock
```

---

## 12.2 El frontend no calcula el CPP definitivo

El frontend puede mostrar el CPP recibido por API.

No debe determinar por sí mismo el costo contable de una salida.

El Squad 3 es la fuente de verdad.

---

## 12.3 El frontend no construye el Kardex

El frontend únicamente consulta:

```http
GET /api/v1/inventory/kardex/{productId}
```

y presenta la información.

---

## 12.4 Las operaciones críticas deben ser transaccionales

Especialmente:

* Salidas.
* Entradas.
* Transferencias.
* Reversiones.
* Actualizaciones de stock.

---

## 12.5 Las cantidades pueden ser fraccionarias

No asumir que:

```text
quantity = integer
```

Ejemplos:

```text
2.750 kg
1.500 m
0.250 L
```

---

## 12.6 Los movimientos publicados son inmutables

No debe existir una operación como:

```http
DELETE /api/v1/inventory/moves/{movementId}
```

ni una edición arbitraria de un movimiento publicado.

La corrección se realiza mediante reversión.

---

# 13. Operaciones masivas

La interfaz administrativa debe permitir seleccionar múltiples registros cuando la operación tenga sentido.

Ejemplo:

```text
☑ Producto A
☑ Producto B
☑ Producto C
☐ Producto D

[Desactivar seleccionados]
```

El frontend puede manejar la selección de filas localmente.

Pero la acción que realmente modifica el backend debe utilizar un endpoint.

Ejemplo:

```http
PATCH /api/v1/inventory/products/bulk-deactivate
```

Request:

```json
{
  "productIds": [
    "prod-001",
    "prod-002",
    "prod-003"
  ]
}
```

La misma lógica aplica para activación y, si el Squad 3 lo permite, eliminación.

---

# 14. Eliminación vs desactivación

Para datos de inventario debe distinguirse entre:

### Producto sin historial

Puede ser candidato a eliminación física.

### Producto con historial

Debe conservarse y pasar a:

```json
{
  "isActive": false
}
```

Esto evita destruir información necesaria para:

* Kardex.
* Historial de ventas.
* Reportes.
* Auditoría.
* Trazabilidad.

Por esta razón, una operación de eliminación masiva puede devolver resultados diferentes para cada producto.

```json
{
  "results": [
    {
      "productId": "prod-001",
      "status": "DELETED"
    },
    {
      "productId": "prod-002",
      "status": "DEACTIVATED",
      "reason": "PRODUCT_HAS_HISTORY"
    }
  ]
}
```

---

# 15. Idempotencia

Las operaciones que modifican inventario pueden recibir reintentos debido a problemas de red.

Por ejemplo:

```text
POS
 │
 │ POST dispatch
 ▼
Servidor
 │
 ├── procesa movimiento
 │
 └── respuesta se pierde
       ↓
POS reintenta
```

Sin idempotencia podrían generarse dos salidas.

Por ello se recomienda:

```text
Idempotency-Key
```

en:

```http
POST /inventory/moves/receive
POST /inventory/moves/dispatch
POST /inventory/transfers
```

Ejemplo:

```text
Idempotency-Key: operation-550e8400
```

El backend debe garantizar que la misma operación lógica no sea aplicada dos veces.

---

# 16. Responsabilidades

| Funcionalidad              | Squad 3 | Squad 4 |
| -------------------------- | :-----: | :-----: |
| Modelo de inventario       |    ✅    |         |
| Persistencia               |    ✅    |         |
| Stock real                 |    ✅    |         |
| CPP                        |    ✅    |         |
| Kardex                     |    ✅    |         |
| Movimientos                |    ✅    |         |
| Entradas                   |    ✅    |         |
| Salidas                    |    ✅    |         |
| Transferencias             |    ✅    |         |
| Reversiones                |    ✅    |         |
| Concurrencia               |    ✅    |         |
| Validación de stock        |    ✅    |         |
| API de inventario          |    ✅    |         |
| Pantalla de productos      |         |    ✅    |
| Pantalla de stock          |         |    ✅    |
| Pantalla de almacenes      |         |    ✅    |
| Pantalla de entradas       |         |    ✅    |
| Pantalla de salidas        |         |    ✅    |
| Pantalla de transferencias |         |    ✅    |
| Pantalla de Kardex         |         |    ✅    |
| Selección múltiple         |         |    ✅    |
| Consumo de API             |         |    ✅    |
| Presentación de errores    |         |    ✅    |

---

# 17. Contrato mínimo que necesita Squad 4

Para que el Squad 4 pueda comenzar a integrar el inventario, el contrato mínimo del Squad 3 debe contemplar:

```text
GET    /api/v1/inventory/products
POST   /api/v1/inventory/products
PATCH  /api/v1/inventory/products/{id}

GET    /api/v1/inventory/warehouses

POST   /api/v1/inventory/moves/receive
POST   /api/v1/inventory/moves/dispatch
POST   /api/v1/inventory/moves/reverse

POST   /api/v1/inventory/transfers

GET    /api/v1/inventory/kardex/{productId}
```

Con estos endpoints, el Squad 4 puede construir la integración principal con el motor de inventario.

Las siguientes rutas quedan como propuestas para completar la experiencia administrativa:

```text
GET    /api/v1/inventory/products/{id}
GET    /api/v1/inventory/warehouses/{id}/stock
GET    /api/v1/inventory/moves/{id}

PATCH  /api/v1/inventory/products/bulk-activate
PATCH  /api/v1/inventory/products/bulk-deactivate
POST   /api/v1/inventory/products/bulk-delete
```

---

# 18. Criterio final de integración

La regla principal entre ambos squads es:

> **Squad 4 consume y presenta el inventario; Squad 3 es la fuente de verdad y ejecuta las operaciones que modifican el inventario.**

Por tanto:

```text
                 SQUAD 4
          Web Desktop / POS
                 │
                 │ HTTP/REST
                 ▼
        ┌─────────────────────┐
        │      SQUAD 3        │
        │ Inventory Engine    │
        ├─────────────────────┤
        │ Products            │
        │ Warehouses           │
        │ Stock               │
        │ CPP                 │
        │ Movements           │
        │ Transfers           │
        │ Kardex              │
        │ Reversals           │
        │ Concurrency         │
        └─────────────────────┘
                 │
                 ▼
             PostgreSQL
```

El Squad 4 **no debe duplicar la lógica de inventario** en el frontend.

Toda operación que cambie existencias debe pasar por los endpoints del Squad 3.

Esto permite mantener una única fuente de verdad para el stock, el costo promedio ponderado y el Kardex, independientemente de si la operación se origina desde el POS web, el POS móvil u otro módulo del sistema.
