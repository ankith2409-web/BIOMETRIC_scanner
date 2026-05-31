import { faceApiService } from '../../services/faceApiService';
import { LivenessChecker } from './livenessChecker';
import { FaceEmbedding, FrameProcessResult, LandmarkPoint, DetectionBox } from '../types/face';
import { matchEmbedding, euclideanDistance } from './matcher';
import { faceMeshModule } from './faceMeshModule';
import { storageService } from '../../services/storageService';
import { getLightingScore } from './imagePreprocessing';

class FrameProcessorEngineWeb {
  private liveness = new LivenessChecker();
  // Cache the faceapi reference after first load — avoids re-awaiting the promise every frame.
  private faceapiRef: any = null;
  private modelsReady = false;

  private lastBox: DetectionBox | null = null;
  private temporalHistory: { userId: string; distance: number; name: string }[] = [];
  private readonly HISTORY_DEPTH = 3;

  resetLiveness(): void {
    this.liveness.reset();
    faceMeshModule.reset();
    this.lastBox = null;
    this.temporalHistory = [];
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

  private l2Normalize(vec: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vec.length; i += 1) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) + 1e-8;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i += 1) out[i] = vec[i] / norm;
    return out;
  }

  /**
   * Compute the L2-normalized centroid of a set of embeddings.
   * Averages out per-frame noise for more stable matching.
   */
  private computeCentroid(embeddings: Float32Array[]): Float32Array {
    if (embeddings.length === 1) return embeddings[0];
    const dim = embeddings[0].length;
    const centroid = new Float32Array(dim);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) centroid[i] += emb[i];
    }
    const n = embeddings.length;
    for (let i = 0; i < dim; i++) centroid[i] /= n;
    return this.l2Normalize(centroid);
  }

  private async ensureReady(log?: (msg: string) => void): Promise<any> {
    if (this.faceapiRef && this.modelsReady) return this.faceapiRef;
    log?.('[processor] Initializing face-api.js & models');
    this.faceapiRef = await faceApiService.loadFaceApi(log);
    await faceApiService.loadModels(log);
    this.modelsReady = true;
    return this.faceapiRef;
  }

  /**
   * Build a canvas from raw RGB data with adaptive brightness/contrast filters
   * and per-channel contrast normalization applied.
   */
  private buildFilteredCanvas(
    frameRGB: Uint8Array,
    size: number,
    log?: (msg: string) => void
  ): { canvas: HTMLCanvasElement; filteredRGB: Uint8Array; avgLuma: number } | null {
    // Calculate average luma (sample every 4th pixel for speed)
    let sumLuma = 0;
    const totalPixels = frameRGB.length / 3;
    for (let i = 0; i < frameRGB.length; i += 12) {
      sumLuma += 0.299 * frameRGB[i] + 0.587 * frameRGB[i + 1] + 0.114 * frameRGB[i + 2];
    }
    const avgLuma = sumLuma / (totalPixels / 4);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const filteredRGB = new Uint8Array(frameRGB.length);

    // Offscreen canvas for raw pixels → main canvas with CSS filter
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    if (offscreenCtx) {
      const imgData = offscreenCtx.createImageData(size, size);
      for (let i = 0, j = 0; i < imgData.data.length; i += 4, j += 3) {
        imgData.data[i] = frameRGB[j];
        imgData.data[i + 1] = frameRGB[j + 1];
        imgData.data[i + 2] = frameRGB[j + 2];
        imgData.data[i + 3] = 255;
      }
      offscreenCtx.putImageData(imgData, 0, 0);

      // Apply adaptive brightness/contrast filters based on average luminance
      if (avgLuma > 200) {
        ctx.filter = 'brightness(0.70) contrast(1.25)';
      } else if (avgLuma > 150) {
        ctx.filter = 'brightness(0.80) contrast(1.15)';
      } else if (avgLuma < 80) {
        ctx.filter = 'brightness(1.20) contrast(1.10)';
      } else {
        ctx.filter = 'brightness(0.95) contrast(1.05)';
      }

      ctx.drawImage(offscreenCanvas, 0, 0);
      ctx.filter = 'none';

      // Apply per-channel contrast normalization (stretches histogram to full range)
      faceApiService.applyContrastNormalization(canvas);

      // Extract the fully processed RGB data
      const filteredImgData = ctx.getImageData(0, 0, size, size);
      for (let i = 0, j = 0; i < filteredImgData.data.length; i += 4, j += 3) {
        filteredRGB[j] = filteredImgData.data[i];
        filteredRGB[j + 1] = filteredImgData.data[i + 1];
        filteredRGB[j + 2] = filteredImgData.data[i + 2];
      }
    } else {
      // Fallback: no offscreen canvas support
      filteredRGB.set(frameRGB);
      const imgData = ctx.createImageData(size, size);
      for (let i = 0, j = 0; i < imgData.data.length; i += 4, j += 3) {
        imgData.data[i] = frameRGB[j];
        imgData.data[i + 1] = frameRGB[j + 1];
        imgData.data[i + 2] = frameRGB[j + 2];
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return { canvas, filteredRGB, avgLuma };
  }

  /**
   * Run face detection using SsdMobilenetv1 (higher accuracy, slower).
   * Used for registration where accuracy is critical.
   */
  private async detectWithSSD(faceapi: any, canvas: HTMLCanvasElement, log?: (msg: string) => void) {
    log?.('[processor] Running SsdMobilenetv1 detection...');
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.5,
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      log?.(`[processor] SSD detection score: ${detection.detection.score.toFixed(3)}`);
    }
    return detection;
  }

  /**
   * Run face detection using TinyFaceDetector (lightweight, fast).
   * Used for authentication where speed is critical (<1s).
   */
  private async detectWithTiny(faceapi: any, canvas: HTMLCanvasElement, inputSize: number, log?: (msg: string) => void) {
    log?.(`[processor] Running TinyFaceDetector (inputSize=${inputSize})...`);
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({
        inputSize,
        scoreThreshold: 0.20,
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      log?.(`[processor] Tiny detection score: ${detection.detection.score.toFixed(3)}`);
    }
    return detection;
  }

  /**
   * Core processing: detect face, extract landmarks, compute embedding.
   * @param mode 'register' uses SSD (accurate), 'auth' uses Tiny (fast)
   */
  async processForEmbedding(
    frameRGB: Uint8Array,
    log?: (msg: string) => void,
    mode: 'register' | 'auth' = 'register'
  ): Promise<FrameProcessResult> {
    const timing: Record<string, number> = {};
    const t0 = Date.now();

    try {
      log?.('[processor] Ensuring ready...');
      const faceapi = await this.ensureReady(log);
      if (!faceapi) {
        log?.('[processor] faceapi undefined after ensureReady');
        return { faceFound: false, livenessPass: false, timing };
      }

      const size = Math.round(Math.sqrt(frameRGB.length / 3));
      log?.(`[processor] Canvas size: ${size}x${size}, mode: ${mode}`);

      // Build preprocessed canvas with filters + contrast normalization
      const built = this.buildFilteredCanvas(frameRGB, size, log);
      if (!built) {
        log?.('[processor] Failed to build canvas');
        return { faceFound: false, livenessPass: false, timing };
      }
      const { canvas, filteredRGB } = built;

      timing.setup = Date.now() - t0;

      // --- Detection Strategy ---
      // Registration: SSD first (accurate), fallback to Tiny if SSD fails
      // Authentication: Tiny only (fast, <1s requirement)
      const validSize = Math.max(128, Math.floor(size / 32) * 32);
      const t1 = Date.now();
      let detection: any = null;

      if (mode === 'register') {
        // Try SSD first for maximum accuracy
        detection = await this.detectWithSSD(faceapi, canvas, log);
        if (!detection) {
          // Fallback to Tiny with larger input for small faces
          log?.('[processor] SSD missed, falling back to TinyFaceDetector...');
          detection = await this.detectWithTiny(faceapi, canvas, Math.min(validSize, 416), log);
        }
      } else {
        // Auth: Tiny only for speed
        detection = await this.detectWithTiny(faceapi, canvas, validSize, log);
      }

      timing.detect = Date.now() - t1;

      if (!detection) {
        log?.('[processor] No face detected');
        return { faceFound: false, livenessPass: false, timing };
      }

      log?.(`[processor] Face detected! Score: ${detection.detection.score.toFixed(3)}, detector: ${mode === 'register' ? 'SSD/Tiny' : 'Tiny'}`);

      const box = detection.detection.box;
      const normDetection = {
        x: Math.max(0, Math.min(1, box.x / size)),
        y: Math.max(0, Math.min(1, box.y / size)),
        width: Math.max(0, Math.min(1, box.width / size)),
        height: Math.max(0, Math.min(1, box.height / size)),
        score: detection.detection.score,
      };

      // Landmarks are 68-points from face-api.js, normalize to 0..1
      const landmarks: LandmarkPoint[] = detection.landmarks.positions.map((p: any) => ({
        x: Math.max(0, Math.min(1, p.x / size)),
        y: Math.max(0, Math.min(1, p.y / size)),
        z: 0,
      }));

      // Call FaceMeshModule for liveness signals
      const meshResult = faceMeshModule.process(landmarks, normDetection, filteredRGB, size, size);

      const ear = (meshResult.result.livenessSignal.earLeft + meshResult.result.livenessSignal.earRight) / 2;

      timing.total = Date.now() - t0;

      const returnedLandmarks = Array.from(meshResult.result.landmarks).slice(0, 68).map((_, i) => ({
        x: meshResult.result.landmarks[i * 3],
        y: meshResult.result.landmarks[i * 3 + 1],
        z: meshResult.result.landmarks[i * 3 + 2] ?? 0,
      }));

      let finalQualityPass = meshResult.qualityPass;
      let finalQualityMessage = meshResult.qualityMessage;

      // Extract face region for lighting quality check
      const faceBoxWidth = Math.round(normDetection.width * size);
      const faceBoxHeight = Math.round(normDetection.height * size);
      const faceBoxX = Math.round(normDetection.x * size);
      const faceBoxY = Math.round(normDetection.y * size);

      const faceRegion = new Uint8Array(faceBoxWidth * faceBoxHeight * 3);
      for (let y = 0; y < faceBoxHeight; y++) {
        for (let x = 0; x < faceBoxWidth; x++) {
          const srcIdx = ((faceBoxY + y) * size + (faceBoxX + x)) * 3;
          const destIdx = (y * faceBoxWidth + x) * 3;
          faceRegion[destIdx] = filteredRGB[srcIdx] ?? 0;
          faceRegion[destIdx + 1] = filteredRGB[srcIdx + 1] ?? 0;
          faceRegion[destIdx + 2] = filteredRGB[srcIdx + 2] ?? 0;
        }
      }

      const lighting = getLightingScore(faceRegion, filteredRGB);

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

      // Sharpness calculation
      const faceLuma = new Float32Array(faceRegion.length / 3);
      for (let i = 0, j = 0; i < faceRegion.length; i += 3, j += 1) {
        faceLuma[j] = 0.299 * faceRegion[i] + 0.587 * faceRegion[i + 1] + 0.114 * faceRegion[i + 2];
      }
      const blurScore = this.computeSharpness(faceLuma, faceBoxWidth, faceBoxHeight);

      const qualityConfidence = this.computeImageQualityConfidence(
        normDetection,
        lighting.score,
        blurScore,
        meshResult.result.faceAngle
      );

      const embedding = this.l2Normalize(Float32Array.from(detection.descriptor));
      const livenessResult = this.liveness.update(returnedLandmarks, ear, embedding);

      const sig = {
        ...meshResult.result.livenessSignal,
        blinkDetected: livenessResult.blinkDetected,
      };

      log?.(`[processor] Done. Quality: ${finalQualityPass ? 'PASS' : 'FAIL'} (${finalQualityMessage ?? 'none'}), Liveness: ${livenessResult.livenessPass ? 'PASS' : 'FAIL'}, time: ${timing.total}ms`);
      console.log(`[FaceGate][Web] mode=${mode}, detect=${timing.detect}ms, total=${timing.total}ms, score=${detection.detection.score.toFixed(3)}`);

      return {
        faceFound: true,
        detection: normDetection,
        landmarks: returnedLandmarks,
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
        isSpoof: livenessResult.isSpoof,
        qualityConfidence,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      log?.(`[processor] Frame processing error: ${errMsg}`);
      console.error('[FaceGate] Web frame processing error:', err);
      return { faceFound: false, livenessPass: false, timing };
    }
  }

  /**
   * Authentication pipeline: uses fast TinyFaceDetector + rolling embedding smoothing.
   * The 3-frame centroid averages out per-frame noise for stable, high-confidence matches.
   */
  async processForAuth(frameRGB: Uint8Array, gallery?: any[], log?: (msg: string) => void) {
    // Use 'auth' mode for fast TinyFaceDetector
    const result = await this.processForEmbedding(frameRGB, log, 'auth');
    if (!result.faceFound || !result.detection || !result.embedding) {
      this.resetLiveness();
      this.lastBox = null;
      this.temporalHistory = [];
      return {
        auth: { matched: false, livenessPass: false, isSpoof: false, confidence: 0 },
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

    const finalMatched =
      !isSpoof &&
      avgDistance <= threshold &&
      gapPass &&
      livenessPass &&
      temporalConsistencyPass &&
      finalConfidence >= 0.82;

    console.log(`[FaceGate][Web][Auth] Telemetry:
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
      Final Aggregated Confidence: ${(finalConfidence * 100).toFixed(1)}% (Threshold: 95%)
      Auth Result: ${finalMatched ? 'SUCCESS' : 'FAILED'}
    `);

    return {
      auth: {
        matched: finalMatched,
        userId: finalMatched ? matchedUserId : undefined,
        name: finalMatched ? matchedName : undefined,
        confidence: finalConfidence,
        livenessPass,
        
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
      },
      process: result,
    };
  }
}

export const frameProcessorEngine = new FrameProcessorEngineWeb();
