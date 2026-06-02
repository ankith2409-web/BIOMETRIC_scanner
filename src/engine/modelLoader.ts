import { loadTensorflowModel } from "react-native-fast-tflite";
import { LoadedModels, TFLiteModel } from "./modelLoader.types";

const MODEL_URIS = {
  blazeFace: 'asset:/models/blazeface.tflite',
  faceMesh: 'asset:/models/face_mesh.tflite',
  mobileFaceNet: 'asset:/models/mobilefacenet_int8.tflite',
  mobileFaceNetFull: 'asset:/models/MobileFaceNet_Full.tflite',
  antiSpoofing: 'asset:/models/FaceAntiSpoofing.tflite',
  pNet: 'asset:/models/pnet.tflite',
  rNet: 'asset:/models/rnet.tflite',
  oNet: 'asset:/models/onet.tflite',
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
      onProgress?.(1, 8, "Loading BlazeFace");
      const blazeFace = (await loadTensorflowModel(
        require("../../assets/models/blazeface.tflite"),
      )) as TFLiteModel;

      onProgress?.(2, 8, "Loading Face Mesh");
      const faceMesh = (await loadTensorflowModel(
        require("../../assets/models/face_mesh.tflite"),
      )) as TFLiteModel;

      onProgress?.(3, 8, "Loading MobileFaceNet (int8)");
      const mobileFaceNet = (await loadTensorflowModel(
        require("../../assets/models/mobilefacenet_int8.tflite"),
      )) as TFLiteModel;

      onProgress?.(4, 8, "Loading MobileFaceNet Full");
      const mobileFaceNetFull = (await loadTensorflowModel(
        require("../../assets/models/MobileFaceNet_Full.tflite"),
      )) as TFLiteModel;

      onProgress?.(5, 8, "Loading Anti-Spoofing");
      const antiSpoofing = (await loadTensorflowModel(
        require("../../assets/models/FaceAntiSpoofing.tflite"),
      )) as TFLiteModel;

      onProgress?.(6, 8, "Loading MTCNN P-Net");
      const pNet = (await loadTensorflowModel(
        require("../../assets/models/pnet.tflite"),
      )) as TFLiteModel;

      onProgress?.(7, 8, "Loading MTCNN R-Net");
      const rNet = (await loadTensorflowModel(
        require("../../assets/models/rnet.tflite"),
      )) as TFLiteModel;

      onProgress?.(8, 8, "Loading MTCNN O-Net");
      const oNet = (await loadTensorflowModel(
        require("../../assets/models/onet.tflite"),
      )) as TFLiteModel;

      this.models = { blazeFace, faceMesh, mobileFaceNet, mobileFaceNetFull, antiSpoofing, pNet, rNet, oNet };
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

