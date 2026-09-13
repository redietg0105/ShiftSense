import React from 'react';
import { User, UnitConfig } from '../types';
import { 
  Building2, 
  CalendarDays, 
  CheckCircle2, 
  Download, 
  History, 
  LogOut, 
  ShieldCheck, 
  Users,
  Activity
} from 'lucide-react';

interface HeaderProps {
  user: User;
  unitConfig: UnitConfig;
  onLogout: () => void;
  onExportCSV: () => void;
  onOpenAuditLog: () => void;
  approvedDaysCount: number;
  totalDaysCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  unitConfig,
  onLogout,
  onExportCSV,
  onOpenAuditLog,
  approvedDaysCount,
  totalDaysCount,
}) => {
  const allApproved = approvedDaysCount === totalDaysCount && totalDaysCount > 0;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs" id="app-header">
      {/* Top Clinical Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Unit Identifier */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <Activity className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xl tracking-tight text-slate-900">ShiftSense</span>
                  <span className="hidden sm:inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                    Clinical Unit v1.0
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-slate-500 font-medium">
                  Demand-Driven Nurse Staffing Forecasting
                </p>
              </div>
            </div>

            <div className="hidden md:block h-6 w-px bg-slate-200" />

            {/* Current Unit Badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <Building2 className="w-4 h-4 text-blue-600" />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">{unitConfig.unitName}</span>
                <span className="text-slate-500"> • {unitConfig.hospitalName} ({unitConfig.bedCapacity} Beds)</span>
              </div>
            </div>
          </div>

          {/* Actions & User Profile */}
          <div className="flex items-center space-x-3">
            {/* Approval Progress Indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white">
              <CheckCircle2 className={`w-4 h-4 ${allApproved ? 'text-emerald-600' : 'text-amber-500'}`} />
              <span className="text-slate-600">
                Approved: <strong className="text-slate-900">{approvedDaysCount}/{totalDaysCount} Days</strong>
              </span>
            </div>

            {/* Export CSV button */}
            <button
              id="export-csv-button"
              onClick={onExportCSV}
              title="Export Staffing Roster to Excel/CSV"
              aria-label="Export staffing roster to CSV"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Audit History Log */}
            <button
              id="audit-log-button"
              onClick={onOpenAuditLog}
              title="View Approval Audit Trail"
              aria-label="View approval audit trail"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>

            {/* User Badge & Logout */}
            <div className="flex items-center pl-2 border-l border-slate-200 space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-xs flex items-center justify-center border border-blue-200">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center space-x-1">
                  <span>{user.name}</span>
                  {user.role === 'nurse_manager' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 inline" title="Nurse Manager (Authorized Approver)" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 capitalize leading-tight">
                  {user.title}
                </div>
              </div>
              <button
                id="logout-button"
                onClick={onLogout}
                title="Sign out of ShiftSense"
                aria-label="Sign out of ShiftSense"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Unit Name Bar */}
        <div className="md:hidden py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">{unitConfig.unitName}</span>
          </div>
          <span className="text-slate-500 shrink-0">Cap: {unitConfig.bedCapacity} Beds</span>
        </div>
      </div>
    </header>
  );
};
