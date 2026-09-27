# SISTEMA SAAS EMPRESARIAL CONTABLE, POS Y GESTIÓN COMERCIAL MULTI-TENANT
## ESCUADRÓN 3: INVENTORY ENGINE, MULTI-BODEGA & KARDEX PROMEDIO PONDERADO (CPP API)
### DIPLOMADO DE OPCIÓN DE GRADO EN DESARROLLO DE SOFTWARE 4.0 (MÓDULOS 4 Y 5)
**Institución Universitaria del Putumayo - UniPutumayo (Sede Mocoa)**  
**Facultad de Tecnologías de la Información y la Comunicación**  
**Programa Académico:** Tecnología en Desarrollo de Software (VI Semestre)  
**Docente Titular y Arquitecto Principal:** Anderson Stiven Moncayo Bermeo  
**Espacio de Prácticas:** Sala de Cómputo 121 - Campus UniPutumayo  
**Población Asignada:** 4 Estudiantes (Scrum Autónomo)  
**Tipo de Entregable:** API Backend Autónoma (NestJS / TypeScript / PostgreSQL 16 con RLS / Decimal.js)  

---

## 1. MISIÓN Y ALCANCE INDIVIDUAL DEL ESCUADRÓN

Desarrollar la API del motor de inventario multi-bodega con soporte nativo para artículos fraccionarios (metros, kilos, litros, galones, bultos), variantes de productos, bloqueo pesimista de concurrencia (SELECT FOR UPDATE) y la generación inmutable del kardex valorizado mediante Costo Promedio Ponderado (CPP).

### Reglas Sagradas del Proyecto
1. **Cero Inteligencia Artificial y Cero OCR:** El sistema es 100% transaccional, determinista y auditado. Prohibido el uso de modelos probabilistas o IA predictiva en el código de producción.
2. **Inmutabilidad Financiera NIIF:** Prohibido el borrado destructivo (DELETE) en asientos contables, comprobantes o inventarios. Toda corrección se realiza mediante contra-asientos reversibles auditados.
3. **Delimitación Fiscal:** El sistema gestiona Facturación Comercial Interna, Comprobantes POS y Recibos de Caja. No incluye facturación electrónica DIAN externa.
4. **Aislamiento Multi-Tenant Estricto:** Forzado en PostgreSQL 16 con Row Level Security (RLS) e inyección obligatoria de SET LOCAL app.current_tenant_id.

### Estrategia de Persistencia Centralizada Multi-Módulo
El sistema SaaS Contable opera con una **única base de datos PostgreSQL 16 centralizada** y un cluster de **Redis 7** orquestados por el Escuadrón 8 (DevOps). El aislamiento entre empresas es total y criptográfico mediante **Row Level Security (RLS)** forzado con `SET LOCAL app.current_tenant_id`.
Cada escuadrón es dueño absoluto del diseño y evolución de sus tablas asignadas, pero la co-ubicación física en la misma base de datos garantiza transacciones ACID atómicas, consistencia referencial y cero latencia de replicación entre módulos contables.

---

## 2. INSTRUCCIONES DE CLONACIÓN Y ARRANQUE DE SU REPOSITORIO

Cada integrante de este escuadrón debe clonar su propio repositorio de trabajo independiente:

```bash
cp .env.example .env
pnpm install
pnpm dev
```

### Archivo de Variables de Entorno (`.env.example`)
Asegúrese de contar con las siguientes variables configuradas en su archivo local `.env`:

```env
PORT=3003
NODE_ENV=development
DATABASE_URL=postgresql://saas_admin:saas_secure_password_2026@localhost:5432/saas_contable_db
AUTH_SERVICE_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000
```

---

## 3. ROLES INTERNOS DEL ESCUADRÓN (SCRUM AUTÓNOMO - 4 ESTUDIANTES)

* **Squad Lead & Scrum Master:**  Coordina los contratos de salida de stock con los lideres de Ventas (E4/E5) y las recepciones fisicas con Compras (E7), moderando el Daily.
* **Kardex & Math Specialist:**  Implementa la formula matematica del Costo Promedio Ponderado (CPP) y el registro inmutable de movimientos en stock_moves.
* **Catalog & Multi-Warehouse Specialist:**  Modela productos, unidades de medida fraccionarias, catalogo de bodegas y traslados seguros entre sucursales.
* **QA & Concurrency Specialist:**  Escribe pruebas de concurrencia pesimista (SELECT FOR UPDATE) para validar que dos ventas simultaneas sobre el ultimo item disponible no generen inventario negativo.

