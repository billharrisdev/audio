export interface SeparationModelInfo {
  name: string;            // Friendly name
  id: string;              // Key used internally
  url: string;             // URL (or relative path) to ONNX model
  sampleRate: number;      // Expected sample rate for model
  chunkSize: number;       // Frames per chunk model expects
  stems: string[];         // Stems produced (e.g., ['vocals','drums','bass','other'])
  requiresStereo: boolean; // Whether input must be stereo
  description?: string;
}

export interface SeparationProgress {
  stage: 'downloading' | 'initializing' | 'chunk' | 'post' | 'done' | 'error';
  loadedBytes?: number;
  totalBytes?: number;
  chunkIndex?: number;
  chunkCount?: number;
  message?: string;
}
