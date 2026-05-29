import { euclideanDistance } from './matcher';

/**
 * Applies White Balance correction using the Gray World Assumption.
 */
export function applyWhiteBalance(rgb: Uint8Array): Uint8Array {
  const len = rgb.length;
  const out = new Uint8Array(len);
  let sumR = 0, sumG = 0, sumB = 0;
  const pixels = len / 3;

  for (let i = 0; i < len; i += 3) {
    sumR += rgb[i];
    sumG += rgb[i + 1];
    sumB += rgb[i + 2];
  }

  const meanR = sumR / pixels;
  const meanG = sumG / pixels;
  const meanB = sumB / pixels;
  const meanAll = (meanR + meanG + meanB) / 3;

  const scaleR = meanAll / Math.max(meanR, 1);
  const scaleG = meanAll / Math.max(meanG, 1);
  const scaleB = meanAll / Math.max(meanB, 1);

  for (let i = 0; i < len; i += 3) {
    out[i]     = Math.max(0, Math.min(255, Math.round(rgb[i] * scaleR)));
    out[i + 1] = Math.max(0, Math.min(255, Math.round(rgb[i + 1] * scaleG)));
    out[i + 2] = Math.max(0, Math.min(255, Math.round(rgb[i + 2] * scaleB)));
  }

  return out;
}

/**
 * JS Approximation of CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * applied directly to the L channel (approximated) and reconstructed.
 */
export function applyCLAHE(
  rgb: Uint8Array,
  width: number,
  height: number,
  clipLimit = 2.0,
  tileGridSize: [number, number] = [8, 8]
): Uint8Array {
  const len = rgb.length;
  const out = new Uint8Array(len);
  const luma = new Uint8Array(width * height);

  // Extract luminance channel
  for (let i = 0, j = 0; i < len; i += 3, j++) {
    luma[j] = Math.max(0, Math.min(255, Math.round(0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2])));
  }

  const tilesX = tileGridSize[0];
  const tilesY = tileGridSize[1];
  const tileSizeX = Math.floor(width / tilesX);
  const tileSizeY = Math.floor(height / tilesY);
  const numPixelsInTile = tileSizeX * tileSizeY;

  // Compute mapping table per tile
  const maps: Uint8Array[] = [];
  const limit = Math.max(1, Math.round(clipLimit * (numPixelsInTile / 256)));

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const hist = new Int32Array(256);
      const startX = tx * tileSizeX;
      const startY = ty * tileSizeY;

      // Build local histogram
      for (let y = 0; y < tileSizeY; y++) {
        for (let x = 0; x < tileSizeX; x++) {
          const val = luma[(startY + y) * width + (startX + x)];
          hist[val]++;
        }
      }

      // Clip local histogram and compute excess
      let excess = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > limit) {
          excess += hist[b] - limit;
          hist[b] = limit;
        }
      }

      // Redistribute clipped excess evenly
      const binIncrement = Math.floor(excess / 256);
      const remainder = excess % 256;

      for (let b = 0; b < 256; b++) {
        hist[b] += binIncrement;
      }
      for (let b = 0; b < remainder; b++) {
        hist[b]++;
      }

      // Compute CDF
      let cdfMin = -1;
      let sum = 0;
      const cdf = new Int32Array(256);
      for (let b = 0; b < 256; b++) {
        sum += hist[b];
        cdf[b] = sum;
        if (cdfMin === -1 && sum > 0) cdfMin = sum;
      }

      // Create mapping lookup table
      const map = new Uint8Array(256);
      const denom = numPixelsInTile - cdfMin || 1;
      for (let b = 0; b < 256; b++) {
        map[b] = Math.max(0, Math.min(255, Math.round(((cdf[b] - cdfMin) / denom) * 255)));
      }
      maps.push(map);
    }
  }

  // Precompute horizontal tile indices and interpolation weights
  const tx0_arr = new Int32Array(width);
  const tx1_arr = new Int32Array(width);
  const wx_arr = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const tx = (x - tileSizeX / 2) / tileSizeX;
    const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(tx)));
    const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
    tx0_arr[x] = tx0;
    tx1_arr[x] = tx1;
    wx_arr[x] = tx - tx0;
  }

  // Precompute vertical tile indices and interpolation weights
  const ty0_arr = new Int32Array(height);
  const ty1_arr = new Int32Array(height);
  const wy_arr = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const ty = (y - tileSizeY / 2) / tileSizeY;
    const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(ty)));
    const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
    ty0_arr[y] = ty0;
    ty1_arr[y] = ty1;
    wy_arr[y] = ty - ty0;
  }

  // Bilinear interpolation mapping using precomputed weights
  for (let y = 0; y < height; y++) {
    const ty0 = ty0_arr[y];
    const ty1 = ty1_arr[y];
    const wy = wy_arr[y];
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const lVal = luma[idx];

      const tx0 = tx0_arr[x];
      const tx1 = tx1_arr[x];
      const wx = wx_arr[x];

      const map00 = maps[ty0 * tilesX + tx0];
      const map01 = maps[ty0 * tilesX + tx1];
      const map10 = maps[ty1 * tilesX + tx0];
      const map11 = maps[ty1 * tilesX + tx1];

      const val00 = map00[lVal];
      const val01 = map01[lVal];
      const val10 = map10[lVal];
      const val11 = map11[lVal];

      const top = val00 * (1 - wx) + val01 * wx;
      const bottom = val10 * (1 - wx) + val11 * wx;
      const lEnhanced = Math.round(top * (1 - wy) + bottom * wy);

      const scale = lEnhanced / Math.max(lVal, 1);
      const rgbIdx = idx * 3;

      out[rgbIdx]     = Math.max(0, Math.min(255, Math.round(rgb[rgbIdx] * scale)));
      out[rgbIdx + 1] = Math.max(0, Math.min(255, Math.round(rgb[rgbIdx + 1] * scale)));
      out[rgbIdx + 2] = Math.max(0, Math.min(255, Math.round(rgb[rgbIdx + 2] * scale)));
    }
  }

  return out;
}

