export interface User {
  userId: string;
  role: 'patient' | 'doctor' | 'admin' | 'receptionist';
  email: string;
  name: string;
  patientId?: string;
  doctorId?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  icon?: string;
  isActive: boolean;
  doctorCount?: number;
}

export interface Doctor {
  id: string;
  departmentId: string;
  departmentName?: string;
  name: string;
  specialization: string;
  slotMinutes: number;
  overbookLimit: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface Slot {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'held' | 'booked' | 'blocked';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  slotId: string;
  doctorId: string;
  doctorName?: string;
  departmentName?: string;
  startsAt: string;
  endsAt: string;
  status: 'booked' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled';
  createdAt: string;
  cancelledAt?: string;
  rescheduleOf?: string;
  reason?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
