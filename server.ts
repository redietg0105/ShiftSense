import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// `npm run dev` passes --dev so a NODE_ENV=production inherited from the shell
// (e.g. left over from testing a production build) can't silently flip the dev
// server into static-file mode, where it would look for a dist/ that doesn't exist.
const FORCE_DEV = process.argv.includes('--dev');
const IS_PRODUCTION = !FORCE_DEV && process.env.NODE_ENV === 'production';

// CSP is left to the app to configure deliberately (it would otherwise block
// Vite's inline dev-mode HMR client script); the rest of helmet's headers
// (nosniff, frameguard, HSTS in production, etc.) are safe defaults.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Database file path for durable persistence
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'shiftsense_db.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface ServerUser {
  id: string;
  name: string;
  title: string;
  role: 'nurse_manager' | 'charge_nurse' | 'staffing_coordinator';
  email: string;
  unit: string;
  passwordHash: string; // salt:scrypt-derived-key (hex), see hashPassword/verifyPassword
}

interface ServerSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface DatabaseSchema {
  users: ServerUser[];
  sessions: Record<string, ServerSession>;
  schedules: any[];
  historicalCensus: any[];
  auditLogs: any[];
  unitConfig: any;
}

// Input validation helpers — used across routes to reject malformed request
// bodies with a clean 400 instead of letting bad types reach business logic
// (and potentially throw, or silently corrupt the persisted database).
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_FIELD_LEN = 2000;

function safeString(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v : fallback;
  return s.slice(0, MAX_TEXT_FIELD_LEN);
}

// Salted scrypt hash, stored as "salt:derivedKey" (both hex).
function hashPassword(pwd: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

// Verifies against the current salted-scrypt format, with a fallback for
// unsalted SHA-256 hashes written by older versions of this file (so an
// existing data/shiftsense_db.json doesn't get locked out after this change).
function verifyPassword(pwd: string, stored: string): boolean {
  if (!stored) return false;

  if (stored.includes(':')) {
    const [salt, hashHex] = stored.split(':');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(pwd, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  const legacy = crypto.createHash('sha256').update(pwd).digest('hex');
  const expected = Buffer.from(stored, 'hex');
  const actual = Buffer.from(legacy, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const DEFAULT_USERS: ServerUser[] = [
  {
    id: 'user_sarah_jenkins',
    name: 'Sarah Jenkins, RN, MSN',
    title: 'Nurse Manager, Med-Surg 4B',
    role: 'nurse_manager',
    email: 'sjenkins@metrohealth.org',
    unit: 'Med-Surg 4B',
    passwordHash: hashPassword('nurse123'),
  },
  {
    id: 'user_david_miller',
    name: 'David Miller, BSN',
    title: 'Charge Nurse, Day Shift',
    role: 'charge_nurse',
    email: 'dmiller@metrohealth.org',
    unit: 'Med-Surg 4B',
    passwordHash: hashPassword('charge123'),
  },
  {
    id: 'user_amanda_torres',
    name: 'Amanda Torres',
    title: 'Central Staffing Coordinator',
    role: 'staffing_coordinator',
    email: 'atorres@metrohealth.org',
    unit: 'Inpatient Operations',
    passwordHash: hashPassword('staff123'),
  },
];

function initDatabase(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users) {
        return parsed;
      }
    } catch (err) {
      console.error('Error reading database file, initializing default:', err);
    }
  }

  const initialDb: DatabaseSchema = {
    users: DEFAULT_USERS,
    sessions: {},
    schedules: [],
    historicalCensus: [],
    auditLogs: [],
    unitConfig: {
      hospitalName: 'MetroHealth Medical Center',
      unitName: 'Medical-Surgical 4B (Acute Care)',
      bedCapacity: 36,
      dayRatio: 4,
      nightRatio: 5,
      cnaDayRatio: 8,
      cnaNightRatio: 10,
    },
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  return initialDb;
}

let db = initDatabase();

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: ServerUser;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || !db.sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }

  const session = db.sessions[token];
  const now = new Date();
  if (new Date(session.expiresAt) < now) {
    delete db.sessions[token];
    saveDatabase();
    return res.status(401).json({ error: 'Unauthorized: Session expired' });
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  req.user = user;
  next();
}

/* =========================================================================
   API ROUTES
========================================================================= */

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    unit: db.unitConfig.unitName,
    databasePersistence: 'active',
    databasePath: DB_FILE,
  });
});

