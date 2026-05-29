import { frameProcessorEngine } from './src/engine/frameProcessor';
import { modelLoader } from './src/engine/modelLoader';
import { FaceEmbedding } from './src/types/face';

export const initializeModels = async (onProgress?: (text: string) => void) => {
  await modelLoader.loadAll((step, total, label) => {
    onProgress?.(`${label} (${step}/${total})`);
  });
};

export const registerEmbeddingFromFrame = async (frameRGB: Uint8Array) => {
  const result = await frameProcessorEngine.processForEmbedding(frameRGB);
  return {
    livenessPass: result.livenessPass,
    embedding: result.embedding,
    timing: result.timing,
  };
};

export const authenticateFromFrame = async (frameRGB: Uint8Array, enrolled: FaceEmbedding[]) => {
  return frameProcessorEngine.processForAuth(frameRGB, enrolled);
};
