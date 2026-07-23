-- ============================================================================
-- fix-pair-purchase-price.sql
-- Corrige los valores de pair_purchase_price en lens_catalog_items
-- afectados por el bug de junio 2026 (commit 2264cb6).
--
-- Reglas de negocio:
--   UNIT → pair_purchase_price = base_price * 2
--   PAIR → pair_purchase_price = base_price
--   mounting_price y shipping_price NUNCA se incluyen en este cálculo.
--
-- Las ventas no se tocan — el costo está congelado en cada ítem de venta.
-- ============================================================================

-- Paso 1: Previsualizar registros afectados (solo lectura)
SELECT
    id,
    name,
    type,
    price_type,
    base_price,
    pair_purchase_price        AS stored_pair,
    CASE WHEN price_type = 'UNIT'
         THEN base_price * 2
         ELSE base_price
    END                        AS correct_pair,
    mounting_price,
    shipping_price,
    created_at,
    deleted_at
FROM lens_catalog_items
WHERE round(pair_purchase_price::numeric, 4)
   <> round((CASE WHEN price_type = 'UNIT'
                  THEN base_price * 2
                  ELSE base_price
             END)::numeric, 4)
ORDER BY created_at;

-- Paso 2: Ejecutar la corrección (transaccional)
BEGIN;

UPDATE lens_catalog_items
SET pair_purchase_price = CASE
        WHEN price_type = 'UNIT' THEN base_price * 2
        ELSE base_price
    END,
    updated_at = now()
WHERE round(pair_purchase_price::numeric, 4)
   <> round((CASE WHEN price_type = 'UNIT'
                  THEN base_price * 2
                  ELSE base_price
             END)::numeric, 4);

-- Paso 3: Verificar que no quedan registros con desajuste
-- Debe devolver 0.
SELECT count(*) AS still_wrong
FROM lens_catalog_items
WHERE round(pair_purchase_price::numeric, 4)
   <> round((CASE WHEN price_type = 'UNIT'
                  THEN base_price * 2
                  ELSE base_price
             END)::numeric, 4);

-- Si still_wrong = 0 → COMMIT
-- Si algo se ve raro  → ROLLBACK
COMMIT;
