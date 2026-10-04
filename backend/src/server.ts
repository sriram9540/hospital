import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { getDb } from './lib/db.js';
import { AppError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { reminderWorker } from './workers/reminder.worker.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter, adminCatalogRouter } from './modules/catalog/catalog.routes.js';
import { slotsRouter } from './modules/slots/slots.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { remindersRouter } from './modules/reminders/reminders.routes.js';
import { waitlistRouter } from './modules/waitlist/waitlist.routes.js';

export const app = express();

// Basic middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serverless DB initializer: ensure database is initialized on incoming requests
let dbInitPromise: Promise<any> | null = null;
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!dbInitPromise) {
      dbInitPromise = getDb();
    }
    await dbInitPromise;
    next();
  } catch (err) {
    logger.error('Database connection error in request lifecycle', err);
    next(err);
  }
});

// Health check endpoints
const healthHandler = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MEDI BOOK Appointment API',
    time: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// Vercel Cron Endpoint: /api/cron/reminders
const cronHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Processing Vercel scheduled reminder cron job');
    const processed = await reminderWorker.processDueJobs();
    res.json({ ok: true, processed, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

app.get('/api/cron/reminders', cronHandler);
app.get('/cron/reminders', cronHandler);
app.post('/api/cron/reminders', cronHandler);
app.post('/cron/reminders', cronHandler);

// API router v1
const apiV1 = express.Router();
apiV1.use('/auth', authRouter);
apiV1.use('/', catalogRouter);
apiV1.use('/admin', adminCatalogRouter);
apiV1.use('/', slotsRouter);
apiV1.use('/appointments', appointmentsRouter);
apiV1.use('/reminders', remindersRouter);
apiV1.use('/waitlist', waitlistRouter);
apiV1.get('/health', healthHandler);

// Mount API routes across common prefixes so Vercel rewrites and standard calls succeed
app.use('/api/v1', apiV1);
app.use('/v1', apiV1);

// Error handling middleware
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

export default app;
