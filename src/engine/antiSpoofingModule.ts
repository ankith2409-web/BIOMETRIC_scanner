import { modelLoader } from './modelLoader';
import { TFLiteModel } from './modelLoader.types';

export const antiSpoofingModule = {
  async check(faceCrop: Uint8Array, width: number, height: number): Promise<{ isSpoof: boolean; score: number }> {
    const models = await modelLoader.loadAll();
    const model = models.antiSpoofing;

    // The model expects 256x256 RGB image normalized to [0, 1]
    const input = this.preprocess(faceCrop, width, height);

    // The model has two outputs: clss_pred (1x8) and leaf_node_mask (1x8)
    // Using react-native-fast-tflite, we get them as an array of outputs
    const outputs = await model.run(input);

    // Depending on how fast-tflite returns multiple outputs, it might be an array of Float32Arrays
    // based on the Java code:
    // outputs.put(interpreter.getOutputIndex("Identity"), clss_pred);
    // outputs.put(interpreter.getOutputIndex("Identity_1"), leaf_node_mask);

    if (!Array.isArray(outputs) || outputs.length < 2) {
      return { isSpoof: false, score: 0 };
    }

    const clssPred = outputs[0] as Float32Array;
    const leafNodeMask = outputs[1] as Float32Array;

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
