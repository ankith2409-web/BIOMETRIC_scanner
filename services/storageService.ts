import { Platform } from 'react-native';
import { FaceEmbedding } from '../src/types/face';
import { GalleryEntry } from '../src/engine/matcher';

const isWeb = Platform.OS === 'web';

// Memory storage fallback for native or if localStorage fails
const memoryStorage: Record<string, string> = {};

const localStore = {
  getItem: (key: string): string | null => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    return memoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    memoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    delete memoryStorage[key];
  }
};

export interface User {
  id: string;
  name: string;
  phone?: string; // Indian mobile number in +91XXXXXXXXXX format
  registeredAt: string;
  status: 'active' | 'pending';
  descriptor?: number[]; // 128-dimensional face embedding
}

export interface AuthLog {
  id: string;
  name: string;
  timestamp: string; // ISO string or human-readable
  status: 'success' | 'failure';
  confidence: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // HH:MM AM/PM
  checkOut?: string; // HH:MM AM/PM
  note?: string; // Additional works context
}

const USERS_KEY = 'facegate_users';
const LOGS_KEY = 'facegate_logs';
const SETTINGS_KEY = 'facegate_settings';
const EMBEDDINGS_KEY = 'facegate_embeddings';
const AUTH_LOGS_KEY = 'facegate_auth_logs';
const ATTENDANCE_KEY = 'facegate_attendance_records';

const MOCK_USERS: User[] = [
  { id: '1', name: 'John Doe', registeredAt: '2024-03-15', status: 'active', phone: '+919876543210' },
  { id: '2', name: 'Sarah Chen', registeredAt: '2024-03-14', status: 'active', phone: '+919876543211' },
  { id: '3', name: 'Mike Ross', registeredAt: '2024-03-12', status: 'active', phone: '+919876543212' },
  { id: '4', name: 'Emma Wilson', registeredAt: '2024-03-10', status: 'pending', phone: '+919876543213' },
];

const MOCK_LOGS: AuthLog[] = [
  { id: 'log1', name: 'John Doe', timestamp: '2 min ago', status: 'success', confidence: 94 },
  { id: 'log2', name: 'Sarah Chen', timestamp: '15 min ago', status: 'success', confidence: 91 },
  { id: 'log3', name: 'Unknown', timestamp: '32 min ago', status: 'failure', confidence: 45 },
];

