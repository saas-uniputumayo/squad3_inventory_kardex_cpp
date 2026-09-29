import Decimal from 'decimal.js';

/**
 * Política canónica de precisión decimal para el motor de inventario de Squad 3.
 *
 * Basada en las especificaciones de base de datos de PostgreSQL/Prisma y requerimientos contables:
 * - Costo Unitario / CPP: 6 decimales (Decimal(18, 6)).
 * - Valor Monetario de Inventario: 4 decimales (Decimal(20, 4)).
 * - Cantidades: Enteras o con precisión definida por la UOM (Decimal(18, 6)).
 */
export class InventoryPrecisionPolicy {
    public static readonly UNIT_COST_DECIMALS = 6;
    public static readonly INVENTORY_VALUE_DECIMALS = 4;
    public static readonly DEFAULT_ROUNDING_MODE = Decimal.ROUND_HALF_UP;

    /**
     * Paso mínimo representable para valor monetario de inventario: 0.0001 (10^-4).
     * Es la tolerancia canónica para comparar valores monetarios redondeados a 4 decimales.
     */
    public static readonly INVENTORY_VALUE_TOLERANCE = new Decimal('0.0001');

    /**
     * Paso mínimo representable para costo unitario / CPP: 0.000001 (10^-6).
     */
    public static readonly UNIT_COST_TOLERANCE = new Decimal('0.000001');

    /**
     * Tolerancia estándar por defecto para comparaciones de valores ya redondeados a 4 decimales.
     * Coincide exactamente con el escalón mínimo de 4 decimales (0.0001), eliminando tolerancias
     * arbitrarias sobredimensionadas como 0.01.
     */
    public static readonly VALUE_EQUALITY_TOLERANCE = new Decimal('0.0001');

    /**
     * Redondea un costo unitario o CPP a la precisión canónica de 6 decimales.
     */
    public static roundUnitCost(value: Decimal.Value): Decimal {
        return new Decimal(value).toDecimalPlaces(
            this.UNIT_COST_DECIMALS,
            this.DEFAULT_ROUNDING_MODE,
        );
    }

    /**
     * Redondea un valor monetario de inventario a la precisión canónica de 4 decimales.
     */
    public static roundInventoryValue(value: Decimal.Value): Decimal {
        return new Decimal(value).toDecimalPlaces(
            this.INVENTORY_VALUE_DECIMALS,
            this.DEFAULT_ROUNDING_MODE,
        );
    }

    /**
     * Redondea una cantidad a los decimales permitidos por su unidad de medida.
     */
    public static roundQuantity(
        value: Decimal.Value,
        decimalPlaces: number,
    ): Decimal {
        return new Decimal(value).toDecimalPlaces(
            decimalPlaces,
            this.DEFAULT_ROUNDING_MODE,
        );
    }

    /**
     * Calcula la tolerancia canónica derivada de la precisión del modelo para verificar
     * la coherencia entre inventoryValue y (quantity * averageCost).
     *
     * Derivación matemática:
     * - El costo promedio (CPP) se almacena con 6 decimales. El error máximo por redondeo
     *   al derivar el CPP es 0.5 * 10^-6 (0.0000005).
     * - Al multiplicarse por la cantidad Q, el residuo máximo acumulable en el valor
     *   debido al truncamiento del CPP es (Q * 0.0000005).
     * - El valor monetario de inventario tiene 4 decimales, con una resolución de 10^-4 (0.0001).
     *
     * Tolerancia canónica = Q * 0.0000005 + 0.0001
     */
    public static calculateValuationTolerance(quantity: Decimal.Value): Decimal {
        const qty = new Decimal(quantity).abs();
        const cppResidue = qty.mul(new Decimal('0.0000005'));
        return cppResidue.plus(this.INVENTORY_VALUE_TOLERANCE);
    }

    /**
     * Verifica si dos valores monetarios de inventario son equivalentes
     * dentro del margen de tolerancia de redondeo canónico.
     */
    public static areValuesEquivalent(
        value1: Decimal.Value,
        value2: Decimal.Value,
        tolerance: Decimal.Value = this.VALUE_EQUALITY_TOLERANCE,
    ): boolean {
        const d1 = new Decimal(value1);
        const d2 = new Decimal(value2);
        const diff = d1.minus(d2).abs();
        return diff.lessThanOrEqualTo(tolerance);
    }
}
