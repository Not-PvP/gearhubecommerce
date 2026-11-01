# GearHub

GearHub is an e-commerce web app for gaming gear, built for the QuickCart Express project spec. Customers browse and search products, add them to a cart, and check out with cash on delivery, card or GCash.

It runs as three parts on your machine:

| Part | Folder | Tech | Port |
| --- | --- | --- | --- |
| Storefront | project root | React, TypeScript, `useReducer` + Context | 3000 |
| REST API | `backend/` | Express, TypeScript, Prisma, PostgreSQL | 5000 |
| Payment server | `server/` | Express, Xendit Invoice API (test mode) | 4000 |

The storefront holds no data of its own. Products and orders come from the REST API, and the payment server keeps the Xendit secret key off the browser.

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
```

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
npm start

# Terminal 3: storefront on http://localhost:3000
npm start
```

The payment server is only needed for card and GCash checkout. Cash on delivery works with the API and storefront alone.

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
   Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/users/register -ContentType "application/json" -Body '{"email":"admin@gearhub.com","password":"admin1234"}'
   ```

2. Mark it as admin. From `backend/`, run `npx prisma studio`, open the `users` table, set `isAdmin` to `true` for that user, and click **Save**.

3. Sign in at `/#/admin`. You can use your own email and password instead of the example above.

### What it does

- Lists all orders with a status filter.
- Changes an order's status: PENDING, PAID, SHIPPED, DELIVERED or CANCELLED.
- Cancelling an order returns its items to stock. Cancelled orders can't be changed, and delivered orders can't be cancelled.
- Shows products with 5 or fewer left in stock.

### Admin endpoints

These need the headers `x-admin-email` and `x-admin-password`. They return 401 for wrong credentials and 403 if the account isn't an admin.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/me` | Checks the admin login |
| GET | `/api/admin/orders` | All orders, newest first |
| PATCH | `/api/admin/orders/:id/status` | Updates an order's status. Body: `{ "status": "SHIPPED" }` |
| GET | `/api/admin/low-stock?threshold=5` | Products at or below the threshold |

## Useful backend scripts

Run these from `backend/`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API and restarts it when files change |
| `npm run seed` | Loads or resets the 18 products from `prisma/seed-data/products.json` |
| `npm run prisma:migrate` | Creates and applies a migration after you edit `prisma/schema.prisma` |
| `npm run prisma:status` | Checks the database matches the migrations |
| `npm run prisma:generate` | Regenerates the Prisma client (stop `npm run dev` first on Windows) |

## API endpoints

Base URL: `http://localhost:5000`

### Products

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/products` | All products |
| GET | `/api/products/:id` | One product |

### Orders

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/orders` | Places an order: checks stock, uses database prices, saves the order and lowers stock in one transaction |
| GET | `/api/orders?ids=1,2,3` | Orders by id (guest order history) |

Example order:

```http
POST /api/orders
Content-Type: application/json
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

### Users

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/users/register` | Creates an account; the password is hashed with bcrypt |
| POST | `/api/users/login` | Checks email and password |

### Cart

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/cart/:userId` | A user's cart |
| POST | `/api/cart` | Adds an item, or increases its quantity if it's already there |
| PUT | `/api/cart/:id` | Sets an item's quantity; 0 or less removes it |
| DELETE | `/api/cart/:id` | Removes an item |

### Payment server

Base URL: `http://localhost:4000`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/invoices` | Creates a Xendit invoice and returns its payment URL |
| GET | `/api/invoices/:id` | Invoice status (PENDING, PAID, SETTLED, EXPIRED) |
| POST | `/webhooks/xendit` | Receives Xendit payment callbacks |

### Responses

| Code | Meaning |
| --- | --- |
| 200 / 201 | Success / created |
| 400 | Invalid input, with a message saying which field |
| 401 | Wrong email or password |
| 404 | Product, order or cart item not found |
| 409 | Not enough stock, or email already registered |
| 500 | Unexpected server error |

## Database

Defined in `backend/prisma/schema.prisma`:

- **User**: email, bcrypt password hash, admin flag
- **Product**: name, category, price (`Decimal(10,2)`), image, stock
- **CartItem**: a user's product and quantity, one row per user and product
- **orders**: status, shipping address, payment method
- **order_items**: product, quantity and `unit_price` copied at checkout, so past orders keep the price paid

## Troubleshooting

- **"Couldn't load products"** in the store: the API isn't running. Start `npm run dev` in `backend/`.
- **"Failed to fetch"** at card or GCash checkout: the payment server isn't running. Start `npm start` in `server/`.
- **Xendit rejects the invoice**: check `XENDIT_SECRET_KEY` is a secret key, not the public one, and that Cards and GCash are enabled in test mode. Restart the payment server after changing `.env`.
- **`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`** during `prisma generate`: a running Node process has the file open. Stop `npm run dev`, then run it again.
- **Prisma offers to reset the database**: don't accept, it deletes your data. Run `npm run prisma:status` and check the migration history first.

## Team

- Mark Angelo L. Florencio
- Niño Kriebel C. Olmo
- Nikko T. Delos Santos