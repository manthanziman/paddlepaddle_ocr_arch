// npm install ppu-paddle-ocr onnxruntime-node sharp
import { PaddleOcrService, V6_SMALL_MODEL } from 'ppu-paddle-ocr';

// Single PaddleOCR engine instance for the whole process.
// Created and initialized exactly once (call initPaddleOcrEngine() at app startup).
let serviceInstance = null;
let initPromise = null;

export function initPaddleOcrEngine(options = {}) {
  if (serviceInstance) return Promise.resolve(serviceInstance);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const service = new PaddleOcrService({
      model: V6_SMALL_MODEL,
      session: {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
      },
      processing: { engine: 'opencv' },
      ...options,
    });

    await service.initialize();

    serviceInstance = service;
    initPromise = null;
    return serviceInstance;
  })();

  return initPromise;
}

export function getPaddleOcrEngine() {
  if (!serviceInstance) {
    throw new Error(
      'PaddleOCR engine not initialized. Call initPaddleOcrEngine() once at application startup before handling requests.'
    );
  }
  return serviceInstance;
}

export async function terminatePaddleOcrEngine() {
  if (serviceInstance) {
    await serviceInstance.destroy();
    serviceInstance = null;
  }
}