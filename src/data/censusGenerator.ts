import { CensusRecord, DaySchedule, ShiftRequirement, UnitConfig } from '../types';

export const DEFAULT_UNIT_CONFIG: UnitConfig = {
  hospitalName: 'MetroHealth Medical Center',
  unitName: 'Medical-Surgical 4B (Acute Care)',
  bedCapacity: 36,
  dayRatio: 4, // 1 RN : 4 Patients (standard Med-Surg daytime ratio)
  nightRatio: 5, // 1 RN : 5 Patients (standard night ratio)
  cnaDayRatio: 8, // 1 CNA : 8 Patients
  cnaNightRatio: 10, // 1 CNA : 10 Patients
};

export type HistoryScenario = 'standard' | 'winter_surge' | 'post_holiday' | 'high_occupancy';

export interface ForecastOptions {
  lookbackWeeks?: number; // 2, 4, or 8 weeks
  trendWeight?: number; // 0.0 to 0.8
  capacity?: number;
  forecastDays?: number;
}

// Pseudo-random generator for reproducible synthetic historical data
function pseudoRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Day-of-week seasonality factors for Med-Surg
// Sun: 0.82 (low), Mon: 0.93, Tue: 0.98, Wed: 1.00 (peak), Thu: 0.97, Fri: 0.88, Sat: 0.80
const DAY_SEASONALITY = [0.82, 0.93, 0.98, 1.00, 0.97, 0.88, 0.80];

/**
 * Generates synthetic historical census data (e.g. 90 days) leading up to today.
 * Supports different realistic clinical scenarios (Surge, Post-Holiday dip, High Occupancy).
 */
