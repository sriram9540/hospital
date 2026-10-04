import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, Loader2, ArrowRight, Ban, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Appointment } from '../types/index.js';
import { api } from '../api/client.js';
import { RescheduleModal } from './RescheduleModal.js';

interface MyAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookNew: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const MyAppointmentsModal: React.FC<MyAppointmentsModalProps> = ({
  isOpen,
  onClose,
  onBookNew,
  onShowToast,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getMyAppointments();
      setAppointments(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load your appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAppointments();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = async (appt: Appointment) => {
    if (!window.confirm(`Are you sure you want to cancel your appointment with ${appt.doctorName}?`)) {
      return;
    }

    setCancellingId(appt.id);
    try {
      await api.cancelAppointment(appt.id);
      onShowToast('success', `Appointment with ${appt.doctorName} was cancelled.`);
      await fetchAppointments();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

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

  const statusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'booked':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Booked
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1E4ED8] border border-blue-200">
            Completed
          </span>
        );
      case 'rescheduled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Rescheduled
          </span>
        );
      case 'no_show':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            No Show
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-bold text-slate-900">My Appointments</h3>
              <p className="text-xs text-slate-500">Upcoming consultations and medical visit history</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#1E4ED8]" />
                <span className="text-sm">Loading your appointments...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E4ED8] flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800">No appointments scheduled</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                  You do not have any active or past appointments recorded. You can book an online consultation anytime.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onBookNew();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-semibold shadow-md transition-all"
                >
                  Book an appointment →
                </button>
              </div>
            ) : (
              appointments.map((appt) => {
                const isUpcoming = appt.status === 'booked' && new Date(appt.startsAt).getTime() > Date.now();
                return (
                  <div
                    key={appt.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{appt.doctorName}</h4>
                          {statusBadge(appt.status)}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{appt.departmentName}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">
                          {formatSlotDate(appt.startsAt)}
                        </div>
                        <div className="text-xs font-semibold text-[#1E4ED8]">
                          {formatSlotTime(appt.startsAt)}
                        </div>
                      </div>
                    </div>

                    {appt.reason && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <span className="font-medium text-slate-400">Note: </span>
                        {appt.reason}
                      </p>
                    )}

                    {isUpcoming && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setRescheduleTarget(appt)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#1E4ED8] text-xs font-semibold text-slate-700 hover:text-[#1E4ED8] transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          disabled={cancellingId === appt.id}
                          onClick={() => handleCancel(appt)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-xs font-semibold text-rose-700 transition-colors"
                        >
                          {cancellingId === appt.id ? 'Cancelling...' : 'Cancel Visit'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Hospital Support: +91 40 2345 6789
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {rescheduleTarget && (
        <RescheduleModal
          isOpen={Boolean(rescheduleTarget)}
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={(updated) => {
            setRescheduleTarget(null);
            onShowToast('success', `Appointment rescheduled to ${formatSlotDate(updated.startsAt)}`);
            fetchAppointments();
          }}
        />
      )}
    </>
  );
};
