import { Hono } from 'hono';
import crypto from 'node:crypto';
import { DbClient } from '../db/client.js';

export const emulatorApiRoutes = new Hono();

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// Quick Auto-Configure Gateway URLs to point to Sandbox Emulator
emulatorApiRoutes.post('/configure-sandbox', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const origin = new URL(c.req.url).origin;

  await dbClient.setConfig('selcom_base_url', `${origin}/api/emulator/selcom`);
  await dbClient.setConfig('azampay_base_url', `${origin}/api/emulator/azampay`);
  await dbClient.setConfig('azampay_auth_base_url', `${origin}/api/emulator/azampay`);

  // Default sandbox credentials if empty
  if (!(await dbClient.getConfig('selcom_api_key'))) {
    await dbClient.setConfig('selcom_api_key', 'emulator_api_key');
    await dbClient.setConfig('selcom_secret_key', 'emulator_secret');
    await dbClient.setConfig('selcom_vendor', 'EMU_TILL_123');
  }

  if (!(await dbClient.getConfig('azampay_client_id'))) {
    await dbClient.setConfig('azampay_client_id', 'emulator_client_id');
    await dbClient.setConfig('azampay_client_secret', 'emulator_secret');
    await dbClient.setConfig('azampay_app_name', 'EmulatorApp');
    await dbClient.setConfig('azampay_api_key', 'emulator_api_key');
  }

  return c.json({
    success: true,
    message: 'Processor successfully configured to point to Sandbox Emulator endpoints!',
    selcom_base_url: `${origin}/api/emulator/selcom`,
    azampay_base_url: `${origin}/api/emulator/azampay`,
    azampay_auth_base_url: `${origin}/api/emulator/azampay`,
  });
});

// Fake AzamPay GenerateToken
emulatorApiRoutes.post('/azampay/AppRegistration/GenerateToken', async (c) => {
  const token = 'emulator_' + generateRandomString(48);
  return c.json({
    success: true,
    statusCode: 200,
    message: 'Token generated successfully.',
    data: {
      accessToken: token,
      expire: new Date(Date.now() + 3600000).toISOString(),
    },
    token,
  });
});

// Fake AzamPay MNO Checkout
emulatorApiRoutes.post('/azampay/azampay/mno/checkout', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  let body = {};
  try {
    body = await c.req.json();
  } catch (e) {}

  const externalId = body.externalId || 'AZAM-' + generateRandomString(8).toUpperCase();
  const amount = body.amount || 0;
  const phone = body.accountNumber || '';
  const provider = body.provider || 'Unknown';

  await dbClient.createEmulatorTxn({
    gateway: 'azampay',
    external_id: externalId,
    amount: parseFloat(amount),
    phone: String(phone),
    buyer_name: `Provider: ${provider}`,
    status: 'pending',
    raw_payload: body,
  });

  console.log(`[EMULATOR] AzamPay checkout created. Ref: ${externalId}`);

  return c.json({
    success: true,
    transactionId: 'EMTXN-' + generateRandomString(12).toUpperCase(),
    message: 'Payment request received. Awaiting customer action.',
  });
});

// Fake Selcom Create Order Minimal
emulatorApiRoutes.post('/selcom/checkout/create-order-minimal', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  let body = {};
  try {
    body = await c.req.json();
  } catch (e) {}

  const orderId = body.order_id || 'SEL-' + generateRandomString(8).toUpperCase();
  const amount = body.amount || 0;
  const phone = body.buyer_phone || '';
  const buyerName = body.buyer_name || 'Customer';
  const buyerEmail = body.buyer_email || '';

  const originUrl = new URL(c.req.url).origin;
  const paymentUrl = `${originUrl}/emulator/selcom-pay/${orderId}`;
  const encodedUrl = btoa(paymentUrl);

  await dbClient.createEmulatorTxn({
    gateway: 'selcom',
    external_id: orderId,
    amount: parseFloat(amount),
    phone: String(phone),
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    status: 'pending',
    raw_payload: body,
  });

  console.log(`[EMULATOR] Selcom order created. Ref: ${orderId}`);

  return c.json({
    result: 'SUCCESS',
    message: 'Order created successfully.',
    data: [
      {
        reference: 'EMSEL-' + generateRandomString(10).toUpperCase(),
        payment_gateway_url: encodedUrl,
      },
    ],
  });
});

