import { SeparationModelInfo } from '../../models/onnx-types';

// Registry of available ONNX models (placeholder demo entries). In practice you would host
// quantized / chunk-friendly models in your repo under assets/models/ or a CDN.
export const MODEL_REGISTRY: SeparationModelInfo[] = [
  {
    name: 'Demo 4-Stem (Placeholder)',
    id: 'demo4',
    url: 'assets/models/demo4.onnx', // Placeholder path
    sampleRate: 44100,
    chunkSize: 44100 * 8, // 8s windows
    stems: ['vocals','drums','bass','other'],
    requiresStereo: true,
    description: 'Example entry; supply real model file.'
  }
];

export function getModel(id: string): SeparationModelInfo | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}