/**
 * JS Shadow Removal using HSV Shadow Mask and TELEA-like surrounding pixel average inpaint.
 */
export function removeShadows(
  rgb: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const out = new Uint8Array(rgb);
  const mask = new Uint8Array(width * height);

  // Detect shadow mask: pixels where V < 50 and S < 30 on 0-255 scale
  for (let i = 0; i < width * height; i++) {
    const idx = i * 3;
    const r = rgb[idx];
    const g = rgb[idx + 1];
    const b = rgb[idx + 2];

    const v = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = v === 0 ? 0 : (255 * (v - min)) / v;

    if (v < 50 && s < 30) {
      mask[i] = 1;
    }
  }

  // 8-neighbor local inpaint propagation (2 passes)
  const temp = new Uint8Array(out);
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1) {
          let sumR = 0, sumG = 0, sumB = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = (y + dy) * width + (x + dx);
              if (mask[nIdx] === 0) {
                sumR += temp[nIdx * 3];
                sumG += temp[nIdx * 3 + 1];
                sumB += temp[nIdx * 3 + 2];
                count++;
              }
            }
          }
          if (count > 0) {
            out[idx * 3]     = Math.round(sumR / count);
            out[idx * 3 + 1] = Math.round(sumG / count);
            out[idx * 3 + 2] = Math.round(sumB / count);
            mask[idx] = 0;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
    temp.set(out);
  }

  return out;
}

/**
 * Fast Gamma Correction using precomputed Lookup Table (LUT).
 */
export function applyGammaCorrection(
  rgb: Uint8Array,
  gamma: number
): Uint8Array {
  const lut = new Uint8Array(256);
  const invGamma = 1.0 / gamma;
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(i / 255, invGamma))));
  }

  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) {
    out[i] = lut[rgb[i]];
  }

  return out;
}

/**
 * Fast 3x3 Gaussian Blur filter.
 */
