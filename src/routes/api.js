import { Hono } from 'hono';
import { DbClient } from '../db/client.js';
import { PaymentProcessorManager } from '../gateways/PaymentProcessorManager.js';

export const apiRoutes = new Hono();
const manager = new PaymentProcessorManager();

// POST /api/v1/payments/initiate
apiRoutes.post('/v1/payments/initiate', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON request body' }, 400);
  }

  const { amount, phone, external_reference, email, name, gateway: reqGateway, remarks } = body;

  if (!amount || isNaN(amount) || Number(amount) < 1) {
    return c.json({ success: false, message: 'The amount field is required and must be at least 1.' }, 400);
  }
  if (!phone) {
    return c.json({ success: false, message: 'The phone field is required.' }, 400);
  }
  if (!external_reference) {
    return c.json({ success: false, message: 'The external_reference field is required.' }, 400);
  }

  const gatewayName = reqGateway || (await dbClient.getConfig('active_gateway', 'selcom'));

  let gateway;
  try {
    gateway = await manager.getGateway(dbClient, gatewayName);
  } catch (e) {
    return c.json({ success: false, message: e.message }, 400);
  }

  // Create log record
  const logId = await dbClient.createPaymentLog({
    external_reference,
    gateway: gateway.getName(),
    amount: parseFloat(amount),
    phone: String(phone),
    status: 'pending',
    raw_request: body,
  });

  const originUrl = new URL(c.req.url).origin;

  // Call gateway
  const result = await gateway.initiatePayment(
    dbClient,
    {
      amount,
      phone,
      email,
      name,
      external_reference,
      remarks,
      provider: body.provider,
    },
    originUrl
  );

  // Update log record
  await dbClient.updatePaymentLog(logId, {
    gateway_reference: result.gateway_reference || null,
    status: result.success ? 'pending' : 'failed',
    raw_response: result.raw_response || null,
  });

  if (result.success) {
    return c.json({
      success: true,
      external_reference,
      gateway_reference: result.gateway_reference,
      payment_url: result.payment_url,
      message: 'Payment initiated successfully.',
    });
  }

  return c.json(
    {
      success: false,
      external_reference,
      message: result.error || 'Gateway initiation failed.',
    },
    502
  );
});

// GET /api/v1/payments/status/:external_reference
apiRoutes.get('/v1/payments/status/:external_reference', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const externalRef = c.req.param('external_reference');

  const log = await dbClient.findPaymentLogByRef(externalRef);
  if (!log) {
    return c.json({ success: false, message: 'Payment log not found' }, 404);
  }

  return c.json({
    success: true,
    external_reference: log.external_reference,
    status: log.status,
    amount: log.amount,
    gateway: log.gateway,
    gateway_reference: log.gateway_reference,
    message:
      log.status === 'success'
        ? 'Payment completed successfully'
        : log.status === 'failed'
        ? 'Payment failed'
        : 'Payment is pending',
    created_at: log.created_at,
    updated_at: log.updated_at,
  });
});

// POST /api/v1/callbacks/:gateway
apiRoutes.post('/v1/callbacks/:gateway', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const gatewayName = c.req.param('gateway');

  let bodyData = {};
  const rawBody = await c.req.text().catch(() => '');
  try {
    bodyData = JSON.parse(rawBody);
  } catch (e) {
    // If form data or non-JSON
  }

  console.log(`Incoming callback from: ${gatewayName}`, {
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    body: bodyData,
  });

  let gateway;
  try {
    gateway = await manager.getGateway(dbClient, gatewayName);
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }

  // Verify signature
  const isValidSig = await gateway.verifyWebhookSignature(dbClient, c.req.raw.headers, rawBody || bodyData);
  if (!isValidSig) {
    console.warn(`Callback signature verification failed for gateway: ${gatewayName}`);
    return c.json({ error: 'Invalid signature' }, 403);
  }

  // Parse callback
  const parsed = gateway.parseCallback(bodyData);

  // Update transaction log
  const log = await dbClient.findPaymentLogByRef(parsed.external_reference, gatewayName);
  if (log) {
    await dbClient.updatePaymentLog(log.id, {
      gateway_reference: parsed.gateway_reference || log.gateway_reference,
      status: parsed.status,
      callback_payload: bodyData,
    });
  } else {
    console.warn(`Transaction log not found for reference: ${parsed.external_reference || 'n/a'}`);
  }

  // Forward callback to Web Application
  const webappCallbackUrl = await dbClient.getConfig('webapp_callback_url');
  if (webappCallbackUrl) {
    try {
      const fwdRes = await fetch(webappCallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!fwdRes.ok) {
        console.error(`Failed to forward callback to WebApp. Status: ${fwdRes.status}`);
      } else {
        console.log(`Successfully forwarded callback to WebApp. Ref: ${parsed.external_reference}`);
      }
    } catch (e) {
      console.error('Exception occurred while forwarding callback to WebApp:', e.message);
    }
  } else {
    console.warn('WebApp callback URL is not configured. Skipped forwarding.');
  }

  return c.json({
    success: true,
    status: 'acknowledged',
  });
});

// GET /api/v1/config
apiRoutes.get('/v1/config', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  return c.json({
    active_gateway: await dbClient.getConfig('active_gateway', 'selcom'),
    webapp_callback_url: await dbClient.getConfig('webapp_callback_url'),
    available_gateways: manager.getAvailableDrivers(),
  });
});

// POST /api/v1/config
apiRoutes.post('/v1/config', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const body = await c.req.json().catch(() => ({}));

  if (body.active_gateway) {
    if (!['selcom', 'azampay'].includes(body.active_gateway)) {
      return c.json({ success: false, message: 'Invalid active_gateway value' }, 400);
    }
    await dbClient.setConfig('active_gateway', body.active_gateway);
  }

  if (body.webapp_callback_url !== undefined) {
    await dbClient.setConfig('webapp_callback_url', body.webapp_callback_url);
  }

  return c.json({
    success: true,
    message: 'Configuration updated successfully.',
    active_gateway: await dbClient.getConfig('active_gateway', 'selcom'),
    webapp_callback_url: await dbClient.getConfig('webapp_callback_url'),
  });
});

// GET /api/v1/logs
apiRoutes.get('/v1/logs', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const search = c.req.query('search') || '';
  const gateway = c.req.query('gateway') || '';
  const status = c.req.query('status') || '';
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = parseInt(c.req.query('per_page') || '10', 10);

  const logs = await dbClient.getPaymentLogs({ search, gateway, status, page, perPage });
  return c.json(logs);
});
