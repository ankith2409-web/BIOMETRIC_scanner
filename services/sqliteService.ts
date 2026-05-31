import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { User, AttendanceRecord, AuthLog } from './storageService';
import { FaceEmbedding } from '../src/types/face';
import { GalleryEntry } from '../src/engine/matcher';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = (): SQLite.SQLiteDatabase | null => {
  if (Platform.OS === 'web') return null;
  if (!db) db = SQLite.openDatabaseSync('facegate.db');
  return db;
};

export const sqliteService = {
  init(): void {
    const database = getDb();
    if (!database) return;
    database.execSync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        registered_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        vector TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        is_extra INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        date TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS auth_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        name TEXT NOT NULL,
        matched INTEGER NOT NULL,
        confidence REAL,
        liveness_pass INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence INTEGER NOT NULL
    `);

    // Clean up duplicate names and phone numbers
    database.execSync(`
      DELETE FROM users 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM users 
        GROUP BY LOWER(TRIM(name))
      );
      
      DELETE FROM users 
      WHERE phone IS NOT NULL AND TRIM(phone) != '' AND id NOT IN (
        SELECT MIN(id) 
        FROM users 
        GROUP BY TRIM(phone)
      );

      DELETE FROM embeddings WHERE user_id NOT IN (SELECT id FROM users);
      DELETE FROM attendance WHERE user_id NOT IN (SELECT id FROM users);
    `);

    // Seed mock users if empty
    const userCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count === 0) {
      const mockUsers = [
        { id: '1', name: 'John Doe', registeredAt: '2024-03-15', status: 'active', phone: '+919876543210' },
        { id: '2', name: 'Sarah Chen', registeredAt: '2024-03-14', status: 'active', phone: '+919876543211' },
        { id: '3', name: 'Mike Ross', registeredAt: '2024-03-12', status: 'active', phone: '+919876543212' },
        { id: '4', name: 'Emma Wilson', registeredAt: '2024-03-10', status: 'pending', phone: '+919876543213' },
      ];
      for (const u of mockUsers) {
        database.runSync(
          'INSERT OR REPLACE INTO users (id, name, phone, registered_at, status) VALUES (?, ?, ?, ?, ?)',
          [u.id, u.name, u.phone, u.registeredAt, u.status]
        );
      }

      // Seed mock attendance
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const mockRecords = [
        {
          id: 'att_today_1',
          userId: '1',
          userName: 'John Doe',
          date: todayStr,
          checkIn: '09:15 AM',
          checkOut: '06:00 PM',
          note: 'Checked in via Biometric Scanner',
          status: 'pending'
        },
        {
          id: 'att_today_2',
          userId: '2',
          userName: 'Sarah Chen',
          date: todayStr,
          checkIn: '08:45 AM',
          checkOut: null,
          note: 'Checked in via Biometric Scanner',
          status: 'pending'
        }
      ];

      const userPresences = {
        '1': [1, 2, 3, 5, 6, 7, 8],
        '2': [1, 2, 3, 4, 6, 7, 8, 9],
        '3': [2, 3, 5, 6, 8, 9],
        '4': [3, 7]
      };
      
      const userNames = {
        '1': 'John Doe',
        '2': 'Sarah Chen',
        '3': 'Mike Ross',
        '4': 'Emma Wilson'
      };

      Object.entries(userPresences).forEach(([uid, days]) => {
        days.forEach((dayOffset, idx) => {
          const pastDate = new Date();
          pastDate.setDate(now.getDate() - dayOffset);
          if (pastDate.getDay() === 0) return; // skip Sundays
          
          const year = pastDate.getFullYear();
          const month = String(pastDate.getMonth() + 1).padStart(2, '0');
          const day = String(pastDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          mockRecords.push({
            id: `att_seed_${uid}_${idx}`,
            userId: uid,
            userName: userNames[uid as '1' | '2' | '3' | '4'],
            date: dateStr,
            checkIn: '09:30 AM',
            checkOut: '06:30 PM',
            note: 'Standard shift check-in',
            status: 'pending'
          });
        });
      });

      for (const r of mockRecords) {
        database.runSync(
          'INSERT OR REPLACE INTO attendance (id, user_id, user_name, date, check_in, check_out, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [r.id, r.userId, r.userName, r.date, r.checkIn, r.checkOut || null, r.note, r.status]
        );
      }

      // Seed mock auth dashboard logs
      const mockLogs = [
        { id: 'log1', name: 'John Doe', timestamp: '2 min ago', status: 'success', confidence: 94 },
        { id: 'log2', name: 'Sarah Chen', timestamp: '15 min ago', status: 'success', confidence: 91 },
        { id: 'log3', name: 'Unknown', timestamp: '32 min ago', status: 'failure', confidence: 45 },
      ];
      for (const l of mockLogs) {
        database.runSync(
          'INSERT OR REPLACE INTO logs (id, name, timestamp, status, confidence) VALUES (?, ?, ?, ?, ?)',
          [l.id, l.name, l.timestamp, l.status, l.confidence]
        );
      }
    }
  },

  // --- USERS CRUD ---
  getUsers(): User[] {
    const database = getDb();
    if (!database) return [];
    const rows = database.getAllSync<{
      id: string;
      name: string;
      phone: string | null;
      registered_at: string;
      status: string;
    }>('SELECT * FROM users');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? undefined,
      registeredAt: r.registered_at,
      status: r.status as 'active' | 'pending'
    }));
  },

  saveUser(user: User): void {
    const database = getDb();
    if (!database) return;

    // Check duplicate name case-insensitively
    const dupName = database.getFirstSync<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ? LIMIT 1',
      [user.name, user.id]
    );
    if (dupName) {
      console.warn(`User with name "${user.name}" already exists. Skipping save.`);
      return;
    }

    // Check duplicate phone
    if (user.phone && user.phone.trim() !== '') {
      const dupPhone = database.getFirstSync<{ id: string }>(
        'SELECT id FROM users WHERE TRIM(phone) = TRIM(?) AND id != ? LIMIT 1',
        [user.phone, user.id]
      );
      if (dupPhone) {
        console.warn(`User with phone "${user.phone}" already exists. Skipping save.`);
        return;
      }
    }

    database.runSync(
      'INSERT OR REPLACE INTO users (id, name, phone, registered_at, status) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, user.phone ?? null, user.registeredAt, user.status]
    );
  },

  deleteUser(id: string): void {
    const database = getDb();
    if (!database) return;
    database.runSync('DELETE FROM users WHERE id = ?', [id]);
    database.runSync('DELETE FROM embeddings WHERE user_id = ?', [id]);
    database.runSync('DELETE FROM attendance WHERE user_id = ?', [id]);
  },

  getUserByPhone(phone: string): User | undefined {
    const database = getDb();
    if (!database) return undefined;
    const row = database.getFirstSync<{
      id: string;
      name: string;
      phone: string | null;
      registered_at: string;
      status: string;
    }>('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone ?? undefined,
      registeredAt: row.registered_at,
      status: row.status as 'active' | 'pending'
    };
  },

  // --- EMBEDDINGS CRUD ---
  getFaceEmbeddings(): FaceEmbedding[] {
    const database = getDb();
    if (!database) return [];
    const rows = database.getAllSync<{
      user_id: string;
      name: string;
      vector: string;
      registered_at: string;
    }>('SELECT * FROM embeddings WHERE is_extra = 0');
    return rows.map(r => ({
      userId: r.user_id,
      name: r.name,
      vector: new Float32Array(JSON.parse(r.vector)),
      registeredAt: r.registered_at
    }));
  },

  getFaceEmbeddingByUserId(userId: string): FaceEmbedding | undefined {
    const database = getDb();
    if (!database) return undefined;
    const row = database.getFirstSync<{
      user_id: string;
      name: string;
      vector: string;
      registered_at: string;
    }>('SELECT * FROM embeddings WHERE user_id = ? AND is_extra = 0 LIMIT 1', [userId]);
    if (!row) return undefined;
    return {
      userId: row.user_id,
      name: row.name,
      vector: new Float32Array(JSON.parse(row.vector)),
      registeredAt: row.registered_at
    };
  },

  saveFaceEmbedding(embedding: FaceEmbedding): void {
    const database = getDb();
    if (!database) return;
    // Replace base embedding for this user
    database.runSync(
      'DELETE FROM embeddings WHERE user_id = ? AND is_extra = 0',
      [embedding.userId]
    );
    database.runSync(
      'INSERT INTO embeddings (user_id, name, vector, registered_at, is_extra) VALUES (?, ?, ?, ?, 0)',
      [embedding.userId, embedding.name, JSON.stringify(Array.from(embedding.vector)), embedding.registeredAt]
    );
  },

  saveExtraFaceEmbedding(userId: string, vector: Float32Array): void {
    const database = getDb();
    if (!database) return;

    let name = 'Unknown';
    const userRow = database.getFirstSync<{ name: string }>(
      'SELECT name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (userRow) {
      name = userRow.name;
    } else {
      const embRow = database.getFirstSync<{ name: string }>(
        'SELECT name FROM embeddings WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (embRow) name = embRow.name;
    }

    const countRow = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM embeddings WHERE user_id = ? AND is_extra = 1',
      [userId]
    );
    const count = countRow ? countRow.count : 0;
    if (count < 8) {
      database.runSync(
        'INSERT INTO embeddings (user_id, name, vector, registered_at, is_extra) VALUES (?, ?, ?, ?, 1)',
        [userId, name, JSON.stringify(Array.from(vector)), new Date().toISOString()]
      );
    }
  },

  getFaceEmbeddingsAsGallery(): GalleryEntry[] {
    const database = getDb();
    if (!database) return [];

    const rows = database.getAllSync<{
      user_id: string;
      name: string;
      vector: string;
      registered_at: string;
      is_extra: number;
    }>('SELECT * FROM embeddings ORDER BY is_extra ASC');

    const galleryMap = new Map<string, GalleryEntry>();

    for (const r of rows) {
      let vectorArr: Float32Array;
      try {
        vectorArr = new Float32Array(JSON.parse(r.vector));
      } catch (err) {
        console.error('Failed to parse vector:', r.vector, err);
        continue;
      }

      if (r.is_extra === 0) {
        galleryMap.set(r.user_id, {
          userId: r.user_id,
          name: r.name,
          vector: vectorArr,
          registeredAt: r.registered_at,
          extraVectors: []
        });
      } else {
        let entry = galleryMap.get(r.user_id);
        if (!entry) {
          entry = {
            userId: r.user_id,
            name: r.name,
            vector: vectorArr,
            registeredAt: r.registered_at,
            extraVectors: []
          };
          galleryMap.set(r.user_id, entry);
        } else {
          entry.extraVectors = entry.extraVectors ?? [];
          entry.extraVectors.push(vectorArr);
        }
      }
    }

    return Array.from(galleryMap.values());
  },

  deleteFaceEmbedding(userId: string): void {
    const database = getDb();
    if (!database) return;
    database.runSync('DELETE FROM embeddings WHERE user_id = ?', [userId]);
  },

  // --- ATTENDANCE CRUD ---
  getAttendanceRecords(userId?: string): AttendanceRecord[] {
    const database = getDb();
    if (!database) return [];

    let rows;
    if (userId) {
      rows = database.getAllSync<{
        id: string;
        user_id: string;
        user_name: string;
        date: string;
        check_in: string | null;
        check_out: string | null;
        note: string | null;
        status: string;
      }>('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC', [userId]);
    } else {
      rows = database.getAllSync<{
        id: string;
        user_id: string;
        user_name: string;
        date: string;
        check_in: string | null;
        check_out: string | null;
        note: string | null;
        status: string;
      }>('SELECT * FROM attendance ORDER BY date DESC');
    }

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      date: r.date,
      checkIn: r.check_in ?? undefined,
      checkOut: r.check_out ?? undefined,
      note: r.note ?? undefined,
      status: r.status as 'pending' | 'synced'
    }));
  },

  saveAttendanceRecords(records: AttendanceRecord[]): void {
    const database = getDb();
    if (!database) return;

    database.runSync('DELETE FROM attendance');
    for (const r of records) {
      database.runSync(
        'INSERT OR REPLACE INTO attendance (id, user_id, user_name, date, check_in, check_out, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.userId, r.userName, r.date, r.checkIn ?? null, r.checkOut ?? null, r.note ?? null, r.status ?? 'pending']
      );
    }
  },

  logAttendance(userId: string, userName: string): AttendanceRecord {
    const database = getDb();
    if (!database) {
      throw new Error('Database not initialized');
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const existing = database.getFirstSync<{
      id: string;
      check_in: string | null;
      check_out: string | null;
      note: string | null;
      status: string;
    }>(
      'SELECT * FROM attendance WHERE user_id = ? AND date = ? LIMIT 1',
      [userId, todayStr]
    );

    const nowTimeStr = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (existing) {
      database.runSync(
        'UPDATE attendance SET check_out = ?, status = "pending" WHERE id = ?',
        [nowTimeStr, existing.id]
      );
      return {
        id: existing.id,
        userId,
        userName,
        date: todayStr,
        checkIn: existing.check_in ?? undefined,
        checkOut: nowTimeStr,
        note: existing.note ?? undefined,
        status: 'pending'
      };
    } else {
      const newId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const note = 'Checked in via Biometric Scanner';
      database.runSync(
        'INSERT INTO attendance (id, user_id, user_name, date, check_in, note, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
        [newId, userId, userName, todayStr, nowTimeStr, note]
      );
      return {
        id: newId,
        userId,
        userName,
        date: todayStr,
        checkIn: nowTimeStr,
        note,
        status: 'pending'
      };
    }
  },

  // --- DASHBOARD HISTORY LOGS CRUD ---
  getLogs(): AuthLog[] {
    const database = getDb();
    if (!database) return [];
    const rows = database.getAllSync<{
      id: string;
      name: string;
      timestamp: string;
      status: string;
      confidence: number;
    }>('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      timestamp: r.timestamp,
      status: r.status as 'success' | 'failure',
      confidence: r.confidence
    }));
  },

  saveLogs(logs: AuthLog[]): void {
    const database = getDb();
    if (!database) return;
    database.runSync('DELETE FROM logs');
    for (const l of logs) {
      database.runSync(
        'INSERT OR REPLACE INTO logs (id, name, timestamp, status, confidence) VALUES (?, ?, ?, ?, ?)',
        [l.id, l.name, l.timestamp, l.status, l.confidence]
      );
    }
  },

  addLog(log: Omit<AuthLog, 'id'>): void {
    const database = getDb();
    if (!database) return;

    let timestamp = log.timestamp;
    if (timestamp === 'Just now') {
      const now = new Date();
      const formattedDate = now.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      timestamp = `${formattedDate}, ${formattedTime}`;
    }

    const newId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    database.runSync(
      'INSERT INTO logs (id, name, timestamp, status, confidence) VALUES (?, ?, ?, ?, ?)',
      [newId, log.name, timestamp, log.status, log.confidence]
    );

    // Keep only last 50 logs in SQLite
    database.runSync(
      'DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 50)'
    );
  },

  // --- TELEMETRY SECURITY LOGS CRUD ---
  getAuthLogs(): Array<{
    id: string;
    userId?: string;
    name: string;
    matched: boolean;
    confidence?: number;
    livenessPass: boolean;
    timestamp: string;
  }> {
    const database = getDb();
    if (!database) return [];
    
    const rows = database.getAllSync<{
      id: number;
      user_id: string | null;
      name: string;
      matched: number;
      confidence: number | null;
      liveness_pass: number;
      timestamp: string;
    }>('SELECT * FROM auth_logs ORDER BY id DESC LIMIT 100');

    return rows.map(r => ({
      id: `auth_${r.id}`,
      userId: r.user_id ?? undefined,
      name: r.name,
      matched: r.matched === 1,
      confidence: r.confidence ?? undefined,
      livenessPass: r.liveness_pass === 1,
      timestamp: r.timestamp
    }));
  },

  addAuthLog(log: {
    userId?: string;
    name: string;
    matched: boolean;
    confidence?: number;
    livenessPass: boolean;
    timestamp: string;
  }): void {
    const database = getDb();
    if (!database) return;
    database.runSync(
      `INSERT INTO auth_logs (user_id, name, matched, confidence, liveness_pass, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [log.userId ?? null, log.name, log.matched ? 1 : 0, log.confidence ?? null, log.livenessPass ? 1 : 0, log.timestamp]
    );
  },

  purgeAuthLogs(): void {
    const database = getDb();
    if (!database) return;
    database.runSync('DELETE FROM auth_logs');
  },

  // --- RESET ALL ---
  purgeAll(): void {
    const database = getDb();
    if (!database) return;
    database.runSync('DELETE FROM users');
    database.runSync('DELETE FROM embeddings');
    database.runSync('DELETE FROM attendance');
    database.runSync('DELETE FROM auth_logs');
    database.runSync('DELETE FROM logs');
  },

  // --- BACKWARD COMPATIBILITY ALIAS ---
  saveEmbedding(userId: string, name: string, vector: Float32Array, registeredAt: string): void {
    this.saveFaceEmbedding({ userId, name, vector, registeredAt });
  }
};
