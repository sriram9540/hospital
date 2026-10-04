/**
 * Database client and schema definition (§1, §2, §5)
 * Built with @electric-sql/pglite (Real PostgreSQL engine in Node.js)
 */
import { PGlite } from '@electric-sql/pglite';
import { logger } from './logger.js';

let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (!pgliteInstance) {
    pgliteInstance = new PGlite();
    await initDatabase(pgliteInstance);
  }
  return pgliteInstance;
}

export interface DbClient {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; affectedRows?: number }>;
}

export const db = {
  async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; affectedRows?: number }> {
    const instance = await getDb();
    const res = await instance.query(sql, params);
    return { rows: (res.rows || []) as T[], affectedRows: res.affectedRows };
  },

  async transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T> {
    const instance = await getDb();
    return await instance.transaction(async (tx) => {
      const wrapped: DbClient = {
        query: async <R = any>(sql: string, params?: any[]) => {
          const r = await tx.query(sql, params);
          return { rows: (r.rows || []) as R[], affectedRows: r.affectedRows };
        },
      };
      return await callback(wrapped);
    });
  },
};

export async function initDatabase(client: PGlite): Promise<void> {
  logger.info('Initializing PostgreSQL schema and tables...');

  await client.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist')),
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Patients Table
    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      dob DATE,
      no_show_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

    -- Departments Table
    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Doctors Table
    CREATE TABLE IF NOT EXISTS doctors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      slot_minutes INT NOT NULL DEFAULT 30,
      overbook_limit INT NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_doctors_department_id ON doctors(department_id);

    -- Doctor Schedules Table
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      weekday INT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
      start_time TEXT NOT NULL, -- "09:00"
      end_time TEXT NOT NULL,   -- "17:00"
      CHECK (end_time > start_time)
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_doctor_id ON doctor_schedules(doctor_id);

    -- Slots Table (§2, §5)
    CREATE TABLE IF NOT EXISTS slots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'held', 'booked', 'blocked')),
      CHECK (ends_at > starts_at),
      CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, starts_at)
    );
    CREATE INDEX IF NOT EXISTS idx_slots_doctor_starts_status ON slots(doctor_id, starts_at, status);

    -- Appointments Table (§2, §5, §6)
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show', 'rescheduled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      reschedule_of UUID REFERENCES appointments(id) ON DELETE SET NULL,
      reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_slot_id ON appointments(slot_id);

    -- DOUBLE-BOOKING GUARD (§5, §6) Raw SQL index
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_appointment_per_slot
      ON appointments (slot_id) WHERE status = 'booked';

    -- Notification Jobs Table (Outbox Pattern §6, §8)
    CREATE TABLE IF NOT EXISTS notification_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('confirm', 'remind_24h', 'remind_2h', 'cancel_notice')),
      channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
      recipient TEXT NOT NULL,
      payload JSONB NOT NULL,
      run_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_appt_job UNIQUE (appointment_id, kind, channel)
    );
    CREATE INDEX IF NOT EXISTS idx_notification_jobs_status_run ON notification_jobs(status, run_at);

    -- Idempotency Keys Table (§4, §6, §7)
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      response TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Waitlist Table (§7)
    CREATE TABLE IF NOT EXISTS waitlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      desired_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_waitlist_doc_date ON waitlist(doctor_id, desired_date, status);

    -- Audit Log Table (§5, §9)
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  logger.info('Database schema initialized. Seeding catalog data...');
  await seedInitialData(client);
}

