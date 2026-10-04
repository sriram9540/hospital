import React from 'react';
import { Heart, Brain, Baby, Bone, Sparkles, Stethoscope, ArrowRight } from 'lucide-react';
import { Department } from '../types/index.js';

interface ServicesDropdownProps {
  departments: Department[];
  isOpen: boolean;
  onSelectDepartment: (dept: Department) => void;
  onClose: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  Heart: <Heart className="w-5 h-5 text-rose-500" />,
  Brain: <Brain className="w-5 h-5 text-indigo-500" />,
  Baby: <Baby className="w-5 h-5 text-amber-500" />,
  Bone: <Bone className="w-5 h-5 text-cyan-500" />,
  Sparkles: <Sparkles className="w-5 h-5 text-purple-500" />,
  Stethoscope: <Stethoscope className="w-5 h-5 text-blue-500" />,
};

export const ServicesDropdown: React.FC<ServicesDropdownProps> = ({
  departments,
  isOpen,
  onSelectDepartment,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[460px] bg-white rounded-2xl p-4 shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-150"
      onMouseLeave={onClose}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 py-1 mb-2">
        Clinical Departments &amp; Specialities
      </div>
      <div className="grid grid-cols-2 gap-2">
        {departments.map((dept) => (
          <button
            key={dept.id}
            onClick={() => {
              onSelectDepartment(dept);
              onClose();
            }}
            className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:shadow-sm transition-all">
              {iconMap[dept.icon || 'Heart'] || <Stethoscope className="w-5 h-5 text-blue-500" />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-[#1E4ED8] flex items-center gap-1 transition-colors">
                {dept.name}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-tight">
                {dept.description}
              </p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-slate-100 px-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Emergency services available 24/7</span>
        <span className="font-semibold text-[#1E4ED8]">Hospital Helpline: +91 40 2345 6789</span>
      </div>
    </div>
  );
};
