import { LandmarkPoint } from '../types/face';

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const BLINK_THRESHOLD = 0.2;

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
  private blinkHistory: number[] = [];
  private closedFrames = 0;
  private openAfterClosed = false;
  private blinkConfirmed = false;

  update(ear: number): { blinkDetected: boolean; history: number[] } {
    this.blinkHistory.push(ear);
    if (this.blinkHistory.length > 10) this.blinkHistory.shift();

    if (ear < BLINK_THRESHOLD) {
      this.closedFrames += 1;
    } else if (this.closedFrames >= 2 && this.closedFrames <= 10 && ear > BLINK_THRESHOLD) {
      this.openAfterClosed = true;
      this.blinkConfirmed = true;
      this.closedFrames = 0;
    } else {
      this.closedFrames = 0;
    }

    return {
      blinkDetected: this.blinkConfirmed && this.openAfterClosed,
      history: [...this.blinkHistory],
    };
  }

  reset(): void {
    this.blinkHistory = [];
    this.closedFrames = 0;
    this.openAfterClosed = false;
    this.blinkConfirmed = false;
  }
}

export const isBlinking = (history: number[]): boolean => {
  let closed = 0;
  let opened = false;
  for (const ear of history) {
    if (ear < BLINK_THRESHOLD) closed += 1;
    if (closed >= 2 && closed <= 10 && ear > BLINK_THRESHOLD) opened = true;
  }
  return opened;
};
