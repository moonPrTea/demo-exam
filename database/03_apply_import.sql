BEGIN;

CREATE TEMP TABLE import_product_aliases (
    alias_name text NOT NULL,
    manufacturer text NOT NULL,
    canonical_name text NOT NULL,
    PRIMARY KEY (alias_name, manufacturer)
) ON COMMIT DROP;

INSERT INTO import_product_aliases(alias_name, manufacturer, canonical_name)
VALUES (
    'Черные туфли в классическом стиле',
    'Барбари',
    'Черные туфли в классическом стиле — база для деловых образов'
);

INSERT INTO exam.app_users(last_name, first_name, middle_name, login, role)
SELECT
    exam.norm_text(last_name),
    exam.norm_text(first_name),
    exam.norm_text(middle_name),
    exam.norm_text(login),
    exam.norm_text(role)
FROM exam.stage_users
ON CONFLICT (login) DO UPDATE SET
    last_name = EXCLUDED.last_name,
    first_name = EXCLUDED.first_name,
    middle_name = EXCLUDED.middle_name,
    role = EXCLUDED.role;

INSERT INTO exam.products(
    category,
    subcategory,
    image_file,
    name,
    manufacturer,
    description,
    composition,
    price
)
SELECT
    exam.norm_text(category),
    exam.norm_text(subcategory),
    exam.norm_text(image_file),
    exam.norm_text(product_name),
    exam.norm_text(manufacturer),
    exam.norm_text(description),
    exam.norm_text(composition),
    exam.parse_import_number(price_text)::numeric(12, 2)
FROM exam.stage_products
ON CONFLICT (name, manufacturer) DO UPDATE SET
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    image_file = EXCLUDED.image_file,
    description = EXCLUDED.description,
    composition = EXCLUDED.composition,
    price = EXCLUDED.price;

INSERT INTO exam.sizes(shoe_size)
SELECT DISTINCT
    exam.parse_import_number(size_text)::numeric(4, 1)
FROM exam.stage_sizes
ON CONFLICT (shoe_size) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM exam.stage_stock_items s
        LEFT JOIN import_product_aliases a
          ON a.alias_name = exam.norm_text(s.product_name)
         AND a.manufacturer = exam.norm_text(s.manufacturer)
        LEFT JOIN exam.products p
          ON p.name = COALESCE(a.canonical_name, exam.norm_text(s.product_name))
         AND p.manufacturer = exam.norm_text(s.manufacturer)
        WHERE p.product_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Stock import contains an unmatched product.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM exam.stage_orders o
        LEFT JOIN import_product_aliases a
          ON a.alias_name = exam.norm_text(o.product_name)
         AND a.manufacturer = exam.norm_text(o.manufacturer)
        LEFT JOIN exam.products p
          ON p.name = COALESCE(a.canonical_name, exam.norm_text(o.product_name))
         AND p.manufacturer = exam.norm_text(o.manufacturer)
        WHERE p.product_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Order import contains an unmatched product.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM exam.stage_orders o
        LEFT JOIN exam.app_users u
          ON concat_ws(' ', u.last_name, u.first_name, u.middle_name)
             = exam.norm_text(o.customer_full_name)
        WHERE u.user_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Order import contains an unmatched customer.';
    END IF;
END;
$$;

INSERT INTO exam.stock_items(product_id, shoe_size, available_quantity)
SELECT
    p.product_id,
    exam.parse_import_number(s.size_text)::numeric(4, 1),
    exam.parse_import_number(s.quantity_text)::integer
FROM exam.stage_stock_items s
LEFT JOIN import_product_aliases a
  ON a.alias_name = exam.norm_text(s.product_name)
 AND a.manufacturer = exam.norm_text(s.manufacturer)
JOIN exam.products p
  ON p.name = COALESCE(a.canonical_name, exam.norm_text(s.product_name))
 AND p.manufacturer = exam.norm_text(s.manufacturer)
ON CONFLICT (product_id, shoe_size) DO UPDATE SET
    available_quantity = EXCLUDED.available_quantity;

INSERT INTO exam.orders(order_id, order_date, customer_id, created_by_id)
SELECT DISTINCT
    exam.norm_text(o.order_number_text)::integer,
    exam.parse_import_date(o.order_date_text),
    u.user_id,
    NULL
FROM exam.stage_orders o
JOIN exam.app_users u
  ON concat_ws(' ', u.last_name, u.first_name, u.middle_name)
     = exam.norm_text(o.customer_full_name)
ON CONFLICT (order_id) DO UPDATE SET
    order_date = EXCLUDED.order_date,
    customer_id = EXCLUDED.customer_id;

INSERT INTO exam.order_items(
    order_id,
    product_id,
    shoe_size,
    quantity,
    unit_price
)
SELECT
    exam.norm_text(o.order_number_text)::integer,
    p.product_id,
    exam.parse_import_number(o.size_text)::numeric(4, 1),
    exam.parse_import_number(o.quantity_text)::integer,
    exam.parse_import_number(o.unit_price_text)::numeric(12, 2)
FROM exam.stage_orders o
LEFT JOIN import_product_aliases a
  ON a.alias_name = exam.norm_text(o.product_name)
 AND a.manufacturer = exam.norm_text(o.manufacturer)
JOIN exam.products p
  ON p.name = COALESCE(a.canonical_name, exam.norm_text(o.product_name))
 AND p.manufacturer = exam.norm_text(o.manufacturer)
ON CONFLICT (order_id, product_id, shoe_size) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price;

SELECT setval(
    pg_get_serial_sequence('exam.orders', 'order_id'),
    GREATEST(COALESCE((SELECT MAX(order_id) FROM exam.orders), 1), 1),
    true
);

COMMIT;
