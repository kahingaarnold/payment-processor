import { Hono } from 'hono';
import { DbClient } from '../db/client.js';
import { renderConfigView } from '../views/configView.js';
import { renderEmulatorView } from '../views/emulatorView.js';
import { renderSelcomPayView } from '../views/selcomPayView.js';
import { PaymentProcessorManager } from '../gateways/PaymentProcessorManager.js';

export const webRoutes = new Hono();
const manager = new PaymentProcessorManager();

// GET / (Admin Settings & Logs Dashboard)
webRoutes.get('/', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const configs = await dbClient.getAllConfigs();

  const search = c.req.query('search') || '';
  const gateway = c.req.query('gateway') || 'all';
  const status = c.req.query('status') || 'all';
  const page = parseInt(c.req.query('page') || '1', 10);

  const logsData = await dbClient.getPaymentLogs({ search, gateway, status, page, perPage: 10 });

  return c.html(renderConfigView(configs, logsData, null, { search, gateway, status }));
});

// POST /config/save
webRoutes.post('/config/save', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const body = await c.req.parseBody();

  // Test Gateway Connection button clicked?
  if (body.test_gateway) {
    return handleConnectionTest(c, dbClient, body.test_gateway, body);
  }

  const keys = [
    'active_gateway',
    'webapp_callback_url',
    'selcom_base_url',
    'selcom_api_key',
    'selcom_secret_key',
    'selcom_vendor',
    'azampay_base_url',
    'azampay_auth_base_url',
    'azampay_client_id',
    'azampay_client_secret',
    'azampay_app_name',
    'azampay_api_key',
  ];

  for (const k of keys) {
    if (body[k] !== undefined) {
      await dbClient.setConfig(k, String(body[k]));
    }
  }

  const configs = await dbClient.getAllConfigs();
  const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
  const flash = { type: 'success', text: 'Configurations saved successfully!' };

  return c.html(renderConfigView(configs, logsData, flash));
});

