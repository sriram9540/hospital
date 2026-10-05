import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './backend/src/lib/config.js';
import { getDb } from './backend/src/lib/db.js';
import { AppError } from './backend/src/lib/errors.js';
import { logger } from './backend/src/lib/logger.js';
import { reminderWorker } from './backend/src/workers/reminder.worker.js';

import { authRouter } from './backend/src/modules/auth/auth.routes.js';
import { catalogRouter, adminCatalogRouter } from './backend/src/modules/catalog/catalog.routes.js';
import { slotsRouter } from './backend/src/modules/slots/slots.routes.js';
import { appointmentsRouter } from './backend/src/modules/appointments/appointments.routes.js';
import { remindersRouter } from './backend/src/modules/reminders/reminders.routes.js';
import { waitlistRouter } from './backend/src/modules/waitlist/waitlist.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize DB & Reminder Worker
  try {
    await getDb();
    logger.info('Connected to PostgreSQL successfully');
    reminderWorker.start(CONFIG.REMINDER_POLL_INTERVAL_MS);
  } catch (err) {
    logger.error('Failed to initialize database', err);
    process.exit(1);
  }

  // API router v1 (§7)
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/', catalogRouter);
  apiV1.use('/admin', adminCatalogRouter);
  apiV1.use('/', slotsRouter);
  apiV1.use('/appointments', appointmentsRouter);
  apiV1.use('/reminders', remindersRouter);
  apiV1.use('/waitlist', waitlistRouter);

  // Health check endpoint
  apiV1.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'MEDI BOOK Appointment API', time: new Date().toISOString() });
  });

  app.use('/api/v1', apiV1);

  // Error handling middleware (§5, §7)
  // Formats: { error: { code, message, details } }
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error(`Server error during ${req.method} ${req.path}`, err);
      }
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    logger.error(`Unhandled error during ${req.method} ${req.path}`, err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'An unexpected internal error occurred. Please try again later.',
        details: {},
      },
    });
  });

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
