# Payment Processor Integration Guide

This guide explains how to connect your web application to the Payment Processor API.

---

## How It Works

The Payment Processor manages payment routing behind the scenes. 

* **No provider selection needed:** Your web app does not specify or track which payment gateway is being used (e.g., M-Pesa, Tigo, Selcom, AzamPay). The active gateway is configured in the Payment Processor admin dashboard.
* **USSD Push payments:** Payment initiation triggers a USSD push prompt on the customer's phone asking them to enter their mobile wallet PIN.
* **Asynchronous updates:** When the customer approves the transaction, the processor notifies your app via a webhook callback.

---

## 1. Initiate a Payment

When a customer checks out, send a `POST` request to initiate the payment.

### Endpoint

```http
POST https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate
Content-Type: application/json
Accept: application/json
```

### Request Payload

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | numeric | Yes | Amount in TZS (e.g. `15000`) |
| `phone` | string | Yes | Customer phone number (e.g. `0712345678` or `255712345678`) |
| `external_reference` | string | Yes | Unique order or invoice reference from your system |
| `name` | string | No | Customer full name |
| `email` | string | No | Customer email address |
| `remarks` | string | No | Optional description or notes |

> **Note:** Do not send a `gateway` or `provider` parameter. The processor handles provider selection automatically.

### Example Request

```json
{
  "amount": 15000,
  "phone": "0712345678",
  "external_reference": "INV-2026-881",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "remarks": "Order #INV-2026-881"
}
```

### Response Handling

#### Success (`success: true`)
A USSD prompt has been sent to the customer's phone.

```json
{
  "success": true,
  "external_reference": "INV-2026-881",
  "gateway_reference": "REF-89109312",
  "message": "Payment initiated successfully."
}
```

**What to do in your UI:** Show a waiting message instructing the user to check their phone and enter their PIN to authorize the payment.

#### Error (`success: false`)
The request failed (e.g., invalid phone format or provider issue).

```json
{
  "success": false,
  "external_reference": "INV-2026-881",
  "message": "Invalid phone number format."
}
```

**What to do in your UI:** Show the error message to the customer so they can check their number and try again.

---

## 2. Receive Webhook Callbacks

Once the customer completes the payment (or if it fails), the processor posts a notification to your callback URL.

### Setting Up Your Webhook URL
In the Payment Processor **Admin Control Panel**, set your **Web App Callback URL**, for example:
`https://yourwebapp.com/api/v1/payments/callback`

### Webhook Payload

```json
{
  "external_reference": "INV-2026-881",
  "gateway_reference": "REF-89109312",
  "amount": 15000.00,
  "status": "success",
  "phone": "255712345678",
  "message": "Payment completed successfully",
  "timestamp": "2026-07-21T17:45:00+03:00"
}
```

* `status` will be either `"success"` or `"failed"`.
* Your endpoint must return an **HTTP 200 OK** response to confirm receipt.

---

## 3. Manual Status Check & Network Fallbacks

If a callback fails to deliver due to network issues or server downtime, your system should allow manual status verification.

### Recommended Implementation
Add a **"Recheck Payment Status"** button on pending orders in your customer dashboard or admin panel. When clicked, your backend queries the status endpoint to fetch the latest state.

### Status Endpoint

```http
GET https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/status/{external_reference}
Accept: application/json
```

### Possible Status Responses

#### 1. Payment Successful
```json
{
  "success": true,
  "external_reference": "INV-2026-881",
  "status": "success",
  "amount": 15000.00,
  "gateway_reference": "REF-89109312",
  "message": "Payment completed successfully"
}
```
Mark the order as paid in your database.

#### 2. Payment Pending
```json
{
  "success": true,
  "external_reference": "INV-2026-881",
  "status": "pending",
  "amount": 15000.00,
  "message": "Payment is pending"
}
```
Keep order status as pending and prompt the user to complete PIN entry.

#### 3. Payment Failed
```json
{
  "success": true,
  "external_reference": "INV-2026-881",
  "status": "failed",
  "message": "Payment failed"
}
```
Mark the order as failed so the user can re-try.

