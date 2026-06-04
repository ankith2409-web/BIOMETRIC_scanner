import { extractFivePointLandmarks, normalizeAlignedFace } from './alignment';
import { calcEAR, LivenessChecker } from './livenessChecker';
import { modelLoader } from './modelLoader';
import { FaceEmbedding, FrameProcessResult, LandmarkPoint, DetectionBox } from '../types/face';
import { matchEmbedding } from './matcher';
import { faceMeshModule } from './faceMeshModule';
import { antiSpoofingModule } from './antiSpoofingModule';
import { mtcnnModule } from './mtcnnModule';
import { storageService } from '../../services/storageService';
import {
  applyWhiteBalance,
  applyCLAHE,
  realTimeQualityCheckAndEnhance,
  getLightingScore,
  applyGammaCorrection,
} from './imagePreprocessing';

const toMs = (start: number): number => Date.now() - start;

class FrameProcessorEngine {
  private liveness = new LivenessChecker();
  // Lowered from 0.5 → 0.40: catches faces in shadow or partial occlusion.
  private readonly detectScoreThreshold = 0.40;
  private lastBox: DetectionBox | null = null;
  private temporalHistory: { userId: string; distance: number; name: string }[] = [];
  private readonly HISTORY_DEPTH = 2;

  resetLiveness(): void {
    this.liveness.reset();
    faceMeshModule.reset();
    this.lastBox = null;
    this.temporalHistory = [];
  }

