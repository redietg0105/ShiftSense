import React, { useState } from 'react';
import { CensusRecord, UnitConfig } from '../types';
import { HistoryScenario, ForecastOptions } from '../data/censusGenerator';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  TrendingUp, 
  Calendar, 
  Edit3, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Flame, 
  ArrowDownRight, 
  Activity, 
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface HistoricalModelControllerProps {
  history: CensusRecord[];
  forecast: CensusRecord[];
  activeScenario: HistoryScenario;
  forecastOptions: ForecastOptions;
  unitConfig: UnitConfig;
  lastRecalculatedAt: string;
  onSelectScenario: (scenario: HistoryScenario) => void;
  onUpdateForecastOptions: (opts: ForecastOptions) => void;
  onUpdateHistoricalActual: (date: string, newActual: number) => void;
  onRegenerateHistoricalData: () => void;
}

export const HistoricalModelController: React.FC<HistoricalModelControllerProps> = ({
  history,
  forecast,
  activeScenario,
  forecastOptions,
  unitConfig,
  lastRecalculatedAt,
  onSelectScenario,
  onUpdateForecastOptions,
  onUpdateHistoricalActual,
  onRegenerateHistoricalData,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);

  // Compute stats from current historical array
  const last7Records = history.slice(-7);
  const trailingActuals = last7Records.map((r) => r.actualCensus ?? 30);
  const trailingMean = (trailingActuals.reduce((a, b) => a + b, 0) / trailingActuals.length).toFixed(1);

  const totalHistoricalActuals = history.map((r) => r.actualCensus ?? 30);
  const overallHistoricalMean = (
    totalHistoricalActuals.reduce((a, b) => a + b, 0) / totalHistoricalActuals.length
  ).toFixed(1);

  const velocityPercent = (
    ((Number(trailingMean) - Number(overallHistoricalMean)) / Number(overallHistoricalMean)) *
    100
  ).toFixed(1);
  const isSurging = Number(velocityPercent) > 0;

  // Forecast summary
  const avgForecastCensus = (
    forecast.reduce((sum, f) => sum + (f.forecastCensus ?? 30), 0) / (forecast.length || 1)
  ).toFixed(1);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-6"
      id="historical-model-controller"
    >
      {/* Banner / Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Dynamic Forecasting & Historical Census Engine
              </h2>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>Auto-Recalculating Staffing</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              The 7-day forecast dynamically models {history.length} days of historical census using day-of-week moving averages and trailing velocity.
            </p>
          </div>
        </div>

        {/* Live recalculation badge & fast regenerate */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRegenerateHistoricalData}
            title="Generate new synthetic historical dataset with random variance"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            id="regenerate-data-button"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Reseed Dataset</span>
          </button>

          <button
            onClick={() => setIsParamsOpen(!isParamsOpen)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              isParamsOpen
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            id="model-params-toggle"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Algorithm Parameters</span>
            {isParamsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Bar: Scenario Presets & Telemetry Stats */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Scenario Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Historical Scenario:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onSelectScenario('standard')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center space-x-1.5 ${
                activeScenario === 'standard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              id="scenario-standard-button"
            >
              <span>Standard Baseline (86%)</span>
            </button>

            <button
              onClick={() => onSelectScenario('winter_surge')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center space-x-1.5 ${
                activeScenario === 'winter_surge'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              id="scenario-surge-button"
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span>Respiratory Surge (+15%)</span>
            </button>

            <button
              onClick={() => onSelectScenario('post_holiday')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center space-x-1.5 ${
                activeScenario === 'post_holiday'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              id="scenario-holiday-button"
            >
              <ArrowDownRight className="w-3 h-3 text-indigo-300" />
              <span>Post-Holiday Dip (-12%)</span>
            </button>

            <button
              onClick={() => onSelectScenario('high_occupancy')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center space-x-1.5 ${
                activeScenario === 'high_occupancy'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              id="scenario-high-button"
            >
              <span>High Occupancy (94%)</span>
            </button>
          </div>
        </div>

        {/* Live Mathematical Telemetry Stats */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-slate-500">90d Baseline: </span>
            <span className="font-semibold text-slate-800">{overallHistoricalMean} pts</span>
          </div>

          <div className="bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-slate-500">Trailing 7d: </span>
            <span className="font-semibold text-slate-800">{trailingMean} pts</span>
            <span
              className={`ml-1 font-bold ${
                isSurging ? 'text-amber-600' : 'text-blue-600'
              }`}
            >
              ({isSurging ? `+${velocityPercent}%` : `${velocityPercent}%`})
            </span>
          </div>

          <div className="bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-slate-500">Projected 7d Mean: </span>
            <span className="font-bold text-blue-700">{avgForecastCensus} pts</span>
          </div>

          <button
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs border border-blue-200 transition"
            id="toggle-recent-editor-button"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditorOpen ? 'Hide Actuals Editor' : 'Edit Recent Actuals'}</span>
          </button>
        </div>
      </div>

      {/* Expandable: Algorithm Parameters */}
      {isParamsOpen && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Day-of-Week Lookback Window:
            </label>
            <div className="flex space-x-2">
              {[2, 4, 8].map((weeks) => (
                <button
                  key={weeks}
                  onClick={() =>
                    onUpdateForecastOptions({
                      ...forecastOptions,
                      lookbackWeeks: weeks,
                    })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition ${
                    (forecastOptions.lookbackWeeks ?? 4) === weeks
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {weeks} Weeks Lookback
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Computes the moving average from the past matching days of the week (e.g. past 4 Mondays for Monday).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Trailing Velocity Trend Weight:{' '}
              <span className="text-blue-600 font-bold">
                {Math.round((forecastOptions.trendWeight ?? 0.35) * 100)}%
              </span>
            </label>
            <input
              type="range"
              min="0.0"
              max="0.7"
              step="0.05"
              value={forecastOptions.trendWeight ?? 0.35}
              onChange={(e) =>
                onUpdateForecastOptions({
                  ...forecastOptions,
                  trendWeight: parseFloat(e.target.value),
                })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Pure Seasonality (0%)</span>
              <span>Balanced (35%)</span>
              <span>High Sensitivity (70%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable: Interactive Recent Actuals Editor */}
      {isEditorOpen && (
        <div className="p-4 bg-blue-50/40 border-b border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Interactive Historical Actuals Editor</span>
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Modify recent days' actual census below. Notice how changing yesterday's census immediately updates the historical trajectory, alters the 7-day forecast, and automatically recalculates all staffing ratios!
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              Bed Capacity: <span className="font-semibold">{unitConfig.bedCapacity} beds</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {last7Records.map((record) => {
              const currentVal = record.actualCensus ?? 30;
              return (
                <div
                  key={record.date}
                  className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-2xs text-center"
                >
                  <div className="text-[11px] font-bold text-slate-700">
                    {record.dayLabel.split(',')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 mb-1.5">
                    {record.date.slice(5)}
                  </div>

                  <div className="flex items-center justify-center space-x-1">
                    <button
                      onClick={() =>
                        onUpdateHistoricalActual(record.date, Math.max(18, currentVal - 1))
                      }
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition"
                      title="Decrease actual census by 1"
                      aria-label={`Decrease actual census for ${record.dayLabel} by 1`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="15"
                      max={unitConfig.bedCapacity}
                      value={currentVal}
                      aria-label={`Actual census for ${record.dayLabel}`}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          onUpdateHistoricalActual(
                            record.date,
                            Math.max(15, Math.min(unitConfig.bedCapacity, val))
                          );
                        }
                      }}
                      className="w-12 text-center font-bold text-sm text-slate-900 border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() =>
                        onUpdateHistoricalActual(
                          record.date,
                          Math.min(unitConfig.bedCapacity, currentVal + 1)
                        )
                      }
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition"
                      title="Increase actual census by 1"
                      aria-label={`Increase actual census for ${record.dayLabel} by 1`}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-medium">
                    {Math.round((currentVal / unitConfig.bedCapacity) * 100)}% Occ
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