---

## 4. CONTRATOS DE INTEGRACIÓN INTER-ESCUADRÓN (METODOLOGÍA HEXAGONAL)

Este repositorio opera como una API o aplicación completamente autónoma. Una vez completada, sus endpoints serán compartidos y consumidos por los otros escuadrones:

### A. Endpoints y Servicios que este Escuadrón EXPONE para los demás
* `GET /api/v1/inventory/products`: Catalogo de productos con existencias en tiempo real, precios de venta y filtro por SKU, nombre o codigo de barras.
* `POST /api/v1/inventory/products`: Creacion de producto maestro con definicion de unidad fraccionaria (kg, m, lt, un, bulto).
* `PATCH /api/v1/inventory/products/:id`: Actualizacion de precios de venta, costos base y umbrales de stock minimo.
* `GET /api/v1/inventory/warehouses`: Listado de bodegas de almacenamiento habilitadas por sucursal.
* `POST /api/v1/inventory/moves/dispatch`: Despacho atomico de inventario por venta POS con bloqueo pesimista (SELECT FOR UPDATE). Retorna costo unitario exacto.
* `POST /api/v1/inventory/moves/receive`: Recepcion fisica de mercancia por compra a proveedor; recalcula automaticamente el Costo Promedio Ponderado (CPP).
* `POST /api/v1/inventory/moves/reverse`: Reversa una salida por anulacion auditada y reingresa el stock sin borrar el historico.
* `POST /api/v1/inventory/transfers`: Traslado formal de mercancia entre dos bodegas autorizadas con documento de remision.
* `GET /api/v1/inventory/kardex/:productId`: Historial cronologico inmutable de movimientos de kardex valorizado para un producto.
* `GET /api/v1/inventory/stock-alerts`: Listado de productos con stock actual inferior al umbral minimo configurado.

### B. Endpoints y Servicios que este Escuadrón CONSUME de los demás
* GET /api/v1/auth/me (Escuadron 1): Validacion de sesion y tenantId en cada operacion de bodega.

---

## 5. ARQUITECTURA HEXAGONAL Y ESTRUCTURA DE ARCHIVOS

Su código debe estructurarse estrictamente bajo el patrón concéntrico de Arquitectura Hexagonal (Puertos y Adaptadores):

```
src/
├── domain/
│   └── entities/
│       ├── product.entity.ts
│       ├── warehouse.entity.ts
│       ├── stock-quant.entity.ts
│       └── stock-move.entity.ts
├── application/
│   ├── ports/
│   │   ├── in/
│   │   │   ├── dispatch-stock.use-case.ts
│   │   │   ├── receive-stock.use-case.ts
│   │   │   ├── transfer-stock.use-case.ts
│   │   │   └── get-kardex.use-case.ts
│   │   └── out/
│   │       ├── product-repository.port.ts
│   │       └── stock-repository.port.ts
│   └── services/
│       └── kardex.service.ts
└── infrastructure/
    ├── adapters/
    │   ├── in/
    │   │   ├── inventory.controller.ts
    │   │   └── warehouses.controller.ts
    │   └── out/
    │       ├── postgres-inventory.repository.ts
    │       └── postgres-warehouse.repository.ts
    └── inventory.module.ts
```

* **Dominio (`domain/`):** Contiene las entidades puras y las reglas matemáticas y de negocio. Cero dependencias de TypeORM, NestJS o librerías externas.
* **Puertos de Entrada (`application/ports/in/`):** Interfaces que declaran los casos de uso que expone esta API hacia el exterior.
* **Puertos de Salida (`application/ports/out/`):** Interfaces que declaran qué requiere este servicio (persistencia, caché o clientes HTTP de otros escuadrones).
* **Adaptadores de Entrada (`infrastructure/adapters/in/`):** Controladores REST que exponen las rutas HTTP y validan los DTOs.
* **Adaptadores de Salida (`infrastructure/adapters/out/`):** Repositorios PostgreSQL, adaptadores de Redis o drivers específicos.

---

