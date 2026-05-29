import { LandmarkPoint } from '../types/face';

interface KeyPoints {
  leftEye: LandmarkPoint;
  rightEye: LandmarkPoint;
  noseTip: LandmarkPoint;
  mouthLeft: LandmarkPoint;
  mouthRight: LandmarkPoint;
}

const MEAN = 127.5;
const SCALE = 128.0;

export const extractFivePointLandmarks = (landmarks: LandmarkPoint[]): KeyPoints | null => {
  const leftEye = landmarks[468 - 6] ?? landmarks[263];
  const rightEye = landmarks[33];
  const noseTip = landmarks[1];
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  if (!leftEye || !rightEye || !noseTip || !mouthLeft || !mouthRight) return null;
  return { leftEye, rightEye, noseTip, mouthLeft, mouthRight };
};

export const normalizeAlignedFace = (rgb112: Uint8Array): Float32Array => {
  const out = new Float32Array(rgb112.length);
  for (let i = 0; i < rgb112.length; i += 1) {
    out[i] = (rgb112[i] - MEAN) / SCALE;
  }
  return out;
};

export const normalizeAlignedFacePerFace = (rgb112: Uint8Array): Float32Array => {
  const len = rgb112.length;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += rgb112[i];
  }
  const mean = sum / len;

  let variance = 0;
  for (let i = 0; i < len; i++) {
    const diff = rgb112[i] - mean;
    variance += diff * diff;
  }
  const std = Math.sqrt(variance / len) + 1e-8;

  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (rgb112[i] - mean) / std;
  }
  return out;
};