---

## Code Examples

### PHP (Laravel)

```php
namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PaymentController extends Controller
{
    private string $processorUrl = 'https://ludicrous-unsorted-balance.ngrok-free.dev';

    // Initiate payment
    public function checkout(Order $order)
    {
        $response = Http::post($this->processorUrl . '/api/v1/payments/initiate', [
            'amount'             => $order->total_amount,
            'phone'              => $order->customer_phone,
            'external_reference' => $order->id,
            'name'               => $order->customer_name,
            'email'              => $order->customer_email,
            'remarks'            => 'Order #' . $order->id,
        ]);

        $result = $response->json();

        if ($response->successful() && !empty($result['success'])) {
            return view('checkout.waiting', [
                'order' => $order,
                'phone' => $order->customer_phone
            ]);
        }

        return back()->with('error', $result['message'] ?? 'Could not initiate payment.');
    }

    // Manual status recheck button action
    public function recheckStatus(string $orderId)
    {
        $response = Http::get($this->processorUrl . "/api/v1/payments/status/{$orderId}");
        $result = $response->json();

        if (!empty($result['success'])) {
            $order = Order::find($orderId);
            if ($order && $result['status'] === 'success') {
                $order->update(['status' => 'paid']);
                return back()->with('success', 'Payment confirmed.');
            } elseif ($order && $result['status'] === 'failed') {
                $order->update(['status' => 'failed']);
                return back()->with('error', 'Payment failed.');
            }
        }

        return back()->with('info', 'Payment is still pending PIN entry.');
    }

    // Webhook callback handler
    public function handleWebhook(Request $request)
    {
        $order = Order::find($request->input('external_reference'));
        if ($order) {
            $status = $request->input('status') === 'success' ? 'paid' : 'failed';
            $order->update(['status' => $status]);
        }

        return response()->json(['status' => 'ok']);
    }
}
```

---

### Node.js (Express & Axios)

```javascript
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PROCESSOR_URL = 'https://ludicrous-unsorted-balance.ngrok-free.dev';

// Initiate payment
app.post('/checkout', async (req, res) => {
  const { amount, phone, orderId, name, email } = req.body;

  try {
    const { data } = await axios.post(`${PROCESSOR_URL}/api/v1/payments/initiate`, {
      amount,
      phone,
      external_reference: orderId,
      name,
      email
    });

    if (data.success) {
      return res.json({ success: true, message: 'Check your phone for USSD PIN prompt.' });
    }
    return res.status(400).json({ success: false, error: data.message });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.response?.data?.message || 'Server error' });
  }
});

// Manual status recheck
app.get('/recheck-status/:orderId', async (req, res) => {
  try {
    const { data } = await axios.get(`${PROCESSOR_URL}/api/v1/payments/status/${req.params.orderId}`);
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Status check failed' });
  }
});

// Webhook listener
app.post('/api/v1/payments/callback', (req, res) => {
  const { external_reference, status } = req.body;
  console.log(`Order ${external_reference} status update: ${status}`);

  // Update order in database here

  return res.status(200).send('OK');
});
```

---

### Python (Requests)

```python
import requests

PROCESSOR_URL = "https://ludicrous-unsorted-balance.ngrok-free.dev"

def initiate_payment(amount, phone, order_id, name=None, email=None):
    payload = {
        "amount": amount,
        "phone": phone,
        "external_reference": str(order_id),
        "name": name,
        "email": email
    }
    res = requests.post(f"{PROCESSOR_URL}/api/v1/payments/initiate", json=payload)
    return res.json()

def check_status(order_id):
    res = requests.get(f"{PROCESSOR_URL}/api/v1/payments/status/{order_id}")
    return res.json()
```

---

### cURL

```bash
# Initiate payment
curl -X POST https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "phone": "0712345678",
    "external_reference": "INV-2026-881"
  }'

# Check status manually
curl -X GET https://ludicrous-unsorted-balance.ngrok-free.dev/api/v1/payments/status/INV-2026-881
```
