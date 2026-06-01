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
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * Math.max(dist(p1, p4), 1e-6));
};

export const calcEAR = (points: LandmarkPoint[]): number => {
  return (eyeEAR(points, LEFT_EYE) + eyeEAR(points, RIGHT_EYE)) / 2;
};

export class LivenessChecker {
  private earHistory: number[] = [];
  private landmarkHistory: LandmarkPoint[][] = [];
  private embeddingHistory: Float32Array[] = [];
  
  // History windows
  private readonly earWindowSize = 15;
  private readonly landmarkWindowSize = 12;
  private readonly embeddingWindowSize = 6;

  private maxEAR = 0.0;
  private closedFrames = 0;
  private blinkConfirmed = false;

  // Web frame rate duplicate mitigation states
  private consecutiveDuplicates = 0;
  private readonly duplicateFreezeThreshold = 10;
  private lastResult: { livenessScore: number; livenessPass: boolean; isSpoof: boolean; blinkDetected: boolean } | null = null;

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

      // If either landmarks or embedding are pixel-for-pixel/value-for-value identical, it is a lag duplicate
      if (coordDiff === 0.0 || (embedding && embedDiff === 0.0)) {
        isDuplicate = true;
      }
    }

    if (isDuplicate) {
      this.consecutiveDuplicates++;
      if (this.consecutiveDuplicates >= this.duplicateFreezeThreshold) {
        // Exceeded tolerance threshold; classify as a frozen frame spoof attack
        const result = {
          livenessScore: 0.0,
          livenessPass: false,
          isSpoof: true,
          blinkDetected: false,
        };
        this.lastResult = result;
        return result;
      }
      // Return previous result or default if none exists yet
      return this.lastResult ?? {
        livenessScore: 0.5,
        livenessPass: false,
        isSpoof: false,
        blinkDetected: false,
      };
    }
    
    // Valid unique frame: reset consecutive duplicate counter
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

    // 2. Run blink authenticity checks
    if (ear > this.maxEAR) {
      this.maxEAR = ear;
    }

    if (this.maxEAR > 0.15) {
      const closedThreshold = this.maxEAR * 0.70; // 30% drop is closed
      const openThreshold = this.maxEAR * 0.85;   // 85% is open
      
      if (ear < closedThreshold) {
        this.closedFrames += 1;
      } else if (this.closedFrames >= 1 && this.closedFrames <= 10 && ear > openThreshold) {
        // Authentic blink profile transition: open -> closed -> open
        this.blinkConfirmed = true;
        this.closedFrames = 0;
        // Keep blink confirmed state active for 15 frames (~500ms) to allow recognition loop to catch it
        setTimeout(() => {
          this.blinkConfirmed = false;
        }, 600);
      } else if (ear > openThreshold) {
        this.closedFrames = 0;
      }
    }

    // 3. Anti-Spoofing: Static Photo Detection
    // Track standard deviation of core landmarks
    // Nose tip: Index 30 for Web dlib 68-points, Index 1 for Native MediaPipe 468-points
    let isStaticPhoto = false;
    let microMovementScore = 0.0;
    let stabilityScore = 0.0;

    if (this.landmarkHistory.length >= 5) {
      const noseIdx = landmarks.length === 68 ? 30 : 1;
      const noseHistory = this.landmarkHistory.map(lh => lh[noseIdx] ?? { x: 0.5, y: 0.5, z: 0 });
      const avgX = noseHistory.reduce((sum, p) => sum + p.x, 0) / noseHistory.length;
      const avgY = noseHistory.reduce((sum, p) => sum + p.y, 0) / noseHistory.length;
      
      const varianceX = noseHistory.reduce((sum, p) => sum + (p.x - avgX) ** 2, 0) / noseHistory.length;
      const varianceY = noseHistory.reduce((sum, p) => sum + (p.y - avgY) ** 2, 0) / noseHistory.length;
      
      const noseStdDev = Math.sqrt(varianceX + varianceY);

      // Real human face has tiny micro-movements: StdDev is in [0.0004, 0.025]
      if (noseStdDev < 0.0003) {
        isStaticPhoto = true; // No motion at all = static photo spoof
      } else if (noseStdDev <= 0.025) {
        microMovementScore = 1.0;
        stabilityScore = 1.0;
      } else {
        // Erratic fluctuation (likely shaky photo or alignment glitch)
        microMovementScore = 0.4;
        stabilityScore = 0.0;
      }
    }

    // 4. Anti-Spoofing: Replay & Zero-Noise Injection Rejection
    // Analyze embedding differences to detect frozen frames
    let isFrozenFrame = false;
    if (this.embeddingHistory.length >= 3) {
      let identicalPairs = 0;
      for (let i = 1; i < this.embeddingHistory.length; i++) {
        const prev = this.embeddingHistory[i - 1];
        const curr = this.embeddingHistory[i];
        
        let absDiff = 0;
        for (let j = 0; j < prev.length; j++) {
          absDiff += Math.abs(prev[j] - curr[j]);
        }
        
        // Real analog camera feeds have thermal sensor noise causing embedding variance
        if (absDiff === 0.0) {
          identicalPairs++;
        }
      }
      if (identicalPairs >= 2) {
        isFrozenFrame = true; // Perfect identical embeddings = video replay freeze / digital mock
      }
    }

    const isSpoof = isStaticPhoto || isFrozenFrame;

    // 5. Compute Unified Liveness Score
    let livenessScore = 0.0;
    if (isSpoof) {
      livenessScore = 0.0;
    } else {
      const blinkPart = this.blinkConfirmed ? 1.0 : 0.65; // Blinking adds high weight, but passive accepts natural presence
      livenessScore = 0.4 * blinkPart + 0.3 * microMovementScore + 0.3 * stabilityScore;
    }

    const livenessPass = !isSpoof && livenessScore >= 0.65;

    const result = {
      livenessScore,
      livenessPass,
      isSpoof,
      blinkDetected: this.blinkConfirmed,
    };
    this.lastResult = result;
    return result;
  }

  reset(): void {
    this.earHistory = [];
    this.landmarkHistory = [];
    this.embeddingHistory = [];
    this.maxEAR = 0.0;
    this.closedFrames = 0;
    this.blinkConfirmed = false;
    this.consecutiveDuplicates = 0;
    this.lastResult = null;
  }
}
