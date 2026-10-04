import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './backend/src/lib/config.js';
import { getDb } from './backend/src/lib/db.js';
import { logger } from './backend/src/lib/logger.js';
import { reminderWorker } from './backend/src/workers/reminder.worker.js';
import { app } from './backend/src/server.js';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize DB & Reminder Worker
  try {
    await getDb();
    logger.info('Connected to PostgreSQL successfully');
    reminderWorker.start(CONFIG.REMINDER_POLL_INTERVAL_MS);
  } catch (err) {
    logger.error('Failed to initialize database', err);
    process.exit(1);
  }

  // Frontend integration: Vite middleware in dev or static files in prod
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const port = CONFIG.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Hospital App Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  logger.error('Fatal error starting server', err);
});

export default app;
