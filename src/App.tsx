/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, 
  DaySchedule, 
  UnitConfig, 
  CensusRecord 
} from './types';
import { 
  generateSyntheticHistoricalCensus,
  computeStatisticalForecastFromHistory,
  recalculateStaffingFromForecast,
  HistoryScenario,
  ForecastOptions,
  DEFAULT_UNIT_CONFIG 
} from './data/censusGenerator';
import { 
  getStoredUser, 
  setStoredUser, 
  getStoredSchedules, 
  saveStoredSchedules, 
  getStoredUnitConfig, 
  saveStoredUnitConfig,
  logAuditEvent,
  getAuditLogs,
  exportSchedulesToCSV,
  AuditEntry
} from './services/storage';
import { api, getAuthToken, setAuthToken } from './services/api';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { CensusChart } from './components/CensusChart';
import { StaffingRecommendationPanel } from './components/StaffingRecommendationPanel';
import { ScheduleApprovalWorkflow } from './components/ScheduleApprovalWorkflow';
import { UnitMetricsBar } from './components/UnitMetricsBar';
import { AuditModal } from './components/AuditModal';
import { HistoricalModelController } from './components/HistoricalModelController';
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  BarChart3, 
  Calendar,
  Sparkles,
  AlertTriangle,
  FileCheck2,
  Clock,
  Database,
  Activity,
  Loader2
} from 'lucide-react';

