# 🗄️ TechZone — Database & Supabase Skill

## Supabase Client Configuration

### Client-side (Browser)
```js
// lib/supabaseClient.js — ANON key only, subject to RLS
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Server-side (Cloudflare Functions)
```js
// functions/_lib/providerApi.js — SERVICE_ROLE key, bypasses RLS
import { createClient } from '@supabase/supabase-js';

export function createServerSupabase(env) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}
```

**CRITICAL**: Never use `SUPABASE_SERVICE_ROLE_KEY` in client-side code. The bundle security plugin will block the build.

## Database Tables (Key Tables)

| Table | Purpose |
|---|---|
| `products` | Product catalog with pricing, stock, images |
| `categories` | Product categories with hierarchy |
| `orders` | Customer orders with status tracking |
| `order_items` | Line items for each order |
| `app_users` | User profiles (synced from Supabase Auth) |
| `repair_bookings` | Service repair appointments |
| `deposits` | Customer deposit/payment records |
| `deposit_proofs` | Payment proof uploads |
| `site_settings` | Dynamic site configuration |
| `site_content` | CMS content blocks |
| `notifications` | User notification system |
| `chats` / `chat_messages` | Live chat and AI chat |
| `stock_alerts` | Product restock notifications |
| `favorites` | User wishlist/favorites |

## Query Patterns

### Fetching with pagination
```js
const { data, error, count } = await supabase
  .from('products')
  .select('*, categories(name)', { count: 'exact' })
  .eq('active', true)
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

### Fetching single record
```js
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('id', productId)
  .single();
```

### Inserting data
```js
const { data, error } = await supabase
  .from('orders')
  .insert({
    user_id: userId,
    total: cartTotal,
    status: 'pending',
  })
  .select()
  .single();
```

### Updating data
```js
const { error } = await supabase
  .from('orders')
  .update({ status: 'confirmed' })
  .eq('id', orderId);
```

### Real-time subscriptions
```js
const channel = supabase
  .channel('order-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    handleOrderUpdate(payload.new);
  })
  .subscribe();

// Cleanup
return () => supabase.removeChannel(channel);
```

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:
- Users can only read their own orders, favorites, notifications
- Products and categories are publicly readable
- Write operations on sensitive tables go through Cloudflare Functions with `SERVICE_ROLE_KEY`
- Admin operations require role verification in the function layer

## Migration Conventions

SQL migration files go in `db/` with naming:
```
db/YYYY-MM-DD-NN-description.sql
```

Example: `db/2026-04-26-01-security-lockdown.sql`

Always include:
- `BEGIN; ... COMMIT;` transaction wrapping
- Rollback comments for reversibility
- RLS policy definitions for new tables

## Error Code Convention

All error messages use a domain-code pattern:
```
[DOMAIN-CODE] Description
```

Examples:
- `[CART-404] Product not found`
- `[CHECKOUT-500] Payment processing failed`
- `[AUTH-401] Session expired`
- `[STOCK-409] Insufficient inventory`