  private computeIoU(boxA: DetectionBox, boxB: DetectionBox): number {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
    const yB = Math.min(boxA.y + boxB.height, boxB.y + boxB.height);

    const interWidth = Math.max(0, xB - xA);
    const interHeight = Math.max(0, yB - yA);
    const interArea = interWidth * interHeight;

    const areaA = boxA.width * boxA.height;
    const areaB = boxB.width * boxB.height;
    const unionArea = areaA + areaB - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  private computeImageQualityConfidence(
    detection: DetectionBox,
    lightingScore: number,
    blurScore: number,
    faceAngle: number
  ): number {
    const lightingQuality = lightingScore / 100;
    const sharpnessQuality = Math.max(0, Math.min(1, (blurScore - 8) / 8));
    const cx = detection.x + detection.width / 2;
    const cy = detection.y + detection.height / 2;
    const distFromCenter = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
    const centeringQuality = Math.max(0, Math.min(1, 1 - (distFromCenter - 0.1) / 0.2));
    const poseQuality = Math.max(0, Math.min(1, 1 - (Math.abs(faceAngle) - 10) / 20));
    let sizeQuality = 1.0;
    if (detection.width < 0.30) {
      sizeQuality = Math.max(0, (detection.width - 0.20) / 0.10);
    } else if (detection.width > 0.60) {
      sizeQuality = Math.max(0, 1 - (detection.width - 0.60) / 0.20);
    }
    const occlusionQuality = Math.max(0, Math.min(1, (detection.score - 0.40) / 0.60));

    const qualityConfidence =
      0.25 * lightingQuality +
      0.25 * sharpnessQuality +
      0.20 * centeringQuality +
      0.20 * poseQuality +
      0.10 * occlusionQuality;

    return Math.max(0, Math.min(1, qualityConfidence));
  }

  private parseAllDetections(raw: unknown): DetectionBox[] {
    const values = this.extractFloatArray(raw);
    if (!values || values.length < 5) return [];

    const detections: DetectionBox[] = [];
    const stride = 5;
    const numDetections = Math.floor(values.length / stride);

    for (let i = 0; i < numDetections; i++) {
      const offset = i * stride;
      const ymin = values[offset];
      const xmin = values[offset + 1];
      const ymax = values[offset + 2];
      const xmax = values[offset + 3];
      const score = values[offset + 4];

      if (score >= this.detectScoreThreshold) {
        const x = this.clamp01(xmin);
        const y = this.clamp01(ymin);
        const width = this.clamp01(xmax - xmin);
        const height = this.clamp01(ymax - ymin);

        if (width > 0.05 && height > 0.05) {
          detections.push({ x, y, width, height, score });
        }
      }
    }

    return detections;
  }

  private floatArrayToPoints(arr: Float32Array): LandmarkPoint[] {
    const points: LandmarkPoint[] = [];
    const count = arr.length / 3;
    for (let i = 0; i < count; i++) {
      points.push({
        x: arr[i * 3],
        y: arr[i * 3 + 1],
        z: arr[i * 3 + 2] ?? 0,
      });
    }
    return points;
  }

  // Mobile-native path. Input is expected to be RGB planes from VisionCamera plugin.
  // mode parameter accepted for API compatibility with web variant but unused on native.
  async processForEmbedding(frameRGB: Uint8Array, log?: (msg: string) => void, _mode?: 'register' | 'auth'): Promise<FrameProcessResult> {
    const models = await modelLoader.loadAll();
    const timing: Record<string, number> = {};

    // Preprocessing Pipeline:
    // 1. White balance (Gray World)
    const wbFrame = applyWhiteBalance(frameRGB);

    // Calculate average luma to see if we need to reduce light
    let sumLuma = 0;
    const totalPixels = wbFrame.length / 3;
    for (let i = 0; i < wbFrame.length; i += 12) {
      sumLuma += 0.299 * wbFrame[i] + 0.587 * wbFrame[i + 1] + 0.114 * wbFrame[i + 2];
    }
    const avgLuma = sumLuma / (totalPixels / 4);

    let processedFrame = wbFrame;
    if (avgLuma > 200) {
      processedFrame = applyGammaCorrection(wbFrame, 0.6);
      log?.(`[processor] Very bright native frame (avgLuma=${avgLuma.toFixed(1)}), applying gamma 0.6`);
    } else if (avgLuma > 150) {
      processedFrame = applyGammaCorrection(wbFrame, 0.8);
      log?.(`[processor] Bright native frame (avgLuma=${avgLuma.toFixed(1)}), applying gamma 0.8`);
    } else if (avgLuma < 80) {
      processedFrame = applyGammaCorrection(wbFrame, 1.4);
      log?.(`[processor] Dark native frame (avgLuma=${avgLuma.toFixed(1)}), applying gamma 1.4`);
    }

    // 2. CLAHE (Adaptive Histogram Equalization)
    const enhanced = applyCLAHE(processedFrame, 128, 128, 2.0, [8, 8]);

    const t0 = Date.now();
    // Try MTCNN first for high-precision detection
    let detections = await mtcnnModule.detect(enhanced, 128, 128);

    // Fallback to BlazeFace if MTCNN finds nothing
    if (!detections.length) {
      const detectOut = await models.blazeFace.run(enhanced);
      detections = this.parseAllDetections(detectOut);
    }
    timing.detect = toMs(t0);
    if (!detections.length) {
      return { faceFound: false, livenessPass: false, timing };
    }

    const multipleFaces = detections.length > 1;
    let multipleFacesWarning: string | undefined = undefined;
    if (multipleFaces) {
      multipleFacesWarning = "Multiple faces detected, please ensure only one face is in frame";
    }

    // Sort by area (largest first)
    const sorted = [...detections].sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      return areaB - areaA;
    });

    const detection = sorted[0];

    // Crop face bounding box with 20% padding
    const padX = detection.width * 0.20;
    const padY = detection.height * 0.20;
    const paddedDetection = {
      x: Math.max(0, detection.x - padX),
      y: Math.max(0, detection.y - padY),
      width: Math.min(1.0 - Math.max(0, detection.x - padX), detection.width + 2 * padX),
      height: Math.min(1.0 - Math.max(0, detection.y - padY), detection.height + 2 * padY),
      score: detection.score,
    };

    const t1 = Date.now();
    // Crop face using padded coordinates
    const cropped192 = this.cropAndResize(enhanced, 128, 128, paddedDetection, 192, 192);
    // Real-time quality check and dynamic enhancement on face crop
    const finalFaceCrop = realTimeQualityCheckAndEnhance(cropped192, 192, 192);

