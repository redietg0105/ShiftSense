import React, { useState } from 'react';
import { CensusRecord } from '../types';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  Calendar, 
  Info,
  Layers,
  BedDouble
} from 'lucide-react';

interface CensusChartProps {
  historyData: CensusRecord[];
  forecastData: CensusRecord[];
  bedCapacity: number;
}

type TimeframeView = '7days' | '14days' | '30days' | 'all';

export const CensusChart: React.FC<CensusChartProps> = ({
  historyData,
  forecastData,
  bedCapacity,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeView>('14days');

  // Prepare chart dataset based on selected historical lookback
  let historicalSlice: CensusRecord[] = [];
  if (timeframe === '7days') {
    historicalSlice = historyData.slice(-7);
  } else if (timeframe === '14days') {
    historicalSlice = historyData.slice(-14);
  } else if (timeframe === '30days') {
    historicalSlice = historyData.slice(-30);
  } else {
    historicalSlice = historyData; // all 90 days
  }

  // Anchor point: the last historical actual connects to the first forecast day for continuous lines
  const lastActual = historicalSlice[historicalSlice.length - 1];

  const chartData = [
    ...historicalSlice.map((r) => ({
      date: r.date,
      dayLabel: r.dayLabel,
      dayOfWeek: r.dayOfWeek,
      actual: r.actualCensus,
      forecast: undefined as number | undefined,
      capacity: bedCapacity,
      occupancy: r.occupancyRate,
      admissions: r.projectedAdmissions,
      discharges: r.projectedDischarges,
      isForecast: false,
    })),
    ...forecastData.map((r, idx) => ({
      date: r.date,
      dayLabel: r.dayLabel,
      dayOfWeek: r.dayOfWeek,
      // For the first forecast point, duplicate actual so the line connects seamlessly
      actual: idx === 0 && lastActual ? lastActual.actualCensus : undefined,
      forecast: r.forecastCensus,
      capacity: bedCapacity,
      occupancy: r.occupancyRate,
      admissions: r.projectedAdmissions,
      discharges: r.projectedDischarges,
      isForecast: true,
    })),
  ];

  // Calculate metrics for summary cards
  const latestActualCensus = historyData[historyData.length - 1]?.actualCensus || 30;
  const currentOccupancy = Math.round((latestActualCensus / bedCapacity) * 100);

  const forecastValues = forecastData.map(f => f.forecastCensus || 30);
  const avgForecastCensus = (forecastValues.reduce((a, b) => a + b, 0) / forecastValues.length).toFixed(1);
  const peakForecastRecord = [...forecastData].sort((a, b) => (b.forecastCensus || 0) - (a.forecastCensus || 0))[0];
  const minForecastRecord = [...forecastData].sort((a, b) => (a.forecastCensus || 0) - (b.forecastCensus || 0))[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6" id="census-chart-card">
      {/* Top Header & Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Inpatient Census: 7-Day Forecast vs Recent Actuals</span>
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Med-Surg 4B
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Statistical projection using 4-week day-of-week moving averages, elective surgical ramp-up curves, and recent admissions trend.
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="max-w-full overflow-x-auto self-start sm:self-auto">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium w-max">
            <button
              onClick={() => setTimeframe('7days')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === '7days'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              -7d + Forecast
            </button>
            <button
              onClick={() => setTimeframe('14days')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === '14days'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              -14d + Forecast
            </button>
            <button
              onClick={() => setTimeframe('30days')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === '30days'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              -30d
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90d History
            </button>
          </div>
        </div>
      </div>

      {/* Metric Callouts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Current Census
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-slate-900">{latestActualCensus}</span>
            <span className="text-xs text-slate-500 font-medium">/ {bedCapacity} beds</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-700">
            {currentOccupancy}% Occupancy
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Avg 7-Day Forecast
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-blue-900">{avgForecastCensus}</span>
            <span className="text-xs text-blue-700 font-medium">pts / day</span>
          </div>
          <div className="mt-0.5 text-xs text-blue-800 font-medium">
            {Math.round((Number(avgForecastCensus) / bedCapacity) * 100)}% Expected Bed Use
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span>Peak Demand Day</span>
            <AlertTriangle className="w-3 h-3 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-amber-950">{peakForecastRecord?.forecastCensus}</span>
            <span className="text-xs text-amber-800 font-medium">pts ({peakForecastRecord?.occupancyRate}%)</span>
          </div>
          <div className="mt-0.5 text-xs text-amber-900 font-semibold truncate">
            {peakForecastRecord?.dayLabel}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Lowest Demand Day
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-slate-900">{minForecastRecord?.forecastCensus}</span>
            <span className="text-xs text-slate-500 font-medium">pts ({minForecastRecord?.occupancyRate}%)</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-600 truncate">
            {minForecastRecord?.dayLabel}
          </div>
        </div>
      </div>

      {/* Chart Visual Canvas */}
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
          >
            <defs>
              <linearGradient id="forecastAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

            <XAxis
              dataKey="dayLabel"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={{ stroke: '#cbd5e1' }}
              interval={timeframe === 'all' ? 6 : timeframe === '30days' ? 2 : 0}
              angle={-20}
              textAnchor="end"
              height={40}
            />

            <YAxis
              domain={[18, 38]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={{ stroke: '#cbd5e1' }}
              ticks={[20, 24, 28, 32, 36]}
              label={{
                value: 'Inpatient Census',
                angle: -90,
                position: 'insideLeft',
                offset: 20,
                fill: '#475569',
                fontSize: 12,
                fontWeight: 500,
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                const isForecast = data.isForecast;
                const censusValue = isForecast ? data.forecast : data.actual;

                return (
                  <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 text-xs w-56">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-2">
                      <span>{data.dayLabel}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isForecast ? 'bg-sky-100 text-sky-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isForecast ? 'FORECAST' : 'ACTUAL'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Patient Census:</span>
                        <strong className="text-slate-900 text-sm">{censusValue} pts</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Unit Occupancy:</span>
                        <span className="font-semibold text-slate-800">{data.occupancy}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Bed Capacity:</span>
                        <span className="text-slate-600">{bedCapacity} licensed beds</span>
                      </div>
                      {data.admissions && (
                        <div className="pt-1 border-t border-slate-100 mt-1 flex justify-between text-[11px] text-slate-500">
                          <span>Adm: ~{data.admissions}</span>
                          <span>Disch: ~{data.discharges}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* Capacity Reference Line */}
            <ReferenceLine
              y={bedCapacity}
              stroke="#e11d48"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Licensed Bed Cap (${bedCapacity})`,
                position: 'top',
                fill: '#e11d48',
                fontSize: 10,
                fontWeight: 600,
              }}
            />

            {/* Actual Census Line */}
            <Line
              type="monotone"
              dataKey="actual"
              name="Historical Actual Census"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: '#1d4ed8' }}
              connectNulls={false}
            />

            {/* Forecast Area Fill */}
            <Area
              type="monotone"
              dataKey="forecast"
              fill="url(#forecastAreaGradient)"
              stroke="none"
              connectNulls={true}
            />

            {/* Forecast Line */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="7-Day Predicted Census"
              stroke="#0284c7"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 4, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#0369a1' }}
              connectNulls={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Legend & Healthcare Note */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-1 bg-blue-600 rounded-full inline-block" />
            <span className="font-medium text-slate-700">Actual Census (EHR sync)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-600 inline-block" />
            <span className="font-medium text-slate-700">Forecasted Census</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500 inline-block" />
            <span className="font-medium text-rose-700">Bed Limit (36)</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Noticeable Tuesday-Thursday peak reflects scheduled elective inpatient surgeries.</span>
        </div>
      </div>
    </div>
  );
};
