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

const getKeyPoints = (pts: LandmarkPoint[]): LandmarkPoint[] => {
  const isMP = pts.length > 100;
  const idxs = isMP 
    ? [33, 263, 1, 61, 291, 152] // left eye, right eye, nose, left mouth, right mouth, chin
    : [36, 45, 30, 48, 54, 8];
  return idxs.map(i => pts[i] ?? { x: 0.5, y: 0.5, z: 0 });
};

export class LivenessChecker {
  private earHistory: number[] = [];
  private landmarkHistory: LandmarkPoint[][] = [];
  private embeddingHistory: Float32Array[] = [];
  private yawHistory: number[] = [];
  private pitchHistory: number[] = [];
  private rollHistory: number[] = [];
  private boxCenterHistory: { x: number; y: number }[] = [];
  
  // History windows
  private readonly earWindowSize = 25;
  private readonly landmarkWindowSize = 15;
  private readonly embeddingWindowSize = 8;
  private readonly poseWindowSize = 15;
  private readonly boxWindowSize = 12;

  private maxEAR = 0.0;
  private closedFrames = 0;
  private blinkActiveFrames = 0;

  // Web frame rate duplicate mitigation states
  private consecutiveDuplicates = 0;
  private readonly duplicateFreezeThreshold = 10;
  private lastResult: { livenessScore: number; livenessPass: boolean; isSpoof: boolean; blinkDetected: boolean } | null = null;

  // Telemetry details exposed to frames processors
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
    
