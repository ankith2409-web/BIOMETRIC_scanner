import { storageService } from '../../services/storageService';
import { sqliteService } from '../../services/sqliteService';
import { frameProcessorEngine } from './frameProcessor';

export interface BiometricResult {
  matched: boolean;
  userId?: string;
  name?: string;
  confidence: number;
  bestDist?: number;
  isSpoof?: boolean;
  error?: string;
}

/**
 * registerUser
 * Standard enrollment routine mapping names/IDs to embeddings centroid.
 */
export const registerUser = async (
  userId: string,
  name: string,
  phone: string,
  embeddings: Float32Array[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (embeddings.length === 0) {
      return { success: false, error: 'No embeddings provided' };
    }
    const registeredAt = new Date().toISOString();
    const centroid = embeddings[0]; // The validation centroid is stored at index 0

    storageService.saveUser({
      id: userId,
      phone,
      name,
      registeredAt: registeredAt.split('T')[0],
      status: 'active',
      descriptor: Array.from(centroid)
    });

    storageService.saveFaceEmbedding({
      userId,
      name,
      vector: centroid,
      registeredAt
    });

    for (let i = 1; i < embeddings.length; i++) {
      storageService.saveExtraFaceEmbedding(userId, embeddings[i]);
    }

    sqliteService.saveEmbedding(userId, name, centroid, registeredAt);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
};

/**
 * authenticateUser
 * Authenticates face frame and executes multi-embedding centroid distance checks.
 */
export const authenticateUser = async (
  frame: Uint8Array,
  gallery?: any[]
): Promise<BiometricResult> => {
  try {
    const result = await frameProcessorEngine.processForAuth(frame, gallery);
    return {
      matched: result.auth.matched,
      userId: result.auth.userId,
      name: result.auth.name,
      confidence: result.auth.confidence,
      bestDist: result.auth.bestDist,
      isSpoof: result.auth.isSpoof
    };
  } catch (e: any) {
    return { matched: false, confidence: 0, error: e.message || String(e) };
  }
};

/**
 * markAttendance
 * Log today's check-in/check-out session for verified user ID.
 */
export const markAttendance = async (
  userId: string,
  name: string
): Promise<{ success: boolean; record?: any; error?: string }> => {
  try {
    const record = storageService.logAttendance(userId, name);
    return { success: true, record };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
};

/**
 * getAttendanceLogs
 * Retrieve all local logs/records for verified user ID or all users.
 */
export const getAttendanceLogs = async (
  userId?: string
): Promise<{ success: boolean; logs: any[]; error?: string }> => {
  try {
    const logs = storageService.getAttendanceRecords(userId);
    return { success: true, logs };
  } catch (e: any) {
    return { success: false, logs: [], error: e.message || String(e) };
  }
};

/**
 * syncAttendance
 * Sync offline logs and purge SQLite buffers.
 */
export const syncAttendance = async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
  try {
    const initialRecords = storageService.getAttendanceRecords();
    await storageService.autoSyncIfOnline();
    const postSyncRecords = storageService.getAttendanceRecords();
    const syncedCount = Math.max(0, initialRecords.length - postSyncRecords.length);
    return { success: true, syncedCount };
  } catch (e: any) {
    return { success: false, syncedCount: 0, error: e.message || String(e) };
  }
};
