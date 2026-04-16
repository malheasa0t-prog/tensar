-- Fix foreign key constraints on order_items and cart_items to allow product deletion

ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey,
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Assuming cart items might be stored locally, but if cart_items table exists:
ALTER TABLE public.cart_items
DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey,
ADD CONSTRAINT cart_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Also check orders customer_id if we want to allow deleting users, but products is the main issue.