    // 0. Detect identical landmark sets or identical embeddings across consecutive frames (camera lag / canvas freeze)
    let isDuplicate = false;
    if (this.landmarkHistory.length > 0) {
      const lastLandmarks = this.landmarkHistory[this.landmarkHistory.length - 1];
      let coordDiff = 0;
      const compareLen = Math.min(landmarks.length, lastLandmarks.length);
      for (let i = 0; i < compareLen; i++) {
        coordDiff += Math.abs(landmarks[i].x - lastLandmarks[i].x) + Math.abs(landmarks[i].y - lastLandmarks[i].y);
      }
      
      let embedDiff = 0;
      if (embedding && this.embeddingHistory.length > 0) {
        const lastEmbedding = this.embeddingHistory[this.embeddingHistory.length - 1];
        const embLen = Math.min(embedding.length, lastEmbedding.length);
        for (let i = 0; i < embLen; i++) {
          embedDiff += Math.abs(embedding[i] - lastEmbedding[i]);
        }
      }

      if (coordDiff === 0.0 || (embedding && embedDiff === 0.0)) {
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

    // 1. Maintain sliding histories
    this.earHistory.push(ear);
    if (this.earHistory.length > this.earWindowSize) this.earHistory.shift();

    this.landmarkHistory.push(landmarks.map(p => ({ x: p.x, y: p.y, z: p.z })));
    if (this.landmarkHistory.length > this.landmarkWindowSize) this.landmarkHistory.shift();

    if (embedding) {
      this.embeddingHistory.push(new Float32Array(embedding));
      if (this.embeddingHistory.length > this.embeddingWindowSize) this.embeddingHistory.shift();
    }

    const pose = getPose(landmarks);
    this.yawHistory.push(pose.yaw);
    if (this.yawHistory.length > this.poseWindowSize) this.yawHistory.shift();
    this.pitchHistory.push(pose.pitch);
    if (this.pitchHistory.length > this.poseWindowSize) this.pitchHistory.shift();
    this.rollHistory.push(pose.roll);
    if (this.rollHistory.length > this.poseWindowSize) this.rollHistory.shift();

    // Box center history
    const xs = landmarks.map(p => p.x);
    const ys = landmarks.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    this.boxCenterHistory.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    if (this.boxCenterHistory.length > this.boxWindowSize) this.boxCenterHistory.shift();

    // 2. Passive blink verification using curve transition checks
    if (ear > this.maxEAR) {
      this.maxEAR = ear;
    }
    
    if (this.checkBlinkCurve()) {
      this.blinkActiveFrames = 15; // Set countdown window (~500ms at 30fps)
    }

    if (this.blinkActiveFrames > 0) {
      this.blinkActiveFrames--;
    }

    // 3. Static Photo Rigidity Rejection
    let rigidityVariance = 0.05;
    let isStaticPhoto = false;

    if (this.landmarkHistory.length >= 6) {
      const r1List: number[] = [];
      const r2List: number[] = [];
      const r3List: number[] = [];
      const r4List: number[] = [];

      for (const lh of this.landmarkHistory) {
        const kp = getKeyPoints(lh);
        const ple = kp[0];
        const pre = kp[1];
        const pnose = kp[2];
        const plm = kp[3];
        const prm = kp[4];
        const pchin = kp[5];

        const dLeNose = Math.sqrt((ple.x - pnose.x) ** 2 + (ple.y - pnose.y) ** 2);
        const dReNose = Math.sqrt((pre.x - pnose.x) ** 2 + (pre.y - pnose.y) ** 2);
        const dLmNose = Math.sqrt((plm.x - pnose.x) ** 2 + (plm.y - pnose.y) ** 2);
        const dRmNose = Math.sqrt((prm.x - pnose.x) ** 2 + (prm.y - pnose.y) ** 2);
        const dChinNose = Math.sqrt((pchin.x - pnose.x) ** 2 + (pchin.y - pnose.y) ** 2);

        r1List.push(dLeNose / (dReNose + 1e-6));
        r2List.push(dLmNose / (dRmNose + 1e-6));
        r3List.push(dChinNose / (dLeNose + 1e-6));
        r4List.push(dChinNose / (dLmNose + 1e-6));
      }

      const sd1 = stdDev(r1List);
      const sd2 = stdDev(r2List);
      const sd3 = stdDev(r3List);
      const sd4 = stdDev(r4List);

      rigidityVariance = (sd1 + sd2 + sd3 + sd4) / 4;
      this.currentRigidityVariance = rigidityVariance;
    }

    // Nose tip global motion analysis
    const noseIdx = landmarks.length === 68 ? 30 : 1;
    const noseHistory = this.landmarkHistory.map(lh => lh[noseIdx]);
    const globalMovement = stdDev(noseHistory.map(n => n.x)) + stdDev(noseHistory.map(n => n.y));
    this.currentLandmarkMotionScore = globalMovement;

    // Pose variance calculation
    const yawStd = stdDev(this.yawHistory);
    const pitchStd = stdDev(this.pitchHistory);
    const rollStd = stdDev(this.rollHistory);
    const totalPoseStd = yawStd + pitchStd + rollStd;

    // Rules for printed photo spoofing:
    // A printed photo has extremely low rigidity ratio variance (< 0.0012)
    // even when there is handheld motion (globalMovement > 0.0008).
    // Or if the head has zero pose variance at all (< 0.05).
    if (this.landmarkHistory.length >= 6) {
      if (rigidityVariance < 0.0012) {
        isStaticPhoto = true;
      }
      if (totalPoseStd < 0.05 && this.yawHistory.length >= 6) {
        isStaticPhoto = true;
      }
    }

    // 4. Digital Screen Replay detection (Zero sensor noise & Looping)
    let isFrozenEmbedding = false;
    let embeddingVariance = 0.05;

    if (this.embeddingHistory.length >= 3) {
      let diffSum = 0;
      for (let i = 1; i < this.embeddingHistory.length; i++) {
        const prev = this.embeddingHistory[i - 1];
        const curr = this.embeddingHistory[i];
        let diff = 0;
        for (let j = 0; j < prev.length; j++) {
          diff += Math.abs(prev[j] - curr[j]);
        }
        diffSum += diff / prev.length;
      }
      embeddingVariance = diffSum / (this.embeddingHistory.length - 1);
      this.currentEmbeddingVariance = embeddingVariance;

      if (embeddingVariance < 0.004) {
        isFrozenEmbedding = true;
      }
    }

    // Looping frame detection
    let isLooping = false;
    if (this.landmarkHistory.length >= 8) {
      const current = landmarks;
      const currNose = current[noseIdx];
      for (let i = 0; i < this.landmarkHistory.length - 3; i++) {
        const pastNose = this.landmarkHistory[i][noseIdx];
        if (pastNose) {
          const diff = Math.abs(currNose.x - pastNose.x) + Math.abs(currNose.y - pastNose.y);
          if (diff < 1e-6) {
            let matchCount = 0;
            const currentKp = getKeyPoints(current);
            const pastKp = getKeyPoints(this.landmarkHistory[i]);
            for (let j = 0; j < currentKp.length; j++) {
              const d = Math.abs(currentKp[j].x - pastKp[j].x) + Math.abs(currentKp[j].y - pastKp[j].y);
              if (d < 1e-6) matchCount++;
            }
            if (matchCount >= 5) {
              isLooping = true;
              break;
            }
          }
        }
      }
    }

    // Face-to-camera static box check
    let isStaticBox = false;
    if (this.boxCenterHistory.length >= 6) {
      const boxCenterXStd = stdDev(this.boxCenterHistory.map(b => b.x));
      const boxCenterYStd = stdDev(this.boxCenterHistory.map(b => b.y));
      if (boxCenterXStd + boxCenterYStd < 0.0001 && globalMovement > 0.0005) {
        // Face stays perfectly fixed in box while camera is shaking
        isStaticBox = true;
      }
    }

    const isSpoof = isStaticPhoto || isFrozenEmbedding || isLooping || isStaticBox;

    if (isSpoof) {
      if (isStaticPhoto) this.currentRejectionReason = 'Rigid printed photo / static image detected';
      else if (isFrozenEmbedding) this.currentRejectionReason = 'Zero noise replay injection detected';
      else if (isLooping) this.currentRejectionReason = 'Looping frame attack detected';
      else if (isStaticBox) this.currentRejectionReason = 'Static overlay spoof detected';
    } else {
      this.currentRejectionReason = '';
    }

    // 5. Compute Unified Liveness Score
    let livenessScore = 0.0;
    if (isSpoof) {
      livenessScore = 0.0;
    } else {
      // Natural human motion scores
      const blinkPart = this.blinkActiveFrames > 0 ? 1.0 : 0.65;
      const posePart = Math.min(1.0, Math.max(0.1, totalPoseStd / 3.0));
      const motionPart = Math.min(1.0, Math.max(0.1, rigidityVariance / 0.008));
      
      livenessScore = 0.3 * blinkPart + 0.35 * posePart + 0.35 * motionPart;
      livenessScore = Math.max(0.0, Math.min(1.0, livenessScore));
    }

    const livenessPass = !isSpoof && livenessScore >= 0.65;

    const result = {
      livenessScore,
      livenessPass,
      isSpoof,
      blinkDetected: this.blinkActiveFrames > 0,
    };
    this.lastResult = result;
    return result;
  }

  private checkBlinkCurve(): boolean {
    if (this.earHistory.length < 8) return false;
    
    let minIdx = -1;
    let minVal = 1.0;
    for (let i = 2; i < this.earHistory.length - 2; i++) {
      if (this.earHistory[i] < minVal) {
        minVal = this.earHistory[i];
        minIdx = i;
      }
    }
    
    if (minIdx === -1 || minVal > 0.16) return false;
    
    let maxBefore = 0;
    for (let i = 0; i < minIdx; i++) {
      if (this.earHistory[i] > maxBefore) maxBefore = this.earHistory[i];
    }
    
    let maxAfter = 0;
    for (let i = minIdx + 1; i < this.earHistory.length; i++) {
      if (this.earHistory[i] > maxAfter) maxAfter = this.earHistory[i];
    }
    
    if (maxBefore < 0.22 || maxAfter < 0.22) return false;
    if (minVal > maxBefore * 0.70 || minVal > maxAfter * 0.70) return false;
    
    const dropStep = Math.abs(this.earHistory[minIdx] - this.earHistory[minIdx - 1]);
    const riseStep = Math.abs(this.earHistory[minIdx + 1] - this.earHistory[minIdx]);
    
    if (dropStep > 0.20 || riseStep > 0.20) {
      return false;
    }
    
    return true;
  }

  reset(): void {
    this.earHistory = [];
    this.landmarkHistory = [];
    this.embeddingHistory = [];
    this.yawHistory = [];
    this.pitchHistory = [];
    this.rollHistory = [];
    this.boxCenterHistory = [];
    this.maxEAR = 0.0;
    this.closedFrames = 0;
    this.blinkActiveFrames = 0;
    this.consecutiveDuplicates = 0;
    this.lastResult = null;
    this.currentRigidityVariance = 0.05;
    this.currentEmbeddingVariance = 0.05;
    this.currentLandmarkMotionScore = 0.0;
    this.currentRejectionReason = '';
  }
}
