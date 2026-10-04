import { User, Department, Doctor, Slot, Appointment } from '../types/index.js';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class ApiClient {
  private baseUrl = '/api/v1';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = localStorage.getItem('hospital_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorObj = data.error || {
        code: 'INTERNAL',
        message: data.message || `Request failed with status ${response.status}`,
      };
      const error: any = new Error(errorObj.message);
      error.code = errorObj.code;
      error.details = errorObj.details;
      error.status = response.status;
      throw error;
    }

    return data as T;
  }

  // Auth
  async register(body: { email: string; password: string; fullName: string; phone: string; dob?: string }) {
    const res = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    localStorage.setItem('hospital_token', res.token);
    return res;
  }

  async login(body: { email: string; password: string }) {
    const res = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    localStorage.setItem('hospital_token', res.token);
    return res;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('hospital_token');
  }

  async getMe() {
    return await this.request<{ user: User }>('/auth/me');
  }

  // Catalog
  async getDepartments(): Promise<Department[]> {
    return await this.request<Department[]>('/departments');
  }

  async getDoctors(departmentId?: string): Promise<Doctor[]> {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<Doctor[]>(`/doctors${query}`);
  }

  async getDoctorSlots(doctorId: string, date: string): Promise<Slot[]> {
    return await this.request<Slot[]>(`/doctors/${doctorId}/slots?date=${date}`);
  }

  // Appointments
  async bookAppointment(slotId: string, reason?: string, existingIdempotencyKey?: string): Promise<Appointment> {
    const idempotencyKey = existingIdempotencyKey || generateUUID();
    return await this.request<Appointment>('/appointments', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ slotId, reason }),
    });
  }

  async getMyAppointments(): Promise<Appointment[]> {
    return await this.request<Appointment[]>('/appointments/mine');
  }

  async cancelAppointment(appointmentId: string): Promise<Appointment> {
    return await this.request<Appointment>(`/appointments/${appointmentId}/cancel`, {
      method: 'POST',
    });
  }

  async rescheduleAppointment(appointmentId: string, newSlotId: string, reason?: string, existingIdempotencyKey?: string): Promise<Appointment> {
    const idempotencyKey = existingIdempotencyKey || generateUUID();
    return await this.request<Appointment>(`/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ newSlotId, reason }),
    });
  }

  async joinWaitlist(doctorId: string, desiredDate: string) {
    return await this.request('/waitlist', {
      method: 'POST',
      body: JSON.stringify({ doctorId, desiredDate }),
    });
  }
}

export const api = new ApiClient();