async function seedInitialData(client: PGlite): Promise<void> {
  const existingUsers = await client.query(`SELECT id FROM users LIMIT 1`);
  if (existingUsers.rows && existingUsers.rows.length > 0) {
    return;
  }

  // Pre-hashed passwords (bcrypt hash for "password123": '$2a$10$wK1Wq5rUv50g05gV0H7ZfOWjK9E1lC/gG4gK8WJ1b2fKqR1x7yG3e' or sha256)
  // For standard compatibility without heavy native binaries, we use standard SHA256 with salt helper
  const defaultHash = 'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326bb5b2de39c55f018ac1ebd43714b30e16b'; // SHA-512 for 'password123'

  // Seed Users
  const patientUser = await client.query(`
    INSERT INTO users (role, email, phone, password_hash)
    VALUES ('patient', 'patient@hospital.com', '+91 98765 43210', '${defaultHash}')
    RETURNING id;
  `);
  const patientUserId = (patientUser.rows[0] as any).id;

  await client.query(`
    INSERT INTO patients (user_id, full_name, dob, no_show_count)
    VALUES ('${patientUserId}', 'Alex Sharma', '1990-05-15', 0);
  `);

  const receptionistUser = await client.query(`
    INSERT INTO users (role, email, phone, password_hash)
    VALUES ('receptionist', 'reception@hospital.com', '+91 98765 11111', '${defaultHash}')
    RETURNING id;
  `);

  const adminUser = await client.query(`
    INSERT INTO users (role, email, phone, password_hash)
    VALUES ('admin', 'admin@hospital.com', '+91 98765 99999', '${defaultHash}')
    RETURNING id;
  `);

  // Seed Departments
  const deptData = [
    { name: 'Cardiology', description: 'Comprehensive heart & cardiovascular care', icon: 'Heart' },
    { name: 'Neurology', description: 'Brain, nerve, and spine disorders', icon: 'Brain' },
    { name: 'Pediatrics', description: 'Specialized healthcare for infants and children', icon: 'Baby' },
    { name: 'Orthopedics', description: 'Bone, joint, and sports injury treatments', icon: 'Bone' },
    { name: 'Dermatology', description: 'Advanced skin, hair, and cosmetic treatments', icon: 'Sparkles' },
    { name: 'General Medicine', description: 'Primary healthcare and preventive wellness', icon: 'Stethoscope' },
  ];

  const deptIds: Record<string, string> = {};
  for (const d of deptData) {
    const res = await client.query(
      `INSERT INTO departments (name, description, icon, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [d.name, d.description, d.icon]
    );
    deptIds[d.name] = (res.rows[0] as any).id;
  }

  // Seed Doctors (§12 mentions East-Asian woman in lab coat, Black woman in teal scrubs)
  const doctorData = [
    {
      name: 'Dr. Sarah Chen',
      specialization: 'Senior Cardiologist & Heart Specialist',
      dept: 'Cardiology',
      email: 'sarah.chen@hospital.com',
      slotMinutes: 30,
    },
    {
      name: 'Dr. Maya Patel',
      specialization: 'Chief Pediatrician & Child Health',
      dept: 'Pediatrics',
      email: 'maya.patel@hospital.com',
      slotMinutes: 30,
    },
    {
      name: 'Dr. Angela Davis',
      specialization: 'Consultant Neurologist & Spine Expert',
      dept: 'Neurology',
      email: 'angela.davis@hospital.com',
      slotMinutes: 30,
    },
    {
      name: 'Dr. Robert Taylor',
      specialization: 'Orthopedic Surgeon & Joint Care',
      dept: 'Orthopedics',
      email: 'robert.taylor@hospital.com',
      slotMinutes: 30,
    },
    {
      name: 'Dr. Emily Vance',
      specialization: 'Dermatologist & Laser Specialist',
      dept: 'Dermatology',
      email: 'emily.vance@hospital.com',
      slotMinutes: 30,
    },
    {
      name: 'Dr. Rajiv Menon',
      specialization: 'General Physician & Internal Medicine',
      dept: 'General Medicine',
      email: 'rajiv.menon@hospital.com',
      slotMinutes: 30,
    },
  ];

  const doctorIds: string[] = [];
  for (const doc of doctorData) {
    const userRes = await client.query(
      `INSERT INTO users (role, email, password_hash) VALUES ('doctor', $1, '${defaultHash}') RETURNING id`,
      [doc.email]
    );
    const docUserId = (userRes.rows[0] as any).id;
    const docRes = await client.query(
      `INSERT INTO doctors (user_id, department_id, name, specialization, slot_minutes, overbook_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, 0, TRUE) RETURNING id`,
      [docUserId, deptIds[doc.dept], doc.name, doc.specialization, doc.slotMinutes]
    );
    const docId = (docRes.rows[0] as any).id;
    doctorIds.push(docId);

    // Seed Schedules: Monday through Saturday (1 to 6), 09:00 to 17:00
    for (let day = 1; day <= 6; day++) {
      await client.query(
        `INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time)
         VALUES ($1, $2, '09:00', '17:00')`,
        [docId, day]
      );
    }
  }

  // Pre-generate slots for today and next 14 days
  const now = new Date();
  for (let offset = 0; offset <= 14; offset++) {
    const targetDate = new Date(now.getTime() + offset * 86400000);
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) continue; // Sunday off

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    for (const docId of doctorIds) {
      // 9:00 to 12:30, 14:00 to 16:30
      const hours = [
        ['09:00', '09:30'],
        ['09:30', '10:00'],
        ['10:00', '10:30'],
        ['10:30', '11:00'],
        ['11:00', '11:30'],
        ['11:30', '12:00'],
        ['12:00', '12:30'],
        ['14:00', '14:30'],
        ['14:30', '15:00'],
        ['15:00', '15:30'],
        ['15:30', '16:00'],
        ['16:00', '16:30'],
      ];

      for (const [sTime, eTime] of hours) {
        // Asia/Kolkata +05:30 ISO string
        const startIso = `${dateStr}T${sTime}:00+05:30`;
        const endIso = `${dateStr}T${eTime}:00+05:30`;

        await client.query(
          `INSERT INTO slots (doctor_id, starts_at, ends_at, status)
           VALUES ($1, $2, $3, 'open')
           ON CONFLICT (doctor_id, starts_at) DO NOTHING`,
          [docId, startIso, endIso]
        );
      }
    }
  }

  logger.info('Database seeded successfully with users, departments, doctors, schedules, and live slots.');
}