## 6. ESPECIFICACIÓN DE BASE DE DATOS (DDL, ÍNDICES Y POLÍTICAS RLS)

```sql
-- 8. BODEGAS
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_tenant_warehouse_code UNIQUE (tenant_id, code)
);

-- 9. PRODUCTOS MAESTROS (CON UNIDADES FRACCIONARIAS)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) DEFAULT 'GENERAL',
    unit_of_measure VARCHAR(20) DEFAULT 'UNIDAD', -- 'UNIDAD', 'METRO', 'KILO', 'LITRO', 'BULTO'
    cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    wholesale_price NUMERIC(15, 2),
    tax_rate NUMERIC(5, 2) DEFAULT 0.19,
    min_stock_alert NUMERIC(12, 3) DEFAULT 5.000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_product_sku UNIQUE (tenant_id, sku)
);

-- 10. SALDOS DE INVENTARIO EN BODEGA (STOCK QUANTS)
CREATE TABLE stock_quants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    reserved_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_prod_warehouse UNIQUE (tenant_id, product_id, warehouse_id)
);

-- 11. KARDEX INMUTABLE (STOCK MOVES)
CREATE TABLE stock_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('PURCHASE_RECEIPT', 'SALE_DISPATCH', 'TRANSFER_IN', 'TRANSFER_OUT', 'SHRINKAGE_LOSS', 'VOID_RETURN')),
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 4) NOT NULL,
    total_cost NUMERIC(15, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
    previous_stock NUMERIC(12, 3) NOT NULL,
    new_stock NUMERIC(12, 3) NOT NULL,
    reference_document VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_quants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;

ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_quants FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_moves FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_warehouses ON warehouses FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
CREATE POLICY tenant_isolation_products ON products FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
CREATE POLICY tenant_isolation_quants ON stock_quants FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
CREATE POLICY tenant_isolation_moves ON stock_moves FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```

---

## 7. ESPECIFICACIÓN VISUAL Y CROQUIS DE PANTALLA (WIREFRAMES ASCII)

```
Croquis: Gestion Multi-Bodega y Kardex Inmutable (CPP)
+---------------------------------------------------------------------------------------------------------+
| GESTION MULTI-BODEGA Y KARDEX INMUTABLE (CPP)                                                            |
+---------------------------------------------------------------------------------------------------------+
| Bodega Activa: [ Bodega Principal Centro (BOD-01) v ]  |  [ + Nuevo Producto ]  [ Traslado ]  [ Merma ] |
+---------------------------------------------------------------------------------------------------------+
| SKU      | CODIGO BARRAS | PRODUCTO               | UNIDAD | COSTO CPP  | PRECIO DET | EXISTENCIA | ESTADO    |
+----------+---------------+------------------------+--------+------------+------------+------------+-----------+
| CEM-001  | 7701234567890 | Cemento Gris Argos     | BULTO  | $ 24.500   | $ 32.000   |    145.000 | NORMAL    |
| CAB-008  | 7701234567891 | Cable Cobre THHN #12   | METRO  | $  3.100   | $  4.200   |    850.500 | NORMAL    |
| PNT-034  | 7701234567892 | Pintura Vinilo Blanco  | GALON  | $ 42.000   | $ 58.000   |      4.000 | BAJO STOCK|
| VAR-004  | 7701234567893 | Varilla Corrugada 1/2  | UNIDAD | $ 14.200   | $ 18.000   |     82.000 | NORMAL    |
+----------+---------------+------------------------+--------+------------+------------+------------+-----------+
| HISTORIAL DE KARDEX: Cemento Gris Argos (CEM-001)                                                        |
| Fecha        | Tipo Movimiento    | Doc Ref     | Cantidad    | Costo Unit   | Saldo Fisico | Saldo Valor |
| 2026-09-24   | COMPRA_RECEPCION   | FAC-9821    | +100 bultos | $ 24.000.00  | 170.000 bult | $4.080.000  |
| 2026-09-25   | VENTA_POS          | POS-000412  |  -25 bultos | $ 24.500.00  | 145.000 bult | $3.552.500  |
+---------------------------------------------------------------------------------------------------------+
```

---

## 8. CÓDIGO Y LÓGICA DE PRODUCCIÓN DE REFERENCIA

