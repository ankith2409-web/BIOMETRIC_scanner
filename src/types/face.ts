export interface FaceEmbedding {
  userId: string;
  name: string;
  vector: Float32Array;
  registeredAt: string;
}

export interface AuthResult {
  matched: boolean;
  userId?: string;
  name?: string;
  confidence?: number;
  livenessPass: boolean;
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface FrameProcessResult {
  faceFound: boolean;
  qualityPass?: boolean;
  qualityMessage?: string;
  detection?: DetectionBox;
  landmarks?: LandmarkPoint[];
  ear?: number;
  livenessPass: boolean;
  embedding?: Float32Array;
  timing: Record<string, number>;
  leftEyeCenter?: { x: number; y: number };
  rightEyeCenter?: { x: number; y: number };
  noseTip?: { x: number; y: number };
  mouthLeft?: { x: number; y: number };
  mouthRight?: { x: number; y: number };
  faceAngle?: number;
  faceSize?: number;
  iscentered?: boolean;
  livenessSignal?: {
    earLeft: number;
    earRight: number;
    blinkDetected: boolean;
    smileDetected: boolean;
    headTurnDetected: boolean;
    headTurnLeftDetected: boolean;
    headTurnRightDetected: boolean;
  };
  alignedFaceTensor?: any;
  lightingScore?: number;
  lightingIssue?: 'too_dark' | 'too_bright' | 'shadow' | 'backlight' | null;
}
