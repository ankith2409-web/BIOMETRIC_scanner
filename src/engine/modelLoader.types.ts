export type TFLiteModel = {
  run: (input: unknown) => Promise<unknown>;
  runSync?: (input: unknown) => unknown;
};

export interface LoadedModels {
  blazeFace: TFLiteModel;
  faceMesh: TFLiteModel;
  mobileFaceNet: TFLiteModel;
}
