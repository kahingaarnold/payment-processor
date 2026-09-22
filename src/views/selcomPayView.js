import { renderLayout } from './layout.js';

export function renderSelcomPayView(transaction, orderId) {
  const content = `
  <div class="max-w-md mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
    <div class="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
      <div>
        <h2 class="font-bold text-lg">Selcom Secure Pay</h2>
        <p class="text-xs text-blue-100">Sandbox Hosted Payment Checkout</p>
      </div>
      <div class="bg-white/20 p-2 rounded text-xs font-mono font-bold">
        SELCOM
      </div>
    </div>

    <div class="p-6 space-y-6">
      ${
        transaction
          ? `
      <div class="bg-slate-50 p-4 rounded-lg space-y-2 border text-sm">
        <div class="flex justify-between"><span class="text-slate-500">Order Ref:</span> <span class="font-mono font-bold">${transaction.external_id}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Customer:</span> <span class="font-semibold">${transaction.buyer_name || 'Customer'}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Phone:</span> <span>${transaction.phone}</span></div>
        <div class="flex justify-between border-t pt-2 text-base font-bold"><span class="text-slate-700">Total Amount:</span> <span class="text-blue-600">TZS ${Number(transaction.amount).toLocaleString()}</span></div>
      </div>

      ${
        transaction.status === 'pending'
          ? `
      <div class="space-y-3" x-data="{ loading: false }">
        <p class="text-xs text-slate-500 text-center">Select customer checkout simulation response:</p>
        <button @click="loading = true; resolve('${transaction.id}', 'approve')" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition text-sm">
          Pay Now (Simulate Success)
        </button>
        <button @click="loading = true; resolve('${transaction.id}', 'reject')" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border transition text-xs">
          Cancel Payment (Simulate Failure)
        </button>
      </div>`
          : `
      <div class="bg-green-50 text-green-800 p-4 rounded-lg text-center text-sm font-semibold">
        Payment already processed with status: ${transaction.status}
      </div>`
      }
      `
          : `
      <div class="text-center py-6 text-red-500 text-sm font-semibold">
        Order ${orderId} not found in emulator database.
      </div>`
      }
    </div>
  </div>

  <script>
    async function resolve(id, action) {
      const res = await fetch('/api/emulator/resolve/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        alert('Payment simulated: ' + action);
        window.location.href = '/emulator';
      } else {
        alert(data.error || 'Failed to simulate payment');
      }
    }
  </script>`;

  return renderLayout({ title: 'Selcom Sandbox Checkout', activeTab: 'emulator', content });
}
