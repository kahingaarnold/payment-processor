/**
 * Database client for Cloudflare D1
 */

export class DbClient {
  constructor(db) {
    this.db = db;
  }

  // --- CONFIG HELPER METHODS ---

  async getConfig(key, defaultValue = '') {
    try {
      const row = await this.db
        .prepare('SELECT value FROM configs WHERE key = ?')
        .bind(key)
        .first();
      return row ? (row.value ?? defaultValue) : defaultValue;
    } catch (e) {
      console.error(`Error getting config ${key}:`, e);
      return defaultValue;
    }
  }

  async setConfig(key, value) {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO configs (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .bind(key, value, now, now)
      .run();
  }

  async getAllConfigs() {
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

    const result = await this.db.prepare('SELECT key, value FROM configs').all();
    const map = {};
    for (const k of keys) {
      map[k] = '';
    }
    if (result.results) {
      for (const row of result.results) {
        map[row.key] = row.value;
      }
    }
    return map;
  }

  // --- PAYMENT LOG HELPER METHODS ---

  async createPaymentLog(logData) {
    const now = new Date().toISOString();
    const res = await this.db
      .prepare(
        `INSERT INTO payment_logs (external_reference, gateway_reference, gateway, amount, phone, status, raw_request, raw_response, callback_payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        logData.external_reference,
        logData.gateway_reference || null,
        logData.gateway,
        logData.amount,
        logData.phone,
        logData.status || 'pending',
        logData.raw_request ? JSON.stringify(logData.raw_request) : null,
        logData.raw_response ? JSON.stringify(logData.raw_response) : null,
        logData.callback_payload ? JSON.stringify(logData.callback_payload) : null,
        now,
        now
      )
      .run();

    return res.meta.last_row_id;
  }

  async updatePaymentLog(id, updateData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (updateData.gateway_reference !== undefined) {
      fields.push('gateway_reference = ?');
      values.push(updateData.gateway_reference);
    }
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.raw_response !== undefined) {
      fields.push('raw_response = ?');
      values.push(updateData.raw_response ? JSON.stringify(updateData.raw_response) : null);
    }
    if (updateData.callback_payload !== undefined) {
      fields.push('callback_payload = ?');
      values.push(updateData.callback_payload ? JSON.stringify(updateData.callback_payload) : null);
    }

    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    await this.db
      .prepare(`UPDATE payment_logs SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async findPaymentLogByRef(externalReference, gateway = null) {
    let sql = 'SELECT * FROM payment_logs WHERE external_reference = ?';
    const params = [externalReference];

    if (gateway) {
      sql += ' AND gateway = ?';
      params.push(gateway);
    }

    sql += ' ORDER BY id DESC LIMIT 1';

    const row = await this.db.prepare(sql).bind(...params).first();
    return this.parseLogItem(row);
  }

  async findPaymentLogById(id) {
    const row = await this.db
      .prepare('SELECT * FROM payment_logs WHERE id = ?')
      .bind(id)
      .first();
    return this.parseLogItem(row);
  }

  async getPaymentLogs({ search = '', gateway = '', status = '', page = 1, perPage = 10 }) {
    let whereClauses = [];
    let params = [];

    if (search) {
      whereClauses.push('(external_reference LIKE ? OR phone LIKE ? OR gateway_reference LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (gateway && gateway !== 'all') {
      whereClauses.push('gateway = ?');
      params.push(gateway.toLowerCase());
    }

    if (status && status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status.toLowerCase());
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count query
    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as total FROM payment_logs ${whereSql}`)
      .bind(...params)
      .first();

    const total = countRow ? countRow.total : 0;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;

    // Data query
    const dataSql = `SELECT * FROM payment_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const dataResult = await this.db
      .prepare(dataSql)
      .bind(...params, perPage, offset)
      .all();

    const data = (dataResult.results || []).map((row) => this.parseLogItem(row));

    return {
      current_page: page,
      data,
      first_page_url: `?page=1`,
      from: total > 0 ? offset + 1 : null,
      last_page: lastPage,
      last_page_url: `?page=${lastPage}`,
      next_page_url: page < lastPage ? `?page=${page + 1}` : null,
      prev_page_url: page > 1 ? `?page=${page - 1}` : null,
      per_page: perPage,
      to: total > 0 ? Math.min(offset + perPage, total) : null,
      total,
    };
  }

  async deletePaymentLog(id) {
    await this.db.prepare('DELETE FROM payment_logs WHERE id = ?').bind(id).run();
  }

  async bulkDeletePaymentLogs({ type, ids = [] }) {
    if (type === 'all') {
      const res = await this.db.prepare('DELETE FROM payment_logs').run();
      return res.meta.changes || 0;
    } else {
      if (!ids || ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(',');
      const res = await this.db
        .prepare(`DELETE FROM payment_logs WHERE id IN (${placeholders})`)
        .bind(...ids)
        .run();
      return res.meta.changes || 0;
    }
  }

  async getAllPaymentLogsFiltered({ search = '', gateway = '', status = '' }) {
    let whereClauses = [];
    let params = [];

    if (search) {
      whereClauses.push('(external_reference LIKE ? OR phone LIKE ? OR gateway_reference LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (gateway && gateway !== 'all') {
      whereClauses.push('gateway = ?');
      params.push(gateway.toLowerCase());
    }

    if (status && status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status.toLowerCase());
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const res = await this.db
      .prepare(`SELECT * FROM payment_logs ${whereSql} ORDER BY created_at DESC`)
      .bind(...params)
      .all();

    return (res.results || []).map((row) => this.parseLogItem(row));
  }

  parseLogItem(row) {
    if (!row) return null;
    return {
      ...row,
      raw_request: row.raw_request ? JSON.parse(row.raw_request) : null,
      raw_response: row.raw_response ? JSON.parse(row.raw_response) : null,
      callback_payload: row.callback_payload ? JSON.parse(row.callback_payload) : null,
    };
  }

  // --- EMULATOR HELPER METHODS ---

  async createEmulatorTxn(txnData) {
    const now = new Date().toISOString();
    const res = await this.db
      .prepare(
        `INSERT INTO emulator_transactions (gateway, external_id, amount, phone, buyer_name, buyer_email, status, raw_payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        txnData.gateway,
        txnData.external_id,
        txnData.amount,
        txnData.phone,
        txnData.buyer_name || null,
        txnData.buyer_email || null,
        txnData.status || 'pending',
        txnData.raw_payload ? JSON.stringify(txnData.raw_payload) : null,
        now,
        now
      )
      .run();

    return res.meta.last_row_id;
  }

  async getEmulatorTxns(limit = 50) {
    const res = await this.db
      .prepare('SELECT * FROM emulator_transactions ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all();

    return (res.results || []).map((row) => ({
      ...row,
      raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
    }));
  }

  async findEmulatorTxnById(id) {
    const row = await this.db
      .prepare('SELECT * FROM emulator_transactions WHERE id = ?')
      .bind(id)
      .first();

    if (!row) return null;
    return {
      ...row,
      raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
    };
  }

  async findEmulatorTxnByExtId(externalId, gateway = 'selcom') {
    const row = await this.db
      .prepare('SELECT * FROM emulator_transactions WHERE external_id = ? AND gateway = ? ORDER BY id DESC LIMIT 1')
      .bind(externalId, gateway)
      .first();

    if (!row) return null;
    return {
      ...row,
      raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
    };
  }

  async updateEmulatorTxn(id, updateData) {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE emulator_transactions SET status = ?, updated_at = ? WHERE id = ?')
      .bind(updateData.status, now, id)
      .run();
  }
}