// Helper: Gateway connection test handler
async function handleConnectionTest(c, dbClient, gatewayToTest, formData) {
  if (gatewayToTest === 'selcom') {
    const baseUrl = (formData.selcom_base_url || '').replace(/\/+$/, '');
    const apiKey = formData.selcom_api_key || '';
    const secretKey = formData.selcom_secret_key || '';
    const vendor = formData.selcom_vendor || 'TILL123';

    if (!baseUrl || !apiKey || !secretKey) {
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'error',
          text: 'Selcom Base URL, API Key, and Secret Key are required to run the connection test.',
        })
      );
    }

    try {
      const selcom = await manager.getGateway(dbClient, 'selcom');
      const testData = { vendor, order_id: `TEST-${Date.now()}` };
      const headers = selcom.computeHeaders(testData, apiKey, secretKey);

      const res = await fetch(`${baseUrl}/checkout/create-order-minimal`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testData),
      });

      const resJson = await res.json().catch(() => null);
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });

      if (res.status === 401 || res.status === 403) {
        return c.html(
          renderConfigView(configs, logsData, {
            type: 'error',
            text: `Connection successful, but credentials were rejected by Selcom (HTTP ${res.status}).`,
          })
        );
      }

      const msg = resJson?.message || `Status Code ${res.status}`;
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'success',
          text: `Selcom API contacted successfully! Gateway responded: ${msg}`,
        })
      );
    } catch (e) {
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'error',
          text: `Network connection to Selcom failed: ${e.message}`,
        })
      );
    }
  }

  if (gatewayToTest === 'azampay') {
    const authBaseUrl = (formData.azampay_auth_base_url || '').replace(/\/+$/, '');
    const clientId = formData.azampay_client_id || '';
    const clientSecret = formData.azampay_client_secret || '';
    const appName = formData.azampay_app_name || '';

    if (!authBaseUrl || !clientId || !clientSecret) {
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'error',
          text: 'AzamPay Auth URL, Client ID, and Client Secret are required to run the test.',
        })
      );
    }

    try {
      const res = await fetch(`${authBaseUrl}/AppRegistration/GenerateToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, clientId, clientSecret }),
      });

      const json = await res.json().catch(() => null);
      const token =
        json?.token || json?.data?.accessToken || json?.data?.token || json?.accessToken;
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });

      if (res.ok && (token || json?.success === true)) {
        return c.html(
          renderConfigView(configs, logsData, {
            type: 'success',
            text: 'AzamPay connection test successful! Access token generated successfully.',
          })
        );
      }

      const err = json?.message || `Authentication failed (HTTP ${res.status})`;
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'error',
          text: `AzamPay authentication endpoint reached, but token generation failed: ${err}`,
        })
      );
    } catch (e) {
      const configs = await dbClient.getAllConfigs();
      const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
      return c.html(
        renderConfigView(configs, logsData, {
          type: 'error',
          text: `Network connection to AzamPay failed: ${e.message}`,
        })
      );
    }
  }

  const configs = await dbClient.getAllConfigs();
  const logsData = await dbClient.getPaymentLogs({ page: 1, perPage: 10 });
  return c.html(
    renderConfigView(configs, logsData, {
      type: 'error',
      text: 'Unsupported gateway test requested.',
    })
  );
}

// Log Management Endpoints
webRoutes.get('/logs/:id', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const id = parseInt(c.req.param('id'), 10);
  const log = await dbClient.findPaymentLogById(id);
  if (!log) return c.json({ error: 'Log not found' }, 404);
  return c.json(log);
});

webRoutes.delete('/logs/:id', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const id = parseInt(c.req.param('id'), 10);
  await dbClient.deletePaymentLog(id);
  return c.json({ success: true, message: 'Transaction log deleted successfully.' });
});

webRoutes.post('/logs/bulk-delete', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const count = await dbClient.bulkDeletePaymentLogs({ type: body.type, ids: body.ids });
  return c.json({ success: true, count, message: `${count} transaction log(s) deleted successfully.` });
});

webRoutes.post('/logs/retry/:id', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const id = parseInt(c.req.param('id'), 10);
  const log = await dbClient.findPaymentLogById(id);
  if (!log) return c.json({ success: false, message: 'Log not found' }, 404);

  let gateway;
  try {
    gateway = await manager.getGateway(dbClient, log.gateway);
  } catch (e) {
    return c.json({ success: false, message: e.message }, 400);
  }

  const rawReq = log.raw_request || {};
  const originUrl = new URL(c.req.url).origin;

  const result = await gateway.initiatePayment(
    dbClient,
    {
      amount: rawReq.amount || log.amount,
      phone: rawReq.phone || log.phone,
      email: rawReq.email || null,
      name: rawReq.name || null,
      external_reference: rawReq.external_reference || log.external_reference,
      remarks: rawReq.remarks || 'Retry transaction',
    },
    originUrl
  );

  await dbClient.updatePaymentLog(log.id, {
    gateway_reference: result.gateway_reference || log.gateway_reference,
    status: result.success ? 'pending' : 'failed',
    raw_response: result.raw_response || null,
  });

  const updatedLog = await dbClient.findPaymentLogById(id);

  if (result.success) {
    return c.json({
      success: true,
      message: 'Transaction retried successfully! Gateway status set to pending.',
      log: updatedLog,
    });
  }

  return c.json(
    {
      success: false,
      message: result.error || 'Gateway initiation failed during retry.',
      log: updatedLog,
    },
    502
  );
});

webRoutes.post('/logs/bulk-retry', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const body = await c.req.json().catch(() => ({}));

  const failedLogs = await dbClient.getAllPaymentLogsFiltered({ status: 'failed' });

  let retriedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;

  const originUrl = new URL(c.req.url).origin;

  for (const log of failedLogs) {
    retriedCount++;
    try {
      const gateway = await manager.getGateway(dbClient, log.gateway);
      const rawReq = log.raw_request || {};

      const result = await gateway.initiatePayment(
        dbClient,
        {
          amount: rawReq.amount || log.amount,
          phone: rawReq.phone || log.phone,
          email: rawReq.email || null,
          name: rawReq.name || null,
          external_reference: rawReq.external_reference || log.external_reference,
          remarks: rawReq.remarks || 'Bulk retry transaction',
        },
        originUrl
      );

      await dbClient.updatePaymentLog(log.id, {
        gateway_reference: result.gateway_reference || log.gateway_reference,
        status: result.success ? 'pending' : 'failed',
        raw_response: result.raw_response || null,
      });

      if (result.success) {
        succeededCount++;
      } else {
        failedCount++;
      }
    } catch (e) {
      failedCount++;
    }
  }

  return c.json({
    success: true,
    retried_count: retriedCount,
    succeeded_count: succeededCount,
    failed_count: failedCount,
    message: `Bulk retry completed. ${succeededCount} succeeded, ${failedCount} failed out of ${retriedCount} attempt(s).`,
  });
});

// CSV & JSON Log Exporter
webRoutes.get('/logs/export', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const search = c.req.query('search') || '';
  const gateway = c.req.query('gateway') || 'all';
  const status = c.req.query('status') || 'all';
  const format = (c.req.query('format') || 'csv').toLowerCase();

  const logs = await dbClient.getAllPaymentLogsFiltered({ search, gateway, status });
  const filenameDate = new Date().toISOString().replace(/[:\.-]/g, '');

  if (format === 'json') {
    return c.text(JSON.stringify(logs, null, 2), 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="transaction_logs_${filenameDate}.json"`,
    });
  }

  // CSV format
  const rows = [
    ['ID', 'Date', 'External Reference', 'Gateway Reference', 'Gateway', 'Phone', 'Amount (TZS)', 'Status'],
  ];

  for (const log of logs) {
    rows.push([
      log.id,
      log.created_at || '',
      `"${String(log.external_reference || '').replace(/"/g, '""')}"`,
      `"${String(log.gateway_reference || '').replace(/"/g, '""')}"`,
      String(log.gateway || '').toUpperCase(),
      `"${String(log.phone || '').replace(/"/g, '""')}"`,
      log.amount,
      log.status,
    ]);
  }

  const csvContent = rows.map((r) => r.join(',')).join('\n');

  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="transaction_logs_${filenameDate}.csv"`,
  });
});

// Emulator Routes
webRoutes.get('/emulator', (c) => {
  return c.html(renderEmulatorView());
});

webRoutes.get('/emulator/selcom-pay/:orderId', async (c) => {
  const dbClient = new DbClient(c.env.DB);
  const orderId = c.req.param('orderId');
  const transaction = await dbClient.findEmulatorTxnByExtId(orderId, 'selcom');
  return c.html(renderSelcomPayView(transaction, orderId));
});