// Auth: List available users for quick sign-in demo
app.get('/api/auth/users', (req, res) => {
  const publicUsers = db.users.map(({ passwordHash, ...u }) => ({
    ...u,
    hasPassword: true,
  }));
  res.json({ users: publicUsers });
});

// Auth: Login
const DEMO_PASSWORD = 'hospital123';

// Throttle login attempts to slow down credential-stuffing / brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254 || password.length > 512) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  // Demo convenience: any seeded account also accepts 'hospital123', but only
  // outside production, so this never ships as a real-world universal password.
  const usedDemoPassword = !IS_PRODUCTION && password === DEMO_PASSWORD;
  const passwordOk = Boolean(user) && (verifyPassword(password, user!.passwordHash) || usedDemoPassword);

  if (!user || !passwordOk) {
    // Deliberately identical for "no such account" and "wrong password" so a
    // caller can't enumerate which emails are valid staff accounts.
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Create real cryptographic session token
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  db.sessions[token] = {
    token,
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  saveDatabase();

  const { passwordHash, ...safeUser } = user;
  res.json({
    token,
    user: safeUser,
    expiresAt: expiresAt.toISOString(),
  });
});

// Auth: Validate token and get current user
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Auth: Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (db.sessions[token]) {
      delete db.sessions[token];
      saveDatabase();
    }
  }
  res.json({ success: true });
});

// Schedules: Get persisted schedules (Requires authentication)
app.get('/api/schedules', authMiddleware, (req, res) => {
  res.json({
    schedules: db.schedules || [],
    unitConfig: db.unitConfig,
  });
});

// Schedules: Save/Update approved schedules (Requires authentication)
const APPROVER_ROLES: ServerUser['role'][] = ['nurse_manager', 'charge_nurse'];

app.post('/api/schedules', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { schedules, unitConfig } = req.body ?? {};

  const isValidScheduleShape =
    Array.isArray(schedules) &&
    schedules.every((item: any) => item && typeof item === 'object' && isNonEmptyString(item.date));
  if (!isValidScheduleShape) {
    return res.status(400).json({ error: 'Invalid schedules payload. Each entry must be an object with a date.' });
  }
  if (unitConfig !== undefined && (typeof unitConfig !== 'object' || unitConfig === null || Array.isArray(unitConfig))) {
    return res.status(400).json({ error: 'Invalid unitConfig payload. Must be an object.' });
  }

  const currentUser = req.user!;
  const canApprove = APPROVER_ROLES.includes(currentUser.role);
  const existingByDate = new Map((db.schedules || []).map((s: any) => [s.date, s]));

  // The client is trusted for headcount overrides and notes (any signed-in
  // staff member may propose those), but never for the approval signature:
  // status/approvedBy/approvedAt are always re-derived here from the
  // authenticated session so a schedule can't be marked "signed" by a role
  // that isn't authorized to approve, or signed with a forged name.
  const sanitizedSchedules = schedules.map((item: any) => {
    const requestedApproval = item.status === 'approved' || Boolean(item.approvedBy);
    if (!requestedApproval) {
      return { ...item, status: item.status, approvedBy: undefined, approvedAt: undefined };
    }

    if (!canApprove) {
      // Not authorized to sign off — keep the day at whatever state it was
      // already persisted in, dropping the unauthorized approval attempt.
      const existing: any = existingByDate.get(item.date);
      return {
        ...item,
        status: existing?.status ?? 'modified',
        approvedBy: existing?.approvedBy,
        approvedAt: existing?.approvedAt,
      };
    }

    return {
      ...item,
      status: 'approved',
      approvedBy: currentUser.name,
      approvedAt:
        new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' at ' +
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  });

  db.schedules = sanitizedSchedules;
  if (unitConfig) {
    db.unitConfig = { ...db.unitConfig, ...unitConfig };
  }

  saveDatabase();

  res.json({
    success: true,
    message: 'Schedules persisted successfully to backend database.',
    count: schedules.length,
    updatedAt: new Date().toISOString(),
  });
});

