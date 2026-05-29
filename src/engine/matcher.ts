import { FaceEmbedding } from '../types/face';

export const euclideanDistance = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

/**
 * Fast Euclidean distance with early exit.
 * If the partial squared sum exceeds bestSoFarSq, we know this candidate
 * can't beat the current best — bail out early and return Infinity.
 */
const euclideanDistanceEarlyExit = (
  a: Float32Array,
  b: Float32Array,
  bestSoFarSq: number
): number => {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
    // Check periodically (every 16 dimensions) to avoid branch overhead
    if ((i & 15) === 15 && sum > bestSoFarSq) return Infinity;
  }
  return Math.sqrt(sum);
};

/**
 * Extended gallery entry that optionally carries multiple embedding vectors
 * (accumulated during the registration burst). The base FaceEmbedding.vector
 * is always the first / averaged representative; extraVectors holds every
 * additional sample captured during registration.
 */
export interface GalleryEntry extends FaceEmbedding {
  extraVectors?: Float32Array[];
}

/**
 * Primary matching function.
 *
 * Optimized path: instead of building a full sorted ranking, we track the
 * best and runner-up distances inline with early-exit distance checks.
 */
export const matchEmbedding = (
  probe: Float32Array,
  gallery: GalleryEntry[],
  threshold = 0.85
): { matched: boolean; userId?: string; name?: string; confidence?: number } => {
  if (!gallery.length) return { matched: false, confidence: 0 };

  // Track the two best matches (best + runner-up) inline
  let bestDist = Infinity;
  let bestUserId = '';
  let bestName = '';
  let runnerUpDist = Infinity;

  // Per-user best distance tracking (needed because a user can have multiple entries)
  const perUser = new Map<string, number>();

  for (const entry of gallery) {
    // Use early-exit distance — skips remaining dimensions when hopeless
    let entryBest = euclideanDistanceEarlyExit(probe, entry.vector, bestDist * bestDist);

    // Check extra embeddings captured during registration
    if (entry.extraVectors) {
      for (const v of entry.extraVectors) {
        const d = euclideanDistanceEarlyExit(probe, v, Math.min(entryBest, bestDist) ** 2);
        if (d < entryBest) entryBest = d;
      }
    }

    // Deduplicate per user (a user may have multiple gallery entries)
    const prev = perUser.get(entry.userId);
    if (prev !== undefined && prev <= entryBest) continue;
    perUser.set(entry.userId, entryBest);

    // Update best and runner-up
    if (entryBest < bestDist) {
      runnerUpDist = bestDist;
      bestDist = entryBest;
      bestUserId = entry.userId;
      bestName = entry.name;
    } else if (entryBest < runnerUpDist) {
      runnerUpDist = entryBest;
    }
  }

  const isMatch = bestDist <= threshold;

  // Confidence mapped from distance ratio. Higher is better, clamped.
  // We use a piecewise function to represent human-readable confidence scores:
  // - A perfect match (0.0 distance) is 1.0 (100% confidence)
  // - A distance of <= 0.50 yields >= 95% confidence
  // - A match exactly at the threshold is 85% confidence
  let confidence = 0;
  if (bestDist <= threshold) {
    if (bestDist <= 0.50) {
      confidence = 1.0 - 0.05 * (bestDist / 0.50);
    } else {
      const range = threshold - 0.50;
      const progress = (bestDist - 0.50) / (range || 1);
      confidence = 0.95 - 0.10 * progress;
    }
  } else {
    const excess = bestDist - threshold;
    const maxExcess = threshold * 0.5;
    const factor = Math.min(1.0, excess / Math.max(maxExcess, 1e-6));
    confidence = 0.80 * (1.0 - factor);
  }
  confidence = Math.max(0, Math.min(1, confidence));

  // If winner is clearly better than runner-up, slightly boost confidence.
  if (runnerUpDist < Infinity && bestDist <= threshold) {
    const gap = runnerUpDist - bestDist;
    if (gap > 0.12) confidence = Math.min(1.0, confidence + 0.05);
  }

  if (!isMatch) {
    return { matched: false, confidence };
  }

  return {
    matched: true,
    userId: bestUserId,
    name: bestName,
    confidence,
  };
};

