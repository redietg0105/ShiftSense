import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
  passwordHash: string; // SHA-256
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

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
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
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid hospital staff credentials' });
  }

  const providedHash = hashPassword(password);
  // Also accept demo password 'hospital123' for convenience across all accounts
  if (user.passwordHash !== providedHash && providedHash !== hashPassword('hospital123')) {
    return res.status(401).json({ error: 'Incorrect password for this staff member' });
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
app.post('/api/schedules', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { schedules, unitConfig } = req.body;

  if (!Array.isArray(schedules)) {
    return res.status(400).json({ error: 'Invalid schedules payload. Must be an array.' });
  }

  db.schedules = schedules;
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
  const { historicalCensus } = req.body;
  if (!Array.isArray(historicalCensus)) {
    return res.status(400).json({ error: 'Invalid historicalCensus payload' });
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
  const { action, dateTarget, details } = req.body;

  const entry = {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric',
    }),
    action: action || 'Action Authorized',
    userName: req.user?.name || 'Authorized Staff',
    userRole: req.user?.title || 'Staff',
    dateTarget: dateTarget || 'General',
    details: details || '',
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
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShiftSense server running on http://0.0.0.0:${PORT}`);
    console.log(`Database persistence file active at: ${DB_FILE}`);
  });
}

startServer();
