# 🛒 TechZone — E-Commerce Features Skill

## Cart System
- **Provider**: `components/CartProvider.jsx` — React Context for cart state
- **Service**: `services/cartService.js` — Supabase cart operations
- **Model**: `lib/cartSyncModel.js` — Cart sync logic, `lib/cartAvailabilityModel.js` — Stock checks
- **UI**: `components/CartSidebar.jsx` — Sliding cart drawer

## Checkout Flow
```
Cart → Checkout Page → checkout API → Order Created → Deposit/Payment
```
- **Page**: `app/checkout/page.jsx`
- **Hook**: `hooks/useCheckoutPage.js`
- **API**: `functions/api/checkout.js` (orchestrator)
  - `functions/api/checkout-validator.js` — Input validation
  - `functions/api/checkout-inventory.js` — Stock verification
  - `functions/api/checkout-order.js` — Order creation
  - `functions/api/checkout-cors.js` — CORS handling
- **Service**: `services/checkoutService.js` + `services/checkoutInventoryService.js`
- **Model**: `lib/checkoutModel.js` + `lib/checkoutRequestPayload.js`

## Product System
- **Explorer**: `components/ProductsExplorerClient.jsx` — Product grid with filters
- **Card**: `components/ProductCard.jsx` — Individual product card
- **Detail**: `app/products/[id]/page.jsx` — Product detail page
- **Model**: `lib/productsExplorerModel.js`, `lib/productCardModel.js`
- **Category**: `app/category/[id]/page.jsx`, `services/categoryPageService.js`

## Favorites / Wishlist
- **Provider**: `components/FavoritesProvider.jsx` — React Context
- **Service**: `services/favoritesService.js`
- **Model**: `lib/favoritesModel.js`, `lib/favoritesShareModel.js`
- **Share Page**: `app/favorites/shared/page.jsx`

## Deposit/Payment
- **Page**: `app/deposit/page.jsx`
- **Service**: `services/depositPageService.js`, `services/depositProofService.js`
- **Upload**: `services/depositProofUploadService.js`
- **API**: `functions/api/deposits/proof.js`

## User Dashboard
- **Layout**: `app/dashboard/layout.jsx`
- **Pages**: orders, favorites, profile, notifications, deposit, wallet
- **Shell Service**: `services/dashboardShellService.js`
- **Auth Gate**: Requires Supabase Auth session

## AI Chatbot
- **Component**: `components/AiChatbot.jsx`
- **API**: `functions/api/chat.js` (Groq API proxy)
- **Model**: `lib/liveChatModel.js`

## Comparison Feature
- **Provider**: `components/ComparisonProvider.jsx`
- **Dock**: `components/ComparisonDock.jsx`
- **Page**: `app/compare/page.jsx`
- **Model**: `lib/comparisonModel.js`

## Search
- **Overlay**: `components/GlobalSearchOverlay.jsx`
- **Service**: `services/globalSearchService.js`
- **Model**: `lib/globalSearchModel.js`, `lib/globalSearchFactory.js`
- **Keyboard**: `Ctrl+K` triggers search (via `components/KeyboardShortcuts.jsx`)

## Notifications
- **Header Bell**: `components/HeaderNotificationBell.jsx`
- **Dashboard**: `components/dashboard-notifications/`
- **Service**: `services/dashboardNotificationsService.js`
- **Model**: `lib/headerNotificationsModel.js`, `lib/dashboardNotificationsModel.js`

## Currency Format
Use `lib/formatCurrency.js` for all price display:
```js
import { formatCurrency } from '@/lib/formatCurrency';
// formatCurrency(3999) → "3,999 د.ع" (Iraqi Dinar)
```
