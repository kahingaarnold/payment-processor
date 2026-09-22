export function renderLayout({ title, activeTab, content, flashMessage }) {
  const flashHtml = flashMessage
    ? `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <div class="rounded-md ${
        flashMessage.type === 'error' ? 'bg-red-50 border-l-4 border-red-400 p-4 text-red-700' : 'bg-green-50 border-l-4 border-green-400 p-4 text-green-700'
      }">
        <p class="font-medium">${flashMessage.text}</p>
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Payment Processor</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="h-full font-sans antialiased text-slate-800 flex flex-col min-h-screen">
  <!-- Navbar -->
  <nav class="bg-slate-900 border-b border-slate-800 text-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-3">
          <div class="bg-indigo-600 p-2 rounded-lg text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <div>
            <span class="font-bold text-lg text-white">Payment Processor</span>
            <span class="ml-2 px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">Cloudflare Edge</span>
          </div>
        </div>
        <div class="flex space-x-2">
          <a href="/" class="px-3 py-2 text-sm font-medium rounded-md transition ${
            activeTab === 'config' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }">Config & Logs</a>
          <a href="/emulator" class="px-3 py-2 text-sm font-medium rounded-md transition flex items-center space-x-1 ${
            activeTab === 'emulator' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <span>Emulator Sandbox</span>
          </a>
        </div>
      </div>
    </div>
  </nav>

  ${flashHtml}

  <!-- Main Content -->
  <main class="flex-1 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      ${content}
    </div>
  </main>

  <footer class="bg-white border-t border-slate-200 py-4 mt-auto">
    <div class="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
      Payment Processor Middleware &copy; ${new Date().getFullYear()} — Powered by Cloudflare Workers &amp; Hono JS
    </div>
  </footer>
</body>
</html>`;
}
