import { SeparationModelInfo, SeparationProgress } from './onnx-types';

export interface LoadModelRequest { type: 'loadModel'; model: SeparationModelInfo; }
export interface SeparateRequest { type: 'separate'; channels: Float32Array[]; sampleRate: number; remove?: string; }
export type WorkerRequest = LoadModelRequest | SeparateRequest;

export interface ProgressMessage extends SeparationProgress { kind: 'progress'; }
export interface ReadyMessage { kind: 'ready'; modelId: string; }
export interface ResultMessage { kind: 'result'; stems: { name: string; channels: Float32Array[] }[]; }
export interface ErrorMessage { kind: 'error'; error: string; }
export type WorkerResponse = ProgressMessage | ReadyMessage | ResultMessage | ErrorMessage;
