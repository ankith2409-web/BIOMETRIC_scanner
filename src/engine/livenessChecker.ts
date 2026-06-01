import { LandmarkPoint } from '../types/face';

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];

const dist = (a: LandmarkPoint, b: LandmarkPoint): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const eyeEAR = (points: LandmarkPoint[], idx: number[]): number => {
  const p1 = points[idx[0]];
  const p2 = points[idx[1]];
  const p3 = points[idx[2]];
  const p4 = points[idx[3]];
  const p5 = points[idx[4]];
  const p6 = points[idx[5]];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.28;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * Math.max(dist(p1, p4), 1e-6));
};

export const calcEAR = (points: LandmarkPoint[]): number => {
  return (eyeEAR(points, LEFT_EYE) + eyeEAR(points, RIGHT_EYE)) / 2;
};

const stdDev = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
};

const getPose = (landmarks: LandmarkPoint[]): { yaw: number; pitch: number; roll: number } => {
  const isMP = landmarks.length > 100;
  const noseTipIdx = isMP ? 1 : 30;
  const chinIdx = isMP ? 152 : 8;
  const leftCheekIdx = isMP ? 234 : 2;
  const rightCheekIdx = isMP ? 454 : 14;
  const topRefIdx = isMP ? 10 : 27;

  const left = landmarks[leftCheekIdx] ?? { x: 0.2, y: 0.5 };
  const right = landmarks[rightCheekIdx] ?? { x: 0.8, y: 0.5 };
  const nose = landmarks[noseTipIdx] ?? { x: 0.5, y: 0.5 };
  const top = landmarks[topRefIdx] ?? { x: 0.5, y: 0.2 };
  const chin = landmarks[chinIdx] ?? { x: 0.5, y: 0.8 };

  const dLeft = Math.sqrt((nose.x - left.x) ** 2 + (nose.y - left.y) ** 2);
  const dRight = Math.sqrt((nose.x - right.x) ** 2 + (nose.y - right.y) ** 2);
  const yawRatio = dLeft / (dLeft + dRight || 1e-6);
  const yaw = (yawRatio - 0.5) * 100;

  const dTop = Math.sqrt((nose.x - top.x) ** 2 + (nose.y - top.y) ** 2);
  const dChin = Math.sqrt((nose.x - chin.x) ** 2 + (nose.y - chin.y) ** 2);
  const pitchRatio = dTop / (dTop + dChin || 1e-6);
  const pitch = (pitchRatio - 0.45) * 100;

  const dy = right.y - left.y;
  const dx = right.x - left.x;
  const roll = Math.atan2(dy, dx) * (180.0 / Math.PI);

  return { yaw, pitch, roll };
};

export class LivenessChecker {
  private earHistory: number[] = [];
  private yawHistory: number[] = [];
  private pitchHistory: number[] = [];
  private rollHistory: number[] = [];
  private lastLandmarks: LandmarkPoint[] = [];
  
  // Lightweight history windows
  private readonly earWindowSize = 8;
  private readonly poseWindowSize = 5;

  private maxEAR = 0.0;
  private blinkActiveFrames = 0;

  // Camera freeze / Web lag state
  private consecutiveDuplicates = 0;
  private readonly duplicateFreezeThreshold = 10;
  private lastResult: { livenessScore: number; livenessPass: boolean; isSpoof: boolean; blinkDetected: boolean } | null = null;

  // Simplified telemetry fields for HUD parity
  private currentRigidityVariance = 0.05;
  private currentEmbeddingVariance = 0.05;
  private currentLandmarkMotionScore = 0.0;
  private currentRejectionReason = '';

  getConsecutiveDuplicatesCount(): number {
    return this.consecutiveDuplicates;
  }

  getRigidityVariance(): number {
    return this.currentRigidityVariance;
  }

  getEmbeddingVariance(): number {
    return this.currentEmbeddingVariance;
  }

  getLandmarkMotionScore(): number {
    return this.currentLandmarkMotionScore;
  }

  getRejectionReason(): string {
    return this.currentRejectionReason;
  }