export function applyGaussianBlur3x3(
  rgb: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const out = new Uint8Array(rgb);
  const kernel = [
    1 / 16, 2 / 16, 1 / 16,
    2 / 16, 4 / 16, 2 / 16,
    1 / 16, 2 / 16, 1 / 16
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kVal = kernel[(ky + 1) * 3 + (kx + 1)];
          const pixelIdx = ((y + ky) * width + (x + kx)) * 3;
          r += rgb[pixelIdx] * kVal;
          g += rgb[pixelIdx + 1] * kVal;
          b += rgb[pixelIdx + 2] * kVal;
        }
      }
      const destIdx = (y * width + x) * 3;
      out[destIdx]     = Math.round(r);
      out[destIdx + 1] = Math.round(g);
      out[destIdx + 2] = Math.round(b);
    }
  }

  return out;
}

/**
 * Calculates lighting quality score and categorizes issues.
 */
export function getLightingScore(
  faceRegionRGB: Uint8Array,
  fullFrameRGB?: Uint8Array
): {
  score: number;
  issue: 'too_dark' | 'too_bright' | 'shadow' | 'backlight' | null;
} {
  const len = faceRegionRGB.length;
  const pixels = len / 3;
  if (pixels === 0) return { score: 0, issue: null };

  let sumFaceLuma = 0;
  let highlights = 0;
  let shadows = 0;

  for (let i = 0; i < len; i += 3) {
    const luma = 0.299 * faceRegionRGB[i] + 0.587 * faceRegionRGB[i + 1] + 0.114 * faceRegionRGB[i + 2];
    sumFaceLuma += luma;
    if (luma > 235) highlights++;
    if (luma < 45) shadows++;
  }

  const meanFaceBrightness = sumFaceLuma / pixels;
  const shadowRatio = shadows / pixels;

  // Backlight: face is in shadow (<80) but background is bright (>150)
  let backlightDetected = false;
  if (fullFrameRGB && fullFrameRGB.length > 0) {
    let sumFrameLuma = 0;
    const framePixels = fullFrameRGB.length / 3;
    for (let i = 0; i < fullFrameRGB.length; i += 3) {
      sumFrameLuma += 0.299 * fullFrameRGB[i] + 0.587 * fullFrameRGB[i + 1] + 0.114 * fullFrameRGB[i + 2];
    }
    const meanFrameBrightness = sumFrameLuma / framePixels;
    if (meanFaceBrightness < 80 && meanFrameBrightness > 150) {
      backlightDetected = true;
    }
  }

  let score = 100;
  let issue: 'too_dark' | 'too_bright' | 'shadow' | 'backlight' | null = null;

  if (meanFaceBrightness < 60) {
    score -= (60 - meanFaceBrightness) * 1.5;
    issue = 'too_dark';
  } else if (meanFaceBrightness > 200) {
    score -= (meanFaceBrightness - 200) * 1.5;
    issue = 'too_bright';
  } else if (shadowRatio > 0.40) {
    score -= (shadowRatio - 0.40) * 120;
    issue = 'shadow';
  } else if (backlightDetected) {
    score -= 45;
    issue = 'backlight';
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, issue };
}

/**
 * Dynamic enhancement on face region based on real-time brightness and variance.
 */
export function realTimeQualityCheckAndEnhance(
  faceRegion: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const len = faceRegion.length;
  const pixels = len / 3;
  if (pixels === 0) return faceRegion;

  // Calculate average brightness
  let sum = 0;
  for (let i = 0; i < len; i += 3) {
    sum += 0.299 * faceRegion[i] + 0.587 * faceRegion[i + 1] + 0.114 * faceRegion[i + 2];
  }
  const mean = sum / pixels;

  let out: any = new Uint8Array(len);
  out.set(faceRegion);

  if (mean < 60) {
    out = applyGammaCorrection(out, 1.5); // gamma > 1.0 brightens
  } else if (mean > 200) {
    out = applyGammaCorrection(out, 0.6); // gamma < 1.0 darkens
  }

  return out;
}
