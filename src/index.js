import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiRoutes } from './routes/api.js';
import { emulatorApiRoutes } from './routes/emulatorApi.js';
import { webRoutes } from './routes/web.js';

const app = new Hono();

// Enable CORS for API routes
app.use('/api/*', cors());

// Mount API routes
app.route('/api', apiRoutes);

// Mount Emulator API routes
app.route('/api/emulator', emulatorApiRoutes);

// Mount Web Dashboard routes
app.route('/', webRoutes);

// Global 404 handler
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, message: 'API Endpoint Not Found' }, 404);
  }
  return c.text('404 Page Not Found', 404);
});

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Error:', err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, message: 'Internal Server Error', error: err.message }, 500);
  }
  return c.text(`500 Internal Server Error: ${err.message}`, 500);
});

export default app;