```typescript
// Formula Matematica del Costo Promedio Ponderado (CPP)
import Decimal from 'decimal.js';

export function calculateNewWeightedAverageCost(
  currentStock: number,
  currentUnitCost: number,
  incomingQuantity: number,
  incomingUnitCost: number
): number {
  const stockAct = new Decimal(currentStock);
  const costAct = new Decimal(currentUnitCost);
  const qtyIn = new Decimal(incomingQuantity);
  const costIn = new Decimal(incomingUnitCost);

  const totalCurrentValue = stockAct.times(costAct);
  const totalIncomingValue = qtyIn.times(costIn);
  const newTotalStock = stockAct.plus(qtyIn);

  if (newTotalStock.isZero()) return currentUnitCost;

  const newCpp = totalCurrentValue.plus(totalIncomingValue).dividedBy(newTotalStock);
  return Number(newCpp.toFixed(4));
}
```

---

## 9. DEFINITION OF DONE (DoD) Y DEMOSTRACIÓN EN VIVO (SALA 121)

Al momento de sustentar ante el docente titular Anderson Stiven Moncayo Bermeo, su escuadrón debe demostrar en vivo en menos de 60 segundos:

- [ ] Registrar una compra con nuevo costo y demostrar que el CPP en products se recalcula exactamente segun la formula matematica.
- [ ] Demostrar la inmutabilidad de stock_moves (cero UPDATE y cero DELETE).
- [ ] Ejecutar una prueba de dos ventas simultaneas para el ultimo item en stock y validar que SELECT FOR UPDATE bloquea una de ellas y evita inventario negativo.
- [ ] Verificar soporte nativo de cantidades fraccionarias (ejemplo: 2.750 metros de cable o 1.500 kilos de puntillas).

---

## 10. DIAGRAMA DE SECUENCIA Y ORQUESTACIÓN TRANSACCIONAL

```

Secuencia de Despacho con Bloqueo Pesimista (SELECT FOR UPDATE) anti stock-negativo:
+-----------+            +-------------------+            +---------------+            +------------------+
| E4/E5 POS |            | E3: Inventory API |            | PostgreSQL 16 |            | Fila stock_quant |
+-----+-----+            +---------+---------+            +-------+-------+            +--------+---------+
      |                            |                              |                             |
      | 1. POST /moves/dispatch    |                              |                             |
      |--------------------------->|                              |                             |
      |                            | 2. BEGIN TRANSACTION         |                             |
      |                            |----------------------------->|                             |
      |                            | 3. SELECT FOR UPDATE (Bloqueo pesimista fila)              |
      |                            |----------------------------------------------------------->| (LOCKED)
      |                            | 4. Si quantity_on_hand < qty_solicitada:                   |
      |                            |    ROLLBACK y responde HTTP 409 Conflicto Stock            |
      |                            | 5. Si hay stock suficiente:                                |
      |                            |    Deduce saldo: qty_on_hand - qty_solicitada              |
      |                            |----------------------------------------------------------->|
      |                            | 6. Inserta movimiento inmutable en stock_moves             |
      |                            |----------------------------->|                             |
      |                            | 7. COMMIT TRANSACTION                                      |
      |                            |----------------------------------------------------------->| (UNLOCKED)
      |<---------------------------| 8. Retorna HTTP 201 + Costo Unitario Exacto para E2        |
+-----+-----+            +-------------------+            +---------------+            +------------------+

```

---

## 11. GLOSARIO DE NEGOCIO Y CONCEPTOS CLAVE

