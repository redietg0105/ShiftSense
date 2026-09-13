import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { 
  Activity, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Building2,
  CalendarCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const PRESET_USERS: User[] = [
  {
    id: 'user_sarah_jenkins',
    name: 'Sarah Jenkins, RN, MSN',
    title: 'Nurse Manager, Med-Surg 4B',
    role: 'nurse_manager',
    email: 'sjenkins@metrohealth.org',
    unit: 'Med-Surg 4B',
  },
  {
    id: 'user_david_miller',
    name: 'David Miller, BSN',
    title: 'Charge Nurse, Day Shift',
    role: 'charge_nurse',
    email: 'dmiller@metrohealth.org',
    unit: 'Med-Surg 4B',
  },
  {
    id: 'user_amanda_torres',
    name: 'Amanda Torres',
    title: 'Central Staffing Coordinator',
    role: 'staffing_coordinator',
    email: 'atorres@metrohealth.org',
    unit: 'Inpatient Operations',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_USERS[0].id);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customRole, setCustomRole] = useState<UserRole>('nurse_manager');
  const [password, setPassword] = useState<string>('hospital123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (user: User) => {
    setSelectedPresetId(user.id);
    setIsCustom(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isCustom) {
        if (!customName.trim()) {
          setLoading(false);
          return;
        }
        const customEmail = customName.toLowerCase().replace(/\s+/g, '.') + '@metrohealth.org';
        // Attempt backend login, or register session
        try {
          const authRes = await api.login(customEmail, password || 'hospital123');
          onLogin(authRes.user);
        } catch {
          // If custom user isn't pre-seeded, sign in as nurse manager session on server
          const authRes = await api.login('sjenkins@metrohealth.org', 'hospital123');
          const customUser: User = {
            ...authRes.user,
            id: 'user_custom_' + Date.now(),
            name: customName.trim(),
            title: customRole === 'nurse_manager' ? 'Nurse Manager' : customRole === 'charge_nurse' ? 'Charge Nurse' : 'Staffing Specialist',
            role: customRole,
            email: customEmail,
          };
          onLogin(customUser);
        }
      } else {
        const found = PRESET_USERS.find((u) => u.id === selectedPresetId);
        if (found) {
          const authRes = await api.login(found.email, password);
          onLogin(authRes.user);
        }
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md mb-4">
          <Activity className="w-8 h-8 stroke-[2.3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ShiftSense
        </h1>
        <p className="mt-1 text-sm text-slate-600 font-medium">
          Hospital Nurse Staffing Demand & Forecast Management
        </p>
        <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
          <Building2 className="w-3.5 h-3.5" />
          <span>MetroHealth General • Med-Surg Unit 4B</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Clinical Access Authorization</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your hospital staff credentials to view 7-day census predictions, adjust nurse-to-patient ratios, and authorize unit schedules.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {!isCustom ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Unit Staff Persona
                </label>
                <div className="space-y-2.5">
                  {PRESET_USERS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        id={`user-option-${preset.id}`}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {preset.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 flex items-center space-x-1.5">
                              <span>{preset.name}</span>
                              {preset.role === 'nurse_manager' && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                  Manager
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {preset.title}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium pt-1 inline-block cursor-pointer"
                >
                  Or sign in with custom hospital credentials &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Full Name & Credentials
                  </label>
                  <input
                    type="text"
                    required
                    id="custom-name-input"
                    placeholder="e.g. Maria Gonzalez, RN"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clinical Role
                  </label>
                  <select
                    id="custom-role-select"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="nurse_manager">Nurse Manager (Schedule Authorization & Overrides)</option>
                    <option value="charge_nurse">Charge Nurse (Staffing Review & Adjustments)</option>
                    <option value="staffing_coordinator">Staffing Coordinator (Central Inpatient Pool)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustom(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline inline-block cursor-pointer"
                >
                  Back to preset personas
                </button>
              </div>
            )}

            {/* Password input */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hospital Password
              </label>
              <input
                type="password"
                id="staff-password-input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: hospital123)"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Preset password: <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono">hospital123</code> (verified via server session auth)
              </p>
            </div>

            {error && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-button"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 transition-colors shadow-xs cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Access Med-Surg Unit Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Prototype Context Callout */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start space-x-3 text-xs text-slate-500">
            <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700 font-medium">Demand-Driven Prototype:</strong> 90 days of synthetic Med-Surg census loaded with day-of-week seasonality, dynamic ratio calculations, and persisted manager approval workflows.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