export function generateSyntheticHistoricalCensus(
  days = 90,
  scenario: HistoryScenario = 'standard',
  capacity = 36,
  seed = 42
): CensusRecord[] {
  // Anchor to today, so history always ends on "now" and the forecast
  // computed from it (see computeStatisticalForecastFromHistory, which
  // anchors on this array's last record) starts the day after.
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const records: CensusRecord[] = [];
  const baseCensus = 31; // ~86% occupancy baseline

  for (let i = -days; i <= 0; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);

    const dayOfWeekIndex = d.getDay();
    const dayFactor = DAY_SEASONALITY[dayOfWeekIndex];

    // Scenario specific modifiers
    let scenarioBias = 0;
    if (scenario === 'winter_surge') {
      // Escalating volume in the last 21 days (+3 to +5 patients)
      if (i > -21) {
        scenarioBias = ((i + 21) / 21) * 4.2;
      }
    } else if (scenario === 'post_holiday') {
      // Recent drop in elective procedures and high discharges (-4 patients)
      if (i > -14) {
        scenarioBias = -3.8;
      }
    } else if (scenario === 'high_occupancy') {
      // Chronic high load near max capacity
      scenarioBias = 3.5;
    }

    // Natural cyclic waves + controlled noise
    const cyclicWave = Math.sin(i / 12) * 1.6;
    const noise = (pseudoRandom(seed + i * 3) - 0.5) * 2.6;

    let census = Math.round(baseCensus * dayFactor + scenarioBias + cyclicWave + noise);
    census = Math.max(19, Math.min(capacity, census));

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayLabel = `${DAY_NAMES[dayOfWeekIndex]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

    // Estimated admissions & discharges based on census volume
    const admissions = Math.round(Math.max(2, census * 0.22 + (pseudoRandom(seed + i * 5) - 0.5) * 2));
    const discharges = Math.round(Math.max(2, census * 0.21 + (pseudoRandom(seed + i * 7) - 0.5) * 2));
    const acuity = Number((1.18 + (pseudoRandom(seed + i * 9) * 0.22)).toFixed(2));

    records.push({
      date: dateStr,
      dayLabel,
      dayOfWeek: DAY_NAMES[dayOfWeekIndex],
      actualCensus: census,
      isForecast: false,
      capacity,
      occupancyRate: Math.round((census / capacity) * 100),
      projectedAdmissions: admissions,
      projectedDischarges: discharges,
      acuityScore: acuity,
    });
  }

  return records;
}

/**
 * Computes a 7-day forecast strictly from the provided synthetic historical dataset.
 * Uses a Day-of-Week Moving Average combined with Trailing Velocity/Momentum.
 *
 * This is a pure mathematical calculation: whenever history changes, calling this
 * produces a new, updated forecast reflecting the exact changes in history.
 */
export function computeStatisticalForecastFromHistory(
  history: CensusRecord[],
  options: ForecastOptions = {}
): CensusRecord[] {
  if (!history || history.length === 0) {
    return [];
  }

  const lookbackWeeks = options.lookbackWeeks ?? 4; // default 4-week lookback
  const trendWeight = options.trendWeight ?? 0.35; // 35% trailing velocity, 65% same-day seasonality
  const capacity = options.capacity ?? 36;
  const forecastDays = options.forecastDays ?? 7;

  // The last record in the history represents "today"
  const lastRecord = history[history.length - 1];
  const lastDateParts = lastRecord.date.split('-').map(Number);
  const anchorDate = new Date(lastDateParts[0], lastDateParts[1] - 1, lastDateParts[2]);
  anchorDate.setHours(0, 0, 0, 0);

  // Compute trailing metrics from actual historical census
  const recentDays = Math.min(7, history.length);
  const trailingSlice = history.slice(-recentDays);
  const trailingActuals = trailingSlice.map((r) => r.actualCensus ?? 30);
  const trailingMean = trailingActuals.reduce((sum, val) => sum + val, 0) / trailingSlice.length;

  const totalHistoricalActuals = history.map((r) => r.actualCensus ?? 30);
  const overallHistoricalMean =
    totalHistoricalActuals.reduce((sum, val) => sum + val, 0) / totalHistoricalActuals.length || 30;

  // Velocity ratio: > 1.0 means recent days are surging compared to overall history
  const velocityRatio = trailingMean / overallHistoricalMean;

  const forecastRecords: CensusRecord[] = [];

  for (let d = 1; d <= forecastDays; d++) {
    const targetDate = new Date(anchorDate);
    targetDate.setDate(anchorDate.getDate() + d);

    const targetDayOfWeek = targetDate.getDay();
    const dayName = DAY_NAMES[targetDayOfWeek];

    // Find all historical records with the same day of week in the lookback window
    // (e.g. if target is Monday, look at the last N Mondays in history)
    const matchingHistoricalActuals: number[] = [];
    const maxLookbackDays = lookbackWeeks * 7;
    const startIndex = Math.max(0, history.length - maxLookbackDays);

    for (let i = history.length - 1; i >= startIndex; i--) {
      const rec = history[i];
      if (rec.dayOfWeek === dayName && typeof rec.actualCensus === 'number') {
        matchingHistoricalActuals.push(rec.actualCensus);
      }
    }

    // Historical mean for this specific day of week
    const sameDayMean =
      matchingHistoricalActuals.length > 0
        ? matchingHistoricalActuals.reduce((a, b) => a + b, 0) / matchingHistoricalActuals.length
        : 31 * DAY_SEASONALITY[targetDayOfWeek];

    // Blend: Seasonality Baseline adjusted by Recent Velocity Trend
    const trendAdjustedValue = sameDayMean * velocityRatio;
    const projectedFloat = sameDayMean * (1 - trendWeight) + trendAdjustedValue * trendWeight;

    let projectedCensus = Math.round(projectedFloat);
    // Clamp to realistic unit boundaries
    projectedCensus = Math.max(18, Math.min(capacity, projectedCensus));

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayLabel = `${dayName}, ${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getDate()}`;

    // Estimated admissions & discharges calculated from projected census
    const projectedAdmissions = Math.round(projectedCensus * 0.22);
    const projectedDischarges = Math.round(projectedCensus * 0.21);

    forecastRecords.push({
      date: dateStr,
      dayLabel,
      dayOfWeek: dayName,
      forecastCensus: projectedCensus,
      isForecast: true,
      capacity,
      occupancyRate: Math.round((projectedCensus / capacity) * 100),
      projectedAdmissions,
      projectedDischarges,
      acuityScore: 1.25,
    });
  }

  return forecastRecords;
}

/**
 * Recalculates staffing recommendation numbers (RNs & CNAs for Day and Night shifts)
 * based on the updated forecast and unit ratios.
 * Preserves existing manager approval states and custom overrides.
 */
export function recalculateStaffingFromForecast(
  forecastRecords: CensusRecord[],
  existingSchedules: DaySchedule[] | null,
  config: UnitConfig = DEFAULT_UNIT_CONFIG
): DaySchedule[] {
  const existingMap = new Map<string, DaySchedule>();
  if (existingSchedules) {
    existingSchedules.forEach((s) => existingMap.set(s.date, s));
  }

  return forecastRecords.map((record) => {
    const census = record.forecastCensus ?? record.actualCensus ?? 30;

    // Day Shift calculation (e.g. 1 RN : 4 Patients)
    const recDayRN = Math.ceil(census / config.dayRatio);
    const recDayCNA = Math.ceil(census / config.cnaDayRatio);

    // Night Shift calculation (e.g. 1 RN : 5 Patients)
    const recNightRN = Math.ceil(census / config.nightRatio);
    const recNightCNA = Math.ceil(census / config.cnaNightRatio);

    const existing = existingMap.get(record.date);

    if (existing) {
      // Check if previous recommendation changed due to updated forecast census
      const prevRecDayRN = existing.dayShift.recommendedRN;
      const prevRecNightRN = existing.nightShift.recommendedRN;

      // CRITICAL: Once a day is approved and signed by a manager, its status stays 'approved'
      // and its signed signature metadata is preserved across refreshes and forecast recalculations.
      const isApproved = existing.status === 'approved' || Boolean(existing.approvedBy);
      const finalStatus: DaySchedule['status'] = isApproved ? 'approved' : existing.status;

      return {
        ...existing,
        dayLabel: record.dayLabel,
        dayOfWeek: record.dayOfWeek,
        projectedCensus: census,
        capacity: record.capacity,
        status: finalStatus,
        approvedBy: isApproved ? existing.approvedBy : undefined,
        approvedAt: isApproved ? existing.approvedAt : undefined,
        dayShift: {
          ...existing.dayShift,
          census,
          targetRatio: config.dayRatio,
          recommendedRN: recDayRN,
          recommendedCNA: recDayCNA,
        },
        nightShift: {
          ...existing.nightShift,
          census,
          targetRatio: config.nightRatio,
          recommendedRN: recNightRN,
          recommendedCNA: recNightCNA,
        },
      };
    }

    // Default new schedule item
    const dayShift: ShiftRequirement = {
      shiftName: 'Day (07:00 - 19:00)',
      census,
      targetRatio: config.dayRatio,
      recommendedRN: recDayRN,
      recommendedCNA: recDayCNA,
      chargeNurseCount: 1,
    };

    const nightShift: ShiftRequirement = {
      shiftName: 'Night (19:00 - 07:00)',
      census,
      targetRatio: config.nightRatio,
      recommendedRN: recNightRN,
      recommendedCNA: recNightCNA,
      chargeNurseCount: 1,
    };

    return {
      date: record.date,
      dayLabel: record.dayLabel,
      dayOfWeek: record.dayOfWeek,
      projectedCensus: census,
      capacity: record.capacity,
      status: 'pending_review',
      dayShift,
      nightShift,
    };
  });
}

/**
 * Backward compatibility helper for components expecting generateSyntheticCensusData
 */
export function generateSyntheticCensusData(unitCapacity = 36) {
  const history = generateSyntheticHistoricalCensus(90, 'standard', unitCapacity);
  const forecast = computeStatisticalForecastFromHistory(history, { capacity: unitCapacity });
  return {
    history,
    forecast,
    combined: [...history, ...forecast],
  };
}

export function buildDefaultSchedules(
  forecastRecords: CensusRecord[],
  config: UnitConfig = DEFAULT_UNIT_CONFIG
): DaySchedule[] {
  return recalculateStaffingFromForecast(forecastRecords, null, config);
}
