# Stockify POS & Store Management API (AppsDev Stack)

A high-performance REST API for the **Stockify / Tindahan POS & Inventory Management System**, rewritten from Laravel (PHP) into the modern Node.js + TypeScript tech stack used in `AppsDev_Activity/appsdev-api-tutorial`.

---

## 🛠️ Tech Stack & Architecture

This application adopts the architectural conventions and packages of **`Desktop/AppsDev_Activity/appsdev-api-tutorial`**:

- **Runtime & Language**: Node.js & TypeScript (ES2023, ESNext)
- **Framework**: Express 5 (`express`)
- **Database & ORM**: PostgreSQL (`pg`) with Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Validation**: Zod 4 (`zod`)
- **Authentication**: JWT (`jsonwebtoken`), bcrypt (`bcrypt`), HTTP cookies (`cookie-parser`)
- **Security & Headers**: Helmet (`helmet`), CORS (`cors`), HPP (`hpp`), CSRF protection (`csrf-csrf`)
- **Development & Build Tooling**: `tsx`, `tsdown`, `eslint`, `typescript-eslint`

### Architectural Pattern: Controller-Service-Repository

```
src/
├── app.ts                 # Express app configuration & middlewares
├── server.ts              # Server lifecycle and network listening
├── config/
│   └── env.ts             # Typed environment configuration
├── db/
│   ├── index.ts           # PostgreSQL connection pool and Drizzle client
│   └── schema.ts          # Relational tables: stores, users, products, shifts, sales, etc.
├── lib/
│   ├── auth-cookies.ts    # Secure cookie helpers for tokens and CSRF
│   ├── csrf.ts            # Double CSRF protection
│   └── jwt.ts             # Access & refresh token signing and verification
├── middlewares/
│   ├── auth-middleware.ts           # Bearer and Cookie authentication
│   ├── csrf-middleware.ts           # CSRF verification with Bearer token bypass
│   ├── role-validator-middleware.ts # Role enforcement (owner vs employee)
│   └── schema-middleware.ts         # Zod request validation
├── repositories/          # Direct database access layer
│   ├── user-repository.ts
│   ├── store-repository.ts
│   ├── product-repository.ts
│   ├── shift-repository.ts
│   ├── sale-repository.ts
│   ├── stock-movement-repository.ts
│   ├── operation-repository.ts
│   └── token-repository.ts
├── services/              # Business logic layer
│   ├── auth/              # Signup, login, PIN login, session, refresh, logout
│   ├── products/          # Catalog browsing, barcode lookup, creation, restocking
│   ├── shifts/            # Register shift start/end, active shift stats, audit log
│   ├── sales/             # POS checkout transaction, stock deduction, audit logging
│   ├── staff/             # Cashier user management, PIN resets
│   ├── operations/        # Cash drops & expense accounting
│   ├── analytics/         # Descriptive, predictive, and prescriptive analytics
│   ├── forecast/          # Day-of-week seasonal regression and restock pacing
│   └── reports/           # Periodic sales reporting (daily, weekly, monthly, yearly)
├── controllers/           # HTTP handlers converting requests into service calls
├── routes/                # Modular Express routers
├── schema/                # Zod schemas for request validation
└── seed/
    └── demo-seeder.ts     # Realistic demo seeder with 90 days of sales history
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
APP_NAME=Stockify POS API
PORT=3001
NODE_ENV=development
JWT_SECRET=dea4828575f9a05f7acee3c95f42d3890192837465abcedf
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tindahan
```

### 3. Database Setup
Set your PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```
*(You can use a local PostgreSQL installation or cloud PostgreSQL providers such as Neon or Supabase, exactly as in `appsdev-api-tutorial`).*

### 4. Push Schema & Seed Demo Data
Push schema migrations to PostgreSQL:
```bash
npm run db:migrate
```
Populate the database with the default store (`STCK01`), owner, cashiers, starter products, and 90 days of realistic sales:
```bash
npm run db:seed
```

### 5. Run the Application
For development with hot-reloading:
```bash
npm run dev
```
For production build and run:
```bash
npm run build
npm start
```

---

## 👥 Demo Credentials (After Seeding)

| Account | Identifier / PIN | Role | Purpose |
|---|---|---|---|
| **Store Owner** | `owner@stockify.ph` / `password` | Owner | Full management, products, staff, analytics |
| **Owner PIN** | `1234` | Owner | Register unlock / owner override |
| **Maria Santos** | PIN: `1111` | Cashier | POS sales & shift operations |
| **Carlos Mendoza**| PIN: `2222` | Stock Clerk | Inventory management |
| **Ana Reyes** | PIN: `3333` | Cashier | POS sales & shift operations |

**Store Code**: `STCK01`

---

## 🔌 Connecting with `im_frontend`

In `Desktop/IM_Finals/im_frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
```
Run `npm run dev` in `im_frontend` and log in immediately using the demo credentials!

---

## 📡 API Endpoints Reference

### Authentication & Sessions
- `POST /api/auth/register` - Create new store & owner account
- `POST /api/auth/login` - Owner email/password login
- `POST /api/auth/pin-login` - Staff terminal login via 4-digit PIN
- `GET /api/stores/:code/staff` - Retrieve staff members for terminal picker
- `GET /api/me` - Current authenticated user & store session
- `POST /api/auth/logout` - Logout & session revocation
- `POST /api/auth/refresh-token` - Token rotation
- `GET /api/auth/csrf-token` - Issue double-CSRF protection token

### Products & Inventory
- `GET /api/products` - List products (supports `?q=...` search)
- `GET /api/products/lookup?code=...` - Barcode / SKU lookup
- `POST /api/products` - Add product (Owner only)
- `PUT /api/products/:id` - Edit product (Owner only)
- `DELETE /api/products/:id` - Soft-delete product (Owner only)
- `POST /api/products/:id/restock` - Restock product & record movement (Owner only)

### POS & Shifts
- `GET /api/shifts/current` - Active cashier/store shift
- `POST /api/shifts/start` - Open a new register shift
- `POST /api/shifts/end` - Close the active shift
- `GET /api/shifts` - Past shifts audit log with item summaries
- `POST /api/sales` - Record transaction, check stock, and deduct inventory

### Store Staff
- `GET /api/staff` - List employees (Owner only)
- `POST /api/staff` - Register new employee (Owner only)
- `PATCH /api/staff/:id/pin` - Reset employee PIN (Owner only)
- `DELETE /api/staff/:id` - Remove employee (Owner only)

### Operations
- `GET /api/cash-drops` - List recent cash drawer drops
- `POST /api/cash-drops` - Record cash drop
- `GET /api/expenses` - List recent store expenses
- `POST /api/expenses` - Record store expense

### Analytics & Reports
- `GET /api/analytics?days=30` - Descriptive KPIs, hourly/weekday distribution, predictive forecast, and prescriptive recommendations
- `GET /api/reports/sales?period=daily|weekly|monthly|yearly` - Periodic sales buckets & top products
- `GET /api/reports/forecast?horizon=14` - Seasonal trend forecast
- `GET /api/reports/restock-suggestions` - Stock run-out velocity & restock suggestion
