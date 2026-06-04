import { Asset } from 'expo-asset';
import { LoadedModels, TFLiteModel } from './modelLoader.types';
import * as tflite from '@tensorflow/tfjs-tflite/dist/tf-tflite.js';
import * as tf from '@tensorflow/tfjs-core';

const MODEL_URIS = {
  blazeFace: require('../../assets/models/blazeface.tflite'),
  faceMesh: require('../../assets/models/face_mesh.tflite'),
  mobileFaceNet: require('../../assets/models/mobilefacenet_int8.tflite'),
  mobileFaceNetFull: require('../../assets/models/MobileFaceNet_Full.tflite'),
  antiSpoofing: require('../../assets/models/FaceAntiSpoofing.tflite'),
  pNet: require('../../assets/models/pnet.tflite'),
  rNet: require('../../assets/models/rnet.tflite'),
  oNet: require('../../assets/models/onet.tflite'),
} as const;

class ModelLoaderSingleton {
  private models: LoadedModels | null = null;

  async loadAll(onProgress?: (step: number, total: number, label: string) => void): Promise<LoadedModels> {
    if (this.models) return this.models;

    onProgress?.(1, 3, 'Preparing web environment');
    
    // Set WASM path to fetch from CDN
    tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/wasm/');

    const loadModel = async (modelModule: any) => {
      const asset = await Asset.fromModule(modelModule).downloadAsync();
      const model = await tflite.loadTFLiteModel(asset.uri);
      return {
        run: async (input: any) => {
          let tensorInput = input;
          // If input is Float32Array, convert it to a tensor.
          // MobileFaceNet uses [1, 112, 112, 3] or [2, 112, 112, 3] and AntiSpoofing uses [1, 256, 256, 3]
          if (input instanceof Float32Array) {
            const inputShape = (model.inputs && model.inputs[0] && model.inputs[0].shape)
              ? model.inputs[0].shape
              : null;

            if (inputShape) {
              const expectedSize = inputShape.reduce((a: number, b: number) => a * b, 1);
              if (input.length === expectedSize) {
                tensorInput = tf.tensor(input, inputShape);
              } else if (inputShape[0] > 1) {
                // Batch size > 1, but we only have 1 image. Duplicate to fill batch size.
                const batchSize = inputShape[0];
                const singleImageSize = expectedSize / batchSize;
                if (input.length === singleImageSize) {
                  const batchInput = new Float32Array(expectedSize);
                  for (let i = 0; i < batchSize; i++) {
                    batchInput.set(input, i * singleImageSize);
                  }
                  tensorInput = tf.tensor(batchInput, inputShape);
                } else {
                  tensorInput = tf.tensor(input);
                }
              } else {
                tensorInput = tf.tensor(input);
              }
            } else {
              // Fallback
              if (input.length === 112 * 112 * 3) {
                // Default to batch size of 2 for MobileFaceNet Full
                const batchInput = new Float32Array(input.length * 2);
                batchInput.set(input);
                batchInput.set(input, input.length);
                tensorInput = tf.tensor(batchInput, [2, 112, 112, 3]);
              } else if (input.length === 256 * 256 * 3) {
                tensorInput = tf.tensor(input, [1, 256, 256, 3]);
              } else {
                tensorInput = tf.tensor(input);
              }
            }
          }
          const result = model.predict(tensorInput) as any;
          // In native it returns a tensor array or object. Let's return what native returns.
          // AntiSpoofing expects an array of two outputs: clssPred and leafNodeMask
          if (Array.isArray(result)) {
            const outArr = [];
            for (const r of result) {
              outArr.push(await r.data());
            }
            return outArr;
          }
          if (result && result.data) {
            return [await result.data()];
          }
          // Some tfjs-tflite models return dictionary of tensors
          if (result && typeof result === 'object') {
            const keys = Object.keys(result);
            const outArr = [];
            for (const k of keys) {
              outArr.push(await result[k].data());
            }
            return outArr;
          }
          return [await result.data()];
        },
        model: model
      };
    };

    onProgress?.(2, 3, 'Loading TFLite models');
    
    const [
      mobileFaceNetFull,
      antiSpoofing
    ] = await Promise.all([
      loadModel(MODEL_URIS.mobileFaceNetFull),
      loadModel(MODEL_URIS.antiSpoofing)
    ]);

    // Keep mocks for models not yet used in web
    this.models = {
      blazeFace: { run: async () => ({}) },
      faceMesh: { run: async () => ({}) },
      mobileFaceNet: { run: async () => ({}) },
      mobileFaceNetFull,
      antiSpoofing,
      pNet: { run: async () => ({}) },
      rNet: { run: async () => ({}) },
      oNet: { run: async () => ({}) },
    };
    
    onProgress?.(3, 3, 'Ready');
    
    return this.models;
  }

  getModels(): LoadedModels | null {
    return this.models;
  }

  reset(): void {
    this.models = null;
  }
}

export const modelLoader = new ModelLoaderSingleton();
export { MODEL_URIS };
export type { LoadedModels, TFLiteModel };
