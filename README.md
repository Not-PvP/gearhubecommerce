# GearHub

GearHub is an e-commerce web app for gaming gear, built for the QuickCart Express project spec. Customers browse and search products, add them to a cart, and check out with cash on delivery, card or GCash.

It runs as three parts on your machine:

| Part | Folder | Tech | Port |
| --- | --- | --- | --- |
| Storefront | project root | React, TypeScript, `useReducer` + Context | 3000 |
| REST API | `backend/` | Express, TypeScript, Prisma, PostgreSQL | 5000 |
| Payment server | `server/` | Express, Xendit Invoice API (test mode) | 4000 |

The storefront holds no data of its own. Products and orders come from the REST API, and the payment server keeps the Xendit secret key off the browser.

## Customer accounts

- Anyone can browse and fill a cart. Checking out or opening order history asks the customer to log in or create an account (the user icon in the navbar).
- After logging in, the cart is saved to the account in the `cart_items` table, so it survives a refresh, a logout or another device. Anything added before logging in is merged into the saved cart.
- Every cart change is saved to the account shortly after it happens (`PUT /api/cart`). The server caps quantities at the current stock.
- Orders are linked to the customer's account, and order history shows only their own orders.
- Login returns a JWT (`jsonwebtoken`, signed with `JWT_SECRET`, valid for 1 day) that the storefront sends as `Authorization: Bearer <token>`. The browser keeps it in localStorage so a reload doesn't log the customer out.
- Admins log in the same way; `/api/admin` routes also check that the account is marked as admin. Admin accounts get an **Admin dashboard** button in the account panel.
- Customers can cancel their own order while it's still PENDING (Your orders > Cancel order); the items go back into stock. Paid or shipped orders can't be cancelled by the customer.
- Clicking a product's image or name opens its details (description, price, live stock from `GET /api/products/:id`).

## Payments: the server never takes the browser's word

