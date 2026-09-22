import crypto from 'node:crypto';

export class SelcomGateway {
  getName() {
    return 'selcom';
  }

  async initiatePayment(dbClient, params, originUrl = '') {
    const baseUrl = (await dbClient.getConfig('selcom_base_url')).replace(/\/+$/, '');
    const apiKey = await dbClient.getConfig('selcom_api_key');
    const apiSecret = await dbClient.getConfig('selcom_secret_key');
    const vendor = await dbClient.getConfig('selcom_vendor');
    const webappCallbackUrl = await dbClient.getConfig('webapp_callback_url');

    const orderId = params.external_reference || `SEL-${Date.now()}`;
    const phone = this.formatPhoneNumber(params.phone || '');

    const redirect = btoa(`${webappCallbackUrl}?status=success&ref=${orderId}`);
    const cancel = btoa(`${webappCallbackUrl}?status=cancelled&ref=${orderId}`);
    const webhookUrl = `${originUrl}/api/v1/callbacks/selcom`;

    const orderMinArray = {
      vendor,
      order_id: orderId,
      buyer_email: params.email || 'customer@example.com',
      buyer_name: params.name || 'Guest Customer',
      buyer_phone: phone,
      amount: parseInt(params.amount, 10),
      currency: 'TZS',
      redirect_url: redirect,
      cancel_url: cancel,
      webhook: webhookUrl,
      buyer_remarks: params.remarks || 'Payment',
      merchant_remarks: `Order ${orderId}`,
      no_of_items: 1,
    };

    const headers = this.computeHeaders(orderMinArray, apiKey, apiSecret);

    try {
      const response = await fetch(`${baseUrl}/checkout/create-order-minimal`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderMinArray),
      });

      const responseBody = await response.json().catch(() => null);

      if (
        response.ok &&
        responseBody &&
        String(responseBody.result || '').toLowerCase() === 'success'
      ) {
        const data = responseBody.data?.[0] || {};
        let paymentUrl = null;
        if (data.payment_gateway_url) {
          try {
            paymentUrl = atob(data.payment_gateway_url);
          } catch (e) {
            paymentUrl = data.payment_gateway_url;
          }
        }

        return {
          success: true,
          gateway_reference: data.reference || null,
          payment_url: paymentUrl,
          raw_response: responseBody,
        };
      }

      return {
        success: false,
        error: responseBody?.message || 'Gateway failed to initiate payment',
        raw_response: responseBody || (await response.text().catch(() => '')),
      };
    } catch (e) {
      console.error('Selcom initiatePayment error:', e);
      return {
        success: false,
        error: `Connection to Selcom failed: ${e.message}`,
        raw_response: { exception: e.message },
      };
    }
  }

  async verifyWebhookSignature(dbClient, headers, requestData) {
    const digestHeader = headers.get('digest');
    const timestamp = headers.get('timestamp');
    const signedFields = headers.get('signed-fields');

    if (!digestHeader || !timestamp || !signedFields) {
      return false;
    }

    const apiSecret = await dbClient.getConfig('selcom_secret_key');
    if (!apiSecret) return false;

    const fields = signedFields.split(',');
    let data = `timestamp=${timestamp}`;

    for (const field of fields) {
      if (requestData[field] === undefined) {
        return false;
      }
      data += `&${field}=${String(requestData[field])}`;
    }

    const computed = crypto
      .createHmac('sha256', apiSecret)
      .update(data)
      .digest('base64');

    return digestHeader === computed;
  }

  parseCallback(data) {
    const orderId = data.order_id || data.utilityref || null;
    const reference = data.reference || data.transid || null;
    const amount = data.amount ? parseFloat(data.amount) : 0.0;

    const result = String(data.result || '').toLowerCase();
    const resultCode = String(data.resultcode || '');

    let status = 'failed';
    if (result === 'success' || resultCode === '000') {
      status = 'success';
    }

    return {
      external_reference: orderId,
      gateway: 'selcom',
      gateway_reference: reference,
      amount,
      status,
      phone: data.msisdn || '',
      message: data.message || (status === 'success' ? 'Payment succeeded' : 'Payment failed'),
      timestamp: new Date().toISOString(),
    };
  }

  computeHeaders(arrayData, apiKey, apiSecret) {
    const authToken = 'SELCOM ' + btoa(apiKey || '');
    const signedFields = Object.keys(arrayData).join(',');
    const fieldOrder = signedFields.split(',');

    const timestamp = new Date().toISOString();

    let data = `timestamp=${timestamp}`;
    for (const key of fieldOrder) {
      data += `&${key}=${String(arrayData[key])}`;
    }

    const digest = crypto
      .createHmac('sha256', apiSecret || '')
      .update(data)
      .digest('base64');

    return {
      Authorization: authToken,
      'Digest-Method': 'HS256',
      Timestamp: timestamp,
      Digest: digest,
      'Signed-Fields': signedFields,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  formatPhoneNumber(phone) {
    let p = String(phone || '').replace(/[^0-9]/g, '').trim();
    if (p.startsWith('0')) {
      p = '255' + p.substring(1);
    }
    if (p.startsWith('2550')) {
      p = '255' + p.substring(4);
    }
    if (p.length === 9) {
      p = '255' + p;
    }
    return p;
  }
}
