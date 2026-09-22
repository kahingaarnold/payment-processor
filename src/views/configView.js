import { renderLayout } from './layout.js';

export function renderConfigView(configs, logsData, flashMessage = null, queryParams = {}) {
  const activeGateway = configs.active_gateway || 'selcom';
  const webappCallbackUrl = configs.webapp_callback_url || '';

  const selcomBaseUrl = configs.selcom_base_url || '';
  const selcomApiKey = configs.selcom_api_key || '';
  const selcomSecretKey = configs.selcom_secret_key || '';
  const selcomVendor = configs.selcom_vendor || '';

  const azamBaseUrl = configs.azampay_base_url || '';
  const azamAuthBaseUrl = configs.azampay_auth_base_url || '';
  const azamClientId = configs.azampay_client_id || '';
  const azamClientSecret = configs.azampay_client_secret || '';
  const azamAppName = configs.azampay_app_name || '';
  const azamApiKey = configs.azampay_api_key || '';

  const searchVal = queryParams.search || '';
  const gatewayFilter = queryParams.gateway || 'all';
  const statusFilter = queryParams.status || 'all';

  const logs = logsData.data || [];
  const currentPage = logsData.current_page || 1;
  const lastPage = logsData.last_page || 1;
  const totalLogs = logsData.total || 0;

  const content = `
  <div x-data="{ activeTab: 'settings', selectedLogs: [], showModal: false, modalLog: null }">
    <!-- Header Tabs -->
    <div class="border-b border-slate-200 mb-6 flex justify-between items-end">
      <nav class="-mb-px flex space-x-8">
        <button @click="activeTab = 'settings'" :class="activeTab === 'settings' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span>Gateway Configurations</span>
        </button>
        <button @click="activeTab = 'logs'" :class="activeTab === 'logs' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>Transaction Logs (${totalLogs})</span>
        </button>
      </nav>
    </div>

    <!-- TAB 1: CONFIGURATIONS SETTINGS -->
    <div x-show="activeTab === 'settings'" class="space-y-6">
      <form action="/config/save" method="POST">
        
        <!-- General Processor Config -->
        <div class="bg-white shadow rounded-lg p-6 mb-6">
          <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center space-x-2">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            <span>General Middleware Settings</span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Active Gateway Driver</label>
              <select name="active_gateway" class="w-full rounded-md border-slate-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                <option value="selcom" ${activeGateway === 'selcom' ? 'selected' : ''}>Selcom Payment Gateway</option>
                <option value="azampay" ${activeGateway === 'azampay' ? 'selected' : ''}>AzamPay Mobile Money</option>
              </select>
              <p class="text-xs text-slate-500 mt-1">Default gateway used when request doesn't specify one.</p>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">WebApp Callback Forwarding URL</label>
              <input type="text" name="webapp_callback_url" value="${webappCallbackUrl}" placeholder="https://your-app.com/api/payments/callback" class="w-full rounded-md border-slate-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
              <p class="text-xs text-slate-500 mt-1">Normalized payment status webhooks will be posted here.</p>
            </div>
          </div>
        </div>

        <!-- Selcom Config -->
        <div class="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-blue-500">
          <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h2 class="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span class="w-3 h-3 rounded-full bg-blue-500"></span>
              <span>Selcom Gateway Credentials</span>
            </h2>
            <button type="submit" name="test_gateway" value="selcom" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-200 transition">
              ⚡ Test Selcom Connection
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Selcom Base URL</label>
              <input type="text" name="selcom_base_url" value="${selcomBaseUrl}" placeholder="https://apigw.selcom.tz/v1" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Selcom Vendor ID (Till)</label>
              <input type="text" name="selcom_vendor" value="${selcomVendor}" placeholder="VEND1234" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Selcom API Key</label>
              <input type="text" name="selcom_api_key" value="${selcomApiKey}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Selcom Secret Key</label>
              <input type="password" name="selcom_secret_key" value="${selcomSecretKey}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
          </div>
        </div>

        <!-- AzamPay Config -->
        <div class="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-emerald-500">
          <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h2 class="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>AzamPay Gateway Credentials</span>
            </h2>
            <button type="submit" name="test_gateway" value="azampay" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded border border-emerald-200 transition">
              ⚡ Test AzamPay Connection
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">AzamPay API Base URL</label>
              <input type="text" name="azampay_base_url" value="${azamBaseUrl}" placeholder="https://checkout.azampay.co.tz" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">AzamPay Auth Base URL</label>
              <input type="text" name="azampay_auth_base_url" value="${azamAuthBaseUrl}" placeholder="https://authenticator.azampay.co.tz" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Client ID</label>
              <input type="text" name="azampay_client_id" value="${azamClientId}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Client Secret</label>
              <input type="password" name="azampay_client_secret" value="${azamClientSecret}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">App Name</label>
              <input type="text" name="azampay_app_name" value="${azamAppName}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">X-API-KEY</label>
              <input type="password" name="azampay_api_key" value="${azamApiKey}" class="w-full rounded-md border-slate-300 border p-2 text-sm">
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow transition">
            Save Configurations
          </button>
        </div>
      </form>
    </div>

    <!-- TAB 2: TRANSACTION LOGS MANAGEMENT -->
    <div x-show="activeTab === 'logs'" class="space-y-4">
      
      <!-- Filters and Actions Bar -->
      <div class="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-center gap-4">
        <form action="/" method="GET" class="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input type="hidden" name="tab" value="logs">
          <input type="text" name="search" value="${searchVal}" placeholder="Search ref, phone..." class="border rounded p-2 text-xs w-48">
          <select name="gateway" class="border rounded p-2 text-xs">
            <option value="all" ${gatewayFilter === 'all' ? 'selected' : ''}>All Gateways</option>
            <option value="selcom" ${gatewayFilter === 'selcom' ? 'selected' : ''}>Selcom</option>
            <option value="azampay" ${gatewayFilter === 'azampay' ? 'selected' : ''}>AzamPay</option>
          </select>
          <select name="status" class="border rounded p-2 text-xs">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="success" ${statusFilter === 'success' ? 'selected' : ''}>Success</option>
            <option value="failed" ${statusFilter === 'failed' ? 'selected' : ''}>Failed</option>
          </select>
          <button type="submit" class="px-3 py-2 bg-slate-800 text-white text-xs font-semibold rounded">Filter</button>
        </form>

        <div class="flex items-center space-x-2">
          <a href="/logs/export?format=csv&search=${searchVal}&gateway=${gatewayFilter}&status=${statusFilter}" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border text-xs font-semibold rounded">📥 Export CSV</a>
          <a href="/logs/export?format=json&search=${searchVal}&gateway=${gatewayFilter}&status=${statusFilter}" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border text-xs font-semibold rounded">📥 Export JSON</a>
          <button @click="bulkDeleteSelected()" x-show="selectedLogs.length > 0" class="px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded">Delete Selected (<span x-text="selectedLogs.length"></span>)</button>
          <button @click="bulkRetryFailed()" class="px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded">Retry Failed</button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="p-3 text-left"><input type="checkbox" @change="toggleAll($event)"></th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Date</th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Ext Reference</th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Gateway</th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Phone</th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Amount</th>
              <th class="p-3 text-left font-semibold text-slate-600 text-xs">Status</th>
              <th class="p-3 text-right font-semibold text-slate-600 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              logs.length === 0
                ? `<tr><td colspan="8" class="text-center py-8 text-slate-400 text-sm">No transaction logs found.</td></tr>`
                : logs
                    .map(
                      (log) => `
            <tr class="hover:bg-slate-50">
              <td class="p-3"><input type="checkbox" value="${log.id}" x-model="selectedLogs"></td>
              <td class="p-3 text-xs text-slate-500">${new Date(log.created_at).toLocaleString()}</td>
              <td class="p-3 font-mono text-xs font-semibold text-slate-900">${log.external_reference}</td>
              <td class="p-3 text-xs uppercase font-bold text-slate-600">${log.gateway}</td>
              <td class="p-3 text-xs">${log.phone}</td>
              <td class="p-3 text-xs font-semibold text-slate-800">TZS ${Number(log.amount).toLocaleString()}</td>
              <td class="p-3">
                <span class="px-2 py-0.5 text-xs font-bold rounded-full ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : log.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }">
                  ${log.status}
                </span>
              </td>
              <td class="p-3 text-right space-x-2">
                <button @click='openLogModal(${JSON.stringify(log).replace(/'/g, "&apos;")})' class="text-indigo-600 hover:text-indigo-900 text-xs font-semibold">View</button>
                ${
                  log.status === 'failed'
                    ? `<button @click="retryLog(${log.id})" class="text-amber-600 hover:text-amber-900 text-xs font-semibold">Retry</button>`
                    : ''
                }
                <button @click="deleteLog(${log.id})" class="text-red-600 hover:text-red-900 text-xs font-semibold">Delete</button>
              </td>
            </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-4 py-3 bg-slate-50 border-t flex justify-between items-center text-xs text-slate-600">
          <span>Showing Page ${currentPage} of ${lastPage} (${totalLogs} total logs)</span>
          <div class="space-x-1">
            ${
              currentPage > 1
                ? `<a href="/?tab=logs&page=${currentPage - 1}&search=${searchVal}&gateway=${gatewayFilter}&status=${statusFilter}" class="px-3 py-1 bg-white border rounded">Prev</a>`
                : ''
            }
            ${
              currentPage < lastPage
                ? `<a href="/?tab=logs&page=${currentPage + 1}&search=${searchVal}&gateway=${gatewayFilter}&status=${statusFilter}" class="px-3 py-1 bg-white border rounded">Next</a>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>

    <!-- DETAIL MODAL -->
    <div x-show="showModal" class="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" x-cloak>
      <div class="bg-white rounded-lg max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="text-lg font-bold">Transaction Detail</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <template x-if="modalLog">
          <div class="space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded">
              <div><strong>External Ref:</strong> <span x-text="modalLog.external_reference"></span></div>
              <div><strong>Gateway Ref:</strong> <span x-text="modalLog.gateway_reference || 'N/A'"></span></div>
              <div><strong>Gateway:</strong> <span x-text="modalLog.gateway" class="uppercase"></span></div>
              <div><strong>Status:</strong> <span x-text="modalLog.status" class="font-bold"></span></div>
              <div><strong>Amount:</strong> TZS <span x-text="Number(modalLog.amount).toLocaleString()"></span></div>
              <div><strong>Phone:</strong> <span x-text="modalLog.phone"></span></div>
            </div>

            <div>
              <h4 class="font-bold mb-1">Raw Request Payload</h4>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded font-mono overflow-x-auto text-[11px]" x-text="JSON.stringify(modalLog.raw_request, null, 2)"></pre>
            </div>

            <div>
              <h4 class="font-bold mb-1">Raw Response Payload</h4>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded font-mono overflow-x-auto text-[11px]" x-text="JSON.stringify(modalLog.raw_response, null, 2)"></pre>
            </div>

            <div>
              <h4 class="font-bold mb-1">Callback Payload</h4>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded font-mono overflow-x-auto text-[11px]" x-text="JSON.stringify(modalLog.callback_payload, null, 2)"></pre>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <script>
    function toggleAll(e) {
      const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
      const checked = e.target.checked;
      checkboxes.forEach(cb => cb.checked = checked);
    }

    function openLogModal(log) {
      const el = document.querySelector('[x-data]');
      if (el && el._x_dataStack) {
        el._x_dataStack[0].modalLog = log;
        el._x_dataStack[0].showModal = true;
      }
    }

    async function deleteLog(id) {
      if (!confirm('Are you sure you want to delete this log?')) return;
      const res = await fetch('/logs/' + id, { method: 'DELETE' });
      if (res.ok) window.location.reload();
    }

    async function bulkDeleteSelected() {
      const checkboxes = Array.from(document.querySelectorAll('tbody input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
      if (checkboxes.length === 0) return;
      if (!confirm('Delete selected ' + checkboxes.length + ' logs?')) return;
      const res = await fetch('/logs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: checkboxes })
      });
      if (res.ok) window.location.reload();
    }

    async function retryLog(id) {
      const res = await fetch('/logs/retry/' + id, { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Retry initiated');
      window.location.reload();
    }

    async function bulkRetryFailed() {
      if (!confirm('Retry all failed transactions?')) return;
      const res = await fetch('/logs/bulk-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'all_failed' })
      });
      const data = await res.json();
      alert(data.message || 'Bulk retry completed');
      window.location.reload();
    }
  </script>`;

  return renderLayout({ title: 'Gateway Settings & Logs', activeTab: 'config', content, flashMessage });
}
