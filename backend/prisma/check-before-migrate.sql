-- Run this BEFORE applying 20261103133000_add_integrity_constraints.
-- Every count must be 0. If one isn't, stop and fix those rows first.
SELECT 'cart_items with no user/product'      AS problem, COUNT(*) FROM cart_items  WHERE user_id IS NULL OR product_id IS NULL
UNION ALL SELECT 'order_items with no order/product', COUNT(*) FROM order_items WHERE order_id IS NULL OR product_id IS NULL
UNION ALL SELECT 'cart quantity <= 0',                COUNT(*) FROM cart_items  WHERE quantity <= 0
UNION ALL SELECT 'order item quantity <= 0',          COUNT(*) FROM order_items WHERE quantity <= 0
UNION ALL SELECT 'negative unit_price',               COUNT(*) FROM order_items WHERE unit_price < 0
UNION ALL SELECT 'negative price',                    COUNT(*) FROM products    WHERE price < 0
UNION ALL SELECT 'negative stock',                    COUNT(*) FROM products    WHERE stock_quantity < 0
UNION ALL SELECT 'unknown order status',              COUNT(*) FROM orders      WHERE status NOT IN ('PENDING','PAID','SHIPPED','DELIVERED','CANCELLED')
UNION ALL SELECT 'unknown payment method',            COUNT(*) FROM orders      WHERE payment_method IS NOT NULL AND payment_method NOT IN ('cod','xendit');