* **Partida Doble (NIIF):** Principio contable universal donde todo registro financiero afecta al menos dos cuentas contables. La suma de los Débitos debe ser idéntica a la suma de los Créditos (`Debitos - Creditos == 0.00`). No existe deudor sin acreedor.
* **PUC (Plan Único de Cuentas):** Catálogo jerárquico oficial que codifica las cuentas en Colombia: Clase 1 (Activo), Clase 2 (Pasivo), Clase 3 (Patrimonio), Clase 4 (Ingresos), Clase 5 (Gastos), Clase 6 (Costos de Ventas).
* **CPP (Costo Promedio Ponderado):** Método de valoración de inventarios donde el costo unitario de un producto se recalcula en cada compra entrante: `Nuevo_CPP = (Saldo_Valor_Actual + Costo_Total_Entrada) / (Saldo_Cantidad_Actual + Cantidad_Entrada)`.
* **RLS (Row Level Security):** Característica de seguridad en PostgreSQL que filtra las filas visibles para cada consulta según una variable de sesión (`app.current_tenant_id`), impidiendo que una empresa acceda a datos de otra aún compartiendo la misma tabla.
* **Fiado (Crédito Comercial a Clientes):** Venta realizada a un cliente de confianza con plazo de pago diferido. Requiere validación de cupo máximo autorizado y registro en la cuenta contable 130505 (Clientes Nacionales).
* **Idempotencia (`X-Idempotency-Key`):** Garantía arquitectónica donde una misma petición HTTP repetida múltiples veces (por cortes de red o reintentos) solo se ejecuta una única vez en la base de datos, evitando dobles cobros o dobles salidas de inventario.
* **ESC/POS:** Lenguaje de comandos binarios estandarizado por Epson para controlar impresoras térmicas de tickets (corte de papel, alineación, negrita y apertura de gaveta monedero).


---

## 12. GUIA DE AUTONOMIA Y DESARROLLO AISLADO (SIN DEPENDER DE OTROS ESCUADRONES)

### Principio Arquitectonico: Autonomia mediante Puertos y Adaptadores

Gracias a la Arquitectura Hexagonal, cada escuadron puede compilar, ejecutar y probar su servicio de forma **100% independiente** sin esperar a que los demas equipos terminen de construir sus APIs. El secreto esta en el **intercambio de adaptadores**:

* **Fase 1 (Desarrollo Aislado):** Se inyectan adaptadores Mock/Stub que simulan las respuestas de los servicios externos con datos deterministicos.
* **Fase 2 (Integracion Real):** Se intercambian los adaptadores Mock por adaptadores HTTP reales que apuntan a las URLs de produccion en la nube. **No se modifica ni una sola linea de logica de negocio.**

### Adaptadores Mock para Desarrollo Aislado

E3 solo necesita simular la autenticacion de E1 durante su desarrollo independiente:

```typescript
// infrastructure/adapters/out/mock-auth.adapter.ts
import { AuthPort } from '../../application/ports/out/auth.port';

export class MockAuthAdapter implements AuthPort {
  async verifyToken(token: string) {
    return {
      userId: '00000000-0000-0000-0000-000000000001',
      tenantId: '30000000-0000-0000-0000-000000000003',
      role: 'WAREHOUSE_MANAGER',
    };
  }
}
```

**Intercambio de Adaptador en el Modulo NestJS:**

```typescript
// En desarrollo aislado:
{ provide: AUTH_PORT, useClass: MockAuthAdapter }

// En integracion real:
{ provide: AUTH_PORT, useClass: HttpAuthAdapter }
```

### Pruebas de Concurrencia Aisladas

Las pruebas criticas de SELECT FOR UPDATE pueden ejecutarse localmente contra la base de datos remota sin depender de ningun otro servicio:

```bash
# Ejecutar prueba de bloqueo pesimista con dos transacciones simultaneas
pnpm test:concurrency

# Validar calculo CPP con datos de seed
pnpm test:cpp-calculation
```

---

## 13. AISLAMIENTO DE DATOS: TENANT DEDICADO POR ESCUADRON

Todos los escuadrones comparten la misma base de datos PostgreSQL 16 centralizada. Para evitar colisiones entre los datos de prueba de diferentes equipos, cada escuadron opera dentro de su propio **Tenant (Empresa) pre-sembrado** con un UUID fijo y aislado por Row Level Security (RLS).

### Tenant Asignado a E3

| Propiedad | Valor |
|:---|:---|
| **UUID del Tenant** | `30000000-0000-0000-0000-000000000003` |
| **Nombre Logico** | Tenant Escuadron 3 - Inventario Kardex Dev |
| **Variable de Sesion RLS** | `SET LOCAL app.current_tenant_id = '30000000-0000-0000-0000-000000000003'` |

### Tenant para Sustentacion Final Integrada (Sala 121)

| Propiedad | Valor |
|:---|:---|
| **UUID del Tenant Demo** | `99000000-0000-0000-0000-000000000099` |
| **Nombre** | Tenant DEMO-121 Sustentacion Integrada |
| **Empresa Ficticia** | Ferreteria del Putumayo S.A.S. (NIT: 900.121.121-9) |

