import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Stethoscope,
  Heart,
  Brain,
  Baby,
  Bone,
  Loader2,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import { Department, Doctor, Slot, Appointment } from '../types/index.js';
import { api, generateUUID } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface BookingModalProps {
  isOpen: boolean;
  initialDepartmentId?: string;
  initialDoctorId?: string;
  onClose: () => void;
  onAppointmentBooked?: (appointment: Appointment) => void;
  onRequestAuth?: () => void;
}

const deptIcons: Record<string, React.ReactNode> = {
  Heart: <Heart className="w-5 h-5 text-rose-500" />,
  Brain: <Brain className="w-5 h-5 text-indigo-500" />,
  Baby: <Baby className="w-5 h-5 text-amber-500" />,
  Bone: <Bone className="w-5 h-5 text-cyan-500" />,
  Sparkles: <Sparkles className="w-5 h-5 text-purple-500" />,
  Stethoscope: <Stethoscope className="w-5 h-5 text-blue-500" />,
};

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  initialDepartmentId,
  initialDoctorId,
  onClose,
  onAppointmentBooked,
  onRequestAuth,
}) => {
  const { user } = useAuth();

  // Steps: 1: Department, 2: Doctor, 3: Date & Slot, 4: Confirm/Review, 5: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Selections
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);

  // Date selection (default today in YYYY-MM-DD)
  const todayStr = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState<string>('');

  // Status & Idempotency Key (§11)
  const [loading, setLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [bookingInFlight, setBookingInFlight] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateUUID());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [slotTakenAlert, setSlotTakenAlert] = useState<string>('');
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // Load departments
  useEffect(() => {
    if (!isOpen) return;
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const depts = await api.getDepartments();
        setDepartments(depts);

        if (initialDepartmentId) {
          const found = depts.find((d) => d.id === initialDepartmentId);
          if (found) {
            setSelectedDept(found);
            setStep(2);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load hospital departments');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [isOpen, initialDepartmentId]);

  // Load doctors when department selected
  useEffect(() => {
    if (!selectedDept) return;
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const docs = await api.getDoctors(selectedDept.id);
        setDoctors(docs);
        if (initialDoctorId) {
          const found = docs.find((d) => d.id === initialDoctorId);
          if (found) {
            setSelectedDoc(found);
            setStep(3);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load doctors');
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [selectedDept, initialDoctorId]);

  // Load slots when doctor and date selected (Live Availability §4, §11)
  const refreshSlots = async () => {
    if (!selectedDoc || !selectedDate) return;
    setSlotLoading(true);
    setSlotTakenAlert('');
    try {
      const liveSlots = await api.getDoctorSlots(selectedDoc.id, selectedDate);
      setSlots(liveSlots);
      // Clear selectedSlot if it's no longer open
      if (selectedSlot && !liveSlots.some((s) => s.id === selectedSlot.id)) {
        setSelectedSlot(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load available slots');
    } finally {
      setSlotLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3 && selectedDoc && selectedDate) {
      refreshSlots();
    }
  }, [step, selectedDoc, selectedDate]);

  // Format time for hospital timezone
  const formatSlotTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatSlotDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleBook = async () => {
    if (!user) {
      if (onRequestAuth) onRequestAuth();
      return;
    }
    if (!selectedSlot) return;

    setBookingInFlight(true);
    setErrorMessage('');
    setSlotTakenAlert('');

    try {
      // Re-use current idempotencyKey on retry per §11
      const appt = await api.bookAppointment(selectedSlot.id, reason, idempotencyKey);
      setBookedAppointment(appt);
      setStep(5);
      if (onAppointmentBooked) onAppointmentBooked(appt);
    } catch (err: any) {
      // §11: On SLOT_TAKEN: friendly message + refresh slot list, keep choices
      if (err.code === 'SLOT_TAKEN') {
        setSlotTakenAlert(
          'Someone just booked that specific time slot. Please choose another available time below.'
        );
        // Refresh slot list
        await refreshSlots();
        setSelectedSlot(null);
        setStep(3); // return to slot selection step with choices preserved
      } else {
        setErrorMessage(err.message || 'An error occurred while booking');
      }
    } finally {
      setBookingInFlight(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user) {
      if (onRequestAuth) onRequestAuth();
      return;
    }
    if (!selectedDoc) return;
    try {
      await api.joinWaitlist(selectedDoc.id, selectedDate);
      setWaitlistSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not join waitlist');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {step > 1 && step < 5 && (
              <button
                onClick={() => {
                  setErrorMessage('');
                  setSlotTakenAlert('');
                  setStep((prev) => (prev - 1) as any);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {step === 1 && 'Select Medical Department'}
                {step === 2 && `${selectedDept?.name} Specialists`}
                {step === 3 && 'Choose Date & Consultation Slot'}
                {step === 4 && 'Confirm Your Appointment'}
                {step === 5 && 'Appointment Confirmed'}
              </h3>
              <p className="text-xs text-slate-500">
                Step {step} of 4 • Hospital Timezone: Asia/Kolkata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Alert / Slot Taken Friendly Notice (§11) */}
        {slotTakenAlert && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="font-medium leading-relaxed">{slotTakenAlert}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4">
          {/* STEP 1: Department Selection */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select clinical department to consult
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1E4ED8]" />
                  <span className="text-sm">Loading clinical departments...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => {
                        setSelectedDept(dept);
                        setSelectedDoc(null);
                        setSelectedSlot(null);
                        setStep(2);
                      }}
                      className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:border-[#1E4ED8] hover:bg-blue-50/40 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:shadow-sm">
                        {deptIcons[dept.icon || 'Heart'] || <Stethoscope className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm group-hover:text-[#1E4ED8] transition-colors">
                          {dept.name}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {dept.description}
                        </div>
                        <div className="text-[11px] font-medium text-slate-400 mt-1.5">
                          {dept.doctorCount || 1} specialist(s) available
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Doctor Selection */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Available Doctors in {selectedDept?.name}
                </span>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-[#1E4ED8] hover:underline"
                >
                  Change Department
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1E4ED8]" />
                  <span className="text-sm">Fetching department specialists...</span>
                </div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No specialists currently listed in this department.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {doctors.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDoc(doc);
                        setSelectedSlot(null);
                        setStep(3);
                      }}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-[#1E4ED8] hover:bg-blue-50/30 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#1E4ED8]/10 text-[#1E4ED8] flex items-center justify-center font-bold text-base shrink-0">
                          {doc.name.split(' ').slice(1).map(n => n[0]).join('') || 'DR'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-[#1E4ED8] transition-colors">
                            {doc.name}
                          </div>
                          <div className="text-xs text-slate-500">{doc.specialization}</div>
                          <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            {doc.slotMinutes} min consultation
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1E4ED8] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Date & Slot Selection (Live Availability §4, §11) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{selectedDoc?.name}</div>
                  <div className="text-xs text-slate-500">{selectedDept?.name}</div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-[#1E4ED8] font-medium hover:underline"
                >
                  Change Doctor
                </button>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Consultation Date
                </label>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4ED8] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Slot Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Live Available Slots ({slots.length})
                  </span>
                  <button
                    onClick={refreshSlots}
                    disabled={slotLoading}
                    className="flex items-center gap-1 text-[11px] text-[#1E4ED8] hover:underline"
                  >
                    <RefreshCw className={`w-3 h-3 ${slotLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {slotLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1E4ED8]" />
                    <span className="text-xs">Checking real-time slot availability...</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-center space-y-2">
                    <p className="text-xs text-amber-900 font-medium">
                      No open slots available for {formatSlotDate(selectedDate)}.
                    </p>
                    <p className="text-[11px] text-amber-700">
                      You can try another date or join the waitlist to be alerted if an appointment cancels.
                    </p>
                    <button
                      type="button"
                      onClick={handleJoinWaitlist}
                      disabled={waitlistSuccess}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      {waitlistSuccess ? 'Joined Waitlist!' : 'Join Waitlist for This Date'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                            isSelected
                              ? 'bg-[#1E4ED8] border-[#1E4ED8] text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-[#1E4ED8] hover:bg-blue-50/50'
                          }`}
                        >
                          {formatSlotTime(slot.startsAt)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Review & Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Doctor</span>
                  <span className="text-xs font-bold text-slate-900">{selectedDoc?.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Department</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedDept?.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Date</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {selectedSlot ? formatSlotDate(selectedSlot.startsAt) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Time</span>
                  <span className="text-xs font-bold text-[#1E4ED8]">
                    {selectedSlot ? formatSlotTime(selectedSlot.startsAt) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Patient</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {user?.name || 'Logged in user'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for visit or symptoms (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="E.g., Routine checkup, chest tightness, consultation..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E4ED8] focus:border-transparent"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 text-blue-900 text-[11px] leading-relaxed">
                ℹ️ <strong>Cancellation Policy:</strong> You may cancel or reschedule up to 2 hours before the appointment. Reminders will be sent via SMS automatically.
              </div>
            </div>
          )}

          {/* STEP 5: Success Screen */}
          {step === 5 && bookedAppointment && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900">Appointment Confirmed!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Your appointment with {bookedAppointment.doctorName} has been booked.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-semibold text-slate-800">
                    {formatSlotDate(bookedAppointment.startsAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time:</span>
                  <span className="font-semibold text-[#1E4ED8]">
                    {formatSlotTime(bookedAppointment.startsAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Doctor:</span>
                  <span className="font-semibold text-slate-800">
                    {bookedAppointment.doctorName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Appointment ID:</span>
                  <span className="font-mono text-[10px] text-slate-600">
                    {bookedAppointment.id.slice(0, 13)}...
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                A confirmation SMS with reminder links has been queued to your registered number.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          {step < 5 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              {step === 3 && (
                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={() => {
                    setErrorMessage('');
                    setStep(4);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-semibold transition-all duration-150 transform hover:-translate-y-0.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue to Confirm →
                </button>
              )}

              {step === 4 && (
                <button
                  type="button"
                  disabled={bookingInFlight}
                  onClick={handleBook}
                  className="px-6 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-semibold transition-all duration-150 transform hover:-translate-y-0.5 shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {bookingInFlight ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Securing Slot...
                    </>
                  ) : (
                    'Confirm & Book Appointment'
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-semibold transition-all shadow-md"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
