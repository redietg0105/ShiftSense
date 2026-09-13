export type UserRole = 'nurse_manager' | 'charge_nurse' | 'staffing_coordinator';

export interface User {
  id: string;
  name: string;
  title: string;
  role: UserRole;
  email: string;
  unit: string;
}

export interface CensusRecord {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon, Sep 1"
  dayOfWeek: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
  actualCensus?: number;
  forecastCensus?: number;
  isForecast: boolean;
  capacity: number; // 36 beds
  occupancyRate: number; // percentage (0-100)
  projectedAdmissions?: number;
  projectedDischarges?: number;
  acuityScore?: number; // 1.0 - 1.5 scale (average patient complexity)
}

export interface ShiftRequirement {
  shiftName: 'Day (07:00 - 19:00)' | 'Night (19:00 - 07:00)';
  census: number;
  targetRatio: number; // e.g. 4 for 1:4
  recommendedRN: number;
  recommendedCNA: number;
  chargeNurseCount: number; // usually 1 fixed
  managerOverrideRN?: number;
  managerOverrideCNA?: number;
  notes?: string;
}

export interface DaySchedule {
  date: string;
  dayLabel: string;
  dayOfWeek: string;
  projectedCensus: number;
  capacity: number;
  status: 'pending_review' | 'approved' | 'modified';
  approvedBy?: string;
  approvedAt?: string;
  dayShift: ShiftRequirement;
  nightShift: ShiftRequirement;
  managerNotes?: string;
}

export interface UnitConfig {
  hospitalName: string;
  unitName: string;
  bedCapacity: number;
  dayRatio: number; // patients per nurse (e.g. 4)
  nightRatio: number; // patients per nurse (e.g. 5)
  cnaDayRatio: number; // patients per CNA (e.g. 8)
  cnaNightRatio: number; // patients per CNA (e.g. 10)
}
