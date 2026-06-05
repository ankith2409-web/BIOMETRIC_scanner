declare module '@tensorflow/tfjs-tflite/dist/tf-tflite.js' {
  export function setWasmPath(path: string): void;
  export function loadTFLiteModel(modelUrl: string | object): Promise<any>;
}