El dia de la sustentacion, todos los escuadrones operaran sobre el Tenant `DEMO-121` para demostrar la interoperabilidad completa del sistema.

### Script SQL de Seed para E3

```sql
-- Seed de Tenant dedicado para Escuadron 3
INSERT INTO tenants (id, nit_rut, business_name, trade_name, address, phone, email)
VALUES ('30000000-0000-0000-0000-000000000003', '900.003.003-3', 'Empresa Dev E3 S.A.S.', 'Bodega E3 Dev', 'Sala 121 UniPutumayo', '3001234503', 'e3@uniputumayo.edu.co')
ON CONFLICT (nit_rut) DO NOTHING;

-- Seed de productos de prueba para Kardex y CPP
INSERT INTO products (id, tenant_id, sku, barcode, name, unit_of_measure, cost_price, sale_price, tax_rate) VALUES
('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'CEM-001', '7701234567890', 'Cemento Gris Argos 50kg', 'BULTO', 24500.0000, 32000.00, 0.19),
('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'CAB-008', '7701234567891', 'Cable Cobre THHN #12 Centelsa', 'METRO', 3100.0000, 4200.00, 0.19),
('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'VAR-004', '7701234567893', 'Varilla Corrugada 1/2 pulgada', 'UNIDAD', 14200.0000, 18000.00, 0.19),
('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'PNT-034', '7701234567892', 'Pintura Vinilo Blanco 1 Galon', 'GALON', 42000.0000, 58000.00, 0.19)
ON CONFLICT ON CONSTRAINT uq_tenant_product_sku DO NOTHING;
```

---

## 14. DESPLIEGUE EN LA NUBE Y DOCUMENTACION INTERACTIVA

### URL de Produccion en la Nube

Cada escuadron backend despliega su API como un contenedor autonomo con una URL publica HTTPS:

| Servicio | URL de Produccion |
|:---|:---|
| **E3 (Este Escuadron)** | `https://squad3-inventory.railway.app` |
| E1 - Core Auth | `https://squad1-auth.railway.app` |
| E2 - Motor Contable | `https://squad2-accounting.railway.app` |
| E3 - Inventario Kardex | `https://squad3-inventory.railway.app` |
| E6 - Reportes y Auditoria | `https://squad6-reports.railway.app` |
| E7 - Cartera y Compras | `https://squad7-credits.railway.app` |

### Swagger / OpenAPI Interactivo

Una vez desplegado, la documentacion interactiva Swagger esta disponible en:

```
https://squad3-inventory.railway.app/api/docs
```

Desde ahi, cualquier escuadron companero puede explorar los DTOs de entrada/salida, probar peticiones con "Try it out" y descargar el archivo `swagger.json` para generar clientes tipados automaticamente.

### Configuracion de Variables de Entorno para Integracion

Al pasar de Mocks a la integracion real, actualice las URLs en su archivo `.env` o `.env.local`:

```env
# Apuntar a los servicios reales desplegados en la nube
AUTH_SERVICE_URL=https://squad1-auth.railway.app
ACCOUNTING_SERVICE_URL=https://squad2-accounting.railway.app
INVENTORY_SERVICE_URL=https://squad3-inventory.railway.app
REPORTS_SERVICE_URL=https://squad6-reports.railway.app
CREDITS_SERVICE_URL=https://squad7-credits.railway.app
```

### Matriz de Autonomia del Sistema Completo

| Escuadron | Puede correr solo | Depende de (Mock) | Depende de (Prod) |
|:---|:---|:---|:---|
| **E1** Core Auth | Si, 100% | Ninguno | DB + Redis |
| **E2** Motor Contable | Si, 100% | Mock Auth E1 | E1 Auth |
| **E3** Inventario | Si, 100% | Mock Auth E1 | E1 Auth |
| **E4** Web POS | Si, con Mocks | Mock Auth, Inventario, Contable, Creditos | E1, E2, E3, E6, E7 |
| **E5** Mobile POS | Si, Offline-First | Isar DB local | E1, E3, E7 |
| **E6** Reportes | Si, 100% | Mock Auth, Contable, Inventario | E1, E2, E3 |
| **E7** Cartera | Si, 100% | Mock Auth, Inventario, Contable | E1, E2, E3 |
| **E8** DevOps | Si, 100% | Ninguno | Monitorea E1-E7 |
