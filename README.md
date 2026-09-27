# SISTEMA SAAS EMPRESARIAL CONTABLE, POS Y GESTIÓN COMERCIAL MULTI-TENANT
## ESCUADRÓN 3: INVENTORY ENGINE, MULTI-BODEGA & KARDEX PROMEDIO PONDERADO (CPP API)
### DIPLOMADO DE OPCIÓN DE GRADO EN DESARROLLO DE SOFTWARE 4.0 (MÓDULOS 4 Y 5)
**Institución Universitaria del Putumayo - UniPutumayo (Sede Mocoa)**  
**Facultad de Tecnologías de la Información y la Comunicación**  
**Programa Académico:** Tecnología en Desarrollo de Software (VI Semestre)  
**Docente Titular y Arquitecto Principal:** Anderson Stiven Moncayo Bermeo  
**Espacio de Prácticas:** Sala de Cómputo 121 - Campus UniPutumayo  
**Población Asignada:** 4 Estudiantes (Scrum Autónomo)  
**Tipo de Entregable:** API Backend Autónoma (NestJS / TypeScript / PostgreSQL 16 con RLS)  

---

## 1. MISIÓN Y ALCANCE INDIVIDUAL DEL ESCUADRÓN

Desarrollar la API del motor de inventario multi-bodega con soporte nativo para artículos fraccionarios (metros, kilos, litros, galones, bultos), variantes de productos, bloqueo pesimista de concurrencia (SELECT FOR UPDATE) y la generación inmutable del kardex valorizado mediante Costo Promedio Ponderado (CPP).

### Reglas Sagradas del Proyecto
1. **Cero Inteligencia Artificial y Cero OCR:** El sistema es 100% transaccional, determinista y auditado. Prohibido el uso de modelos probabilistas o IA predictiva en el código de producción.
2. **Inmutabilidad Financiera NIIF:** Prohibido el borrado destructivo (DELETE) en asientos contables, comprobantes o inventarios. Toda corrección se realiza mediante contra-asientos reversibles auditados.
3. **Delimitación Fiscal:** El sistema gestiona Facturación Comercial Interna, Comprobantes POS y Recibos de Caja. No incluye facturación electrónica DIAN externa.
4. **Aislamiento Multi-Tenant Estricto:** Forzado en PostgreSQL 16 con Row Level Security (RLS) e inyección obligatoria de SET LOCAL app.current_tenant_id.

---

## 2. INSTRUCCIONES DE CLONACIÓN Y ARRANQUE DE SU REPOSITORIO

Cada integrante de este escuadrón debe clonar su propio repositorio de trabajo independiente:

```bash
# 1. Clonar el repositorio oficial de su escuadron
git clone https://github.com/saas-uniputumayo/squad3_inventory_kardex_cpp.git
cd squad3_inventory_kardex_cpp

# 2. Configurar variables de entorno locales
cp .env.example .env

# 3. Instalar dependencias del proyecto
pnpm install

# 4. Iniciar el servicio en modo desarrollo
pnpm dev
```

---

## 3. ROLES INTERNOS DEL ESCUADRÓN (SCRUM AUTÓNOMO - 4 ESTUDIANTES)

* **Squad Lead & Scrum Master:**  Coordina los contratos de salida de stock con los líderes de Ventas (E4/E5) y las recepciones físicas con Compras (E7), moderando el Daily.
* **Kardex & Math Specialist:**  Implementa la fórmula matemática del Costo Promedio Ponderado (CPP) y el registro inmutable de movimientos en stock_moves.
* **Catalog & Multi-Warehouse Specialist:**  Modela productos, unidades de medida fraccionarias, catálogo de bodegas y traslados seguros entre sucursales.
* **QA & Concurrency Specialist:**  Escribe pruebas de concurrencia pesimista (SELECT FOR UPDATE) para validar que dos ventas simultáneas sobre el último ítem disponible no generen inventario negativo.

---

## 4. CONTRATOS DE INTEGRACIÓN INTER-ESCUADRÓN (METODOLOGÍA HEXAGONAL)

Este repositorio opera como una API o aplicación completamente autónoma. Una vez completada, sus endpoints serán compartidos y consumidos por los otros escuadrones:

### A. Endpoints y Servicios que este Escuadrón EXPONE para los demás
* `GET /api/v1/inventory/products`:  Catalogo de productos con existencias en tiempo real, precios de venta y filtro por SKU, nombre o codigo de barras.
* `POST /api/v1/inventory/products`:  Creacion de producto maestro con definicion de unidad fraccionaria (kg, m, lt, un, bulto).
* `PATCH /api/v1/inventory/products/`: id
* `GET /api/v1/inventory/warehouses`:  Listado de bodegas de almacenamiento de la sucursal.
* `POST /api/v1/inventory/moves/dispatch`:  Despacho atomico de inventario por venta POS con bloqueo pesimista (SELECT FOR UPDATE). Retorna costo unitario exacto.
* `POST /api/v1/inventory/moves/receive`:  Recepcion fisica de mercancia por compra a proveedor; recalcula automaticamente el Costo Promedio Ponderado (CPP).
* `POST /api/v1/inventory/moves/reverse`:  Reversa una salida por anulacion auditada y reingresa el stock sin borrar el historico.
* `POST /api/v1/inventory/transfers`:  Traslado formal de mercancia entre dos bodegas autorizadas.
* `GET /api/v1/inventory/kardex/`: productId

### B. Endpoints y Servicios que este Escuadrón CONSUME de los demás
* GET /api/v1/auth/me (Escuadron 1): Validacion de sesion y tenantId.

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
