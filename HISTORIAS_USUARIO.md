# Historias de Usuario — Integración Squad 4 con Inventory E3

> **Alcance:** Funcionalidades del frontend Web/POS de Squad 4 (y squads integradoras: 2, 5, 6, 7) que consumen los servicios del **Escuadrón 3 — Inventory Engine, Multi-Bodega & Kardex CPP**.
> 
> **Estado de Implementación:** **100% IMPLEMENTADAS Y VERIFICADAS (READY)**  
> **Pruebas Automatizadas:** 30 suites (29 unitarias/integración + 1 E2E funcional real contra PostgreSQL + Redis + RLS), **245/245 tests PASS**.  
> **Aislamiento Multi-Tenant:** RLS estricto activo en PostgreSQL 16 para todas las tablas.  
> **Valuación Contable:** Costo Promedio Ponderado (CPP) con precisión `Decimal.js` según norma NIIF/NIC 2.

---

## HU-01 — Consultar productos disponibles para POS

**Como** usuario del POS,
**quiero** consultar los productos disponibles del inventario,
**para** agregarlos rápidamente a una venta.

### Endpoint

```http
GET /api/v1/inventory/products
```

### Parámetros de consulta

```http
GET /api/v1/inventory/products?search=CEM-001
```

La búsqueda debe contemplar:

* SKU
* Nombre
* Código de barras

Opcionalmente:

* estado activo
* categoría
* bodega

### Respuesta esperada

```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "CEM-001",
      "barcode": "7701234567890",
      "name": "Cemento Gris Argos 50kg",
      "unitOfMeasure": "BULTO",
      "averageCost": 24500.0000,
      "salePrice": 32000.00,
      "wholesalePrice": 30000.00,
      "taxRate": 0.19,
      "stock": 145.000,
      "minStockAlert": 5.000,
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### Criterios de aceptación

* Debe permitir buscar por SKU.
* Debe permitir buscar por nombre.
* Debe permitir buscar por código de barras.
* Debe retornar existencia disponible.
* Debe retornar unidad de medida.
* Debe retornar precio de venta.
* El costo mostrado debe corresponder al CPP vigente cuando aplique.
* La consulta debe respetar el tenant y la bodega correspondiente.
* No debe devolver productos pertenecientes a otro tenant.

---

# HU-02 — Crear producto desde el administrador

**Como** administrador autorizado,
**quiero** crear un producto en el catálogo,
**para** que pueda ser utilizado posteriormente en el POS y en inventario.

### Endpoint

```http
POST /api/v1/inventory/products
```

### Request

```json
{
  "sku": "CAB-008",
  "name": "Cable Cobre THHN #12",
  "barcode": "7701234567891",
  "category": "CABLES",
  "unitOfMeasure": "METRO",
  "costPrice": 3100.0000,
  "salePrice": 4200.00,
  "wholesalePrice": 3900.00,
  "taxRate": 0.19,
  "minStockAlert": 20.000
}
```

### Respuesta

```json
{
  "id": "uuid",
  "sku": "CAB-008",
  "name": "Cable Cobre THHN #12",
  "unitOfMeasure": "METRO",
  "salePrice": 4200.00,
  "status": "ACTIVE"
}
```

### Criterios de aceptación

* El SKU debe ser único dentro del tenant.
* Debe permitir unidades fraccionarias.
* Debe permitir configurar umbral mínimo de stock.
* El producto creado debe quedar disponible para consultas posteriores.
* La creación no debe permitir asociar el producto a otro tenant.
* El costo inicial no debe confundirse con el CPP histórico de una existencia que todavía no ha sido recibida.

---

# HU-03 — Actualizar información comercial del producto

**Como** administrador autorizado,
**quiero** actualizar la información comercial de un producto,
**para** mantener actualizado el catálogo utilizado por el POS.

### Endpoint

```http
PATCH /api/v1/inventory/products/:id
```

### Request

```json
{
  "salePrice": 4500.00,
  "wholesalePrice": 4200.00,
  "costPrice": 3200.0000,
  "minStockAlert": 25.000
}
```

### Respuesta

```json
{
  "id": "uuid",
  "sku": "CAB-008",
  "name": "Cable Cobre THHN #12",
  "salePrice": 4500.00,
  "wholesalePrice": 4200.00,
  "costPrice": 3200.0000,
  "minStockAlert": 25.000
}
```

### Criterios de aceptación

* Solo debe modificar campos permitidos.
* No debe modificar movimientos históricos.
* No debe modificar registros del Kardex.
* Los cambios de precio de venta no deben alterar el CPP.
* El producto debe permanecer dentro del tenant actual.

---

# HU-04 — Consultar bodegas disponibles

**Como** usuario del POS o administrador,
**quiero** consultar las bodegas disponibles,
**para** seleccionar la ubicación desde la cual se realizará la operación.

### Endpoint

```http
GET /api/v1/inventory/warehouses
```

### Respuesta

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "BOD-01",
      "name": "Bodega Principal Centro",
      "branchId": "uuid",
      "status": "ACTIVE"
    },
    {
      "id": "uuid",
      "code": "BOD-02",
      "name": "Bodega Norte",
      "branchId": "uuid",
      "status": "ACTIVE"
    }
  ]
}
```

