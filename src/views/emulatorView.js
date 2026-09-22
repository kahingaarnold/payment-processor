import { renderLayout } from './layout.js';

export function renderEmulatorView() {
  const content = `
  <div x-data="emulatorData()" x-init="init()" class="space-y-6">
    
    <!-- Top Banner -->
    <div class="bg-indigo-900 text-white rounded-xl p-6 shadow-md border border-indigo-800">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold flex items-center space-x-2 text-white">
            <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            <span>Payment Checkout Terminal &amp; Integration Compliance Tool</span>
          </h2>
          <p class="text-xs text-indigo-200 mt-1">
            Initiate test cash withdrawals from customer phone numbers, inspect raw gateway payloads, and export integration proofs for the AzamPay &amp; Selcom developer teams.
          </p>
        </div>

        <button @click="autoConfigureSandbox()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center space-x-2 self-start md:self-auto border border-indigo-400/30">
          <span>⚡ Switch Gateway URLs to Sandbox Emulator</span>
        </button>
      </div>
    </div>

    <!-- MAIN CHECKOUT TERMINAL FORM -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column: Checkout Terminal Form -->
      <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 class="text-base font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
          <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <span>Withdraw Cash Checkout Form</span>
        </h3>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Target Payment Gateway</label>
            <select x-model="form.gateway" class="w-full rounded-md border-slate-300 border p-2 text-xs font-semibold focus:ring-indigo-500">
              <option value="azampay">AzamPay (USSD Mobile Push)</option>
              <option value="selcom">Selcom (Minimal Checkout / Card / MNO)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Customer Phone Number (MNO)</label>
            <input type="text" x-model="form.phone" placeholder="0754123456 or 255712345678" class="w-full rounded-md border-slate-300 border p-2 text-xs">
            <span class="text-[10px] text-slate-400 mt-0.5 block">Format: 07xx, 06xx, or 255xx</span>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Withdrawal Amount (TZS)</label>
            <input type="number" x-model="form.amount" placeholder="10000" class="w-full rounded-md border-slate-300 border p-2 text-xs font-bold text-slate-900">
          </div>

          <div x-show="form.gateway === 'azampay'">
            <label class="block font-semibold text-slate-700 mb-1">Mobile Operator (AzamPay Provider)</label>
            <select x-model="form.provider" class="w-full rounded-md border-slate-300 border p-2 text-xs">
              <option value="">Auto-Detect from Phone Prefix</option>
              <option value="Mpesa">Vodacom M-Pesa (Mpesa)</option>
              <option value="Tigo">Tigo Pesa (Tigo)</option>
              <option value="Airtel">Airtel Money (Airtel)</option>
              <option value="Halopesa">HaloPesa (Halopesa)</option>
              <option value="Azampesa">AzamPesa (Azampesa)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">External Order Reference ID</label>
            <div class="flex space-x-1">
              <input type="text" x-model="form.external_reference" class="w-full rounded-md border-slate-300 border p-2 text-xs font-mono">
              <button @click="generateNewRef()" class="px-2 bg-slate-100 border text-slate-600 rounded text-[11px]">New</button>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Customer Name &amp; Email (Optional)</label>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" x-model="form.name" placeholder="John Doe" class="w-full rounded-md border-slate-300 border p-2 text-xs">
              <input type="email" x-model="form.email" placeholder="customer@example.com" class="w-full rounded-md border-slate-300 border p-2 text-xs">
            </div>
          </div>
        </div>

        <!-- Button Loading Feedback Notice -->
        <div x-show="loading" class="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs flex items-center space-x-2 animate-pulse" x-cloak>
          <svg class="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m0 14v1m8-8h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"></path></svg>
          <span class="font-medium">Sending withdrawal request to gateway... Please wait.</span>
        </div>

        <!-- Submit Button with Clear Loading Spinner and Disabled State -->
        <button @click="submitCashWithdrawal()" :disabled="loading" :class="loading ? 'bg-slate-400 cursor-not-allowed opacity-75' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'" class="w-full py-3.5 text-white font-bold text-sm rounded-lg transition flex items-center justify-center space-x-2">
          <svg x-show="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" x-cloak>
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg x-show="!loading" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          <span x-text="loading ? '⏳ Processing Cash Withdrawal...' : '💸 Trigger Cash Withdrawal / Push'"></span>
        </button>
      </div>

      <!-- Right Column: Live Integration Inspector & Raw Details -->
      <div class="lg:col-span-2 space-y-4">
        
        <!-- Response Status Box -->
        <div id="response-box" class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="text-base font-bold text-slate-900 flex items-center space-x-2">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>Latest Withdrawal Response &amp; Integration Proof</span>
            </h3>

            <button @click="copyIntegrationProof()" x-show="latestResponse" class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded flex items-center space-x-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
              <span>📋 Copy Proof Data for AzamPay Team</span>
            </button>
          </div>

          <template x-if="loading">
            <div class="py-12 text-center space-y-3">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p class="text-xs font-semibold text-indigo-700">Connecting to gateway and initiating cash withdrawal...</p>
            </div>
          </template>

          <template x-if="!loading && !latestResponse">
            <div class="text-center py-12 text-slate-400 text-xs">
              Fill the form on the left and click <strong>"Trigger Cash Withdrawal"</strong> to inspect raw gateway integration details.
            </div>
          </template>

          <template x-if="!loading && latestResponse">
            <div class="space-y-4 text-xs">
              <div class="p-3 rounded-lg flex items-center justify-between" :class="latestResponse.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'">
                <div>
                  <span class="font-bold text-sm block" x-text="latestResponse.success ? '✓ Gateway Request Succeeded' : '✗ Gateway Request Failed'"></span>
                  <span class="text-xs" x-text="latestResponse.message"></span>
                </div>
                <template x-if="latestResponse.payment_url">
                  <a :href="latestResponse.payment_url" target="_blank" class="px-3 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition">
                    Open Selcom Pay Page 🔗
                  </a>
                </template>
              </div>

              <div>
                <h4 class="font-bold text-slate-700 mb-1">Initiation Response Payload (Raw JSON):</h4>
                <pre class="bg-slate-900 text-slate-100 p-3 rounded font-mono text-[11px] overflow-x-auto" x-text="JSON.stringify(latestResponse, null, 2)"></pre>
              </div>
            </div>
          </template>
        </div>

        <!-- Captured Sandbox Transactions Table -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>Sandbox Transaction History</span>
              <span class="px-2.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-semibold" x-text="transactions.length + ' Total'"></span>
            </h3>
            <button @click="fetchTransactions()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border transition">
              🔄 Refresh
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th class="p-3 text-left">Time</th>
                  <th class="p-3 text-left">Gateway</th>
                  <th class="p-3 text-left">External Reference</th>
                  <th class="p-3 text-left">Phone</th>
                  <th class="p-3 text-left">Amount</th>
                  <th class="p-3 text-left">Status</th>
                  <th class="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <template x-if="transactions.length === 0">
                  <tr>
                    <td colspan="7" class="text-center py-8 text-slate-400 text-xs">
                      No sandbox transactions recorded yet.
                    </td>
                  </tr>
                </template>
                <template x-for="txn in transactions" :key="txn.id">
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 text-xs text-slate-500" x-text="new Date(txn.created_at).toLocaleTimeString()"></td>
                    <td class="p-3 text-xs font-bold uppercase text-slate-700" x-text="txn.gateway"></td>
                    <td class="p-3 font-mono text-xs font-semibold text-slate-900" x-text="txn.external_id"></td>
                    <td class="p-3 text-xs" x-text="txn.phone"></td>
                    <td class="p-3 text-xs font-semibold">TZS <span x-text="Number(txn.amount).toLocaleString()"></span></td>
                    <td class="p-3">
                      <span class="px-2.5 py-0.5 text-xs font-bold rounded-full"
                        :class="{
                          'bg-yellow-100 text-yellow-800 border border-yellow-300': txn.status === 'pending',
                          'bg-green-100 text-green-800 border border-green-300': txn.status === 'approved',
                          'bg-red-100 text-red-800 border border-red-300': txn.status === 'rejected' || txn.status === 'timeout'
                        }"
                        x-text="txn.status">
                      </span>
                    </td>
                    <td class="p-3 text-right space-x-1">
                      <template x-if="txn.status === 'pending'">
                        <div class="inline-flex space-x-1">
                          <template x-if="txn.gateway === 'selcom'">
                            <a :href="'/emulator/selcom-pay/' + txn.external_id" target="_blank" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm">
                              🔗 Pay Page
                            </a>
                          </template>
                          <button @click="resolveTxn(txn.id, 'approve')" class="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded shadow-sm">
                            ✓ Approve Callback
                          </button>
                          <button @click="resolveTxn(txn.id, 'reject')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm">
                            ✗ Reject Callback
                          </button>
                        </div>
                      </template>
                      <template x-if="txn.status !== 'pending'">
                        <span class="text-xs text-slate-400 italic">Callback Fired</span>
                      </template>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>

  <script>
    function emulatorData() {
      return {
        origin: window.location.origin,
        transactions: [],
        loading: false,
        latestResponse: null,
        form: {
          gateway: 'azampay',
          phone: '0754123456',
          amount: 10000,
          provider: '',
          external_reference: 'ORDER-' + Math.floor(Math.random() * 1000000),
          name: 'Customer Test',
          email: 'customer@example.com'
        },
        init() {
          this.fetchTransactions();
          setInterval(() => this.fetchTransactions(), 3000);
        },
        generateNewRef() {
          this.form.external_reference = 'ORDER-' + Math.floor(Math.random() * 1000000);
        },
        async autoConfigureSandbox() {
          const res = await fetch('/api/emulator/configure-sandbox', { method: 'POST' });
          const data = await res.json();
          alert(data.message || 'Sandbox configured successfully!');
        },
        async submitCashWithdrawal() {
          if (this.loading) return;
          this.loading = true;
          this.latestResponse = null;

          try {
            const payload = {
              gateway: this.form.gateway,
              amount: parseFloat(this.form.amount),
              phone: this.form.phone,
              external_reference: this.form.external_reference,
              name: this.form.name,
              email: this.form.email,
              remarks: 'Cash Withdrawal Test Terminal'
            };

            if (this.form.gateway === 'azampay' && this.form.provider) {
              payload.provider = this.form.provider;
            }

            const res = await fetch('/api/v1/payments/initiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await res.json();
            this.latestResponse = data;
            this.fetchTransactions();
            this.generateNewRef();

            // Smooth scroll to response box
            setTimeout(() => {
              const el = document.getElementById('response-box');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } catch(e) {
            this.latestResponse = { success: false, message: 'Withdrawal request failed: ' + e.message };
          } finally {
            this.loading = false;
          }
        },
        async fetchTransactions() {
          try {
            const res = await fetch('/api/emulator/transactions');
            if (res.ok) {
              this.transactions = await res.json();
            }
          } catch(e) {}
        },
        async resolveTxn(id, action) {
          const res = await fetch('/api/emulator/resolve/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
          });
          const data = await res.json();
          if (data.error) {
            alert(data.error);
          } else {
            this.fetchTransactions();
          }
        },
        copyIntegrationProof() {
          if (!this.latestResponse) return;
          const str = JSON.stringify(this.latestResponse, null, 2);
          navigator.clipboard.writeText(str);
          alert('Proof JSON copied to clipboard! You can now paste and send this to the AzamPay/Selcom developer team.');
        }
      }
    }
  </script>`;

  return renderLayout({ title: 'Payment Terminal & Integration Proof Tool', activeTab: 'emulator', content });
}
