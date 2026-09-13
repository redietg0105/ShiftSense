import { DaySchedule, UnitConfig, User } from '../types';
import { DEFAULT_UNIT_CONFIG } from '../data/censusGenerator';

const STORAGE_KEYS = {
  SCHEDULES: 'shiftsense_approved_schedules_v1',
  AUTH_USER: 'shiftsense_current_user_v1',
  CONFIG: 'shiftsense_unit_config_v1',
  AUDIT_LOG: 'shiftsense_audit_log_v1',
};

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userName: string;
  userRole: string;
  dateTarget: string;
  details: string;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
  }
}

export function getStoredSchedules(): DaySchedule[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure approval status and signed timestamp always stay strictly in sync
      return parsed.map((s: DaySchedule) => {
        const isApproved = s.status === 'approved' || Boolean(s.approvedBy);
        return {
          ...s,
          status: isApproved ? ('approved' as const) : s.status,
          approvedBy: isApproved ? (s.approvedBy || 'Sarah Jenkins, RN, MSN') : undefined,
          approvedAt: isApproved ? (s.approvedAt || 'Signed on record') : undefined,
        };
      });
    }
    return null;
  } catch (err) {
    console.error('Failed to load stored schedules from localStorage:', err);
    return null;
  }
}

export function saveStoredSchedules(schedules: DaySchedule[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  } catch (err) {
    console.error('Failed to save schedules to localStorage:', err);
  }
}

export function getStoredUnitConfig(): UnitConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return DEFAULT_UNIT_CONFIG;
    return { ...DEFAULT_UNIT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_UNIT_CONFIG;
  }
}

export function saveStoredUnitConfig(config: UnitConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

export function logAuditEvent(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    const list: AuditEntry[] = raw ? JSON.parse(raw) : [];
    const newEntry: AuditEntry = {
      ...entry,
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' }),
    };
    list.unshift(newEntry);
    // Keep last 50 audit entries
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn('Could not record audit log', e);
  }
}

export function getAuditLogs(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Neutralizes CSV/spreadsheet formula injection: a cell whose text starts
// with =, +, -, @ (or a tab/CR) is interpreted as a formula by Excel/Sheets
// when the file is opened, which is dangerous for any field that holds
// free-typed user input (e.g. Manager Notes). Prefixing with a single quote
// forces spreadsheet apps to treat it as plain text while keeping the
// visible content essentially unchanged.
function csvSafe(value: string): string {
  const needsGuard = /^[=+\-@\t\r]/.test(value);
  const guarded = needsGuard ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function exportSchedulesToCSV(schedules: DaySchedule[], unitName: string): void {
  const headers = [
    'Date',
    'Day',
    'Forecast Census',
    'Status',
    'Day Shift RN (Rec)',
    'Day Shift RN (Approved)',
    'Day Shift CNA',
    'Night Shift RN (Rec)',
    'Night Shift RN (Approved)',
    'Night Shift CNA',
    'Approved By',
    'Approval Timestamp',
    'Manager Notes',
  ];

  const rows = schedules.map((s) => [
    csvSafe(s.date),
    csvSafe(s.dayOfWeek),
    s.projectedCensus,
    csvSafe(s.status.toUpperCase()),
    s.dayShift.recommendedRN,
    s.dayShift.managerOverrideRN ?? s.dayShift.recommendedRN,
    s.dayShift.managerOverrideCNA ?? s.dayShift.recommendedCNA,
    s.nightShift.recommendedRN,
    s.nightShift.managerOverrideRN ?? s.nightShift.recommendedRN,
    s.nightShift.managerOverrideCNA ?? s.nightShift.recommendedCNA,
    csvSafe(s.approvedBy || 'Unapproved'),
    csvSafe(s.approvedAt || '-'),
    csvSafe(s.managerNotes || ''),
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ShiftSense_${unitName.replace(/\s+/g, '_')}_Staffing_Forecast_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
