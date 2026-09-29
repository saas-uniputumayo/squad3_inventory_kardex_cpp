# Historias de Usuario — Integración Squad 4 con Inventory E3

> Alcance: únicamente funcionalidades del frontend Web/POS de Squad 4 que requieren consumir endpoints pertenecientes al Escuadrón 3 — Inventory Engine, Multi-Bodega & Kardex CPP.
>
> No se incluyen autenticación, login, permisos ni operaciones exclusivamente locales del frontend.

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

# Resumen de endpoints utilizados por Squad 4

| Método | Endpoint                              | Historia |
| ------ | ------------------------------------- | -------- |
| GET    | `/api/v1/inventory/products`          | HU-01    |
| POST   | `/api/v1/inventory/products`          | HU-02    |
| PATCH  | `/api/v1/inventory/products/:id`      | HU-03    |
| GET    | `/api/v1/inventory/warehouses`        | HU-04    |
| POST   | `/api/v1/inventory/moves/dispatch`    | HU-05    |
| POST   | `/api/v1/inventory/moves/receive`     | HU-06    |
| POST   | `/api/v1/inventory/moves/reverse`     | HU-07    |
| POST   | `/api/v1/inventory/transfers`         | HU-08    |
| GET    | `/api/v1/inventory/kardex/:productId` | HU-09    |
| GET    | `/api/v1/inventory/stock-alerts`      | HU-10    |

## Dependencias y responsabilidades

### Squad 3 — Inventory

Es responsable de:

* Existencias.
* Bodegas.
* Movimientos.
* CPP.
* Kardex.
* Traslados.
* Alertas de stock.
* Concurrencia.
* Idempotencia de operaciones de inventario.

### Squad 4 — Web POS

Consume principalmente:

* Consulta de productos.
* Consulta de bodegas.
* Despacho de inventario después/durante la confirmación de venta.
* Alertas para interfaces administrativas.

### Squad 5 — Mobile POS

Puede consumir los mismos contratos para:

* Consulta de productos.
* Consulta de stock.
* Despacho de inventario.
* Operaciones offline con posterior sincronización e idempotencia.

### Squad 7 — Compras

Consume:

```http
POST /api/v1/inventory/moves/receive
```

para registrar físicamente las mercancías recibidas.

### Squad 6 — Reportes

Consume:

```http
GET /api/v1/inventory/kardex/:productId
```

para construir reportes históricos y valorizados.

---

## Reglas transversales

Todas las operaciones transaccionales deben:

1. Respetar el tenant actual mediante RLS.
2. Utilizar cantidades decimales.
3. Evitar `float` para cálculos monetarios.
4. Utilizar `Decimal.js` en la capa de dominio.
5. Mantener la trazabilidad documental.
6. Utilizar `X-Idempotency-Key` cuando la operación pueda ser reintentada.
7. No eliminar movimientos históricos.
8. Utilizar reversas para corregir movimientos.
9. Proteger las modificaciones concurrentes mediante transacciones y `SELECT FOR UPDATE`.
10. Rechazar operaciones que generen stock negativo.
11. Mantener separados el precio de venta y el CPP.
12. Mantener el aislamiento por tenant.

---

## Nuevas historias detectadas en la actualización del README

La única historia completamente nueva introducida explícitamente por el profesor es:

> **HU-10 — Consultar alertas de stock mínimo**

El resto de cambios del README principalmente **amplían los criterios de aceptación de historias que ya teníamos**, especialmente:

* búsqueda por SKU/nombre/código de barras;
* despacho asociado a venta POS;
* recepción asociada a compra;
* reversa auditada;
* traslados entre bodegas autorizadas;
* idempotencia;
* soporte fraccionario;
* bloqueo `SELECT FOR UPDATE`.