export default function App() {
  // Authentication State:
  // Strictly null until verified by active backend session or user login
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auth checking state: true only when an auth token exists and needs verification
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    return Boolean(getAuthToken());
  });

  // Unit Configuration State (ratios, bed capacity)
  const [unitConfig, setUnitConfig] = useState<UnitConfig>(() => getStoredUnitConfig());

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>(() => getAuditLogs());

  // Active View Tab: 'all' (Unified clinical dashboard), 'chart' (Census), 'recommendation' (Ratio Engine), 'approval' (Workflow)
  const [activeTab, setActiveTab] = useState<'all' | 'chart' | 'recommendation' | 'approval'>('all');

  // Synthetic Historical Census State
  const [activeScenario, setActiveScenario] = useState<HistoryScenario>('standard');
  const [seedCounter, setSeedCounter] = useState<number>(101);
  const [forecastOptions, setForecastOptions] = useState<ForecastOptions>({
    lookbackWeeks: 4,
    trendWeight: 0.35,
    capacity: unitConfig.bedCapacity,
    forecastDays: 7,
  });

  // 90-day synthetic historical census records
  const [history, setHistory] = useState<CensusRecord[]>(() => {
    return generateSyntheticHistoricalCensus(90, 'standard', unitConfig.bedCapacity, 101);
  });

  // Dynamic 7-day forecast computed STRICTLY from synthetic historical census
  const forecast = useMemo(() => {
    return computeStatisticalForecastFromHistory(history, {
      ...forecastOptions,
      capacity: unitConfig.bedCapacity,
    });
  }, [history, forecastOptions, unitConfig.bedCapacity]);

  // Timestamp of the latest recalculation
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Schedules state with persistence
  const [schedules, setSchedules] = useState<DaySchedule[]>(() => {
    const saved = getStoredSchedules();
    if (saved && saved.length > 0) {
      return saved.map((s) => ({
        ...s,
        status: (s.status === 'approved' || Boolean(s.approvedBy)) ? ('approved' as const) : s.status,
      }));
    }
    return recalculateStaffingFromForecast(forecast, null, unitConfig);
  });

  // Check server auth on mount & sync schedules from backend database
  useEffect(() => {
    let isMounted = true;
    async function syncBackend() {
      const token = getAuthToken();
      if (!token) {
        // No session token present: completely unauthenticated
        setCurrentUser(null);
        setStoredUser(null);
        setIsAuthChecking(false);
        return;
      }

      try {
        const verified = await api.verifyAuth();
        if (!isMounted) return;
        if (verified) {
          setCurrentUser(verified);
          setStoredUser(verified);

          const remote = await api.getSchedules();
          if (remote && remote.schedules && remote.schedules.length > 0) {
            const normalized = remote.schedules.map((s) => ({
              ...s,
              status: (s.status === 'approved' || Boolean(s.approvedBy)) ? ('approved' as const) : s.status,
            }));
            setSchedules(normalized);
            saveStoredSchedules(normalized);
            if (remote.unitConfig) {
              setUnitConfig(remote.unitConfig);
              saveStoredUnitConfig(remote.unitConfig);
            }
          }
        } else {
          // Token invalid or expired
          setCurrentUser(null);
          setStoredUser(null);
          setAuthToken(null);
        }
      } catch {
        if (!isMounted) return;
        setCurrentUser(null);
        setStoredUser(null);
        setAuthToken(null);
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    }
    syncBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  // CRITICAL REQUIREMENT:
  // Automatically recalculate staffing recommendation numbers whenever the forecast changes!
  useEffect(() => {
    if (!currentUser) return;
    setSchedules((prevSchedules) => {
      const recalculated = recalculateStaffingFromForecast(forecast, prevSchedules, unitConfig);
      saveStoredSchedules(recalculated);
      api.saveSchedules(recalculated, unitConfig);
      return recalculated;
    });
    setLastRecalculatedAt(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }, [forecast, unitConfig, currentUser]);

  // Handler: Change Scenario (e.g. Surge, Post-Holiday dip)
  const handleSelectScenario = (scenario: HistoryScenario) => {
    setActiveScenario(scenario);
    const newHistory = generateSyntheticHistoricalCensus(
      90,
      scenario,
      unitConfig.bedCapacity,
      seedCounter
    );
    setHistory(newHistory);
    api.saveHistoricalCensus(newHistory);

    logAuditEvent({
      action: 'Historical Scenario Applied',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'Census Forecast Model',
      details: `Switched historical simulation to ${scenario.replace('_', ' ').toUpperCase()} scenario. Forecast and staffing auto-recalculated.`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Handler: Regenerate Synthetic Historical Data with new random seed
  const handleRegenerateHistoricalData = () => {
    const nextSeed = seedCounter + 37;
    setSeedCounter(nextSeed);
    const newHistory = generateSyntheticHistoricalCensus(
      90,
      activeScenario,
      unitConfig.bedCapacity,
      nextSeed
    );
    setHistory(newHistory);
    api.saveHistoricalCensus(newHistory);

    logAuditEvent({
      action: 'Synthetic History Reseeded',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'Census Forecast Model',
      details: `Generated new 90-day synthetic history (seed #${nextSeed}). Forecast dynamically recomputed.`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Handler: Update a single historical day's actual census (e.g. yesterday's actual)
  const handleUpdateHistoricalActual = (date: string, newActual: number) => {
    setHistory((prev) => {
      const updated = prev.map((item) => {
        if (item.date !== date) return item;
        return {
          ...item,
          actualCensus: newActual,
          occupancyRate: Math.round((newActual / unitConfig.bedCapacity) * 100),
        };
      });
      api.saveHistoricalCensus(updated);
      return updated;
    });

    logAuditEvent({
      action: 'Historical Actual Adjusted',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: date,
      details: `Adjusted actual census to ${newActual} beds. Trailing moving average and forecast recalculating.`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Handler: Update forecast algorithm parameters (lookback weeks, trend weight)
  const handleUpdateForecastOptions = (newOpts: ForecastOptions) => {
    setForecastOptions(newOpts);
    logAuditEvent({
      action: 'Algorithm Parameters Updated',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'Statistical Engine',
      details: `Lookback window: ${newOpts.lookbackWeeks}w, Trend weight: ${Math.round((newOpts.trendWeight ?? 0.35) * 100)}%`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Handler: Update unit ratio configuration
  const handleUpdateUnitConfig = (newConfig: UnitConfig) => {
    setUnitConfig(newConfig);
    saveStoredUnitConfig(newConfig);

    logAuditEvent({
      action: 'Target Ratio Adjusted',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'Unit Settings',
      details: `Updated ratios to Day 1:${newConfig.dayRatio}, Night 1:${newConfig.nightRatio}`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Login handler
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setStoredUser(user);
    setIsAuthChecking(false);
    logAuditEvent({
      action: 'Staff Signed In',
      userName: user.name,
      userRole: user.title,
      dateTarget: 'Session Auth',
      details: `Authorized access to ${unitConfig.unitName} schedule console`,
    });
    setAuditLogs(getAuditLogs());

    // Fetch and sync approved schedules from backend after login
    api.getSchedules().then((remote) => {
      if (remote && remote.schedules && remote.schedules.length > 0) {
        const normalized = remote.schedules.map((s) => ({
          ...s,
          status: (s.status === 'approved' || Boolean(s.approvedBy)) ? ('approved' as const) : s.status,
        }));
        setSchedules(normalized);
        saveStoredSchedules(normalized);
        if (remote.unitConfig) {
          setUnitConfig(remote.unitConfig);
          saveStoredUnitConfig(remote.unitConfig);
        }
      }
    });
  };

  // Logout handler
  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setStoredUser(null);
    setAuthToken(null);
    setIsAuthChecking(false);
  };

  // Schedule updates & persistence
  const handleUpdateSchedules = (newSchedules: DaySchedule[]) => {
    setSchedules(newSchedules);
    saveStoredSchedules(newSchedules);
    api.saveSchedules(newSchedules, unitConfig);
  };

  // Single Day Approval
  const handleSingleScheduleApprove = (date: string) => {
    if (!currentUser) return;
    const now = new Date();
    const timeStr =
      now.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' at ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setSchedules((prev) => {
      const updated = prev.map((item) => {
        if (item.date !== date) return item;
        return {
          ...item,
          status: 'approved' as const,
          approvedBy: currentUser.name,
          approvedAt: timeStr,
        };
      });
      saveStoredSchedules(updated);
      api.saveSchedules(updated, unitConfig);
      return updated;
    });

    const targetDay = schedules.find((s) => s.date === date);
    logAuditEvent({
      action: 'Schedule Authorized',
      userName: currentUser.name,
      userRole: currentUser.title,
      dateTarget: targetDay?.dayLabel || date,
      details: `Approved Day Shift (${targetDay?.dayShift.managerOverrideRN ?? targetDay?.dayShift.recommendedRN} RNs) & Night Shift (${targetDay?.nightShift.managerOverrideRN ?? targetDay?.nightShift.recommendedRN} RNs)`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Approve Entire 7-Day Period
  const handleApproveAll = () => {
    if (!currentUser) return;
    const now = new Date();
    const timeStr =
      now.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' at ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setSchedules((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        status: 'approved' as const,
        approvedBy: currentUser.name,
        approvedAt: timeStr,
      }));
      saveStoredSchedules(updated);
      api.saveSchedules(updated, unitConfig);
      return updated;
    });

    logAuditEvent({
      action: 'Bulk 7-Day Period Approved',
      userName: currentUser.name,
      userRole: currentUser.title,
      dateTarget: '7-Day Forecast Window',
      details: `Authorized complete staffing plan for all 7 days with electronic manager signature`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Reset all overrides to standard recommendations
  const handleResetToRecommended = () => {
    const refreshed = recalculateStaffingFromForecast(forecast, null, unitConfig);
    setSchedules(refreshed);
    saveStoredSchedules(refreshed);
    api.saveSchedules(refreshed, unitConfig);

    logAuditEvent({
      action: 'Overrides Cleared',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'All Days',
      details: 'Reset staffing numbers to statistical forecast baseline',
    });
    setAuditLogs(getAuditLogs());
  };

  // Export CSV
  const handleExportCSV = () => {
    exportSchedulesToCSV(schedules, unitConfig.unitName);
    logAuditEvent({
      action: 'Exported Staffing Roster',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.title || 'Staff',
      dateTarget: 'CSV File',
      details: `Exported 7-day staffing forecast table for ${unitConfig.unitName}`,
    });
    setAuditLogs(getAuditLogs());
  };

  // Check how many days are approved
  const approvedDaysCount = schedules.filter((s) => s.status === 'approved' || Boolean(s.approvedBy)).length;
  const totalDaysCount = schedules.length;

  // 1. While actively validating existing session token on the server, show clean clinical authenticating screen
  // (Prevents any dashboard content or empty state flash from rendering)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white" id="auth-checking-screen">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">ShiftSense</h1>
            <p className="text-xs text-slate-400">Hospital Nurse Staffing Forecasting</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Verifying clinical authorization session...</span>
        </div>
      </div>
    );
  }

  // 2. Block access & reliably redirect to Login screen if not signed in or no valid session
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Top Clinical Header */}
      <Header
        user={currentUser}
        unitConfig={unitConfig}
        onLogout={handleLogout}
        onExportCSV={handleExportCSV}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        approvedDaysCount={approvedDaysCount}
        totalDaysCount={totalDaysCount}
      />

      {/* Main Clinical Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Unit Summary Metadata Bar */}
        <UnitMetricsBar
          unitConfig={unitConfig}
          forecastData={forecast}
        />

        {/* Dynamic Forecasting & Historical Model Controller */}
        <HistoricalModelController
          history={history}
          forecast={forecast}
          activeScenario={activeScenario}
          forecastOptions={forecastOptions}
          unitConfig={unitConfig}
          lastRecalculatedAt={lastRecalculatedAt}
          onSelectScenario={handleSelectScenario}
          onUpdateForecastOptions={handleUpdateForecastOptions}
          onUpdateHistoricalActual={handleUpdateHistoricalActual}
          onRegenerateHistoricalData={handleRegenerateHistoricalData}
        />

        {/* Navigation Tabs Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="min-w-0 max-w-full overflow-x-auto">
            <div
              className="inline-flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-medium gap-1 w-max"
              role="tablist"
              aria-label="Unit dashboard views"
            >
              <button
                id="tab-all-views"
                role="tab"
                aria-selected={activeTab === 'all'}
                aria-controls="section-census-forecast section-staffing-recommendations section-approval-workflow"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Complete Unit Console</span>
              </button>

              <button
                id="tab-census-forecast"
                role="tab"
                aria-selected={activeTab === 'chart'}
                aria-controls="section-census-forecast"
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'chart'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Census Forecast Chart</span>
              </button>

              <button
                id="tab-ratio-recommendations"
                role="tab"
                aria-selected={activeTab === 'recommendation'}
                aria-controls="section-staffing-recommendations"
                onClick={() => setActiveTab('recommendation')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'recommendation'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ratio & Demand Model</span>
              </button>

              <button
                id="tab-approval-workflow"
                role="tab"
                aria-selected={activeTab === 'approval'}
                aria-controls="section-approval-workflow"
                onClick={() => setActiveTab('approval')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'approval'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Manager Approvals</span>
                {approvedDaysCount < totalDaysCount ? (
                  <span className="ml-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1 shrink-0" aria-hidden="true" />
                )}
                <span className="sr-only">
                  {approvedDaysCount < totalDaysCount ? ` — ${approvedDaysCount} of ${totalDaysCount} days approved` : ' — all days approved'}
                </span>
              </button>
            </div>
          </div>

          {/* Quick status text */}
          <div className="text-xs text-slate-500 flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Backend database persistence active & synchronized</span>
          </div>
        </div>

        {/* View Content Sections */}
        <div className="space-y-6">
          {/* Feature 1: Census Forecast Chart */}
          {(activeTab === 'all' || activeTab === 'chart') && (
            <section id="section-census-forecast" role="tabpanel" aria-labelledby="tab-all-views tab-census-forecast" tabIndex={0}>
              <CensusChart
                historyData={history}
                forecastData={forecast}
                bedCapacity={unitConfig.bedCapacity}
              />
            </section>
          )}

          {/* Feature 2: Staffing Recommendation Panel */}
          {(activeTab === 'all' || activeTab === 'recommendation') && (
            <section id="section-staffing-recommendations" role="tabpanel" aria-labelledby="tab-all-views tab-ratio-recommendations" tabIndex={0}>
              <StaffingRecommendationPanel
                forecastData={forecast}
                unitConfig={unitConfig}
                onUpdateUnitConfig={handleUpdateUnitConfig}
                onNavigateToApproval={() => setActiveTab('approval')}
              />
            </section>
          )}

          {/* Feature 3 & 5: Manager Review, Override & Approval Workflow */}
          {(activeTab === 'all' || activeTab === 'approval') && (
            <section id="section-approval-workflow" role="tabpanel" aria-labelledby="tab-all-views tab-approval-workflow" tabIndex={0}>
              <ScheduleApprovalWorkflow
                schedules={schedules}
                currentUser={currentUser}
                onUpdateSchedule={handleUpdateSchedules}
                onSingleScheduleApprove={handleSingleScheduleApprove}
                onApproveAll={handleApproveAll}
                onResetToRecommended={handleResetToRecommended}
              />
            </section>
          )}
        </div>
      </main>

      {/* Audit History Log Modal */}
      <AuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
        onExportCSV={handleExportCSV}
      />
    </div>
  );
}

