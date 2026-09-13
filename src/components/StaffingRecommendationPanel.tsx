import React from 'react';
import { CensusRecord, UnitConfig } from '../types';
import { 
  Users, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  TrendingDown, 
  TrendingUp,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface StaffingRecommendationPanelProps {
  forecastData: CensusRecord[];
  unitConfig: UnitConfig;
  onUpdateUnitConfig: (newConfig: UnitConfig) => void;
  onNavigateToApproval: () => void;
}

export const StaffingRecommendationPanel: React.FC<StaffingRecommendationPanelProps> = ({
  forecastData,
  unitConfig,
  onUpdateUnitConfig,
  onNavigateToApproval,
}) => {
  const handleDayRatioChange = (ratio: number) => {
    onUpdateUnitConfig({
      ...unitConfig,
      dayRatio: ratio,
    });
  };

  const handleNightRatioChange = (ratio: number) => {
    onUpdateUnitConfig({
      ...unitConfig,
      nightRatio: ratio,
    });
  };

  // Traditional flat schedule comparison (e.g., rigid 8 floor RNs every single day)
  const traditionalFixedDayRN = 8;

  // Compute total RN shifts across the 7-day period
  const totalForecastDays = forecastData.length;
  let totalRecDayRNs = 0;
  let totalRecNightRNs = 0;
  let surgeDaysCount = 0;
  let lowDemandDaysCount = 0;

  forecastData.forEach((day) => {
    const census = day.forecastCensus || 30;
    const dayRN = Math.ceil(census / unitConfig.dayRatio);
    const nightRN = Math.ceil(census / unitConfig.nightRatio);
    totalRecDayRNs += dayRN;
    totalRecNightRNs += nightRN;

    if (census >= 33) surgeDaysCount++;
    if (census <= 26) lowDemandDaysCount++;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6" id="staffing-recommendation-panel">
      {/* Panel Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Staffing Demand Engine & Ratio Converter</span>
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Automated Calculation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Converts each day's forecasted census into required bedside Registered Nurses (RNs), Charge RNs, and CNAs using clinical acuity ratios.
          </p>
        </div>

        <button
          onClick={onNavigateToApproval}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs self-start lg:self-auto cursor-pointer"
        >
          <span>Review & Authorize Schedule</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ratio Configuration Banner */}
      <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Unit Target Staffing Ratios:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Day Ratio selector */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-600 font-medium">Day Shift (07-19):</span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                {[3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleDayRatioChange(r)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      unitConfig.dayRatio === r
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    1:{r} {r === 4 && '(Standard)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Night Ratio selector */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-600 font-medium">Night Shift (19-07):</span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                {[4, 5, 6].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleNightRatioChange(r)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      unitConfig.nightRatio === r
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    1:{r} {r === 5 && '(Standard)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Staffing Projection Grid (7-Day Table) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">Date / Day</th>
              <th className="py-2.5 px-3">Forecast Census</th>
              <th className="py-2.5 px-3">Bed Occupancy</th>
              <th className="py-2.5 px-3 text-blue-700">Day RNs (1:{unitConfig.dayRatio})</th>
              <th className="py-2.5 px-3 text-slate-700">Night RNs (1:{unitConfig.nightRatio})</th>
              <th className="py-2.5 px-3 text-slate-600">Day CNA</th>
              <th className="py-2.5 px-3">Charge RN</th>
              <th className="py-2.5 px-3">Demand Assessment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {forecastData.map((day) => {
              const census = day.forecastCensus || 30;
              const dayRN = Math.ceil(census / unitConfig.dayRatio);
              const nightRN = Math.ceil(census / unitConfig.nightRatio);
              const dayCNA = Math.ceil(census / unitConfig.cnaDayRatio);
              const isSurge = census >= 33;
              const isLow = census <= 26;

              return (
                <tr key={day.date} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{day.dayLabel}</div>
                    <div className="text-[10px] text-slate-400">{day.date}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-sm font-bold text-slate-900">{census}</span>
                    <span className="text-slate-400 text-[11px]"> / 36</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isSurge ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, day.occupancyRate)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold">{day.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200">
                      <span>{dayRN} RNs</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold">
                      <span>{nightRN} RNs</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <span>{dayCNA} CNAs</span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    <span className="text-[11px] font-medium text-slate-600">1 Dedicated</span>
                  </td>
                  <td className="py-3 px-3">
                    {isSurge ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertCircle className="w-3 h-3 text-amber-700" />
                        <span>High Acuity Surge (+1 Float RN)</span>
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        <TrendingDown className="w-3 h-3 text-slate-500" />
                        <span>Discharge Dip (Flexible)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Optimal Census Range</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Value Comparison Callout: ShiftSense vs Static Excel Scheduling */}
      <div className="mt-5 p-4 rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/50 to-indigo-50/30">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xs text-slate-700 space-y-1">
            <div className="font-bold text-slate-900 text-sm">
              Demand-Driven Staffing Advantage vs Traditional Static Excel
            </div>
            <p className="leading-relaxed">
              Traditional hospitals schedule a flat <strong>{traditionalFixedDayRN} RNs</strong> daily regardless of census fluctuations.
              By adjusting to predicted volume, ShiftSense prevents <strong>{surgeDaysCount} understaffed surge shifts</strong> (which lead to expensive nurse overtime & patient safety risks)
              and saves <strong>{lowDemandDaysCount * 12} hours of unnecessary agency/overstaffing labor</strong> on planned weekend discharge dips.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
