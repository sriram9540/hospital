/**
 * Database client and schema definition (§1, §2, §5)
 * Built with @electric-sql/pglite (Real PostgreSQL engine in Node.js)
 */
import { PGlite } from '@electric-sql/pglite';
import argon2 from 'argon2';
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

  const hash = async (p: string) => argon2.hash(p);
  const defaultHash = 'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326bb5b2de39c55f018ac1ebd43714b30e16b'; // fallback sha512 for password123

  // 1. Departments
  const deptData = [
    { name: 'Cardiology', description: 'Comprehensive heart & cardiovascular care', icon: 'Heart' },
    { name: 'Neurology', description: 'Brain, nerve, and spine disorders', icon: 'Brain' },
    { name: 'Orthopedics', description: 'Bone, joint, and sports injury treatments', icon: 'Bone' },
    { name: 'Pediatrics', description: 'Specialized healthcare for infants and children', icon: 'Baby' },
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

  // 2. Admin + Receptionist users (§2 in user seed request)
  const adminHash = await hash('Admin@123');
  const receptHash = await hash('Recept@123');

  await client.query(`
    INSERT INTO users (role, email, phone, password_hash)
    VALUES ('admin', 'admin@hospital.test', '+91 98765 99999', '${adminHash}');
  `);

  await client.query(`
    INSERT INTO users (role, email, phone, password_hash)
    VALUES ('receptionist', 'reception@hospital.test', '+91 98765 11111', '${receptHash}');
  `);

  // Also include default demo patient & staff
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

  // 3. Doctors (12 doctors across 6 departments with slot_minutes: 15)
  const doctorSeed = [
    { name: 'Dr. Rajesh Menon', dept: 'Cardiology', email: 'dr.menon@hospital.test', spec: 'Senior Interventional Cardiologist' },
    { name: 'Dr. Sarah Chen', dept: 'Cardiology', email: 'dr.chen@hospital.test', spec: 'Heart Failure & Arrhythmia Specialist' },
    { name: 'Dr. Angela Davis', dept: 'Neurology', email: 'dr.davis@hospital.test', spec: 'Consultant Neurologist & Stroke Care' },
    { name: 'Dr. David Miller', dept: 'Neurology', email: 'dr.miller@hospital.test', spec: 'Spine & Peripheral Nerve Specialist' },
    { name: 'Dr. Robert Taylor', dept: 'Orthopedics', email: 'dr.taylor@hospital.test', spec: 'Orthopedic Surgeon & Joint Replacement' },
    { name: 'Dr. Priya Sharma', dept: 'Orthopedics', email: 'dr.sharma@hospital.test', spec: 'Sports Injuries & Arthroscopy Expert' },
    { name: 'Dr. Maya Patel', dept: 'Pediatrics', email: 'dr.patel@hospital.test', spec: 'Chief Pediatrician & Child Health' },
    { name: 'Dr. Kevin White', dept: 'Pediatrics', email: 'dr.white@hospital.test', spec: 'Neonatal & Adolescent Specialist' },
    { name: 'Dr. Emily Vance', dept: 'Dermatology', email: 'dr.vance@hospital.test', spec: 'Clinical Dermatologist & Laser Therapy' },
    { name: 'Dr. Aisha Khan', dept: 'Dermatology', email: 'dr.khan@hospital.test', spec: 'Cosmetic & Aesthetic Skin Consultant' },
    { name: 'Dr. James Wilson', dept: 'General Medicine', email: 'dr.wilson@hospital.test', spec: 'Senior Consultant Physician' },
    { name: 'Dr. Sunita Rao', dept: 'General Medicine', email: 'dr.rao@hospital.test', spec: 'Internal Medicine & Preventive Care' },
  ];

  const doctorHash = await hash('Doctor@123');
  const doctorIds: string[] = [];

  for (const doc of doctorSeed) {
    const userRes = await client.query(
      `INSERT INTO users (role, email, password_hash) VALUES ('doctor', $1, '${doctorHash}') RETURNING id`,
      [doc.email]
    );
    const docUserId = (userRes.rows[0] as any).id;
    const docRes = await client.query(
      `INSERT INTO doctors (user_id, department_id, name, specialization, slot_minutes, overbook_limit, is_active)
       VALUES ($1, $2, $3, $4, 15, 0, TRUE) RETURNING id`,
      [docUserId, deptIds[doc.dept], doc.name, doc.spec]
    );
    const docId = (docRes.rows[0] as any).id;
    doctorIds.push(docId);

    // 4. Schedules: Mon-Fri morning 09:00-13:00 + afternoon 14:00-17:00, Sat morning 09:00-13:00
    for (const weekday of [1, 2, 3, 4, 5]) {
      await client.query(
        `INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time)
         VALUES ($1, $2, '09:00', '13:00'), ($1, $2, '14:00', '17:00')`,
        [docId, weekday]
      );
    }
    await client.query(
      `INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time)
       VALUES ($1, 6, '09:00', '13:00')`,
      [docId]
    );
  }

  // 5. Patients (patient1@test.com to patient5@test.com, password Pass@123)
  const patientHash = await hash('Pass@123');
  for (let i = 1; i <= 5; i++) {
    const email = `patient${i}@test.com`;
    const phone = `+91900000000${i}`;
    const fullName = `Test Patient ${i}`;

    const uRes = await client.query(
      `INSERT INTO users (role, email, phone, password_hash)
       VALUES ('patient', $1, $2, '${patientHash}')
       RETURNING id`,
      [email, phone]
    );
    const uId = (uRes.rows[0] as any).id;

    await client.query(
      `INSERT INTO patients (user_id, full_name, dob, no_show_count)
       VALUES ($1, $2, '1990-01-01', 0)`,
      [uId, fullName]
    );
  }

  // Pre-generate live slots for doctors (15-min intervals, Mon-Sat)
  const now = new Date();
  for (let offset = 0; offset <= 14; offset++) {
    const targetDate = new Date(now.getTime() + offset * 86400000);
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) continue; // Sunday off

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Schedules: Mon-Fri (9-13, 14-17), Sat (9-13)
    const timeBlocks = dayOfWeek === 6
      ? [{ start: 9 * 60, end: 13 * 60 }]
      : [{ start: 9 * 60, end: 13 * 60 }, { start: 14 * 60, end: 17 * 60 }];

    for (const docId of doctorIds) {
      for (const block of timeBlocks) {
        for (let min = block.start; min < block.end; min += 15) {
          const sH = String(Math.floor(min / 60)).padStart(2, '0');
          const sM = String(min % 60).padStart(2, '0');
          const eH = String(Math.floor((min + 15) / 60)).padStart(2, '0');
          const eM = String((min + 15) % 60).padStart(2, '0');

          const startIso = `${dateStr}T${sH}:${sM}:00+05:30`;
          const endIso = `${dateStr}T${eH}:${eM}:00+05:30`;

          await client.query(
            `INSERT INTO slots (doctor_id, starts_at, ends_at, status)
             VALUES ($1, $2, $3, 'open')
             ON CONFLICT (doctor_id, starts_at) DO NOTHING`,
            [docId, startIso, endIso]
          );
        }
      }
    }
  }

  logger.info('Database seeded successfully with users, departments, doctors, schedules, and live slots.');
}
