import { TFLiteModel } from './modelLoader.types';
// NOTE: This module is deprecated and unused. BlazeFace is the sole detector.
// Kept for reference only.

export interface MTCNNBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  landmarks?: { x: number, y: number }[];
}

export const mtcnnModule = {
  /**
   * @deprecated MTCNN is no longer used. BlazeFace handles all detection.
   * This method always returns an empty array.
   */
  async detect(_image: Uint8Array, _width: number, _height: number): Promise<MTCNNBox[]> {
    return [];
  },

  resize(data: Uint8Array, srcW: number, srcH: number, scale: number): Float32Array {
    const targetW = Math.floor(srcW * scale);
    const targetH = Math.floor(srcH * scale);
    const out = new Float32Array(targetW * targetH * 3);

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
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
  },

  extractCrop(image: Uint8Array, imgW: number, imgH: number, box: MTCNNBox, size: number): Float32Array {
    const out = new Float32Array(size * size * 3);
    const centerX = (box.x + box.width / 2) * imgW;
    const centerY = (box.y + box.height / 2) * imgH;
    const halfW = (box.width * imgW) / 2;
    const halfH = (box.height * imgH) / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const srcX = Math.floor(centerX + (x - size / 2) * (halfW / (size / 2)));
        const srcY = Math.floor(centerY + (y - size / 2) * (halfH / (size / 2)));
        const srcIdx = (srcY * imgW + srcX) * 3;
        const dstIdx = (y * size + x) * 3;
        if (srcIdx >= 0 && srcIdx < image.length) {
          out[dstIdx] = image[srcIdx] / 255.0;
          out[dstIdx + 1] = image[srcIdx + 1] / 255.0;
          out[dstIdx + 2] = image[srcIdx + 2] / 255.0;
        }
      }
    }
    return out;
  },

  parsePNet(output: any, scale: number): MTCNNBox[] {
    // Simplified PNet parsing: expects [1, H, W, 2] or similar
    const values = output instanceof Float32Array ? output : (output as any).data;
    if (!values) return [];

    // This is highly dependent on the specific TFLite model output shape
    // For a real implementation, we'd need the exact tensor dimensions
    return []; // Placeholder for detailed tensor parsing
  },

  parseRNet(output: any): { score: number } {
    const values = output instanceof Float32Array ? output : (output as any).data;
    return { score: values ? values[1] : 0 };
  },

  parseONet(output: any): { score: number, landmarks: {x: number, y: number}[] } {
    const values = output instanceof Float32Array ? output : (output as any).data;
    return {
      score: values ? values[1] : 0,
      landmarks: [] // Placeholder for landmark parsing
    };
  },

  nms(boxes: MTCNNBox[], threshold: number): MTCNNBox[] {
    const sorted = [...boxes].sort((a, b) => b.score - a.score);
    const result: MTCNNBox[] = [];
    const active = new Array(sorted.length).fill(true);

    for (let i = 0; i < sorted.length; i++) {
      if (!active[i]) continue;
      result.push(sorted[i]);
      for (let j = i + 1; j < sorted.length; j++) {
        if (!active[j]) continue;
        if (this.computeIoU(sorted[i], sorted[j]) > threshold) {
          active[j] = false;
        }
      }
    }
    return result;
  },

  computeIoU(a: MTCNNBox, b: MTCNNBox): number {
    const xA = Math.max(a.x, b.x);
    const yA = Math.max(a.y, b.y);
    const xB = Math.min(a.x + a.width, b.x + b.width);
    const yB = Math.min(a.y + a.height, b.y + b.height);
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const unionArea = (a.width * a.height) + (b.width * b.height) - interArea;
    return unionArea > 0 ? interArea / unionArea : 0;
  }
};