  update(
    landmarks: LandmarkPoint[],
    ear: number,
    embedding?: Float32Array
  ): { livenessScore: number; livenessPass: boolean; isSpoof: boolean; blinkDetected: boolean } {
    
    // 0. Camera lag duplicate check
    let isDuplicate = false;
    if (this.lastLandmarks.length > 0 && landmarks.length > 0) {
      let diff = 0;
      const len = Math.min(landmarks.length, this.lastLandmarks.length);
      for (let i = 0; i < len; i++) {
        diff += Math.abs(landmarks[i].x - this.lastLandmarks[i].x) + Math.abs(landmarks[i].y - this.lastLandmarks[i].y);
      }
      if (diff === 0.0) {
        isDuplicate = true;
      }
    }

    if (isDuplicate) {
      this.consecutiveDuplicates++;
      if (this.consecutiveDuplicates >= this.duplicateFreezeThreshold) {
        this.currentRejectionReason = 'Frozen camera feed/lag spoof detected';
        const result = {
          livenessScore: 0.0,
          livenessPass: false,
          isSpoof: true,
          blinkDetected: false,
        };
        this.lastResult = result;
        return result;
      }
      return this.lastResult ?? {
        livenessScore: 0.5,
        livenessPass: false,
        isSpoof: false,
        blinkDetected: false,
      };
    }
    
    this.consecutiveDuplicates = 0;
    this.lastLandmarks = landmarks.map(p => ({ x: p.x, y: p.y, z: p.z }));

    // 1. Maintain sliding histories
    this.earHistory.push(ear);
    if (this.earHistory.length > this.earWindowSize) this.earHistory.shift();

    const pose = getPose(landmarks);
    this.yawHistory.push(pose.yaw);
    if (this.yawHistory.length > this.poseWindowSize) this.yawHistory.shift();
    this.pitchHistory.push(pose.pitch);
    if (this.pitchHistory.length > this.poseWindowSize) this.pitchHistory.shift();
    this.rollHistory.push(pose.roll);
    if (this.rollHistory.length > this.poseWindowSize) this.rollHistory.shift();

    // 2. Simple EAR blink detection
    if (ear > this.maxEAR) {
      this.maxEAR = ear;
    }
    
    if (this.maxEAR > 0.15) {
      const closedThreshold = this.maxEAR * 0.70;
      if (ear < closedThreshold || ear < 0.16) {
        this.blinkActiveFrames = 15; // Keep blink active for 15 frames (~500ms)
      }
    }

    if (this.blinkActiveFrames > 0) {
      this.blinkActiveFrames--;
    }

    // 3. Pose motion check (natural head tremor)
    const yawStd = stdDev(this.yawHistory);
    const pitchStd = stdDev(this.pitchHistory);
    const rollStd = stdDev(this.rollHistory);
    const totalPoseStd = yawStd + pitchStd + rollStd;

    const blinkDetected = this.blinkActiveFrames > 0;
    const poseMotionDetected = totalPoseStd >= 0.05 && this.yawHistory.length >= 3;

    // Liveness passes if EITHER a natural blink OR head motion is registered
    const livenessPass = blinkDetected || poseMotionDetected;
    const isSpoof = false; // We rely on the livenessPass check failing for static photos

    this.currentRigidityVariance = totalPoseStd; // Use pose variance for diagnostic telemetry
    this.currentEmbeddingVariance = yawStd;
    this.currentLandmarkMotionScore = pitchStd;
    
    if (!livenessPass) {
      this.currentRejectionReason = 'Liveness failed (no blink or natural head motion detected)';
    } else {
      this.currentRejectionReason = '';
    }

    // 4. Compute Unified Liveness Score (genuine, non-forced)
    const blinkScore = blinkDetected ? 1.0 : 0.0;
    const poseScore = Math.min(1.0, totalPoseStd / 1.0);
    const livenessScore = 0.5 * blinkScore + 0.5 * poseScore;

    const result = {
      livenessScore: Math.max(0.0, Math.min(1.0, livenessScore)),
      livenessPass,
      isSpoof,
      blinkDetected,
    };
    this.lastResult = result;
    return result;
  }

  reset(): void {
    this.earHistory = [];
    this.yawHistory = [];
    this.pitchHistory = [];
    this.rollHistory = [];
    this.lastLandmarks = [];
    this.maxEAR = 0.0;
    this.blinkActiveFrames = 0;
    this.consecutiveDuplicates = 0;
    this.lastResult = null;
    this.currentRigidityVariance = 0.05;
    this.currentEmbeddingVariance = 0.05;
    this.currentLandmarkMotionScore = 0.0;
    this.currentRejectionReason = '';
  }
}