- **Cash on delivery** orders are saved as PENDING.
- **Online (Xendit)** orders send the Xendit invoice id, not a status. Before saving, the REST API asks the payment server (which holds the Xendit secret key) for that invoice and saves the order as PAID only if Xendit reports it PAID or SETTLED **and** the amount equals the order total worked out from database prices plus shipping. Otherwise it answers 402 (not paid), 400 (wrong amount or unknown invoice) or 502 (payment server unreachable) and nothing is saved.
- Prices and stock always come from the database, inside one transaction.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [PostgreSQL](https://www.postgresql.org/) running locally
- A [Xendit](https://dashboard.xendit.co/) account in test mode (only for card and GCash checkout)

## First-time setup

### 1. Install dependencies

```bash
npm install
cd backend && npm install && cd ..
cd server && npm install && cd ..
```

### 2. Create the environment files

**`backend/.env`** (copy `backend/.env.example`):

```env
PORT=5000
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/ecommerce?schema=public"
JWT_SECRET="any-long-random-string"
PAYMENT_SERVER_URL=http://localhost:4000
```

`JWT_SECRET` signs login tokens. Any long random string works; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

**`server/.env`** (copy `server/.env.example`):

```env
XENDIT_SECRET_KEY=xnd_development_your_secret_key
XENDIT_CALLBACK_VERIFICATION_TOKEN=
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
```

Use a Xendit **secret** key (`xnd_development_...`) with Money-In write permission, from Settings > API Keys in test mode. The public key (`xnd_public_...`) can't create invoices. Never commit either `.env` file.

### 3. Set up the database

Create an empty PostgreSQL database named `ecommerce`, then from `backend/`:

```bash
npx prisma migrate deploy   # creates the tables
npm run seed                # loads the 18 products
```

**Already have the tables** (for example, from the earlier SQL setup)? Don't run `migrate deploy`. Mark the existing schema as the starting point instead:

```bash
npm run prisma:baseline
npm run prisma:status       # should say "Database schema is up to date!"
```

## Running the app

Open three terminals:

```bash
# Terminal 1: REST API on http://localhost:5000
cd backend
npm run dev

# Terminal 2: payment server on http://localhost:4000
cd server
npm run dev

# Terminal 3: storefront on http://localhost:3000
npm start
```

The payment server is only needed for card and GCash checkout. Cash on delivery works with the API and storefront alone.

`npm run dev` restarts the backend and the payment server when you edit their code. After changing a `.env` file, stop the server (Ctrl+C) and start it again.

To browse the database while the app runs:

```bash
cd backend
npx prisma studio           # opens http://localhost:5555
```

## Admin dashboard

Admins can view all orders, update their status, and monitor low-stock products.

Open http://localhost:3000/#/admin and sign in with an admin account.

### Create an admin account

Accounts live in your own local database, so each person creates their own. With the backend running:

1. Register an account (PowerShell):

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/register -ContentType "application/json" -Body '{"email":"admin@gearhub.com","password":"admin1234"}'
   ```

2. Mark it as admin. From `backend/`, run `npx prisma studio`, open the `users` table, set `isAdmin` to `true` for that user, and click **Save**.

3. Sign in at `/#/admin`. You can use your own email and password instead of the example above.

### What it does

- Lists all orders with a status filter.
- Changes an order's status: PENDING, PAID, SHIPPED, DELIVERED or CANCELLED.
- Cancelling an order returns its items to stock. Cancelled orders can't be changed, and delivered orders can't be cancelled.
- Shows products with 5 or fewer left in stock.

### Admin endpoints

These need `Authorization: Bearer <token>` from logging in with an admin account. They return 401 with no token, and 403 for an invalid or expired token or an account that isn't an admin.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/orders` | All orders, newest first |
| PATCH | `/api/admin/orders/:id/status` | Updates an order's status. Body: `{ "status": "SHIPPED" }` |
| GET | `/api/admin/low-stock?threshold=5` | Products at or below the threshold |

## Useful backend scripts

Run these from `backend/`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with `tsx` and restarts it when files in `src/` change (nodemon) |
| `npm run build` / `npm start` | Compiles to `dist/` with `tsc` / runs the compiled API |
| `npm run prisma:studio` | Opens Prisma Studio on http://localhost:5555 |
| `npm run seed` | Loads or resets the 18 products from `prisma/seed-data/products.json` |
| `npm run prisma:migrate` | Creates and applies a migration after you edit `prisma/schema.prisma` |
| `npm run prisma:status` | Checks the database matches the migrations |
| `npm run prisma:generate` | Regenerates the Prisma client (stop `npm run dev` first on Windows) |

## Backend project structure

```
backend/
  prisma/
    schema.prisma          # Prisma models (User, Product, CartItem, Order, OrderItem)
    migrations/            # version-controlled schema changes
    seed.js                # npm run seed
  src/
    server.ts              # Express app entry point, mounts all routers
    db.ts                  # Prisma client (one shared instance)
    authMiddleware.ts      # authenticateToken (JWT) and requireAdmin
    schemas.ts             # Zod schemas for request bodies, params and queries
    validate.ts            # validateResource(schema) middleware, returns 400 with details
    serializers.ts         # shapes database rows into API responses
    errors.ts              # HttpError, thrown inside transactions to roll back with a status code
    payments.ts            # asks the payment server whether a Xendit invoice is really paid
    types/express/index.ts # adds req.user (the decoded token) to Express's Request type
    routes/
      products.ts          # /api/products
      auth.ts              # /api/auth
      cart.ts              # /api/cart
      orders.ts            # /api/orders
      admin.ts             # /api/admin
```

Each route file creates an Express `Router`, uses `validateResource(...)` for input and `authenticateToken` where login is needed, wraps its database work in `try/catch`, and is mounted in `server.ts`.

## API endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Returns `{ "status": "ok" }` when the API is running |

### Products

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/products` | All products. Optional `?search=` (name, case-insensitive) and `?category=` |
| GET | `/api/products/:id` | One product |

### Orders

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/orders` | 🔒 Places an order for the logged-in customer: checks stock, uses database prices, saves the order, lowers stock and removes the ordered items from the saved cart in one transaction |
| GET | `/api/orders` | 🔒 The logged-in customer's orders, newest first |
| PATCH | `/api/orders/:id/cancel` | 🔒 Cancels the customer's own order while it's still PENDING and puts its items back into stock. 409 once it's paid, shipped or delivered |

For an online payment, send `"paymentMethod": "xendit"` and `"invoiceId": "<Xendit invoice id>"`; the order is saved as PAID only after the server confirms that invoice with Xendit.

🔒 = needs `Authorization: Bearer <token>` from login or register.

Example order:

```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "items": [{ "productId": 1, "quantity": 2 }],
  "shippingAddress": {
    "fullName": "Juan dela Cruz",
    "phone": "09171234567",
    "street": "123 Rizal St",
    "city": "Iloilo City",
    "province": "Iloilo",
    "postalCode": "5000"
  },
  "paymentMethod": "cod"
}
```

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Creates an account and logs it in. Needs a valid email and a password of at least 8 characters; the password is hashed with bcrypt. Returns `{ message, user, token }` |
| POST | `/api/auth/login` | Checks email and password. Returns `{ message, user, token }` |
| POST | `/api/auth/logout` | Tokens aren't stored on the server, so the client deletes its copy |
| GET | `/api/auth/me` | 🔒 The logged-in user (used to restore a login after a reload) |

### Cart

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/cart` | 🔒 The logged-in customer's saved cart, with product details |
| PUT | `/api/cart` | 🔒 Saves the whole cart. Body: `{ "items": [{ "productId": 1, "quantity": 2 }] }`. Quantities are capped at stock; out-of-stock products are dropped. Returns the cart as saved |

### Payment server

Base URL: `http://localhost:4000`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/invoices` | Creates a Xendit invoice and returns its payment URL |
| GET | `/api/invoices/:id` | Invoice `status` (PENDING, PAID, SETTLED, EXPIRED), `amount` and `externalId`; the REST API uses it to confirm online payments |
| POST | `/webhooks/xendit` | Receives Xendit payment callbacks |

### Responses

| Code | Meaning |
| --- | --- |
| 200 / 201 | Success / created |
| 400 | Validation failed: `{ "error": "Validation failed", "details": [{ "path": "body.email", "message": "..." }] }` |
| 401 | Wrong email or password, or no token |
| 403 | Invalid or expired token, or not an admin |
| 404 | Product, order or cart item not found |
| 409 | Not enough stock, or email already registered |
| 500 | Unexpected server error |

## Database

Defined in `backend/prisma/schema.prisma`:

- **User**: email, bcrypt password hash, admin flag
- **Product**: name, category, price (`Decimal(10,2)`), image, stock
- **CartItem**: a user's product and quantity, one row per user and product
- **Order**: status, shipping address, payment method, the customer who placed it
- **OrderItem**: product, quantity and `unitPrice` copied at checkout, so past orders keep the price paid

Models use PascalCase and fields camelCase in code; `@@map` / `@map` keep the database's snake_case table and column names (`orders`, `order_items`, `unit_price`, ...).

## Troubleshooting

- **"Couldn't load products"** in the store: the API isn't running. Start `npm run dev` in `backend/`.
- **"Failed to fetch"** at card or GCash checkout: the payment server isn't running. Start `npm run dev` in `server/`.
- **"Couldn't reach the payment server to confirm the payment"**: the REST API can't reach `PAYMENT_SERVER_URL`. Start the payment server and check the URL in `backend/.env`.
- **Xendit rejects the invoice**: check `XENDIT_SECRET_KEY` is a secret key, not the public one, and that Cards and GCash are enabled in test mode. Restart the payment server after changing `.env`.
- **`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`** during `prisma generate`: a running Node process has the file open. Stop `npm run dev`, then run it again.
- **Prisma offers to reset the database**: don't accept, it deletes your data. Run `npm run prisma:status` and check the migration history first.

## Team

- Nikko T. Delos Santos
- Mark Angelo L. Florencio
- Niño Kriebel C. Olmo