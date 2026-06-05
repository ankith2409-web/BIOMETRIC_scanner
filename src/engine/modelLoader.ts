import { loadTensorflowModel } from "react-native-fast-tflite";
import { LoadedModels, TFLiteModel } from "./modelLoader.types";

const MODEL_URIS = {
  blazeFace: 'asset:/models/blazeface.tflite',
  faceMesh: 'asset:/models/face_mesh.tflite',
  mobileFaceNetFull: 'asset:/models/MobileFaceNet_Full.tflite',
  antiSpoofing: 'asset:/models/FaceAntiSpoofing.tflite',
} as const;

class ModelLoaderSingleton {
  private models: LoadedModels | null = null;
  private pending: Promise<LoadedModels> | null = null;

  async loadAll(
    onProgress?: (step: number, total: number, label: string) => void,
  ): Promise<LoadedModels> {
    if (this.models) return this.models;
    if (this.pending) return this.pending;

    this.pending = (async () => {
      const totalSteps = 4;

      onProgress?.(1, totalSteps, "Loading BlazeFace Detector");
      const blazeFace = (await loadTensorflowModel(
        require("../../assets/models/blazeface.tflite"),
      )) as TFLiteModel;

      onProgress?.(2, totalSteps, "Loading Face Mesh");
      const faceMesh = (await loadTensorflowModel(
        require("../../assets/models/face_mesh.tflite"),
      )) as TFLiteModel;

      onProgress?.(3, totalSteps, "Loading MobileFaceNet");
      const mobileFaceNetFull = (await loadTensorflowModel(
        require("../../assets/models/MobileFaceNet_Full.tflite"),
      )) as TFLiteModel;

      onProgress?.(4, totalSteps, "Loading Anti-Spoofing");
      const antiSpoofing = (await loadTensorflowModel(
        require("../../assets/models/FaceAntiSpoofing.tflite"),
      )) as TFLiteModel;

      // mobileFaceNet (int8) kept as alias to Full for backward compat
      this.models = {
        blazeFace,
        faceMesh,
        mobileFaceNet: mobileFaceNetFull,
        mobileFaceNetFull,
        antiSpoofing,
      };
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