    // Model-based anti-spoofing check
    const antiSpoofResult = await antiSpoofingModule.check(finalFaceCrop, 192, 192);

    const meshOut = await models.faceMesh.run(finalFaceCrop);
    timing.mesh = toMs(t1);

    const rawMesh = this.extractFloatArray(meshOut);
    if (!rawMesh || rawMesh.length < 100) {
      return { faceFound: true, detection, livenessPass: false, qualityPass: true, timing };
    }

    // Call FaceMeshModule
    const meshResult = faceMeshModule.process(rawMesh, detection, enhanced, 128, 128);

    // Calculate lighting quality score
    const lighting = getLightingScore(cropped192, processedFrame);

    let finalQualityPass = meshResult.qualityPass;
    let finalQualityMessage = meshResult.qualityMessage;

    if (multipleFacesWarning) {
      finalQualityPass = false;
      finalQualityMessage = multipleFacesWarning;
    }

    if (lighting.score < 60) {
      finalQualityPass = false;
      const getLightingMessage = (issue: string | null) => {
        if (issue === 'too_dark') return "Too dark, move to better light";
        if (issue === 'too_bright') return "Too bright, avoid direct sunlight";
        if (issue === 'shadow') return "Shadow detected, adjust position";
        if (issue === 'backlight') return "Avoid light source behind you";
        return "Poor lighting quality";
      };
      finalQualityMessage = getLightingMessage(lighting.issue);
    }

    const landmarks = this.floatArrayToPoints(meshResult.result.landmarks);
    const ear = (meshResult.result.livenessSignal.earLeft + meshResult.result.livenessSignal.earRight) / 2;

    const luma = new Float32Array(cropped192.length / 3);
    for (let i = 0, j = 0; i < cropped192.length; i += 3, j += 1) {
      luma[j] = 0.299 * cropped192[i] + 0.587 * cropped192[i + 1] + 0.114 * cropped192[i + 2];
    }
    const blurScore = this.computeSharpness(luma, 192, 192);

    const qualityConfidence = this.computeImageQualityConfidence(
      detection,
      lighting.score,
      blurScore,
      meshResult.result.faceAngle
    );

    const t3 = Date.now();
    const alignedNormalizedFloatArray = meshResult.result.alignedFaceTensor.dataSync();
    const embeddingOut = await models.mobileFaceNetFull.run(alignedNormalizedFloatArray);
    const embedding = this.parseEmbedding(embeddingOut);
    timing.embed = toMs(t3);
    timing.total = toMs(t0);

    const livenessResult = this.liveness.update(landmarks, ear, embedding);
    const sig = {
      ...meshResult.result.livenessSignal,
      blinkDetected: livenessResult.blinkDetected,
    };

