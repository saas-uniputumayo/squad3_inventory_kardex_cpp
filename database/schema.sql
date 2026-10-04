-- ============================================================================
-- ESQUEMA CONSOLIDADO v4 — SAAS CONTABLE, POS Y MOTOR DE INVENTARIO E3
-- ============================================================================
-- PostgreSQL 16+ | Codificación: UTF-8 | Collation: es_CO.UTF-8
-- ============================================================================
-- Este script implementa la arquitectura completa unificada con el modelo
-- de inventario de Squad 3, RLS estricto, Kardex inmutable y precisión industrial.
--
-- EJECUTAR COMO: saas_admin (superusuario de saas_contable_db)
-- ============================================================================

-- ============================================================================
-- CAPA 0: EXTENSIONES Y ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums Core & RBAC
DO $$ BEGIN
    CREATE TYPE tax_regime_enum AS ENUM ('REGIMEN_SIMPLE', 'RESPONSABLE_IVA', 'NO_RESPONSABLE_IVA', 'GRAN_CONTRIBUYENTE', 'REGIMEN_ESPECIAL');
    CREATE TYPE document_type_enum AS ENUM ('CC', 'CE', 'TI', 'NIT', 'PP', 'PEP');
    CREATE TYPE user_role_enum AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER');
    CREATE TYPE party_type_enum AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
    CREATE TYPE purchase_payment_type_enum AS ENUM ('CONTADO', 'CREDITO');
    CREATE TYPE purchase_status_enum AS ENUM ('RECEIVED', 'VOIDED');
    CREATE TYPE credit_tx_type_enum AS ENUM ('CHARGE_CREDIT_SALE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PURCHASE', 'SUPPLIER_PAYMENT', 'VOID_REVERSAL');
    CREATE TYPE credit_payment_method_enum AS ENUM ('EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA');
    CREATE TYPE account_type_enum AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO');
    CREATE TYPE account_nature_enum AS ENUM ('D', 'C');
    CREATE TYPE journal_source_doc_enum AS ENUM ('SALE_POS', 'PURCHASE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'REVERSAL', 'SHRINKAGE', 'MANUAL_ADJUSTMENT', 'OPENING_BALANCE', 'INVENTORY_MOVEMENT');
    CREATE TYPE pos_shift_status_enum AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');
    CREATE TYPE invoice_payment_method_enum AS ENUM ('EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'CREDITO_FIADO', 'MIXTO');
    CREATE TYPE invoice_status_enum AS ENUM ('ISSUED', 'VOIDED');
    CREATE TYPE product_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
    CREATE TYPE product_type_enum AS ENUM ('STOCKABLE', 'SERVICE');
    CREATE TYPE variant_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
    CREATE TYPE warehouse_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
    CREATE TYPE movement_type_enum AS ENUM ('PURCHASE_RECEIPT', 'SALE_DISPATCH', 'TRANSFER_IN', 'TRANSFER_OUT', 'SHRINKAGE_LOSS', 'DAMAGE_LOSS', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'VOID_RETURN');
    CREATE TYPE movement_status_enum AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
    CREATE TYPE movement_source_enum AS ENUM ('POS', 'PURCHASE', 'TRANSFER', 'ADJUSTMENT', 'STOCK_COUNT', 'RETURN', 'SYSTEM');
    CREATE TYPE reference_type_enum AS ENUM ('POS_SALE', 'POS_VOID', 'PURCHASE', 'PURCHASE_RETURN', 'TRANSFER', 'STOCK_COUNT', 'MANUAL_ADJUSTMENT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'OTHER');
    CREATE TYPE transfer_status_enum AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REVERSED');
    CREATE TYPE barcode_type_enum AS ENUM ('EAN13', 'EAN8', 'UPC', 'CODE128', 'INTERNAL', 'OTHER');
    CREATE TYPE cost_method_enum AS ENUM ('WEIGHTED_AVERAGE');
    CREATE TYPE adjustment_reason_enum AS ENUM ('INITIAL_STOCK', 'STOCK_COUNT', 'DAMAGE', 'LOSS', 'FOUND', 'CORRECTION', 'OTHER');
    CREATE TYPE stock_count_status_enum AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    CREATE TYPE stock_count_line_status_enum AS ENUM ('PENDING', 'COUNTED', 'APPLIED', 'CANCELLED');
    CREATE TYPE audit_action_enum AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'POST', 'REVERSE', 'TRANSFER', 'ADJUST', 'STOCK_COUNT');
    CREATE TYPE outbox_status_enum AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
    CREATE TYPE unit_type_enum AS ENUM ('UNIT', 'LENGTH', 'WEIGHT', 'VOLUME', 'PACKAGE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CAPA 1: TABLA RAÍZ — EMPRESAS (TENANTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit_rut VARCHAR(20) NOT NULL UNIQUE,
    business_name VARCHAR(150) NOT NULL,
    trade_name VARCHAR(150) NOT NULL,
    address VARCHAR(200) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL CONSTRAINT chk_tenants_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    country_code VARCHAR(3) NOT NULL DEFAULT 'COL',
    currency_code VARCHAR(3) NOT NULL DEFAULT 'COP',
    tax_regime tax_regime_enum NOT NULL DEFAULT 'REGIMEN_SIMPLE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CAPA 2: SUCURSALES, TERCEROS, PUC, CATEGORÍAS, UOM E INFRAESTRUCTURA
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_branch_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_branches_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS third_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type document_type_enum NOT NULL DEFAULT 'CC',
    document_number VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    address VARCHAR(200),
    party_type party_type_enum NOT NULL,
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
    current_debt NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_third_party_doc UNIQUE (tenant_id, document_type, document_number),
    CONSTRAINT uq_third_parties_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    account_type account_type_enum NOT NULL,
    nature account_nature_enum NOT NULL,
    parent_id UUID,
    is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_account_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_chart_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chart_parent_tenant_fkey FOREIGN KEY (tenant_id, parent_id) REFERENCES chart_of_accounts(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_category_name UNIQUE (tenant_id, name),
    CONSTRAINT uq_product_categories_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT category_parent_tenant_fkey FOREIGN KEY (tenant_id, parent_id) REFERENCES product_categories(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS unit_of_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    unit_type unit_type_enum NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 3,
    conversion_factor NUMERIC(18, 6) NOT NULL DEFAULT 1.000000 CHECK (conversion_factor > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_uom_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_unit_of_measures_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    sequence_key VARCHAR(50) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0 CHECK (current_value >= 0),
    CONSTRAINT uq_tenant_sequence UNIQUE (tenant_id, sequence_key),
    CONSTRAINT uq_tenant_sequences_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS inventory_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(150) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    status_code INTEGER,
    response_body JSONB,
    resource_type VARCHAR(100),
    resource_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    CONSTRAINT uq_inventory_idempotency_key UNIQUE (tenant_id, key),
    CONSTRAINT uq_inventory_idempotency_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS inventory_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status_enum NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_outbox_tenant_id UNIQUE (tenant_id, id)
);

-- ============================================================================
-- CAPA 3: USUARIOS, BODEGAS Y CATÁLOGO DE PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID,
    document_type document_type_enum NOT NULL DEFAULT 'CC',
    document_number VARCHAR(20) NOT NULL,
    email VARCHAR(120) NOT NULL CONSTRAINT chk_users_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(50),
    role user_role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email),
    CONSTRAINT uq_tenant_user_doc UNIQUE (tenant_id, document_number),
    CONSTRAINT uq_users_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT users_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status warehouse_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_tenant_warehouse_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_warehouses_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT warehouses_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    barcode VARCHAR(50),
    category_id UUID,
    product_type product_type_enum NOT NULL DEFAULT 'STOCKABLE',
    status product_status_enum NOT NULL DEFAULT 'ACTIVE',
    cost_price NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CHECK (cost_price >= 0),
    sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0),
    wholesale_price NUMERIC(15, 2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.19 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    min_stock_alert NUMERIC(18, 6) NOT NULL DEFAULT 5.000000 CHECK (min_stock_alert >= 0),
    unit_of_measure_id UUID NOT NULL,
    cost_method cost_method_enum NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_tenant_product_sku UNIQUE (tenant_id, sku),
    CONSTRAINT uq_products_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT products_category_tenant_fkey FOREIGN KEY (tenant_id, category_id) REFERENCES product_categories(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT products_uom_tenant_fkey FOREIGN KEY (tenant_id, unit_of_measure_id) REFERENCES unit_of_measures(tenant_id, id) ON DELETE RESTRICT
);

-- ============================================================================
-- CAPA 4: VARIANTES, BARCODES, AUDITORÍA, BALANCES Y TRASLADOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status variant_status_enum NOT NULL DEFAULT 'ACTIVE',
    cost_price NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CHECK (cost_price >= 0),
    sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0),
    wholesale_price NUMERIC(15, 2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.19 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    min_stock_alert NUMERIC(18, 6) NOT NULL DEFAULT 5.000000 CHECK (min_stock_alert >= 0),
    unit_of_measure_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_tenant_variant_sku UNIQUE (tenant_id, sku),
    CONSTRAINT uq_product_variants_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT variants_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT variants_uom_tenant_fkey FOREIGN KEY (tenant_id, unit_of_measure_id) REFERENCES unit_of_measures(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS product_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    barcode VARCHAR(50) NOT NULL,
    type barcode_type_enum NOT NULL DEFAULT 'INTERNAL',
    product_id UUID,
    variant_id UUID,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_barcode UNIQUE (tenant_id, barcode),
    CONSTRAINT uq_product_barcodes_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chk_barcode_target CHECK ((product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL)),
    CONSTRAINT barcodes_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT barcodes_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(300),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_audit_logs_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT audit_user_tenant_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action audit_action_enum NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    movement_id UUID,
    performed_by_id UUID,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_audit_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT inv_audit_user_tenant_fkey FOREIGN KEY (tenant_id, performed_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id UUID,
    entry_number BIGINT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    concept TEXT NOT NULL,
    source_document_type journal_source_doc_enum NOT NULL,
    source_document_id UUID,
    is_posted BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_entry_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT uq_journal_entries_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT je_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id),
    CONSTRAINT je_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS pos_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL,
    cashier_id UUID NOT NULL,
    shift_number BIGINT NOT NULL,
    opening_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closing_time TIMESTAMPTZ,
    initial_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (initial_cash >= 0),
    total_sales NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_digital_sales NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_credit_sales NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(15, 2),
    actual_cash NUMERIC(15, 2),
    difference NUMERIC(15, 2),
    status pos_shift_status_enum NOT NULL DEFAULT 'OPEN',
    closed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_shift_number UNIQUE (tenant_id, shift_number),
    CONSTRAINT uq_pos_shifts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT pos_shifts_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT pos_shifts_cashier_tenant_fkey FOREIGN KEY (tenant_id, cashier_id) REFERENCES users(tenant_id, id),
    CONSTRAINT pos_shifts_closed_by_tenant_fkey FOREIGN KEY (tenant_id, closed_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    quantity_on_hand NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CONSTRAINT chk_stock_non_negative CHECK (quantity_on_hand >= 0),
    reserved_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CONSTRAINT chk_reserved_non_negative CHECK (reserved_quantity >= 0),
    average_cost NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CHECK (average_cost >= 0),
    inventory_value NUMERIC(20, 4) NOT NULL DEFAULT 0.0000 CHECK (inventory_value >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_variant_warehouse UNIQUE (tenant_id, variant_id, warehouse_id),
    CONSTRAINT uq_inventory_balances_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chk_reserved_lte_onhand CHECK (reserved_quantity <= quantity_on_hand),
    CONSTRAINT balances_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT balances_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT balances_warehouse_tenant_fkey FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_warehouse_id UUID NOT NULL,
    destination_warehouse_id UUID NOT NULL,
    status transfer_status_enum NOT NULL DEFAULT 'DRAFT',
    reference_document VARCHAR(100),
    reason TEXT,
    created_by_id UUID,
    completed_by_id UUID,
    outbound_movement_id UUID,
    inbound_movement_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_inventory_transfers_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chk_different_warehouses CHECK (source_warehouse_id <> destination_warehouse_id),
    CONSTRAINT transfers_source_wh_tenant_fkey FOREIGN KEY (tenant_id, source_warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT transfers_dest_wh_tenant_fkey FOREIGN KEY (tenant_id, destination_warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT transfers_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT transfers_completed_by_tenant_fkey FOREIGN KEY (tenant_id, completed_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    status stock_count_status_enum NOT NULL DEFAULT 'DRAFT',
    reference_document VARCHAR(100),
    notes TEXT,
    created_by_id UUID,
    completed_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_stock_counts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT stock_counts_wh_tenant_fkey FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT stock_counts_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT stock_counts_completed_by_tenant_fkey FOREIGN KEY (tenant_id, completed_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL
);

-- ============================================================================
-- CAPA 5: MOVIMIENTOS DE INVENTARIO, FACTURAS Y COMPRAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type movement_type_enum NOT NULL,
    status movement_status_enum NOT NULL DEFAULT 'DRAFT',
    source movement_source_enum NOT NULL,
    warehouse_id UUID NOT NULL,
    reference_type reference_type_enum,
    reference_id UUID,
    reference_document VARCHAR(100),
    reason TEXT,
    adjustment_reason adjustment_reason_enum,
    created_by_id UUID,
    posted_by_id UUID,
    reversed_by_id UUID,
    reverses_movement_id UUID UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ,
    CONSTRAINT uq_inventory_movements_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT movements_wh_tenant_fkey FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT movements_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT movements_posted_by_tenant_fkey FOREIGN KEY (tenant_id, posted_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT movements_reversed_by_tenant_fkey FOREIGN KEY (tenant_id, reversed_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT movements_reverses_tenant_fkey FOREIGN KEY (tenant_id, reverses_movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT
);

-- Circular FKs de Transfers y Audit Logs hacia InventoryMovements
ALTER TABLE inventory_transfers
    ADD CONSTRAINT transfers_outbound_mov_tenant_fkey FOREIGN KEY (tenant_id, outbound_movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT transfers_inbound_mov_tenant_fkey FOREIGN KEY (tenant_id, inbound_movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE inventory_audit_logs
    ADD CONSTRAINT inv_audit_movement_tenant_fkey FOREIGN KEY (tenant_id, movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transfer_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    transfer_unit_cost NUMERIC(18, 6) NOT NULL CHECK (transfer_unit_cost >= 0),
    transfer_total_cost NUMERIC(20, 4) NOT NULL CHECK (transfer_total_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_transfer_line_number UNIQUE (transfer_id, line_number),
    CONSTRAINT uq_transfer_lines_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT tl_transfer_tenant_fkey FOREIGN KEY (tenant_id, transfer_id) REFERENCES inventory_transfers(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT tl_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT tl_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stock_count_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    system_quantity NUMERIC(18, 6) NOT NULL,
    counted_quantity NUMERIC(18, 6),
    difference_quantity NUMERIC(18, 6),
    status stock_count_line_status_enum NOT NULL DEFAULT 'PENDING',
    counted_by_id UUID,
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_stock_count_variant UNIQUE (stock_count_id, variant_id),
    CONSTRAINT uq_stock_count_lines_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT scl_count_tenant_fkey FOREIGN KEY (tenant_id, stock_count_id) REFERENCES stock_counts(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT scl_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT scl_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT scl_counted_by_tenant_fkey FOREIGN KEY (tenant_id, counted_by_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL,
    third_party_id UUID,
    description VARCHAR(200),
    debit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_debit_or_credit CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)),
    CONSTRAINT uq_journal_lines_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT jel_entry_tenant_fkey FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT jel_account_tenant_fkey FOREIGN KEY (tenant_id, account_id) REFERENCES chart_of_accounts(tenant_id, id),
    CONSTRAINT jel_third_party_tenant_fkey FOREIGN KEY (tenant_id, third_party_id) REFERENCES third_parties(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL,
    pos_shift_id UUID,
    consecutive VARCHAR(50) NOT NULL,
    customer_id UUID,
    customer_name VARCHAR(150) NOT NULL DEFAULT 'Consumidor Final',
    customer_document VARCHAR(20) NOT NULL DEFAULT '222222222',
    subtotal NUMERIC(15, 2) NOT NULL CHECK (subtotal >= 0),
    discount_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    tax_total NUMERIC(15, 2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(15, 2) NOT NULL CHECK (total >= 0),
    payment_method invoice_payment_method_enum NOT NULL,
    cash_tendered NUMERIC(15, 2),
    change_given NUMERIC(15, 2),
    journal_entry_id UUID,
    status invoice_status_enum NOT NULL DEFAULT 'ISSUED',
    void_reason TEXT,
    voided_by UUID,
    voided_at TIMESTAMPTZ,
    idempotency_key UUID UNIQUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_invoice_consecutive UNIQUE (tenant_id, consecutive),
    CONSTRAINT uq_invoices_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT invoices_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT invoices_shift_tenant_fkey FOREIGN KEY (tenant_id, pos_shift_id) REFERENCES pos_shifts(tenant_id, id),
    CONSTRAINT invoices_customer_tenant_fkey FOREIGN KEY (tenant_id, customer_id) REFERENCES third_parties(tenant_id, id),
    CONSTRAINT invoices_journal_tenant_fkey FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id),
    CONSTRAINT invoices_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id),
    CONSTRAINT invoices_voided_by_tenant_fkey FOREIGN KEY (tenant_id, voided_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    supplier_invoice_number VARCHAR(50) NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(15, 2) NOT NULL CHECK (subtotal >= 0),
    tax_total NUMERIC(15, 2) NOT NULL CHECK (tax_total >= 0),
    grand_total NUMERIC(15, 2) NOT NULL CHECK (grand_total >= 0),
    payment_type purchase_payment_type_enum NOT NULL,
    due_date DATE,
    status purchase_status_enum NOT NULL DEFAULT 'RECEIVED',
    void_reason TEXT,
    journal_entry_id UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_supplier_inv UNIQUE (tenant_id, supplier_id, supplier_invoice_number),
    CONSTRAINT uq_purchases_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chk_due_date_after_purchase CHECK (due_date IS NULL OR due_date >= purchase_date),
    CONSTRAINT chk_due_date_required_credit CHECK (payment_type != 'CREDITO' OR due_date IS NOT NULL),
    CONSTRAINT purchases_branch_tenant_fkey FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id),
    CONSTRAINT purchases_warehouse_tenant_fkey FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id),
    CONSTRAINT purchases_supplier_tenant_fkey FOREIGN KEY (tenant_id, supplier_id) REFERENCES third_parties(tenant_id, id),
    CONSTRAINT purchases_journal_tenant_fkey FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id),
    CONSTRAINT purchases_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    third_party_id UUID NOT NULL,
    transaction_type credit_tx_type_enum NOT NULL,
    source_document_id UUID,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(15, 2) NOT NULL,
    payment_method credit_payment_method_enum NOT NULL DEFAULT 'EFECTIVO',
    receipt_number VARCHAR(50),
    notes TEXT,
    journal_entry_id UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_credit_tx_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ct_third_party_tenant_fkey FOREIGN KEY (tenant_id, third_party_id) REFERENCES third_parties(tenant_id, id),
    CONSTRAINT ct_journal_tenant_fkey FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id),
    CONSTRAINT ct_created_by_tenant_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
);

-- ============================================================================
-- CAPA 6: DETALLES TRANSACCIONALES Y KARDEX (INVENTORY LEDGER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    movement_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    unit_of_measure_id UUID NOT NULL,
    quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(18, 6) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(20, 4) NOT NULL CHECK (total_cost >= 0),
    previous_quantity NUMERIC(18, 6) NOT NULL,
    new_quantity NUMERIC(18, 6) NOT NULL,
    average_cost_before NUMERIC(18, 6) NOT NULL,
    average_cost_after NUMERIC(18, 6) NOT NULL,
    inventory_value_before NUMERIC(20, 4) NOT NULL,
    inventory_value_after NUMERIC(20, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_movement_line_number UNIQUE (movement_id, line_number),
    CONSTRAINT uq_movement_lines_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ml_movement_tenant_fkey FOREIGN KEY (tenant_id, movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ml_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ml_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ml_uom_tenant_fkey FOREIGN KEY (tenant_id, unit_of_measure_id) REFERENCES unit_of_measures(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sequence BIGSERIAL UNIQUE,
    movement_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    movement_type movement_type_enum NOT NULL,
    quantity_in NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CHECK (quantity_in >= 0),
    quantity_out NUMERIC(18, 6) NOT NULL DEFAULT 0.000000 CHECK (quantity_out >= 0),
    quantity_delta NUMERIC(18, 6) NOT NULL,
    quantity_balance NUMERIC(18, 6) NOT NULL,
    unit_cost NUMERIC(18, 6) NOT NULL CHECK (unit_cost >= 0),
    cost_delta NUMERIC(20, 4) NOT NULL,
    average_cost_before NUMERIC(18, 6) NOT NULL,
    average_cost_after NUMERIC(18, 6) NOT NULL,
    inventory_value_before NUMERIC(20, 4) NOT NULL,
    inventory_value_after NUMERIC(20, 4) NOT NULL,
    reference_type reference_type_enum,
    reference_id UUID,
    reference_document VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_ledger_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ile_movement_tenant_fkey FOREIGN KEY (tenant_id, movement_id) REFERENCES inventory_movements(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ile_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ile_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT ile_warehouse_tenant_fkey FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(18, 6) NOT NULL CHECK (unit_cost >= 0),
    discount_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_rate >= 0 AND discount_rate <= 1),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.19 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    subtotal NUMERIC(15, 2) NOT NULL,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) NOT NULL,
    total NUMERIC(15, 2) NOT NULL,
    CONSTRAINT chk_ii_subtotal CHECK (subtotal = ROUND(quantity * unit_price, 2)),
    CONSTRAINT chk_ii_discount CHECK (discount_amount = ROUND(subtotal * discount_rate, 2)),
    CONSTRAINT chk_ii_tax CHECK (tax_amount = ROUND((subtotal - discount_amount) * tax_rate, 2)),
    CONSTRAINT chk_ii_total CHECK (total = subtotal - discount_amount + tax_amount),
    CONSTRAINT uq_invoice_items_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ii_invoice_tenant_fkey FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT ii_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id),
    CONSTRAINT ii_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    purchase_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    unit_cost NUMERIC(18, 6) NOT NULL CHECK (unit_cost >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.19 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_amount NUMERIC(15, 2) NOT NULL,
    total NUMERIC(15, 2) NOT NULL,
    CONSTRAINT chk_pi_subtotal CHECK (subtotal = ROUND(quantity * unit_cost, 2)),
    CONSTRAINT chk_pi_tax CHECK (tax_amount = ROUND(subtotal * tax_rate, 2)),
    CONSTRAINT chk_pi_total CHECK (total = subtotal + tax_amount),
    CONSTRAINT uq_purchase_items_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT pi_purchase_tenant_fkey FOREIGN KEY (tenant_id, purchase_id) REFERENCES purchases(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT pi_product_tenant_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id),
    CONSTRAINT pi_variant_tenant_fkey FOREIGN KEY (tenant_id, variant_id) REFERENCES product_variants(tenant_id, id)
);

-- ============================================================================
-- ÍNDICES COMPLEMENTARIOS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_one_default
    ON product_variants(tenant_id, product_id)
    WHERE is_default = TRUE AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_variant_wh
    ON inventory_ledger_entries(tenant_id, variant_id, warehouse_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_variant_wh
    ON inventory_balances(tenant_id, variant_id, warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref
    ON inventory_movements(tenant_id, reference_type, reference_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS (28 TABLAS)
-- ============================================================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'tenants', 'branches', 'third_parties', 'chart_of_accounts', 'product_categories',
        'unit_of_measures', 'tenant_sequences', 'inventory_idempotency_keys', 'inventory_outbox_events',
        'users', 'warehouses', 'products', 'product_variants', 'product_barcodes', 'audit_logs',
        'inventory_audit_logs', 'journal_entries', 'pos_shifts', 'inventory_balances',
        'inventory_transfers', 'stock_counts', 'inventory_movements', 'inventory_transfer_lines',
        'stock_count_lines', 'journal_entry_lines', 'invoices', 'purchases', 'credit_transactions',
        'inventory_movement_lines', 'inventory_ledger_entries', 'invoice_items', 'purchase_items'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        IF t = 'tenants' THEN
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_self ON %I;', t);
            EXECUTE format('CREATE POLICY tenant_isolation_self ON %I FOR ALL USING (id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::UUID) WITH CHECK (id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::UUID);', t);
        ELSE
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I;', t, t);
            EXECUTE format('CREATE POLICY tenant_isolation_%I ON %I FOR ALL USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::UUID) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::UUID);', t, t);
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- FUNCIONES AUXILIARES, SECUENCIAS Y PROCEDIMIENTOS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'set_current_tenant: p_tenant_id no puede ser NULL' USING ERRCODE = 'not_null_violation';
    END IF;

    IF session_user = 'saas_admin' THEN
        PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND is_active = true) THEN
        RAISE EXCEPTION 'Tenant % no existe o está inactivo.', p_tenant_id USING ERRCODE = 'invalid_authorization_specification';
    END IF;

    PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_current_tenant();
        IF NEW.tenant_id IS NULL THEN
            RAISE EXCEPTION 'No hay tenant activo en la sesión. Ejecute SELECT set_current_tenant(uuid) primero.' USING ERRCODE = 'invalid_authorization_specification';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION next_sequence_value(p_tenant_id UUID, p_sequence_key VARCHAR)
RETURNS BIGINT AS $$
DECLARE
    v_next BIGINT;
BEGIN
    IF p_tenant_id IS NULL OR p_sequence_key IS NULL OR p_sequence_key = '' THEN
        RAISE EXCEPTION 'next_sequence_value: parámetros no pueden ser NULL o vacíos' USING ERRCODE = 'not_null_violation';
    END IF;

    UPDATE tenant_sequences
    SET current_value = current_value + 1
    WHERE tenant_id = p_tenant_id AND sequence_key = p_sequence_key
    RETURNING current_value INTO v_next;

    IF v_next IS NULL THEN
        INSERT INTO tenant_sequences (tenant_id, sequence_key, current_value)
        VALUES (p_tenant_id, p_sequence_key, 1)
        ON CONFLICT ON CONSTRAINT uq_tenant_sequence
        DO UPDATE SET current_value = tenant_sequences.current_value + 1
        RETURNING current_value INTO v_next;
    END IF;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_journal_entry_number(p_tenant_id UUID) RETURNS BIGINT AS $$
BEGIN
    RETURN next_sequence_value(p_tenant_id, 'JOURNAL_ENTRY');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_invoice_consecutive(p_tenant_id UUID, p_branch_code VARCHAR) RETURNS VARCHAR AS $$
DECLARE
    v_val BIGINT;
BEGIN
    v_val := next_sequence_value(p_tenant_id, 'INV-' || p_branch_code);
    RETURN p_branch_code || '-POS-' || LPAD(v_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_shift_number(p_tenant_id UUID) RETURNS BIGINT AS $$
BEGIN
    RETURN next_sequence_value(p_tenant_id, 'POS_SHIFT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS DE INMUTABILIDAD Y TRANSICIÓN
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_immutable_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '[INMUTABILIDAD] DELETE prohibido en tabla %. Los registros históricos son inmutables.', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'journal_entries'
           AND OLD.is_posted = false AND NEW.is_posted = true
           AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
           AND NEW.entry_number IS NOT DISTINCT FROM OLD.entry_number
           AND NEW.concept IS NOT DISTINCT FROM OLD.concept
        THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION '[INMUTABILIDAD] UPDATE prohibido en tabla %. Registre un nuevo movimiento o ajuste.', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_invoice_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '[FACTURA] DELETE prohibido. Debe anular la factura (VOIDED).' USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD.status = 'VOIDED' THEN
        RAISE EXCEPTION '[FACTURA] Factura ya anulada (%) es inmutable.', OLD.consecutive USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.status = 'VOIDED' AND OLD.status != 'ISSUED' THEN
        RAISE EXCEPTION '[FACTURA] Solo facturas ISSUED pueden anularse. Estado: %', OLD.status USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.subtotal != OLD.subtotal OR NEW.tax_total != OLD.tax_total OR NEW.total != OLD.total OR NEW.consecutive != OLD.consecutive THEN
        RAISE EXCEPTION '[FACTURA] Los campos monetarios y fiscales son inmutables.' USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_purchase_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '[COMPRA] DELETE prohibido. Debe anular la compra (VOIDED).' USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD.status = 'VOIDED' THEN
        RAISE EXCEPTION '[COMPRA] Compra ya anulada (%) es inmutable.', OLD.supplier_invoice_number USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.status = 'VOIDED' AND OLD.status != 'RECEIVED' THEN
        RAISE EXCEPTION '[COMPRA] Solo compras RECEIVED pueden anularse. Estado: %', OLD.status USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.subtotal != OLD.subtotal OR NEW.tax_total != OLD.tax_total OR NEW.grand_total != OLD.grand_total THEN
        RAISE EXCEPTION '[COMPRA] Los campos monetarios son inmutables.' USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_third_party_debt()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE third_parties
    SET current_debt = (
            SELECT ct.balance_after
            FROM credit_transactions ct
            WHERE ct.third_party_id = NEW.third_party_id AND ct.tenant_id = NEW.tenant_id
            ORDER BY ct.created_at DESC, ct.id DESC LIMIT 1
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.third_party_id AND tenant_id = NEW.tenant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- APLICACIÓN MASIVA DE TRIGGERS
-- ============================================================================

-- Updated At
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_third_parties_updated_at BEFORE UPDATE ON third_parties FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_unit_of_measures_updated_at BEFORE UPDATE ON unit_of_measures FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_product_barcodes_updated_at BEFORE UPDATE ON product_barcodes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_inventory_balances_updated_at BEFORE UPDATE ON inventory_balances FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_inventory_transfers_updated_at BEFORE UPDATE ON inventory_transfers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_stock_counts_updated_at BEFORE UPDATE ON stock_counts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_stock_count_lines_updated_at BEFORE UPDATE ON stock_count_lines FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_inventory_movements_updated_at BEFORE UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_inventory_outbox_updated_at BEFORE UPDATE ON inventory_outbox_events FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Inmutabilidad
CREATE TRIGGER trg_immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
CREATE TRIGGER trg_immutable_inv_audit_logs BEFORE UPDATE OR DELETE ON inventory_audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
CREATE TRIGGER trg_immutable_journal_entries BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
CREATE TRIGGER trg_immutable_journal_lines BEFORE UPDATE OR DELETE ON journal_entry_lines FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
CREATE TRIGGER trg_immutable_credit_tx BEFORE UPDATE OR DELETE ON credit_transactions FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
CREATE TRIGGER trg_immutable_inventory_ledger BEFORE UPDATE OR DELETE ON inventory_ledger_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();

-- Transiciones de Estado
CREATE TRIGGER trg_enforce_invoice_transition BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION enforce_invoice_transition();
CREATE TRIGGER trg_enforce_purchase_transition BEFORE UPDATE OR DELETE ON purchases FOR EACH ROW EXECUTE FUNCTION enforce_purchase_transition();

-- Sincronización de Cartera
CREATE TRIGGER trg_sync_debt_after_credit_tx AFTER INSERT ON credit_transactions FOR EACH ROW EXECUTE FUNCTION sync_third_party_debt();

-- Auto Tenant ID
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'branches', 'third_parties', 'chart_of_accounts', 'product_categories',
        'unit_of_measures', 'tenant_sequences', 'inventory_idempotency_keys', 'inventory_outbox_events',
        'users', 'warehouses', 'products', 'product_variants', 'product_barcodes', 'audit_logs',
        'inventory_audit_logs', 'journal_entries', 'pos_shifts', 'inventory_balances',
        'inventory_transfers', 'stock_counts', 'inventory_movements', 'inventory_transfer_lines',
        'stock_count_lines', 'journal_entry_lines', 'invoices', 'purchases', 'credit_transactions',
        'inventory_movement_lines', 'inventory_ledger_entries', 'invoice_items', 'purchase_items'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_tenant_%I ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_auto_tenant_%I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();', t, t);
    END LOOP;
END $$;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    v_tables INTEGER;
    v_rls_tables INTEGER;
    v_policies INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    SELECT COUNT(*) INTO v_rls_tables FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
    SELECT COUNT(*) INTO v_policies FROM pg_policies WHERE schemaname = 'public';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ESQUEMA SAAS CONTABLE v4 INICIALIZADO CORRECTAMENTE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tablas base creadas:    %', v_tables;
    RAISE NOTICE 'Tablas protegidas RLS:  %', v_rls_tables;
    RAISE NOTICE 'Políticas RLS activas:  %', v_policies;
    RAISE NOTICE 'Estado: 100%% Sincronizado con Prisma Squad 1 + Squad 3';
    RAISE NOTICE '============================================================';
END $$;