import { modelLoader } from './modelLoader';
import { TFLiteModel } from './modelLoader.types';

function extractFloatArray(raw: unknown): Float32Array | null {
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
    return extractFloatArray(candidate);
  }
  return null;
}

export const antiSpoofingModule = {
  async check(faceCrop: Uint8Array, width: number, height: number): Promise<{ isSpoof: boolean; score: number }> {
    const models = await modelLoader.loadAll();
    const model = models.antiSpoofing;

    // The model expects 256x256 RGB image normalized to [0, 1]
    const input = this.preprocess(faceCrop, width, height);

    // The model has two outputs: clss_pred (1x8) and leaf_node_mask (1x8)
    // Using react-native-fast-tflite, we get them as an array of outputs
    const outputs = await model.run(input);

    let outputsArray: unknown[] | null = null;
    if (Array.isArray(outputs)) {
      outputsArray = outputs;
    } else if (outputs && typeof outputs === 'object') {
      const candidate = (outputs as Record<string, unknown>).outputs
        ?? (outputs as Record<string, unknown>).output
        ?? (outputs as Record<string, unknown>).data;
      if (Array.isArray(candidate)) {
        outputsArray = candidate;
      }
    }

    if (!outputsArray || outputsArray.length < 2) {
      return { isSpoof: false, score: 0 };
    }

    const clssPred = extractFloatArray(outputsArray[0]);
    const leafNodeMask = extractFloatArray(outputsArray[1]);

    if (!clssPred || !leafNodeMask) {
      return { isSpoof: false, score: 0 };
    }

    let score = 0;
    for (let i = 0; i < 8; i++) {
      score += Math.abs(clssPred[i]) * leafNodeMask[i];
    }

    // Threshold from Java code: 0.2. If score > 0.2, it's a spoof.
    const THRESHOLD = 0.2;
    return {
      isSpoof: score > THRESHOLD,
      score: score,
    };
  },

  preprocess(data: Uint8Array, srcW: number, srcH: number): Float32Array {
    // Resize to 256x256 and normalize to [0, 1]
    // For simplicity in this implementation, we assume data is already cropped
    // and we do a simple resize/normalization.
    const targetW = 256;
    const targetH = 256;
    const out = new Float32Array(targetW * targetH * 3);

    const scaleX = srcW / targetW;
    const scaleY = srcH / targetH;

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = (srcY * srcW + srcX) * 3;
        const dstIdx = (y * targetW + x) * 3;

        if (srcIdx >= 0 && srcIdx < data.length) {
          out[dstIdx] = data[srcIdx] / 255.0;
          out[dstIdx + 1] = data[srcIdx + 1] / 255.0;
          out[dstIdx + 2] = data[srcIdx + 2] / 255.0;
        }
      }
    }
    return out;
  }
};