// GET /api/emulator/transactions (for UI polling)
emulatorApiRoutes.get('/transactions', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const txns = await dbClient.getEmulatorTxns(50);
  return c.json(txns);
});

// POST /api/emulator/resolve/:id (approve / reject / timeout)
emulatorApiRoutes.post('/resolve/:id', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const action = body.action;

  if (!['approve', 'reject', 'timeout'].includes(action)) {
    return c.json({ error: 'Action must be approve, reject, or timeout' }, 400);
  }

  const transaction = await dbClient.findEmulatorTxnById(id);
  if (!transaction) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  if (transaction.status !== 'pending') {
    return c.json({ error: 'Transaction already resolved.' }, 422);
  }

  const statusMap = {
    approve: 'approved',
    reject: 'rejected',
    timeout: 'timeout',
  };
  const resolvedStatus = statusMap[action];

  await dbClient.updateEmulatorTxn(id, { status: resolvedStatus });

  const originUrl = new URL(c.req.url).origin;
  await fireCallback(dbClient, transaction, resolvedStatus, originUrl);

  const updatedTxn = await dbClient.findEmulatorTxnById(id);

  return c.json({
    success: true,
    transaction: updatedTxn,
  });
});

async function fireCallback(dbClient, transaction, resolvedStatus, originUrl) {
  const gateway = transaction.gateway;
  const callbackUrl = `${originUrl}/api/v1/callbacks/${gateway}`;
  const paymentStatus = resolvedStatus === 'approved' ? 'success' : 'failed';

  if (gateway === 'azampay') {
    const payload = {
      utilityref: transaction.external_id,
      externalId: transaction.external_id,
      transactionId: 'EMTXN-' + generateRandomString(12).toUpperCase(),
      amount: String(transaction.amount),
      msisdn: transaction.phone,
      status: paymentStatus,
      message:
        resolvedStatus === 'approved'
          ? 'Payment completed successfully'
          : 'Payment was declined by customer',
    };

    const secret = (await dbClient.getConfig('azampay_client_secret')) || 'emulator_secret';
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        body: rawBody,
      });
      console.log(`[EMULATOR] AzamPay callback fired. Ref: ${transaction.external_id}`);
    } catch (e) {
      console.error(`[EMULATOR] Failed to fire AzamPay callback:`, e.message);
    }
  }

  if (gateway === 'selcom') {
    const timestamp = new Date().toISOString();
    const secret = (await dbClient.getConfig('selcom_secret_key')) || 'emulator_secret';
    const resultCode = resolvedStatus === 'approved' ? '000' : '999';
    const result = resolvedStatus === 'approved' ? 'success' : 'failure';
    const reference = 'EMSEL-' + generateRandomString(10).toUpperCase();

    const payload = {
      order_id: transaction.external_id,
      reference,
      amount: String(transaction.amount),
      msisdn: transaction.phone,
      result,
      resultcode: resultCode,
      message: resolvedStatus === 'approved' ? 'Payment successful' : 'Payment declined',
    };

    const signedFields = Object.keys(payload).join(',');
    let data = `timestamp=${timestamp}`;
    for (const k of Object.keys(payload)) {
      data += `&${k}=${String(payload[k])}`;
    }
    const digest = crypto.createHmac('sha256', secret).update(data).digest('base64');

    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Timestamp: timestamp,
          Digest: digest,
          'Digest-Method': 'HS256',
          'Signed-Fields': signedFields,
        },
        body: JSON.stringify(payload),
      });
      console.log(`[EMULATOR] Selcom callback fired. Ref: ${transaction.external_id}`);
    } catch (e) {
      console.error(`[EMULATOR] Failed to fire Selcom callback:`, e.message);
    }
  }
}
