import { euclideanDistance } from './matcher';

/**
 * Embedding accumulator and self-consistency validator.
 *
 * Collects multiple face embeddings captured over successive frames and
 * validates that they are self-consistent (low intra-class variance).
 * On success, returns a robust L2-normalized centroid embedding that
 * averages out per-frame noise.
 */
export class EmbeddingValidator {
  private embeddings: Float32Array[] = [];
  private readonly requiredCount: number;
  // Maximum average pairwise distance for embeddings to be considered consistent.
  // Typical same-person same-session variance is 0.15-0.25; we allow up to 0.40.
  private readonly maxAvgPairwiseDist: number;

  constructor(requiredCount = 5, maxAvgPairwiseDist = 0.40) {
    this.requiredCount = requiredCount;
    this.maxAvgPairwiseDist = maxAvgPairwiseDist;
  }

  /** Reset all accumulated embeddings. */
  reset(): void {
    this.embeddings = [];
  }

  /** Current number of accumulated embeddings. */
  get count(): number {
    return this.embeddings.length;
  }

  /** Total required to trigger validation. */
  get required(): number {
    return this.requiredCount;
  }

  /** Whether enough embeddings have been collected. */
  get isFull(): boolean {
    return this.embeddings.length >= this.requiredCount;
  }

  /** Add an embedding. Returns true if the buffer is now full. */
  add(embedding: Float32Array): boolean {
    this.embeddings.push(embedding);
    return this.isFull;
  }

  /**
   * Validate self-consistency of the accumulated embeddings.
   *
   * Computes the average pairwise Euclidean distance among all collected
   * embeddings. If it's below the threshold, the captures are consistent
   * (the user held still with stable conditions).
   *
   * @returns Object with `consistent` flag, `avgDistance`, and optionally the
   *          L2-normalized centroid embedding.
   */
  validate(): {
    consistent: boolean;
    avgDistance: number;
    centroid: Float32Array | null;
    message: string;
    confidence?: number;
  } {
    if (this.embeddings.length < 2) {
      return {
        consistent: false,
        avgDistance: Infinity,
        centroid: null,
        message: 'Not enough samples collected.',
      };
    }

    // Compute centroid (element-wise average), then L2-normalize
    const dim = this.embeddings[0].length;
    const centroid = new Float32Array(dim);
    for (const emb of this.embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }
    const n = this.embeddings.length;
    for (let i = 0; i < dim; i++) {
      centroid[i] /= n;
    }

    // L2-normalize the centroid
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += centroid[i] * centroid[i];
    norm = Math.sqrt(norm) + 1e-8;
    for (let i = 0; i < dim; i++) centroid[i] /= norm;

    // Compute distances to centroid and calculate confidence
    let totalConf = 0;
    let totalDist = 0;
    const threshold = 0.85; // matching threshold

    for (const emb of this.embeddings) {
      const dist = euclideanDistance(emb, centroid);
      totalDist += dist;

      let conf = 0;
      if (dist <= 0.50) {
        conf = 1.0 - 0.05 * (dist / 0.50);
      } else if (dist <= threshold) {
        const range = threshold - 0.50;
        const progress = (dist - 0.50) / (range || 1);
        conf = 0.95 - 0.10 * progress;
      } else {
        const excess = dist - threshold;
        const maxExcess = threshold * 0.5;
        const factor = Math.min(1.0, excess / maxExcess);
        conf = 0.80 * (1.0 - factor);
      }
      conf = Math.max(0, Math.min(1, conf));
      totalConf += conf;
    }

    const avgDistance = totalDist / n;
    const avgConfidence = totalConf / n;

    if (avgConfidence < 0.95) {
      return {
        consistent: false,
        avgDistance,
        centroid: null,
        message: `Biometric confidence too low (${(avgConfidence * 100).toFixed(1)}% < 95%). Hold still & retry.`,
        confidence: avgConfidence,
      };
    }

    // Also verify pairwise distances are reasonable to prevent a single outlier from being averaged out too much
    let maxPairwise = 0;
    for (let i = 0; i < this.embeddings.length; i++) {
      for (let j = i + 1; j < this.embeddings.length; j++) {
        const d = euclideanDistance(this.embeddings[i], this.embeddings[j]);
        if (d > maxPairwise) maxPairwise = d;
      }
    }

    // Pairwise distance limit: 0.45
    if (maxPairwise > 0.45) {
      return {
        consistent: false,
        avgDistance,
        centroid: null,
        message: `High variance between frames (max gap ${maxPairwise.toFixed(3)}). Hold still.`,
        confidence: avgConfidence,
      };
    }

    return {
      consistent: true,
      avgDistance,
      centroid,
      message: `Quality verified (confidence ${(avgConfidence * 100).toFixed(1)}%).`,
      confidence: avgConfidence,
    };
  }
}