export const storageService = {
  // --- USERS ---
  getUsers(): User[] {
    const data = localStore.getItem(USERS_KEY);
    if (!data) {
      // Seed initial data
      this.saveUsers(MOCK_USERS);
      return MOCK_USERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return MOCK_USERS;
    }
  },

  saveUsers(users: User[]): void {
    localStore.setItem(USERS_KEY, JSON.stringify(users));
  },

  saveUser(user: User): void {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex > -1) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    this.saveUsers(users);
  },

  getUserByPhone(phone: string): User | undefined {
    const users = this.getUsers();
    return users.find(u => u.phone === phone);
  },

  getFaceEmbeddingByUserId(userId: string): FaceEmbedding | undefined {
    const embeddings = this.getFaceEmbeddings();
    return embeddings.find(e => e.userId === userId);
  },

  // --- EMBEDDINGS ---
  getFaceEmbeddings(): FaceEmbedding[] {
    const data = localStore.getItem(EMBEDDINGS_KEY);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as Array<{
        user_id?: string | number;
        userId?: string;
        name: string;
        embedding?: number[];
        vector?: number[];
        registered_at?: string;
        registeredAt?: string;
      }>;
      return parsed.map(item => {
        const idVal = item.user_id !== undefined ? String(item.user_id) : (item.userId ?? '');
        const vecVal = item.embedding ?? item.vector ?? [];
        return {
          userId: idVal.startsWith('user_') ? idVal : `user_${idVal}`,
          name: item.name,
          vector: new Float32Array(vecVal),
          registeredAt: item.registered_at ?? item.registeredAt ?? new Date().toISOString(),
        };
      });
    } catch {
      return [];
    }
  },

  saveFaceEmbedding(embedding: FaceEmbedding): void {
    const existing = this.getFaceEmbeddings();
    const next = existing.filter(e => e.userId !== embedding.userId);
    next.push(embedding);
    const serializable = next.map(item => {
      let idVal: string | number = item.userId;
      if (typeof item.userId === 'string' && item.userId.startsWith('user_')) {
        const num = Number(item.userId.replace('user_', ''));
        if (!isNaN(num)) idVal = num;
      }
      return {
        user_id: idVal,
        name: item.name,
        embedding: Array.from(item.vector),
        registered_at: item.registeredAt,
      };
    });
    localStore.setItem(EMBEDDINGS_KEY, JSON.stringify(serializable));
  },

  /**
   * Append an additional embedding vector for an already-registered user.
   * Up to 8 extra vectors are stored per user (to cap storage use).
   */
  saveExtraFaceEmbedding(userId: string, vector: Float32Array): void {
    const data = localStore.getItem(EMBEDDINGS_KEY);
    if (!data) return;
    try {
      const parsed = JSON.parse(data) as Array<{
        user_id?: string | number;
        userId?: string;
        name: string;
        embedding?: number[];
        vector?: number[];
        registered_at?: string;
        registeredAt?: string;
        extra_embeddings?: number[][];
        extraVectors?: number[][];
      }>;
      const idx = parsed.findIndex(e => {
        const idStr = e.user_id !== undefined ? String(e.user_id) : (e.userId ?? '');
        const targetStr = userId.startsWith('user_') ? userId.replace('user_', '') : userId;
        return idStr === userId || idStr === targetStr;
      });
      if (idx === -1) return;
      const extras = parsed[idx].extra_embeddings ?? parsed[idx].extraVectors ?? [];
      if (extras.length < 8) {
        extras.push(Array.from(vector));
        parsed[idx].extra_embeddings = extras;
        localStore.setItem(EMBEDDINGS_KEY, JSON.stringify(parsed));
      }
    } catch {
      // silently ignore
    }
  },

  /**
   * Returns the gallery in the extended GalleryEntry format that includes
   * all extra registration vectors for multi-embedding matching.
   */
  getFaceEmbeddingsAsGallery(): GalleryEntry[] {
    const data = localStore.getItem(EMBEDDINGS_KEY);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as Array<{
        user_id?: string | number;
        userId?: string;
        name: string;
        embedding?: number[];
        vector?: number[];
        registered_at?: string;
        registeredAt?: string;
        extra_embeddings?: number[][];
        extraVectors?: number[][];
      }>;
      return parsed.map(item => {
        const idVal = item.user_id !== undefined ? String(item.user_id) : (item.userId ?? '');
        const vecVal = item.embedding ?? item.vector ?? [];
        const extras = item.extra_embeddings ?? item.extraVectors ?? [];
        return {
          userId: idVal.startsWith('user_') ? idVal : `user_${idVal}`,
          name: item.name,
          vector: new Float32Array(vecVal),
          registeredAt: item.registered_at ?? item.registeredAt ?? new Date().toISOString(),
          extraVectors: extras.map(v => new Float32Array(v)),
        };
      });
    } catch {
      return [];
    }
  },

  addAuthLog(log: {
    userId?: string;
    name: string;
    matched: boolean;
    confidence?: number;
    livenessPass: boolean;
    timestamp: string;
  }): void {
    const logs = this.getAuthLogs();
    const next = [
      {
        id: `auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...log,
      },
      ...logs,
    ].slice(0, 100);
    localStore.setItem(AUTH_LOGS_KEY, JSON.stringify(next));
    if (log.matched && log.userId) {
      storageService.logAttendance(log.userId, log.name);
    }
  },

  getAuthLogs(): Array<{
    id: string;
    userId?: string;
    name: string;
    matched: boolean;
    confidence?: number;
    livenessPass: boolean;
    timestamp: string;
  }> {
    const data = localStore.getItem(AUTH_LOGS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  },

  deleteFaceEmbedding(userId: string): void {
    const data = localStore.getItem(EMBEDDINGS_KEY);
    if (!data) return;
    try {
      const parsed = JSON.parse(data) as Array<any>;
      const filtered = parsed.filter((e: any) => {
        const idVal = e.user_id !== undefined ? String(e.user_id) : (e.userId ?? '');
        const targetVal = userId.startsWith('user_') ? userId.replace('user_', '') : userId;
        return idVal !== userId && idVal !== targetVal;
      });
      localStore.setItem(EMBEDDINGS_KEY, JSON.stringify(filtered));
    } catch {
      // silently ignore
    }
  },

  // --- LOGS ---
  getLogs(): AuthLog[] {
    const data = localStore.getItem(LOGS_KEY);
    if (!data) {
      this.saveLogs(MOCK_LOGS);
      return MOCK_LOGS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return MOCK_LOGS;
    }
  },

  saveLogs(logs: AuthLog[]): void {
    localStore.setItem(LOGS_KEY, JSON.stringify(logs));
  },

  addLog(log: Omit<AuthLog, 'id'>): void {
    const logs = this.getLogs();
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
    const newLog: AuthLog = {
      ...log,
      timestamp,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
    // Keep last 50 logs
    const updated = [newLog, ...logs].slice(0, 50);
    this.saveLogs(updated);
  },

  // --- SETTINGS ---
  getSettings(): { threshold: number; showConfidence: boolean; awsEndpoint: string; locale: string } {
    const data = localStore.getItem(SETTINGS_KEY);
    const defaults = { threshold: 0.80, showConfidence: true, awsEndpoint: 'https://api.facegate.io/sync', locale: 'en' };
    if (!data) return defaults;
    try {
      return { ...defaults, ...JSON.parse(data) };
    } catch {
      return defaults;
    }
  },

  saveSettings(settings: { threshold: number; showConfidence: boolean; awsEndpoint: string; locale: string }): void {
    localStore.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  setLoggedInUser(user: User | null): void {
    if (user) {
      localStore.setItem('logged_in_user', JSON.stringify(user));
    } else {
      localStore.removeItem('logged_in_user');
    }
  },

  getLoggedInUser(): User | null {
    const data = localStore.getItem('logged_in_user');
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  // --- ATTENDANCE ---
  getAttendanceRecords(userId?: string): AttendanceRecord[] {
    const data = localStore.getItem(ATTENDANCE_KEY);
    let records: AttendanceRecord[] = [];
    if (!data) {
      const currentUser = storageService.getLoggedInUser();
      const targetUid = userId || currentUser?.id || '1';
      const targetName = currentUser?.name || 'Operator';
      
      const mockRecords: AttendanceRecord[] = [];
      const now = new Date();
      
      let count = 0;
      for (let i = 1; i <= 10; i++) {
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - i);
        if (pastDate.getDay() === 0) continue; // skip Sundays
        
        const year = pastDate.getFullYear();
        const month = String(pastDate.getMonth() + 1).padStart(2, '0');
        const day = String(pastDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const notes = [
          "Additional works (2VUPs, MR-10 junction flyover...)",
          "Standard shift check-in",
          "Main office check-in",
          "Project sync & alignment",
          "Site audit",
          "Standard shift",
          "Biometric checkpoint entry"
        ];
        
        let checkInVal: string | undefined = '09:30 AM';
        let checkOutVal: string | undefined = '06:30 PM';
        
        if (count === 1) {
          checkOutVal = undefined;
        } else if (count === 2) {
          checkInVal = undefined;
        }

        mockRecords.push({
          id: `att_mock_${i}`,
          userId: targetUid,
          userName: targetName,
          date: dateStr,
          checkIn: checkInVal,
          checkOut: checkOutVal,
          note: notes[count % notes.length]
        });
        
        count++;
        if (count >= 7) break;
      }
      
      storageService.saveAttendanceRecords(mockRecords);
      records = mockRecords;
    } else {
      try {
        records = JSON.parse(data);
        // Force re-seed if the records are mock but lack the check-in-only or check-out-only styles
        const isAllMock = records.length > 0 && records.every(r => r.id.startsWith('att_mock_'));
        const hasCheckInOnly = records.some(r => r.checkIn && !r.checkOut);
        const hasCheckOutOnly = records.some(r => !r.checkIn && r.checkOut);
        if (isAllMock && (!hasCheckInOnly || !hasCheckOutOnly)) {
          localStore.removeItem(ATTENDANCE_KEY);
          return this.getAttendanceRecords(userId);
        }
      } catch {
        records = [];
      }
    }
    
    if (userId) {
      return records.filter(r => r.userId === userId);
    }
    return records;
  },

  saveAttendanceRecords(records: AttendanceRecord[]): void {
    localStore.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  },

  logAttendance(userId: string, userName: string): AttendanceRecord {
    const records = storageService.getAttendanceRecords();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const existingIndex = records.findIndex(r => r.userId === userId && r.date === todayStr);
    
    const nowTimeStr = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    if (existingIndex > -1) {
      const record = records[existingIndex];
      record.checkOut = nowTimeStr;
      storageService.saveAttendanceRecords(records);
      return record;
    } else {
      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        userName,
        date: todayStr,
        checkIn: nowTimeStr,
        note: "Checked in via Biometric Scanner"
      };
      records.unshift(newRecord);
      storageService.saveAttendanceRecords(records);
      return newRecord;
    }
  },

  getAttendanceStats(userId: string) {
    const records = storageService.getAttendanceRecords(userId);
    const present = records.length;
    
    let totalMinutes = 0;
    let countsWithDuration = 0;
    
    records.forEach(r => {
      if (r.checkIn && r.checkOut) {
        try {
          const parseTime = (tStr: string) => {
            const [time, modifier] = tStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
          };
          const inMins = parseTime(r.checkIn);
          const outMins = parseTime(r.checkOut);
          if (outMins > inMins) {
            totalMinutes += (outMins - inMins);
            countsWithDuration++;
          }
        } catch {
          // fallback
        }
      }
    });
    
    let avgHoursStr = "8h 30m";
    if (countsWithDuration > 0) {
      const avgMins = Math.round(totalMinutes / countsWithDuration);
      const h = Math.floor(avgMins / 60);
      const m = avgMins % 60;
      avgHoursStr = `${h}h ${m}m`;
    }
    
    const percentage = present > 0 ? 97 : 0;
    
    return {
      present,
      absent: 0,
      avgHours: avgHoursStr,
      percentage
    };
  },

  // --- RESET ---
  purgeAll(): void {
    localStore.removeItem(USERS_KEY);
    localStore.removeItem(LOGS_KEY);
    localStore.removeItem(SETTINGS_KEY);
    localStore.removeItem(EMBEDDINGS_KEY);
    localStore.removeItem(AUTH_LOGS_KEY);
    localStore.removeItem(ATTENDANCE_KEY);
    localStore.removeItem('logged_in_user');
  }
};
