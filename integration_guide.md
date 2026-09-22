# Payment Processor — Integration Guide

> **Version**: 1.0  
> **Public URL**: `https://ludicrous-unsorted-balance.ngrok-free.dev`  
> **Gateway Support**: Selcom · AzamPay  
> **Emulator**: Built-in sandbox for testing without real credentials

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Quick Start](#2-quick-start)
3. [Initiate a Payment](#3-initiate-a-payment)
4. [Handling Callbacks](#4-handling-callbacks)
5. [Using the Emulator](#5-using-the-emulator)
6. [Configuration API](#6-configuration-api)
7. [Going Live (Real Gateways)](#7-going-live-real-gateways)
8. [Error Reference](#8-error-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture Overview

The Payment Processor is a **standalone middleware service** that sits between your web application and real payment gateways (Selcom, AzamPay). Your app never talks to Selcom or AzamPay directly — all that complexity is handled here.

```
┌─────────────────────┐         ┌──────────────────────────┐        ┌──────────────────┐
│   Your Web App      │  POST   │   Payment Processor      │  API   │  Selcom /        │
│                     │────────▶│   (this service)         │───────▶│  AzamPay         │
│  1. Initiate        │         │                          │        └──────────────────┘
│  2. Receive callback│         │  • Authenticates          │
│                     │◀────────│  • Signs requests         │◀────── Gateway Webhook
└─────────────────────┘ forward │  • Logs all transactions  │
                        callback│  • Forwards callbacks     │
                                └──────────────────────────┘
```

### Key Points

- Your app sends **one API call** to initiate payment.
- The processor handles authentication, signing, and gateway communication.
- The gateway calls back the processor with payment status.
- The processor **forwards a normalized callback** to your `webapp_callback_url`.
- All transactions are logged and visible in the processor's admin panel.

---

## 2. Quick Start

### Step 1: Configure the Processor

Open the admin panel at:

```
https://ludicrous-unsorted-balance.ngrok-free.dev/
```

Set your **WebApp Callback URL** — this is where the processor will forward payment results to your app:

```
http://your-app.example.com/api/payments/callback
```

For local testing, use ngrok to expose your local server, e.g.:

```
http://abc123.ngrok.io/api/payments/callback
```

### Step 2: Choose a Gateway

Set the **Active Gateway** to `selcom` or `azampay` in the admin panel.

For testing without real credentials, use the **Emulator** (see Section 5).

---

## 3. Initiate a Payment

### Endpoint

```
POST https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate
Content-Type: application/json
Accept: application/json
```

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | ✅ | Payment amount in TZS (minimum: 1) |
| `phone` | string | ✅ | Customer phone number (accepts 07xx, 255xx, 9-digit) |
| `external_reference` | string | ✅ | Your unique order/invoice ID |
| `gateway` | string | ❌ | `selcom` or `azampay` (defaults to active gateway) |
| `name` | string | ❌ | Customer full name |
| `email` | string | ❌ | Customer email address |
| `remarks` | string | ❌ | Payment description or notes |

### Example Request

```json
{
  "amount": 15000,
  "phone": "0712345678",
  "external_reference": "ORDER-2026-00142",
  "gateway": "selcom",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "remarks": "Invoice #142 — Consultation fee"
}
```

### Success Response `200 OK`

```json
{
  "success": true,
  "external_reference": "ORDER-2026-00142",
  "gateway_reference": "SEL-REF-XXXXXXX",
  "payment_url": "https://checkout.selcom.net/pay/...",
  "message": "Payment initiated successfully."
}
```

> **`payment_url`**: For **Selcom**, redirect your customer to this URL to complete checkout.  
> For **AzamPay**, this is `null` — the customer will receive a USSD push on their phone.

### Failure Response `502 Bad Gateway`

```json
{
  "success": false,
  "external_reference": "ORDER-2026-00142",
  "message": "Connection to Selcom failed: cURL error 28..."
}
```

### Validation Error `422 Unprocessable Entity`

```json
{
  "message": "The amount field is required.",
  "errors": {
    "amount": ["The amount field is required."]
  }
}
```

### Code Examples

#### PHP (Laravel/Guzzle)

```php
use Illuminate\Support\Facades\Http;

$response = Http::post('https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate', [
    'amount'             => 15000,
    'phone'              => '0712345678',
    'external_reference' => 'ORDER-' . $order->id,
    'name'               => $order->customer->name,
    'email'              => $order->customer->email,
    'remarks'            => 'Invoice #' . $order->id,
]);

$data = $response->json();

if ($data['success']) {
    // For Selcom: redirect customer to checkout
    if (isset($data['payment_url'])) {
        return redirect($data['payment_url']);
    }
    // For AzamPay: USSD push sent, show waiting screen
    return view('payment.waiting', ['reference' => $data['external_reference']]);
}

// Handle failure
return back()->with('error', $data['message']);
```

#### JavaScript (Fetch)

```javascript
const response = await fetch('https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({
    amount: 15000,
    phone: '0712345678',
    external_reference: 'ORDER-2026-00142',
    name: 'Jane Doe',
  }),
});

const data = await response.json();

if (data.success && data.payment_url) {
  window.location.href = data.payment_url; // Selcom redirect
} else if (data.success) {
  showWaitingScreen(); // AzamPay USSD push
} else {
  alert('Payment failed: ' + data.message);
}
```

#### cURL

```bash
curl -X POST https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "amount": 5000,
    "phone": "0712345678",
    "external_reference": "ORDER-TEST-001",
    "gateway": "selcom"
  }'
```

---

## 4. Handling Callbacks

When a payment is completed (successfully or not), the gateway notifies the processor, which then **forwards a normalized payload** to your `webapp_callback_url`.

### Your Callback Endpoint

Your app must expose a **POST endpoint** at the URL you configured. Example:

```
POST https://your-app.example.com/api/payments/callback
Content-Type: application/json
```

### Callback Payload (Unified Format)

Regardless of which gateway was used, you will always receive this normalized structure:

```json
{
  "external_reference": "ORDER-2026-00142",
  "gateway": "selcom",
  "gateway_reference": "SEL-REF-XXXXXXX",
  "amount": 15000.0,
  "status": "success",
  "phone": "255712345678",
  "message": "Payment succeeded",
  "timestamp": "2026-07-21T20:38:50+03:00"
}
```

### Payload Fields

| Field | Type | Description |
|---|---|---|
| `external_reference` | string | Your original order/invoice ID |
| `gateway` | string | `selcom` or `azampay` |
| `gateway_reference` | string | Transaction reference from the gateway |
| `amount` | float | Amount paid (TZS) |
| `status` | string | `success` or `failed` |
| `phone` | string | Customer phone (E.164 format: `255xxxxxxxxx`) |
| `message` | string | Human-readable result message |
| `timestamp` | string | ISO-8601 timestamp of the callback |

### Callback Handler Example (Laravel)

```php
// routes/api.php
Route::post('/payments/callback', [PaymentController::class, 'handleCallback']);

// app/Http/Controllers/PaymentController.php
public function handleCallback(Request $request)
{
    $data = $request->all();

    $order = Order::where('reference', $data['external_reference'])->first();

    if (!$order) {
        Log::warning('Unknown payment reference: ' . $data['external_reference']);
        return response()->json(['ok' => false], 404);
    }

    if ($data['status'] === 'success') {
        $order->update(['payment_status' => 'paid', 'paid_at' => now()]);
        // Trigger: send receipt, activate service, etc.
    } else {
        $order->update(['payment_status' => 'failed']);
        // Trigger: notify customer, retry flow, etc.
    }

    // Always return 2xx to acknowledge receipt
    return response()->json(['ok' => true]);
}
```

> **Important**: Always return `HTTP 200` from your callback handler. If the processor receives an error, it logs a warning but the payment result is not retried.

### Callback Handler Example (Node.js/Express)

```javascript
app.post('/api/payments/callback', express.json(), (req, res) => {
  const { external_reference, status, amount, gateway } = req.body;

  console.log(`Payment ${status} for order ${external_reference} via ${gateway}`);

  if (status === 'success') {
    // Mark order as paid in your DB
    Order.markPaid(external_reference, amount);
  }

  res.json({ ok: true }); // Must respond 2xx
});
```

---

## 5. Using the Emulator

The emulator lets you test the **full end-to-end payment flow** — without real gateway credentials, real phone numbers, or real money.

### How It Works

```
Your App → Processor → [Emulator Fake Gateway] → Emulator UI (you click Approve/Reject) → Callback → Processor → Your App
```

### Step 1: Configure Processor to Use Emulator

Open the Config panel at `/` and set these URLs:

| Config Key | Emulator Value |
|---|---|
| **AzamPay Base URL** | `https://ludicrous-unsorted-balance.ngrok-free.dev/api/emulator/azampay` |
| **AzamPay Auth Base URL** | `https://ludicrous-unsorted-balance.ngrok-free.dev/api/emulator/azampay` |
| **Selcom Base URL** | `https://ludicrous-unsorted-balance.ngrok-free.dev/api/emulator/selcom` |

You can use any dummy value for API keys/secrets (the emulator ignores them).

### Step 2: Open the Emulator UI

Navigate to:

```
https://ludicrous-unsorted-balance.ngrok-free.dev/emulator
```

You'll see a split-panel interface:

- **Left**: Initiate a test payment directly from the emulator, or let your app initiate one.
- **Right**: Transaction queue showing all pending/resolved transactions with live auto-refresh.

### Step 3: Initiate a Test Payment

Either:

**A) From your app** — Call the normal `/api/v1/payments/initiate` endpoint as usual. The transaction will appear in the emulator queue.

**B) From the emulator UI** — Fill in the form on the left and click "Send Payment Request."

For **Selcom**, a fake checkout page will open in a new tab where you can click Confirm or Cancel.

### Step 4: Resolve the Transaction

In the emulator transaction queue:

| Button | Effect |
|---|---|
| ✅ **Approve** | Fires a `status: success` callback to your app |
| ❌ **Reject** | Fires a `status: failed` callback to your app |
| ⏱ **Timeout** | Marks as timed out, fires a `status: failed` callback |

After clicking, the processor receives the callback, updates the `PaymentLog`, and immediately forwards the normalized payload to your `webapp_callback_url`.

### Selcom Checkout URL

When you initiate a Selcom payment, the response includes a `payment_url` like:

```
https://ludicrous-unsorted-balance.ngrok-free.dev/emulator/selcom-pay/ORDER-XYZ
```

Open this URL to see the fake Selcom checkout page where you can click **Confirm & Pay** or **Cancel**.

---

## 6. Configuration API

The processor exposes an API to read and update configuration programmatically (useful for CI/CD pipelines or automated tests).

### Get Current Config

```
GET /api/v1/config
Accept: application/json
```

Response:

```json
{
  "active_gateway": "selcom",
  "webapp_callback_url": "https://your-app.example.com/api/payments/callback",
  "available_gateways": ["selcom", "azampay"]
}
```

### Update Config

```
POST /api/v1/config
Content-Type: application/json
```

Request Body:

```json
{
  "active_gateway": "azampay",
  "webapp_callback_url": "https://your-app.example.com/api/payments/callback"
}
```

Response:

```json
{
  "success": true,
  "message": "Configuration updated successfully.",
  "active_gateway": "azampay",
  "webapp_callback_url": "https://your-app.example.com/api/payments/callback"
}
```

---

## 7. Going Live (Real Gateways)

### Selcom

1. Register at [Selcom Partner Portal](https://dev.selcom.net/)
2. Get your: **API Key**, **Secret Key**, **Vendor ID**
3. In the processor Config panel, set:
   - **Selcom Base URL**: `https://apigw.selcom.net` (production)
   - **API Key**, **Secret Key**, **Vendor**: your production credentials
4. Set **Active Gateway** to `selcom`

### AzamPay

1. Register at [AzamPay Developer Portal](https://developers.azampay.co.tz/)
2. Get your: **Client ID**, **Client Secret**, **App Name**, **API Key**
3. In the processor Config panel, set:
   - **AzamPay Base URL**: `https://checkout.azampay.co.tz` (production)
   - **AzamPay Auth Base URL**: `https://authenticator.azampay.co.tz` (production)
   - Fill in all credentials
4. Set **Active Gateway** to `azampay`

### Phone Number Formats Supported

The processor auto-normalizes phone numbers to E.164 (`255xxxxxxxxx`). All these formats are accepted:

| Input | Normalized |
|---|---|
| `0712345678` | `255712345678` |
| `255712345678` | `255712345678` |
| `712345678` | `255712345678` |
| `+255712345678` | `255712345678` |

### AzamPay MNO Detection (Auto)

AzamPay requires specifying the mobile network operator. The processor auto-detects it from the phone prefix:

| Prefix | Operator |
|---|---|
| 075x, 076x, 074x, 061x | Mpesa |
| 065x, 067x, 071x | Tigo |
| 068x, 069x, 078x | Airtel |
| 062x | Halopesa |
| 073x | Azampesa |

---

## 8. Error Reference

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200 OK` | Payment initiated successfully |
| `400 Bad Request` | Invalid gateway name specified |
| `422 Unprocessable Entity` | Validation failed (missing/invalid fields) |
| `502 Bad Gateway` | Gateway returned an error or is unreachable |

### Common Errors

| Error Message | Cause | Fix |
|---|---|---|
| `Connection to Selcom failed: cURL error 28` | Selcom API timeout | Check Selcom base URL; use sandbox for testing |
| `Unable to detect mobile operator from phone number prefix` | Unsupported phone prefix (AzamPay) | Ensure phone starts with a valid Tanzanian prefix |
| `Failed to generate AzamPay token` | Wrong credentials or auth URL | Check Client ID, Secret, and Auth Base URL |
| `Gateway initiation failed` | Gateway returned non-success response | Check gateway credentials and sandbox mode |
| `Invalid gateway: xyz` | Unsupported gateway name | Use `selcom` or `azampay` |

---

## 9. Troubleshooting

### "My callback is not being received"

1. Check that `webapp_callback_url` is correctly set in the admin panel.
2. Ensure your callback URL is **publicly accessible** (use ngrok for local dev).
3. Check the processor's Laravel log at `storage/logs/laravel.log` for forwarding errors.
4. Your endpoint must return **HTTP 2xx**. Non-2xx responses are logged as errors.

### "The payment log shows 'pending' after a long time"

The payment was initiated but no callback was received. Possible causes:
- The gateway failed to send a callback (check gateway dashboard).
- The callback URL was not reachable.
- For **emulator**: you haven't clicked Approve/Reject yet.

### "I get 403 on callbacks"

The processor verifies webhook signatures. For Selcom, callbacks require `Digest`, `Timestamp`, and `Signed-Fields` headers. If your testing tool fires raw callbacks, use the emulator instead.

### "Selcom payment_url is a base64 string"

Selcom encodes the URL in base64. The processor automatically decodes it before returning to you — you receive a plain URL in the response.

### Checking Logs

SSH into the processor server or view logs at:

```
storage/logs/laravel.log
```

Useful log entries to search for:
- `Incoming callback from:` — raw callback received
- `Failed to forward callback to WebApp` — your callback URL unreachable
- `[EMULATOR]` — emulator-related events
- `Callback signature verification failed` — signature mismatch

---

## Appendix: Emulator Fake Endpoint Reference

These are the fake API endpoints the processor calls when configured to use the emulator:

| Method | Path | Mimics |
|---|---|---|
| `POST` | `/api/emulator/azampay/AppRegistration/GenerateToken` | AzamPay token generation |
| `POST` | `/api/emulator/azampay/azampay/mno/checkout` | AzamPay USSD push initiation |
| `POST` | `/api/emulator/selcom/checkout/create-order-minimal` | Selcom order creation |
| `GET` | `/api/emulator/transactions` | List all emulator transactions |
| `POST` | `/api/emulator/resolve/{id}` | Approve / reject / timeout a transaction |
| `GET` | `/emulator` | Emulator UI dashboard |
| `GET` | `/emulator/selcom-pay/{orderId}` | Fake Selcom checkout page |

---

*Last updated: 2026-07-21 — Payment Processor v1.0*
