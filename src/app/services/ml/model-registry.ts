import { SeparationModelInfo } from '../../models/onnx-types';

// NOTE: Large state-of-the-art open-source models (e.g., Demucs, MDX) are often 100MB+. For a web demo,
// consider a distilled / quantized variant. Here we reference a hypothetical quantized MDX Demucs 4-stem
// ONNX model you would need to supply under assets/models/. Adjust URL, chunkSize, and stems to match.
export const MODEL_REGISTRY: SeparationModelInfo[] = [
  {
    name: 'MDX-Demucs 4-Stem (Quantized)',
    id: 'mdx_q4',
    url: 'assets/models/mdx_demucs_4stem_q.onnx',
    sampleRate: 44100,
    chunkSize: 44100 * 15, // 15s window (tune based on model receptive field)
    stems: ['vocals','drums','bass','other'],
    requiresStereo: true,
    description: 'Quantized MDX-Demucs 4-stem model (provide file separately).'
  }
];

export function getModel(id: string): SeparationModelInfo | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}
