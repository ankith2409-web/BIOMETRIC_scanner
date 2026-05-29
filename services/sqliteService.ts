import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

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
      CREATE TABLE IF NOT EXISTS embeddings (
        user_id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        vector TEXT NOT NULL,
        registered_at TEXT NOT NULL
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
    `);
  },

  saveEmbedding(userId: string, name: string, vector: Float32Array, registeredAt: string): void {
    const database = getDb();
    if (!database) return;
    database.runSync(
      `INSERT OR REPLACE INTO embeddings (user_id, name, vector, registered_at) VALUES (?, ?, ?, ?)`,
      [userId, name, JSON.stringify(Array.from(vector)), registeredAt]
    );
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
};
