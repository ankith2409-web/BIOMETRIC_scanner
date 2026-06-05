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
 * Optimized path: uses early-exit Euclidean distance to skip hopeless
 * candidates as fast as possible. Tracks per-user best distance inline
 * to avoid building and sorting a full ranking array.
 *
 * Anti-misidentification: recognition confidence now uses a proper linear
 * scale (dist=0 → 100%, dist=threshold → 0%) instead of the old compressed
 * scale that gave 95%+ to anything within threshold.
 */
export const matchEmbedding = (
  probe: Float32Array,
  gallery: GalleryEntry[],
  threshold = 0.45,
  confidenceGapMargin = 0.10
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

  // Track the global best and runner-up distances across all users.
  // This lets euclideanDistanceEarlyExit skip candidates that can't
  // possibly beat the current best.
  let globalBestSq = Infinity;

  // Map to store the minimum distance for each unique userId
  const perUserMinDist = new Map<string, { userId: string; name: string; minDist: number }>();

  for (const entry of gallery) {
    // Use early-exit: bail as soon as partial sum exceeds current best squared
    let entryBest = euclideanDistanceEarlyExit(probe, entry.vector, globalBestSq);

    // Check extra embeddings captured during registration
    if (entry.extraVectors) {
      for (const v of entry.extraVectors) {
        const currentBestSq = Math.min(entryBest * entryBest, globalBestSq);
        const d = euclideanDistanceEarlyExit(probe, v, currentBestSq);
        if (d < entryBest) entryBest = d;
      }
    }

    // Update global best squared for early exit in subsequent iterations
    if (entryBest < Math.sqrt(globalBestSq)) {
      globalBestSq = entryBest * entryBest;
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

  // Recognition confidence: proper linear mapping.
  // dist = 0.0 → 1.0 (100% confidence)
  // dist = threshold → 0.0 (0% confidence at the boundary)
  // dist > threshold → 0.0 (no match)
  // This prevents two different people within threshold from both
  // receiving artificially high (~95%) confidence scores.
  let recognitionConfidence: number;
  if (bestDist <= threshold) {
    recognitionConfidence = Math.max(0, 1.0 - (bestDist / threshold));
  } else {
    recognitionConfidence = 0;
  }

  // Gap confidence: measures how unambiguous the match is.
  // Single-person gallery → 1.0
  // Large gap → near 1.0, small gap → proportionally lower
  let gapConfidence = 0;
  if (gapPass) {
    if (runnerUpDist === Infinity) {
      gapConfidence = 1.0;
    } else {
      // Scale: gap of exactly margin → 0.80, gap of 2× margin → 1.0
      const excess = gap - confidenceGapMargin;
      gapConfidence = Math.min(1.0, 0.80 + (excess / confidenceGapMargin) * 0.20);
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

