import { Platform } from 'react-native';
import { DetectionBox, LandmarkPoint } from '../types/face';
import { normalizeAlignedFacePerFace } from './alignment';

// TensorFlow.js dynamic loader for Tensor3D compatibility
let tf: any = null;
try {
  tf = require('@tensorflow/tfjs');
} catch {
  // Safe fallback
}

export interface FaceMeshResult {
  landmarks: Float32Array; // Flat 468 * 3 landmark coordinates
  leftEyeCenter: { x: number; y: number }; // Normalized 0-1 full frame
  rightEyeCenter: { x: number; y: number };
  noseTip: { x: number; y: number };
  mouthLeft: { x: number; y: number };
  mouthRight: { x: number; y: number };
  faceAngle: number; // In degrees
  faceSize: number; // Bounding box diagonal in px (scaled to 640x480)
  iscentered: boolean;
  livenessSignal: {
    earLeft: number;
    earRight: number;
    blinkDetected: boolean;
    smileDetected: boolean;
    headTurnDetected: boolean;
    headTurnLeftDetected: boolean;
    headTurnRightDetected: boolean;
  };
  alignedFaceTensor: any; // Tensor3D or compatible mock
}

// MediaPipe FaceMesh Landmark indices
const LEFT_EYE_INDICES_MP = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE_INDICES_MP = [33, 160, 158, 133, 153, 144];
const LEFT_CHEEK_IDX_MP = 234;
const RIGHT_CHEEK_IDX_MP = 454;
const FOREHEAD_IDX_MP = 10;
const CHIN_IDX_MP = 152;

// Web Dlib Landmark indices
const LEFT_EYE_INDICES_DLIB = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE_INDICES_DLIB = [42, 43, 44, 45, 46, 47];
const LEFT_CHEEK_IDX_DLIB = 2;
const RIGHT_CHEEK_IDX_DLIB = 14;
const FOREHEAD_IDX_DLIB = 27;
const CHIN_IDX_DLIB = 8;

