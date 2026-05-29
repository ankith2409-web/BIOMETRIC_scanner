import { loadTensorflowModel } from 'react-native-fast-tflite';
import { LoadedModels, TFLiteModel } from './modelLoader.types';

const MODEL_URIS = {
  blazeFace: 'asset:/models/blazeface.tflite',
  faceMesh: 'asset:/models/face_mesh.tflite',
  mobileFaceNet: 'asset:/models/mobilefacenet_int8.tflite',
} as const;

class ModelLoaderSingleton {
  private models: LoadedModels | null = null;
  private pending: Promise<LoadedModels> | null = null;

  async loadAll(onProgress?: (step: number, total: number, label: string) => void): Promise<LoadedModels> {
    if (this.models) return this.models;
    if (this.pending) return this.pending;

    this.pending = (async () => {
      onProgress?.(1, 3, 'Loading BlazeFace');
      const blazeFace = (await loadTensorflowModel(require('../../assets/models/blazeface.tflite'))) as TFLiteModel;

      onProgress?.(2, 3, 'Loading Face Mesh');
      const faceMesh = (await loadTensorflowModel(require('../../assets/models/face_mesh.tflite'))) as TFLiteModel;

      onProgress?.(3, 3, 'Loading MobileFaceNet');
      const mobileFaceNet = (await loadTensorflowModel(require('../../assets/models/mobilefacenet_int8.tflite'))) as TFLiteModel;

      this.models = { blazeFace, faceMesh, mobileFaceNet };
      return this.models;
    })().finally(() => {
      this.pending = null;
    });

    return this.pending;
  }

  getModels(): LoadedModels | null {
    return this.models;
  }

  reset(): void {
    this.models = null;
    this.pending = null;
  }
}

export const modelLoader = new ModelLoaderSingleton();
export { MODEL_URIS };
export type { LoadedModels, TFLiteModel };
