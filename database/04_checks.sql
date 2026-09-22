SELECT 'users' AS entity, COUNT(*) AS actual, 20 AS expected
FROM exam.app_users
UNION ALL
SELECT 'products', COUNT(*), 31
FROM exam.products
UNION ALL
SELECT 'sizes', COUNT(*), 35
FROM exam.sizes
UNION ALL
SELECT 'stock_items', COUNT(*), 92
FROM exam.stock_items
UNION ALL
SELECT 'orders', COUNT(*), 10
FROM exam.orders
UNION ALL
SELECT 'order_items', COUNT(*), 30
FROM exam.order_items;

SELECT
    SUM(available_quantity) AS actual_inventory,
    1274 AS expected_inventory
FROM exam.stock_items;

SELECT
    SUM(quantity * unit_price) AS actual_historical_order_total,
    341770.00::numeric AS expected_historical_order_total
FROM exam.order_items;

WITH product_stock AS (
    SELECT
        p.product_id,
        p.name,
        COALESCE(SUM(si.available_quantity), 0) AS total_stock
    FROM exam.products p
    LEFT JOIN exam.stock_items si ON si.product_id = p.product_id
    GROUP BY p.product_id
)
SELECT
    COUNT(*) FILTER (WHERE total_stock <= 3) AS actual_low_stock_products,
    3 AS expected_low_stock_products
FROM product_stock;

SELECT
    o.order_id,
    o.order_date,
    concat_ws(' ', u.last_name, u.first_name, u.middle_name) AS customer_name,
    SUM(oi.quantity * oi.unit_price) AS order_total
FROM exam.orders o
JOIN exam.app_users u ON u.user_id = o.customer_id
JOIN exam.order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, u.user_id
ORDER BY o.order_id;