const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export class FaceMeshModule {
  private neutralMouthWidth: number | null = null;
  private initialNoseCropX: number | null = null;
  private headTurnPassed = false;

  reset(): void {
    this.neutralMouthWidth = null;
    this.initialNoseCropX = null;
    this.headTurnPassed = false;
  }

  /**
   * Process a face's landmarks, evaluate liveness, and perform affine alignment.
   * @param rawMeshValues Flat Float32Array (native) or LandmarkPoint[] (web)
   * @param box Bounding box from detector (normalized 0-1)
   * @param imageRGB Full source image RGB byte array
   * @param srcWidth Source image width (e.g. 224 or 128)
   * @param srcHeight Source image height
   */
  process(
    rawMeshValues: Float32Array | LandmarkPoint[],
    box: DetectionBox,
    imageRGB: Uint8Array,
    srcWidth: number,
    srcHeight: number
  ): { result: FaceMeshResult; qualityPass: boolean; qualityMessage?: string } {
    const isMP = !(rawMeshValues instanceof Array);

    // 1. Reconstruct 468 landmark points
    const croppedLandmarks: LandmarkPoint[] = [];
    const fullLandmarks: LandmarkPoint[] = [];

    if (isMP) {
      const arr = rawMeshValues as Float32Array;
      const count = Math.min(arr.length / 3, 468);
      for (let i = 0; i < 468; i++) {
        if (i < count) {
          croppedLandmarks.push({
            x: arr[i * 3],
            y: arr[i * 3 + 1],
            z: arr[i * 3 + 2] ?? 0,
          });
        } else {
          croppedLandmarks.push({ x: 0.5, y: 0.5, z: 0 });
        }
      }
      for (const p of croppedLandmarks) {
        fullLandmarks.push({
          x: box.x + p.x * box.width,
          y: box.y + p.y * box.height,
          z: p.z,
        });
      }
    } else {
      // Web path: already normalized relative to full frame
      const list = rawMeshValues as LandmarkPoint[];
      for (let i = 0; i < 468; i++) {
        if (i < list.length) {
          const p = list[i];
          fullLandmarks.push(p);
          croppedLandmarks.push({
            x: box.width > 0 ? (p.x - box.x) / box.width : 0.5,
            y: box.height > 0 ? (p.y - box.y) / box.height : 0.5,
            z: p.z,
          });
        } else {
          // Pad to 468
          fullLandmarks.push({ x: 0.5, y: 0.5, z: 0 });
          croppedLandmarks.push({ x: 0.5, y: 0.5, z: 0 });
        }
      }
    }

    // Reconstruct flat 468 * 3 output array in full frame coordinates
    const outLandmarks = new Float32Array(468 * 3);
    for (let i = 0; i < 468; i++) {
      outLandmarks[i * 3] = fullLandmarks[i].x;
      outLandmarks[i * 3 + 1] = fullLandmarks[i].y;
      outLandmarks[i * 3 + 2] = fullLandmarks[i].z;
    }

    // Helper to average coordinate points in full landmarks list
    const getCenter = (indices: number[]) => {
      let sx = 0, sy = 0;
      for (const idx of indices) {
        if (fullLandmarks[idx]) {
          sx += fullLandmarks[idx].x;
          sy += fullLandmarks[idx].y;
        }
      }
      return { x: sx / indices.length, y: sy / indices.length };
    };

    // Index mappings
    const leftEyeIndices = isMP ? LEFT_EYE_INDICES_MP : LEFT_EYE_INDICES_DLIB;
    const rightEyeIndices = isMP ? RIGHT_EYE_INDICES_MP : RIGHT_EYE_INDICES_DLIB;
    const noseTipIdx = isMP ? 1 : 30;
    const mouthLeftIdx = isMP ? 61 : 48;
    const mouthRightIdx = isMP ? 291 : 54;
    const leftCheekIdx = isMP ? LEFT_CHEEK_IDX_MP : LEFT_CHEEK_IDX_DLIB;
    const rightCheekIdx = isMP ? RIGHT_CHEEK_IDX_MP : RIGHT_CHEEK_IDX_DLIB;
    const foreheadIdx = isMP ? FOREHEAD_IDX_MP : FOREHEAD_IDX_DLIB;
    const chinIdx = isMP ? CHIN_IDX_MP : CHIN_IDX_DLIB;

    // Extract key anchors in full frame normalized values
    const leftEyeCenter = getCenter(leftEyeIndices);
    const rightEyeCenter = getCenter(rightEyeIndices);
    const noseTip = fullLandmarks[noseTipIdx];
    const mouthLeft = fullLandmarks[mouthLeftIdx];
    const mouthRight = fullLandmarks[mouthRightIdx];
    const leftCheek = fullLandmarks[leftCheekIdx];
    const rightCheek = fullLandmarks[rightCheekIdx];
    const forehead = fullLandmarks[foreheadIdx];
    const chin = fullLandmarks[chinIdx];

    // 3. Compute face geometry on 640x480 coordinate space
    const lx = leftEyeCenter.x * 640;
    const ly = leftEyeCenter.y * 480;
    const rx = rightEyeCenter.x * 640;
    const ry = rightEyeCenter.y * 480;

    const eyeDistance = dist({ x: lx, y: ly }, { x: rx, y: ry });
    const faceWidth = dist(
      { x: leftCheek.x * 640, y: leftCheek.y * 480 },
      { x: rightCheek.x * 640, y: rightCheek.y * 480 }
    );
    const faceHeight = dist(
      { x: forehead.x * 640, y: forehead.y * 480 },
      { x: chin.x * 640, y: chin.y * 480 }
    );
    const aspectRatio = faceWidth > 0 ? faceHeight / faceWidth : 1.0;

    // Calculate bounding box diagonal in viewport pixels
    const boxPixelW = box.width * 640;
    const boxPixelH = box.height * 480;
    const faceSize = Math.sqrt(boxPixelW * boxPixelW + boxPixelH * boxPixelH);

    // Compute rotation angle (straight line relative to horizontal)
    const dy = ry - ly;
    const dx = rx - lx;
    const faceAngle = Math.atan2(dy, dx) * (180.0 / Math.PI);

    // 4. Face Presence Validation
    let qualityPass = true;
    let qualityMessage = '';

    // Centered check: always return true so that the user's face is processed anywhere in the frame
    const iscentered = true;

    if (box.score < 0.5) {
      qualityPass = false;
      qualityMessage = 'No clear face detected';
    } else if (faceSize < 30) {
      qualityPass = false;
      qualityMessage = 'Move closer';
    } else if (faceSize > 600) {
      qualityPass = false;
      qualityMessage = 'Move back';
    } else if (Math.abs(faceAngle) > 55) {
      qualityPass = false;
      qualityMessage = 'Keep head straight';
    }

    // 5. Calculate Eye Aspect Ratio (EAR) for blink detection
    const getEyeEAR = (pts: LandmarkPoint[], indices: number[]) => {
      const p1 = pts[indices[0]]; // inner
      const p2 = pts[indices[1]]; // top
      const p3 = pts[indices[2]]; // top
      const p4 = pts[indices[3]]; // outer
      const p5 = pts[indices[4]]; // bottom
      const p6 = pts[indices[5]]; // bottom

      if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;

      const v1 = dist(p2, p6);
      const v2 = dist(p3, p5);
      const h = dist(p1, p4);

      return (v1 + v2) / (2.0 * h || 1e-6);
    };

    const earLeft = getEyeEAR(croppedLandmarks, leftEyeIndices);
    const earRight = getEyeEAR(croppedLandmarks, rightEyeIndices);
    const avgEAR = (earLeft + earRight) / 2;
    const blinkDetected = avgEAR < 0.2;

    // Calculate Smile (Mouth corner distance normalized by eye distance to be scale-invariant)
    const mouthWidthPx = dist(
      { x: mouthLeft.x * 640, y: mouthLeft.y * 480 },
      { x: mouthRight.x * 640, y: mouthRight.y * 480 }
    );
    const normalizedMouthWidth = eyeDistance > 0 ? mouthWidthPx / eyeDistance : 0;

    if (this.neutralMouthWidth === null) {
      this.neutralMouthWidth = normalizedMouthWidth;
    } else {
      // Slowly adapt baseline to represent the neutral relaxed state
      if (normalizedMouthWidth < this.neutralMouthWidth) {
        this.neutralMouthWidth = normalizedMouthWidth;
      }
    }
    const smileDetected = this.neutralMouthWidth ? normalizedMouthWidth > this.neutralMouthWidth * 1.15 : false;

    // Calculate Head Turn (Nose x-coordinate shifts dynamically in the 192x192 crop space)
    const noseCropX = croppedLandmarks[noseTipIdx].x * 192;
    
    if (this.initialNoseCropX === null) {
      this.initialNoseCropX = noseCropX;
    }
    const noseShift = this.initialNoseCropX !== null ? noseCropX - this.initialNoseCropX : 0;
    const headTurnDiff = Math.abs(noseShift);
    if (headTurnDiff > 15) {
      this.headTurnPassed = true;
    }
    const headTurnDetected = this.headTurnPassed;
    const physicalLeft = (noseCropX - 96) < -12;
    const physicalRight = (noseCropX - 96) > 12;
    const dynamicLeft = this.initialNoseCropX !== null && noseShift < -15;
    const dynamicRight = this.initialNoseCropX !== null && noseShift > 15;
    
    // Front camera is mirrored, so:
    // - Turning your head to the left causes the nose to move to the right in the mirrored feed (x increases).
    // - Turning your head to the right causes the nose to move to the left in the mirrored feed (x decreases).
    const headTurnLeftDetected = physicalRight || dynamicRight;
    const headTurnRightDetected = physicalLeft || dynamicLeft;

    // 6. Apply Affine Warp to straighten and center the face, cropping to 112x112
    const alignedFaceBuffer = this.affineWarpAndCrop(
      imageRGB,
      srcWidth,
      srcHeight,
      leftEyeCenter,
      rightEyeCenter
    );

    // Normalize for MobileFaceNet using per-face normalisation (mean=0, std=1)
    const normalizedAligned = normalizeAlignedFacePerFace(alignedFaceBuffer);

    // Wrap in Tensor3D signature
    let alignedFaceTensor: any = null;
    if (tf) {
      try {
        alignedFaceTensor = tf.tensor3d(normalizedAligned, [112, 112, 3]);
      } catch {
        // Fallback
      }
    }

    if (!alignedFaceTensor) {
      // Standard compatible mock structure for offline TFJS environment compatibility
      alignedFaceTensor = {
        shape: [112, 112, 3],
        dataSync: () => normalizedAligned,
        data: async () => normalizedAligned,
        arraySync: () => {
          const arr = [];
          for (let y = 0; y < 112; y++) {
            const row = [];
            for (let x = 0; x < 112; x++) {
              const idx = (y * 112 + x) * 3;
              row.push([
                normalizedAligned[idx],
                normalizedAligned[idx + 1],
                normalizedAligned[idx + 2],
              ]);
            }
            arr.push(row);
          }
          return arr;
        },
        dispose: () => {},
        isMock: true,
      };
    }

    return {
      qualityPass,
      qualityMessage: qualityPass ? undefined : qualityMessage,
      result: {
        landmarks: outLandmarks,
        leftEyeCenter,
        rightEyeCenter,
        noseTip,
        mouthLeft,
        mouthRight,
        faceAngle,
        faceSize,
        iscentered,
        livenessSignal: {
          earLeft,
          earRight,
          blinkDetected,
          smileDetected,
          headTurnDetected,
          headTurnLeftDetected,
          headTurnRightDetected,
        },
        alignedFaceTensor,
      },
    };
  }

  /**
   * Affine warp using sub-pixel bilinear interpolation mapping.
   * Maps target pixels of 112x112 back to source coordinates.
   */
  private affineWarpAndCrop(
    imageRGB: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    leftEye: { x: number; y: number },
    rightEye: { x: number; y: number }
  ): Uint8Array {
    const outWidth = 112;
    const outHeight = 112;
    const aligned = new Uint8Array(outWidth * outHeight * 3);

    // Convert eye locations from normalized values to source pixels
    const lx = leftEye.x * srcWidth;
    const ly = leftEye.y * srcHeight;
    const rx = rightEye.x * srcWidth;
    const ry = rightEye.y * srcHeight;

    const dx = rx - lx;
    const dy = ry - ly;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;

    // Eyeline rotation angle
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Actual eye midpoint
    const mx = (lx + rx) / 2;
    const my = (ly + ry) / 2;

    // Desired eye centers in 112x112 target
    const targetMx = 56.0;
    const targetMy = 48.0;
    const targetDist = 44.8; // 112 * 0.40

    // Scaling ratio
    const scale = targetDist / dist;

    for (let y = 0; y < outHeight; y++) {
      for (let x = 0; x < outWidth; x++) {
        const tx = x - targetMx;
        const ty = y - targetMy;

        // Perform rotation + scaling inverse map
        const rxSrc = (tx * cos - ty * sin) / scale;
        const rySrc = (tx * sin + ty * cos) / scale;

        // Translate back to source midpoint
        const sx = mx + rxSrc;
        const sy = my + rySrc;

        // Bilinear interpolation bounds
        const x1 = Math.max(0, Math.min(srcWidth - 1, Math.floor(sx)));
        const x2 = Math.max(0, Math.min(srcWidth - 1, x1 + 1));
        const y1 = Math.max(0, Math.min(srcHeight - 1, Math.floor(sy)));
        const y2 = Math.max(0, Math.min(srcHeight - 1, y1 + 1));

        const wx = sx - x1;
        const wy = sy - y1;

        const idxOut = (y * outWidth + x) * 3;

        for (let c = 0; c < 3; c++) {
          const p11 = imageRGB[(y1 * srcWidth + x1) * 3 + c];
          const p12 = imageRGB[(y1 * srcWidth + x2) * 3 + c];
          const p21 = imageRGB[(y2 * srcWidth + x1) * 3 + c];
          const p22 = imageRGB[(y2 * srcWidth + x2) * 3 + c];

          const top = p11 * (1 - wx) + p12 * wx;
          const bottom = p21 * (1 - wx) + p22 * wx;

          aligned[idxOut + c] = Math.round(top * (1 - wy) + bottom * wy);
        }
      }
    }

    return aligned;
  }

  /**
   * Stricter quality assessment for registration only.
   * Returns whether this frame is good enough to use for enrollment.
   * These thresholds are tighter than the runtime auth checks.
   */
  static getRegistrationQuality(
    detection: { score: number; width: number; height: number },
    faceAngle: number,
    ear: number
  ): { pass: boolean; message?: string } {
    // Detection confidence must be reasonable
    if (detection.score < 0.7) {
      return { pass: false, message: 'Low detection confidence. Improve lighting.' };
    }
    // Face must fill enough of the frame for a good embedding
    const faceArea = detection.width * detection.height;
    if (faceArea < 0.06) {
      return { pass: false, message: 'Move closer so your face fills the frame.' };
    }
    // Face must be nearly straight (no extreme tilt)
    if (Math.abs(faceAngle) > 25) {
      return { pass: false, message: 'Keep your head straight and level.' };
    }
    // Must not be mid-blink (closed eyes produce bad embeddings)
    if (ear < 0.18) {
      return { pass: false, message: 'Keep your eyes open.' };
    }
    return { pass: true };
  }
}

export const faceMeshModule = new FaceMeshModule();
