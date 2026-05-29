import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let scriptLoadingPromise: Promise<any> | null = null;
let modelsLoadingPromise: Promise<void> | null = null;

export const faceApiService = {
  // Dynamically load the face-api.js library in the web browser
  loadFaceApi(log?: (msg: string) => void): Promise<any> {
    if (!isWeb) {
      return Promise.resolve(null);
    }

    if (scriptLoadingPromise) {
      log?.('[faceApi] Script promise exists');
      return scriptLoadingPromise;
    }

    log?.('[faceApi] Injecting face-api.js script tag');
    scriptLoadingPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).faceapi) {
        log?.('[faceApi] faceapi already on window');
        resolve((window as any).faceapi);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
      script.async = true;
      script.onload = () => {
        if ((window as any).faceapi) {
          log?.('[faceApi] faceapi script loaded successfully');
          resolve((window as any).faceapi);
        } else {
          log?.('[faceApi] faceapi script loaded but window.faceapi is missing');
          reject(new Error('faceapi not found on window object after loading'));
        }
      };
      script.onerror = (err) => {
        scriptLoadingPromise = null; // Reset on failure
        log?.('[faceApi] faceapi script failed to load (network error)');
        reject(err);
      };
      document.body.appendChild(script);
      log?.('[faceApi] Script tag appended');
    });

    return scriptLoadingPromise;
  },

  // Load necessary neural network models
  loadModels(log?: (msg: string) => void): Promise<void> {
    if (!isWeb) {
      return Promise.resolve();
    }

    if (modelsLoadingPromise) {
      log?.('[faceApi] Models promise exists');
      return modelsLoadingPromise;
    }

    log?.('[faceApi] Loading models from CDN');
    modelsLoadingPromise = new Promise(async (resolve, reject) => {
      try {
        const faceapi = await this.loadFaceApi(log);
        if (!faceapi) {
          throw new Error('face-api.js failed to load');
        }

        log?.('[faceApi] Loading tinyFaceDetector weights...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        log?.('[faceApi] tinyFaceDetector weights loaded');

        log?.('[faceApi] Loading ssdMobilenetv1 weights...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        log?.('[faceApi] ssdMobilenetv1 weights loaded');

        log?.('[faceApi] Loading faceLandmark68Net weights...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        log?.('[faceApi] faceLandmark68Net weights loaded');

        log?.('[faceApi] Loading faceRecognitionNet weights...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        log?.('[faceApi] faceRecognitionNet weights loaded');

        log?.('[faceApi] All face-api.js models loaded successfully');
        resolve();
      } catch (err: any) {
        modelsLoadingPromise = null; // Reset on failure
        const errMsg = err?.message || String(err);
        log?.(`[faceApi] Failed to load models: ${errMsg}`);
        console.error('Failed to load face-api.js models:', err);
        reject(err);
      }
    });

    return modelsLoadingPromise;
  },

  // Apply Pixel-level Contrast Normalization (Contrast Stretching)
  // to filter out extreme shadows and harsh direct sunlight.
  applyContrastNormalization(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Find min and max intensities for R, G, B channels
      let minR = 255, maxR = 0;
      let minG = 255, maxG = 0;
      let minB = 255, maxB = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (g < minG) minG = g;
        if (g > maxG) maxG = g;
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
      }

      // Stretch contrast: P_out = (P_in - min) * 255 / (max - min)
      const rangeR = maxR - minR || 1;
      const rangeG = maxG - minG || 1;
      const rangeB = maxB - minB || 1;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(((data[i] - minR) / rangeR) * 255);
        data[i + 1] = Math.round(((data[i + 1] - minG) / rangeG) * 255);
        data[i + 2] = Math.round(((data[i + 2] - minB) / rangeB) * 255);
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Canvas pixel processing error:', e);
    }
  },

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  calculateEAR(landmarks: any): number {
    // Landmarks indexes:
    // Left eye: 36 to 41
    // Right eye: 42 to 47
    const dist = (p1: any, p2: any) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const getEyeEAR = (indices: number[]) => {
      const p1 = landmarks[indices[0]];
      const p2 = landmarks[indices[1]];
      const p3 = landmarks[indices[2]];
      const p4 = landmarks[indices[3]];
      const p5 = landmarks[indices[4]];
      const p6 = landmarks[indices[5]];

      // EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
      const vertical1 = dist(p2, p6);
      const vertical2 = dist(p3, p5);
      const horizontal = dist(p1, p4);

      return (vertical1 + vertical2) / (2.0 * horizontal || 1);
    };

    const leftEAR = getEyeEAR([36, 37, 38, 39, 40, 41]);
    const rightEAR = getEyeEAR([42, 43, 44, 45, 46, 47]);

    return (leftEAR + rightEAR) / 2.0;
  },

  // Calculate Euclidean Distance between two 128D embedding vectors
  calculateEuclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    const len = Math.min(vec1.length, vec2.length);
    for (let i = 0; i < len; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  },

  // Convert Euclidean Distance to Match Confidence Percentage
  calculateConfidence(distance: number): number {
    // Distance < 0.6 is a match.
    if (distance < 0.6) {
      // Map 0 -> 0.6 to 100% -> 80%
      return Math.round(100 - (distance / 0.6) * 20);
    } else {
      // Map 0.6 -> 1.5 to 80% -> 0%
      return Math.round(Math.max(0, 80 - ((distance - 0.6) / 0.9) * 80));
    }
  }
};