### Criterios de aceptación

* Solo deben aparecer bodegas disponibles para el tenant.
* Deben identificarse por código y nombre.
* Debe conocerse la sucursal asociada.
* No deben mostrarse bodegas inactivas cuando el caso de uso requiera únicamente bodegas operativas.

---

# HU-05 — Despachar inventario por venta POS

**Como** POS,
**quiero** solicitar el despacho de los productos vendidos,
**para** descontar físicamente el inventario de forma atómica.

### Endpoint

```http
POST /api/v1/inventory/moves/dispatch
```

### Request

```json
{
  "warehouseId": "uuid",
  "referenceType": "POS_SALE",
  "referenceId": "uuid",
  "referenceDocument": "POS-000412",
  "items": [
    {
      "productId": "uuid",
      "quantity": 25.000
    }
  ]
}
```

### Respuesta

```json
{
  "movementId": "uuid",
  "referenceDocument": "POS-000412",
  "items": [
    {
      "productId": "uuid",
      "quantity": 25.000,
      "unitCost": 24500.0000,
      "totalCost": 612500.00,
      "remainingStock": 145.000
    }
  ]
}
```

### Criterios de aceptación

* Debe ejecutarse dentro de una transacción.
* Debe utilizar bloqueo pesimista `SELECT FOR UPDATE`.
* No debe permitir stock negativo.
* Debe soportar cantidades fraccionarias.
* Debe retornar el costo unitario exacto utilizado para la salida.
* Debe generar un movimiento inmutable.
* Debe conservar la referencia de la venta POS.
* Una petición repetida con la misma `X-Idempotency-Key` no debe generar una segunda salida.

### Error de stock insuficiente

