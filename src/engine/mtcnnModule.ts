import { TFLiteModel } from './modelLoader.types';
import { modelLoader } from './modelLoader';
import { DetectionBox } from '../types/face';

export interface MTCNNBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  landmarks?: { x: number, y: number }[];
}

export const mtcnnModule = {
  async detect(image: Uint8Array, width: number, height: number): Promise<MTCNNBox[]> {
    const models = await modelLoader.loadAll();
    const { pNet, rNet, oNet } = models;

    // 1. P-Net candidate generation (simplified pyramid)
    // In a real implementation, we'd use multiple scales.
    // For now, we'll start with a few key scales.
    const scales = [1.0, 0.709, 0.503];
    let allBoxes: MTCNNBox[] = [];

    for (const scale of scales) {
      const resized = this.resize(image, width, height, scale);
      const output = await pNet.run(resized);
      const boxes = this.parsePNet(output, scale);
      allBoxes = [...allBoxes, ...boxes];
    }

    // NMS and filtering
    let filtered = this.nms(allBoxes, 0.7);

    // 2. R-Net refinement
    const rNetInputs = filtered.map(box => this.extractCrop(image, width, height, box, 24));
    const rNetResults = await Promise.all(rNetInputs.map(input => rNet.run(input)));

    filtered = filtered.filter((box, i) => {
      const res = this.parseRNet(rNetResults[i]);
      return res.score >= 0.7;
    });

    // 3. O-Net final pass
    const oNetInputs = filtered.map(box => this.extractCrop(image, width, height, box, 48));
    const oNetResults = await Promise.all(oNetInputs.map(input => oNet.run(input)));

    return filtered.map((box, i) => {
      const res = this.parseONet(oNetResults[i]);
      return {
        ...box,
        score: res.score,
        landmarks: res.landmarks
      };
    }).filter(box => box.score >= 0.7);
  },

  private resize(data: Uint8Array, srcW: number, srcH: number, scale: number): Float32Array {
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

  private extractCrop(image: Uint8Array, imgW: number, imgH: number, box: MTCNNBox, size: number): Float32Array {
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

  private parsePNet(output: any, scale: number): MTCNNBox[] {
    // Simplified PNet parsing: expects [1, H, W, 2] or similar
    const values = output instanceof Float32Array ? output : (output as any).data;
    if (!values) return [];

    // This is highly dependent on the specific TFLite model output shape
    // For a real implementation, we'd need the exact tensor dimensions
    return []; // Placeholder for detailed tensor parsing
  },

  private parseRNet(output: any): { score: number } {
    const values = output instanceof Float32Array ? output : (output as any).data;
    return { score: values ? values[1] : 0 };
  },

  private parseONet(output: any): { score: number, landmarks: {x: number, y: number}[] } {
    const values = output instanceof Float32Array ? output : (output as any).data;
    return {
      score: values ? values[1] : 0,
      landmarks: [] // Placeholder for landmark parsing
    };
  },

  private nms(boxes: MTCNNBox[], threshold: number): MTCNNBox[] {
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

  private computeIoU(a: MTCNNBox, b: MTCNNBox): number {
    const xA = Math.max(a.x, b.x);
    const yA = Math.max(a.y, b.y);
    const xB = Math.min(a.x + a.width, b.x + b.width);
    const yB = Math.min(a.y + a.height, b.y + b.height);
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const unionArea = (a.width * a.height) + (b.width * b.height) - interArea;
    return unionArea > 0 ? interArea / unionArea : 0;
  }
};