// Historical Census: Get persisted historical data
app.get('/api/census/history', authMiddleware, (req, res) => {
  res.json({
    historicalCensus: db.historicalCensus || [],
  });
});

// Historical Census: Save/Update historical data (e.g. after editing recent days or regenerating)
app.post('/api/census/history', authMiddleware, (req, res) => {
  const { historicalCensus } = req.body ?? {};
  const isValidCensusShape =
    Array.isArray(historicalCensus) && historicalCensus.every((item: any) => item && typeof item === 'object');
  if (!isValidCensusShape) {
    return res.status(400).json({ error: 'Invalid historicalCensus payload. Must be an array of objects.' });
  }

  db.historicalCensus = historicalCensus;
  saveDatabase();

  res.json({
    success: true,
    count: historicalCensus.length,
    updatedAt: new Date().toISOString(),
  });
});

// Audit Logs: Get all audit logs
app.get('/api/audit', authMiddleware, (req, res) => {
  res.json({
    auditLogs: db.auditLogs || [],
  });
});

// Audit Logs: Append audit entry
app.post('/api/audit', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { action, dateTarget, details } = req.body ?? {};

  const entry = {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric',
    }),
    // Coerced to string and length-capped: the audit log is a compliance
    // record, so it must never store a type other than text, and a client
    // shouldn't be able to bloat storage with an oversized field.
    action: safeString(action, 'Action Authorized'),
    userName: req.user?.name || 'Authorized Staff',
    userRole: req.user?.title || 'Staff',
    dateTarget: safeString(dateTarget, 'General'),
    details: safeString(details, ''),
  };

  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 100) {
    db.auditLogs = db.auditLogs.slice(0, 100);
  }

  saveDatabase();
  res.json({ success: true, entry });
});

/* =========================================================================
   VITE & STATIC MIDDLEWARE
========================================================================= */

async function startServer() {
  if (!IS_PRODUCTION) {
    // Vite and the React plugin key their dev behavior (fast refresh, etc.) off
    // NODE_ENV, so normalize it when dev mode was requested explicitly.
    if (FORCE_DEV) process.env.NODE_ENV = 'development';

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.error(
        `Production mode is active but ${indexHtml} was not found.\n` +
          'Run "npm run build" first, or use "npm run dev" for local development.'
      );
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!fs.existsSync(indexHtml)) {
        return res
          .status(503)
          .type('text/plain')
          .send(
            'ShiftSense is running in production mode, but no build was found (dist/index.html is missing).\n' +
              'Run "npm run build", or start the development server with "npm run dev".'
          );
      }
      res.sendFile(indexHtml);
    });
  }

  // Centralized error handler — must be registered last so it sees errors
  // thrown anywhere above. Never leaks stack traces or internal details to
  // the client, regardless of NODE_ENV (Express's own default handler does
  // include the stack outside production, which is fine in a terminal but
  // not in an HTTP response).
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    // Errors raised by Express middleware carry an HTTP status (malformed JSON
    // -> 400, oversized body -> 413, missing file -> 404). Keep those as the
    // client errors they are with a fixed, generic message; only genuinely
    // unexpected failures become a 500.
    const status = Number(err?.status ?? err?.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      const message = status === 404 ? 'Not found' : status === 413 ? 'Request body too large' : 'Bad request';
      return res.status(status).json({ error: message });
    }

    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    const mode = IS_PRODUCTION ? 'production, serving dist/' : 'development, Vite dev middleware';
    console.log(`ShiftSense server running (${mode}) at http://localhost:${PORT}`);
    console.log(`Database persistence file active at: ${DB_FILE}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use, so ShiftSense could not start.\n` +
          `Whatever is answering at http://localhost:${PORT} right now is NOT this server ` +
          '(a common cause of an unexpected "page not found").\n' +
          'Stop that program, or run on another port: PowerShell  $env:PORT=3001; npm run dev\n'
      );
    } else {
      console.error('ShiftSense failed to start:', err);
    }
    process.exit(1);
  });
}

startServer();
