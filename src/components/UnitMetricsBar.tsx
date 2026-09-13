import React from 'react';
import { UnitConfig, CensusRecord } from '../types';
import { 
  Building2, 
  Bed, 
  Users2, 
  Calendar, 
  Activity, 
  Calculator, 
  Info,
  Layers
} from 'lucide-react';

interface UnitMetricsBarProps {
  unitConfig: UnitConfig;
  forecastData: CensusRecord[];
}

export const UnitMetricsBar: React.FC<UnitMetricsBarProps> = ({
  unitConfig,
  forecastData,
}) => {
  // Aggregate 7-day expected admissions & discharges
  const totalAdmissions = forecastData.reduce((acc, curr) => acc + (curr.projectedAdmissions || 0), 0);
  const totalDischarges = forecastData.reduce((acc, curr) => acc + (curr.projectedDischarges || 0), 0);
  const netTurnover = totalAdmissions - totalDischarges;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Unit Details */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900">{unitConfig.unitName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Inpatient Acute Care
              </span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <span>Licensed Beds: <strong>{unitConfig.bedCapacity}</strong></span>
              <span>•</span>
              <span>Hospital: <strong>{unitConfig.hospitalName}</strong></span>
              <span>•</span>
              <span>Staffing Model: <strong>12-Hour Fixed/Flex Hybrid</strong></span>
            </div>
          </div>
        </div>

        {/* Right: Operational indicators */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <div>
              <span className="text-slate-500">Forecast Horizon: </span>
              <strong className="text-slate-800">Next 7 Days (Sep 4 - Sep 10)</strong>
            </div>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <div>
              <span className="text-slate-500">Projected Turnover: </span>
              <strong className="text-slate-800">+{totalAdmissions} Adm / -{totalDischarges} Disch</strong>
            </div>
          </div>

          <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Calculator className="w-3.5 h-3.5 text-slate-500" />
            <div>
              <span className="text-slate-500">Baseline Ratio: </span>
              <strong className="text-slate-800">1:{unitConfig.dayRatio} Day / 1:{unitConfig.nightRatio} Night</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
