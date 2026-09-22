# Payment Processor Middleware (Cloudflare Workers + JavaScript)

A high-performance, ultra-low-latency payment processor middleware built in pure JavaScript for **Cloudflare Workers**, **Hono**, and **Cloudflare D1**.

It acts as a standalone middleware service between your web application and mobile money payment gateways in Tanzania (**Selcom** and **AzamPay**).

---

## Key Features

- **Pure JavaScript & Cloudflare Workers**: Native V8 execution at 300+ global edge locations with 0ms cold starts.
- **Selcom Gateway Driver**: Standard Minimal Checkout API, HMAC SHA256 header generation, signature verification, and callback parsing.
- **AzamPay Gateway Driver**: Token generation, MNO checkout (USSD Push), automatic phone operator detection (Vodacom Mpesa, Tigo Pesa, Airtel Money, HaloPesa, AzamPesa), HMAC signature verification.
- **Serverless SQL Database (Cloudflare D1)**: Persistent storage for configurations, payment logs, and sandbox emulator transactions.
- **Admin Configuration Dashboard (`/`)**: Web UI to manage credentials, active gateway driver, webapp callback URL, live connection testing, and transaction log management with bulk deletion/retry and CSV/JSON exports.
- **Built-in Payment Emulator (`/emulator`)**: Interactive sandbox to test payment initiation, USSD pushes, and webhooks locally without real credentials.

---

## Architecture Overview

```
┌───────────────────────────────┐
│   Client Application / WebApp │
└───────────────┬───────────────┘
                │ HTTP POST /api/v1/payments/initiate
                ▼
┌─────────────────────────────────────────────────────────────┐
│             Cloudflare Worker (Hono + JavaScript)           │
├───────────────────────────────┬─────────────────────────────┤
│  API Routes (`src/routes/`)   │  Admin Panel & Emulator UI  │
├───────────────────────────────┴─────────────────────────────┤
│  Gateway Drivers (`src/gateways/`)                          │
│  - SelcomGateway.js                                         │
│  - AzamPayGateway.js                                        │
└───────────────┬───────────────────────────────┬─────────────┘
                │                               │
                ▼                               ▼
    ┌───────────────────────┐       ┌──────────────────────┐
    │  Cloudflare D1 (SQL)  │       │  Selcom & AzamPay    │
    │  - configs            │       │  External Gateways   │
    │  - payment_logs       │       └──────────────────────┘
    │  - emulator_txns      │
    └───────────────────────┘
```

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Local Development Server

```bash
npm run dev
```

This starts the Cloudflare Workers dev server using **Wrangler** (usually at `http://localhost:8787`).

### 3. Initialize Local D1 Database Schema

To initialize or reset the local SQLite database schema:

```bash
npm run db:migrate:local
```

---

## Deploying to Cloudflare

To deploy your worker to production on Cloudflare Workers:

```bash
# 1. Create a remote D1 database (first time only)
npx wrangler d1 create payment-processor-db

# 2. Update `wrangler.jsonc` with the database_id returned by wrangler

# 3. Apply schema migrations to remote D1
npm run db:migrate

# 4. Deploy worker to production
npm run deploy
```

---

## API Summary

- `POST /api/v1/payments/initiate` — Initiate a payment
- `GET /api/v1/payments/status/:external_reference` — Check payment status
- `POST /api/v1/callbacks/:gateway` — Webhook endpoint for gateways
- `GET /api/v1/config` & `POST /api/v1/config` — Retrieve / Update middleware configurations
- `GET /api/v1/logs` — Query transaction logs JSON

For full integration details, see `integration_guide.md`.
