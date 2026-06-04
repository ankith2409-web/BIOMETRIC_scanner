import { FaceEmbedding } from '../types/face';

export const euclideanDistance = (a: Float32Array, b: Float32Array): number => {
  if (a.length === 0 || b.length === 0) return Infinity;
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
  if (a.length === 0 || b.length === 0) return Infinity;
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
  threshold = 0.45,
  confidenceGapMargin = 0.08
): MatchResult => {
  if (!gallery.length) {
    return {
      matched: false,
      bestDist: Infinity,
      runnerUpDist: Infinity,
      gap: 0,
      recognitionConfidence: 0,
      gapConfidence: 0,
      gapPass: false,
    };
  }

  // Map to store the minimum distance for each unique userId
  const perUserMinDist = new Map<string, { userId: string; name: string; minDist: number }>();

  for (const entry of gallery) {
    let entryBest = euclideanDistance(probe, entry.vector);

    // Check extra embeddings captured during registration
    if (entry.extraVectors) {
      for (const v of entry.extraVectors) {
        const d = euclideanDistance(probe, v);
        if (d < entryBest) entryBest = d;
      }
    }

    const existing = perUserMinDist.get(entry.userId);
    if (!existing || entryBest < existing.minDist) {
      perUserMinDist.set(entry.userId, {
        userId: entry.userId,
        name: entry.name,
        minDist: entryBest,
      });
    }
  }

  // Convert map to array and sort by minimum distance ascending
  const sortedCandidates = Array.from(perUserMinDist.values()).sort(
    (a, b) => a.minDist - b.minDist
  );

  const bestCandidate = sortedCandidates[0];
  const runnerUpCandidate = sortedCandidates[1];

  const bestDist = bestCandidate.minDist;
  const runnerUpDist = runnerUpCandidate ? runnerUpCandidate.minDist : Infinity;
  const gap = runnerUpDist - bestDist;

  // Enforce threshold and confidence-gap checks
  const thresholdPass = bestDist <= threshold;
  const gapPass = runnerUpDist === Infinity || gap >= confidenceGapMargin;
  const matched = thresholdPass && gapPass;

  // Calculate recognition confidence based on Euclidean distance
  // A distance of 0.0 maps to 1.0 (100%), and distance of threshold maps to 0.95.
  const recognitionConfidence = bestDist <= threshold
    ? Math.max(0, Math.min(1, 1.0 - (bestDist / threshold) * 0.05))
    : Math.max(0, Math.min(0.95, 0.95 - ((bestDist - threshold) / Math.max(0.01, 1.0 - threshold)) * 0.95));

  // Calculate gap confidence
  // If gap is above margin, it ranges from 0.95 to 1.0. If below, it is 0.0.
  let gapConfidence = 0;
  if (gapPass) {
    if (runnerUpDist === Infinity) {
      gapConfidence = 1.0;
    } else {
      const excess = gap - confidenceGapMargin;
      gapConfidence = Math.min(1.0, 0.95 + excess * 0.1);
    }
  }

  return {
    matched,
    userId: bestCandidate.userId,
    name: bestCandidate.name,
    bestDist,
    runnerUpDist,
    gap,
    recognitionConfidence,
    gapConfidence,
    gapPass,
  };
};

export interface MatchResult {
  matched: boolean;
  userId?: string;
  name?: string;
  bestDist: number;
  runnerUpDist: number;
  gap: number;
  recognitionConfidence: number;
  gapConfidence: number;
  gapPass: boolean;
}
