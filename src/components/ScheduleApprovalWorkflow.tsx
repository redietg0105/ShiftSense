import React, { useState } from 'react';
import { DaySchedule, User } from '../types';
import { 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  Edit3, 
  RotateCcw, 
  Save, 
  Check, 
  Sparkles, 
  Clock, 
  UserCheck, 
  ChevronDown, 
  ChevronUp,
  FileCheck,
  CalendarDays,
  Plus,
  Minus
} from 'lucide-react';

interface ScheduleApprovalWorkflowProps {
  schedules: DaySchedule[];
  currentUser: User;
  onUpdateSchedule: (updatedSchedules: DaySchedule[]) => void;
  onSingleScheduleApprove: (date: string) => void;
  onApproveAll: () => void;
  onResetToRecommended: () => void;
}

export const ScheduleApprovalWorkflow: React.FC<ScheduleApprovalWorkflowProps> = ({
  schedules,
  currentUser,
  onUpdateSchedule,
  onSingleScheduleApprove,
  onApproveAll,
  onResetToRecommended,
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const canApprove = currentUser.role === 'nurse_manager' || currentUser.role === 'charge_nurse';

  const showToastMessage = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => {
      setSaveToast(null);
    }, 4000);
  };

  const handleAdjustRN = (
    date: string,
    shift: 'day' | 'night',
    delta: number
  ) => {
    const next = schedules.map((item) => {
      if (item.date !== date) return item;

      const currentDayRN = item.dayShift.managerOverrideRN ?? item.dayShift.recommendedRN;
      const currentNightRN = item.nightShift.managerOverrideRN ?? item.nightShift.recommendedRN;

      let newDayRN = currentDayRN;
      let newNightRN = currentNightRN;

      if (shift === 'day') {
        newDayRN = Math.max(3, Math.min(15, currentDayRN + delta));
      } else {
        newNightRN = Math.max(3, Math.min(15, currentNightRN + delta));
      }

      const hasOverride =
        newDayRN !== item.dayShift.recommendedRN ||
        newNightRN !== item.nightShift.recommendedRN;

      return {
        ...item,
        status: hasOverride ? ('modified' as const) : item.status,
        approvedBy: hasOverride ? undefined : item.approvedBy,
        approvedAt: hasOverride ? undefined : item.approvedAt,
        dayShift: {
          ...item.dayShift,
          managerOverrideRN: newDayRN,
        },
        nightShift: {
          ...item.nightShift,
          managerOverrideRN: newNightRN,
        },
      };
    });

    onUpdateSchedule(next);
    showToastMessage(`Staffing adjustment recorded for ${date}. Click "Approve Schedule" to lock.`);
  };

  const handleAdjustCNA = (
    date: string,
    shift: 'day' | 'night',
    delta: number
  ) => {
    const next = schedules.map((item) => {
      if (item.date !== date) return item;

      const currentDayCNA = item.dayShift.managerOverrideCNA ?? item.dayShift.recommendedCNA;
      const currentNightCNA = item.nightShift.managerOverrideCNA ?? item.nightShift.recommendedCNA;

      let newDayCNA = currentDayCNA;
      let newNightCNA = currentNightCNA;

      if (shift === 'day') {
        newDayCNA = Math.max(1, Math.min(8, currentDayCNA + delta));
      } else {
        newNightCNA = Math.max(1, Math.min(8, currentNightCNA + delta));
      }

      return {
        ...item,
        status: 'modified' as const,
        approvedBy: undefined,
        approvedAt: undefined,
        dayShift: {
          ...item.dayShift,
          managerOverrideCNA: newDayCNA,
        },
        nightShift: {
          ...item.nightShift,
          managerOverrideCNA: newNightCNA,
        },
      };
    });

    onUpdateSchedule(next);
    showToastMessage(`CNA staffing adjusted for ${date}.`);
  };

  const handleNotesChange = (date: string, notes: string) => {
    const next = schedules.map((item) => {
      if (item.date !== date) return item;
      return {
        ...item,
        managerNotes: notes,
      };
    });
    onUpdateSchedule(next);
  };

  const toggleExpand = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const approvedCount = schedules.filter((s) => s.status === 'approved' || Boolean(s.approvedBy)).length;
  const allApproved = approvedCount === schedules.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6" id="manager-approval-workflow">
      {/* Toast notification for persistence confirmation */}
      {saveToast && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <span className="text-[10px] text-emerald-600 uppercase tracking-wider font-bold">
            Persisted to Local Storage
          </span>
        </div>
      )}

      {/* Header & Global Batch Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Manager Review, Override & Authorization Workflow</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Nurse managers can review census-based staffing recommendations, calibrate headcount per shift based on clinical acuity, and sign off.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              onResetToRecommended();
              showToastMessage('All days reset to statistical forecast recommendations.');
            }}
            id="reset-schedules-button"
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Reset manual overrides back to mathematical ratios"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Overrides</span>
          </button>

          {canApprove && (
            <button
              onClick={() => {
                onApproveAll();
                showToastMessage(`All 7 days approved by ${currentUser.name} and saved!`);
              }}
              id="approve-all-button"
              className={`inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer ${
                allApproved
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{allApproved ? 'Re-Approve Entire Week' : 'Approve All 7 Days'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="divide-y divide-slate-100 mt-2">
        {schedules.map((item) => {
          const isExpanded = expandedDate === item.date;
          const dayRN = item.dayShift.managerOverrideRN ?? item.dayShift.recommendedRN;
          const nightRN = item.nightShift.managerOverrideRN ?? item.nightShift.recommendedRN;
          const dayCNA = item.dayShift.managerOverrideCNA ?? item.dayShift.recommendedCNA;
          const nightCNA = item.nightShift.managerOverrideCNA ?? item.nightShift.recommendedCNA;

          const isDayOverridden = item.dayShift.managerOverrideRN !== undefined && item.dayShift.managerOverrideRN !== item.dayShift.recommendedRN;
          const isNightOverridden = item.nightShift.managerOverrideRN !== undefined && item.nightShift.managerOverrideRN !== item.nightShift.recommendedRN;
          const isApproved = item.status === 'approved' || Boolean(item.approvedBy);

          return (
            <div 
              key={item.date} 
              id={`schedule-row-${item.date}`}
              className="py-4 first:pt-3 last:pb-0"
            >
              {/* Summary Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Date & Census */}
                <div className="flex items-start sm:items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-800 shrink-0 border border-slate-200">
                    <span className="text-[11px] font-bold uppercase text-slate-500 leading-none">
                      {item.dayOfWeek}
                    </span>
                    <span className="text-base font-black text-slate-900 leading-tight">
                      {item.date.split('-')[2]}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{item.dayLabel}</span>
                      {/* Status Badge */}
                      {isApproved ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>APPROVED</span>
                        </span>
                      ) : (isDayOverridden || isNightOverridden) ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <Edit3 className="w-3 h-3 text-indigo-600" />
                          <span>OVERRIDDEN (PENDING APPROVAL)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>PENDING REVIEW</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Forecast Census: <strong className="text-slate-800">{item.projectedCensus} patients</strong> ({Math.round((item.projectedCensus / item.capacity) * 100)}% cap)</span>
                      {item.approvedBy && (
                        <span className="text-emerald-700 font-medium">
                          Signed by {item.approvedBy} ({item.approvedAt})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Staffing Values & Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Day Shift RN Pill */}
                  <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center space-x-2 ${
                    isDayOverridden ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <span className="text-slate-500 font-medium">Day RN:</span>
                    <strong className="text-sm font-bold text-slate-900">{dayRN}</strong>
                    {isDayOverridden && (
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-1 rounded">
                        {dayRN > item.dayShift.recommendedRN ? `+${dayRN - item.dayShift.recommendedRN}` : dayRN - item.dayShift.recommendedRN}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">(rec: {item.dayShift.recommendedRN})</span>
                  </div>

                  {/* Night Shift RN Pill */}
                  <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center space-x-2 ${
                    isNightOverridden ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <span className="text-slate-500 font-medium">Night RN:</span>
                    <strong className="text-sm font-bold text-slate-900">{nightRN}</strong>
                    {isNightOverridden && (
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-1 rounded">
                        {nightRN > item.nightShift.recommendedRN ? `+${nightRN - item.nightShift.recommendedRN}` : nightRN - item.nightShift.recommendedRN}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">(rec: {item.nightShift.recommendedRN})</span>
                  </div>

                  {/* Approve / Re-Approve button */}
                  {canApprove && (
                    <button
                      onClick={() => {
                        onSingleScheduleApprove(item.date);
                        showToastMessage(`Schedule for ${item.dayLabel} approved and persisted.`);
                      }}
                      id={`approve-day-${item.date}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isApproved ? 'Approved' : 'Approve'}</span>
                    </button>
                  )}

                  {/* Expand / Collapse Adjuster */}
                  <button
                    onClick={() => toggleExpand(item.date)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={isExpanded ? 'Collapse Adjuster' : 'Adjust Headcount & Notes'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Detailed Override Editor (Expanded) */}
              {isExpanded && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Day Shift Controls */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-xs">Day Shift (07:00 - 19:00)</span>
                          <span className="block text-[11px] text-slate-500">Target 1:{item.dayShift.targetRatio} ratio • 1 Charge RN included</span>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Rec: {item.dayShift.recommendedRN} RNs
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">Bedside Staff RNs:</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAdjustRN(item.date, 'day', -1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-sm text-slate-900">
                              {dayRN}
                            </span>
                            <button
                              onClick={() => handleAdjustRN(item.date, 'day', 1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">Certified Nursing Assistants (CNA):</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAdjustCNA(item.date, 'day', -1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-sm text-slate-900">
                              {dayCNA}
                            </span>
                            <button
                              onClick={() => handleAdjustCNA(item.date, 'day', 1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Night Shift Controls */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-xs">Night Shift (19:00 - 07:00)</span>
                          <span className="block text-[11px] text-slate-500">Target 1:{item.nightShift.targetRatio} ratio • 1 Charge RN included</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          Rec: {item.nightShift.recommendedRN} RNs
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">Bedside Staff RNs:</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAdjustRN(item.date, 'night', -1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-sm text-slate-900">
                              {nightRN}
                            </span>
                            <button
                              onClick={() => handleAdjustRN(item.date, 'night', 1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">Certified Nursing Assistants (CNA):</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAdjustCNA(item.date, 'night', -1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-sm text-slate-900">
                              {nightCNA}
                            </span>
                            <button
                              onClick={() => handleAdjustCNA(item.date, 'night', 1)}
                              className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manager Override Notes Input */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Manager Clinical Rationale / Notes (e.g. high-acuity surgical admissions, precepting new graduates):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Added 1 Day RN due to 3 anticipated post-op knee replacements requiring frequent neurovascular checks."
                      value={item.managerNotes || ''}
                      onChange={(e) => handleNotesChange(item.date, e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
