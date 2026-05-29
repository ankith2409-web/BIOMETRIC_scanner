import { LoadedModels, TFLiteModel } from './modelLoader.types';

const MODEL_URIS = {
  blazeFace: '',
  faceMesh: '',
  mobileFaceNet: '',
} as const;

class ModelLoaderSingleton {
  private models: LoadedModels | null = null;

  async loadAll(onProgress?: (step: number, total: number, label: string) => void): Promise<LoadedModels> {
    if (this.models) return this.models;

    // Web fallback keeps existing browser flow operational.
    this.models = {
      blazeFace: { run: async () => ({}) },
      faceMesh: { run: async () => ({}) },
      mobileFaceNet: { run: async () => ({}) },
    };
    
    // Simulate minor delay for compatibility with UI loaders
    onProgress?.(1, 3, 'Preparing web environment');
    await new Promise(resolve => setTimeout(resolve, 50));
    onProgress?.(2, 3, 'Preparing mock models');
    await new Promise(resolve => setTimeout(resolve, 50));
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
