import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Appointment, Slot } from '../types/index.js';
import { api, generateUUID } from '../api/client.js';

interface RescheduleModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSuccess: (updated: Appointment) => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState<string>(generateUUID());
  const [errorMsg, setErrorMsg] = useState('');

  const refreshSlots = async () => {
    if (!appointment || !selectedDate) return;
    setLoadingSlots(true);
    setErrorMsg('');
    try {
      const liveSlots = await api.getDoctorSlots(appointment.doctorId, selectedDate);
      setSlots(liveSlots);
      if (selectedSlot && !liveSlots.some((s) => s.id === selectedSlot.id)) {
        setSelectedSlot(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointment) {
      refreshSlots();
    }
  }, [isOpen, appointment, selectedDate]);

  if (!isOpen || !appointment) return null;

  const handleReschedule = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const updated = await api.rescheduleAppointment(
        appointment.id,
        selectedSlot.id,
        'Rescheduled via patient portal',
        idempotencyKey
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err.code === 'SLOT_TAKEN') {
        setErrorMsg('That slot was just booked by another patient. Please choose another slot.');
        await refreshSlots();
      } else {
        setErrorMsg(err.message || 'Could not reschedule appointment');
      }
    } finally {
      setSubmitting(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 mb-1">Reschedule Appointment</h3>
        <p className="text-xs text-slate-500 mb-4">
          Transfer your consultation with Dr. {appointment.doctorName} to another available slot.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select New Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="date"
                min={new Date().toISOString().substring(0, 10)}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4ED8]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Available Slots</span>
              <button
                onClick={refreshSlots}
                disabled={loadingSlots}
                className="flex items-center gap-1 text-[11px] text-[#1E4ED8] hover:underline"
              >
                <RefreshCw className={`w-3 h-3 ${loadingSlots ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#1E4ED8]" />
                <span className="text-xs">Checking live slots...</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                No slots available on this date. Please pick another date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        isSelected
                          ? 'bg-[#1E4ED8] border-[#1E4ED8] text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-[#1E4ED8]'
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

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
          >
            Never mind
          </button>
          <button
            type="button"
            disabled={!selectedSlot || submitting}
            onClick={handleReschedule}
            className="px-5 py-2.5 rounded-xl bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-semibold shadow-md disabled:opacity-40 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