```http
409 Conflict
```

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Stock insuficiente para el producto.",
  "available": 10.000,
  "requested": 25.000
}
```

---

# HU-06 — Recibir mercancía de una compra

**Como** módulo de compras,
**quiero** registrar la recepción física de mercancía,
**para** incrementar el inventario y recalcular el CPP.

### Endpoint

```http
POST /api/v1/inventory/moves/receive
```

### Request

```json
{
  "warehouseId": "uuid",
  "referenceType": "PURCHASE",
  "referenceId": "uuid",
  "referenceDocument": "FAC-9821",
  "items": [
    {
      "productId": "uuid",
      "quantity": 100.000,
      "unitCost": 24000.0000
    }
  ]
}
```

### Respuesta

```json
{
  "movementId": "uuid",
  "referenceDocument": "FAC-9821",
  "items": [
    {
      "productId": "uuid",
      "quantity": 100.000,
      "unitCost": 24000.0000,
      "newAverageCost": 24294.1176,
      "newStock": 270.000
    }
  ]
}
```

### Criterios de aceptación

* Debe aumentar el stock.
* Debe registrar el costo real de recepción.
* Debe recalcular el CPP.
* Debe utilizar `Decimal.js`/`NUMERIC` para los cálculos.
* Debe registrar un movimiento inmutable.
* Debe conservar el documento de compra como referencia.
* Debe ser idempotente.
* Una recepción repetida no debe duplicar mercancía.

---

# HU-07 — Reversar una salida de inventario

**Como** sistema POS/ventas,
**quiero** reversar una salida previamente registrada,
**para** corregir una operación anulada sin eliminar el historial.

### Endpoint

```http
POST /api/v1/inventory/moves/reverse
```

### Request

```json
{
  "movementId": "uuid",
  "referenceType": "POS_VOID",
  "referenceId": "uuid",
  "referenceDocument": "POS-000412",
  "reason": "ANULACION_VENTA"
}
```

### Respuesta

```json
{
  "originalMovementId": "uuid",
  "reversalMovementId": "uuid",
  "productId": "uuid",
  "quantityRestored": 25.000,
  "newStock": 170.000
}
```

### Criterios de aceptación

* Nunca debe eliminar el movimiento original.
* Debe generar un nuevo movimiento de reversa.
* Debe existir relación entre el movimiento original y su reversa.
* Debe quedar registrada la razón de la reversa.
* Debe ser auditado.
* Una misma operación no debe poder revertirse dos veces.
* Debe mantener la trazabilidad completa del Kardex.

---

# HU-08 — Trasladar mercancía entre bodegas

**Como** administrador de inventario,
**quiero** trasladar mercancía entre dos bodegas autorizadas,
**para** mantener actualizado el inventario de cada ubicación.

### Endpoint

```http
POST /api/v1/inventory/transfers
```

### Request

```json
{
  "sourceWarehouseId": "uuid",
  "destinationWarehouseId": "uuid",
  "referenceDocument": "REM-000145",
  "reason": "REABASTECIMIENTO",
  "items": [
    {
      "productId": "uuid",
      "quantity": 30.000
    }
  ]
}
```

### Respuesta

```json
{
  "transferId": "uuid",
  "status": "COMPLETED",
  "referenceDocument": "REM-000145",
  "sourceWarehouseId": "uuid",
  "destinationWarehouseId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 30.000
    }
  ]
}
```

### Criterios de aceptación

* La bodega origen y destino deben pertenecer al mismo tenant.
* Las bodegas deben estar habilitadas para la operación.
* No debe permitirse transferir hacia la misma bodega.
* La bodega origen debe tener existencia suficiente.
* Debe descontarse el stock de origen.
* Debe aumentarse el stock de destino.
* Deben generarse los movimientos correspondientes.
* El traslado debe ser atómico.
* Debe conservarse el documento de remisión.
* Debe utilizar idempotencia para evitar duplicar el traslado.

---

# HU-09 — Consultar Kardex valorizado

**Como** administrador o módulo de reportes/POS,
**quiero** consultar el Kardex de un producto,
**para** conocer el historial de entradas, salidas y costos.

### Endpoint

```http
GET /api/v1/inventory/kardex/:productId
```

### Ejemplo

```http
GET /api/v1/inventory/kardex/31000000-0000-0000-0000-000000000001
```

### Respuesta

```json
{
  "productId": "uuid",
  "productName": "Cemento Gris Argos 50kg",
  "unitOfMeasure": "BULTO",
  "entries": [
    {
      "date": "2026-09-24T10:30:00Z",
      "movementType": "PURCHASE_RECEIPT",
      "referenceDocument": "FAC-9821",
      "quantityIn": 100.000,
      "quantityOut": 0.000,
      "unitCost": 24000.0000,
      "quantityBalance": 170.000,
      "inventoryValue": 4080000.00
    },
    {
      "date": "2026-09-25T14:20:00Z",
      "movementType": "SALE_DISPATCH",
      "referenceDocument": "POS-000412",
      "quantityIn": 0.000,
      "quantityOut": 25.000,
      "unitCost": 24500.0000,
      "quantityBalance": 145.000,
      "inventoryValue": 3552500.00
    }
  ]
}
```

### Criterios de aceptación

* Debe devolver los movimientos cronológicamente.
* Debe mostrar entradas y salidas.
* Debe mostrar costo unitario.
* Debe mostrar saldo físico.
* Debe mostrar valor del inventario.
* No debe permitir modificar el historial mediante este endpoint.
* Los movimientos deben ser inmutables.
* Debe respetar el tenant y la bodega correspondiente.

---

# HU-10 — Consultar alertas de stock mínimo

**Como** administrador del negocio,
**quiero** consultar los productos cuyo inventario está por debajo del mínimo configurado,
**para** identificar productos que requieren reposición.

### Endpoint

```http
GET /api/v1/inventory/stock-alerts
```

### Parámetros opcionales

```http
GET /api/v1/inventory/stock-alerts?warehouseId=uuid
```

Opcionalmente:

```http
GET /api/v1/inventory/stock-alerts?warehouseId=uuid&search=cemento
```

### Respuesta

```json
{
  "data": [
    {
      "productId": "uuid",
      "sku": "PNT-034",
      "barcode": "7701234567892",
      "name": "Pintura Vinilo Blanco 1 Galón",
      "unitOfMeasure": "GALON",
      "warehouseId": "uuid",
      "warehouseName": "Bodega Principal Centro",
      "currentStock": 4.000,
      "minimumStock": 5.000,
      "shortage": 1.000,
      "salePrice": 58000.00
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Criterios de aceptación

* Debe devolver productos cuyo stock esté por debajo del umbral configurado.
* Debe permitir filtrar por bodega.
* Debe mostrar existencia actual.
* Debe mostrar el mínimo configurado.
* Debe calcular cuánto falta para alcanzar el mínimo.
* Debe respetar el tenant.
* No debe modificar inventario.

---

# Resumen de endpoints del motor de inventarios (Squad 3)

| Método | Endpoint | Historia / Alcance | Roles Permitidos | Escuadrones Consumidores | Estado |
| :---: | :--- | :---: | :---: | :---: | :---: |
| `GET` | `/api/v1/inventory/products` | **HU-01** (Búsqueda y catálogo) | Todos autenticados | Squad 4 (Web POS), Squad 5 (Mobile) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/products` | **HU-02** (Crear producto) | `OWNER`, `ADMIN` | Squad 4 (Admin Catálogo) | **PASS (100%)** |
| `PATCH` | `/api/v1/inventory/products/:id` | **HU-03** (Actualizar comercial) | `OWNER`, `ADMIN` | Squad 4 (Admin Catálogo) | **PASS (100%)** |
| `GET` | `/api/v1/inventory/products/:id` | **HU-01/HU-03** (Detalle y desglose por bodega) | Todos autenticados | Squad 4 (POS), Squad 5 (Mobile) | **PASS (100%)** |
| `GET` | `/api/v1/inventory/warehouses` | **HU-04** (Listar bodegas activas) | Todos autenticados | Squad 4, 5, 7 | **PASS (100%)** |
| `POST` | `/api/v1/inventory/moves/dispatch` | **HU-05** (Despacho por venta) | `OWNER`, `ADMIN`, `WAREHOUSE`, `CASHIER` | Squad 4 (Web POS), Squad 5 (Mobile) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/moves/receive` | **HU-06** (Recepción compra y CPP) | `OWNER`, `ADMIN`, `WAREHOUSE` | Squad 7 (Compras) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/moves/reverse` | **HU-07** (Reversión compensatoria) | `OWNER`, `ADMIN` | Squad 4 (Anulaciones POS) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/transfers` | **HU-08** (Traslado directo / inicio tránsito) | `OWNER`, `ADMIN`, `WAREHOUSE` | Squad 4 (Admin Inventario) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/transfers/:id/receive` | **HU-08 / EXT-2** (Confirmar recepción en destino) | `OWNER`, `ADMIN`, `WAREHOUSE` | Squad 4 (Bodega Destino) | **PASS (100%)** |
| `GET` | `/api/v1/inventory/kardex/:productId` | **HU-09** (Kardex oficial CPP) | Todos autenticados | Squad 6 (Reportes), Squad 2 (Ledger) | **PASS (100%)** |
| `GET` | `/api/v1/inventory/stock-alerts` | **HU-10** (Alertas stock mínimo) | Todos autenticados | Squad 4 (Dashboard POS), Admin | **PASS (100%)** |
| `POST` | `/api/v1/inventory/stock-counts` | **EXT-1** (Crear sesión toma física) | `OWNER`, `ADMIN`, `WAREHOUSE` | Squad 4 (Auditoría de Inventario) | **PASS (100%)** |
| `POST` | `/api/v1/inventory/stock-counts/:id/apply` | **EXT-1** (Aplicar ajustes sobrante/faltante) | `OWNER`, `ADMIN` | Squad 4 (Ajustes Físicos) | **PASS (100%)** |

---

## Dependencias y responsabilidades de integración

### Squad 3 — Inventory Engine, Multi-Bodega & Kardex CPP
Es responsable y garante de:
* Existencias físicas y lógicas por producto, variante y bodega.
* Aislamiento estricto multi-tenant garantizado por PostgreSQL 16 con `FORCE ROW LEVEL SECURITY`.
* Valuación en tiempo real del Costo Promedio Ponderado (CPP) según norma NIIF/NIC 2 con aritmética de alta precisión `Decimal.js`.
* Kardex formal cronológico e inmutable con trazabilidad documental.
* Traslados directos y en dos fases (en tránsito) entre bodegas.
* Tomas físicas y ajustes controlados de inventario (sobrantes/faltantes).
* Alertas preventivas de stock mínimo.
* Prevención estricta de stock negativo mediante concurrencia pesimista (`SELECT FOR UPDATE`).
* Idempotencia transaccional mediante cabeceras `Idempotency-Key` y `X-Idempotency-Key`.

### Matriz de Consumo Inter-Squad:
* **Squad 4 — Web POS:** Consume el catálogo de productos (`GET /products`), consulta de bodegas (`GET /warehouses`), despachos automáticos en venta (`POST /moves/dispatch`), reversas ante anulación (`POST /moves/reverse`), y alertas de stock (`GET /stock-alerts`).
* **Squad 5 — Mobile POS:** Mismos contratos que Web POS con soporte para reintentos idempotentes ante caídas de conexión móvil.
* **Squad 7 — Compras:** Consume la recepción física de mercancía (`POST /moves/receive`), alimentando el inventario y actualizando el CPP ponderado.
* **Squad 2 — Motor Contable NIIF:** Consume el costo unitario/total devuelto por los movimientos y el historial de Kardex (`GET /kardex/:productId`) para asentar el Costo de Mercancía Vendida (CMV).
* **Squad 6 — Reportes Financieros:** Consume el Kardex valorizado (`GET /kardex/:productId`) y alertas de inventario para balances contables.

---

## Reglas transversales verificadas

Todas las operaciones transaccionales cumplen estrictamente las siguientes invariantes:

1. **Aislamiento Multi-Tenant (RLS):** Toda consulta y mutación ejecuta bajo `SET LOCAL app.current_tenant_id` y las políticas `USING (tenant_id = ...)`. Los intentos de acceso entre tenants retornan `404 Not Found`.
2. **Precisión Matemática Decimal:** Cero operaciones de coma flotante (`float`) en moneda o existencias. Se utiliza `Decimal.js` en dominio y `NUMERIC` en base de datos (6 decimales para costos unitarios, 4 decimales para cantidades y saldos monetarios).
3. **Trazabilidad Documental Inmutable:** Ningún movimiento ni asiento de Kardex se borra o actualiza físicamente.
4. **Reversiones Compensatorias:** La corrección de movimientos se realiza mediante contra-asientos vinculados (`isReversed = true`, generación de `INVENTORY_REVERSAL`).
5. **Concurrencia Pesimista:** Bloqueo `SELECT ... FOR UPDATE OF b` a nivel de fila en `inventory_balances`, con ordenamiento determinístico por `(productId, variantId)` para evitar deadlocks.
6. **Prevención de Stock Negativo:** Ninguna operación permite existencias menores a cero; rechaza con código `400` / `409` (`INSUFFICIENT_STOCK`).
7. **Idempotencia Transaccional:** Registro en tabla `inventory_idempotency_keys` para reintentos seguros sin duplicación de stock.
8. **Seguridad RBAC y Sesiones:** Validación JWT con `jti` activo en Redis y autorización basada en roles (`OWNER`, `ADMIN`, `WAREHOUSE`, `CASHIER`, `ACCOUNTANT`).

---

## Matriz de Trazabilidad de Pruebas (Auditoría Final Integral)

| Historia | Endpoint Principal | Pruebas Unitarias / Dominio / Aplicación | Escenario E2E Real (`test/e2e/functional-audit.spec.ts`) | Criterio Clave Verificado | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **HU-01** | `GET /api/v1/inventory/products` | `queries.service.spec.ts`, `product.service.spec.ts` | **Escenario 2:** Listado con paginación, filtros y aislamiento tenant | Búsqueda por SKU, nombre, código de barras, stock disponible y paginación | **PASS** |
| **HU-02** | `POST /api/v1/inventory/products` | `product.service.spec.ts`, `product.spec.ts` | **Escenario 2:** Creación de producto con variante default y rechazo SKU duplicado | Validación de SKU único por tenant, variantes y RBAC | **PASS** |
| **HU-03** | `PATCH /api/v1/inventory/products/:id` | `product.service.spec.ts` | **Escenario 2:** Actualización de precios y datos comerciales | Modificación segura sin tocar movimientos ni historial | **PASS** |
| **HU-04** | `GET /api/v1/inventory/warehouses` | `warehouse.service.spec.ts`, `warehouse.spec.ts` | **Escenario 3:** Listado de bodegas activas del tenant autenticado | Filtro estricto por tenant y estado operativo | **PASS** |
| **HU-05** | `POST /api/v1/inventory/moves/dispatch` | `inventory-dispatch.service.spec.ts`, `inventory-balance.spec.ts` | **Escenarios 5 y 14:** Despacho atómico a costo CPP y rechazo ante stock insuficiente | Concurrencia pesimista, prevención de stock negativo e idempotencia | **PASS** |
| **HU-06** | `POST /api/v1/inventory/moves/receive` | `inventory-receive.service.spec.ts`, `precision-policy.spec.ts` | **Escenario 4:** Recepción y cálculo matemático exacto de CPP NIIF | Recálculo de costo promedio ponderado exacto y registro Kardex | **PASS** |
| **HU-07** | `POST /api/v1/inventory/moves/reverse` | `inventory-reverse.service.spec.ts`, `inventory-movement.spec.ts` | **Escenario 6:** Reversión compensatoria e inmutabilidad histórica | Creación de contra-asiento, restauración de saldo y auditoría | **PASS** |
| **HU-08** | `POST /api/v1/inventory/transfers` | `inventory-transfer.service.spec.ts`, `inventory-transfer.spec.ts` | **Escenario 7:** Traslado directo y en dos fases (en tránsito y recepción) | Atomicidad, dos fases, validación de bodegas del mismo tenant | **PASS** |
| **HU-09** | `GET /api/v1/inventory/kardex/:productId` | `queries.service.spec.ts`, `inventory-ledger-entry.spec.ts` | **Escenario 10:** Histórico cronológico ordenado del Kardex oficial CPP | Trazabilidad completa de entradas, salidas, costos y saldos | **PASS** |
| **HU-10** | `GET /api/v1/inventory/stock-alerts` | `queries.service.spec.ts` | **Escenario 9:** Detección de productos bajo umbral mínimo configurado | Cálculo exacto de faltante (`shortage`), filtro por bodega | **PASS** |
| **EXT-1** | `POST /api/v1/inventory/stock-counts` | `stock-count.service.spec.ts`, `stock-count.spec.ts` | **Escenario 8:** Creación de sesión física y aplicación de ajustes por faltante/sobrante | Toma física de inventario, snapshot de stock y balanceo | **PASS** |
| **EXT-2** | `POST /api/v1/inventory/transfers/:id/receive` | `inventory-transfer.service.spec.ts` | **Escenario 7:** Confirmación y recepción de traslado en bodega destino | Cierre de transferencias en dos fases con actualización en destino | **PASS** |

---

## Veredicto Final de Historias de Usuario

Todas las historias de usuario de los requerimientos originales (**HU-01 a HU-10**) y las extensiones transaccionales (**EXT-1 y EXT-2**) se encuentran **100% IMPLEMENTADAS, VALIDADAS MEDIANTE PRUEBAS AUTOMATIZADAS Y AUDITADAS EN AMBIENTE REAL**.