    return {
      faceFound: true,
      detection,
      landmarks,
      ear,
      livenessPass: livenessResult.livenessPass,
      qualityPass: finalQualityPass,
      qualityMessage: finalQualityMessage,
      embedding,
      timing,
      leftEyeCenter: meshResult.result.leftEyeCenter,
      rightEyeCenter: meshResult.result.rightEyeCenter,
      noseTip: meshResult.result.noseTip,
      mouthLeft: meshResult.result.mouthLeft,
      mouthRight: meshResult.result.mouthRight,
      faceAngle: meshResult.result.faceAngle,
      faceSize: meshResult.result.faceSize,
      iscentered: meshResult.result.iscentered,
      livenessSignal: sig,
      alignedFaceTensor: meshResult.result.alignedFaceTensor,
      lightingScore: lighting.score,
      lightingIssue: lighting.issue,
      livenessScore: livenessResult.livenessScore,
      isSpoof: antiSpoofResult.isSpoof || livenessResult.isSpoof,
      qualityConfidence,
    };
  }

  async processForAuth(frameRGB: Uint8Array, gallery?: any[], log?: (msg: string) => void) {
    const result = await this.processForEmbedding(frameRGB, log);
    if (!result.faceFound || !result.detection || !result.embedding) {
      this.resetLiveness();
      this.lastBox = null;
      this.temporalHistory = [];
      return {
        auth: {
          matched: false,
          userId: undefined,
          name: undefined,
          confidence: 0,
          livenessPass: false,
          gapPass: false,
          recogConfidence: 0,
          livenessConfidence: 0,
          qualityConfidence: 0,
          temporalConfidence: 0,
          gapConfidence: 0,
          bestDist: 1.0,
          runnerUpDist: 1.0,
          gap: 0,
          isSpoof: false,
          historySize: 0,
        },
        process: result,
      };
    }

    const currentBox = result.detection;
    if (this.lastBox) {
      const iou = this.computeIoU(this.lastBox, currentBox);
      if (iou < 0.30) {
        log?.(`[processor] Face switch detected (IoU=${iou.toFixed(2)} < 0.30). Resetting temporal state.`);
        this.resetLiveness();
        this.temporalHistory = [];
      }
    }
    this.lastBox = currentBox;

    const fullGallery = gallery && gallery.length ? gallery : storageService.getFaceEmbeddingsAsGallery();
    const threshold = storageService.getSettings().threshold;
    const confidenceGapMargin = 0.08;

    const match = matchEmbedding(result.embedding, fullGallery, threshold, confidenceGapMargin);
    
    // Add current match to temporal history
    const matchedUserId = match.userId || 'unknown';
    const matchedName = match.name || 'Unknown User';
    this.temporalHistory.push({
      userId: matchedUserId,
      distance: match.bestDist,
      name: matchedName,
    });
    if (this.temporalHistory.length > this.HISTORY_DEPTH) {
      this.temporalHistory.shift();
    }

    const sameUserCount = this.temporalHistory.filter(h => h.userId === matchedUserId).length;
    const temporalConfidence = sameUserCount / this.HISTORY_DEPTH;
    const temporalConsistencyPass = sameUserCount === this.HISTORY_DEPTH && matchedUserId !== 'unknown';

    const avgDistance = this.temporalHistory.reduce((sum, h) => sum + h.distance, 0) / this.temporalHistory.length;

    const livenessConfidence = result.livenessScore ?? 0.0;
    const isSpoof = result.isSpoof ?? false;
    const livenessPass = result.livenessPass ?? false;
    const qualityConfidence = result.qualityConfidence ?? 0.0;
    const recogConfidence = match.recognitionConfidence;
    const gapConfidence = match.gapConfidence;
    const gapPass = match.gapPass;

    // Weights
    const w_rec = 0.35;
    const w_live = 0.25;
    const w_qual = 0.15;
    const w_temp = 0.15;
    const w_gap = 0.10;

    const finalConfidence =
      w_rec * recogConfidence +
      w_live * livenessConfidence +
      w_qual * qualityConfidence +
      w_temp * temporalConfidence +
      w_gap * gapConfidence;

    // Strict multi-factor authentication validation policy
    const finalMatched =
      !isSpoof &&
      avgDistance <= threshold &&
      gapPass &&
      livenessPass &&
      temporalConsistencyPass &&
      result.qualityPass === true &&
      finalConfidence >= 0.85;

    // Rejection diagnostics tracking
    let rejectionReason = '';
    if (isSpoof) {
      rejectionReason = this.liveness.getRejectionReason() || 'Anti-spoofing verification failed.';
    } else if (avgDistance > threshold) {
      rejectionReason = 'Identity could not be verified. Face not recognized in local database.';
    } else if (finalConfidence < 0.85) {
      rejectionReason = `Face match confidence score is too low (${Math.round(finalConfidence * 100)}%). Face not recognized. Please try again.`;
    } else if (!livenessPass) {
      rejectionReason = 'Liveness verification failed. Hold still and look naturally at the camera.';
    } else if (!temporalConsistencyPass) {
      rejectionReason = 'Temporal identity consistency failed. Keep face steady in frame.';
    } else if (!gapPass) {
      rejectionReason = 'Confidence gap validation failed (ambiguous candidate).';
    } else if (result.qualityPass === false) {
      rejectionReason = result.qualityMessage ?? 'Poor image quality. Adjust your lighting.';
    }

    console.log(`[FaceGate][Auth] Telemetry:
      Candidate ID: ${matchedUserId} (${matchedName})
      Avg Distance: ${avgDistance.toFixed(4)} (current: ${match.bestDist.toFixed(4)})
      Runner-up Dist: ${match.runnerUpDist.toFixed(4)}
      Confidence Gap: ${match.gap.toFixed(4)}
      Is Spoof: ${isSpoof}
      Liveness Pass: ${livenessPass}
      Temporal Pass: ${temporalConsistencyPass} (History size: ${this.temporalHistory.length}/${this.HISTORY_DEPTH})
      
      Confidence Components:
        - Recognition: ${(recogConfidence * 100).toFixed(1)}% (weight: ${w_rec})
        - Liveness: ${(livenessConfidence * 100).toFixed(1)}% (weight: ${w_live})
        - Image Quality: ${(qualityConfidence * 100).toFixed(1)}% (weight: ${w_qual})
        - Temporal: ${(temporalConfidence * 100).toFixed(1)}% (weight: ${w_temp})
        - Gap: ${(gapConfidence * 100).toFixed(1)}% (weight: ${w_gap})
      Final Aggregated Confidence: ${(finalConfidence * 100).toFixed(1)}%
      Auth Result: ${finalMatched ? 'SUCCESS' : 'FAILED'} (Reason: ${rejectionReason || 'none'})
    `);

    return {
      auth: {
        matched: finalMatched,
        userId: finalMatched ? matchedUserId : undefined,
        name: finalMatched ? matchedName : undefined,
        confidence: finalConfidence,
        livenessPass,
        gapPass,
        
        // Sub-scores
        recogConfidence,
        livenessConfidence,
        qualityConfidence,
        temporalConfidence,
        gapConfidence,
        
        // Telemetry details
        bestDist: match.bestDist,
        runnerUpDist: match.runnerUpDist,
        gap: match.gap,
        isSpoof,
        historySize: this.temporalHistory.length,
        duplicateFrameCount: this.liveness.getConsecutiveDuplicatesCount(),
        landmarkMotionScore: this.liveness.getLandmarkMotionScore(),
        embeddingVarianceScore: this.liveness.getEmbeddingVariance(),
        rejectionReason,
        authLatencyMs: result.timing?.total ?? 0,
      },
      process: result,
    };
  }

  private parseDetection(raw: unknown) {
    const values = this.extractFloatArray(raw);
    if (!values || values.length < 5) return null;

    // Common BlazeFace layout: [ymin, xmin, ymax, xmax, score]
    const ymin = values[0];
    const xmin = values[1];
    const ymax = values[2];
    const xmax = values[3];
    const score = values[4];

    if (score < this.detectScoreThreshold) return null;

    const x = this.clamp01(xmin);
    const y = this.clamp01(ymin);
    const width = this.clamp01(xmax - xmin);
    const height = this.clamp01(ymax - ymin);

    if (width <= 0.05 || height <= 0.05) return null;
    return { x, y, width, height, score };
  }

  private parseLandmarks(raw: unknown): LandmarkPoint[] {
    const values = this.extractFloatArray(raw);
    if (!values) return [];

    // FaceMesh expected 468 * 3 values.
    const count = Math.floor(values.length / 3);
    if (count < 100) return [];

    const points: LandmarkPoint[] = [];
    for (let i = 0; i < Math.min(count, 468); i += 1) {
      const x = this.clamp01(values[i * 3]);
      const y = this.clamp01(values[i * 3 + 1]);
      const z = values[i * 3 + 2] ?? 0;
      points.push({ x, y, z });
    }
    return points;
  }

  private parseEmbedding(raw: unknown): Float32Array {
    const values = this.extractFloatArray(raw);
    if (!values || values.length < 128) return new Float32Array(128);
    const out = new Float32Array(128);
    out.set(values.slice(0, 128));
    return this.l2Normalize(out);
  }

  private cropAndResize(
    source: Uint8Array,
    sourceWidth: number,
    sourceHeight: number,
    box: { x: number; y: number; width: number; height: number },
    outWidth: number,
    outHeight: number
  ): Uint8Array {
    const out = new Uint8Array(outWidth * outHeight * 3);
    const x0 = box.x * sourceWidth;
    const y0 = box.y * sourceHeight;
    const bw = Math.max(box.width * sourceWidth, 1);
    const bh = Math.max(box.height * sourceHeight, 1);

    for (let oy = 0; oy < outHeight; oy += 1) {
      const sy = y0 + (oy / Math.max(outHeight - 1, 1)) * bh;
      const y1 = Math.max(0, Math.min(sourceHeight - 1, Math.floor(sy)));
      const y2 = Math.max(0, Math.min(sourceHeight - 1, y1 + 1));
      const wy = sy - y1;

      for (let ox = 0; ox < outWidth; ox += 1) {
        const sx = x0 + (ox / Math.max(outWidth - 1, 1)) * bw;
        const x1 = Math.max(0, Math.min(sourceWidth - 1, Math.floor(sx)));
        const x2 = Math.max(0, Math.min(sourceWidth - 1, x1 + 1));
        const wx = sx - x1;

        const dst = (oy * outWidth + ox) * 3;
        for (let c = 0; c < 3; c += 1) {
          const p11 = source[(y1 * sourceWidth + x1) * 3 + c];
          const p12 = source[(y1 * sourceWidth + x2) * 3 + c];
          const p21 = source[(y2 * sourceWidth + x1) * 3 + c];
          const p22 = source[(y2 * sourceWidth + x2) * 3 + c];
          const top = p11 * (1 - wx) + p12 * wx;
          const bottom = p21 * (1 - wx) + p22 * wx;
          out[dst + c] = Math.round(top * (1 - wy) + bottom * wy);
        }
      }
    }

    return out;
  }

  private extractFloatArray(raw: unknown): Float32Array | null {
    if (!raw) return null;
    if (raw instanceof Float32Array) return raw;
    if (Array.isArray(raw) && raw.length > 0) {
      if (typeof raw[0] === 'number') return Float32Array.from(raw as number[]);
      const nested = raw.find((v) => Array.isArray(v) || v instanceof Float32Array);
      if (nested instanceof Float32Array) return nested;
      if (Array.isArray(nested)) return Float32Array.from(nested as number[]);
    }
    if (typeof raw === 'object') {
      const candidate = (raw as Record<string, unknown>).output
        ?? (raw as Record<string, unknown>).outputs
        ?? (raw as Record<string, unknown>).data;
      return this.extractFloatArray(candidate);
    }
    return null;
  }

  // Build a 256-entry lookup table that bakes in shadow lift, highlight
  // compression, and gamma correction into a single array-index lookup per pixel.
  private buildEnhanceLUT(gamma: number): Uint8Array {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      // Highlight compression for harsh direct sunlight.
      v = v > 210 ? 210 + (v - 210) * 0.35 : v;
      // Shadow lift for partial face shadows.
      v = v < 60 ? v * 1.25 + 8 : v;
      // Gamma correction and clamp
      const norm = Math.max(0, Math.min(1, v / 255));
      lut[i] = Math.round(Math.pow(norm, gamma) * 255);
    }
    return lut;
  }

  // Lighting normalization tuned for outdoor harsh sunlight and deep shadows.
  // 1) gray-world white-balance, 2) adaptive gamma via LUT, 3) shadow lift + highlight compression.
  private enhanceForHarshLighting(input: Uint8Array): Uint8Array {
    if (input.length === 0) return input;
    const out = new Uint8Array(input.length);

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let lumSum = 0;
    const pixels = input.length / 3;

    for (let i = 0; i < input.length; i += 3) {
      const r = input[i];
      const g = input[i + 1];
      const b = input[i + 2];
      sumR += r;
      sumG += g;
      sumB += b;
      lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const meanR = sumR / pixels;
    const meanG = sumG / pixels;
    const meanB = sumB / pixels;
    const meanLum = lumSum / pixels;
    const gray = (meanR + meanG + meanB) / 3;
    const gainR = gray / Math.max(meanR, 1);
    const gainG = gray / Math.max(meanG, 1);
    const gainB = gray / Math.max(meanB, 1);

    // Dark frame -> gamma < 1 to brighten shadows, bright frame -> gamma > 1 to protect highlights.
    const gamma = meanLum < 95 ? 0.78 : meanLum > 165 ? 1.18 : 1.0;

    // Pre-compute LUT once per frame — replaces per-pixel Math.pow() calls.
    const lut = this.buildEnhanceLUT(gamma);

    for (let i = 0; i < input.length; i += 3) {
      // Apply white-balance gain, clamp to 0-255, then use LUT for
      // shadow lift + highlight compression + gamma in a single lookup.
      out[i]     = lut[Math.max(0, Math.min(255, Math.round(input[i] * gainR)))];
      out[i + 1] = lut[Math.max(0, Math.min(255, Math.round(input[i + 1] * gainG)))];
      out[i + 2] = lut[Math.max(0, Math.min(255, Math.round(input[i + 2] * gainB)))];
    }

    return out;
  }

  private evaluateQuality(
    frame: Uint8Array,
    detection: { x: number; y: number; width: number; height: number }
  ): { pass: boolean; message?: string } {
    if (detection.width < 0.26 || detection.height < 0.26) {
      return { pass: false, message: 'Move closer so your face fills the oval.' };
    }
    if (
      detection.x < 0.05 ||
      detection.y < 0.05 ||
      detection.x + detection.width > 0.95 ||
      detection.y + detection.height > 0.95
    ) {
      return { pass: false, message: 'Center your face inside the oval guide.' };
    }

    const luma = new Float32Array(frame.length / 3);
    let sum = 0;
    let highlights = 0;
    let shadows = 0;
    for (let i = 0, j = 0; i < frame.length; i += 3, j += 1) {
      const y = 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
      luma[j] = y;
      sum += y;
      if (y > 235) highlights += 1;
      if (y < 30) shadows += 1;
    }

    const mean = sum / luma.length;
    if (mean < 55) return { pass: false, message: 'Too dark. Face a brighter light source.' };
    if (mean > 205) return { pass: false, message: 'Too bright. Avoid direct sunlight on face.' };

    const highlightRatio = highlights / luma.length;
    const shadowRatio = shadows / luma.length;
    if (highlightRatio > 0.2) {
      return { pass: false, message: 'Harsh sunlight detected. Step into softer light.' };
    }
    if (shadowRatio > 0.25) {
      return { pass: false, message: 'Heavy shadow detected. Turn toward even lighting.' };
    }

    const blurScore = this.computeSharpness(luma, 128, 128);
    if (blurScore < 8) {
      return { pass: false, message: 'Image is blurry. Hold still and keep camera steady.' };
    }
    return { pass: true };
  }

  private computeSharpness(gray: Float32Array, w: number, h: number): number {
    let sum = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const c = gray[y * w + x];
        const lap =
          gray[(y - 1) * w + x] +
          gray[(y + 1) * w + x] +
          gray[y * w + x - 1] +
          gray[y * w + x + 1] -
          4 * c;
        sum += lap * lap;
        count += 1;
      }
    }
    return Math.sqrt(sum / Math.max(count, 1));
  }

  private l2Normalize(vec: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vec.length; i += 1) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) + 1e-8;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i += 1) out[i] = vec[i] / norm;
    return out;
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }
}

export const frameProcessorEngine = new FrameProcessorEngine();
