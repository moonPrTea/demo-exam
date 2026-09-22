TRUNCATE TABLE
    exam.stage_users,
    exam.stage_products,
    exam.stage_sizes,
    exam.stage_stock_items,
    exam.stage_orders;

SELECT 'Staging tables are ready for CSV import.' AS status;
