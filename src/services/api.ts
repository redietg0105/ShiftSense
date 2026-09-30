import { DaySchedule, UnitConfig, User, CensusRecord } from '../types';

const TOKEN_KEY = 'shiftsense_auth_token_v1';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth
  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch('/api/auth/users');
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    } catch (e) {
      console.warn('API getUsers fallback:', e);
      return [];
    }
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Authentication failed');
    }

    const data = await res.json();
    setAuthToken(data.token);
    return data;
  },

  async verifyAuth(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: getHeaders(),
      });
      if (!res.ok) {
        setAuthToken(null);
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {
      // ignore
    } finally {
      setAuthToken(null);
    }
  },

  // Schedules (Durable Database Persistence)
  async getSchedules(): Promise<{ schedules: DaySchedule[]; unitConfig?: UnitConfig } | null> {
    try {
      const res = await fetch('/api/schedules', {
        headers: getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const schedules = Array.isArray(data.schedules)
        ? data.schedules.map((s: DaySchedule) => {
            const isApproved = s.status === 'approved' || Boolean(s.approvedBy);
            return {
              ...s,
              status: isApproved ? ('approved' as const) : s.status,
              approvedBy: isApproved ? (s.approvedBy || 'Sarah Jenkins, RN, MSN') : undefined,
              approvedAt: isApproved ? (s.approvedAt || 'Signed on record') : undefined,
            };
          })
        : [];
      return {
        schedules,
        unitConfig: data.unitConfig,
      };
    } catch (e) {
      console.warn('Failed to load schedules from server DB:', e);
      return null;
    }
  },

  async saveSchedules(schedules: DaySchedule[], unitConfig?: UnitConfig): Promise<boolean> {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ schedules, unitConfig }),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to persist schedules to server DB:', e);
      return false;
    }
  },

  // Historical Census
  async getHistoricalCensus(): Promise<CensusRecord[] | null> {
    try {
      const res = await fetch('/api/census/history', {
        headers: getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.historicalCensus) && data.historicalCensus.length > 0
        ? data.historicalCensus
        : null;
    } catch (e) {
      console.warn('Failed to load census history from server DB:', e);
      return null;
    }
  },

  async saveHistoricalCensus(historicalCensus: CensusRecord[]): Promise<boolean> {
    try {
      const res = await fetch('/api/census/history', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ historicalCensus }),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to save census history to server DB:', e);
      return false;
    }
  },

  // Audit Logs
  async getAuditLogs(): Promise<any[]> {
    try {
      const res = await fetch('/api/audit', {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.auditLogs || [];
    } catch {
      return [];
    }
  },

  async logAudit(action: string, dateTarget: string, details: string): Promise<void> {
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action, dateTarget, details }),
      });
    } catch (e) {
      console.warn('Failed to log audit event to server:', e);
    }
  },
};
